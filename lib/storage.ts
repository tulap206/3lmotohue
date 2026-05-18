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
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`
    const filePath = `${folder}/${fileName}`

    console.log(`📸 Uploading to ${bucket}/${filePath}`)

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("Upload error:", error)
      return null
    }

    // Get public URL
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    console.log("✅ Image uploaded:", data.publicUrl)
    return data.publicUrl
  } catch (error) {
    console.error("Upload exception:", error)
    return null
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

  return urls
}
