import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/auth-jwt'
import { hashPassword, generateSalt } from '@/lib/auth-crypto'
import { getSessionSecret } from '@/lib/session-secret'

// Helper to verify admin role
async function verifyAdmin(request: NextRequest) {
  const token = request.cookies.get('3l_moto_session')?.value
  if (!token) return null

  const secret = getSessionSecret()
  if (!secret) return null
  const decoded = await verifyJWT(token, secret)
  
  if (!decoded || decoded.role !== 'admin') return null
  return decoded
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await verifyAdmin(request)
    if (!adminUser) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const params = await props.params
    const { id } = params
    const body = await request.json()
    const {
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

    if (!displayName || !role) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }

    const updateData: any = {
      displayname: displayName,
      role,
      can_delete: !!canDelete,
      can_backup: !!canBackup,
      can_view_access_history: canViewAccessHistory !== undefined ? !!canViewAccessHistory : true,
      can_manage_users: role === 'admin' || !!canManageUsers,
      can_access_rental: role === 'admin' || (canAccessRental !== undefined ? !!canAccessRental : true),
      can_access_pawnshop: role === 'admin' || (canAccessPawnshop !== undefined ? !!canAccessPawnshop : true),
      can_access_loan: role === 'admin' || (canAccessLoan !== undefined ? !!canAccessLoan : true),
      can_access_sales: role === 'admin' || (canAccessSales !== undefined ? !!canAccessSales : true),
      can_delete_rental: role === 'admin' || !!canDeleteRental,
      can_delete_pawnshop: role === 'admin' || !!canDeletePawnshop,
      can_delete_loan: role === 'admin' || !!canDeleteLoan,
      can_delete_sales: role === 'admin' || !!canDeleteSales,
      can_backup_rental: role === 'admin' || !!canBackupRental,
      can_backup_pawnshop: role === 'admin' || !!canBackupPawnshop,
      can_backup_loan: role === 'admin' || !!canBackupLoan,
      can_backup_sales: role === 'admin' || !!canBackupSales,
      can_view_history_rental: role === 'admin' || (canViewHistoryRental !== undefined ? !!canViewHistoryRental : true),
      can_view_history_pawnshop: role === 'admin' || (canViewHistoryPawnshop !== undefined ? !!canViewHistoryPawnshop : true),
      can_view_history_loan: role === 'admin' || (canViewHistoryLoan !== undefined ? !!canViewHistoryLoan : true),
      can_view_history_sales: role === 'admin' || (canViewHistorySales !== undefined ? !!canViewHistorySales : true),
    }

    // Hash password if updating
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Mật khẩu phải từ 6 ký tự trở lên' }, { status: 400 })
      }
      const salt = generateSalt()
      updateData.salt = salt
      updateData.password_hash = hashPassword(password, salt)
      updateData.password = null // Ensure plain-text password is cleared
    }

    const { data: updatedUser, error } = await supabase
      .from('auth_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error: any) {
    console.error('PUT user error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await verifyAdmin(request)
    if (!adminUser) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const params = await props.params
    const { id } = params

    const { error } = await supabase
      .from('auth_users')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE user error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 })
  }
}
