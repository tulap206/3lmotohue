"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type ModuleAccent,
  type ModuleId,
  ACCENT_BTN_CLASS,
  ACCENT_TITLE_CLASS,
  getModuleTheme,
} from "@/lib/module-theme"

export const moduleTableHeadClass =
  "py-3 px-4 text-sm font-semibold text-slate-500 uppercase tracking-wide"

export const moduleTableBodyClass = "text-sm text-slate-700"

export const moduleBadgeClass =
  "inline-flex items-center justify-center text-sm font-semibold px-2.5 py-0.5 rounded-md border whitespace-nowrap"

export const moduleFilterInputClass = "h-9 bg-white border-slate-200 text-sm rounded-xl"

/** Page wrapper — spacing only; padding comes from dashboard sidebar main. */
export function ModulePageShell({
  module,
  children,
  className,
}: {
  module: ModuleId
  children: React.ReactNode
  className?: string
}) {
  const theme = getModuleTheme(module)
  return (
    <div className={cn(theme.adminClass, "space-y-6 w-full", className)}>{children}</div>
  )
}

/** Full brand header for module overview pages. */
export function ModuleBrandHeader({
  module,
  subtitle,
  actions,
  sticky = false,
  badge,
}: {
  module: ModuleId
  subtitle: string
  actions?: React.ReactNode
  sticky?: boolean
  badge?: React.ReactNode
}) {
  const theme = getModuleTheme(module)
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5",
        sticky &&
          "sticky top-0 z-30 -mx-4 px-4 lg:-mx-8 lg:px-8 py-4 bg-slate-50/95 backdrop-blur-md"
      )}
    >
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-800 italic uppercase">
          QUẢN TRỊ{" "}
          <span className={ACCENT_TITLE_CLASS[theme.accent]}>{theme.titleSuffix}</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
      </div>
      {(actions || badge) && (
        <div className="flex flex-wrap items-center gap-2">
          {badge}
          {actions}
        </div>
      )}
    </div>
  )
}

/** Sub-page header for rental routes and inner sections. */
export function ModuleSubpageHeader({
  module,
  title,
  subtitle,
  actions,
  sticky = false,
  breadcrumbs,
}: {
  module: ModuleId
  title: string
  subtitle?: string
  actions?: React.ReactNode
  sticky?: boolean
  breadcrumbs?: { label: string; href?: string }[]
}) {
  const theme = getModuleTheme(module)
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
        sticky &&
          "sticky top-0 z-30 -mx-4 px-4 lg:-mx-8 lg:px-8 py-4 bg-slate-50/95 backdrop-blur-md border-b border-slate-200"
      )}
    >
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500 mb-1.5">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-300">›</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className={cn("font-medium hover:underline", ACCENT_TITLE_CLASS[theme.accent])}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-700">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold tracking-tight text-slate-800">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

const KPI_BLUE_HOVER =
  "hover:border-blue-400 hover:shadow-[0_4px_20px_rgba(37,99,235,0.15)] hover:-translate-y-[3px] hover:scale-[1.01]"

