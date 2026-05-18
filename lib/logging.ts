import { useAuth } from "@/contexts/auth-context"

/**
 * Enhanced Logging Utility
 * Provides structured logging for all user actions
 */

export type ActionType = 
  | "Thêm mới" 
  | "Chỉnh sửa" 
  | "Xóa" 
  | "Xem chi tiết" 
  | "Tìm kiếm" 
  | "Lọc dữ liệu"
  | "Xuất báo cáo"
  | "Đăng nhập"
  | "Đăng xuất"

export type ModuleType = 
  | "Quản lý khách hàng"
  | "Quản lý xe"
  | "Đơn thuê"
  | "Báo cáo"
  | "Lịch sử truy cập"
  | "Hệ thống"

export interface LogEntry {
  action: ActionType
  module: ModuleType
  details: string
  timestamp: Date
}

/**
 * Log a user action
 * @param addAccessLog - The addAccessLog function from useAuth
 * @param action - Type of action
 * @param module - Module/section where action occurred
 * @param details - Detailed description of what was done
 */
export function logUserAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  module: ModuleType,
  details: string
) {
  // Add user context if available
  const timestamp = new Date().toLocaleTimeString("vi-VN")
  const fullDetails = `${details} [${timestamp}]`
  
  addAccessLog(action, module, fullDetails)
  
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
  details?: string
) {
  const desc = details 
    ? `${action} khách hàng: ${customerName} - ${details}`
    : `${action} khách hàng: ${customerName}`
  
  logUserAction(addAccessLog, action, "Quản lý khách hàng", desc)
}

/**
 * Log vehicle action
 */
export function logVehicleAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  vehicleName: string,
  licensePlate: string,
  details?: string
) {
  const desc = details
    ? `${action} xe: ${vehicleName} (${licensePlate}) - ${details}`
    : `${action} xe: ${vehicleName} (${licensePlate})`
  
  logUserAction(addAccessLog, action, "Quản lý xe", desc)
}

/**
 * Log rental action
 */
export function logRentalAction(
  addAccessLog: (action: string, module: string, details: string) => void,
  action: ActionType,
  customerName: string,
  vehicleName: string,
  details?: string
) {
  const desc = details
    ? `${action} đơn thuê: ${customerName} - ${vehicleName} - ${details}`
    : `${action} đơn thuê: ${customerName} - ${vehicleName}`
  
  logUserAction(addAccessLog, action, "Đơn thuê", desc)
}
