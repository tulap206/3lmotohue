import { supabase } from './supabase'

/**
 * Central logging utility - logs all user activities to Supabase access_logs table
 */
export const logger = {
  async log(username: string, displayName: string, action: string, module: string, details: string) {
    try {
      const { error } = await supabase.from('access_logs').insert([{
        username,
        displayName,
        action,
        module,
        details,
        timestamp: new Date().toISOString(),
      }])
      if (error) console.error('Logger error:', error.message)
    } catch (e) {
      console.error('Logger exception:', e)
    }
  },

  // Auth
  login: (u: string, d: string) => logger.log(u, d, 'Đăng nhập', 'Hệ thống', `${d} đăng nhập vào hệ thống`),
  logout: (u: string, d: string) => logger.log(u, d, 'Đăng xuất', 'Hệ thống', `${d} đăng xuất khỏi hệ thống`),

  // Vehicles
  addVehicle: (u: string, d: string, name: string, plate: string) =>
    logger.log(u, d, 'Thêm mới', 'Quản lý xe', `Thêm xe: ${name} (${plate})`),
  editVehicle: (u: string, d: string, name: string, plate: string) =>
    logger.log(u, d, 'Chỉnh sửa', 'Quản lý xe', `Sửa xe: ${name} (${plate})`),
  deleteVehicle: (u: string, d: string, name: string, plate: string) =>
    logger.log(u, d, 'Xóa', 'Quản lý xe', `Xóa xe: ${name} (${plate})`),

  // Customers
  addCustomer: (u: string, d: string, name: string, phone: string) =>
    logger.log(u, d, 'Thêm mới', 'Quản lý khách hàng', `Thêm khách: ${name} (${phone})`),
  editCustomer: (u: string, d: string, name: string) =>
    logger.log(u, d, 'Chỉnh sửa', 'Quản lý khách hàng', `Sửa khách: ${name}`),
  deleteCustomer: (u: string, d: string, name: string) =>
    logger.log(u, d, 'Xóa', 'Quản lý khách hàng', `Xóa khách: ${name}`),

  // Rentals
  addRental: (u: string, d: string, customer: string, vehicle: string) =>
    logger.log(u, d, 'Thêm mới', 'Đơn thuê', `Tạo đơn thuê: ${customer} - ${vehicle}`),
  editRental: (u: string, d: string, customer: string, vehicle: string) =>
    logger.log(u, d, 'Chỉnh sửa', 'Đơn thuê', `Sửa đơn thuê: ${customer} - ${vehicle}`),
  deleteRental: (u: string, d: string, customer: string, vehicle: string) =>
    logger.log(u, d, 'Xóa', 'Đơn thuê', `Xóa đơn thuê: ${customer} - ${vehicle}`),
  returnRental: (u: string, d: string, customer: string, vehicle: string) =>
    logger.log(u, d, 'Trả xe', 'Đơn thuê', `Trả xe: ${customer} - ${vehicle}`),
}
