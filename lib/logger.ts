import { supabase } from './supabase'
import {
  diffVehicle,
  diffRental,
  diffCustomer,
  diffTransaction,
  buildDiffDetailString,
  formatVND,
  formatKM,
} from './audit-diff'

// Development logging - only logs in development mode
const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

const devLog = (level: string, ...args: any[]) => {
  if (isDev) {
    const timestamp = new Date().toLocaleTimeString('vi-VN')
    switch(level) {
      case 'info':
        console.log(`[${timestamp}]`, ...args)
        break
      case 'error':
        console.error(`[${timestamp}]`, ...args)
        break
      case 'warn':
        console.warn(`[${timestamp}]`, ...args)
        break
      case 'debug':
        console.debug(`[${timestamp}]`, ...args)
        break
    }
  }
}

// Get client IP via server route (reads proxy headers)
const getClientIP = async () => {
  try {
    if (typeof window === "undefined") return "Server"
    const res = await fetch("/api/client-ip", { cache: "no-store" })
    if (!res.ok) return "Unknown"
    const data = await res.json()
    return typeof data?.ip === "string" && data.ip ? data.ip : "Unknown"
  } catch {
    return "Unknown"
  }
}

// Get device info from user agent
const getDeviceInfo = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  let device = 'Unknown'

  if (/Mobile|Android|iPhone/.test(ua)) device = 'Mobile'
  else if (/iPad|Tablet/.test(ua)) device = 'Tablet'
  else device = 'Desktop'

  let os = 'Unknown'
  if (/Windows/.test(ua)) os = 'Windows'
  else if (/Mac/.test(ua)) os = 'macOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad/.test(ua)) os = 'iOS'

  let browser = 'Unknown'
  if (/Chrome/.test(ua)) browser = 'Chrome'
  else if (/Safari/.test(ua)) browser = 'Safari'
  else if (/Firefox/.test(ua)) browser = 'Firefox'
  else if (/Edge/.test(ua)) browser = 'Edge'

  return { device, os, browser, userAgent: ua }
}

/**
 * Central logging utility - logs all user activities to Supabase access_logs table
 * Development logs only output in development mode (NODE_ENV=development)
 */