export function ModuleKpiCard({
  accent = "red",
  label,
  value,
  sublabel,
  valueClassName,
  valueTitle,
  onClick,
  variant = "compact",
  icon,
  iconColor,
  watermark,
  delay = 0,
}: {
  accent?: ModuleAccent
  label: string
  value: React.ReactNode
  sublabel?: React.ReactNode
  valueClassName?: string
  valueTitle?: string
  onClick?: () => void
  variant?: "compact" | "hero"
  icon?: React.ReactNode
  iconColor?: string
  /** Faded content icon rendered inside the card (hero). */
  watermark?: React.ReactNode
  delay?: number
}) {
  if (variant === "hero") {
    const isOverdue = label === "Quá hạn"
    return (
      <>
        {isOverdue && (
          <style>{`
            @keyframes pulse-red-glow-direct {
              0%, 100% {
                border-color: rgba(239, 68, 68, 0.2) !important;
                box-shadow: 0 2px 8px rgba(239, 68, 68, 0.05) !important;
              }
              50% {
                border-color: rgba(239, 68, 68, 0.9) !important;
                box-shadow: 0 0 14px 3px rgba(239, 68, 68, 0.4) !important;
              }
            }
            .animate-pulse-red-glow-direct {
              animation: pulse-red-glow-direct 2s infinite ease-in-out !important;
              border: 1.5px solid rgba(239, 68, 68, 0.2) !important;
            }
          `}</style>
        )}
        <Card
          className={cn(
            "metric-card card-animate module-card group relative bg-white min-w-0 overflow-hidden border border-slate-100/90",
            "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            KPI_BLUE_HOVER,
            onClick && "cursor-pointer",
            isOverdue && "animate-pulse-red-glow-direct"
          )}
          style={{ animationDelay: `${delay * 60}ms` }}
          onClick={onClick}
        >
          {watermark && (
            <div
              className="absolute right-[-10px] bottom-[-12px] select-none pointer-events-none text-blue-600 opacity-[0.07] transition-all duration-500 group-hover:opacity-[0.12] group-hover:scale-110"
              aria-hidden
            >
              {watermark}
            </div>
          )}
          <CardContent className="relative z-10 px-4 py-3 flex flex-col justify-between h-full min-h-[5.25rem] space-y-1.5">
            <div className="flex justify-between items-start w-full gap-2">
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-500 leading-tight">{label}</p>
                {sublabel && <p className="text-xs text-slate-400 leading-snug">{sublabel}</p>}
              </div>
              {icon && (
                <div className={cn(iconColor || ACCENT_TITLE_CLASS[accent], "text-sm shrink-0")}>{icon}</div>
              )}
            </div>
            <div
              className={cn(
                "font-extrabold text-slate-800 tracking-tight tabular-nums leading-none min-w-0 whitespace-nowrap",
                "text-base sm:text-lg xl:text-xl",
                valueClassName
              )}
              title={valueTitle}
            >
              {value}
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <Card
      className={cn(
        "module-card group relative rounded-xl border border-slate-100/80 shadow-sm overflow-hidden",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        KPI_BLUE_HOVER,
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {watermark && (
        <div
          className="absolute right-[-10px] bottom-[-10px] select-none pointer-events-none text-blue-600 opacity-[0.07] transition-all duration-500 group-hover:opacity-[0.12] group-hover:scale-110"
          aria-hidden
        >
          {watermark}
        </div>
      )}
      <CardContent className="relative z-10 p-4">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={cn("text-xl font-extrabold text-slate-900 mt-1 tabular-nums", valueClassName)}>{value}</p>
        {sublabel && <p className="text-sm text-slate-500 mt-0.5">{sublabel}</p>}
      </CardContent>
    </Card>
  )
}

export function ModuleSectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
        {description && <p className="text-sm text-slate-700 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ModuleSectionCard({
  title,
  description,
  filters,
  badge,
  children,
  className,
}: {
  title: string
  description?: string
  filters?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("module-card rounded-xl border-slate-100/80 shadow-sm overflow-hidden", className)}>
      <CardHeader className="py-4 px-4 border-b border-slate-100 bg-slate-50/40">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">{title}</CardTitle>
              {description && (
                <CardDescription className="text-sm text-slate-500 mt-0.5">{description}</CardDescription>
              )}
            </div>
            {badge}
          </div>
          {filters}
        </div>
      </CardHeader>
      {children}
    </Card>
  )
}

export function ModulePrimaryButton({
  accent = "red",
  className,
  ...props
}: React.ComponentProps<"button"> & { accent?: ModuleAccent }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-xl text-sm font-semibold shadow-sm h-9 px-4 transition-colors",
        ACCENT_BTN_CLASS[accent],
        className
      )}
      {...props}
    />
  )
}

export function ModuleTableWrap({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>
}

export function ModuleTableHeadRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">{children}</tr>
  )
}

export function ModuleTableEmptyRow({
  colSpan,
  message = "Không có dữ liệu",
}: {
  colSpan: number
  message?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-slate-400 text-sm">
        {message}
      </td>
    </tr>
  )
}

/** Desktop table + mobile card list split at md breakpoint. */
export function ModuleResponsiveTable({
  desktop,
  mobile,
}: {
  desktop: React.ReactNode
  mobile: React.ReactNode
}) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">{desktop}</div>
      <div className="md:hidden divide-y divide-slate-100">{mobile}</div>
    </>
  )
}

/** Single row in mobile card list — accent left border on hover via .module-table-row */
export function ModuleMobileCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("module-table-row px-4 py-3 space-y-2", className)}>{children}</div>
  )
}

function buildPaginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | "ellipsis")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("ellipsis")
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push("ellipsis")
  pages.push(total)
  return pages
}

/** Numbered pagination footer for module list tables. */
export function ModulePagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  itemLabel,
  className,
}: {
  page: number
  totalPages: number
  totalItems?: number
  onPageChange: (page: number) => void
  itemLabel?: string
  className?: string
}) {
  if (totalPages <= 1) return null

  const safePage = Math.min(Math.max(1, page), totalPages)
  const pages = buildPaginationPages(safePage, totalPages)

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-slate-100 bg-white",
        className
      )}
    >
      <div className="text-sm text-slate-500 font-medium hidden sm:block">
        Trang <span className="font-bold text-slate-700">{safePage}</span>
        {" / "}
        <span className="font-bold text-slate-700">{totalPages}</span>
        {typeof totalItems === "number" && (
          <>
            {" "}
            (Tổng {totalItems}
            {itemLabel ? ` ${itemLabel}` : ""})
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 ml-auto sm:ml-0 flex-wrap justify-end">
        <Button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          variant="outline"
          size="sm"
          className="h-8 text-sm border-slate-200 rounded-xl px-2.5 font-bold hover:bg-slate-50 text-slate-600"
        >
          Trước
        </Button>
        <div className="flex items-center gap-1">
          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <span key={`e-${idx}`} className="text-slate-400 text-sm px-1 select-none">
                …
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                variant={safePage === p ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 w-8 text-sm rounded-xl font-bold transition-all",
                  safePage === p
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {p}
              </Button>
            )
          )}
        </div>
        <Button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          variant="outline"
          size="sm"
          className="h-8 text-sm border-slate-200 rounded-xl px-2.5 font-bold hover:bg-slate-50 text-slate-600"
        >
          Tiếp
        </Button>
      </div>
    </div>
  )
}
