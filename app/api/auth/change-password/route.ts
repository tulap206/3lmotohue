import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/auth-jwt'
import { hashPassword, generateSalt } from '@/lib/auth-crypto'
import { getSessionSecret } from '@/lib/session-secret'

export async function POST(request: NextRequest) {
  try {
    const { oldPassword, newPassword } = await request.json()
    
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên' }, { status: 400 })
    }

    // 1. Verify user session from cookie
    const token = request.cookies.get('3l_moto_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc phiên hết hạn' }, { status: 401 })
    }

    const secret = getSessionSecret()
    if (!secret) {
      return NextResponse.json({ error: 'Cấu hình phiên đăng nhập chưa sẵn sàng' }, { status: 500 })
    }

    const decoded = await verifyJWT(token, secret)
    if (!decoded) {
      return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 })
    }

    // 2. Fetch current user from database
    const { data: userRecord, error: fetchError } = await supabase
      .from('auth_users')
      .select('*')
      .eq('username', decoded.username)
      .single()

    if (fetchError || !userRecord) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })
    }

    // 3. Verify old password
    let passwordIsValid = false
    if (userRecord.salt && userRecord.password_hash) {
      passwordIsValid = (hashPassword(oldPassword, userRecord.salt) === userRecord.password_hash)
    } else {
      passwordIsValid = (userRecord.password === oldPassword)
    }

    if (!passwordIsValid) {
      return NextResponse.json({ error: 'Mật khẩu cũ không đúng' }, { status: 400 })
    }

    // 4. Generate new salt and hash for new password
    const newSalt = generateSalt()
    const newHash = hashPassword(newPassword, newSalt)

    // 5. Update database, clear plain-text password for security
    const { error: updateError } = await supabase
      .from('auth_users')
      .update({
        salt: newSalt,
        password_hash: newHash,
        password: null // Clear plain-text password!
      })
      .eq('username', decoded.username)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công' })
  } catch (error: any) {
    console.error('Change password API error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi đổi mật khẩu' }, { status: 500 })
  }
}
