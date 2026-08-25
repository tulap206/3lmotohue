"use client"

import React, { useState, useMemo } from "react"
import { Vehicle, Rental } from "@/lib/supabase"
import {
  generateTimelineGrid,
  TimelineDay,
  VehicleTimelineRow,
  normalizeDate,
  extractRentalTimes,
} from "@/lib/vehicle-timeline"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Bike,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Sparkles,
  DollarSign,
  ArrowRight,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface FleetTimelineViewProps {
  vehicles: Vehicle[]
  rentals: Rental[]
  onSelectOrder?: (order: Rental) => void
  onQuickBookVehicle?: (vehicle: Vehicle, date: Date) => void
}

export function FleetTimelineView({
  vehicles,
  rentals,
  onSelectOrder,
  onQuickBookVehicle,
}: FleetTimelineViewProps) {
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [daysSpan, setDaysSpan] = useState<number>(14)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)

  // Lọc xe theo từ khóa tìm kiếm
  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles
    const q = searchQuery.toLowerCase().trim()
    return vehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.licensePlate && v.licensePlate.toLowerCase().includes(q)) ||
        (v.color && v.color.toLowerCase().includes(q))
    )
  }, [vehicles, searchQuery])

  // Tạo grid dữ liệu theo timeline
  const { days, rows } = useMemo(() => {
    return generateTimelineGrid(filteredVehicles, rentals, startDate, daysSpan)
  }, [filteredVehicles, rentals, startDate, daysSpan])

  // Thống kê nhanh
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let rentedToday = 0
    let pendingFuture = 0
    let availableToday = 0

    vehicles.forEach((v) => {
      if (v.status === "maintenance") return
      const vRentals = rentals.filter(
        (r) => r.vehicleId === v.id && r.status !== "cancelled" && r.status !== "completed"
      )

      let isBusyToday = false
      vRentals.forEach((r) => {
        const s = normalizeDate(r.startDate)
        const e = normalizeDate(r.endDate)
        if (!s || !e) return

        if (today >= s && today <= e) {
          isBusyToday = true
          rentedToday++
        } else if (s > today) {
          pendingFuture++
        }
      })

      if (!isBusyToday) {
        availableToday++
      }
    })

    return { rentedToday, pendingFuture, availableToday }
  }, [vehicles, rentals])

  // Điều hướng ngày
  const handlePrevPeriod = () => {
    const next = new Date(startDate)
    next.setDate(next.getDate() - 7)
    setStartDate(next)
  }

  const handleNextPeriod = () => {
    const next = new Date(startDate)
    next.setDate(next.getDate() + 7)
    setStartDate(next)
  }

  const handleGoToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setStartDate(d)
  }

  const formatMoney = (val?: number) => {
    if (!val) return "0 đ"
    return new Intl.NumberFormat("vi-VN").format(val) + " đ"
  }

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar & Thống kê nhanh */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Sơ Đồ Điều Phối Lịch Xe (Gantt Timeline)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi lịch thuê liên tục, phát hiện khoảng trống và tránh trùng lịch khi đặt trước
            </p>
          </div>

          {/* Quick stats badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Rảnh hôm nay: <strong>{stats.availableToday} xe</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <span className="size-2 rounded-full bg-blue-500" />
              Đang chạy: <strong>{stats.rentedToday} xe</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <span className="size-2 rounded-full bg-amber-500" />
              Đã đặt trước: <strong>{stats.pendingFuture} đơn</strong>
            </span>
          </div>
        </div>

        {/* Filter & Date controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm tên xe, biển số..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50"
              />
            </div>

            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold text-slate-600">
              {[7, 14, 30].map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => setDaysSpan(span)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition",
                    daysSpan === span
                      ? "bg-white text-blue-700 shadow-sm font-black"
                      : "hover:text-slate-900"
                  )}
                >
                  {span} ngày
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGoToday}
              className="h-9 px-3 rounded-xl text-xs font-bold border-slate-300 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              Hôm nay
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePrevPeriod}
                className="h-9 w-9 rounded-xl border-slate-300"
                title="Lùi 7 ngày"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-mono font-bold px-2 text-slate-700">
                {days[0]?.dateStr} → {days[days.length - 1]?.dateStr}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleNextPeriod}
                className="h-9 w-9 rounded-xl border-slate-300"
                title="Tiến 7 ngày"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Timeline Grid Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full border-collapse text-xs select-none">
            {/* Header: Dates */}
            <thead className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
              <tr>
                <th className="sticky left-0 z-40 bg-slate-900 px-2.5 sm:px-4 py-2.5 sm:py-3 text-left font-bold border-r border-slate-800 min-w-[140px] max-w-[160px] sm:min-w-[200px] sm:max-w-[220px]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Bike className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
                    <span className="truncate">Đội Xe ({filteredVehicles.length})</span>
                  </div>
                </th>
                {days.map((day, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-1.5 sm:px-2 py-1.5 sm:py-2 text-center border-r border-slate-800 font-medium min-w-[44px] max-w-[55px] sm:min-w-[50px] sm:max-w-[65px] transition-colors",
                      day.isToday && "bg-blue-600 text-white font-bold ring-2 ring-blue-400 z-10",
                      day.isWeekend && !day.isToday && "bg-slate-800/80 text-amber-300"
                    )}
                  >
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold opacity-80">{day.dayOfWeek}</div>
                    <div className="text-[11px] sm:text-xs font-mono font-black mt-0.5">{day.dateStr}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body: Vehicle rows */}
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 1} className="py-12 text-center text-slate-400 text-sm font-medium">
                    Không tìm thấy xe phù hợp
                  </td>
                </tr>
              ) : (
                rows.map(({ vehicle, slots }) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Sticky Vehicle Info */}
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-r border-slate-200 shadow-sm min-w-[140px] max-w-[160px] sm:min-w-[200px] sm:max-w-[220px]">
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 truncate">{vehicle.name}</span>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded",
                              vehicle.status === "maintenance"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-700"
                            )}
                          >
                            {vehicle.status === "maintenance" ? "Bảo trì" : vehicle.color || "Xe máy"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1 rounded border border-blue-100">
                            {vehicle.licensePlate}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {vehicle.pricePerDay ? `${(vehicle.pricePerDay / 1000).toFixed(0)}k` : "120k"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Timeline Day Cells */}
                    {slots.map((slot, sIdx) => {
                      const { day, rental, isStart, isEnd, isMiddle, isMaintenance, isAvailable } = slot

                      if (isMaintenance) {
                        return (
                          <td
                            key={sIdx}
                            className={cn(
                              "p-1 border-r border-slate-100 text-center bg-rose-50/80 text-rose-700",
                              day.isToday && "ring-1 ring-blue-400 inset-0"
                            )}
                            title="Xe đang trong xưởng bảo dưỡng"
                          >
                            <div className="h-9 rounded flex items-center justify-center bg-rose-200/70 border border-rose-300">
                              <Wrench className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                            </div>
                          </td>
                        )
                      }

                      if (rental) {
                        const isPending = rental.status === "pending"
                        const isActive = rental.status === "active"

                        return (
                          <td
                            key={sIdx}
                            className={cn(
                              "p-0.5 border-r border-slate-100 text-center relative",
                              day.isToday && "bg-blue-50/40"
                            )}
                          >
                            <div
                              onClick={() => {
                                setSelectedRental(rental)
                                setSelectedVehicle(vehicle)
                              }}
                              className={cn(
                                "h-9 flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm relative group/bar",
                                isActive && "bg-emerald-600 hover:bg-emerald-700 text-white",
                                isPending && "bg-amber-500 hover:bg-amber-600 text-white",
                                isStart && isEnd && "rounded-lg mx-0.5",
                                isStart && !isEnd && "rounded-l-lg ml-0.5 mr-0",
                                !isStart && isEnd && "rounded-r-lg mr-0.5 ml-0",
                                isMiddle && "rounded-none mx-0"
                              )}
                              title={`${rental.customerName} (${rental.startDate} -> ${rental.endDate})`}
                            >
                              {isStart && (
                                <div className="text-[10px] font-bold truncate px-1 flex items-center gap-0.5">
                                  <User className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[60px]">{rental.customerName?.split(" ").pop()}</span>
                                </div>
                              )}
                              {!isStart && isEnd && (
                                <span className="text-[9px] font-mono opacity-80 truncate">Trả</span>
                              )}
                              {isMiddle && (
                                <span className="size-1.5 rounded-full bg-white/40" />
                              )}
                            </div>
                          </td>
                        )
                      }

                      // Empty / Available slot
                      return (
                        <td
                          key={sIdx}
                          onClick={() => {
                            if (onQuickBookVehicle) {
                              onQuickBookVehicle(vehicle, day.date)
                            }
                          }}
                          className={cn(
                            "p-1 border-r border-slate-100 text-center cursor-pointer transition-colors",
                            day.isToday ? "bg-blue-50/60 hover:bg-blue-100/70" : "hover:bg-emerald-50/60"
                          )}
                          title={`Xe trống vào ${day.dateStr} - Nhấp để tạo đơn`}
                        >
                          <div className="h-9 rounded-lg border border-dashed border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/50 flex items-center justify-center text-slate-300 hover:text-emerald-600 transition">
                            <span className="text-[9px] font-mono opacity-0 hover:opacity-100 font-bold">+</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-slate-700">Chú thích lịch:</span>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-emerald-600" />
              <span>Đang thuê (Active)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-amber-500" />
              <span>Đặt trước / Chờ giao (Pending)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-rose-200 border border-rose-400" />
              <span>Bảo trì</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded border border-dashed border-slate-300 bg-white" />
              <span>Khoảng rảnh (Bấm vào để tạo đơn)</span>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 italic">
            * Bấm vào ô đơn thuê để xem chi tiết & điều phối đổi xe
          </span>
        </div>
      </div>

      {/* 3. Modal xem chi tiết đơn khi bấm vào thanh Gantt */}
      {selectedRental && (
        <Dialog open={Boolean(selectedRental)} onOpenChange={(open) => !open && setSelectedRental(null)}>
          <DialogContent className="sm:max-w-md p-5 rounded-2xl bg-white shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                    selectedRental.status === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  {selectedRental.status === "active" ? "Đang thuê" : "Đặt trước"}
                </span>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Chi Tiết Đơn Thuê
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Thông tin điều phối xe trên sơ đồ Timeline
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Khách hàng:</span>
                  <strong className="text-sm font-bold text-slate-900 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {selectedRental.customerName}
                  </strong>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Xe gán:</span>
                  <strong className="text-slate-900 font-mono">
                    {selectedVehicle ? `${selectedVehicle.name} (${selectedVehicle.licensePlate})` : selectedRental.vehicleName}
                  </strong>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Thời gian thuê:</span>
                  <span className="font-bold text-slate-800">
                    {selectedRental.startDate} ➔ {selectedRental.endDate} ({selectedRental.totalDays} ngày)
                  </span>
                </div>

                {(() => {
                  const times = extractRentalTimes(selectedRental.notes)
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Giờ nhận ➔ Giờ trả:</span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {times.pickupTime} ➔ {times.returnTime}
                      </span>
                    </div>
                  )
                })()}

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tổng tiền:</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {formatMoney(selectedRental.totalPrice)}
                  </span>
                </div>

                {selectedRental.notes && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600">
                    <span className="font-semibold text-slate-700">Ghi chú:</span> {selectedRental.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => setSelectedRental(null)}
              >
                Đóng
              </Button>
              {onSelectOrder && (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  onClick={() => {
                    const r = selectedRental
                    setSelectedRental(null)
                    onSelectOrder(r)
                  }}
                >
                  Chỉnh sửa / Đổi xe
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
