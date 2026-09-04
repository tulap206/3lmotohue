/**
 * Tiện ích so sánh và tạo chuỗi mô tả thay đổi chi tiết cho Lịch sử truy cập (Audit Logs)
 */

export function formatVND(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : Number(amount || 0)
  if (isNaN(num)) return "0đ"
  return `${num.toLocaleString("vi-VN")}đ`
}

export function formatKM(km: number | string | null | undefined): string {
  const num = typeof km === "string" ? parseInt(km.replace(/[^0-9]+/g, ""), 10) : Number(km || 0)
  if (isNaN(num)) return "0 km"
  return `${num.toLocaleString("vi-VN")} km`
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

const VEHICLE_STATUS_MAP: Record<string, string> = {
  available: "Sẵn sàng",
  rented: "Đang thuê",
  maintenance: "Bảo trì",
}

const VEHICLE_CATEGORY_MAP: Record<string, string> = {
  bike: "Xe máy",
  car: "Ô tô",
  electric: "Xe điện",
}

const RENTAL_STATUS_MAP: Record<string, string> = {
  pending: "Chờ giao xe",
  active: "Đang thuê",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
}

const CUSTOMER_STATUS_MAP: Record<string, string> = {
  active: "Hoạt động",
  inactive: "Tạm dừng",
  renting: "Đang thuê xe",
  pending: "Chờ duyệt",
}

/**
 * So sánh thay đổi thông tin Xe
 */
export function diffVehicle(oldV: any, newV: any): string[] {
  const changes: string[] = []
  if (!oldV || !newV) return changes

  if (oldV.name !== newV.name && newV.name) {
    changes.push(`Tên xe: "${oldV.name || ""}" → "${newV.name}"`)
  }
  if (oldV.licensePlate !== newV.licensePlate && newV.licensePlate) {
    changes.push(`Biển số: ${oldV.licensePlate || "—"} → ${newV.licensePlate}`)
  }
  if (oldV.color !== newV.color && newV.color !== undefined) {
    changes.push(`Màu xe: ${oldV.color || "—"} → ${newV.color || "—"}`)
  }
  if (Number(oldV.pricePerDay || 0) !== Number(newV.pricePerDay || 0)) {
    changes.push(`Giá thuê: ${formatVND(oldV.pricePerDay)} → ${formatVND(newV.pricePerDay)}/ngày`)
  }
  if (Number(oldV.purchasePrice || 0) !== Number(newV.purchasePrice || 0)) {
    changes.push(`Giá mua: ${formatVND(oldV.purchasePrice)} → ${formatVND(newV.purchasePrice)}`)
  }
  if (Number(oldV.current_km || 0) !== Number(newV.current_km || 0)) {
    changes.push(`Số KM: ${formatKM(oldV.current_km)} → ${formatKM(newV.current_km)}`)
  }
  if (oldV.status !== newV.status && newV.status) {
    const oldSt = VEHICLE_STATUS_MAP[oldV.status] || oldV.status
    const newSt = VEHICLE_STATUS_MAP[newV.status] || newV.status
    changes.push(`Trạng thái: ${oldSt} → ${newSt}`)
  }
  if (oldV.category !== newV.category && newV.category) {
    const oldCat = VEHICLE_CATEGORY_MAP[oldV.category] || oldV.category
    const newCat = VEHICLE_CATEGORY_MAP[newV.category] || newV.category
    changes.push(`Loại xe: ${oldCat} → ${newCat}`)
  }
  if ((oldV.notes || "").trim() !== (newV.notes || "").trim()) {
    const oldNotes = (oldV.notes || "").trim()
    const newNotes = (newV.notes || "").trim()
    if (!oldNotes && newNotes) {
      changes.push(`Thêm ghi chú: "${newNotes.length > 40 ? newNotes.slice(0, 40) + '...' : newNotes}"`)
    } else if (oldNotes && !newNotes) {
      changes.push(`Xoá ghi chú`)
    } else {
      changes.push(`Đổi ghi chú/vị trí: "${newNotes.length > 40 ? newNotes.slice(0, 40) + '...' : newNotes}"`)
    }
  }

  return changes
}

/**
 * So sánh thay đổi thông tin Đơn thuê xe
 */
export function diffRental(oldR: any, newR: any): string[] {
  const changes: string[] = []
  if (!oldR || !newR) return changes

  if (oldR.vehicleId !== newR.vehicleId || oldR.vehicleName !== newR.vehicleName) {
    changes.push(`Đổi xe: ${oldR.vehicleName || "Chưa gán"} → ${newR.vehicleName || "Chưa gán"}`)
  }
  if (oldR.customerName !== newR.customerName && newR.customerName) {
    changes.push(`Khách thuê: ${oldR.customerName} → ${newR.customerName}`)
  }
  if (oldR.startDate !== newR.startDate || oldR.endDate !== newR.endDate) {
    changes.push(
      `Thời gian thuê: ${formatShortDate(oldR.startDate)} đến ${formatShortDate(oldR.endDate)} → ${formatShortDate(newR.startDate)} đến ${formatShortDate(newR.endDate)} (${newR.totalDays || oldR.totalDays} ngày)`
    )
  }
  if (Number(oldR.pricePerDay || 0) !== Number(newR.pricePerDay || 0)) {
    changes.push(`Giá/ngày: ${formatVND(oldR.pricePerDay)} → ${formatVND(newR.pricePerDay)}`)
  }
  if (Number(oldR.totalPrice || 0) !== Number(newR.totalPrice || 0)) {
    changes.push(`Tổng tiền thuê: ${formatVND(oldR.totalPrice)} → ${formatVND(newR.totalPrice)}`)
  }
  if (Number(oldR.deposit || 0) !== Number(newR.deposit || 0)) {
    changes.push(`Tiền cọc: ${formatVND(oldR.deposit)} → ${formatVND(newR.deposit)}`)
  }
  if (Number(oldR.extraFees || 0) !== Number(newR.extraFees || 0)) {
    changes.push(`Phụ thu/phí trễ: ${formatVND(oldR.extraFees)} → ${formatVND(newR.extraFees)}`)
  }
  if (Number(oldR.commissionHome || 0) !== Number(newR.commissionHome || 0)) {
    changes.push(`Hoa hồng Home: ${formatVND(oldR.commissionHome)} → ${formatVND(newR.commissionHome)}`)
  }
  if (oldR.homeName !== newR.homeName && (oldR.homeName || newR.homeName)) {
    changes.push(`Tên Home: ${oldR.homeName || "—"} → ${newR.homeName || "—"}`)
  }
  if (oldR.status !== newR.status && newR.status) {
    const oldSt = RENTAL_STATUS_MAP[oldR.status] || oldR.status
    const newSt = RENTAL_STATUS_MAP[newR.status] || newR.status
    changes.push(`Trạng thái: ${oldSt} → ${newSt}`)
  }
  if ((oldR.deliveryAddress || "").trim() !== (newR.deliveryAddress || "").trim()) {
    changes.push(`Địa điểm giao: "${newR.deliveryAddress || "Tại cửa hàng"}"`)
  }

  return changes
}

/**
 * So sánh thay đổi thông tin Khách hàng
 */
export function diffCustomer(oldC: any, newC: any): string[] {
  const changes: string[] = []
  if (!oldC || !newC) return changes

  if (oldC.name !== newC.name && newC.name) {
    changes.push(`Tên: "${oldC.name}" → "${newC.name}"`)
  }
  if (oldC.phone !== newC.phone && newC.phone) {
    changes.push(`SĐT: ${oldC.phone} → ${newC.phone}`)
  }
  if (oldC.idcard !== newC.idcard && (oldC.idcard || newC.idcard)) {
    changes.push(`CCCD/CMND: ${oldC.idcard || "—"} → ${newC.idcard || "—"}`)
  }
  if (oldC.address !== newC.address && (oldC.address || newC.address)) {
    changes.push(`Địa chỉ: "${oldC.address || "—"}" → "${newC.address || "—"}"`)
  }
  if (oldC.status !== newC.status && newC.status) {
    const oldSt = CUSTOMER_STATUS_MAP[oldC.status] || oldC.status
    const newSt = CUSTOMER_STATUS_MAP[newC.status] || newC.status
    changes.push(`Trạng thái: ${oldSt} → ${newSt}`)
  }

  return changes
}

/**
 * So sánh thay đổi thông tin Giao dịch Thu/Chi
 */
export function diffTransaction(oldT: any, newT: any): string[] {
  const changes: string[] = []
  if (!oldT || !newT) return changes

  const oldType = oldT.type === "income" ? "Khoản thu" : "Khoản chi"
  const newType = newT.type === "income" ? "Khoản thu" : "Khoản chi"
  if (oldT.type !== newT.type) {
    changes.push(`Loại: ${oldType} → ${newType}`)
  }
  if (oldT.description !== newT.description) {
    changes.push(`Nội dung: "${oldT.description}" → "${newT.description}"`)
  }
  if (Number(oldT.amount || 0) !== Number(newT.amount || 0)) {
    changes.push(`Số tiền: ${formatVND(oldT.amount)} → ${formatVND(newT.amount)}`)
  }
  if (oldT.timestamp !== newT.timestamp && newT.timestamp) {
    changes.push(`Ngày: ${formatShortDate(oldT.timestamp)} → ${formatShortDate(newT.timestamp)}`)
  }

  return changes
}

/**
 * Tạo chuỗi diff hoàn chỉnh dạng:
 * "Sửa xe: AB Đen (73G1-316.77) [Giá thuê: 150.000đ → 200.000đ, Màu xe: Đỏ → Đen]"
 */
export function buildDiffDetailString(basePrefix: string, changes: string[]): string {
  if (!changes || changes.length === 0) {
    return `${basePrefix} (không thay đổi dữ liệu chính)`
  }
  return `${basePrefix} [${changes.join(", ")}]`
}
