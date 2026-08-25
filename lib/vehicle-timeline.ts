import { Vehicle, Rental } from "@/lib/supabase"
import { parseDisplayDate, formatDisplayDate } from "@/lib/format-date"

export interface VehicleTimelineStatus {
  vehicleId: string
  isAvailable: boolean
  statusCategory: "optimal" | "conditional" | "unavailable"
  badgeLabel: string
  badgeTone: "emerald" | "amber" | "rose" | "slate"
  reason?: string
  conflictingRentals: Rental[]
  nextUpcomingRental?: Rental | null
  daysUntilNextRental?: number | null
  currentActiveRental?: Rental | null
}

/**
 * Chuẩn hóa ngày từ string (hỗ trợ cả 'DD/MM/YYYY', 'YYYY-MM-DD' và ISO) sang Date object
 */
export function normalizeDate(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null
  if (dateInput instanceof Date) {
    const d = new Date(dateInput)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const str = String(dateInput).trim()
  if (!str) return null

  // Định dạng DD/MM/YYYY
  if (str.includes("/")) {
    const parts = str.split("/")
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const year = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      d.setHours(0, 0, 0, 0)
      return isNaN(d.getTime()) ? null : d
    }
  }

  // Định dạng YYYY-MM-DD
  if (str.includes("-")) {
    const parts = str.split("T")[0].split("-")
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      d.setHours(0, 0, 0, 0)
      return isNaN(d.getTime()) ? null : d
    }
  }

  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0)
    return parsed
  }

  return null
}

/**
 * Kiểm tra 2 khoảng thời gian [startA, endA] và [startB, endB] có bị chồng lấn không
 */
export function isRangeOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  // Khoảng A nằm hoàn toàn trước B hoặc hoàn toàn sau B -> không chồng lấn
  return !(endA < startB || startA > endB)
}

/**
 * Phân tích chi tiết tính khả dụng của 1 chiếc xe cho khoảng thời gian [startDateStr -> endDateStr]
 */
