import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { event, details } = await req.json()
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim()

    // Log the API call to database at the very beginning for debugging environment variables
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

    if (!token || !chatId) {
      console.warn("⚠️ Telegram configuration missing. Notification skipped.")
      try {
        const { supabase } = await import("@/lib/supabase")
        await supabase.from("access_logs").insert([{
          username: "system_telegram_error",
          displayname: "Hệ thống Telegram Lỗi",
          action: "Thiếu cấu hình",
          module: "Telegram",
          details: `Thiếu biến cấu hình trên Vercel. Token: ${!!token} | ChatID: ${!!chatId}`,
          timestamp: new Date().toISOString(),
        }])
      } catch (e) {}
      return NextResponse.json({ message: "Telegram configurations not set." }, { status: 400 })
    }

    // HTML escape helper
    const escapeHtml = (text: string) => {
      if (!text) return ""
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    }

    // Escape event and details for safe HTML parsing
    const safeEvent = escapeHtml(event)
    // Convert bold markdown syntax (*bold*) to HTML bold (<b>bold</b>) after escaping
    const safeDetails = escapeHtml(details).replace(/\*(.*?)\*/g, "<b>$1</b>")

    const message = `🔔 <b>THÔNG BÁO HỆ THỐNG 3LMOTO</b>\n──────────────────\n📌 <b>Sự kiện:</b> ${safeEvent}\n📝 <b>Chi tiết:</b> ${safeDetails}\n⏰ <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n──────────────────`

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("❌ Telegram Bot API Error:", data.description)
      // Log the API error details to DB
      try {
        const { supabase } = await import("@/lib/supabase")
        await supabase.from("access_logs").insert([{
          username: "system_telegram_error",
          displayname: "Hệ thống Telegram Lỗi",
          action: "Lỗi Telegram",
          module: "Telegram",
          details: `Lỗi: ${data.description} | Token: ${token ? token.substring(0, 8) + "..." : "N/A"}`,
          timestamp: new Date().toISOString(),
        }])
      } catch (e) {}
      return NextResponse.json({ error: data.description }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("❌ Failed to send Telegram notification:", error)
    // Log the exception to DB
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
