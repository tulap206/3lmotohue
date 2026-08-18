"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  Clock,
  Car,
  Sparkles,
  CheckCircle2,
  X,
  Bell,
  ArrowRight,
} from "lucide-react"
import { formatDisplayDate, parseDisplayDate } from "@/lib/format-date"
import { cn } from "@/lib/utils"

interface DailyNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  orders: any[]
  vehicles: any[]
  onDeliverOrderClick?: (order: any) => void
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0)
}

export function DailyNotificationModal({
  isOpen,
  onClose,
  orders,
  vehicles,
  onDeliverOrderClick,
}: DailyNotificationModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"overdue" | "upcoming">("overdue")

  const { overdueOrders, upcomingPendingOrders, todayStr } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const in2DaysEnd = new Date(today)
    in2DaysEnd.setDate(today.getDate() + 2)
    in2DaysEnd.setHours(23, 59, 59, 999)

    const todayFormatted = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`

    // 1. Đơn quá hạn trả
    const overdue = orders.filter((o) => {
      if (o.status !== "active") return false
      const end = parseDisplayDate(o.endDate)
      if (!end) return false
      end.setHours(0, 0, 0, 0)
      return end < today
    }).map(o => {
      const end = parseDisplayDate(o.endDate)!
      end.setHours(0, 0, 0, 0)
      const diffDays = Math.max(1, Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24)))
      return { ...o, overdueDays: diffDays }
    })

    // 2. Đơn chờ giao xe trong 2 ngày tới
    const upcoming = orders.filter((o) => {
      if (o.status !== "pending") return false
      const start = parseDisplayDate(o.startDate)
      if (!start) return false
      start.setHours(0, 0, 0, 0)
      return start >= today && start <= in2DaysEnd
    }).map(o => {
      const start = parseDisplayDate(o.startDate)!
      start.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      let dateLabel = "Hôm nay"
      if (diffDays === 1) dateLabel = "Ngày mai"
      else if (diffDays === 2) dateLabel = "Ngày kia (" + formatDisplayDate(o.startDate) + ")"
      return { ...o, daysUntilStart: diffDays, dateLabel }
    })

    return {
      overdueOrders: overdue,
      upcomingPendingOrders: upcoming,
      todayStr: todayFormatted,
    }
  }, [orders])

  useEffect(() => {
    if (!isOpen) return
    if (overdueOrders.length > 0) {
      setActiveTab("overdue")
    } else if (upcomingPendingOrders.length > 0) {
      setActiveTab("upcoming")
    } else {
      setActiveTab("overdue")
    }
  }, [isOpen, overdueOrders.length, upcomingPendingOrders.length])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden rounded-[var(--radius-container)] bg-white shadow-2xl border-0">
        {/* Banner Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-blue-200">
                <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>Nhắc nhở công việc ngày {todayStr}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Thông báo đơn hàng cần xử lý
              </h2>
              <p className="text-xs text-slate-300">
                Tổng hợp các đơn thuê quá hạn trả & đơn chờ giao xe trong 2 ngày tới
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Stat Counter Cards */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/10">
            <button
              onClick={() => setActiveTab("overdue")}
              className={cn(
                "p-3 rounded-xl transition text-left flex items-center justify-between border",
                activeTab === "overdue"
                  ? "bg-rose-500/20 border-rose-400/40 text-white shadow-sm"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              )}
            >
              <div>
                <p className="text-[11px] font-medium opacity-80">Đơn quá hạn trả</p>
                <p className="text-lg font-bold text-rose-300 tabular-nums">{overdueOrders.length} đơn</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab("upcoming")}
              className={cn(
                "p-3 rounded-xl transition text-left flex items-center justify-between border",
                activeTab === "upcoming"
                  ? "bg-amber-500/20 border-amber-400/40 text-white shadow-sm"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              )}
            >
              <div>
                <p className="text-[11px] font-medium opacity-80">Chờ giao 2 ngày tới</p>
                <p className="text-lg font-bold text-amber-300 tabular-nums">{upcomingPendingOrders.length} đơn</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("overdue")}
            className={cn(
              "px-4 py-2.5 rounded-t-lg border-b-2 transition flex items-center gap-2",
              activeTab === "overdue"
                ? "border-rose-600 text-rose-600 bg-white shadow-xs font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Đơn quá hạn trả ({overdueOrders.length})
          </button>

          <button
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "px-4 py-2.5 rounded-t-lg border-b-2 transition flex items-center gap-2",
              activeTab === "upcoming"
                ? "border-amber-600 text-amber-700 bg-white shadow-xs font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Đơn chờ giao xe ({upcomingPendingOrders.length})
          </button>
        </div>

        {/* Modal Main List */}
        <div className="p-4 max-h-[380px] overflow-y-auto space-y-3 bg-slate-50/30">
          {activeTab === "overdue" && overdueOrders.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
              <p className="text-sm font-semibold text-slate-800">Không có đơn nào bị quá hạn!</p>
              <p className="text-xs text-slate-400">Tất cả xe cho thuê đều đang trong hạn hợp đồng.</p>
            </div>
          )}

          {activeTab === "upcoming" && upcomingPendingOrders.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-blue-500 mx-auto opacity-80" />
              <p className="text-sm font-semibold text-slate-800">Không có đơn chờ giao trong 2 ngày tới</p>
              <p className="text-xs text-slate-400">Không có lịch bàn giao xe mới nào trong 2 ngày sắp tới.</p>
            </div>
          )}

          {/* List Overdue Orders */}
          {activeTab === "overdue" && overdueOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-rose-100 rounded-xl p-3.5 shadow-xs hover:border-rose-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{order.customerName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 shrink-0">
                    Quá hạn {order.overdueDays} ngày
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    {order.vehicleName} ({order.licensePlate})
                  </span>
                  <span>· Hạn trả: <strong className="text-rose-600">{formatDisplayDate(order.endDate)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose()
                    router.push("/dashboard/orders")
                  }}
                  className="h-8 text-xs gap-1 border-slate-200"
                >
                  Xem đơn
                </Button>
              </div>
            </div>
          ))}

          {/* List Upcoming Pending Orders */}
          {activeTab === "upcoming" && upcomingPendingOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-amber-100 rounded-xl p-3.5 shadow-xs hover:border-amber-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{order.customerName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 shrink-0">
                    {order.dateLabel} ({formatDisplayDate(order.startDate)})
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    {order.vehicleName} ({order.licensePlate})
                  </span>
                  <span>· Cọc: <strong className="text-slate-900 tabular-nums">{formatPrice(order.deposit)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  size="sm"
                  onClick={() => {
                    onClose()
                    if (onDeliverOrderClick) {
                      onDeliverOrderClick(order)
                    } else {
                      router.push("/dashboard/orders")
                    }
                  }}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Giao xe
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Hệ thống tự động thông báo lần đầu tiên trong ngày.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="h-9 text-xs">
              Đóng
            </Button>
            <Button
              onClick={() => {
                onClose()
                router.push("/dashboard/orders")
              }}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
            >
              Vào Quản lý đơn
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
