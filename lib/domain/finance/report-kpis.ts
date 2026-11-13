/**
 * Application use-case: KPI tài chính theo kỳ lọc.
 * Presentation (reports page) chỉ truyền data + period — không nhúng công thức.
 */
import { parseVietnamDate } from "@/lib/format-date"
import {
  calcOperatingProfit,
  calcOperatingRevenue,
  type TxLike,
} from "@/lib/transaction-finance"
import {
  calcCashOnHand,
  sumCompletedRentalRevenue,
  type RentalRevenueLike,
} from "@/lib/finance/cash-on-hand"

export type PeriodFilter = "all" | "this-month" | "last-month" | "this-year" | "custom"

export function getPeriodDateRange(
  period: PeriodFilter,
  customStart: string,
  customEnd: string,
  now = new Date()
): { start: Date; end: Date } {
  let start = new Date(0)
  let end = new Date(2100, 0, 1)

  if (period === "this-month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === "last-month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    start.setHours(0, 0, 0, 0)
    end = new Date(now.getFullYear(), now.getMonth(), 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === "this-year") {
    start = new Date(now.getFullYear(), 0, 1)
    start.setHours(0, 0, 0, 0)
    end = new Date(now.getFullYear(), 11, 31)
    end.setHours(23, 59, 59, 999)
  } else if (period === "custom") {
    if (customStart) start = new Date(`${customStart}T00:00:00`)
    if (customEnd) end = new Date(`${customEnd}T23:59:59`)
  }

  return { start, end }
}

export type RentalPeriodLike = RentalRevenueLike & {
  endDate?: string | null
  startDate?: string | null
  start_date?: string | null
  end_date?: string | null
}

export function filterRentalsInPeriod<T extends RentalPeriodLike>(
  rentals: T[],
  start: Date,
  end: Date
): T[] {
  return rentals.filter((r) => {
    const rDate = parseVietnamDate(r.endDate || r.startDate || "")
    return rDate >= start && rDate <= end
  })
}

export function filterTransactionsInPeriod<T extends TxLike>(
  transactions: T[],
  start: Date,
  end: Date
): T[] {
  return transactions.filter((tx) => {
    const txDate = new Date(tx.timestamp || tx.created_at || "")
    return txDate >= start && txDate <= end
  })
}

export function calcReportFinanceKpis(
  rentals: RentalPeriodLike[],
  transactions: TxLike[],
  period: PeriodFilter,
  customStart: string,
  customEnd: string
) {
  const { start, end } = getPeriodDateRange(period, customStart, customEnd)
  const filteredRentals = filterRentalsInPeriod(rentals, start, end)
  const filteredTx = filterTransactionsInPeriod(transactions, start, end)

  const rentalRevenue = sumCompletedRentalRevenue(filteredRentals)
  const allTimeRentalRevenue = sumCompletedRentalRevenue(rentals)
  const totalRevenue = calcOperatingRevenue(rentalRevenue, filteredTx)
  const totalProfit = calcOperatingProfit(rentalRevenue, filteredTx)
  const cashOnHand = calcCashOnHand(allTimeRentalRevenue, transactions)

  return {
    start,
    end,
    filteredRentals,
    filteredTx,
    rentalRevenue,
    allTimeRentalRevenue,
    totalRevenue,
    totalProfit,
    cashOnHand,
  }
}