export function checkVehicleTimelineAvailability(
  vehicle: Vehicle,
  startDateStr: string,
  endDateStr: string,
  allRentals: Rental[],
  excludeRentalId?: string
): VehicleTimelineStatus {
  const reqStart = normalizeDate(startDateStr)
  const reqEnd = normalizeDate(endDateStr)

  // Nếu xe đang bảo trì
  if (vehicle.status === "maintenance") {
    return {
      vehicleId: vehicle.id,
      isAvailable: false,
      statusCategory: "unavailable",
      badgeLabel: "Đang bảo dưỡng",
      badgeTone: "rose",
      reason: "Xe đang trong xưởng bảo dưỡng / sửa chữa",
      conflictingRentals: [],
    }
  }

  // Nếu chưa nhập đủ ngày
  if (!reqStart || !reqEnd) {
    return {
      vehicleId: vehicle.id,
      isAvailable: true,
      statusCategory: "optimal",
      badgeLabel: "Cần chọn ngày",
      badgeTone: "slate",
      conflictingRentals: [],
    }
  }

  if (reqStart > reqEnd) {
    return {
      vehicleId: vehicle.id,
      isAvailable: false,
      statusCategory: "unavailable",
      badgeLabel: "Ngày không hợp lệ",
      badgeTone: "rose",
      reason: "Ngày nhận xe phải trước hoặc trùng ngày trả xe",
      conflictingRentals: [],
    }
  }

  // Lọc các đơn thuê liên quan đến chiếc xe này (bỏ qua đơn đã hủy / đã hoàn thành)
  const vehicleRentals = allRentals.filter((r) => {
    if (r.id === excludeRentalId) return false
    if (r.status === "cancelled" || r.status === "completed") return false
    return r.vehicleId === vehicle.id
  })

  // Tìm các đơn bị trùng lặp thời gian
  const conflictingRentals: Rental[] = []
  let nextUpcomingRental: Rental | null = null
  let minDaysUntilNext = Infinity
  let currentActiveRental: Rental | null = null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const rental of vehicleRentals) {
    const rStart = normalizeDate(rental.startDate)
    const rEnd = normalizeDate(rental.endDate)

    if (!rStart || !rEnd) continue

    // Kiểm tra trùng lặp
    if (isRangeOverlapping(reqStart, reqEnd, rStart, rEnd)) {
      conflictingRentals.push(rental)
    }

    // Kiểm tra đơn đặt trong tương lai sau ngày trả dự kiến
    if (rStart > reqEnd) {
      const diffDays = Math.round((rStart.getTime() - reqEnd.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < minDaysUntilNext) {
        minDaysUntilNext = diffDays
        nextUpcomingRental = rental
      }
    }

    // Kiểm tra đơn đang thuê hiện tại (nếu có)
    if (rental.status === "active" && isRangeOverlapping(today, today, rStart, rEnd)) {
      currentActiveRental = rental
    }
  }

  // 1. Trường hợp: Bị trùng lịch
  if (conflictingRentals.length > 0) {
    const conflict = conflictingRentals[0]
    const conflictCustomer = conflict.customerName || "Khách khác"
    return {
      vehicleId: vehicle.id,
      isAvailable: false,
      statusCategory: "unavailable",
      badgeLabel: "Trùng lịch thuê",
      badgeTone: "rose",
      reason: `Đã có đơn [${conflictCustomer}] từ ${conflict.startDate} đến ${conflict.endDate}`,
      conflictingRentals,
      nextUpcomingRental,
      currentActiveRental,
    }
  }

  // 2. Trường hợp: Rảnh trong khoảng này, nhưng CÓ ĐƠN ĐẶT TRƯỚC ngay sau đó (Rảnh có điều kiện)
  if (nextUpcomingRental && minDaysUntilNext <= 3) {
    const nextStartStr = nextUpcomingRental.startDate
    return {
      vehicleId: vehicle.id,
      isAvailable: true,
      statusCategory: "conditional",
      badgeLabel: `Trống đến ${nextStartStr}`,
      badgeTone: "amber",
      reason: `Khả dụng! Nhưng sau đó có đơn [${nextUpcomingRental.customerName}] nhận từ ${nextStartStr}`,
      conflictingRentals: [],
      nextUpcomingRental,
      daysUntilNextRental: minDaysUntilNext,
      currentActiveRental,
    }
  }

  // 3. Trường hợp: Rảnh hoàn toàn (Tối ưu nhất)
  return {
    vehicleId: vehicle.id,
    isAvailable: true,
    statusCategory: "optimal",
    badgeLabel: "Rảnh suốt kỳ",
    badgeTone: "emerald",
    reason: "Xe hoàn toàn trống lịch trong và sau khoảng thời gian này",
    conflictingRentals: [],
    nextUpcomingRental,
    currentActiveRental,
  }
}

export interface ClassifiedVehiclesResult {
  optimal: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }>
  conditional: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }>
  unavailable: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }>
  allEvaluated: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }>
}

/**
 * Phân loại toàn bộ đội xe cho khoảng ngày [startDate -> endDate]
 */
export function classifyVehiclesForTimeline(
  vehicles: Vehicle[],
  startDateStr: string,
  endDateStr: string,
  allRentals: Rental[],
  excludeRentalId?: string
): ClassifiedVehiclesResult {
  const optimal: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }> = []
  const conditional: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }> = []
  const unavailable: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }> = []
  const allEvaluated: Array<{ vehicle: Vehicle; status: VehicleTimelineStatus }> = []

  for (const vehicle of vehicles) {
    const status = checkVehicleTimelineAvailability(
      vehicle,
      startDateStr,
      endDateStr,
      allRentals,
      excludeRentalId
    )

    const item = { vehicle, status }
    allEvaluated.push(item)

    if (!status.isAvailable || status.statusCategory === "unavailable") {
      unavailable.push(item)
    } else if (status.statusCategory === "conditional") {
      conditional.push(item)
    } else {
      optimal.push(item)
    }
  }

  // Sắp xếp: Ưu tiên xe rảnh hoàn toàn trước, xe có điều kiện sau
  return { optimal, conditional, unavailable, allEvaluated }
}

