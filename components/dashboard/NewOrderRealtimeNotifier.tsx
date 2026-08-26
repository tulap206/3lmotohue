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
  Globe,
  Sparkles,
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

const STORAGE_ACK_KEY = "3lmoto_acknowledged_web_order_ids_v2"
const STORAGE_SEEN_KEY = "3lmoto_seen_web_order_ids_v2"
const STORAGE_DAILY_POPUP_KEY = "3lmoto_daily_web_order_popup_last_shown"
const STORAGE_SOUND_KEY = "3lmoto_order_notification_sound_enabled"
const WEB_BOOKING_NOTE_RE = /đặt trực tuyến từ website|\[source:web\]/i

export function isWebBookingOrder(notes?: string | null): boolean {
  return WEB_BOOKING_NOTE_RE.test(notes || "")
}

export function cleanNotesForDisplay(notes?: string | null): string {
  if (!notes) return ""
  return notes
    .replace(/^\[rentalTerm:(short|long)\]\s*/gi, "")
    .replace(/\[source:web\]\s*/gi, "")
    .replace(/\[location:(.*?)\]\s*/gi, "")
    .replace(/\[time:([0-2]?\d:[0-5]\d)\s*->\s*([0-2]?\d:[0-5]\d)\]\s*/gi, "")
    .trim()
}

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveSeenId(id: string) {
  if (typeof window === "undefined" || !id) return
  try {
    const current = getSeenIds()
    current.add(id)
    const arr = Array.from(current).slice(-300)
    localStorage.setItem(STORAGE_SEEN_KEY, JSON.stringify(arr))
  } catch (e) {
    console.warn("Error saving seen order:", e)
  }
}

function hasShownPopupToday(): boolean {
  if (typeof window === "undefined") return false
  try {
    const lastShown = localStorage.getItem(STORAGE_DAILY_POPUP_KEY)
    return lastShown === getTodayKey()
  } catch {
    return false
  }
}

