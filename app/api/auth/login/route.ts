import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { signJWT } from '@/lib/auth-jwt'
import { hashPassword, generateSalt } from '@/lib/auth-crypto'
import { checkLoginAttempts, recordFailedLogin, resetLoginAttempts } from '@/lib/auth-guard'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "Unknown"

    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }

    // 1. Check lockout status
    const lockoutCheck = await checkLoginAttempts(username)
    if (!lockoutCheck.allowed) {
      return NextResponse.json({ 
        error: `Tài khoản bị tạm khóa. Vui lòng thử lại sau ${lockoutCheck.remainingMinutes} phút.` 
      }, { status: 423 })
    }

    // 2. Fetch user details from auth_users table
    const { data: userRecord, error: fetchError } = await supabase
      .from('auth_users')
      .select('*')
      .eq('username', username)
      .single()

    if (fetchError || !userRecord) {
      // Record failed attempt for tracking
      await recordFailedLogin(username, ip)
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 })
    }

    // 3. Verify password (support plain-text fallback & automatic migration to hash)
    let passwordIsValid = false
    
    if (userRecord.salt && userRecord.password_hash) {
      passwordIsValid = (hashPassword(password, userRecord.salt) === userRecord.password_hash)
    } else {
      // Old plain-text comparison
      passwordIsValid = (userRecord.password === password)
      
      // Auto-migrate to secure hash on successful login
      if (passwordIsValid) {
        try {
          const newSalt = generateSalt()
          const newHash = hashPassword(password, newSalt)
          
          await supabase
            .from('auth_users')
            .update({ 
              salt: newSalt, 
              password_hash: newHash,
              password: null // Clear plain-text password!
            })
            .eq('username', username)
            
          console.log(`🔒 Auto-migrated password for ${username} to secure hash.`)
        } catch (migrationErr) {
          console.error(`Failed to migrate password hash for ${username}:`, migrationErr)
        }
      }
    }

    if (!passwordIsValid) {
      await recordFailedLogin(username, ip)
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 })
    }

    // 4. Reset failed attempts count on success
    await resetLoginAttempts(username)

    // 5. Create payload & Sign JWT
    const secret = process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || 'fallback-secret-key-3lmoto'
    const userData = {
      id: userRecord.id,
      username: userRecord.username,
      displayName: userRecord.displayname,
      role: userRecord.role,
      permissions: {
        canDelete: userRecord.can_delete || false,
        canBackup: userRecord.role === 'admin' || userRecord.can_backup || false,
        canViewAccessHistory: userRecord.can_view_access_history || false,
      }
    }

    const token = await signJWT(
      { ...userData, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // 7 days
      secret
    )

    // 6. Set HTTP-Only Cookie
    const response = NextResponse.json({ success: true, user: userData })
    response.cookies.set('3l_moto_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    })

    // Log login activity
    try {
      await logger.log(userData.username, userData.displayName, 'Đăng nhập', 'Hệ thống', `${userData.displayName} đăng nhập thành công (Secure System)`)
    } catch (e) {}

    return response
  } catch (error: any) {
    console.error('API login error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 })
  }
}
