import { NextRequest, NextResponse } from "next/server"
import { verifyJWT } from "@/lib/auth-jwt"
import { sendTelegramNotification } from "@/lib/telegram-notify"
import { getSessionSecret } from "@/lib/session-secret"

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = getSessionSecret()
  if (!secret) return false

  const headerSecret = req.headers.get("x-internal-secret")?.trim()
  if (headerSecret && headerSecret === secret) {
    return true
  }

  const sessionToken = req.cookies.get("3l_moto_session")?.value
  if (!sessionToken) return false

  const decoded = await verifyJWT(sessionToken, secret)
  return Boolean(decoded)
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const { event, details } = await req.json()
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim()

    try {
      const { supabase } = await import("@/lib/supabase")
      await supabase.from("access_logs").insert([{
        username: "system_telegram",
        displayname: "Hệ thống Telegram",
        action: "Gửi thông báo",
        module: "Telegram",
        details: `Nhận sự kiện: ${event} | Token: ${token ? `${token.substring(0, 22)}...${token.substring(token.length - 5)} (L:${token.length})` : "N/A"} | ChatID: ${chatId || "N/A"}`,
        timestamp: new Date().toISOString(),
      }])
    } catch (logErr) {
      console.error("❌ Failed to log telegram API call to DB:", logErr)
    }

    const result = await sendTelegramNotification(event, details)
    if (!result.ok) {
      try {
        const { supabase } = await import("@/lib/supabase")
        await supabase.from("access_logs").insert([{
          username: "system_telegram_error",
          displayname: "Hệ thống Telegram Lỗi",
          action: result.error === "Telegram configurations not set." ? "Thiếu cấu hình" : "Lỗi Telegram",
          module: "Telegram",
          details: result.error || "Unknown error",
          timestamp: new Date().toISOString(),
        }])
      } catch (e) {}
      return NextResponse.json(
        { error: result.error || "Failed to send Telegram notification" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("❌ Failed to send Telegram notification:", error)
    try {
      const { supabase } = await import("@/lib/supabase")
      await supabase.from("access_logs").insert([{
        username: "system_telegram_exception",
        displayname: "Ngoại lệ Telegram",
        action: "Lỗi Ngoại lệ",
        module: "Telegram",
        details: `Ngoại lệ: ${error.message}`,
        timestamp: new Date().toISOString(),
      }])
    } catch (e) {}
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
