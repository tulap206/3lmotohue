"use client"

import {
  ModuleKpiCard,
  moduleTableHeadClass,
  moduleFilterInputClass,
} from "@/components/dashboard/module-shell"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const rentalTableHeadClass = moduleTableHeadClass
export const rentalFilterInputClass = moduleFilterInputClass

import {
  Car,
  Users,
  ClipboardList,
  Calendar,
  Wallet,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Percent,
  CheckCircle2,
  Lock,
  PlusCircle,
  HelpCircle
} from "lucide-react"

function getWatermarkIcon(label: string) {
  const lowercase = label.toLowerCase()
  if (lowercase.includes("xe")) return Car
  if (lowercase.includes("khách") || lowercase.includes("người")) return Users
  if (lowercase.includes("đơn") || lowercase.includes("hợp đồng")) return ClipboardList
  if (lowercase.includes("tháng") || lowercase.includes("kỳ") || lowercase.includes("hạn")) return Calendar
  if (lowercase.includes("doanh thu") || lowercase.includes("vốn") || lowercase.includes("két") || lowercase.includes("tiền")) return Wallet
  if (lowercase.includes("lợi nhuận") || lowercase.includes("lãi")) return TrendingUp
  if (lowercase.includes("góp") || lowercase.includes("nợ")) return DollarSign
  if (lowercase.includes("quá hạn") || lowercase.includes("cảnh báo")) return AlertTriangle
  if (lowercase.includes("sao lưu") || lowercase.includes("khôi phục")) return RotateCcw
  if (lowercase.includes("phần trăm") || lowercase.includes("lãi suất")) return Percent
  if (lowercase.includes("hoàn thành") || lowercase.includes("đã chốt")) return CheckCircle2
  if (lowercase.includes("khóa") || lowercase.includes("bảo mật")) return Lock
  if (lowercase.includes("thêm")) return PlusCircle
  return HelpCircle
}

export function RentalKpiCard({
  label,
  value,
  sublabel,
  valueClassName,
  onClick,
  variant,
  icon,
  iconColor,
  delay,
  accent = "blue",
}: React.ComponentProps<typeof ModuleKpiCard>) {
  const WatermarkIcon = getWatermarkIcon(label)

  if (variant === "hero") {
    return (
      <ModuleKpiCard
        accent={accent}
        label={label}
        value={value}
        sublabel={sublabel}
        valueClassName={valueClassName}
        onClick={onClick}
        variant="hero"
        icon={icon}
        iconColor={iconColor}
        delay={delay}
      />
    )
  }

  const hoverBorderColor = accent === "blue"
    ? "hover:!border-blue-400 hover:!shadow-[0_4px_20px_rgba(37,99,235,0.15)]"
    : "hover:!border-red-400 hover:!shadow-[0_4px_20px_rgba(220,38,38,0.15)]"

  return (
    <Card
      className={cn(
        "module-card rounded-xl border border-slate-100 bg-white select-none transition-all duration-300 py-2 px-3.5 min-h-[3.3rem] flex flex-col justify-center relative overflow-hidden group",
        onClick ? "cursor-pointer" : "",
        "hover:translate-y-[-3px] hover:scale-[1.01]",
        hoverBorderColor
      )}
      onClick={onClick}
    >
      <div className={cn(
        "absolute right-[-10px] bottom-[-10px] select-none pointer-events-none opacity-[0.045] transition-transform duration-500 group-hover:scale-110",
        accent === "blue" ? "text-blue-600" :
        accent === "emerald" ? "text-emerald-600" :
        accent === "amber" ? "text-amber-600" : "text-red-600"
      )}>
        <WatermarkIcon className="w-16 h-16 stroke-[1.5]" />
      </div>
      <div className="flex flex-col justify-between h-full relative z-10">
        <div className="flex items-baseline justify-between gap-1.5">
          <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
          {sublabel && <p className="text-[10px] text-slate-400 font-medium truncate max-w-[50%]">{sublabel}</p>}
        </div>
        <p className={cn("text-2xl font-black text-slate-900 mt-1.5 leading-none tabular-nums", valueClassName)}>
          {value}
        </p>
      </div>
    </Card>
  )
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
      return "bg-blue-50 text-blue-700 border-blue-100"
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
      return "bg-blue-50 text-blue-700 border-blue-100"
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
      return "bg-blue-50 text-blue-700 border-blue-100"
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-100"
    case "cancelled":
      return "bg-slate-100 text-slate-500 border-slate-200"
    default:
      return "bg-slate-100 text-slate-500 border-slate-200"
  }
}
