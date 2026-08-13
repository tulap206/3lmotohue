"use client"

import type { ReactNode } from "react"
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
  children,
  headerExtra,
}: {
  title: string
  description: string
  icon: ReactNode
  accent?: "red" | "blue" | "emerald" | "amber" | "rose"
  children: ReactNode
  headerExtra?: ReactNode
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[var(--radius-container)] border border-slate-200/80 bg-white h-full ui-transition">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/40">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-white border border-slate-100 text-slate-600">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-title">{title}</h3>
            <p className="text-meta mt-0.5 leading-snug">{description}</p>
          </div>
          {headerExtra && <div className="shrink-0 text-right max-w-[50%]">{headerExtra}</div>}
        </div>
      </div>
      <div className="p-4 sm:p-5 flex-1 flex flex-col">{children}</div>
    </div>
  )
}

export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2 shadow-[var(--shadow-card)]">
      {children}
    </div>
  )
}

export function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="h-10 w-10 rounded-[var(--radius-control)] border border-dashed border-slate-200 flex items-center justify-center mb-3">
        <div className="h-1.5 w-1.5 rounded-[2px] bg-slate-300" />
      </div>
      <p className="text-meta font-medium">{label}</p>
    </div>
  )
}
