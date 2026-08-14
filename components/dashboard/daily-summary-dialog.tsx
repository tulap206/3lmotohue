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
  CheckCircle2,
  Calendar,
  Layers,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Bike,
} from "lucide-react"
import { toPng } from "html-to-image"
import { formatDisplayDate, parseDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
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

  // Split available vehicles into 3 categories: Vision, AB, Others
  const availableVision = useMemo(() => {
    return vehicleStats.available.filter((v) => /vision/i.test(v.name || ""))
  }, [vehicleStats.available])

  const availableAB = useMemo(() => {
    return vehicleStats.available.filter((v) => /\b(ab|air\s*blade|airblade)\b/i.test(v.name || ""))
  }, [vehicleStats.available])

  const availableOthers = useMemo(() => {
    return vehicleStats.available.filter((v) => {
      const isVision = /vision/i.test(v.name || "")
      const isAB = /\b(ab|air\s*blade|airblade)\b/i.test(v.name || "")
      return !isVision && !isAB
    })
  }, [vehicleStats.available])

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
      <DialogContent className="sm:max-w-5xl max-w-[98vw] w-full max-h-[96vh] overflow-y-auto bg-slate-50 p-0 rounded-xl sm:rounded-2xl border-slate-200 shadow-xl">
        {/* Printable Canvas Section */}
        <div id="daily-summary-print-area" className="p-4 sm:p-7 space-y-5 bg-white rounded-t-xl sm:rounded-t-2xl">
          
          {/* Light & Clean Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 pr-6 sm:pr-8">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-red-500 rounded-full shrink-0" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Báo Cáo Tổng Kết Ngày
                </h2>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {formattedSelectedDate}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-normal pl-3.5">
                Cập nhật lúc: {formatDisplayDateTime(new Date())}
              </p>
            </div>

            {/* Date Selector & Export Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto print:hidden">
              <div className="relative w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-auto pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition shadow-2xs cursor-pointer"
                />
              </div>

              <Button
                onClick={handleDownloadImage}
                disabled={isExporting}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 !text-white rounded-lg font-semibold text-xs h-9 px-3.5 gap-1.5 shadow-2xs transition"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isExporting ? "Đang xuất..." : "Tải ảnh báo cáo"}
              </Button>
            </div>
          </div>

          {/* Light Minimalist KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Card 1: Doanh Thu - Red Money Highlight */}
            <div className="bg-red-50/40 border border-red-200/80 rounded-xl p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block">
                Doanh Thu Thực Thu
              </span>
              <div className="mt-1.5">
                <span className="text-lg sm:text-2xl font-bold text-red-600 font-mono block truncate">
                  {formatPrice(dailyRevenue)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-normal truncate">
                {completedOrders.length} đơn hoàn thành
              </div>
            </div>

            {/* Card 2: Đơn Giao Trong Ngày */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block truncate">
                Đơn Giao Xe
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900">
                  {dispatchedOrders.length}
                </span>
                <span className="text-xs text-slate-500 font-medium">đơn ({dispatchedVehiclesCount} xe)</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-normal truncate">
                Bàn giao cho khách
              </div>
            </div>

            {/* Card 3: Đơn Nhận xe trong ngày */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block truncate">
                Đơn Nhận Xe
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900">
                  {completedOrders.length}
                </span>
                <span className="text-xs text-slate-500 font-medium">đơn ({completedVehiclesCount} xe)</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-normal truncate">
                Trả xe hoàn thành
              </div>
            </div>

            {/* Card 4: Xe Sẵn Sàng */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block truncate">
                Xe Sẵn Sàng
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900">
                  {vehicleStats.available.length}
                </span>
                <span className="text-xs text-slate-500 font-medium">xe</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium truncate">
                {availableVision.length} Vision • {availableAB.length} AB • {availableOthers.length} Khác
              </div>
            </div>
          </div>

          {/* BẢNG 1: Đơn giao xe trong ngày */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                1. Danh Sách Đơn Giao Xe Trong Ngày ({formattedSelectedDate})
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Tổng: <strong className="text-slate-900 font-semibold">{dispatchedOrders.length}</strong> đơn ({dispatchedVehiclesCount} xe)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white">
              <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center font-normal">STT</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Khách Hàng</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Xe Thuê & Biển Số</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center">Thời Gian Thuê</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-center">Trạng Thái</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-right">Doanh Thu / Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dispatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-5 text-center text-slate-400">
                        <p className="font-normal text-slate-500 text-xs">Không có đơn giao xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    dispatchedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-900">{order.vehicleName || "Xe thuê"}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {order.licensePlate && (
                              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[11px] font-mono font-bold shrink-0 shadow-2xs">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center text-[11px] text-slate-500">
                          {order.startDate || "—"} → {order.endDate || "—"}
                        </td>
                        {/* HIGHLIGHTED 2: Trạng Thái */}
                        <td className="py-2 px-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-2xs",
                              order.status === "completed"
                                ? "bg-emerald-100/90 text-emerald-800 border border-emerald-300"
                                : order.status === "active"
                                ? "bg-blue-100/90 text-blue-800 border border-blue-300"
                                : order.status === "pending"
                                ? "bg-amber-100/90 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-700 border border-slate-300"
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
                        {/* HIGHLIGHTED 3: Số Tiền RED COLOR */}
                        <td className="py-2 px-3 text-right font-bold text-red-600 font-mono text-xs">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dispatchedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200 text-xs">
                      <td colSpan={4} className="py-2.5 px-3 text-[11px] sm:text-xs">
                        TỔNG CỘNG ĐƠN GIAO XE ({dispatchedOrders.length} ĐƠN - {dispatchedVehiclesCount} XE)
                      </td>
                      <td className="py-2.5 px-3 text-center"></td>
                      {/* HIGHLIGHTED 3: Số Tiền Tổng RED COLOR */}
                      <td className="py-2.5 px-3 text-right font-mono text-red-600 text-xs sm:text-sm font-bold">
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
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                2. Danh Sách Đơn Hoàn Thành & Nhận Lại Xe Trong Ngày ({formattedSelectedDate})
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Tổng: <strong className="text-slate-900 font-semibold">{completedOrders.length}</strong> đơn ({completedVehiclesCount} xe)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white">
              <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center font-normal">STT</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Khách Hàng</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Xe Thuê & Biển Số</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center">Thời Gian Thuê</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-center">Trạng Thái</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-right">Doanh Thu Thực Thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {completedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-5 text-center text-slate-400">
                        <p className="font-normal text-slate-500 text-xs">Không có đơn hoàn thành nhận lại xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    completedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-900">{order.vehicleName || "Xe thuê"}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {order.licensePlate && (
                              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[11px] font-mono font-bold shrink-0 shadow-2xs">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center text-[11px] text-slate-500">
                          {order.startDate || "—"} → {order.endDate || "—"}
                        </td>
                        {/* HIGHLIGHTED 2: Trạng Thái */}
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs">
                            Hoàn thành
                          </span>
                        </td>
                        {/* HIGHLIGHTED 3: Số Tiền RED COLOR */}
                        <td className="py-2 px-3 text-right font-bold text-red-600 font-mono text-xs">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {completedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-red-50/30 font-bold text-slate-900 border-t border-red-200/80 text-xs">
                      <td colSpan={4} className="py-2.5 px-3 text-[11px] sm:text-xs">
                        TỔNG CỘNG ĐƠN NHẬN XE ({completedOrders.length} ĐƠN - {completedVehiclesCount} XE)
                      </td>
                      <td className="py-2.5 px-3 text-center"></td>
                      {/* HIGHLIGHTED 3: Số Tiền Tổng RED COLOR */}
                      <td className="py-2.5 px-3 text-right font-mono text-red-600 text-xs sm:text-sm font-bold">
                        {formatPrice(dailyRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* BẢNG 3: Danh Sách Xe Đang Sẵn Sàng (3 Cột) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                3. Danh Sách Xe Đang Sẵn Sàng Cho Thuê ({vehicleStats.available.length} xe)
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span>Vision: <strong className="text-slate-800">{availableVision.length}</strong></span>
                <span>•</span>
                <span>AB: <strong className="text-slate-800">{availableAB.length}</strong></span>
                <span>•</span>
                <span>Khác: <strong className="text-slate-800">{availableOthers.length}</strong></span>
              </div>
            </div>

            {/* 3 Cột Light Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Cột 1: Xe Vision */}
              <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 text-xs">
                    Xe Vision ({availableVision.length})
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {availableVision.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 font-normal">
                      Không có xe Vision sẵn sàng.
                    </div>
                  ) : (
                    availableVision.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2 px-2.5 flex items-center gap-2.5 hover:bg-slate-50/50 transition"
                        >
                          <span className="w-4 text-center text-xs font-mono text-slate-400 font-medium shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-medium text-slate-800 text-xs">{vehicle.name}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {vehicle.licensePlate && (
                              <span className="text-[10px] font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
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

              {/* Cột 2: Xe AB */}
              <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 text-xs">
                    Xe AB (Air Blade) ({availableAB.length})
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {availableAB.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 font-normal">
                      Không có xe AB sẵn sàng.
                    </div>
                  ) : (
                    availableAB.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2 px-2.5 flex items-center gap-2.5 hover:bg-slate-50/50 transition"
                        >
                          <span className="w-4 text-center text-xs font-mono text-slate-400 font-medium shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-medium text-slate-800 text-xs">{vehicle.name}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {vehicle.licensePlate && (
                              <span className="text-[10px] font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
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

              {/* Cột 3: Xe Khác */}
              <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 text-xs">
                    Xe Khác ({availableOthers.length})
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {availableOthers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 font-normal">
                      Không có xe khác sẵn sàng.
                    </div>
                  ) : (
                    availableOthers.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2 px-2.5 flex items-center gap-2.5 hover:bg-slate-50/50 transition"
                        >
                          <span className="w-4 text-center text-xs font-mono text-slate-400 font-medium shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-medium text-slate-800 text-xs">{vehicle.name}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {vehicle.licensePlate && (
                              <span className="text-[10px] font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
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
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100/90 p-3 sm:px-6 sm:py-3.5 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 print:hidden rounded-b-xl sm:rounded-b-2xl">
          <Button
            onClick={onClose}
            className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs h-9 px-4 rounded-lg shadow-2xs"
          >
            Đóng Cửa Sổ
          </Button>
          <Button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 !text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-2xs transition"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isExporting ? "Đang tạo ảnh..." : "Tải Ảnh Báo Cáo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
