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
    const { displayName, role, canDelete, password } = await request.json()

    if (!displayName || !role) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }

    const updateData: any = {
      displayname: displayName,
      role,
      can_delete: !!canDelete,
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
