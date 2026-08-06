export interface RentalDateConflictOrder {
  id?: string | null
  vehicleId?: string | null
  vehicleName?: string | null
  licensePlate?: string | null
  customerName?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: string | null
}

function parseRentalDate(value?: string | null): Date | null {
  if (!value) return null

  const trimmed = value.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }

  const vnMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (vnMatch) {
    return new Date(Number(vnMatch[3]), Number(vnMatch[2]) - 1, Number(vnMatch[1]))
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

export function findRentalDateConflict(
  orders: RentalDateConflictOrder[],
  vehicleIds: string[],
  startDateValue: string,
  endDateValue: string,
  excludedOrderId?: string
): RentalDateConflictOrder | null {
  const startDate = parseRentalDate(startDateValue)
  const endDate = parseRentalDate(endDateValue)
  if (!startDate || !endDate) return null

  const vehicleIdSet = new Set(vehicleIds)
  return orders.find((order) => {
    if (!order.vehicleId || !vehicleIdSet.has(order.vehicleId)) return false
    if (excludedOrderId && order.id === excludedOrderId) return false
    if (order.status === "cancelled") return false

    const orderStart = parseRentalDate(order.startDate)
    const orderEnd = parseRentalDate(order.endDate)
    if (!orderStart || !orderEnd) return false

    return !(endDate < orderStart || startDate > orderEnd)
  }) || null
}
