"use client"

import {
  ModuleKpiCard,
  moduleTableHeadClass,
  moduleFilterInputClass,
} from "@/components/dashboard/module-shell"

export const rentalTableHeadClass = moduleTableHeadClass
export const rentalFilterInputClass = moduleFilterInputClass

export function RentalKpiCard(
  props: Omit<React.ComponentProps<typeof ModuleKpiCard>, "accent">
) {
  return <ModuleKpiCard accent="red" {...props} />
}

const RENTAL_TX_TYPE_LABELS: Record<string, string> = {
  income: "Thu",
  expense: "Chi",
}

export function getRentalTransactionTypeLabel(type: string): string {
  return RENTAL_TX_TYPE_LABELS[type] ?? type
}

export function getRentalVehicleStatusLabel(status?: string): string {
  switch (status) {
    case "available":
      return "Sẵn sàng"
    case "rented":
      return "Đang thuê"
    case "maintenance":
      return "Bảo trì"
    default:
      return status || "—"
  }
}

export function rentalVehicleStatusBadgeClass(status?: string): string {
  switch (status) {
    case "available":
      return "bg-emerald-50 text-emerald-700 border-emerald-100"
    case "rented":
      return "bg-blue-50 text-blue-700 border-red-100"
    case "maintenance":
      return "bg-amber-50 text-amber-700 border-amber-100"
    default:
      return "bg-slate-100 text-slate-500 border-slate-200"
  }
}

export function getRentalCustomerStatusLabel(status?: string): string {
  switch (status) {
    case "renting":
      return "Đang thuê"
    case "pending":
      return "Chờ giao xe"
    case "inactive":
      return "Ngừng hoạt động"
    default:
      return "Sẵn sàng"
  }
}

export function rentalCustomerStatusBadgeClass(status?: string): string {
  switch (status) {
    case "renting":
      return "bg-blue-50 text-blue-700 border-red-100"
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-100"
    case "inactive":
      return "bg-slate-100 text-slate-500 border-slate-200"
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-100"
  }
}

export function getRentalOrderStatusLabel(status?: string, isOverdue?: boolean): string {
  if (isOverdue) return "Quá hạn"
  switch (status) {
    case "pending":
      return "Chờ giao xe"
    case "active":
      return "Đang thuê"
    case "completed":
      return "Hoàn thành"
    case "cancelled":
      return "Đã hủy"
    default:
      return status || "—"
  }
}

export function rentalOrderStatusBadgeClass(status?: string, isOverdue?: boolean): string {
  if (isOverdue) return "bg-orange-50 text-orange-700 border-orange-100"
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-100"
    case "active":
      return "bg-blue-50 text-blue-700 border-red-100"
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-100"
    case "cancelled":
      return "bg-slate-100 text-slate-500 border-slate-200"
    default:
      return "bg-slate-100 text-slate-500 border-slate-200"
  }
}
