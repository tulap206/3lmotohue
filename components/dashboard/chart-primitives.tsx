"use client"

import { MODULE_CHART_PALETTE } from "@/lib/module-theme"

export const RENTAL_CHART_PALETTE = MODULE_CHART_PALETTE.rental
export const SALES_CHART_PALETTE = MODULE_CHART_PALETTE.sales
export const LOAN_CHART_PALETTE = MODULE_CHART_PALETTE.loan
export const PAWN_CHART_PALETTE = MODULE_CHART_PALETTE.pawnshop

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
  accent = "blue",
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
    accent === "emerald"
      ? "from-emerald-400 to-emerald-600"
      : accent === "amber"
        ? "from-amber-400 to-amber-600"
        : accent === "rose" || accent === "red"
          ? "from-rose-400 to-rose-600"
          : "from-blue-400 to-blue-600"

  return (
    <div className="relative flex flex-col overflow-hidden rounded-[var(--radius-container)] border border-slate-200/70 bg-white shadow-[var(--shadow-card)] h-full ui-transition">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accentClass}`} />
      <div className="px-4 pt-4 pb-2 border-b border-slate-100/80">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-slate-50 border border-slate-100 text-slate-600">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-title">{title}</h3>
            <p className="text-meta mt-0.5 leading-snug">{description}</p>
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
    <div className="rounded-[var(--radius-control)] border border-slate-200/90 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-[var(--shadow-card-hover)]">
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
      <p className="text-meta font-medium">{label}</p>
    </div>
  )
}
