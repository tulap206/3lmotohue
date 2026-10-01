const DISCOUNT_TAG_RE = /\[discount:(\d+)\]\s*/i
const LEADING_RENTAL_TERM_TAG_RE = /^(\[rentalTerm:(?:short|long)\]\s*)/i

export function stripRentalDiscountFromNotes(notes?: string | null): string {
  return (notes || "").replace(DISCOUNT_TAG_RE, "").trimStart()
}

export function embedRentalDiscountInNotes(notes: string | null | undefined, discount?: number | null): string {
  const clean = stripRentalDiscountFromNotes(notes)
  const normalizedDiscount = Math.max(0, Math.round(Number(discount || 0)))
  if (normalizedDiscount <= 0) return clean
  const discountTag = `[discount:${normalizedDiscount}]`
  const termMatch = clean.match(LEADING_RENTAL_TERM_TAG_RE)
  if (termMatch) {
    const termTag = termMatch[1].trimEnd()
    const rest = clean.slice(termMatch[1].length).trimStart()
    return rest ? `${termTag}\n${discountTag}\n${rest}` : `${termTag}\n${discountTag}`
  }
  return clean ? `${discountTag}\n${clean}` : discountTag
}

export function getRentalDiscount(order: {
  discount?: number | string | null
  notes?: string | null
}): number {
  if (order.discount !== undefined && order.discount !== null && order.discount !== "") {
    const columnValue = Number(order.discount)
    if (Number.isFinite(columnValue)) {
      return Math.max(0, Math.round(columnValue))
    }
  }

  const match = (order.notes || "").match(DISCOUNT_TAG_RE)
  const fallbackValue = match ? Number(match[1]) : 0
  return Number.isFinite(fallbackValue) ? Math.max(0, Math.round(fallbackValue)) : 0
}

export function normalizeRentalDiscount<T extends { discount?: number | string | null; notes?: string | null }>(
  order: T
): T & { discount: number; notes: string } {
  return {
    ...order,
    discount: getRentalDiscount(order),
    notes: stripRentalDiscountFromNotes(order.notes),
  }
}
