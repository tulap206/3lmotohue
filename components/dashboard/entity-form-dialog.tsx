"use client"

import * as React from "react"
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type EntityFormAccent = "red" | "blue" | "amber" | "emerald"

const accentMap: Record<EntityFormAccent, { stripe: string; btn: string }> = {
  red: {
    stripe: "from-rose-400 to-rose-600",
    btn: "bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white [&_svg]:!text-white",
  },
  blue: {
    stripe: "from-blue-400 to-blue-600",
    btn: "bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white [&_svg]:!text-white",
  },
  amber: {
    stripe: "from-amber-400 to-amber-600",
    btn: "bg-amber-600 hover:bg-amber-700 !text-white hover:!text-white [&_svg]:!text-white",
  },
  emerald: {
    stripe: "from-emerald-400 to-emerald-600",
    btn: "bg-emerald-600 hover:bg-emerald-700 !text-white hover:!text-white [&_svg]:!text-white",
  },
}

export const entityFormInputClass =
  "bg-white border-slate-200 rounded-[var(--radius-control)] h-11 text-body"

export const entityFormSelectClass =
  "bg-white border-slate-200 rounded-[var(--radius-control)] h-11 text-body w-full"

export const EntityFormDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  {
    accent?: EntityFormAccent
    className?: string
    children: React.ReactNode
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
  } & Omit<React.ComponentPropsWithoutRef<typeof DialogContent>, "children">
>(function EntityFormDialogContent(
  { accent = "red", className, children, maxWidth = "xl", ...props },
  ref
) {
  const maxW =
    maxWidth === "sm"
      ? "max-w-sm"
      : maxWidth === "md"
        ? "max-w-md"
        : maxWidth === "lg"
          ? "max-w-lg"
          : maxWidth === "2xl"
            ? "max-w-2xl"
            : maxWidth === "3xl"
              ? "max-w-3xl"
              : "max-w-xl"

  return (
    <DialogContent
      ref={ref}
      {...props}
      className={cn(
        "w-[calc(100vw-1rem)] sm:w-full flex flex-col border-slate-200 rounded-[var(--radius-container)] bg-white p-0 gap-0",
        "max-h-[min(94dvh,calc(100dvh-0.75rem))] sm:max-h-[min(90dvh,calc(100dvh-1.25rem))]",
        "overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
        maxW,
        className
      )}
    >
      <div className={cn("sticky top-0 inset-x-0 z-30 h-1 shrink-0 bg-gradient-to-r", accentMap[accent].stripe)} />
      <div className="p-3.5 pt-4 sm:p-6 sm:pt-6">
        {children}
      </div>
    </DialogContent>
  )
})
EntityFormDialogContent.displayName = "EntityFormDialogContent"

export function EntityFormHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <DialogHeader className="mb-3.5 sm:mb-5 text-left">
      <DialogTitle className="text-title text-pretty pr-8">{title}</DialogTitle>
      <DialogDescription className="text-meta text-pretty">{description}</DialogDescription>
    </DialogHeader>
  )
}

export function EntityFormBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-4 sm:space-y-5", className)}>{children}</div>
}

export function EntityFormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-50/60 p-3 sm:p-4 rounded-[var(--radius-container)] border border-slate-100 space-y-3 sm:space-y-4">
      <div className="border-b border-slate-100 pb-2">
        <h3 className="text-title">{title}</h3>
        {description && <p className="text-meta mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function EntityFormToggle({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (val: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex gap-1.5 p-1 bg-slate-100 rounded-[var(--radius-control)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 min-h-11 py-2 text-body font-semibold rounded-[calc(var(--radius-control)-2px)] ui-transition",
            value === opt.value
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function EntityFormField({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-label">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </p>
      {hint && <p className="text-meta">{hint}</p>}
      {children}
    </div>
  )
}

export function EntityFormInfoBox({
  children,
  variant = "blue",
}: {
  children: React.ReactNode
  variant?: "blue" | "green" | "amber"
}) {
  const styles =
    variant === "green"
      ? "bg-green-50 border-green-100 text-green-800"
      : variant === "amber"
        ? "bg-amber-50 border-amber-100 text-amber-800"
        : "bg-blue-50 border-blue-100 text-blue-800"

  return (
    <div className={cn("border rounded-lg p-2.5 text-sm", styles)}>{children}</div>
  )
}

export function EntityFormTip({
  title,
  items,
  variant = "green",
}: {
  title: string
  items: string[]
  variant?: "green" | "blue" | "amber"
}) {
  const styles =
    variant === "blue"
      ? "bg-blue-50 border-blue-100 text-blue-800"
      : variant === "amber"
        ? "bg-amber-50 border-amber-100 text-amber-800"
        : "bg-green-50 border-green-100 text-green-800"

  return (
    <div className={cn("border rounded-lg p-3 text-sm", styles)}>
      <p className="font-semibold mb-1">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function EntityFormFooter({
  onCancel,
  submitLabel,
  cancelLabel = "Hủy",
  accent = "red",
  loading,
  disabled,
}: {
  onCancel: () => void
  submitLabel: string
  cancelLabel?: string
  accent?: EntityFormAccent
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <DialogFooter className="sticky bottom-0 z-20 -mx-3.5 sm:-mx-6 mt-6 px-3.5 sm:px-6 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-md flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} className="h-11 w-full sm:w-auto rounded-[var(--radius-control)] border-slate-200">
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={loading || disabled}
        className={cn("h-11 w-full sm:w-auto rounded-[var(--radius-control)] font-semibold", accentMap[accent].btn)}
      >
        {loading ? "Đang xử lý..." : submitLabel}
      </Button>
    </DialogFooter>
  )
}
