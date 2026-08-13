"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { TrendingUp, Wallet } from "lucide-react"
import { ChartEmpty, ChartShell, ChartTooltipBox, formatChartAxisValue, RENTAL_CHART_PALETTE } from "./chart-primitives"

const EXPENSE_TONE: Record<string, string> = {
  "Cổ tức": "#64748B",
  "Lương nhân viên": "#2563EB",
  "Vốn & Tài sản": "#D97706",
  "Sửa xe & bảo dưỡng": "#E11D48",
  "Di chuyển & xăng": "#059669",
  "Chi phí khác": "#94A3B8",
}

function expenseTone(name: string, index: number) {
  return EXPENSE_TONE[name] || RENTAL_CHART_PALETTE[index % RENTAL_CHART_PALETTE.length]
}

type MonthlyRevenueDatum = { month: string; revenue: number }

export function MonthlyRevenueChart({
  data,
  formatPrice,
}: {
  data: MonthlyRevenueDatum[]
  formatPrice: (n: number) => string
}) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0)
  const peak = data.reduce((max, d) => (d.revenue > max.revenue ? d : max), data[0] || { month: "", revenue: 0 })

  if (data.length === 0) {
    return (
      <ChartShell
        title="Doanh thu theo tháng"
        description="Doanh thu thuê xe hàng tháng"
        icon={<TrendingUp className="w-4 h-4" />}
        accent="blue"
      >
        <ChartEmpty label="Chưa có dữ liệu doanh thu" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Doanh thu theo tháng"
      description="Đơn hoàn tất theo tháng (ngày kết thúc)"
      icon={<TrendingUp className="w-4 h-4" />}
      accent="blue"
      headerExtra={
        <div className="flex flex-wrap items-center gap-x-2.5 text-meta text-slate-500">
          <span className="font-semibold text-slate-900 money">Tổng kỳ: {formatPrice(total)}</span>
          {peak.revenue > 0 && (
            <span>
              Cao nhất <span className="font-semibold text-slate-700">{peak.month}</span>
            </span>
          )}
        </div>
      }
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={formatChartAxisValue}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "rgba(37, 99, 235, 0.04)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <ChartTooltipBox>
                    <p className="text-meta font-medium text-slate-500 mb-1">{label}</p>
                    <p className="text-body font-semibold text-slate-900 money tabular-nums">
                      {formatPrice(payload[0].value as number)}
                    </p>
                  </ChartTooltipBox>
                )
              }}
            />
            <Bar dataKey="revenue" radius={[6, 6, 2, 2]} maxBarSize={36}>
              {data.map((d) => (
                <Cell
                  key={d.month}
                  fill={d.month === peak.month && peak.revenue > 0 ? "#2563EB" : "#93C5FD"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  )
}

type ExpenseDatum = { name: string; value: number; color?: string }

export function ExpenseStructureChart({
  data,
  formatPrice,
}: {
  data: ExpenseDatum[]
  formatPrice: (n: number) => string
}) {
  const rows = [...data]
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((d, index) => ({ ...d, color: expenseTone(d.name, index) }))
  const total = rows.reduce((sum, d) => sum + d.value, 0)

  if (rows.length === 0 || total === 0) {
    return (
      <ChartShell
        title="Cơ cấu chi phí"
        description="Tỷ trọng các khoản chi trong kỳ lọc"
        icon={<Wallet className="w-4 h-4" />}
        accent="blue"
      >
        <ChartEmpty label="Không có dữ liệu chi phí trong kỳ" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Cơ cấu chi phí"
      description="Tỷ trọng các khoản chi trong kỳ lọc"
      icon={<Wallet className="w-4 h-4" />}
      accent="blue"
      headerExtra={
        <span className="text-meta font-semibold text-slate-900 money">Tổng chi: {formatPrice(total)}</span>
      }
    >
      <div className="flex flex-col gap-5 flex-1">
        <div
          className="flex h-2.5 w-full overflow-hidden rounded-[var(--radius-badge)] bg-slate-100"
          role="img"
          aria-label="Tỷ trọng chi phí"
        >
          {rows.map((entry) => {
            const pct = (entry.value / total) * 100
            return (
              <div
                key={entry.name}
                className="h-full min-w-[3px] first:rounded-l-[var(--radius-badge)] last:rounded-r-[var(--radius-badge)]"
                style={{ width: `${pct}%`, backgroundColor: entry.color }}
                title={`${entry.name}: ${pct.toFixed(0)}%`}
              />
            )
          })}
        </div>

        <ul className="flex flex-col gap-3.5">
          {rows.map((entry) => {
            const pct = (entry.value / total) * 100
            return (
              <li key={entry.name}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-body font-medium text-slate-700 truncate">{entry.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-body font-semibold text-slate-900 money tabular-nums">
                      {formatPrice(entry.value)}
                    </span>
                    <span className="text-meta text-slate-400 tabular-nums w-8 text-right">
                      {Math.round(pct)}%
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-[var(--radius-badge)] bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-[var(--radius-badge)]"
                    style={{ width: `${pct}%`, backgroundColor: entry.color }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </ChartShell>
  )
}

type StatusDatum = { name: string; value: number }
type AmountDatum = { name: string; income: number; expense: number }

export function RentalStatusChart({ data }: { data: StatusDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const filtered = data.filter((d) => d.value > 0)

  if (filtered.length === 0) {
    return (
      <ChartShell
        title="Trạng thái đơn thuê"
        description="Phân bổ đơn theo trạng thái"
        icon={<TrendingUp className="w-4 h-4" />}
        accent="blue"
      >
        <ChartEmpty label="Chưa có đơn thuê" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Trạng thái đơn thuê"
      description="Phân bổ đơn theo trạng thái"
      icon={<TrendingUp className="w-4 h-4" />}
      accent="blue"
      headerExtra={
        <span className="text-sm font-semibold text-slate-900 money">Tổng đơn: {total}</span>
      }
    >
      <div className="flex flex-col gap-4 flex-1">
        <div className="relative mx-auto w-full max-w-[200px]">
          <ResponsiveContainer width="100%" height={188}>
            <PieChart>
              <Pie
                data={filtered}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                stroke="none"
              >
                {filtered.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={RENTAL_CHART_PALETTE[index % RENTAL_CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload as StatusDatum
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
                  return (
                    <ChartTooltipBox>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {item.value} đơn · {pct}%
                      </p>
                    </ChartTooltipBox>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{total}</p>
              <p className="text-meta text-slate-400 mt-1">Đơn thuê</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {filtered.map((entry, index) => {
            const color = RENTAL_CHART_PALETTE[index % RENTAL_CHART_PALETTE.length]
            const pct = total > 0 ? (entry.value / total) * 100 : 0
            return (
              <div key={entry.name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-slate-700 truncate">{entry.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{entry.value}</span>
                </div>
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ChartShell>
  )
}

export function RentalFleetChart({ data }: { data: StatusDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const filtered = data.filter((d) => d.value > 0)

  if (filtered.length === 0) {
    return (
      <ChartShell
        title="Đội xe"
        description="Xe theo trạng thái vận hành"
        icon={<TrendingUp className="w-4 h-4" />}
        accent="blue"
      >
        <ChartEmpty label="Chưa có xe" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Đội xe"
      description="Xe theo trạng thái vận hành"
      icon={<TrendingUp className="w-4 h-4" />}
      accent="blue"
      headerExtra={
        <span className="text-sm font-semibold text-slate-900 money">Tổng xe: {total}</span>
      }
    >
      <div className="flex flex-col gap-4 flex-1">
        <div className="relative mx-auto w-full max-w-[200px]">
          <ResponsiveContainer width="100%" height={188}>
            <PieChart>
              <Pie
                data={filtered}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                stroke="none"
              >
                {filtered.map((_, index) => (
                  <Cell key={`fleet-${index}`} fill={RENTAL_CHART_PALETTE[index % RENTAL_CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload as StatusDatum
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
                  return (
                    <ChartTooltipBox>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {item.value} xe · {pct}%
                      </p>
                    </ChartTooltipBox>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{total}</p>
              <p className="text-meta text-slate-400 mt-1">Xe</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {filtered.map((entry, index) => {
            const color = RENTAL_CHART_PALETTE[index % RENTAL_CHART_PALETTE.length]
            const pct = total > 0 ? (entry.value / total) * 100 : 0
            return (
              <div key={entry.name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-slate-700 truncate">{entry.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{entry.value}</span>
                </div>
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ChartShell>
  )
}

export function RentalIncomeExpenseChart({
  data,
  formatPrice,
}: {
  data: AmountDatum[]
  formatPrice: (n: number) => string
}) {
  const totalIncome = data.reduce((s, d) => s + d.income, 0)
  const totalExpense = data.reduce((s, d) => s + d.expense, 0)

  if (data.length === 0 || (totalIncome === 0 && totalExpense === 0)) {
    return (
      <ChartShell
        title="Thu chi theo tháng"
        description="Khoản thu/chi ngoài đơn thuê"
        icon={<TrendingUp className="w-4 h-4" />}
        accent="blue"
      >
        <ChartEmpty label="Chưa có giao dịch thu/chi" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Thu chi theo tháng"
      description="Khoản thu/chi ngoài đơn thuê"
      icon={<TrendingUp className="w-4 h-4" />}
      accent="blue"
      headerExtra={
        <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
          <span>Thu: <span className="font-bold text-emerald-700">{formatPrice(totalIncome)}</span></span>
          <span>Chi: <span className="font-bold text-amber-700">{formatPrice(totalExpense)}</span></span>
        </div>
      }
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
            <defs>
              <linearGradient id="rentalIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="rentalExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={formatChartAxisValue}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "rgba(248, 250, 252, 0.8)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <ChartTooltipBox>
                    <p className="text-sm font-semibold text-slate-500 mb-1.5">{label}</p>
                    {payload.map((entry) => (
                      <p key={entry.dataKey} className="text-sm font-bold tabular-nums" style={{ color: entry.color }}>
                        {entry.name}: {formatPrice(entry.value as number)}
                      </p>
                    ))}
                  </ChartTooltipBox>
                )
              }}
            />
            <Bar name="Thu" dataKey="income" fill="url(#rentalIncomeGrad)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar name="Chi" dataKey="expense" fill="url(#rentalExpenseGrad)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  )
}
