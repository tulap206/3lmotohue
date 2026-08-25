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
  VolumeX,
  CheckCircle2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  AlertCircle
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
  status?: string
}

const STORAGE_ACK_KEY = "3lmoto_acknowledged_order_ids_v1"
const STORAGE_SOUND_KEY = "3lmoto_order_notification_sound_enabled"

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx()
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {})
  }
  return sharedAudioCtx
}

function playNotificationChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }

    // Âm thanh chuông 4 âm hài hòa (C5 -> E5 -> G5 -> C6)
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.25 },
      { freq: 659.25, time: 0.10, dur: 0.25 },
      { freq: 783.99, time: 0.20, dur: 0.30 },
      { freq: 1046.50, time: 0.30, dur: 0.55 },
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

function getAcknowledgedIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_ACK_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveAcknowledgedId(id: string) {
  if (typeof window === "undefined" || !id) return
  try {
    const current = getAcknowledgedIds()
    current.add(id)
    const arr = Array.from(current).slice(-200) // Keep last 200 IDs
    localStorage.setItem(STORAGE_ACK_KEY, JSON.stringify(arr))
  } catch (e) {
    console.warn("Error saving acknowledged order:", e)
  }
}

export function NewOrderRealtimeNotifier() {
  const router = useRouter()
  const [activeOrder, setActiveOrder] = useState<IncomingOrder | null>(null)
  const [orderQueue, setOrderQueue] = useState<IncomingOrder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [pendingWebCount, setPendingWebCount] = useState(0)

  const snoozeMapRef = useRef<Map<string, number>>(new Map())
  const originalTitleRef = useRef<string>("")
  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isAudioUnlockedRef = useRef(false)

  // Khởi tạo & unlock audio context khi người dùng tương tác lần đầu
  useEffect(() => {
    if (typeof window === "undefined") return

    // Load sound preference
    const soundPref = localStorage.getItem(STORAGE_SOUND_KEY)
    if (soundPref !== null) {
      setSoundEnabled(soundPref !== "false")
    }

    const unlockAudio = () => {
      if (isAudioUnlockedRef.current) return
      isAudioUnlockedRef.current = true
      getAudioContext()
      // Yêu cầu quyền Notification nếu chưa hỏi
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {})
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { once: true })
    window.addEventListener("keydown", unlockAudio, { once: true })

    return () => {
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
    }
  }, [])

  // Title flashing alert khi có đơn mới
  useEffect(() => {
    if (typeof document === "undefined") return

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title || "3L Moto Dashboard"
    }

    if (isOpen && activeOrder) {
      let toggle = false
      if (titleIntervalRef.current) clearInterval(titleIntervalRef.current)

      titleIntervalRef.current = setInterval(() => {
        toggle = !toggle
        document.title = toggle
          ? `🔔 (1 ĐƠN MỚI) ${activeOrder.customerName || "Khách đặt xe"}!`
          : `🚨 KHÁCH ĐẶT TỪ WEB - 3L MOTO`
      }, 1000)
    } else {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current)
        titleIntervalRef.current = null
      }
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current
      }
    }

    return () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current)
        titleIntervalRef.current = null
      }
    }
  }, [isOpen, activeOrder])

  // Hàm xử lý đơn mới đến (từ Realtime broadcast, Postgres changes, hoặc Polling)
  const processIncomingOrder = useCallback(async (rawOrder: any, triggerSound = true) => {
    if (!rawOrder || !rawOrder.id) return

    const ackIds = getAcknowledgedIds()
    if (ackIds.has(rawOrder.id)) return

    // Kiểm tra snooze
    const snoozedUntil = snoozeMapRef.current.get(rawOrder.id)
    if (snoozedUntil && Date.now() < snoozedUntil) return

    // Lấy số điện thoại khách hàng nếu chưa có
    let customerPhone = rawOrder.phone || ""
    if (!customerPhone && (rawOrder.customerId || rawOrder.customer_id)) {
      try {
        const cId = rawOrder.customerId || rawOrder.customer_id
        const { data: cust } = await supabase
          .from("customers")
          .select("phone, name")
          .eq("id", cId)
          .single()
        if (cust?.phone) {
          customerPhone = cust.phone
        }
      } catch (err) {
        console.warn("Could not fetch customer phone for notification:", err)
      }
    }

    const newOrder: IncomingOrder = {
      id: rawOrder.id,
      customerName: rawOrder.customerName || rawOrder.customer_name || "Khách đặt từ Web",
      phone: customerPhone,
      vehicleName: rawOrder.vehicleName || rawOrder.vehicle_name || "Xe máy",
      licensePlate: rawOrder.licensePlate || rawOrder.license_plate || "",
      startDate: rawOrder.startDate || rawOrder.start_date || "",
      endDate: rawOrder.endDate || rawOrder.end_date || "",
      totalDays: rawOrder.totalDays || rawOrder.total_days || 1,
      totalPrice: rawOrder.totalPrice || rawOrder.total_price || 0,
      notes: rawOrder.notes || "",
      created_at: rawOrder.created_at || new Date().toISOString(),
      customerId: rawOrder.customerId || rawOrder.customer_id,
      vehicleId: rawOrder.vehicleId || rawOrder.vehicle_id,
      status: rawOrder.status || "pending",
    }

    // Phát âm thanh
    if (triggerSound && soundEnabled) {
      playNotificationChime()
    }

    // Hiển thị Desktop Push Notification nếu tab đang ẩn
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      if (document.hidden) {
        try {
          const notif = new Notification("🏍️ ĐƠN ĐẶT XE MỚI TỪ WEB!", {
            body: `Khách: ${newOrder.customerName} - SĐT: ${newOrder.phone || "Chưa có"} - Xe: ${newOrder.vehicleName}`,
            icon: "/apple-icon.png",
          })
          notif.onclick = () => {
            window.focus()
            notif.close()
          }
        } catch (e) {}
      }
    }

    setActiveOrder((currentActive) => {
      if (!currentActive) {
        setIsOpen(true)
        return newOrder
      } else {
        if (currentActive.id === newOrder.id) return currentActive
        setOrderQueue((prevQueue) => {
          if (prevQueue.some((o) => o.id === newOrder.id)) return prevQueue
          return [...prevQueue, newOrder]
        })
        return currentActive
      }
    })
  }, [soundEnabled])

  // Polling đồng bộ định kỳ các đơn pending từ database (Tránh bỏ lỡ đơn do đứt mạng/realtime chưa active)
  const syncPendingWebOrders = useCallback(async (isInitial = false) => {
    try {
      const { data: pendingRentals, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20)

      if (error || !pendingRentals) return

      const ackIds = getAcknowledgedIds()
      const unhandledOrders = pendingRentals.filter((r) => {
        if (ackIds.has(r.id)) return false
        const snoozedUntil = snoozeMapRef.current.get(r.id)
        if (snoozedUntil && Date.now() < snoozedUntil) return false
        return true
      })

      setPendingWebCount(unhandledOrders.length)

      // Xử lý từng đơn chưa xác nhận
      for (let i = 0; i < unhandledOrders.length; i++) {
        await processIncomingOrder(unhandledOrders[i], isInitial ? i === 0 : true)
      }
    } catch (err) {
      console.warn("Polling pending orders error:", err)
    }
  }, [processIncomingOrder])

  // Hook khởi chạy Realtime & Polling
  useEffect(() => {
    // 1. Initial sync khi mount
    syncPendingWebOrders(true)

    // 2. Kênh Realtime Broadcast trực tiếp (siêu nhanh, không phụ thuộc Postgres replica)
    const broadcastChannel = supabase
      .channel("realtime-order-notifications")
      .on("broadcast", { event: "new_order" }, (payload) => {
        if (payload?.payload) {
          processIncomingOrder(payload.payload, true)
          syncPendingWebOrders(false)
        }
      })
      .subscribe()

    // 3. Kênh Postgres Changes (khi table rentals có INSERT)
    const postgresChannel = supabase
      .channel("realtime-new-rentals-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rentals" },
        (payload) => {
          if (payload.new) {
            processIncomingOrder(payload.new, true)
            syncPendingWebOrders(false)
          }
        }
      )
      .subscribe()

    // 4. Smart Polling mỗi 8 giây để đảm bảo 100% không bao giờ trễ/mất đơn
    const interval = setInterval(() => {
      syncPendingWebOrders(false)
    }, 8000)

    // 5. Khi người dùng focus quay lại tab, kiểm tra ngay lập tức
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncPendingWebOrders(false)
      }
    }
    window.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleVisibilityChange)

    return () => {
      supabase.removeChannel(broadcastChannel)
      supabase.removeChannel(postgresChannel)
      clearInterval(interval)
      window.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleVisibilityChange)
    }
  }, [processIncomingOrder, syncPendingWebOrders])

  // Xử lý đóng modal hoặc chuyển sang đơn kế tiếp
  const handleAcknowledgeCurrent = () => {
    if (activeOrder) {
      saveAcknowledgedId(activeOrder.id)
    }

    if (orderQueue.length > 0) {
      const next = orderQueue[0]
      setOrderQueue((q) => q.slice(1))
      setActiveOrder(next)
      setIsOpen(true)
      if (soundEnabled) playNotificationChime()
    } else {
      setActiveOrder(null)
      setIsOpen(false)
    }
  }

  const handleSnoozeCurrent = () => {
    if (activeOrder) {
      // Tạm hoãn nhắc lại trong 5 phút
      snoozeMapRef.current.set(activeOrder.id, Date.now() + 5 * 60 * 1000)
    }

    if (orderQueue.length > 0) {
      const next = orderQueue[0]
      setOrderQueue((q) => q.slice(1))
      setActiveOrder(next)
      setIsOpen(true)
    } else {
      setActiveOrder(null)
      setIsOpen(false)
    }
  }

  const handleViewOrders = () => {
    if (activeOrder) {
      saveAcknowledgedId(activeOrder.id)
    }
    orderQueue.forEach((o) => saveAcknowledgedId(o.id))
    setActiveOrder(null)
    setOrderQueue([])
    setIsOpen(false)
    router.push("/dashboard/orders")
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem(STORAGE_SOUND_KEY, String(next))
    if (next) {
      playNotificationChime()
    }
  }

  const formatMoney = (val?: number) => {
    if (!val) return "0 đ"
    return new Intl.NumberFormat("vi-VN").format(val) + " đ"
  }

  const cleanPhone = activeOrder?.phone ? activeOrder.phone.replace(/\D/g, "") : ""
  const zaloUrl = cleanPhone ? `https://zalo.me/${cleanPhone}` : ""
  const callUrl = cleanPhone ? `tel:${cleanPhone}` : ""

  const totalInQueue = (activeOrder ? 1 : 0) + orderQueue.length

  return (
    <>
      {/* 1. Modal Popup Thông Báo Nổi Bật */}
      {activeOrder && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleSnoozeCurrent()}>
          <DialogContent className="w-[95vw] sm:max-w-lg p-0 overflow-hidden rounded-2xl bg-white shadow-2xl border-2 border-amber-400 animate-in fade-in zoom-in-95 duration-200 z-[9999]">
            {/* Header Alert Gradient */}
            <div className="bg-gradient-to-r from-red-600 via-amber-600 to-orange-600 text-white p-5 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none">
                <Bell className="w-36 h-36 animate-pulse" />
              </div>

              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner animate-bounce shrink-0">
                    <Bell className="w-7 h-7 text-yellow-300 fill-yellow-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-red-700 text-[11px] font-black tracking-wide uppercase shadow-sm">
                        <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                        Đơn Mới Từ Website
                      </span>
                      {totalInQueue > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-black/30 text-white text-[11px] font-bold">
                          Đơn 1 / {totalInQueue}
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-xl font-black text-white leading-tight">
                      Có Khách Hàng Đặt Xe Mới!
                    </DialogTitle>
                    <DialogDescription className="text-xs text-amber-100 font-medium mt-0.5">
                      Vui lòng liên hệ xác nhận sớm để không bỏ lỡ khách
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleSound}
                    title={soundEnabled ? "Tắt âm thông báo" : "Bật âm thông báo"}
                    className="size-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-yellow-300" /> : <VolumeX className="w-4 h-4 text-white/70" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSnoozeCurrent}
                    title="Đóng / Nhắc lại sau"
                    className="size-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body Content */}
            <div className="p-5 space-y-4">
              {/* Customer & Vehicle Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3.5 shadow-inner">
                {/* Customer Info */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Khách hàng đặt xe</p>
                    <p className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600 shrink-0" />
                      {activeOrder.customerName}
                    </p>
                  </div>
                  {activeOrder.phone ? (
                    <div className="text-right space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Số điện thoại</p>
                      <p className="text-lg font-black text-blue-700 font-mono tracking-tight">
                        {activeOrder.phone}
                      </p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        Chưa có SĐT
                      </span>
                    </div>
                  )}
                </div>

                {/* Vehicle & Pricing Info */}
                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <div className="space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5 text-slate-400" />
                      Xe yêu cầu
                    </p>
                    <p className="text-base font-bold text-slate-900 truncate">
                      {activeOrder.vehicleName}
                    </p>
                    {activeOrder.licensePlate && (
                      <span className="inline-block text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        {activeOrder.licensePlate}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 text-right">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 flex items-center justify-end gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Tổng tiền dự kiến
                    </p>
                    <p className="text-lg font-black text-emerald-600 font-mono">
                      {formatMoney(activeOrder.totalPrice)}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Thời gian: {activeOrder.totalDays} ngày
                    </p>
                  </div>
                </div>

                {/* Rental Duration */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs text-slate-700 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Nhận: <strong className="text-slate-950 font-bold">{activeOrder.startDate}</strong></span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Trả: <strong className="text-slate-950 font-bold">{activeOrder.endDate}</strong></span>
                  </div>
                </div>

                {/* Notes if any */}
                {activeOrder.notes && (
                  <div className="text-xs bg-amber-50/80 rounded-lg p-2.5 border border-amber-200/60 text-amber-900">
                    <span className="font-bold">Ghi chú:</span> {activeOrder.notes}
                  </div>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  {callUrl ? (
                    <a
                      href={callUrl}
                      className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition active:scale-[0.98]"
                    >
                      <Phone className="w-4 h-4 animate-bounce" />
                      Gọi khách ngay
                    </a>
                  ) : (
                    <Button disabled className="h-12 rounded-xl">
                      <Phone className="w-4 h-4 mr-2" />
                      Chưa có SĐT
                    </Button>
                  )}

                  {zaloUrl ? (
                    <a
                      href={zaloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition active:scale-[0.98]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Nhắn Zalo
                    </a>
                  ) : (
                    <Button disabled className="h-12 rounded-xl">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Nhắn Zalo
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition"
                    onClick={handleAcknowledgeCurrent}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Đã liên hệ xong
                  </Button>

                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-sm"
                    onClick={handleViewOrders}
                  >
                    Xem đơn & Chốt xe
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 2. Floating Persistent Indicator (Hiển thị góc dưới nếu có đơn chưa xử lý mà modal đang đóng) */}
      {!isOpen && pendingWebCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <button
            type="button"
            onClick={() => syncPendingWebOrders(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold shadow-2xl hover:scale-105 transition-all border-2 border-white"
          >
            <div className="relative">
              <Bell className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1.5 -right-1.5 size-4 bg-yellow-300 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center">
                {pendingWebCount}
              </span>
            </div>
            <span className="text-sm">
              Có {pendingWebCount} đơn web chờ chốt!
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  )
}
