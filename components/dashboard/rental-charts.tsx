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
import { TrendingUp } from "lucide-react"
import { ChartEmpty, ChartShell, ChartTooltipBox, formatChartAxisValue, RENTAL_CHART_PALETTE } from "./chart-primitives"

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
        <div className="flex flex-wrap items-center gap-x-2.5 text-sm text-slate-500">
          <span className="font-semibold text-blue-700">Tổng kỳ: {formatPrice(total)}</span>
          {peak.revenue > 0 && (
            <span className="text-sm">
              (Cao nhất: <span className="font-semibold text-slate-700">{peak.month}</span>)
            </span>
          )}
        </div>
      }
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="rentalRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#94a3b8" }}
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
                    <p className="text-sm font-semibold text-slate-500 mb-1">{label}</p>
                    <p className="text-sm font-bold text-blue-700 tabular-nums">
                      {formatPrice(payload[0].value as number)}
                    </p>
                  </ChartTooltipBox>
                )
              }}
            />
            <Bar dataKey="revenue" fill="url(#rentalRevenueGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
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
        <span className="text-sm font-semibold text-blue-700">Tổng đơn: {total}</span>
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
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mt-1">Đơn thuê</p>
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
        <span className="text-sm font-semibold text-blue-700">Tổng xe: {total}</span>
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
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mt-1">Xe</p>
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
