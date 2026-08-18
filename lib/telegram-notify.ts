export async function sendTelegramNotification(event: string, details: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()

  if (!token || !chatId) {
    console.warn("⚠️ Telegram configuration missing. Notification skipped.")
    return { ok: false, error: "Telegram configurations not set." }
  }

  const escapeHtml = (text: string) => {
    if (!text) return ""
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }

  const safeEvent = escapeHtml(event)
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
    return { ok: false, error: data.description }
  }

  return { ok: true }
}
