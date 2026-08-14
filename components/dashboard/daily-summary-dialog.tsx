"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  CalendarCheck,
  Download,
  Loader2,
  TrendingUp,
  Car,
  Wrench,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react"
import { toPng } from "html-to-image"
import { formatDisplayDate, parseDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
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

function getVehicleImageUrl(vehicle: any): string | null {
  if (!vehicle) return null
  if (Array.isArray(vehicle.vehicleImages) && vehicle.vehicleImages.length > 0 && typeof vehicle.vehicleImages[0] === 'string') {
    return vehicle.vehicleImages[0]
  }
  if (Array.isArray(vehicle.vehiclephoto) && vehicle.vehiclephoto.length > 0 && typeof vehicle.vehiclephoto[0] === 'string') {
    return vehicle.vehiclephoto[0]
  }
  if (Array.isArray(vehicle.images) && vehicle.images.length > 0 && typeof vehicle.images[0] === 'string') {
    return vehicle.images[0]
  }
  if (typeof vehicle.image === "string" && vehicle.image) {
    return vehicle.image
  }
  return null
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
  const [isExporting, setIsExporting] = useState(false)

  // Formatted date string for display (e.g. 14/08/2026)
  const formattedSelectedDate = useMemo(() => {
    return formatDisplayDate(selectedDate)
  }, [selectedDate])

  // 1. Đơn giao xe trong ngày (startDate hoặc created_at khớp ngày chọn)
  const dispatchedOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === "cancelled") return false
      const startDate = getYYYYMMDD(order.startDate)
      const createdDate = getYYYYMMDD(order.created_at)
      return startDate === selectedDate || createdDate === selectedDate
    })
  }, [orders, selectedDate])

  // Distinct vehicles dispatched on selectedDate
  const dispatchedVehiclesCount = useMemo(() => {
    const vIds = new Set<string>()
    dispatchedOrders.forEach((o) => {
      if (o.vehicleId) vIds.add(o.vehicleId)
    })
    return vIds.size
  }, [dispatchedOrders])

  // 2. Đơn hoàn thành & nhận lại xe trong ngày (endDate hoặc ngày hoàn thành khớp ngày chọn và status = completed)
  const completedOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status !== "completed") return false
      const endDate = getYYYYMMDD(order.endDate)
      const createdDate = getYYYYMMDD(order.created_at)
      return endDate === selectedDate || (createdDate === selectedDate && order.status === "completed")
    })
  }, [orders, selectedDate])

  // Distinct vehicles returned/completed on selectedDate
  const completedVehiclesCount = useMemo(() => {
    const vIds = new Set<string>()
    completedOrders.forEach((o) => {
      if (o.vehicleId) vIds.add(o.vehicleId)
    })
    return vIds.size
  }, [completedOrders])

  // Daily revenue calculation
  const dailyRevenue = useMemo(() => {
    // Revenue from completed orders today
    const completedRevenue = completedOrders.reduce((sum, order) => {
      return sum + (order.revenue || order.totalPrice || 0)
    }, 0)

    // Other income transactions on this date
    const txIncome = transactions
      .filter((tx) => tx.type === "income" && getYYYYMMDD(tx.timestamp) === selectedDate)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    return completedRevenue + txIncome
  }, [completedOrders, transactions, selectedDate])

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

  const handleDownloadImage = async () => {
    const printArea = document.getElementById("daily-summary-print-area")
    if (!printArea) return

    setIsExporting(true)
    try {
      await new Promise((res) => setTimeout(res, 120))

      const dataUrl = await toPng(printArea, {
        quality: 0.98,
        pixelRatio: 2, // High resolution (retina 2x)
        backgroundColor: "#ffffff",
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains("print:hidden")) {
            return false
          }
          return true
        },
      })

      const link = document.createElement("a")
      const fileDate = formattedSelectedDate.replace(/\//g, "-")
      link.download = `Bao-Cao-Ngay-${fileDate}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Error exporting image:", err)
      alert("⚠️ Lỗi tạo hình ảnh. Vui lòng thử lại!")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl max-w-[96vw] w-full max-h-[96vh] overflow-y-auto bg-slate-50/50 p-0 rounded-2xl border-slate-200 shadow-2xl">
        {/* Printable Section Wrapper */}
        <div id="daily-summary-print-area" className="p-4 sm:p-6 space-y-5 bg-white">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 pr-10">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
                <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    Báo Cáo Tổng Kết Ngày
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Báo cáo cuối ngày
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Ngày xem: <strong className="text-slate-800 font-semibold">{formattedSelectedDate}</strong>
                  </span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="text-slate-500">Cập nhật lúc: {formatDisplayDateTime(new Date())}</span>
                </p>
              </div>
            </div>

            {/* Date Selector & Download Control */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <div className="relative">
                <Calendar className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 transition shadow-sm cursor-pointer"
                />
              </div>

              <Button
                onClick={handleDownloadImage}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-700 !text-white rounded-lg font-semibold text-xs h-9 px-3.5 gap-1.5 shadow-sm transition"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isExporting ? "Đang tạo..." : "Tải ảnh báo cáo"}
              </Button>
            </div>
          </div>

          {/* KPI Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Doanh thu */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50/40 to-blue-50/20 border border-blue-100/80 rounded-xl p-3.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Doanh Thu Trong Ngày
                </span>
                <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight">
                  {formatPrice(dailyRevenue)}
                </span>
              </div>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">
                {completedOrders.length} đơn hoàn thành chốt doanh thu
              </p>
            </div>

            {/* Card 2: Đơn Giao Trong Ngày */}
            <div className="bg-gradient-to-br from-indigo-50 via-purple-50/40 to-indigo-50/20 border border-indigo-100/80 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
                  Đơn Giao Trong Ngày
                </span>
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                  <Car className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                  {dispatchedOrders.length} <span className="text-xs font-semibold text-indigo-700">đơn</span>
                </span>
                <span className="text-slate-300 font-light">/</span>
                <span className="text-lg font-bold text-indigo-800">
                  {dispatchedVehiclesCount} <span className="text-[11px] font-medium text-indigo-600">xe giao</span>
                </span>
              </div>
              <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                Đơn thuê mới & bàn giao xe
              </p>
            </div>

            {/* Card 3: Đơn Nhận xe trong ngày */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-emerald-50/20 border border-emerald-100/80 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  Đơn Nhận Xe Trong Ngày
                </span>
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
                  {completedOrders.length} <span className="text-xs font-semibold text-emerald-700">đơn</span>
                </span>
                <span className="text-slate-300 font-light">/</span>
                <span className="text-lg font-bold text-emerald-800">
                  {completedVehiclesCount} <span className="text-[11px] font-medium text-emerald-600">xe nhận</span>
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                Xe khách hoàn thành & trả lại
              </p>
            </div>

            {/* Card 4: Xe Bảo Trì */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-50/20 border border-amber-100/80 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Xe Sẵn Sàng / Bảo Trì
                </span>
                <div className="p-1.5 bg-amber-600 text-white rounded-lg shadow-xs">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                  {vehicleStats.available.length} <span className="text-xs font-semibold text-emerald-800">sẵn sàng</span>
                </span>
                <span className="text-slate-300 font-light">•</span>
                <span className="text-lg font-bold text-amber-800">
                  {vehicleStats.maintenance.length} <span className="text-[11px] font-medium text-amber-700">bảo trì</span>
                </span>
              </div>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                Trạng thái hiện tại của đội xe
              </p>
            </div>
          </div>

          {/* BẢNG 1: Đơn giao xe trong ngày */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  1. Danh Sách Đơn Giao Xe Trong Ngày ({formattedSelectedDate})
                </h3>
              </div>
              <span className="text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                Tổng: <strong className="text-blue-900 font-bold">{dispatchedOrders.length}</strong> đơn giao xe ({dispatchedVehiclesCount} xe)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
              <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">STT</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Khách Hàng</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Xe Thuê & Biển Số</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center">Thời Gian Thuê</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-center">Trạng Thái</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-right">Tiền Cọc</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-right">Doanh Thu / Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dispatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-5 text-center text-slate-400">
                        <AlertCircle className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                        <p className="font-medium text-slate-500 text-xs">Không có đơn giao xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    dispatchedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800">{order.vehicleName || "Xe thuê"}</div>
                          {order.licensePlate && (
                            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium mt-0.5 border border-slate-200">
                              {order.licensePlate}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-[11px] text-slate-600">
                          <div className="font-medium text-slate-800">{order.startDate || "—"}</div>
                          <div className="text-slate-400 text-[10px]">đến {order.endDate || "—"}</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-xs",
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
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600">
                          {order.deposit ? formatPrice(order.deposit) : "0 ₫"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono text-xs">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dispatchedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50/70 font-bold text-slate-900 border-t-2 border-blue-200 text-xs">
                      <td colSpan={4} className="py-2.5 px-3">
                        TỔNG CỘNG ĐƠN GIAO XE ({dispatchedOrders.length} ĐƠN - {dispatchedVehiclesCount} XE)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500"></td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatPrice(
                          dispatchedOrders.reduce((acc, curr) => acc + (curr.deposit || 0), 0)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700 text-sm font-black">
                        {formatPrice(
                          dispatchedOrders.reduce((acc, curr) => acc + (curr.revenue || curr.totalPrice || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* BẢNG 2: Đơn hoàn thành nhận lại xe trong ngày */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  2. Danh Sách Đơn Hoàn Thành & Nhận Lại Xe Trong Ngày ({formattedSelectedDate})
                </h3>
              </div>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                Tổng: <strong className="text-emerald-900 font-bold">{completedOrders.length}</strong> đơn nhận xe ({completedVehiclesCount} xe)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
              <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">STT</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Khách Hàng</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Xe Thuê & Biển Số</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center">Thời Gian Thuê</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-center">Trạng Thái</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-right">Tiền Cọc</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-right">Doanh Thu Thực Thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {completedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-5 text-center text-slate-400">
                        <AlertCircle className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                        <p className="font-medium text-slate-500 text-xs">Không có đơn hoàn thành nhận lại xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    completedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800">{order.vehicleName || "Xe thuê"}</div>
                          {order.licensePlate && (
                            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium mt-0.5 border border-slate-200">
                              {order.licensePlate}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-[11px] text-slate-600">
                          <div className="font-medium text-slate-800">{order.startDate || "—"}</div>
                          <div className="text-slate-400 text-[10px]">đến {order.endDate || "—"}</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                            Hoàn thành
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600">
                          {order.deposit ? formatPrice(order.deposit) : "0 ₫"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono text-xs">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {completedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/70 font-bold text-slate-900 border-t-2 border-emerald-200 text-xs">
                      <td colSpan={4} className="py-2.5 px-3">
                        TỔNG CỘNG ĐƠN NHẬN XE ({completedOrders.length} ĐƠN - {completedVehiclesCount} XE)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500"></td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatPrice(
                          completedOrders.reduce((acc, curr) => acc + (curr.deposit || 0), 0)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm font-black">
                        {formatPrice(dailyRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* BẢNG 3: Bảng Xe Sẵn Sàng & Xe Bảo Trì */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  3. Trạng Thái Đội Xe Hiện Tại (Sẵn Sàng & Bảo Trì)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                  {vehicleStats.available.length} Sẵn sàng
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold">
                  {vehicleStats.maintenance.length} Bảo trì
                </span>
              </div>
            </div>

            {/* Split View: Xe Sẵn Sàng vs Xe Bảo Trì */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Xe Sẵn Sàng */}
              <div className="border border-emerald-200 rounded-xl bg-emerald-50/20 overflow-hidden shadow-xs">
                <div className="bg-emerald-100/70 px-3.5 py-2 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <h4 className="font-bold text-emerald-950 text-xs sm:text-sm">
                      Xe Đang Sẵn Sàng Cho Thuê ({vehicleStats.available.length})
                    </h4>
                  </div>
                </div>
                <div className="divide-y divide-emerald-100/60 bg-white">
                  {vehicleStats.available.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Hiện tại không có xe nào sẵn sàng.
                    </div>
                  ) : (
                    vehicleStats.available.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2 px-3 flex items-center gap-3 hover:bg-emerald-50/40 transition"
                        >
                          <span className="w-5 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Car className="w-4 h-4 text-emerald-600" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{vehicle.name}</span>
                            {vehicle.licensePlate && (
                              <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-semibold shrink-0">
                                {vehicle.licensePlate}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Box 2: Xe Bảo Trì */}
              <div className="border border-amber-200 rounded-xl bg-amber-50/20 overflow-hidden shadow-xs">
                <div className="bg-amber-100/70 px-3.5 py-2 border-b border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-700" />
                    <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                      Xe Đang Trong Bảo Trì ({vehicleStats.maintenance.length})
                    </h4>
                  </div>
                </div>
                <div className="divide-y divide-amber-100/60 bg-white">
                  {vehicleStats.maintenance.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Không có xe nào đang bảo trì.
                    </div>
                  ) : (
                    vehicleStats.maintenance.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2 px-3 flex items-center gap-3 hover:bg-amber-50/40 transition"
                        >
                          <span className="w-5 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Car className="w-4 h-4 text-amber-600" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{vehicle.name}</span>
                            {vehicle.licensePlate && (
                              <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-semibold shrink-0">
                                {vehicle.licensePlate}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Sign-off Footer for Printed Reports / Downloaded Images */}
          <div className="pt-4 border-t border-slate-300 mt-4 text-xs text-slate-600">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900 text-xs sm:text-sm">{QUY79_BUSINESS.brandName}</p>
                <p className="mt-0.5 text-[11px]">Hotline: {QUY79_BUSINESS.hotline}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Thời gian lập báo cáo: {formatDisplayDateTime(new Date())}</p>
              </div>
              <div className="text-center pr-6">
                <p className="font-bold text-slate-800 text-xs">Người Kiểm Tra / Lập Báo Cáo</p>
                <p className="text-slate-400 mt-8 text-[10px]">(Ký và ghi rõ họ tên)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100/80 px-5 py-3 border-t border-slate-200 flex items-center justify-between print:hidden rounded-b-2xl">
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            3L Moto — Hệ thống quản lý cho thuê xe máy
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 !text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-sm transition"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isExporting ? "Đang tạo ảnh..." : "Tải Ảnh Báo Cáo"}
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
