"use client"

import React, { useState, useMemo } from "react"
import { Vehicle } from "@/lib/supabase"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { formatDisplayDate } from "@/lib/format-date"
import { classifyVehiclesForTimeline, extractRentalTimes } from "@/lib/vehicle-timeline"
import { cn } from "@/lib/utils"
import { Bike, ChevronDown, Search, Loader2, AlertCircle, ChevronRight } from "lucide-react"

interface RentalOrderLike {
  id: string
  customerId: string
  customerName: string
  vehicleId: string
  vehicleName: string
  licensePlate: string
  startDate: string
  endDate: string
  totalDays: number
  pricePerDay: number
  totalPrice: number
  notes?: string
  status?: string
}

interface QuickAssignVehiclePopoverProps {
  order: RentalOrderLike
  vehicles: Vehicle[]
  orders: any[]
  onAssign: (order: any, selectedVehicle: Vehicle) => Promise<void> | void
  onOpenAssignModal?: (order: any) => void
  className?: string
  align?: "start" | "center" | "end"
}

export function QuickAssignVehiclePopover({
  order,
  vehicles,
  orders,
  onAssign,
  onOpenAssignModal,
  className,
  align = "start",
}: QuickAssignVehiclePopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [assigningVehicleId, setAssigningVehicleId] = useState<string | null>(null)

  const times = useMemo(() => extractRentalTimes(order.notes), [order.notes])

  const evaluatedVehicles = useMemo(() => {
    if (!isOpen) return []
    const evaluated = classifyVehiclesForTimeline(
      vehicles,
      order.startDate,
      order.endDate,
      orders,
      order.id,
      times.pickupTime,
      times.returnTime
    )

    return evaluated.allEvaluated.sort((a, b) => {
      const rank = { optimal: 1, conditional: 2, unavailable: 3 }
      return rank[a.status.statusCategory] - rank[b.status.statusCategory]
    })
  }, [isOpen, vehicles, order.startDate, order.endDate, order.id, orders, times.pickupTime, times.returnTime])

  const filteredVehicles = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return evaluatedVehicles
    return evaluatedVehicles.filter(({ vehicle }) => {
      const matchName = vehicle.name.toLowerCase().includes(q)
      const matchPlate = vehicle.licensePlate ? vehicle.licensePlate.toLowerCase().includes(q) : false
      return matchName || matchPlate
    })
  }, [evaluatedVehicles, search])

  const availableCount = useMemo(() => {
    return evaluatedVehicles.filter((item) => item.status.isAvailable).length
  }, [evaluatedVehicles])

  const handleSelect = async (v: Vehicle) => {
    if (assigningVehicleId) return
    try {
      setAssigningVehicleId(v.id)
      await onAssign(order, v)
      setIsOpen(false)
    } finally {
      setAssigningVehicleId(null)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-1.5 font-mono font-bold px-2.5 py-1 rounded-[var(--radius-badge)] text-xs sm:text-sm tracking-wider uppercase whitespace-nowrap shadow-2xs transition-all duration-150 cursor-pointer active:scale-95",
            "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
            className
          )}
          title="Nhấn để sổ danh sách xe và chọn gán nhanh"
        >
          <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span>CHỜ GÁN XE</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-amber-700 opacity-70 group-hover:opacity-100 transition-transform duration-200 shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[320px] sm:w-[380px] p-0 shadow-xl border-slate-200 rounded-xl overflow-hidden bg-white z-50 text-slate-800"
      >
        {/* Header */}
        <div className="p-3 bg-slate-50/90 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Bike className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Sổ danh sách xe gán nhanh</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
              {availableCount} xe sẵn sàng
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-tight">
            Khách: <strong className="text-slate-800">{order.customerName}</strong> ({order.totalDays} ngày: {formatDisplayDate(order.startDate)} → {formatDisplayDate(order.endDate)})
          </p>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Tìm theo tên xe hoặc biển số..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50/80 border-slate-200 focus:bg-white rounded-lg"
              autoFocus
            />
          </div>
        </div>

        {/* Vehicle list */}
        <div className="max-h-64 sm:max-h-72 overflow-y-auto divide-y divide-slate-100/80 p-1 bg-white">
          {filteredVehicles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-1">
              <AlertCircle className="w-5 h-5 mx-auto text-slate-300" />
              <p>Không tìm thấy xe nào phù hợp</p>
            </div>
          ) : (
            filteredVehicles.map(({ vehicle: v, status }) => {
              const isBlocked = !status.isAvailable
              const isAssigningThis = assigningVehicleId === v.id

              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={isBlocked || isAssigningThis || !!assigningVehicleId}
                  onClick={() => handleSelect(v)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg flex items-center justify-between gap-2.5 text-xs transition-colors",
                    !isBlocked && "hover:bg-emerald-50/70 cursor-pointer active:bg-emerald-100/70",
                    isBlocked && "opacity-55 bg-slate-50/60 cursor-not-allowed text-slate-400"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 truncate">{v.name}</span>
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.2 rounded-full inline-flex items-center",
                          status.badgeTone === "emerald" && "bg-emerald-100 text-emerald-800",
                          status.badgeTone === "amber" && "bg-amber-100 text-amber-900 border border-amber-300",
                          status.badgeTone === "rose" && "bg-rose-100 text-rose-800",
                          status.badgeTone === "slate" && "bg-slate-100 text-slate-600"
                        )}
                      >
                        {status.badgeLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                      <span className="bg-slate-100 text-slate-800 font-bold px-1.5 py-0.2 rounded border border-slate-200">
                        {v.licensePlate}
                      </span>
                      <span>· {v.pricePerDay.toLocaleString("vi-VN")} đ/ngày</span>
                    </div>

                    {status.reason && (
                      <p className="text-[10px] text-amber-700 truncate font-sans">{status.reason}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isAssigningThis ? (
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    ) : !isBlocked ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
                        Chọn
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Bận</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        {onOpenAssignModal && (
          <div className="p-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Cần gán nhiều xe cùng lúc?</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenAssignModal(order)
              }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Mở giao diện gán</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
