const TELEGRAM_MAX_TEXT = 4000

function escapeHtml(text: string) {
  if (!text) return ""
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

/**
 * Gửi thông báo Telegram.
 * `details` dùng cú pháp *in đậm* (không nhúng HTML thô — sẽ bị escape).
 */
export async function sendTelegramNotification(
  event: string,
  details: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()

  if (!token || !chatId) {
    console.warn("⚠️ Telegram configuration missing. Notification skipped.")
    return { ok: false, error: "Telegram configurations not set." }
  }

  const safeEvent = escapeHtml(String(event || "").trim() || "(không có sự kiện)")
  const safeDetails = escapeHtml(String(details || "").trim() || "(không có chi tiết)").replace(
    /\*(.*?)\*/g,
    "<b>$1</b>"
  )

  let message = `🔔 <b>THÔNG BÁO HỆ THỐNG 3LMOTO</b>\n──────────────────\n📌 <b>Sự kiện:</b> ${safeEvent}\n📝 <b>Chi tiết:</b> ${safeDetails}\n⏰ <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n──────────────────`
  message = truncate(message, TELEGRAM_MAX_TEXT)

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
