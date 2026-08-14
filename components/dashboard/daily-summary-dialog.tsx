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
  Sparkles,
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
      <DialogContent className="sm:max-w-5xl max-w-[96vw] w-full max-h-[96vh] overflow-y-auto bg-slate-100/70 p-0 rounded-2xl border-slate-200/80 shadow-2xl">
        {/* Printable Canvas Section */}
        <div id="daily-summary-print-area" className="p-5 sm:p-7 space-y-6 bg-white rounded-t-2xl">
          
          {/* Header Banner Block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 pr-8">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-slate-900 text-emerald-400 rounded-2xl shadow-md shadow-slate-900/10 shrink-0">
                <CalendarCheck className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    BÁO CÁO TỔNG KẾT NGÀY
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white tracking-wide">
                    {formattedSelectedDate}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2">
                  <span>Hệ thống 3L Moto</span>
                  <span>•</span>
                  <span>Thời gian cập nhật: {formatDisplayDateTime(new Date())}</span>
                </p>
              </div>
            </div>

            {/* Date Selector & Export Actions */}
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-800 transition shadow-xs cursor-pointer"
                />
              </div>

              <Button
                onClick={handleDownloadImage}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-700 !text-white rounded-xl font-bold text-xs h-9 px-4 gap-2 shadow-sm transition"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isExporting ? "Đang xuất..." : "Tải ảnh báo cáo"}
              </Button>
            </div>
          </div>

          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Doanh Thu */}
            <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                  Doanh Thu Thực Thu
                </span>
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight font-mono">
                  {formatPrice(dailyRevenue)}
                </span>
              </div>
              <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                {completedOrders.length} đơn hoàn thành chốt sổ
              </div>
            </div>

            {/* Card 2: Đơn Giao Trong Ngày */}
            <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                  Đơn Giao Trong Ngày
                </span>
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight">
                  {dispatchedOrders.length} <span className="text-xs font-bold text-blue-700">đơn</span>
                </span>
                <span className="text-slate-300 font-light">/</span>
                <span className="text-base font-bold text-blue-800">
                  {dispatchedVehiclesCount} <span className="text-[11px] font-medium text-blue-600">xe</span>
                </span>
              </div>
              <div className="mt-1 text-[11px] font-semibold text-blue-700">
                Bàn giao xe cho khách
              </div>
            </div>

            {/* Card 3: Đơn Nhận xe trong ngày */}
            <div className="bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent border border-teal-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-800 flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-teal-600" />
                  Đơn Nhận Xe Trong Ngày
                </span>
                <div className="p-2 bg-teal-600 text-white rounded-xl shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-teal-950 tracking-tight">
                  {completedOrders.length} <span className="text-xs font-bold text-teal-700">đơn</span>
                </span>
                <span className="text-slate-300 font-light">/</span>
                <span className="text-base font-bold text-teal-800">
                  {completedVehiclesCount} <span className="text-[11px] font-medium text-teal-600">xe</span>
                </span>
              </div>
              <div className="mt-1 text-[11px] font-semibold text-teal-700">
                Nhận trả xe hoàn thành
              </div>
            </div>

            {/* Card 4: Xe Sẵn Sàng */}
            <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800">
                  Xe Đang Sẵn Sàng
                </span>
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Bike className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                  {vehicleStats.available.length} <span className="text-xs font-bold text-indigo-700">xe</span>
                </span>
              </div>
              <div className="mt-1 text-[11px] font-bold text-indigo-800">
                {availableVision.length} Vision • {availableAB.length} AB • {availableOthers.length} Khác
              </div>
            </div>
          </div>

          {/* BẢNG 1: Đơn giao xe trong ngày */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-950">
                  1. Danh Sách Đơn Giao Xe Trong Ngày ({formattedSelectedDate})
                </h3>
              </div>
              <span className="text-xs text-blue-800 font-bold bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-2xs">
                Tổng: {dispatchedOrders.length} đơn ({dispatchedVehiclesCount} xe)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200/90 rounded-2xl bg-white shadow-xs">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-900 text-[11px] font-extrabold text-white uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">STT</th>
                    <th className="py-3 px-3.5 min-w-[140px]">Khách Hàng</th>
                    <th className="py-3 px-3.5 min-w-[160px]">Xe Thuê & Biển Số</th>
                    <th className="py-3 px-3.5 min-w-[150px] text-center">Thời Gian Thuê</th>
                    <th className="py-3 px-3.5 min-w-[110px] text-center">Trạng Thái</th>
                    <th className="py-3 px-3.5 min-w-[130px] text-right">Doanh Thu / Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {dispatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        <AlertCircle className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                        <p className="font-semibold text-slate-500 text-xs">Không có đơn giao xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    dispatchedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-2.5 px-3.5 text-center font-mono text-xs text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">{order.vehicleName || "Xe thuê"}</span>
                            {order.licensePlate && (
                              <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[11px] font-mono font-bold shrink-0 shadow-2xs">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <div className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-medium text-[11px] border border-slate-200">
                            {order.startDate || "—"} → {order.endDate || "—"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-2xs",
                              order.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : order.status === "active"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : order.status === "pending"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
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
                        <td className="py-2.5 px-3.5 text-right font-black text-slate-900 font-mono text-xs">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dispatchedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-900 text-xs">
                      <td colSpan={4} className="py-3 px-3.5">
                        TỔNG CỘNG ĐƠN GIAO XE ({dispatchedOrders.length} ĐƠN - {dispatchedVehiclesCount} XE)
                      </td>
                      <td className="py-3 px-3.5 text-center"></td>
                      <td className="py-3 px-3.5 text-right font-mono text-emerald-400 text-sm font-black">
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
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between bg-emerald-50/80 px-4 py-2.5 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-950">
                  2. Danh Sách Đơn Hoàn Thành & Nhận Lại Xe Trong Ngày ({formattedSelectedDate})
                </h3>
              </div>
              <span className="text-xs text-emerald-800 font-bold bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                Tổng: {completedOrders.length} đơn ({completedVehiclesCount} xe)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200/90 rounded-2xl bg-white shadow-xs">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-900 text-[11px] font-extrabold text-white uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">STT</th>
                    <th className="py-3 px-3.5 min-w-[140px]">Khách Hàng</th>
                    <th className="py-3 px-3.5 min-w-[160px]">Xe Thuê & Biển Số</th>
                    <th className="py-3 px-3.5 min-w-[150px] text-center">Thời Gian Thuê</th>
                    <th className="py-3 px-3.5 min-w-[110px] text-center">Trạng Thái</th>
                    <th className="py-3 px-3.5 min-w-[130px] text-right">Doanh Thu Thực Thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {completedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        <AlertCircle className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                        <p className="font-semibold text-slate-500 text-xs">Không có đơn hoàn thành nhận lại xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    completedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="py-2.5 px-3.5 text-center font-mono text-xs text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">{order.vehicleName || "Xe thuê"}</span>
                            {order.licensePlate && (
                              <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[11px] font-mono font-bold shrink-0 shadow-2xs">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <div className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-medium text-[11px] border border-slate-200">
                            {order.startDate || "—"} → {order.endDate || "—"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                            Hoàn thành
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-black text-emerald-700 font-mono text-xs">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {completedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-900 text-xs">
                      <td colSpan={4} className="py-3 px-3.5">
                        TỔNG CỘNG ĐƠN NHẬN XE ({completedOrders.length} ĐƠN - {completedVehiclesCount} XE)
                      </td>
                      <td className="py-3 px-3.5 text-center"></td>
                      <td className="py-3 px-3.5 text-right font-mono text-emerald-400 text-sm font-black">
                        {formatPrice(dailyRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* BẢNG 3: Danh Sách Xe Đang Sẵn Sàng (3 Cột) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between bg-indigo-50/80 px-4 py-2.5 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-indigo-950">
                  3. Danh Sách Xe Đang Sẵn Sàng Cho Thuê ({vehicleStats.available.length} xe)
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Vision: {availableVision.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                  AB: {availableAB.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                  Khác: {availableOthers.length}
                </span>
              </div>
            </div>

            {/* 3 Cột Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cột 1: Xe Vision */}
              <div className="border border-emerald-200/90 rounded-2xl bg-white overflow-hidden shadow-xs">
                <div className="bg-emerald-600 text-white px-3.5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <h4 className="font-extrabold text-xs tracking-wider uppercase">
                      Xe Vision ({availableVision.length})
                    </h4>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {availableVision.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium">
                      Không có xe Vision sẵn sàng.
                    </div>
                  ) : (
                    availableVision.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2.5 px-3 flex items-center gap-3 hover:bg-emerald-50/30 transition"
                        >
                          <span className="w-5 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 shadow-2xs"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
                              <Bike className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-extrabold text-slate-900 text-xs">{vehicle.name}</span>
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
              <div className="border border-blue-200/90 rounded-2xl bg-white overflow-hidden shadow-xs">
                <div className="bg-blue-600 text-white px-3.5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-200" />
                    <h4 className="font-extrabold text-xs tracking-wider uppercase">
                      Xe AB (Air Blade) ({availableAB.length})
                    </h4>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {availableAB.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium">
                      Không có xe AB sẵn sàng.
                    </div>
                  ) : (
                    availableAB.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2.5 px-3 flex items-center gap-3 hover:bg-blue-50/30 transition"
                        >
                          <span className="w-5 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 shadow-2xs"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                              <Bike className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-extrabold text-slate-900 text-xs">{vehicle.name}</span>
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
              <div className="border border-purple-200/90 rounded-2xl bg-white overflow-hidden shadow-xs">
                <div className="bg-purple-600 text-white px-3.5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-200" />
                    <h4 className="font-extrabold text-xs tracking-wider uppercase">
                      Xe Khác ({availableOthers.length})
                    </h4>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {availableOthers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium">
                      Không có xe khác sẵn sàng.
                    </div>
                  ) : (
                    availableOthers.map((vehicle, i) => {
                      const imageUrl = getVehicleImageUrl(vehicle)
                      return (
                        <div
                          key={vehicle.id || i}
                          className="p-2.5 px-3 flex items-center gap-3 hover:bg-purple-50/30 transition"
                        >
                          <span className="w-5 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                            {i + 1}
                          </span>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={vehicle.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 shadow-2xs"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
                              <Bike className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-extrabold text-slate-900 text-xs">{vehicle.name}</span>
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
        <div className="bg-slate-100/90 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end print:hidden rounded-b-2xl">
          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm transition"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              {isExporting ? "Đang tạo ảnh..." : "Tải Ảnh Báo Cáo"}
            </Button>
            <Button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm"
            >
              Đóng Cửa Sổ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
