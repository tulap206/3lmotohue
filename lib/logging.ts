import { useAuth } from "@/contexts/auth-context"

/**
 * Enhanced Logging Utility
 * Provides structured logging for all user actions
 */

export type ActionType = 
  | "Thêm mới" 
  | "Chỉnh sửa" 
  | "Xóa" 
  | "Bảo trì"
  | "Trả xe"
  | "Xem chi tiết" 
  | "Tìm kiếm" 
  | "Lọc dữ liệu"
  | "Xuất báo cáo"
  | "Sao lưu dữ liệu"
  | "Khôi phục dữ liệu"
  | "Đăng nhập"
  | "Đăng xuất"

export type ModuleType = 
  | "Quản lý xe"
  | "Đơn thuê"
  | "Quản lý khách hàng"
  | "Bảo trì xe"
  | "Thu / Chi"
  | "Báo cáo"
  | "Quản lý tài khoản"
  | "Cài đặt & Sao lưu"
  | "Hệ thống & Đăng nhập"

export interface LogEntry {
  action: ActionType
  module: ModuleType
  details: string
  timestamp: Date
}

/**
 * Log a user action to Supabase
 */
async function logToSupabase(username: string, displayName: string, action: string, module: string, details: string) {
  try {
    const { supabase } = await import("@/lib/supabase")
    await supabase.from("access_logs").insert([
      {
        username,
        displayname: displayName,
        action,
        module,
        details,
        timestamp: new Date().toISOString(),
      },
    ])
  } catch (error) {
    console.error("Failed to log to Supabase:", error)
  }
}

/**
 * Log a user action
 * @param addAccessLog - The addAccessLog function from useAuth
 * @param action - Type of action
 * @param module - Module/section where action occurred
 * @param details - Detailed description of what was done
 * @param user - Current user object (optional, for Supabase logging)
 */
export function logUserAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  module: ModuleType,
  details: string,
  user?: { username: string; displayName: string }
) {
  // Add user context if available
  const timestamp = new Date().toLocaleTimeString("vi-VN")
  const fullDetails = `${details} [${timestamp}]`
  
  addAccessLog(action, module, fullDetails)
  
  // Also log to Supabase if user provided
  if (user) {
    logToSupabase(user.username, user.displayName, action, module, fullDetails)
  }
  
  // Also log to console for debugging
  console.log(`[${action}] ${module}: ${details}`)
}

/**
 * Log customer action
 */
export function logCustomerAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  customerName: string,
  details?: string,
  user?: { username: string; displayName: string }
) {
  const desc = details 
    ? `${action} khách hàng: ${customerName} - ${details}`
    : `${action} khách hàng: ${customerName}`
  
  logUserAction(addAccessLog, action, "Quản lý khách hàng", desc, user)
}

/**
 * Log vehicle action
 */
export function logVehicleAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  vehicleName: string,
  licensePlate: string,
  details?: string,
  user?: { username: string; displayName: string }
) {
  const desc = details
    ? `${action} xe: ${vehicleName} (${licensePlate}) - ${details}`
    : `${action} xe: ${vehicleName} (${licensePlate})`
  
  logUserAction(addAccessLog, action, "Quản lý xe", desc, user)
}

/**
 * Log rental action
 */
export function logRentalAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  customerName: string,
  vehicleName: string,
  details?: string,
  user?: { username: string; displayName: string }
) {
  const desc = details
    ? `${action} đơn thuê: ${customerName} - ${vehicleName} - ${details}`
    : `${action} đơn thuê: ${customerName} - ${vehicleName}`
  
  logUserAction(addAccessLog, action, "Đơn thuê", desc, user)
}
