"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  "py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide"

export const moduleTableBodyClass = "text-sm text-slate-700"

export const moduleBadgeClass =
  "inline-flex items-center justify-center text-xs font-semibold px-2.5 py-0.5 rounded-md border whitespace-nowrap"

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
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1.5">
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
  delay = 0,
}: {
  accent?: ModuleAccent
  label: string
  value: React.ReactNode
  sublabel?: string
  valueClassName?: string
  valueTitle?: string
  onClick?: () => void
  variant?: "compact" | "hero"
  icon?: React.ReactNode
  iconColor?: string
  delay?: number
}) {
  if (variant === "hero") {
    return (
      <Card
        className={cn(
          "metric-card card-animate module-card bg-white min-w-0 overflow-hidden",
          onClick && ["cursor-pointer", ACCENT_KPI_HOVER_CLASS[accent]]
        )}
        style={{ animationDelay: `${delay * 60}ms` }}
        onClick={onClick}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 px-3.5 pt-3.5 pb-1 sm:px-4 sm:pt-4">
          <div className="space-y-0.5 min-w-0 flex-1 min-h-[2.25rem]">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-600 leading-snug truncate">{label}</p>
            {sublabel && <p className="text-[10px] sm:text-xs text-slate-500 truncate">{sublabel}</p>}
          </div>
          {icon && <div className={cn(iconColor || ACCENT_TITLE_CLASS[accent], "text-lg shrink-0 ml-1")}>{icon}</div>}
        </CardHeader>
        <CardContent className="px-3.5 pb-3.5 pt-0.5 sm:px-4 sm:pb-4">
          <div
            className={cn(
              "font-extrabold text-slate-900 tracking-tight tabular-nums leading-tight min-w-0 break-all",
              "text-sm sm:text-base xl:text-lg",
              valueClassName
            )}
            title={valueTitle}
          >
            {value}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "module-card rounded-xl border-slate-100/80 shadow-sm transition-shadow duration-200",
        onClick && ["cursor-pointer hover:shadow-md", ACCENT_KPI_HOVER_CLASS[accent]]
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={cn("text-xl font-extrabold text-slate-900 mt-1 tabular-nums", valueClassName)}>{value}</p>
        {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
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
                <CardDescription className="text-xs text-slate-500 mt-0.5">{description}</CardDescription>
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
