import React from "react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  size?: "sm" | "md" | "lg"
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
}: EmptyStateProps) {
  const containerSize =
    size === "sm" ? "py-12 px-6" : size === "lg" ? "py-24 px-8" : "py-16 px-6"

  const iconSize =
    size === "sm" ? "w-8 h-8" : size === "lg" ? "w-16 h-16" : "w-12 h-12"

  const titleSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg"

  const descriptionSize =
    size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"

  return (
    <div
      className={`empty-state ${containerSize} rounded-lg border border-dashed border-slate-300 bg-slate-50/50`}
    >
      {icon && (
        <div
          className={`${iconSize} mx-auto mb-4 text-slate-300 flex-shrink-0`}
        >
          {icon}
        </div>
      )}
      <h3 className={`empty-state-title ${titleSize}`}>{title}</h3>
      {description && (
        <p className={`empty-state-text ${descriptionSize} mb-4`}>
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="bg-blue-500 hover:bg-blue-600 text-white transition-all"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function EmptyTable({
  title = "Không có dữ liệu",
  description = "Chưa có dữ liệu để hiển thị. Hãy tạo mới hoặc import dữ liệu.",
  action,
}: {
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <EmptyState
        title={title}
        description={description}
        action={action}
        size="md"
      />
    </div>
  )
}
