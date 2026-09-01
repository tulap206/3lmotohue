import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifyJWT, signJWT } from "@/lib/auth-jwt"
import { getUserAvatarPublicUrl, USER_AVATAR_BUCKET, userAvatarStoragePath } from "@/lib/user-avatar"
import { getSessionSecret } from "@/lib/session-secret"

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("3l_moto_session")?.value
    if (!token) {
      return NextResponse.json({ error: "Chưa đăng nhập hoặc phiên hết hạn" }, { status: 401 })
    }

    const secret = getSessionSecret()
    if (!secret) {
      return NextResponse.json({ error: "Cấu hình phiên đăng nhập chưa sẵn sàng" }, { status: 500 })
    }

    const decoded = await verifyJWT(token, secret)
    if (!decoded?.id || !decoded?.username) {
      return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("avatar")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vui lòng chọn ảnh đại diện" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Ảnh không được lớn hơn 5MB" }, { status: 400 })
    }

    const path = userAvatarStoragePath(decoded.id)
    const { error: uploadError } = await supabase.storage.from(USER_AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "60",
    })

    if (uploadError) {
      console.error("Avatar upload error:", uploadError)
      return NextResponse.json({ error: "Không tải được ảnh lên máy chủ" }, { status: 500 })
    }

    const version = Date.now()
    await supabase.from("auth_users").update({ updated_at: new Date().toISOString() }).eq("id", decoded.id)

    const avatarUrl = getUserAvatarPublicUrl(decoded.id, version)
    const { exp: _exp, ...sessionUser } = decoded
    const userData = { ...sessionUser, avatarUrl }

    const newToken = await signJWT(
      { ...userData, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      secret
    )

    const response = NextResponse.json({ success: true, user: userData })
    response.cookies.set("3l_moto_session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })
    return response
  } catch (error) {
    console.error("Profile avatar API error:", error)
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật ảnh đại diện" }, { status: 500 })
  }
}
