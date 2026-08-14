"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  CalendarCheck,
  Printer,
  X,
  TrendingUp,
  Car,
  Wrench,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react"
import { formatDisplayDate, parseDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
import { getRentalVehicleStatusLabel, rentalVehicleStatusBadgeClass } from "@/components/dashboard/rental-ui"
import { QUY79_BUSINESS } from "@/lib/business-info"
import { cn } from "@/lib/utils"

interface DailySummaryDialogProps {
  isOpen: boolean
  onClose: () => void
  orders: any[]
  vehicles: any[]
  transactions?: any[]
}

function getYYYYMMDD(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ""
  const dateObj = parseDisplayDate(dateInput)
  if (!dateObj) return ""
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, "0")
  const d = String(dateObj.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0)
}

export function DailySummaryDialog({
  isOpen,
  onClose,
  orders = [],
  vehicles = [],
  transactions = [],
}: DailySummaryDialogProps) {
  // Today's date in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [])

  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [activeTab, setActiveTab] = useState<"all" | "available" | "maintenance">("all")

  // Formatted date string for display (e.g. 14/08/2026)
  const formattedSelectedDate = useMemo(() => {
    return formatDisplayDate(selectedDate)
  }, [selectedDate])

  // Filter orders for selectedDate
  const dailyOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === "cancelled") return false
      const createdDate = getYYYYMMDD(order.created_at)
      const startDate = getYYYYMMDD(order.startDate)
      const endDate = getYYYYMMDD(order.endDate)

      // Order created or started on selected date, or active during selected date
      const isCreatedOrStarted = createdDate === selectedDate || startDate === selectedDate
      const isActiveOnDate = startDate <= selectedDate && endDate >= selectedDate

      return isCreatedOrStarted || isActiveOnDate
    })
  }, [orders, selectedDate])

  // Distinct vehicles rented on selected date
  const dailyRentedVehicles = useMemo(() => {
    const vehicleIds = new Set<string>()
    dailyOrders.forEach((o) => {
      if (o.vehicleId) vehicleIds.add(o.vehicleId)
    })
    return vehicleIds.size
  }, [dailyOrders])

  // Daily revenue calculation
  const dailyRevenue = useMemo(() => {
    // Rental revenue from orders created/started on this date or completed on this date
    const orderRevenue = dailyOrders.reduce((sum, order) => {
      return sum + (order.revenue || order.totalPrice || 0)
    }, 0)

    // Other income transactions on this date
    const txIncome = transactions
      .filter((tx) => tx.type === "income" && getYYYYMMDD(tx.timestamp) === selectedDate)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    return orderRevenue + txIncome
  }, [dailyOrders, transactions, selectedDate])

  // Vehicle status metrics
  const vehicleStats = useMemo(() => {
    const available = vehicles.filter((v) => v.status === "available")
    const maintenance = vehicles.filter((v) => v.status === "maintenance")
    const rented = vehicles.filter((v) => v.status === "rented")
    const pending = vehicles.filter((v) => v.status === "pending")

    return {
      available,
      maintenance,
      rented,
      pending,
      total: vehicles.length,
    }
  }, [vehicles])

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-50/50 p-0 rounded-2xl border-slate-200 shadow-2xl">
        {/* Printable Section Wrapper */}
        <div id="daily-summary-print-area" className="p-6 sm:p-8 space-y-6 bg-white">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/20">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Báo Cáo Tổng Kết Ngày
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Báo cáo cuối ngày
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Thời gian: <span className="font-semibold text-slate-700">{formattedSelectedDate}</span>
                  <span className="text-slate-300">|</span>
                  <span>Cập nhật lúc: {formatDisplayDateTime(new Date())}</span>
                </p>
              </div>
            </div>

            {/* Date Selector & Print Control */}
            <div className="flex items-center gap-2 print:hidden">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 transition"
                />
                <Calendar className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="bg-white text-slate-700 border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-xs h-9 px-3 gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                In báo cáo
              </Button>
            </div>
          </div>

          {/* KPI Highlight Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Doanh thu */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-xl p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Doanh Thu Trong Ngày
                </span>
                <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight">
                  {formatPrice(dailyRevenue)}
                </span>
              </div>
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                {dailyOrders.length} đơn thuê phát sinh
              </p>
            </div>

            {/* Card 2: Đơn thuê & Xe thuê */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                  Đơn & Xe Cho Thuê
                </span>
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                  {dailyOrders.length} <span className="text-sm font-semibold text-indigo-700">đơn</span>
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-lg font-bold text-indigo-800">
                  {dailyRentedVehicles} <span className="text-xs font-medium">xe</span>
                </span>
              </div>
              <p className="text-[11px] text-indigo-600 font-medium mt-1">
                Xe thực tế hoạt động trong ngày
              </p>
            </div>

            {/* Card 3: Xe Sẵn Sàng */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Xe Sẵn Sàng
                </span>
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
                  {vehicleStats.available.length} <span className="text-sm font-semibold text-emerald-700">xe</span>
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Sẵn sàng giao cho khách
              </p>
            </div>

            {/* Card 4: Xe Bảo Trì */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Xe Đang Bảo Trì
                </span>
                <div className="p-1.5 bg-amber-600 text-white rounded-lg shadow-sm">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight">
                  {vehicleStats.maintenance.length} <span className="text-sm font-semibold text-amber-700">xe</span>
                </span>
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                Đang bảo dưỡng / sửa chữa
              </p>
            </div>
          </div>

          {/* Section 1: Bảng Số Đơn Thuê & Xe Thuê, Doanh Thu Trong Ngày */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">
                  1. Chi Tiết Đơn Thuê & Doanh Thu Ngày {formattedSelectedDate}
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Tổng: <strong className="text-slate-800">{dailyOrders.length}</strong> đơn thuê
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">STT</th>
                    <th className="py-3 px-3.5">Khách Hàng</th>
                    <th className="py-3 px-3.5">Xe Thuê & Biển Số</th>
                    <th className="py-3 px-3.5 text-center">Thời Gian Thuê</th>
                    <th className="py-3 px-3.5 text-center">Trạng Thái</th>
                    <th className="py-3 px-3.5 text-right">Tiền Cọc</th>
                    <th className="py-3 px-3.5 text-right">Doanh Thu / Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dailyOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium text-slate-500">Không có đơn thuê phát sinh trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    dailyOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3.5 text-center font-mono text-xs text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-medium text-slate-800">{order.vehicleName || "Xe thuê"}</div>
                          {order.licensePlate && (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-mono mt-0.5">
                              {order.licensePlate}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center text-xs text-slate-600">
                          <div>{order.startDate || "—"}</div>
                          <div className="text-slate-400 text-[11px]">đến {order.endDate || "—"}</div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                              order.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.status === "active"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : order.status === "pending"
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            )}
                          >
                            {order.status === "completed"
                              ? "Hoàn thành"
                              : order.status === "active"
                              ? "Đang thuê"
                              : order.status === "pending"
                              ? "Chờ giao"
                              : order.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-xs text-slate-600">
                          {order.deposit ? formatPrice(order.deposit) : "0 ₫"}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 font-mono">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dailyOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100/70 font-bold text-slate-900 border-t border-slate-200 text-xs sm:text-sm">
                      <td colSpan={4} className="py-3 px-3.5">
                        TỔNG CỘNG ({dailyOrders.length} ĐƠN THUÊ - {dailyRentedVehicles} XE)
                      </td>
                      <td className="py-3 px-3.5 text-center text-slate-500"></td>
                      <td className="py-3 px-3.5 text-right font-mono text-slate-700">
                        {formatPrice(
                          dailyOrders.reduce((acc, curr) => acc + (curr.deposit || 0), 0)
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-blue-700 text-base">
                        {formatPrice(dailyRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Section 2: Bảng Xe Sẵn Sàng & Xe Bảo Trì */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">
                  2. Trạng Thái Đội Xe Hiện Tại (Sẵn Sàng & Bảo Trì)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium">
                  {vehicleStats.available.length} Sẵn sàng
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-medium">
                  {vehicleStats.maintenance.length} Bảo trì
                </span>
              </div>
            </div>

            {/* Split View: Xe Sẵn Sàng vs Xe Bảo Trì */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Box 1: Xe Sẵn Sàng */}
              <div className="border border-emerald-200 rounded-xl bg-emerald-50/20 overflow-hidden">
                <div className="bg-emerald-100/60 px-4 py-2.5 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <h4 className="font-bold text-emerald-950 text-sm">
                      Xe Đang Sẵn Sàng Cho Thuê ({vehicleStats.available.length})
                    </h4>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-emerald-100/60 bg-white">
                  {vehicleStats.available.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Hiện tại không có xe nào sẵn sàng.
                    </div>
                  ) : (
                    vehicleStats.available.map((vehicle, i) => (
                      <div
                        key={vehicle.id || i}
                        className="p-2.5 px-4 flex items-center justify-between text-xs hover:bg-emerald-50/40 transition"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{vehicle.name}</div>
                          {vehicle.licensePlate && (
                            <span className="text-[11px] font-mono text-slate-500">
                              {vehicle.licensePlate}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-700 font-mono">
                            {vehicle.pricePerDay ? formatPrice(vehicle.pricePerDay) : "—"}/ngày
                          </span>
                          <div className="mt-0.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Sẵn sàng
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Box 2: Xe Bảo Trì */}
              <div className="border border-amber-200 rounded-xl bg-amber-50/20 overflow-hidden">
                <div className="bg-amber-100/60 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-700" />
                    <h4 className="font-bold text-amber-950 text-sm">
                      Xe Đang Trong Bảo Trì ({vehicleStats.maintenance.length})
                    </h4>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-amber-100/60 bg-white">
                  {vehicleStats.maintenance.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Không có xe nào đang bảo trì.
                    </div>
                  ) : (
                    vehicleStats.maintenance.map((vehicle, i) => (
                      <div
                        key={vehicle.id || i}
                        className="p-2.5 px-4 flex items-center justify-between text-xs hover:bg-amber-50/40 transition"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{vehicle.name}</div>
                          {vehicle.licensePlate && (
                            <span className="text-[11px] font-mono text-slate-500">
                              {vehicle.licensePlate}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-amber-800 italic block max-w-[140px] truncate">
                            {vehicle.notes || "Đang bảo dưỡng định kỳ"}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 inline-block mt-0.5">
                            Bảo trì
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Sign-off Footer for Printed Reports */}
          <div className="hidden print:block pt-6 border-t border-slate-300 mt-6 text-xs text-slate-600">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-800">{QUY79_BUSINESS.brandName}</p>
                <p>Hotline: {QUY79_BUSINESS.hotline}</p>
                <p>Ngày in: {formatDisplayDateTime(new Date())}</p>
              </div>
              <div className="text-center pr-8">
                <p className="font-bold text-slate-800">Người Kiểm Tra / Lập Báo Cáo</p>
                <p className="text-slate-400 mt-12">(Ký và ghi rõ họ tên)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100/80 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between print:hidden rounded-b-2xl">
          <p className="text-xs text-slate-500 font-medium">
            3L Moto — Hệ thống quản lý cho thuê xe máy
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="bg-white border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              In Báo Cáo
            </Button>
            <Button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
            >
              Đóng Cửa Sổ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
