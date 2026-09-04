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
    const result = await sendTelegramNotification(event, details)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to send Telegram notification" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("❌ Failed to send Telegram notification:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