export const logger = {
  // Development-only logging
  info: (...args: any[]) => devLog('info', ...args),
  error: (...args: any[]) => devLog('error', ...args),
  warn: (...args: any[]) => devLog('warn', ...args),
  debug: (...args: any[]) => devLog('debug', ...args),

  async log(username: string, displayName: string, action: string, module: string, details: string) {
    try {
      const ipAddress = await getClientIP()
      const deviceInfo = getDeviceInfo()
      const deviceStr = `${deviceInfo.device} - ${deviceInfo.os} - ${deviceInfo.browser}`
      const detailsWithDevice = `${details} [Thiết bị: ${deviceStr}]`

      const { error } = await supabase.from('access_logs').insert([{
        username,
        displayname: displayName,
        action,
        module,
        details: detailsWithDevice,
        ip_address: ipAddress,
        timestamp: new Date().toISOString(),
      }])
      // Browser posts with the session cookie so /api/telegram can authorize without a public secret.
      if (typeof window !== 'undefined') {
        fetch('/api/telegram', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: `${action} - Phân hệ: ${module}`,
            details: `Người thực hiện: *${displayName}* (${username})\nNội dung: ${details}\nThiết bị: ${deviceStr}`,
          }),
        }).catch((err) => devLog('error', 'Telegram notification error:', err))
      }

      if (error) {
        devLog('error', 'Logger error:', error.message)
        return
      }
      devLog('info', `✅ Logged: ${action} - ${module}`)
    } catch (e) {
      devLog('error', 'Logger exception:', e)
    }
  },

  // Auth
  login: (u: string, d: string) => logger.log(u, d, 'Đăng nhập', 'Hệ thống', `${d} đăng nhập vào hệ thống`),
  logout: (u: string, d: string) => logger.log(u, d, 'Đăng xuất', 'Hệ thống', `${d} đăng xuất khỏi hệ thống`),

  // Vehicles
  addVehicle: (u: string, d: string, name: string, plate: string, pricePerDay?: number) => {
    const priceStr = pricePerDay ? ` (Giá thuê: ${formatVND(pricePerDay)}/ngày)` : ''
    return logger.log(u, d, 'Thêm mới', 'Quản lý xe', `Thêm xe: ${name} (${plate})${priceStr}`)
  },
  editVehicle: (u: string, d: string, name: string, plate: string) =>
    logger.log(u, d, 'Chỉnh sửa', 'Quản lý xe', `Sửa xe: ${name} (${plate})`),
  editVehicleWithDiff: (u: string, d: string, oldVehicle: any, newVehicle: any) => {
    const changes = diffVehicle(oldVehicle, newVehicle)
    const base = `Sửa xe: ${newVehicle.name || oldVehicle?.name} (${newVehicle.licensePlate || oldVehicle?.licensePlate})`
    const detail = buildDiffDetailString(base, changes)
    return logger.log(u, d, 'Chỉnh sửa', 'Quản lý xe', detail)
  },
  deleteVehicle: (u: string, d: string, name: string, plate: string) =>
    logger.log(u, d, 'Xóa', 'Quản lý xe', `Xóa xe: ${name} (${plate})`),

  // Customers
  addCustomer: (u: string, d: string, name: string, phone: string) =>
    logger.log(u, d, 'Thêm mới', 'Quản lý khách hàng', `Thêm khách hàng: ${name} (${phone})`),
  editCustomer: (u: string, d: string, name: string) =>
    logger.log(u, d, 'Chỉnh sửa', 'Quản lý khách hàng', `Sửa khách hàng: ${name}`),
  editCustomerWithDiff: (u: string, d: string, oldCustomer: any, newCustomer: any) => {
    const changes = diffCustomer(oldCustomer, newCustomer)
    const base = `Sửa khách hàng: ${newCustomer.name || oldCustomer?.name} (${newCustomer.phone || oldCustomer?.phone || '—'})`
    const detail = buildDiffDetailString(base, changes)
    return logger.log(u, d, 'Chỉnh sửa', 'Quản lý khách hàng', detail)
  },
  deleteCustomer: (u: string, d: string, name: string) =>
    logger.log(u, d, 'Xóa', 'Quản lý khách hàng', `Xóa khách hàng: ${name}`),

  // Rentals
  addRental: (u: string, d: string, customer: string, vehicle: string, extraInfo?: string) => {
    const extra = extraInfo ? ` [${extraInfo}]` : ''
    return logger.log(u, d, 'Thêm mới', 'Đơn thuê', `Tạo đơn thuê: ${customer} - ${vehicle}${extra}`)
  },
  editRental: (u: string, d: string, customer: string, vehicle: string) =>
    logger.log(u, d, 'Chỉnh sửa', 'Đơn thuê', `Sửa đơn thuê: ${customer} - ${vehicle}`),
  editRentalWithDiff: (u: string, d: string, oldRental: any, newRental: any) => {
    const changes = diffRental(oldRental, newRental)
    const code = newRental.rentalCode || oldRental?.rentalCode || ""
    const base = `Sửa đơn thuê${code ? ' ' + code : ''}: ${newRental.customerName || oldRental?.customerName} - ${newRental.vehicleName || oldRental?.vehicleName}`
    const detail = buildDiffDetailString(base, changes)
    return logger.log(u, d, 'Chỉnh sửa', 'Đơn thuê', detail)
  },
  deleteRental: (u: string, d: string, customer: string, vehicle: string, code?: string) =>
    logger.log(u, d, 'Xóa', 'Đơn thuê', `Xóa đơn thuê${code ? ' ' + code : ''}: ${customer} - ${vehicle}`),
  returnRental: (u: string, d: string, customer: string, vehicle: string, extraDetail?: string) => {
    const extra = extraDetail ? ` [${extraDetail}]` : ''
    return logger.log(u, d, 'Trả xe', 'Đơn thuê', `Trả xe: ${customer} - ${vehicle}${extra}`)
  },

  // Maintenance
  maintainVehicle: (u: string, d: string, vehicleName: string, plate: string, km: number, notes?: string) => {
    const noteStr = notes ? ` - Ghi chú: ${notes}` : ''
    return logger.log(
      u,
      d,
      'Bảo trì',
      'Bảo trì xe',
      `Bảo dưỡng xe: ${vehicleName} (${plate}) tại mốc ${formatKM(km)}${noteStr}`
    )
  },

  // Transactions (Thu/Chi)
  addTransaction: (u: string, d: string, type: 'income' | 'expense', description: string, amount: number) => {
    const typeLabel = type === 'income' ? 'khoản thu' : 'khoản chi'
    return logger.log(u, d, 'Thêm mới', 'Thu/Chi', `Thêm ${typeLabel}: "${description}" - Số tiền: ${formatVND(amount)}`)
  },
  editTransactionWithDiff: (u: string, d: string, oldTx: any, newTx: any) => {
    const changes = diffTransaction(oldTx, newTx)
    const base = `Sửa giao dịch "${oldTx.description || newTx.description}"`
    const detail = buildDiffDetailString(base, changes)
    return logger.log(u, d, 'Chỉnh sửa', 'Thu/Chi', detail)
  },
  deleteTransaction: (u: string, d: string, type: 'income' | 'expense', description: string, amount: number) => {
    const typeLabel = type === 'income' ? 'khoản thu' : 'khoản chi'
    return logger.log(u, d, 'Xóa', 'Thu/Chi', `Xóa ${typeLabel}: "${description}" - Số tiền: ${formatVND(amount)}`)
  },
}
