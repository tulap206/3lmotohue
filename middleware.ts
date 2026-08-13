import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/auth-jwt'

// Simple in-memory rate limiter store
const ipRequestMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/telegram':     { max: 10,  windowMs: 60_000  },  // 10 req / minute
  '/api/visitor-log':  { max: 5,   windowMs: 60_000  },  // 5 req / minute
  '/api/backup':       { max: 3,   windowMs: 300_000 },  // 3 req / 5 minutes
  '/login':            { max: 15,  windowMs: 300_000 },  // 15 attempts / 5 minutes
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function isRateLimited(key: string, limit: { max: number; windowMs: number }): boolean {
  const now = Date.now()
  const record = ipRequestMap.get(key)
  
  if (!record || now > record.resetAt) {
    ipRequestMap.set(key, { count: 1, resetAt: now + limit.windowMs })
    return false
  }
  
  if (record.count >= limit.max) return true
  record.count++
  return false
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const ip = getClientIp(request)

  // 1. Rate Limiting Check
  for (const [path, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(path)) {
      const key = `${ip}:${path}`
      if (isRateLimited(key, limit)) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(limit.windowMs / 1000)) }
          }
        )
      }
    }
  }

  // 2. Server-side Session Protection for Dashboard
  if (pathname.startsWith('/dashboard')) {
    const sessionToken = request.cookies.get('3l_moto_session')?.value

    if (!sessionToken) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const secret = process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || 'fallback-secret-key-3lmoto'
    const decoded = await verifyJWT(sessionToken, secret)

    if (!decoded) {
      // Session invalid or expired, clear cookie and redirect
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const response = NextResponse.redirect(url)
      response.cookies.delete('3l_moto_session')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