/**
 * Dữ liệu phục vụ vẽ Sơ đồ Gantt / Lịch điều phối xe
 */
export interface TimelineDay {
  date: Date
  dateStr: string // DD/MM
  dayOfWeek: string // T2, T3, T4...
  isToday: boolean
  isWeekend: boolean
}

export interface VehicleTimelineRow {
  vehicle: Vehicle
  slots: Array<{
    day: TimelineDay
    rental?: Rental | null
    isStart?: boolean
    isEnd?: boolean
    isMiddle?: boolean
    isMaintenance?: boolean
    isAvailable?: boolean
  }>
}

export function generateTimelineGrid(
  vehicles: Vehicle[],
  rentals: Rental[],
  startDate: Date,
  daysCount = 14
): { days: TimelineDay[]; rows: VehicleTimelineRow[] } {
  const days: TimelineDay[] = []
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

  for (let i = 0; i < daysCount; i++) {
    const current = new Date(start)
    current.setDate(start.getDate() + i)
    const dayOfWeek = dayNames[current.getDay()]
    const dStr = `${String(current.getDate()).padStart(2, "0")}/${String(current.getMonth() + 1).padStart(2, "0")}`

    days.push({
      date: current,
      dateStr: dStr,
      dayOfWeek,
      isToday: current.getTime() === today.getTime(),
      isWeekend: current.getDay() === 0 || current.getDay() === 6,
    })
  }

  // Active or pending rentals
  const activeRentals = rentals.filter(
    (r) => r.status !== "cancelled" && r.status !== "completed" && r.vehicleId
  )

  const rows: VehicleTimelineRow[] = vehicles.map((vehicle) => {
    const vehicleRentals = activeRentals.filter((r) => r.vehicleId === vehicle.id)

    const slots = days.map((day) => {
      if (vehicle.status === "maintenance") {
        return {
          day,
          isMaintenance: true,
          isAvailable: false,
        }
      }

      // Tìm rental rơi vào ngày này
      const matchedRental = vehicleRentals.find((r) => {
        const rStart = normalizeDate(r.startDate)
        const rEnd = normalizeDate(r.endDate)
        if (!rStart || !rEnd) return false
        return day.date >= rStart && day.date <= rEnd
      })

      if (!matchedRental) {
        return {
          day,
          isAvailable: true,
        }
      }

      const rStart = normalizeDate(matchedRental.startDate)
      const rEnd = normalizeDate(matchedRental.endDate)
      const isStart = rStart ? day.date.getTime() === rStart.getTime() : false
      const isEnd = rEnd ? day.date.getTime() === rEnd.getTime() : false
      const isMiddle = !isStart && !isEnd

      return {
        day,
        rental: matchedRental,
        isStart,
        isEnd,
        isMiddle,
        isAvailable: false,
      }
    })

    return { vehicle, slots }
  })

  return { days, rows }
}

export interface VehicleDateDynamicStatus {
  vehicleId: string
  date: Date
  dateStr: string
  effectiveStatus: "available" | "pending" | "rented" | "maintenance"
  statusLabel: string
  statusTone: "emerald" | "amber" | "blue" | "rose"
  detailText: string
  activeRental?: Rental | null
  pendingRental?: Rental | null
  nextUpcomingRental?: Rental | null
  daysUntilNextRental?: number | null
}

/**
 * Tính toán trạng thái thực tế chính xác của 1 chiếc xe tại 1 thời điểm ngày cụ thể (Hôm nay, ngày mai hoặc ngày chọn bất kỳ)
 */
