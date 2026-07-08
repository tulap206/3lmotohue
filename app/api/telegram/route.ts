import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { event, details } = await req.json()
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
      console.warn("⚠️ Telegram configuration missing. Notification skipped.")
      return NextResponse.json({ message: "Telegram configurations not set. Notification skipped." })
    }

    const message = `🔔 *THÔNG BÁO HỆ THỐNG 3LMOTO*\n──────────────────\n📌 *Sự kiện:* ${event}\n📝 *Chi tiết:* ${details}\n⏰ *Thời gian:* ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n──────────────────`

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("❌ Telegram Bot API Error:", data.description)
      return NextResponse.json({ error: data.description }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("❌ Failed to send Telegram notification:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
