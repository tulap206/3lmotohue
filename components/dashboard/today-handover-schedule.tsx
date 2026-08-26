"use client"

import React, { useState, useMemo } from "react"
import { Rental, Vehicle, Customer } from "@/lib/supabase"
import { extractRentalTimes } from "@/lib/vehicle-timeline"
import {
  Bike,
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
  MapPin,
  Sparkles,
  ChevronRight,
  KeyRound,
  CornerDownLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TodayHandoverScheduleProps {
  orders: Rental[]
  vehicles: Vehicle[]
  customers: Customer[]
  onDeliverOrder?: (order: Rental) => void
  onCompleteOrder?: (order: Rental) => void
  onSelectOrder?: (order: Rental) => void
  className?: string
}

export function TodayHandoverSchedule({
  orders,
  vehicles,
  customers,
  onDeliverOrder,
  onCompleteOrder,
  onSelectOrder,
  className,
}: TodayHandoverScheduleProps) {
  const [activeTab, setActiveTab] = useState<"all" | "deliveries" | "returns">("all")

  const todayVN = useMemo(() => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  }, [])

  const todayDisplay = useMemo(() => {
    const d = new Date()
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]
    return `${days[d.getDay()]}, ${todayVN}`
  }, [todayVN])

  // 1. Lọc danh sách giao xe hôm nay
  const todayDeliveries = useMemo(() => {
    const list = orders.filter((o) => o.status === "pending" && o.startDate === todayVN)
    return list.map((order) => {
      const times = extractRentalTimes(order.notes)
      const customer = customers.find((c) => c.id === order.customerId)
      const vehicle = vehicles.find((v) => v.id === order.vehicleId)
      return {
        order,
        times,
        customer,
        vehicle,
        pickupTime: times.pickupTime || "08:00",
      }
    }).sort((a, b) => a.pickupTime.localeCompare(b.pickupTime))
  }, [orders, todayVN, customers, vehicles])

  // 2. Lọc danh sách thu hồi xe hôm nay
  const todayReturns = useMemo(() => {
    const list = orders.filter((o) => {
      if (o.status !== "active") return false
      if (!o.endDate) return false
      return o.endDate === todayVN
    })

    return list.map((order) => {
      const times = extractRentalTimes(order.notes)
      const customer = customers.find((c) => c.id === order.customerId)
      const vehicle = vehicles.find((v) => v.id === order.vehicleId)
      return {
        order,
        times,
        customer,
        vehicle,
        returnTime: times.returnTime || "12:00",
      }
    }).sort((a, b) => a.returnTime.localeCompare(b.returnTime))
  }, [orders, todayVN, customers, vehicles])

  const totalCount = todayDeliveries.length + todayReturns.length

  if (totalCount === 0) {
    return null
  }

  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-400 border border-white/15 shadow-sm shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                  Lịch trình trong ngày
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/20 text-[10px] font-semibold font-mono">
                  {todayDisplay}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Lịch Giao & Thu Hồi Xe Hôm Nay
              </h3>
            </div>
          </div>

          {/* Tab Filter buttons */}
          <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center bg-white/10 p-1 rounded-xl border border-white/15 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg transition text-center",
                activeTab === "all" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-300 hover:text-white"
              )}
            >
              Tất cả ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("deliveries")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 text-center",
                activeTab === "deliveries" ? "bg-emerald-500 text-white shadow-xs font-bold" : "text-emerald-300 hover:text-white"
              )}
            >
              <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">Giao ({todayDeliveries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("returns")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 text-center",
                activeTab === "returns" ? "bg-amber-500 text-white shadow-xs font-bold" : "text-amber-300 hover:text-white"
              )}
            >
              <span className="size-2 rounded-full bg-amber-400 shrink-0" />
              <span className="truncate">Thu ({todayReturns.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Cột GIAO XE */}
          {(activeTab === "all" || activeTab === "deliveries") && (
            <div className={cn("space-y-3", activeTab === "deliveries" && "lg:col-span-2")}>
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Xe Cần Giao Hôm Nay ({todayDeliveries.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">Theo giờ nhận</span>
              </div>

              {todayDeliveries.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Không có đơn nào cần giao hôm nay
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayDeliveries.map(({ order, customer, pickupTime }) => {
                    const phone = (order as any).customerPhone || customer?.phone || ""
                    const cleanPhone = phone.replace(/\D/g, "")
                    const isUnassigned = order.vehicleId === "00000000-0000-0000-0000-000000000000" || order.licensePlate === "CHỜ GÁN XE"

                    return (
                      <div
                        key={order.id}
                        className="bg-slate-50/80 hover:bg-slate-50 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {pickupTime}
                            </span>
                            <span className="font-bold text-slate-900 text-sm flex items-center gap-1 truncate">
                              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">{order.customerName}</span>
                            </span>
                            {phone && (
                              <span className="font-mono text-xs text-slate-600 font-semibold truncate">
                                · {phone}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                            <div className="flex items-center gap-1 truncate">
                              <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800 truncate">{order.vehicleName}</span>
                            </div>
                            {order.licensePlate && (
                              <span
                                onClick={() => isUnassigned && onDeliverOrder?.(order)}
                                className={cn(
                                  "font-mono font-bold px-1.5 py-0.2 rounded text-[11px] shrink-0",
                                  isUnassigned
                                    ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer shadow-2xs transition-colors"
                                    : "bg-blue-50 text-blue-700 border border-blue-100"
                                )}
                                title={isUnassigned ? "Nhấn để gán xe" : undefined}
                              >
                                {order.licensePlate}
                              </span>
                            )}
                            <span className="text-slate-400 shrink-0">· {order.totalDays} ngày</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                          {cleanPhone && (
                            <>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="Gọi điện cho khách"
                                className="size-8 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 flex items-center justify-center transition shadow-2xs"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://zalo.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Nhắn Zalo"
                                className="size-8 rounded-lg bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 flex items-center justify-center transition shadow-2xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          {onDeliverOrder && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onDeliverOrder(order)}
                              className="h-8 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition"
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1" />
                              {isUnassigned ? "Gán xe" : "Giao xe"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cột THU HỒI XE */}
          {(activeTab === "all" || activeTab === "returns") && (
            <div className={cn("space-y-3", activeTab === "returns" && "lg:col-span-2")}>
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Xe Cần Thu Hồi Hôm Nay ({todayReturns.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">Sắp xếp theo giờ trả</span>
              </div>

              {todayReturns.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Không có xe nào cần thu hồi hôm nay
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayReturns.map(({ order, customer, returnTime }) => {
                    const phone = (order as any).customerPhone || customer?.phone || ""
                    const cleanPhone = phone.replace(/\D/g, "")

                    return (
                      <div
                        key={order.id}
                        className="bg-slate-50/80 hover:bg-slate-50 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {returnTime}
                            </span>
                            <span className="font-bold text-slate-900 text-sm flex items-center gap-1 truncate">
                              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">{order.customerName}</span>
                            </span>
                            {phone && (
                              <span className="font-mono text-xs text-slate-600 font-semibold truncate">
                                · {phone}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                            <div className="flex items-center gap-1 truncate">
                              <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800 truncate">{order.vehicleName}</span>
                            </div>
                            {order.licensePlate && (
                              <span className="font-mono font-bold px-1.5 py-0.2 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                                {order.licensePlate}
                              </span>
                            )}
                            <span className="text-slate-400 shrink-0">· Cọc: {order.deposit.toLocaleString("vi-VN")}đ</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                          {cleanPhone && (
                            <>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="Gọi điện nhắc trả xe"
                                className="size-8 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 flex items-center justify-center transition shadow-2xs"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://zalo.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Nhắn Zalo"
                                className="size-8 rounded-lg bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 flex items-center justify-center transition shadow-2xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          {onCompleteOrder && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onCompleteOrder(order)}
                              className="h-8 px-3 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition"
                            >
                              <CornerDownLeft className="w-3.5 h-3.5 mr-1 text-amber-400" />
                              Thu hồi xe
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
