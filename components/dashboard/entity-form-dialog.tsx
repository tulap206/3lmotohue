"use client"

import * as React from "react"
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type EntityFormAccent = "red" | "blue" | "amber" | "emerald"

const accentMap: Record<EntityFormAccent, { stripe: string; btn: string }> = {
  red: {
    stripe: "from-red-400 to-red-600",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  blue: {
    stripe: "from-blue-400 to-blue-600",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  amber: {
    stripe: "from-amber-400 to-amber-600",
    btn: "bg-amber-500 hover:bg-amber-600 text-slate-950",
  },
  emerald: {
    stripe: "from-emerald-400 to-emerald-600",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
}

export const entityFormInputClass =
  "bg-white border-gray-200 rounded-xl h-9 text-sm"

export const entityFormSelectClass =
  "bg-white border-gray-200 rounded-xl h-9 text-sm w-full"

export const EntityFormDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  {
    accent?: EntityFormAccent
    className?: string
    children: React.ReactNode
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
  }
>(function EntityFormDialogContent(
  { accent = "red", className, children, maxWidth = "xl" },
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
      className={cn(
        "border-gray-200 rounded-2xl max-h-[90vh] overflow-y-auto bg-white p-0 gap-0",
        maxW,
        className
      )}
    >
      <div className="relative">
        <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", accentMap[accent].stripe)} />
        <div className="p-6 pt-7">{children}</div>
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
    <DialogHeader className="mb-5">
      <DialogTitle className="text-gray-800 text-lg font-bold tracking-tight">{title}</DialogTitle>
      <DialogDescription className="text-gray-500 text-sm">{description}</DialogDescription>
    </DialogHeader>
  )
}

export function EntityFormBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-5", className)}>{children}</div>
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
    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
      <div className="border-b border-slate-100 pb-2">
        <h3 className="font-bold text-slate-800 text-base">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
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
    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all",
            value === opt.value
              ? "bg-white shadow text-slate-800"
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
    <div className="space-y-1">
      <label className="text-gray-600 text-sm font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {hint && <p className="text-sm text-slate-400">{hint}</p>}
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
    <DialogFooter className="flex justify-end gap-2 pt-4 mt-6 border-t border-gray-100 sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl border-gray-200">
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={loading || disabled}
        className={cn("rounded-xl font-semibold", accentMap[accent].btn)}
      >
        {loading ? "Đang xử lý..." : submitLabel}
      </Button>
    </DialogFooter>
  )
}
