"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Bell,
  Phone,
  MessageCircle,
  Calendar,
  Bike,
  User,
  Clock,
  ArrowRight,
  X,
  Volume2,
  CheckCircle2,
  DollarSign
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface IncomingOrder {
  id: string
  customerName?: string
  phone?: string
  vehicleName?: string
  licensePlate?: string
  startDate?: string
  endDate?: string
  totalDays?: number
  totalPrice?: number
  notes?: string
  created_at?: string
  customerId?: string
  vehicleId?: string
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    // Am thanh chuong 4 am (C5 -> E5 -> G5 -> C6)
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.35 },
      { freq: 659.25, time: 0.10, dur: 0.35 },
      { freq: 783.99, time: 0.20, dur: 0.40 },
      { freq: 1046.50, time: 0.30, dur: 0.60 },
    ]

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time)

      gain.gain.setValueAtTime(0.001, ctx.currentTime + time)
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + time)
      osc.stop(ctx.currentTime + time + dur + 0.05)
    })
  } catch (e) {
    console.warn("Could not play chime:", e)
  }
}

export function NewOrderRealtimeNotifier() {
  const router = useRouter()
  const [activeOrder, setActiveOrder] = useState<IncomingOrder | null>(null)
  const [orderQueue, setOrderQueue] = useState<IncomingOrder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const lastProcessedIdRef = useRef<string | null>(null)

  const handleNewOrder = useCallback(async (rental: any) => {
    if (!rental || !rental.id) return
    if (lastProcessedIdRef.current === rental.id) return
    lastProcessedIdRef.current = rental.id

    // Fetch customer phone if not in rental object
    let customerPhone = rental.phone || ""
    if (!customerPhone && rental.customerId) {
      try {
        const { data: cust } = await supabase
          .from("customers")
          .select("phone")
          .eq("id", rental.customerId)
          .single()
        if (cust?.phone) {
          customerPhone = cust.phone
        }
      } catch (err) {
        console.warn("Could not fetch customer phone for notification:", err)
      }
    }

    const newOrder: IncomingOrder = {
      id: rental.id,
      customerName: rental.customerName || rental.customer_name || "Khách đặt từ Web",
      phone: customerPhone,
      vehicleName: rental.vehicleName || rental.vehicle_name || "Xe máy",
      licensePlate: rental.licensePlate || rental.license_plate || "",
      startDate: rental.startDate || rental.start_date || "",
      endDate: rental.endDate || rental.end_date || "",
      totalDays: rental.totalDays || rental.total_days || 1,
      totalPrice: rental.totalPrice || rental.total_price || 0,
      notes: rental.notes || "",
      created_at: rental.created_at || new Date().toISOString(),
      customerId: rental.customerId || rental.customer_id,
      vehicleId: rental.vehicleId || rental.vehicle_id,
    }

    playNotificationChime()

    setActiveOrder((prev) => {
      if (!prev) {
        setIsOpen(true)
        return newOrder
      } else {
        setOrderQueue((q) => [...q, newOrder])
        return prev
      }
    })
  }, [])

  useEffect(() => {
    // 1. Supabase Realtime Listener on 'rentals' table
    const channel = supabase
      .channel("realtime-new-rentals-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rentals" },
        (payload) => {
          if (payload.new) {
            handleNewOrder(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [handleNewOrder])

  const handleClose = () => {
    setIsOpen(false)
    // If there are more orders in queue, show next
    setTimeout(() => {
      if (orderQueue.length > 0) {
        const next = orderQueue[0]
        setOrderQueue((q) => q.slice(1))
        setActiveOrder(next)
        setIsOpen(true)
        playNotificationChime()
      } else {
        setActiveOrder(null)
      }
    }, 300)
  }

  const handleViewOrders = () => {
    setIsOpen(false)
    setActiveOrder(null)
    setOrderQueue([])
    router.push("/dashboard/orders")
  }

  if (!activeOrder) return null

  const cleanPhone = activeOrder.phone ? activeOrder.phone.replace(/\D/g, "") : ""
  const zaloUrl = cleanPhone ? `https://zalo.me/${cleanPhone}` : ""
  const callUrl = cleanPhone ? `tel:${cleanPhone}` : ""

  const formatMoney = (val?: number) => {
    if (!val) return "0 đ"
    return new Intl.NumberFormat("vi-VN").format(val) + " đ"
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[95vw] sm:max-w-lg p-0 overflow-hidden rounded-2xl bg-white shadow-2xl border border-blue-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Alert Gradient */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 text-white p-5 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Bell className="w-36 h-36" />
          </div>

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/25 shadow-inner animate-bounce">
                <Bell className="w-6 h-6 text-amber-300 fill-amber-300" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/90 text-slate-950 text-[11px] font-black tracking-wide uppercase mb-1">
                  Đơn đặt mới từ Web
                </span>
                <DialogTitle className="text-xl font-bold text-white leading-tight">
                  Khách Hàng Đặt Xe Mới!
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-100 font-medium">
                  Vui lòng liên hệ khách sớm để xác nhận và chốt xe
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Customer & Vehicle Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
            {/* Customer Info */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/60">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-500 font-medium">Khách hàng đặt xe</p>
                <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  {activeOrder.customerName}
                </p>
              </div>
              {activeOrder.phone && (
                <div className="text-right space-y-0.5">
                  <p className="text-xs text-slate-500 font-medium">Số điện thoại</p>
                  <p className="text-base font-bold text-blue-700 font-mono">
                    {activeOrder.phone}
                  </p>
                </div>
              )}
            </div>

            {/* Vehicle & Pricing Info */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Bike className="w-3.5 h-3.5 text-slate-400" />
                  Xe yêu cầu
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {activeOrder.vehicleName}
                </p>
                {activeOrder.licensePlate && (
                  <span className="inline-block text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    {activeOrder.licensePlate}
                  </span>
                )}
              </div>

              <div className="space-y-0.5 text-right">
                <p className="text-xs text-slate-500 font-medium flex items-center justify-end gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Tổng tiền dự kiến
                </p>
                <p className="text-base font-extrabold text-emerald-600">
                  {formatMoney(activeOrder.totalPrice)}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {activeOrder.totalDays} ngày thuê
                </p>
              </div>
            </div>

            {/* Rental Duration */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-200/60 flex items-center justify-between text-xs text-slate-700">
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Nhận: <strong className="text-slate-900">{activeOrder.startDate}</strong></span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Trả: <strong className="text-slate-900">{activeOrder.endDate}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2.5">
              {callUrl ? (
                <a
                  href={callUrl}
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition active:scale-[0.98]"
                >
                  <Phone className="w-4 h-4 animate-pulse" />
                  Gọi khách ngay
                </a>
              ) : (
                <Button disabled className="h-11 rounded-xl">
                  <Phone className="w-4 h-4 mr-2" />
                  Chưa có SĐT
                </Button>
              )}

              {zaloUrl ? (
                <a
                  href={zaloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition active:scale-[0.98]"
                >
                  <MessageCircle className="w-4 h-4" />
                  Nhắn Zalo
                </a>
              ) : (
                <Button disabled className="h-11 rounded-xl">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Nhắn Zalo
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 transition"
              onClick={handleViewOrders}
            >
              Xem danh sách đơn & Chốt xe
              <ArrowRight className="w-4 h-4 ml-1.5 text-slate-400" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
