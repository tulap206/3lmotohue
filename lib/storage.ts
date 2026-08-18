import { supabase } from "./supabase"

/**
 * Upload image to Supabase Storage
 * @param file - Image file to upload
 * @param bucket - Storage bucket name
 * @param folder - Folder path (e.g., "vehicles/images")
 * @returns URL of uploaded image or null if failed
 */
export async function uploadImage(
  file: File,
  bucket: string,
  folder: string
): Promise<string | null> {
  try {
    const safeName = (file.name || "image.jpg").replace(/[^\w.\-]+/g, "_")
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${safeName}`
    const filePath = `${folder}/${fileName}`

    console.log(`📸 Uploading to ${bucket}/${filePath}`)

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      })

    if (error) {
      console.error("Upload error:", error)
      throw new Error(error.message || "Không tải được ảnh lên máy chủ")
    }

    // Get public URL
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    console.log("✅ Image uploaded:", data.publicUrl)
    return data.publicUrl
  } catch (error) {
    console.error("Upload exception:", error)
    throw error instanceof Error ? error : new Error("Không tải được ảnh lên máy chủ")
  }
}

/**
 * Upload multiple images
 */
export async function uploadMultipleImages(
  files: File[],
  bucket: string,
  folder: string
): Promise<string[]> {
  const urls: string[] = []

  for (const file of files) {
    const url = await uploadImage(file, bucket, folder)
    if (url) urls.push(url)
  }

  if (files.length > 0 && urls.length === 0) {
    throw new Error("Không tải được ảnh lên máy chủ")
  }

  return urls
}
