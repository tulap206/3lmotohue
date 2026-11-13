import type { TxLike } from "@/lib/transaction-finance"

export type RentalRevenueLike = {
  status?: string | null
  revenue?: number | null
  totalPrice?: number | null
}

/**
 * Doanh thu thuê tích lũy = tổng revenue đơn hoàn tất.
 * (fallback totalPrice khi thiếu field revenue)
 */
export function sumCompletedRentalRevenue(rentals: RentalRevenueLike[]): number {
  return rentals
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.revenue || r.totalPrice || 0), 0)
}

/**
 * Tiền quỹ còn lại (số dư tích lũy):
 * DT thuê all-time + mọi khoản thu − mọi khoản chi
 * (gồm cả vốn/mua tài sản — khác P&L vận hành)
 */
export function calcCashOnHand(
  allTimeRentalRevenue: number,
  transactions: TxLike[]
): number {
  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
  return allTimeRentalRevenue + totalIncome - totalExpense
}

export function calcCashOnHandFromRentals(
  rentals: RentalRevenueLike[],
  transactions: TxLike[]
): number {
  return calcCashOnHand(sumCompletedRentalRevenue(rentals), transactions)
}
