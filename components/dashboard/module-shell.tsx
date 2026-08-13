"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type ModuleAccent,
  type ModuleId,
  ACCENT_BTN_CLASS,
  ACCENT_KPI_HOVER_CLASS,
  ACCENT_TITLE_CLASS,
  getModuleTheme,
} from "@/lib/module-theme"

export const moduleTableHeadClass =
  "py-3 px-4 text-label uppercase tracking-wide"

export const moduleTableBodyClass = "text-body"

export const moduleBadgeClass =
  "inline-flex items-center justify-center text-label font-semibold px-2.5 py-0.5 rounded-[var(--radius-badge)] border whitespace-nowrap"

export const moduleFilterInputClass =
  "h-11 min-h-11 bg-white border-slate-200 text-body rounded-[var(--radius-control)]"

export const moduleFormLabelClass = "text-label"

export const moduleFormInputClass =
  "h-11 bg-white border-slate-200 text-body rounded-[var(--radius-control)] focus-visible:ring-blue-500/20 focus-visible:border-blue-500"

export const moduleDialogContentClass =
  "bg-white border-slate-200 rounded-[var(--radius-container)]"

export const moduleDestructiveBtnClass =
  "bg-rose-600 text-white hover:bg-rose-700 rounded-[var(--radius-control)]"

export const moduleSoftDeleteBtnClass =
  "h-7 w-7 p-0 border-rose-200 rounded-lg hover:bg-rose-50 text-rose-500"

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
    <div className={cn(theme.adminClass, "space-y-4 md:space-y-6 w-full max-w-[1400px] min-w-0", className)}>{children}</div>
  )
}

