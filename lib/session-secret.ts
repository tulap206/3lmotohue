export function getSessionSecret(): string | null {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  return secret || null
}