function markPopupShownToday() {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_DAILY_POPUP_KEY, getTodayKey())
  } catch (e) {
    console.warn("Error marking popup shown today:", e)
  }
}

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

    // Âm thanh chuông 4 âm êm ái (C5 -> E5 -> G5 -> C6)
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
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + time + 0.02)
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
    const arr = Array.from(current).slice(-200)
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

  // Khởi tạo và unlock audio khi người dùng tương tác lần đầu
  useEffect(() => {
    if (typeof window === "undefined") return

    const soundPref = localStorage.getItem(STORAGE_SOUND_KEY)
    if (soundPref !== null) {
      setSoundEnabled(soundPref !== "false")
    }

    const unlockAudio = () => {
      if (isAudioUnlockedRef.current) return
      isAudioUnlockedRef.current = true
      getAudioContext()
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

  // Title flashing alert khi có đơn mới từ web
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
          ? `🔔 (ĐƠN WEB MỚI) ${activeOrder.customerName || "Khách đặt xe"}!`
          : `⚡ 3L MOTO - CÓ KHÁCH ĐẶT TRỰC TUYẾN`
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

  // Hàm xử lý đơn mới đến (CHỈ CHẤP NHẬN ĐƠN ĐẶT TỪ WEB)
  const processIncomingWebOrder = useCallback(async (rawOrder: any, triggerSound = true, forceOpenModal = false) => {
    if (!rawOrder || !rawOrder.id) return

    // CHỈ BÁO CÁC ĐƠN ĐẶT TỪ WEBSITE / LANDING PAGE
    if (!isWebBookingOrder(rawOrder.notes)) return

    // Nếu đơn không còn ở trạng thái pending
    if (rawOrder.status && rawOrder.status !== "pending") return

    const ackIds = getAcknowledgedIds()
    if (ackIds.has(rawOrder.id)) return

    // Kiểm tra snooze
    const snoozedUntil = snoozeMapRef.current.get(rawOrder.id)
    if (snoozedUntil && Date.now() < snoozedUntil) return

    // Lấy số điện thoại khách hàng nếu chưa có trong record
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

    // Đánh dấu đã thấy
    saveSeenId(newOrder.id)

    // Phát chuông
    if (triggerSound && soundEnabled) {
      playNotificationChime()
    }

    // Hiển thị Desktop Push Notification nếu tab đang ẩn
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      if (document.hidden) {
        try {
          const notif = new Notification("🏍️ ĐƠN ĐẶT XE MỚI TỪ WEBSITE!", {
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

    markPopupShownToday()

    if (forceOpenModal) {
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
          setIsOpen(true)
          return currentActive
        }
      })
    }
  }, [soundEnabled])

  // Polling đồng bộ định kỳ các đơn pending TỪ WEB
  const syncPendingWebOrders = useCallback(async (isManualOpen = false) => {
    try {
      const { data: pendingRentals, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(30)

      if (error || !pendingRentals) return

      // CHỈ LẤY ĐƠN ĐẶT TỪ WEB VÀ ĐANG Ở TRẠNG THÁI PENDING
      const webRentals = pendingRentals.filter((r) => isWebBookingOrder(r.notes))

      // Luôn phản ánh đúng số lượng đơn web pending thực tế trên hệ thống cho mọi tài khoản
      setPendingWebCount(webRentals.length)

      if (webRentals.length === 0) return

      const seenIds = getSeenIds()
      const brandNewOrders = webRentals.filter((r) => !seenIds.has(r.id))

      // Nếu có đơn mới phát sinh qua polling, phát chuông báo hiệu và lưu ID
      if (brandNewOrders.length > 0 && !isManualOpen) {
        if (soundEnabled) {
          playNotificationChime()
        }
        for (const r of brandNewOrders) {
          saveSeenId(r.id)
        }
      }

      // CHỈ MỞ MODAL KHI NGƯỜI DÙNG CHỦ ĐỘNG BẤM VÀO THÔNG BÁO (isManualOpen === true)
      if (isManualOpen) {
        for (let i = 0; i < webRentals.length; i++) {
          await processIncomingWebOrder(webRentals[i], false, true)
        }
      }
    } catch (err) {
      console.warn("Polling web orders error:", err)
    }
  }, [processIncomingWebOrder, soundEnabled])

  // Hook lắng nghe Realtime Broadcast & Postgres Changes & Polling
  useEffect(() => {
    // 1. Khởi động: Kiểm tra số lượng đơn web pending
    syncPendingWebOrders(false)

    // 2. Kênh Realtime Broadcast từ Landing Page khi khách bấm đặt xe
    const broadcastChannel = supabase
      .channel("realtime-order-notifications")
      .on("broadcast", { event: "new_order" }, (payload) => {
        if (payload?.payload && isWebBookingOrder(payload.payload.notes)) {
          // Phát chuông và hiển thị thông báo, KHÔNG tự động mở popup
          processIncomingWebOrder(payload.payload, true, false)
          syncPendingWebOrders(false)
        }
      })
      .subscribe()

    // 3. Kênh Postgres Changes (khi table rentals có INSERT đơn mới)
    const postgresChannel = supabase
      .channel("realtime-new-rentals-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rentals" },
        (payload) => {
          if (payload.new && isWebBookingOrder(payload.new.notes)) {
            // Phát chuông và hiển thị thông báo, KHÔNG tự động mở popup
            processIncomingWebOrder(payload.new, true, false)
            syncPendingWebOrders(false)
          }
        }
      )
      .subscribe()

    // 4. Polling chạy nền mỗi 10 giây (chỉ kiểm tra đơn mới hoặc cập nhật số đếm)
    const interval = setInterval(() => {
      syncPendingWebOrders(false)
    }, 10000)

    // 5. Khi người dùng focus lại tab
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
  }, [processIncomingWebOrder, syncPendingWebOrders])

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
    markPopupShownToday()
    if (activeOrder) {
      saveSeenId(activeOrder.id)
    }
    orderQueue.forEach((o) => saveSeenId(o.id))
    setActiveOrder(null)
    setOrderQueue([])
    setIsOpen(false)
  }

  const handleViewOrders = () => {
    markPopupShownToday()
    if (activeOrder) {
      saveAcknowledgedId(activeOrder.id)
      saveSeenId(activeOrder.id)
    }
    orderQueue.forEach((o) => {
      saveAcknowledgedId(o.id)
      saveSeenId(o.id)
    })
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
  const cleanNotes = cleanNotesForDisplay(activeOrder?.notes)

  const totalInQueue = (activeOrder ? 1 : 0) + orderQueue.length

  return (
    <>
      {/* 1. Modal Popup Thông Báo Thiết Kế Đồng Bộ Chuẩn 3L Moto */}
      {activeOrder && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleSnoozeCurrent()}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-lg p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 z-[9999] max-h-[min(94dvh,calc(100dvh-1rem))] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {/* Header: Signature Dark Slate / Indigo Gradient */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-4 sm:p-6 relative overflow-hidden shrink-0">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between relative z-10 gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="size-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/15 shadow-sm shrink-0">
                    <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/25 text-[11px] font-semibold tracking-wide">
                        <Globe className="w-3 h-3 text-blue-300" />
                        Đơn mới từ Website
                      </span>
                      {totalInQueue > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[11px] font-medium">
                          Đơn 1 / {totalInQueue}
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                      Khách hàng vừa đặt xe!
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-300 mt-0.5">
                      Vui lòng liên hệ xác nhận sớm để chốt xe cho khách
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={toggleSound}
                    title={soundEnabled ? "Tắt chuông" : "Bật chuông"}
                    className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-white/60" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSnoozeCurrent}
                    title="Đóng / Nhắc lại sau"
                    className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body Content */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Customer & Vehicle Info Box */}
              <div className="bg-slate-50/90 rounded-2xl p-4 sm:p-4.5 border border-slate-200/80 space-y-3.5 shadow-xs">
                {/* Customer Row */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70">
                  <div className="space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Khách hàng</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600 shrink-0" />
                      {activeOrder.customerName}
                    </p>
                  </div>
                  {activeOrder.phone ? (
                    <div className="text-right space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Số điện thoại</p>
                      <p className="text-base sm:text-lg font-bold text-blue-700 font-mono tracking-tight">
                        {activeOrder.phone}
                      </p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                        Chưa có SĐT
                      </span>
                    </div>
                  )}
                </div>

                {/* Vehicle & Price Row */}
                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <div className="space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5 text-slate-400" />
                      Xe yêu cầu
                    </p>
                    <p className="text-sm sm:text-base font-bold text-slate-800 truncate">
                      {activeOrder.vehicleName}
                    </p>
                    {activeOrder.licensePlate && (
                      <span className="inline-block text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                        {activeOrder.licensePlate}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 text-right">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center justify-end gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Tổng tiền tạm tính
                    </p>
                    <p className="text-base sm:text-lg font-bold text-emerald-600 font-mono">
                      {formatMoney(activeOrder.totalPrice)}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Thời gian: {activeOrder.totalDays} ngày
                    </p>
                  </div>
                </div>

                {/* Rental Duration Bar */}
                <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex items-center justify-between text-xs text-slate-700 font-medium shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Nhận: <strong className="text-slate-900 font-bold">{activeOrder.startDate}</strong></span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Trả: <strong className="text-slate-900 font-bold">{activeOrder.endDate}</strong></span>
                  </div>
                </div>

                {/* Clean Notes if any */}
                {cleanNotes && (
                  <div className="text-xs bg-blue-50/60 rounded-xl p-2.5 border border-blue-100 text-slate-700">
                    <span className="font-semibold text-slate-900">Ghi chú:</span> {cleanNotes}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  {callUrl ? (
                    <a
                      href={callUrl}
                      className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs transition active:scale-[0.98]"
                    >
                      <Phone className="w-4 h-4" />
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
                      className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition active:scale-[0.98]"
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

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
                    onClick={handleAcknowledgeCurrent}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Đã liên hệ xong
                  </Button>

                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition shadow-xs"
                    onClick={handleViewOrders}
                  >
                    Xem đơn & Chốt xe
                    <ArrowRight className="w-4 h-4 ml-1.5 text-slate-400" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 2. Floating Persistent Indicator (Hiển thị góc dưới nếu có đơn web chưa chốt mà modal đang đóng) */}
      {!isOpen && pendingWebCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <button
            type="button"
            onClick={() => syncPendingWebOrders(true)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 hover:bg-slate-900 text-white font-semibold text-xs shadow-xl border border-slate-700 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="relative">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="absolute -top-1 -right-1 size-2 bg-rose-500 rounded-full animate-ping" />
            </div>
            <span>
              Có <strong className="text-amber-300 font-bold">{pendingWebCount}</strong> đơn web chờ chốt!
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      )}
    </>
  )
}
