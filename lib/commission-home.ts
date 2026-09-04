/**
 * Hoa hồng Home (homestay giới thiệu thuê xe).
 * Công thức đơn: commissionHome (VND/ngày) × totalDays
 * Doanh thu đơn hoàn thành đã net khoản này trong field `revenue`.
 */

export type CommissionOrderDetail = {
  id: string
  rentalCode?: string
  customerName: string
  vehicleName: string
  licensePlate?: string
  startDate: string
  endDate: string
  totalDays: number
  commissionHome: number
  totalCommission: number
  status: string
}

export type CommissionOrderLike = {
  id?: string
  rentalCode?: string
  rental_code?: string
  customerName?: string
  customer_name?: string
  vehicleName?: string
  vehicle_name?: string
  licensePlate?: string
  license_plate?: string
  startDate?: string
  start_date?: string
  endDate?: string
  end_date?: string
  commissionHome?: number | null
  commission_home?: number | null
  homeName?: string | null
  home_name?: string | null
  totalDays?: number | null
  total_days?: number | null
  status?: string | null
}

export type CommissionHomeRow = {
  name: string
  count: number
  totalDays: number
  avgPerDay: number
  total: number
  orders: CommissionOrderDetail[]
}

function parseVietnamDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const parts = dateStr.split("/")
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
  }
  return new Date(dateStr)
}

function extractOrderDays(order: CommissionOrderLike): number {
  const directDays = Number(order.totalDays ?? (order as any).total_days)
  if (directDays && directDays > 0) return directDays

  const sStr = order.startDate || (order as any).start_date
  const eStr = order.endDate || (order as any).end_date
  if (sStr && eStr) {
    const sDate = parseVietnamDate(sStr)
    const eDate = parseVietnamDate(eStr)
    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      const diffMs = eDate.getTime() - sDate.getTime()
      const calcDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      if (calcDays > 0) return calcDays
    }
  }
  return 1
}

export function calcOrderCommission(order: CommissionOrderLike): number {
  const rate = Number(order.commissionHome ?? (order as any).commission_home) || 0
  if (rate <= 0) return 0
  const days = extractOrderDays(order)
  return rate * days
}

export type CommissionReportOptions = {
  /** 0–11; lọc theo tháng kết thúc đơn */
  month?: number
  year?: number
  /** Chỉ đơn đã hoàn thành (đã chốt chi HH cùng lúc chốt DT) */
  completedOnly?: boolean
}

/** Nhóm hoa hồng theo tên Home */
export function buildCommissionHomeReport(
  orders: CommissionOrderLike[],
  opts: CommissionReportOptions = {}
): CommissionHomeRow[] {
  const map: Record<
    string,
    {
      count: number
      totalDays: number
      total: number
      orders: CommissionOrderDetail[]
    }
  > = {}
  const completedOnly = opts.completedOnly !== false

  for (const order of orders) {
    const rawHomeName = (order.homeName || (order as any).home_name || "").toString().trim()
    if (!rawHomeName || rawHomeName === "0" || rawHomeName === "-" || rawHomeName.toLowerCase() === "null") continue
    
    const rate = Number(order.commissionHome ?? (order as any).commission_home) || 0
    if (rate <= 0) continue
    if (order.status === "cancelled") continue
    if (completedOnly && order.status !== "completed") continue

    const endDateStr = order.endDate || (order as any).end_date || ""
    if (opts.month != null && opts.year != null) {
      const end = parseVietnamDate(endDateStr)
      if (isNaN(end.getTime())) continue
      if (end.getMonth() !== opts.month || end.getFullYear() !== opts.year) continue
    }

    const key = rawHomeName
    const days = extractOrderDays(order)
    const total = calcOrderCommission(order)
    if (total <= 0) continue

    if (!map[key]) {
      map[key] = { count: 0, totalDays: 0, total: 0, orders: [] }
    }
    map[key].count += 1
    map[key].totalDays += days
    map[key].total += total
    map[key].orders.push({
      id: order.id || Math.random().toString(),
      rentalCode: order.rentalCode || (order as any).rental_code || "",
      customerName: order.customerName || (order as any).customer_name || "Khách",
      vehicleName: order.vehicleName || (order as any).vehicle_name || "Xe",
      licensePlate: order.licensePlate || (order as any).license_plate || "",
      startDate: order.startDate || (order as any).start_date || "",
      endDate: endDateStr,
      totalDays: days,
      commissionHome: rate,
      totalCommission: total,
      status: order.status || "",
    })
  }

  return Object.entries(map)
    .map(([name, val]) => ({
      name,
      count: val.count,
      totalDays: val.totalDays,
      avgPerDay: val.totalDays > 0 ? Math.round(val.total / val.totalDays) : 0,
      total: val.total,
      orders: val.orders,
    }))
    .sort((a, b) => b.total - a.total)
}

export function sumCommissionRows(rows: CommissionHomeRow[]): number {
  return rows.reduce((sum, row) => sum + row.total, 0)
}

export function sumCommissionDays(rows: CommissionHomeRow[]): number {
  return rows.reduce((sum, row) => sum + row.totalDays, 0)
}

export function sumCommissionOrders(rows: CommissionHomeRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0)
}
