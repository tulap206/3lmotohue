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
      .select('*')
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

    const body = await request.json()
    const {
      username,
      displayName,
      role,
      password,
      canDelete,
      canBackup,
      canViewAccessHistory,
      canManageUsers,
      canAccessRental,
      canAccessPawnshop,
      canAccessLoan,
      canAccessSales,
      canDeleteRental,
      canDeletePawnshop,
      canDeleteLoan,
      canDeleteSales,
      canBackupRental,
      canBackupPawnshop,
      canBackupLoan,
      canBackupSales,
      canViewHistoryRental,
      canViewHistoryPawnshop,
      canViewHistoryLoan,
      canViewHistorySales,
    } = body

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

    const insertData: any = {
      username,
      displayname: displayName,
      role,
      salt,
      password_hash,
      password: null, // No plain-text password!
      can_delete: !!canDelete,
      can_backup: !!canBackup,
      can_view_access_history: canViewAccessHistory !== undefined ? !!canViewAccessHistory : true,
      can_manage_users: role === 'admin' || !!canManageUsers,
      can_access_rental: role === 'admin' || canAccessRental !== undefined ? !!canAccessRental : true,
      can_access_pawnshop: role === 'admin' || canAccessPawnshop !== undefined ? !!canAccessPawnshop : true,
      can_access_loan: role === 'admin' || canAccessLoan !== undefined ? !!canAccessLoan : true,
      can_access_sales: role === 'admin' || canAccessSales !== undefined ? !!canAccessSales : true,
      can_delete_rental: role === 'admin' || !!canDeleteRental,
      can_delete_pawnshop: role === 'admin' || !!canDeletePawnshop,
      can_delete_loan: role === 'admin' || !!canDeleteLoan,
      can_delete_sales: role === 'admin' || !!canDeleteSales,
      can_backup_rental: role === 'admin' || !!canBackupRental,
      can_backup_pawnshop: role === 'admin' || !!canBackupPawnshop,
      can_backup_loan: role === 'admin' || !!canBackupLoan,
      can_backup_sales: role === 'admin' || !!canBackupSales,
      can_view_history_rental: role === 'admin' || canViewHistoryRental !== undefined ? !!canViewHistoryRental : true,
      can_view_history_pawnshop: role === 'admin' || canViewHistoryPawnshop !== undefined ? !!canViewHistoryPawnshop : true,
      can_view_history_loan: role === 'admin' || canViewHistoryLoan !== undefined ? !!canViewHistoryLoan : true,
      can_view_history_sales: role === 'admin' || canViewHistorySales !== undefined ? !!canViewHistorySales : true,
    }

    const { data: newUser, error } = await supabase
      .from('auth_users')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, user: newUser })
  } catch (error: any) {
    console.error('POST users error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 })
  }
}
