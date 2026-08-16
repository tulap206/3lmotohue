import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/auth-jwt'
import { hashPassword, generateSalt } from '@/lib/auth-crypto'

// Helper to verify admin role
async function verifyAdmin(request: NextRequest) {
  const token = request.cookies.get('3l_moto_session')?.value
  if (!token) return null

  const secret = process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || 'fallback-secret-key-3lmoto'
  const decoded = await verifyJWT(token, secret)
  
  if (!decoded || decoded.role !== 'admin') return null
  return decoded
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin(request)
    if (!adminUser) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const { data: users, error } = await supabase
      .from('auth_users')
      .select('id, username, displayname, role, can_delete, can_backup, can_view_access_history, created_at')
      .order('username')

    if (error) throw error

    return NextResponse.json({ success: true, users })
  } catch (error: any) {
    console.error('GET users error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin(request)
    if (!adminUser) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const { username, displayName, role, canDelete, canBackup, canViewAccessHistory, password } = await request.json()

    if (!username || !displayName || !role || !password) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải từ 6 ký tự trở lên' }, { status: 400 })
    }

    // Check duplicate username
    const { data: duplicate } = await supabase
      .from('auth_users')
      .select('username')
      .eq('username', username)
      .single()

    if (duplicate) {
      return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 400 })
    }

    // Generate hash
    const salt = generateSalt()
    const password_hash = hashPassword(password, salt)

    const { data: newUser, error } = await supabase
      .from('auth_users')
      .insert([{
        username,
        displayname: displayName,
        role,
        can_delete: !!canDelete,
        can_backup: !!canBackup,
        can_view_access_history: !!canViewAccessHistory,
        salt,
        password_hash,
        password: null // No plain-text password!
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, user: newUser })
  } catch (error: any) {
    console.error('POST users error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 })
  }
}
