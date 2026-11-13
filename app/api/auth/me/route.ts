import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth-jwt'
import { getAuthSecret } from '@/lib/auth-secret'
import { getUserAvatarPublicUrl } from '@/lib/user-avatar'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('3l_moto_session')?.value
    if (!token) {
      return NextResponse.json({ authenticated: false })
    }

    const secret = getAuthSecret()
    const decoded = await verifyJWT(token, secret)

    if (!decoded) {
      return NextResponse.json({ authenticated: false })
    }

    // Return verified user session details
    const { exp, ...userData } = decoded
    if (userData.id && !userData.avatarUrl) {
      userData.avatarUrl = getUserAvatarPublicUrl(userData.id)
    }
    return NextResponse.json({ authenticated: true, user: userData })
  } catch (error) {
    console.error('API /api/auth/me error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
