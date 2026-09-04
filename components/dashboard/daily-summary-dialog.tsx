"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Download,
  Loader2,
  Calendar,
} from "lucide-react"
import { toBlob } from "html-to-image"
import { formatDisplayDate, parseDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import { showError, showSuccess, showInfo } from "@/lib/toast-utils"

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

function OrderMobileCards({
  orders,
  emptyText,
}: {
  orders: any[]
  emptyText: string
}) {
  if (orders.length === 0) {
    return <p className="md:hidden py-4 text-center text-meta text-slate-500">{emptyText}</p>
  }

  return (
    <div className="md:hidden space-y-2">
      {orders.map((order, idx) => {
        const statusLabel =
          order.status === "completed"
            ? "Hoàn thành"
            : order.status === "active"
              ? "Đang thuê"
              : order.status === "pending"
                ? "Chờ giao"
                : order.status
        return (
          <article
            key={order.id || idx}
            className="rounded-[var(--radius-container)] border border-slate-200 bg-white p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-meta text-slate-400 font-mono">#{idx + 1}</p>
                <p className="text-body font-semibold text-slate-900 break-words">
                  {order.customerName || "Khách lẻ"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center px-2 py-0.5 rounded-[var(--radius-badge)] text-meta font-semibold",
                  order.status === "completed"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : order.status === "active"
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                )}
              >
                {statusLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-body text-slate-800">{order.vehicleName || "Xe thuê"}</span>
              {order.licensePlate && (
                <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-meta font-mono font-bold">
                  {order.licensePlate}
                </span>
              )}
            </div>
            <p className="text-meta text-slate-500">
              {order.startDate || "—"} → {order.endDate || "—"}
            </p>
            <p className="text-body font-semibold text-slate-900 money text-right">
              {formatPrice(order.revenue || order.totalPrice || 0)}
            </p>
          </article>
        )
      })}
    </div>
  )
}

async function saveReportPng(blob: Blob, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" })
  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Báo cáo tổng kết ngày" })
      return "shared"
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return "cancelled"
  }

  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.rel = "noopener"
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 8000)
  }
  return "downloaded"
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const printAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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

  const captureReportBlob = async (skipImages: boolean) => {
    const printArea = printAreaRef.current
    if (!printArea) throw new Error("Không tìm thấy nội dung báo cáo")

    return toBlob(printArea, {
      quality: 0.95,
      pixelRatio: window.innerWidth < 768 ? 1.5 : 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
      skipFonts: true,
      filter: (node) => {
        if (node instanceof HTMLElement && node.classList.contains("print:hidden")) return false
        if (skipImages && node instanceof HTMLImageElement) return false
        return true
      },
    })
  }

  const handleDownloadImage = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      await new Promise((res) => setTimeout(res, 80))
      let blob: Blob | null = null
      try {
        blob = await Promise.race([
          captureReportBlob(false),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 18000)
          ),
        ])
      } catch {
        blob = await captureReportBlob(true)
      }

      if (!blob) throw new Error("Không tạo được ảnh")

      const fileDate = formattedSelectedDate.replace(/\//g, "-")
      const filename = `Bao-Cao-Ngay-${fileDate}.png`
      const result = await saveReportPng(blob, filename)

      if (result === "cancelled") {
        showInfo("Đã hủy chia sẻ ảnh báo cáo")
        return
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))

      if (result === "shared") {
        showSuccess("Đã chia sẻ ảnh báo cáo")
      } else {
        showSuccess("Đã tạo ảnh báo cáo", "Nếu chưa thấy file, giữ ảnh bên dưới để lưu vào máy.")
      }
    } catch (err) {
      console.error("Error exporting image:", err)
      showError("Không tạo được ảnh báo cáo", "Thử lại hoặc chụp màn hình cửa sổ này.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl w-[min(100vw-0.75rem,64rem)] max-w-[min(100vw-0.75rem,64rem)] max-h-[min(96dvh,calc(100dvh-0.75rem))] overflow-x-hidden overflow-y-auto bg-slate-50 p-0 rounded-xl sm:rounded-2xl border-slate-200 shadow-xl min-w-0">
        {/* Printable Canvas Section */}
        <div
          id="daily-summary-print-area"
          ref={printAreaRef}
          className="p-3.5 sm:p-7 space-y-4 sm:space-y-5 bg-white rounded-t-xl sm:rounded-t-2xl min-w-0 max-w-full overflow-x-hidden"
        >
          
          {/* Light & Clean Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 pr-10 sm:pr-8 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-5 sm:h-6 bg-red-500 rounded-full shrink-0" />
                <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                  Báo Cáo Tổng Kết Ngày
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {formattedSelectedDate}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-normal pl-3.5">
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

          {/* Light Minimalist KPI Summary Cards (2x2 grid on mobile) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 min-w-0">
            {/* Card 1: Doanh Thu - Red Money Highlight */}
            <div className="min-w-0 bg-red-50/40 border border-red-200/80 rounded-xl p-2.5 sm:p-4">
              <span className="text-meta font-semibold text-red-800 uppercase tracking-wider block leading-tight">
                Doanh thu thực thu
              </span>
              <div className="mt-1 sm:mt-1.5">
                <span className="text-sm sm:text-2xl font-bold text-red-600 money block break-words leading-tight">
                  {formatPrice(dailyRevenue)}
                </span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-meta text-slate-500 font-normal">
                {completedOrders.length} đơn hoàn thành
              </div>
            </div>

            {/* Card 2: Đơn Giao Trong Ngày */}
            <div className="min-w-0 bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 sm:p-4">
              <span className="text-meta font-semibold text-slate-600 uppercase tracking-wider block leading-tight">
                Đơn giao xe
              </span>
              <div className="mt-1 sm:mt-1.5 flex items-baseline gap-1 flex-wrap">
                <span className="text-base sm:text-2xl font-bold text-slate-900">
                  {dispatchedOrders.length}
                </span>
                <span className="text-meta text-slate-500 font-medium">đơn ({dispatchedVehiclesCount} xe)</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-meta text-slate-500 font-normal">
                Bàn giao cho khách
              </div>
            </div>

            {/* Card 3: Đơn Nhận xe trong ngày */}
            <div className="min-w-0 bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 sm:p-4">
              <span className="text-meta font-semibold text-slate-600 uppercase tracking-wider block leading-tight">
                Đơn nhận xe
              </span>
              <div className="mt-1 sm:mt-1.5 flex items-baseline gap-1 flex-wrap">
                <span className="text-base sm:text-2xl font-bold text-slate-900">
                  {completedOrders.length}
                </span>
                <span className="text-meta text-slate-500 font-medium">đơn ({completedVehiclesCount} xe)</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-meta text-slate-500 font-normal">
                Trả xe hoàn thành
              </div>
            </div>

            {/* Card 4: Xe Sẵn Sàng */}
            <div className="min-w-0 bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 sm:p-4">
              <span className="text-meta font-semibold text-slate-600 uppercase tracking-wider block leading-tight">
                Xe sẵn sàng
              </span>
              <div className="mt-1 sm:mt-1.5 flex items-baseline gap-1 flex-wrap">
                <span className="text-base sm:text-2xl font-bold text-slate-900">
                  {vehicleStats.available.length}
                </span>
                <span className="text-meta text-slate-500 font-medium">xe</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-meta text-slate-500 font-medium leading-snug">
                {availableVision.length} Vision · {availableAB.length} AB · {availableOthers.length} khác
              </div>
            </div>
          </div>

          {/* BẢNG 1: Đơn giao xe trong ngày */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pt-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-start gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                <span className="text-pretty">1. Đơn giao xe trong ngày ({formattedSelectedDate})</span>
              </h3>
              <span className="text-meta text-slate-500 font-medium pl-3 sm:pl-0 shrink-0">
                Tổng: <strong className="text-slate-900 font-semibold">{dispatchedOrders.length}</strong> đơn ({dispatchedVehiclesCount} xe)
              </span>
            </div>

            <OrderMobileCards
              orders={dispatchedOrders}
              emptyText="Không có đơn giao xe nào trong ngày này."
            />

            <div className="hidden md:block overflow-x-auto max-w-full border border-slate-200/80 rounded-xl bg-white shadow-2xs">
              <table className="w-full min-w-[540px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-2.5 w-9 text-center font-normal">STT</th>
                    <th className="py-2.5 px-2.5 min-w-[110px]">Khách Hàng</th>
                    <th className="py-2.5 px-2.5 min-w-[140px]">Xe Thuê & Biển Số</th>
                    <th className="py-2.5 px-2.5 min-w-[130px] text-center">Thời Gian Thuê</th>
                    <th className="py-2.5 px-2.5 min-w-[95px] text-center">Trạng Thái</th>
                    <th className="py-2.5 px-2.5 min-w-[110px] text-right">Doanh Thu / Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dispatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        <p className="font-normal text-slate-500 text-xs">Không có đơn giao xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    dispatchedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-2.5 text-center font-mono text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-800">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-900">{order.vehicleName || "Xe thuê"}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {order.licensePlate && (
                              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px] sm:text-[11px] font-mono font-bold shrink-0 shadow-2xs">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-center text-[11px] text-slate-500 whitespace-nowrap">
                          {order.startDate || "—"} → {order.endDate || "—"}
                        </td>
                        {/* HIGHLIGHTED 2: Trạng Thái */}
                        <td className="py-2 px-2.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shadow-2xs",
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
                        {/* Số Tiền từng xe (màu đen) */}
                        <td className="py-2 px-2.5 text-right font-bold text-slate-900 font-mono text-xs whitespace-nowrap">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dispatchedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200 text-xs">
                      <td colSpan={4} className="py-2 px-2.5 text-[10px] sm:text-xs">
                        TỔNG CỘNG ĐƠN GIAO XE ({dispatchedOrders.length} ĐƠN - {dispatchedVehiclesCount} XE)
                      </td>
                      <td className="py-2 px-2.5 text-center"></td>
                      {/* HIGHLIGHTED 3: Số Tiền Tổng RED COLOR */}
                      <td className="py-2 px-2.5 text-right font-mono text-red-600 text-xs sm:text-sm font-bold whitespace-nowrap">
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
          <div className="space-y-1.5 sm:space-y-2 pt-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-start gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <span className="text-pretty">2. Đơn hoàn thành và nhận lại xe ({formattedSelectedDate})</span>
              </h3>
              <span className="text-meta text-slate-500 font-medium pl-3 sm:pl-0 shrink-0">
                Tổng: <strong className="text-slate-900 font-semibold">{completedOrders.length}</strong> đơn ({completedVehiclesCount} xe)
              </span>
            </div>

            <OrderMobileCards
              orders={completedOrders}
              emptyText="Không có đơn hoàn thành nhận lại xe nào trong ngày này."
            />

            <div className="hidden md:block overflow-x-auto max-w-full border border-slate-200/80 rounded-xl bg-white shadow-2xs">
              <table className="w-full min-w-[540px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-2.5 w-9 text-center font-normal">STT</th>
                    <th className="py-2.5 px-2.5 min-w-[110px]">Khách Hàng</th>
                    <th className="py-2.5 px-2.5 min-w-[140px]">Xe Thuê & Biển Số</th>
                    <th className="py-2.5 px-2.5 min-w-[130px] text-center">Thời Gian Thuê</th>
                    <th className="py-2.5 px-2.5 min-w-[95px] text-center">Trạng Thái</th>
                    <th className="py-2.5 px-2.5 min-w-[110px] text-right">Doanh Thu Thực Thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {completedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        <p className="font-normal text-slate-500 text-xs">Không có đơn hoàn thành nhận lại xe nào trong ngày này.</p>
                      </td>
                    </tr>
                  ) : (
                    completedOrders.map((order, idx) => (
                      <tr key={order.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-2.5 text-center font-mono text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-800">
                          {order.customerName || "Khách lẻ"}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-900">{order.vehicleName || "Xe thuê"}</span>
                            {/* HIGHLIGHTED 1: Biển Số Xe */}
                            {order.licensePlate && (
                              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px] sm:text-[11px] font-mono font-bold shrink-0 shadow-2xs">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-center text-[11px] text-slate-500 whitespace-nowrap">
                          {order.startDate || "—"} → {order.endDate || "—"}
                        </td>
                        {/* HIGHLIGHTED 2: Trạng Thái */}
                        <td className="py-2 px-2.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs">
                            Hoàn thành
                          </span>
                        </td>
                        {/* Số Tiền từng xe (màu đen) */}
                        <td className="py-2 px-2.5 text-right font-bold text-slate-900 font-mono text-xs whitespace-nowrap">
                          {formatPrice(order.revenue || order.totalPrice || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {completedOrders.length > 0 && (
                  <tfoot>
                    <tr className="bg-red-50/30 font-bold text-slate-900 border-t border-red-200/80 text-xs">
                      <td colSpan={4} className="py-2 px-2.5 text-[10px] sm:text-xs">
                        TỔNG CỘNG ĐƠN NHẬN XE ({completedOrders.length} ĐƠN - {completedVehiclesCount} XE)
                      </td>
                      <td className="py-2 px-2.5 text-center"></td>
                      {/* HIGHLIGHTED 3: Số Tiền Tổng RED COLOR */}
                      <td className="py-2 px-2.5 text-right font-mono text-red-600 text-xs sm:text-sm font-bold whitespace-nowrap">
                        {formatPrice(dailyRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100/90 p-2.5 sm:px-6 sm:py-3.5 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 print:hidden rounded-b-xl sm:rounded-b-2xl">
          <Button
            onClick={onClose}
            className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs h-11 sm:h-9 px-4 rounded-lg shadow-2xs"
          >
            Đóng cửa sổ
          </Button>
          <Button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 !text-white font-semibold text-xs h-11 sm:h-9 px-4 rounded-lg shadow-2xs transition"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isExporting ? "Đang tạo ảnh..." : "Tải ảnh báo cáo"}
          </Button>
        </div>

        {previewUrl && (
          <div className="print:hidden border-t border-slate-200 bg-white p-3 sm:p-4 space-y-2 rounded-b-xl">
            <p className="text-meta text-slate-600">
              Ảnh đã tạo. Trên điện thoại: giữ vào ảnh rồi chọn Lưu ảnh.
            </p>
            <img
              src={previewUrl}
              alt="Ảnh báo cáo tổng kết ngày"
              className="w-full max-h-[40vh] object-contain rounded-[var(--radius-control)] border border-slate-200 bg-slate-50"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
