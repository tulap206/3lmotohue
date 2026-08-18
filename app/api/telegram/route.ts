import { NextRequest, NextResponse } from "next/server"
import { verifyJWT } from "@/lib/auth-jwt"
import { sendTelegramNotification } from "@/lib/telegram-notify"

function jwtSecret() {
  return process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || "fallback-secret-key-3lmoto"
}

function configuredInternalSecrets() {
  return [
    process.env.INTERNAL_API_SECRET,
    process.env.NEXT_PUBLIC_INTERNAL_API_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get("x-internal-secret")?.trim()
  if (headerSecret && configuredInternalSecrets().includes(headerSecret)) {
    return true
  }

  const sessionToken = req.cookies.get("3l_moto_session")?.value
  if (!sessionToken) return false

  const decoded = await verifyJWT(sessionToken, jwtSecret())
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