export function getVehicleDynamicStatusForDate(
  vehicle: Vehicle,
  targetDateInput: Date | string,
  allRentals: Rental[]
): VehicleDateDynamicStatus {
  const targetDate = normalizeDate(targetDateInput) || new Date()
  targetDate.setHours(0, 0, 0, 0)
  const dateStr = formatDisplayDate(targetDate)

  // 1. Xe đang trong trạng thái bảo dưỡng tại xưởng
  if (vehicle.status === "maintenance") {
    return {
      vehicleId: vehicle.id,
      date: targetDate,
      dateStr,
      effectiveStatus: "maintenance",
      statusLabel: "Bảo trì",
      statusTone: "rose",
      detailText: "Đang bảo dưỡng / sửa chữa",
    }
  }

  const vehicleRentals = (allRentals || []).filter(
    (r) => r.vehicleId === vehicle.id && r.status !== "cancelled"
  )

  // 2. Tìm rental rơi vào targetDate
  let currentActive: Rental | null = null
  let currentPending: Rental | null = null

  for (const r of vehicleRentals) {
    const rStart = normalizeDate(r.startDate)
    const rEnd = normalizeDate(r.endDate)
    if (!rStart || !rEnd) continue

    if (targetDate >= rStart && targetDate <= rEnd) {
      if (r.status === "active") {
        currentActive = r
        break
      } else if (r.status === "pending") {
        currentPending = r
      }
    }
  }

  if (currentActive) {
    const rEnd = normalizeDate(currentActive.endDate)
    const isReturningToday = rEnd && rEnd.getTime() === targetDate.getTime()
    return {
      vehicleId: vehicle.id,
      date: targetDate,
      dateStr,
      effectiveStatus: "rented",
      statusLabel: "Đang thuê",
      statusTone: "blue",
      detailText: isReturningToday
        ? `Trả trong ngày (${currentActive.customerName || "Khách"})`
        : `Khách: ${currentActive.customerName || "Đang thuê"} · Đến ${currentActive.endDate}`,
      activeRental: currentActive,
    }
  }

  if (currentPending) {
    const rStart = normalizeDate(currentPending.startDate)
    const isStartingToday = rStart && rStart.getTime() === targetDate.getTime()
    return {
      vehicleId: vehicle.id,
      date: targetDate,
      dateStr,
      effectiveStatus: "pending",
      statusLabel: "Chờ giao",
      statusTone: "amber",
      detailText: isStartingToday
        ? `Giao hôm nay cho ${currentPending.customerName || "Khách"}`
        : `Đã cọc: ${currentPending.customerName || "Khách"} · ${currentPending.startDate} → ${currentPending.endDate}`,
      pendingRental: currentPending,
    }
  }

  // 3. Không có đơn trùng -> Xe SẴN SÀNG trong ngày targetDate
  // Tìm đơn kế tiếp trong tương lai sau targetDate
  const futureRentals = vehicleRentals
    .filter((r) => {
      const rStart = normalizeDate(r.startDate)
      return rStart && rStart > targetDate && r.status !== "completed"
    })
    .sort((a, b) => {
      const aStart = normalizeDate(a.startDate)!.getTime()
      const bStart = normalizeDate(b.startDate)!.getTime()
      return aStart - bStart
    })

  const nextRental = futureRentals[0] || null
  let daysUntilNext: number | null = null
  let detailText = "Rảnh suốt kỳ"

  if (nextRental) {
    const nStart = normalizeDate(nextRental.startDate)!
    daysUntilNext = Math.max(1, Math.round((nStart.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)))
    detailText = `Trống đến ${nextRental.startDate} (còn ${daysUntilNext} ngày)`
  }

  return {
    vehicleId: vehicle.id,
    date: targetDate,
    dateStr,
    effectiveStatus: "available",
    statusLabel: "Sẵn sàng",
    statusTone: "emerald",
    detailText,
    nextUpcomingRental: nextRental,
    daysUntilNextRental: daysUntilNext,
  }
}
