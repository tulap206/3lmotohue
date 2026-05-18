import { supabase } from './supabase'

export interface ActivityLog {
  username: string
  displayName: string
  action: string
  module: string
  details: string
}

/**
 * Log user activity to access_logs table
 */
export const logActivity = async (log: ActivityLog) => {
  try {
    const { error } = await supabase
      .from('access_logs')
      .insert([
        {
          username: log.username,
          displayName: log.displayName,
          action: log.action,
          module: log.module,
          details: log.details,
          timestamp: new Date().toISOString(),
        },
      ])

    if (error) {
      console.error('Error logging activity:', error)
    }
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

/**
 * Log login activity
 */
export const logLogin = async (username: string, displayName: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Đăng nhập',
    module: 'Hệ thống',
    details: `${displayName} đăng nhập vào hệ thống`,
  })
}

/**
 * Log logout activity
 */
export const logLogout = async (username: string, displayName: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Đăng xuất',
    module: 'Hệ thống',
    details: `${displayName} đăng xuất khỏi hệ thống`,
  })
}

/**
 * Log vehicle operations
 */
export const logVehicleAdd = async (username: string, displayName: string, vehicleName: string, licensePlate: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Thêm mới',
    module: 'Quản lý xe',
    details: `Thêm xe: ${vehicleName} (${licensePlate})`,
  })
}

export const logVehicleEdit = async (username: string, displayName: string, vehicleName: string, licensePlate: string, changes: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Chỉnh sửa',
    module: 'Quản lý xe',
    details: `Sửa xe: ${vehicleName} (${licensePlate}) - ${changes}`,
  })
}

export const logVehicleDelete = async (username: string, displayName: string, vehicleName: string, licensePlate: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Xóa',
    module: 'Quản lý xe',
    details: `Xóa xe: ${vehicleName} (${licensePlate})`,
  })
}

/**
 * Log customer operations
 */
export const logCustomerAdd = async (username: string, displayName: string, customerName: string, phone: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Thêm mới',
    module: 'Quản lý khách hàng',
    details: `Thêm khách hàng: ${customerName} (${phone})`,
  })
}

export const logCustomerEdit = async (username: string, displayName: string, customerName: string, changes: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Chỉnh sửa',
    module: 'Quản lý khách hàng',
    details: `Sửa khách hàng: ${customerName} - ${changes}`,
  })
}

export const logCustomerDelete = async (username: string, displayName: string, customerName: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Xóa',
    module: 'Quản lý khách hàng',
    details: `Xóa khách hàng: ${customerName}`,
  })
}

/**
 * Log rental operations
 */
export const logRentalAdd = async (username: string, displayName: string, customerName: string, vehicleName: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Thêm mới',
    module: 'Đơn thuê',
    details: `Thêm đơn thuê: ${customerName} - ${vehicleName}`,
  })
}

export const logRentalEdit = async (username: string, displayName: string, rentalId: string, changes: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Chỉnh sửa',
    module: 'Đơn thuê',
    details: `Sửa đơn thuê #${rentalId} - ${changes}`,
  })
}

export const logRentalDelete = async (username: string, displayName: string, rentalId: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Xóa',
    module: 'Đơn thuê',
    details: `Xóa đơn thuê #${rentalId}`,
  })
}

/**
 * Log view operations
 */
export const logView = async (username: string, displayName: string, module: string) => {
  await logActivity({
    username,
    displayName,
    action: 'Xem',
    module: module,
    details: `Xem ${module.toLowerCase()}`,
  })
}
