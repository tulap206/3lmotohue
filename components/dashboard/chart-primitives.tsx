"use client"

export const RENTAL_CHART_PALETTE = ["#DC2626", "#059669", "#0369A1", "#7C6BA8", "#64748B"]
export const SALES_CHART_PALETTE = ["#2563EB", "#059669", "#D97706", "#7C6BA8", "#64748B"]
export const LOAN_CHART_PALETTE = ["#059669", "#DC2626", "#2563EB", "#94A3B8", "#D97706"]
export const PAWN_CHART_PALETTE = ["#D97706", "#059669", "#0369A1", "#7C6BA8", "#C2410C", "#64748B"]

export function formatChartAxisValue(val: number) {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}T`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}Tr`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`
  return val.toLocaleString("vi-VN")
}

export function ChartShell({
  title,
  description,
  icon,
  accent = "red",
  children,
  headerExtra,
}: {
  title: string
  description: string
  icon: React.ReactNode
  accent?: "red" | "blue" | "emerald" | "amber" | "rose"
  children: React.ReactNode
  headerExtra?: React.ReactNode
}) {
  const accentClass =
    accent === "blue"
      ? "from-blue-400 to-blue-600"
      : accent === "emerald"
        ? "from-emerald-400 to-emerald-600"
        : accent === "amber"
          ? "from-amber-400 to-amber-600"
          : accent === "rose"
            ? "from-rose-400 to-rose-600"
            : "from-red-400 to-red-600"

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] h-full">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accentClass}`} />
      <div className="px-4 pt-4 pb-2 border-b border-slate-100/80">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
            {headerExtra && <div className="mt-1.5">{headerExtra}</div>}
          </div>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">{children}</div>
    </div>
  )
}

export function ChartTooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.1)]">
      {children}
    </div>
  )
}

export function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-full border border-dashed border-slate-200 flex items-center justify-center mb-3">
        <div className="h-2 w-2 rounded-full bg-slate-300" />
      </div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
    </div>
  )
}
