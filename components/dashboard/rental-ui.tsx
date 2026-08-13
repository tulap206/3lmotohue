"use client"

import {
  ModuleKpiCard,
  moduleTableHeadClass,
  moduleFilterInputClass,
} from "@/components/dashboard/module-shell"

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
  HelpCircle,
  Wrench,
  Clock,
  Ban,
  Gauge,
  Bike,
  UserX,
  type LucideIcon,
} from "lucide-react"

function getWatermarkIcon(label: string): LucideIcon {
  const lowercase = label.toLowerCase()
  if (lowercase.includes("bảo trì") || lowercase.includes("mốc")) return Wrench
  if (lowercase.includes("cần gấp") || lowercase.includes("cảnh báo") || lowercase.includes("quá hạn")) {
    return lowercase.includes("km") ? Gauge : AlertTriangle
  }
  if (lowercase.includes("km")) return Gauge
  if (lowercase.includes("sẵn sàng")) return CheckCircle2
  if (lowercase.includes("chờ giao")) return Clock
  if (lowercase.includes("ngừng") || lowercase.includes("không giao dịch")) return UserX
  if (lowercase.includes("lấp đầy") || lowercase.includes("tỷ lệ")) return Percent
  if (lowercase.includes("đang thuê")) return Car
  if (lowercase.includes("xe") || lowercase.includes("đội")) return Bike
  if (lowercase.includes("khách") || lowercase.includes("người")) return Users
  if (lowercase.includes("đơn") || lowercase.includes("hợp đồng")) return ClipboardList
  if (lowercase.includes("tháng") || lowercase.includes("kỳ")) return Calendar
  if (
    lowercase.includes("doanh thu") ||
    lowercase.includes("vốn") ||
    lowercase.includes("két") ||
    lowercase.includes("tiền")
  ) {
    return Wallet
  }
  if (lowercase.includes("lợi nhuận") || lowercase.includes("lãi")) return TrendingUp
  if (lowercase.includes("góp") || lowercase.includes("nợ")) return DollarSign
  if (lowercase.includes("sao lưu") || lowercase.includes("khôi phục")) return RotateCcw
  if (lowercase.includes("hoàn thành") || lowercase.includes("đã chốt")) return CheckCircle2
  if (lowercase.includes("khóa") || lowercase.includes("bảo mật")) return Lock
  if (lowercase.includes("thêm")) return PlusCircle
  if (lowercase.includes("hủy") || lowercase.includes("inactive")) return Ban
  return HelpCircle
}

export function RentalKpiCard({
  label,
  value,
  sublabel,
  valueClassName,
  valueTitle,
  onClick,
  selected,
  variant = "hero",
  icon,
  iconColor,
  delay,
  accent = "blue",
}: React.ComponentProps<typeof ModuleKpiCard>) {
  const WatermarkIcon = getWatermarkIcon(label)
  const watermark = <WatermarkIcon className="w-[4.5rem] h-[4.5rem] stroke-[1.25]" />

  return (
    <ModuleKpiCard
      accent={accent}
      label={label}
      value={value}
      sublabel={sublabel}
      valueClassName={valueClassName}
      valueTitle={valueTitle}
      onClick={onClick}
      selected={selected}
      variant={variant}
      icon={icon}
      iconColor={iconColor}
      watermark={watermark}
      delay={delay}
    />
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
  if (isOverdue) return "bg-rose-50 text-rose-700 border-rose-100"
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
