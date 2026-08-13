"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { TrendingUp, Wallet, Bike, ClipboardList } from "lucide-react"
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
        <div>
          <p className="text-label">Tổng kỳ</p>
          <p className="text-body font-semibold text-slate-900 money tabular-nums">{formatPrice(total)}</p>
          {peak.revenue > 0 && <p className="text-meta mt-0.5">Cao nhất {peak.month}</p>}
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
      {peak.revenue > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-meta text-slate-500">
            <span className="h-2 w-2 rounded-[3px] bg-blue-600" aria-hidden />
            Cao nhất {peak.month}
          </span>
          <span className="flex items-center gap-1.5 text-meta text-slate-400">
            <span className="h-2 w-2 rounded-[3px] bg-blue-300" aria-hidden />
            Các tháng khác
          </span>
        </div>
      )}
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
        <span className="text-body font-semibold text-slate-900 money">Tổng chi: {formatPrice(total)}</span>
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

const STATUS_TONE: Record<string, string> = {
  "Chờ xử lý": "#D97706",
  "Đang thuê": "#2563EB",
  "Quá hạn": "#E11D48",
  "Hoàn thành": "#059669",
  "Đã hủy": "#64748B",
}

const FLEET_TONE: Record<string, string> = {
  "Sẵn sàng": "#059669",
  "Đang cho thuê": "#2563EB",
  "Bảo trì": "#D97706",
}

function toneFor(name: string, map: Record<string, string>, index: number) {
  return map[name] || RENTAL_CHART_PALETTE[index % RENTAL_CHART_PALETTE.length]
}

function RankedComposition({
  items,
  unit,
}: {
  items: { name: string; value: number; color: string }[]
  unit: string
}) {
  const total = items.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="flex flex-col gap-5 flex-1">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-[var(--radius-badge)] bg-slate-100"
        role="img"
        aria-label={`Tỷ trọng ${unit}`}
      >
        {items.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0
          return (
            <div
              key={entry.name}
              className="h-full min-w-[3px] first:rounded-l-[var(--radius-badge)] last:rounded-r-[var(--radius-badge)]"
              style={{ width: `${pct}%`, backgroundColor: entry.color }}
              title={`${entry.name}: ${Math.round(pct)}%`}
            />
          )
        })}
      </div>
      <ul className="flex flex-col gap-3.5">
        {items.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0
          return (
            <li key={entry.name}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: entry.color }} aria-hidden />
                  <span className="text-body font-medium text-slate-700 truncate">{entry.name}</span>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-body font-semibold text-slate-900 tabular-nums">
                    {entry.value} {unit}
                  </span>
                  <span className="text-meta text-slate-400 tabular-nums w-8 text-right">{Math.round(pct)}%</span>
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
  )
}

export function RentalStatusChart({ data }: { data: StatusDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const rows = data
    .filter((d) => d.value > 0)
    .map((d, index) => ({ ...d, color: toneFor(d.name, STATUS_TONE, index) }))
    .sort((a, b) => b.value - a.value)

  if (rows.length === 0) {
    return (
      <ChartShell
        title="Trạng thái đơn thuê"
        description="Phân bổ đơn theo trạng thái"
        icon={<ClipboardList className="w-4 h-4" />}
      >
        <ChartEmpty label="Chưa có đơn thuê" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Trạng thái đơn thuê"
      description="Phân bổ đơn theo trạng thái"
      icon={<ClipboardList className="w-4 h-4" />}
      headerExtra={
        <div>
          <p className="text-label">Tổng đơn</p>
          <p className="text-title money tabular-nums">{total}</p>
        </div>
      }
    >
      <RankedComposition items={rows} unit="đơn" />
    </ChartShell>
  )
}

export function RentalFleetChart({ data }: { data: StatusDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const rows = data
    .filter((d) => d.value > 0)
    .map((d, index) => ({ ...d, color: toneFor(d.name, FLEET_TONE, index) }))
    .sort((a, b) => b.value - a.value)

  if (rows.length === 0) {
    return (
      <ChartShell
        title="Đội xe"
        description="Xe theo trạng thái vận hành"
        icon={<Bike className="w-4 h-4" />}
      >
        <ChartEmpty label="Chưa có xe" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Đội xe"
      description="Xe theo trạng thái vận hành"
      icon={<Bike className="w-4 h-4" />}
      headerExtra={
        <div>
          <p className="text-label">Tổng xe</p>
          <p className="text-title money tabular-nums">{total}</p>
        </div>
      }
    >
      <RankedComposition items={rows} unit="xe" />
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
  const currentMonth = `Thg ${new Date().getMonth() + 1}`

  if (data.length === 0 || (totalIncome === 0 && totalExpense === 0)) {
    return (
      <ChartShell
        title="Thu chi theo tháng"
        description="Khoản thu/chi ngoài đơn thuê"
        icon={<Wallet className="w-4 h-4" />}
      >
        <ChartEmpty label="Chưa có giao dịch thu/chi" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Thu chi theo tháng"
      description="Khoản thu/chi ngoài đơn thuê"
      icon={<Wallet className="w-4 h-4" />}
      headerExtra={
        <div className="space-y-0.5">
          <p className="text-meta">
            Thu <span className="font-semibold text-emerald-700 money">{formatPrice(totalIncome)}</span>
          </p>
          <p className="text-meta">
            Chi <span className="font-semibold text-amber-700 money">{formatPrice(totalExpense)}</span>
          </p>
        </div>
      }
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} barGap={3}>
            <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
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
              cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <ChartTooltipBox>
                    <p className="text-meta font-medium text-slate-500 mb-1.5">{label}</p>
                    {payload.map((entry) => (
                      <p
                        key={String(entry.dataKey)}
                        className="text-body font-semibold tabular-nums money"
                        style={{ color: entry.color }}
                      >
                        {entry.name}: {formatPrice(entry.value as number)}
                      </p>
                    ))}
                  </ChartTooltipBox>
                )
              }}
            />
            <Bar name="Thu" dataKey="income" radius={[5, 5, 2, 2]} maxBarSize={22}>
              {data.map((d) => (
                <Cell key={`in-${d.name}`} fill={d.name === currentMonth ? "#059669" : "#A7F3D0"} />
              ))}
            </Bar>
            <Bar name="Chi" dataKey="expense" radius={[5, 5, 2, 2]} maxBarSize={22}>
              {data.map((d) => (
                <Cell key={`ex-${d.name}`} fill={d.name === currentMonth ? "#D97706" : "#FDE68A"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-meta text-slate-500">
          <span className="h-2 w-2 rounded-[3px] bg-emerald-600" aria-hidden />
          Thu
        </span>
        <span className="flex items-center gap-1.5 text-meta text-slate-500">
          <span className="h-2 w-2 rounded-[3px] bg-amber-600" aria-hidden />
          Chi
        </span>
        <span className="text-meta text-slate-400">Tháng hiện tại đậm hơn</span>
      </div>
    </ChartShell>
  )
}
