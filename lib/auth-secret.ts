/**
 * Single source cho JWT / session secret.
 * Ưu tiên INTERNAL_API_SECRET (server-only); không dựa vào NEXT_PUBLIC khi đã có secret nội bộ.
 */
const FALLBACK = "fallback-secret-key-3lmoto"

let warnedFallback = false

export function getAuthSecret(): string {
  const secret =
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_INTERNAL_API_SECRET?.trim() ||
    FALLBACK

  if (
    secret === FALLBACK &&
    process.env.NODE_ENV === "production" &&
    !warnedFallback
  ) {
    warnedFallback = true
    console.error(
      "[auth] INTERNAL_API_SECRET chưa cấu hình trên production — đang dùng fallback (không an toàn)."
    )
  }

  return secret
}

export function isUsingAuthSecretFallback(): boolean {
  return getAuthSecret() === FALLBACK
}
