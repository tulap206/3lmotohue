import { supabase } from "@/lib/supabase"

export interface BookingLockStatus {
  isLocked: boolean
  reason?: string
  updatedAt?: string
  updatedBy?: string
}

export async function fetchBookingLockStatus(): Promise<BookingLockStatus> {
  try {
    const { data, error } = await supabase
      .from("access_logs")
      .select("*")
      .eq("module", "booking_lock")
      .order("timestamp", { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      return { isLocked: false }
    }

    const latest = data[0]
    return {
      isLocked: latest.action === "LOCK_BOOKING",
      reason: latest.details || "",
      updatedAt: latest.timestamp,
      updatedBy: latest.userId || "",
    }
  } catch (err) {
    console.error("Error fetching booking lock status:", err)
    return { isLocked: false }
  }
}

export async function setBookingLockStatus(isLocked: boolean, reason?: string, username?: string): Promise<BookingLockStatus> {
  const timestamp = new Date().toISOString()
  const details = reason?.trim() || (isLocked ? "Tạm khóa tính năng đặt xe từ Landing Page (nghỉ lễ / hết xe)" : "Đã mở khóa đặt xe trực tuyến")
  const userId = username || "admin"

  const { error } = await supabase.from("access_logs").insert([
    {
      action: isLocked ? "LOCK_BOOKING" : "UNLOCK_BOOKING",
      module: "booking_lock",
      details,
      userId,
      timestamp,
    },
  ])

  if (error) {
    console.error("Error setting booking lock status:", error)
    throw error
  }

  return {
    isLocked,
    reason: details,
    updatedAt: timestamp,
    updatedBy: userId,
  }
}
