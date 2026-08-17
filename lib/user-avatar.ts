import { supabase } from "@/lib/supabase"

export const USER_AVATAR_BUCKET = "customer-documents"
export const USER_AVATAR_FOLDER = "avatars"

export function userAvatarStoragePath(userId: string): string {
  return `${USER_AVATAR_FOLDER}/${userId}`
}

export function getUserAvatarPublicUrl(userId: string, version?: string | number | null): string {
  const { data } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(userAvatarStoragePath(userId))
  const v = version == null || version === "" ? "" : String(version)
  return v ? `${data.publicUrl}?v=${encodeURIComponent(v)}` : data.publicUrl
}
