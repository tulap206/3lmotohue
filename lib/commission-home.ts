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
  customerName?: string
  vehicleName?: string
  licensePlate?: string
  startDate?: string
  endDate?: string
  commissionHome?: number | null
  homeName?: string | null
  totalDays?: number | null
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

export function calcOrderCommission(order: CommissionOrderLike): number {
  const rate = Number(order.commissionHome) || 0
  const days = Number(order.totalDays) || 0
  if (rate <= 0 || days <= 0) return 0
  return rate * days
}

function parseVietnamDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const parts = dateStr.split("/")
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
  }
  return new Date(dateStr)
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
    if (!order.homeName?.trim()) continue
    if (!order.commissionHome || order.commissionHome <= 0) continue
    if (order.status === "cancelled") continue
    if (completedOnly && order.status !== "completed") continue

    if (opts.month != null && opts.year != null) {
      const end = parseVietnamDate(order.endDate || "")
      if (isNaN(end.getTime())) continue
      if (end.getMonth() !== opts.month || end.getFullYear() !== opts.year) continue
    }

    const key = order.homeName.trim()
    const days = Number(order.totalDays) || 0
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
      rentalCode: order.rentalCode || "",
      customerName: order.customerName || "Khách",
      vehicleName: order.vehicleName || "Xe",
      licensePlate: order.licensePlate || "",
      startDate: order.startDate || "",
      endDate: order.endDate || "",
      totalDays: days,
      commissionHome: Number(order.commissionHome) || 0,
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