/** Full brand header for module overview pages. */
export function ModuleBrandHeader({
  module,
  subtitle,
  actions,
  sticky = false,
  badge,
  title,
}: {
  module: ModuleId
  subtitle: string
  actions?: React.ReactNode
  sticky?: boolean
  badge?: React.ReactNode
  title?: ReactNode
}) {
  const theme = getModuleTheme(module)
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/80 pb-5",
        sticky &&
          "sticky top-0 z-30 -mx-4 px-4 lg:-mx-8 lg:px-8 py-4 bg-slate-50/95 backdrop-blur-md"
      )}
    >
      <div className="min-w-0">
        <h1 className="text-display">
          {title ?? (
            <>
              Tổng quan{" "}
              <span className={cn("font-semibold", ACCENT_TITLE_CLASS[theme.accent])}>
                {theme.titleSuffix}
              </span>
            </>
          )}
        </h1>
        <p className="text-meta mt-1.5">{subtitle}</p>
      </div>
      {(actions || badge) && (
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto [&>*]:w-full sm:[&>*]:w-auto">
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
          <nav className="flex flex-wrap items-center gap-1.5 text-meta mb-1.5">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-300">›</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className={cn("font-medium hover:underline ui-transition", ACCENT_TITLE_CLASS[theme.accent])}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-700">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-title">{title}</h1>
        {subtitle && <p className="text-meta mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </div>
  )
}

export function ModuleSectionTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-label uppercase tracking-wider">{title}</h2>
        {description && <p className="text-meta mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** @deprecated Use ModuleSectionTitle */
export function ModuleSectionHeading(props: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return <ModuleSectionTitle {...props} />
}

export function ModuleKpiCard({
  accent = "blue",
  label,
  value,
  sublabel,
  valueClassName,
  valueTitle,
  onClick,
  selected = false,
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
  selected?: boolean
  variant?: "compact" | "hero"
  icon?: React.ReactNode
  iconColor?: string
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
                border-color: rgba(225, 29, 72, 0.2) !important;
                box-shadow: 0 2px 8px rgba(225, 29, 72, 0.05) !important;
              }
              50% {
                border-color: rgba(225, 29, 72, 0.85) !important;
                box-shadow: 0 0 12px 2px rgba(225, 29, 72, 0.28) !important;
              }
            }
            .animate-pulse-red-glow-direct {
              animation: pulse-red-glow-direct 2s infinite ease-in-out !important;
              border: 1.5px solid rgba(225, 29, 72, 0.2) !important;
            }
          `}</style>
        )}
        <Card
          className={cn(
            "metric-card card-animate module-card group relative bg-white min-w-0 overflow-hidden border border-slate-100/90 rounded-[var(--radius-container)]",
            "ui-transition",
            ACCENT_KPI_HOVER_CLASS[accent],
            onClick && "cursor-pointer",
            selected && "ring-2 ring-blue-500/35 border-blue-200",
            isOverdue && "animate-pulse-red-glow-direct"
          )}
          style={{ animationDelay: `${delay * 60}ms` }}
          onClick={onClick}
          aria-pressed={onClick ? selected : undefined}
        >
          {watermark && (
            <div
              className="absolute right-[-10px] bottom-[-12px] select-none pointer-events-none text-blue-600 opacity-[0.07] ui-transition group-hover:opacity-[0.12] group-hover:scale-105"
              aria-hidden
            >
              {watermark}
            </div>
          )}
          <CardContent className="relative z-10 px-4 py-3.5 flex flex-col justify-between h-full min-h-[5.5rem] space-y-1.5">
            <div className="flex justify-between items-start w-full gap-2">
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-label leading-tight">{label}</p>
                {sublabel && <p className="text-meta leading-snug">{sublabel}</p>}
              </div>
              {icon && (
                <div className={cn(iconColor || ACCENT_TITLE_CLASS[accent], "text-sm shrink-0")}>{icon}</div>
              )}
            </div>
            <div
              className={cn(
                "font-semibold text-slate-800 tracking-tight money leading-none min-w-0 whitespace-nowrap",
                "text-[1.05rem] sm:text-lg xl:text-xl",
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
        "module-card group relative rounded-[var(--radius-container)] border border-slate-100/80 overflow-hidden",
        "ui-transition",
        ACCENT_KPI_HOVER_CLASS[accent],
        onClick && "cursor-pointer",
        selected && "ring-2 ring-blue-500/35 border-blue-200"
      )}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
    >
      {watermark && (
        <div
          className="absolute right-[-10px] bottom-[-10px] select-none pointer-events-none text-blue-600 opacity-[0.07] ui-transition group-hover:opacity-[0.12]"
          aria-hidden
        >
          {watermark}
        </div>
      )}
      <CardContent className="relative z-10 p-4">
        <p className="text-label uppercase tracking-wide">{label}</p>
        <p className={cn("text-xl font-semibold text-slate-900 mt-1 money", valueClassName)}>{value}</p>
        {sublabel && <p className="text-meta mt-0.5">{sublabel}</p>}
      </CardContent>
    </Card>
  )
}

/** Horizontal KPI strip with snap scroll on small screens. */
export function ModuleKpiGrid({
  children,
  columns = 5,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 5 | 6
  className?: string
}) {
  const colClass =
    columns === 6
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      : columns === 5
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        : columns === 4
          ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-4"
          : columns === 3
            ? "grid-cols-2 md:grid-cols-3"
            : "grid-cols-2"
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        colClass,
        className
      )}
    >
      {children}
    </div>
  )
}

export function ModuleToolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 w-full",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ModuleEmptyState({
  title = "Chưa có dữ liệu",
  description,
  action,
  className,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-4", className)}>
      <p className="text-title text-slate-600">{title}</p>
      {description && <p className="text-meta mt-2 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
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
    <Card className={cn("module-card rounded-[var(--radius-container)] border-slate-100/80 overflow-hidden", className)}>
      <CardHeader className="py-4 px-4 sm:px-5 border-b border-slate-100 bg-slate-50/40">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div>
              <CardTitle className="text-title">{title}</CardTitle>
              {description && (
                <CardDescription className="text-meta mt-0.5">{description}</CardDescription>
              )}
            </div>
            {badge}
          </div>
          {filters && <div className="w-full min-w-0 lg:w-auto">{filters}</div>}
        </div>
      </CardHeader>
      {children}
    </Card>
  )
}

export function ModulePrimaryButton({
  accent = "blue",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { accent?: ModuleAccent }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] text-body font-semibold shadow-sm h-11 px-4 ui-transition [&_svg]:!text-white",
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
      <td colSpan={colSpan} className="py-12 text-center text-meta">
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

export function ModuleMobileCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("module-table-row px-4 py-4 space-y-2.5", className)}>{children}</div>
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
      <div className="text-meta font-medium hidden sm:block">
        Trang <span className="font-semibold text-slate-700 money">{safePage}</span>
        {" / "}
        <span className="font-semibold text-slate-700 money">{totalPages}</span>
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
          className="h-11 min-w-11 text-label border-slate-200 rounded-[var(--radius-control)] px-3 font-semibold hover:bg-slate-50 text-slate-600"
        >
          Trước
        </Button>
        <div className="flex items-center gap-1">
          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <span key={`e-${idx}`} className="text-slate-400 text-meta px-1 select-none">
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
                  "h-11 w-11 text-label rounded-[var(--radius-control)] font-semibold ui-transition",
                  safePage === p
                    ? "bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white border-transparent"
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
          className="h-11 min-w-11 text-label border-slate-200 rounded-[var(--radius-control)] px-3 font-semibold hover:bg-slate-50 text-slate-600"
        >
          Tiếp
        </Button>
      </div>
    </div>
  )
}
