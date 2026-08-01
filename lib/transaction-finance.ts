/**
 * Phân loại thu/chi để tính doanh thu & lợi nhuận vận hành.
 * Khoản vốn và mua tài sản (xe, mũ, định vị, setup...) không tính vào P&L.
 */

const CAPITAL_INCOME_RE =
  /(g[oó]p\s*v[oốồ]n|v[oốồ]n\s*g[oó]p|đ[aầ]u\s*t[ưu]\s*v[oốồ]n|\[v[oốồ]n\])/i

/** Mua tài sản / đầu tư một lần / chia cổ tức — không phải chi vận hành hàng ngày */
const CAPITAL_EXPENSE_RE =
  /(mua\s*xe|mua\s*ab\b|mua\s*vision|mua\s*janus|m[uũ]\s*b[aả]o\s*hi[eể]m|đ[iị]nh\s*v[iị]|sever|server|t[eê]n\s*mi[eề]n|cổ\s*tức|chia\s*lợi\s*nhuận|cô\s*tưc|\[v[oốồ]n\])/i

/** Chi phí nhân sự / lương thưởng */
const SALARY_EXPENSE_RE =
  /(lương|trả\s*nhân\s*viên|nhân\s*viên|thưởng|luong|nhan\s*vien)/i

export type TxLike = {
  type?: string | null
  description?: string | null
  amount?: number | null
  timestamp?: string | null
  created_at?: string | null
}

export function isSalaryTransaction(tx: TxLike): boolean {
  return tx.type === "expense" && SALARY_EXPENSE_RE.test(tx.description || "")
}

export function isDividendTransaction(tx: TxLike): boolean {
  return tx.type === "expense" && /(cổ\s*tức|chia\s*lợi\s*nhuận|c[oố]t\s*[ưu]c)/i.test(tx.description || "")
}

export function isCapitalTransaction(tx: TxLike): boolean {
  const desc = tx.description || ""
  if (tx.type === "income") return CAPITAL_INCOME_RE.test(desc)
  if (tx.type === "expense") return CAPITAL_EXPENSE_RE.test(desc)
  return false
}

export function isOperatingTransaction(tx: TxLike): boolean {
  return !isCapitalTransaction(tx)
}

export function sumTxAmount(transactions: TxLike[], type: "income" | "expense", operatingOnly = true): number {
  return transactions
    .filter((tx) => tx.type === type)
    .filter((tx) => (operatingOnly ? isOperatingTransaction(tx) : true))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
}

/** Doanh thu vận hành = DT thuê + thu vận hành (không gồm góp vốn) */
export function calcOperatingRevenue(rentalRevenue: number, transactions: TxLike[]): number {
  return rentalRevenue + sumTxAmount(transactions, "income", true)
}

/** Lợi nhuận vận hành = doanh thu vận hành − chi vận hành (không gồm mua tài sản) */
export function calcOperatingProfit(rentalRevenue: number, transactions: TxLike[]): number {
  return calcOperatingRevenue(rentalRevenue, transactions) - sumTxAmount(transactions, "expense", true)
}

export function withCapitalTag(description: string, isCapital: boolean): string {
  const cleaned = description.replace(/^\s*\[vốn\]\s*/i, "").trim()
  return isCapital ? `[vốn] ${cleaned}` : cleaned
}
