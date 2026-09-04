"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { showError, showWarning, showSuccess } from "@/lib/toast-utils"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { supabase } from "@/lib/supabase"
import { uploadMultipleImages } from "@/lib/storage"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { ModulePageShell, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard, ModulePagination, ModuleKpiGrid, ModuleEmptyState } from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalVehicleStatusLabel,
  rentalVehicleStatusBadgeClass,
  getRentalOrderStatusLabel,
  rentalOrderStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormSection,
  EntityFormFooter,
  EntityFormField,
  entityFormInputClass,
  entityFormSelectClass,
} from "@/components/dashboard/entity-form-dialog"
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
import { logger } from "@/lib/logger"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Search, Pencil, Trash2, Car, Eye, Clock, Upload, X, History, MapPin, Save, RefreshCw, Calendar, Sparkles } from "lucide-react"
import { getVehicleDynamicStatusForDate, VehicleDateDynamicStatus, normalizeDate } from "@/lib/vehicle-timeline"
import { Textarea } from "@/components/ui/textarea"

export interface VehicleLocationInfo {
  location: string
  cleanNotes: string
  lat?: number
  lng?: number
  updatedAt?: string
}

export function extractVehicleLocation(notes?: string): VehicleLocationInfo {
  if (!notes) return { location: "", cleanNotes: "" }
  const match = notes.match(/\[location:(.*?)\]/i)
  if (match) {
    const raw = match[1].trim()
    const cleanNotes = notes.replace(/\[location:(.*?)\]/gi, "").trim()

    if (raw.includes("|")) {
      const parts = raw.split("|")
      const coords = parts[0].split(",")
      const lat = parseFloat(coords[0])
      const lng = parseFloat(coords[1])
      const address = parts[1] || ""
      const updatedAt = parts[2] || ""
      return {
        location: address || (lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : parts[0]),
        cleanNotes,
        lat: isNaN(lat) ? undefined : lat,
        lng: isNaN(lng) ? undefined : lng,
        updatedAt,
      }
    }

    const coordsMatch = raw.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/)
    if (coordsMatch) {
      return {
        location: raw,
        cleanNotes,
        lat: parseFloat(coordsMatch[1]),
        lng: parseFloat(coordsMatch[2]),
      }
    }

    return { location: raw, cleanNotes }
  }
  return { location: "", cleanNotes: notes }
}

export function buildVehicleNotesWithLocation(
  existingNotes: string | undefined,
  location: string,
  coords?: { lat?: number; lng?: number },
  timestamp?: string
): string {
  const { cleanNotes, lat: oldLat, lng: oldLng } = extractVehicleLocation(existingNotes)
  const locStr = location.trim()
  if (!locStr) return cleanNotes

  const lat = coords?.lat ?? oldLat ?? 16.463713
  const lng = coords?.lng ?? oldLng ?? 107.590866
  const ts = timestamp || new Date().toISOString()
  const formatted = `${lat},${lng}|${locStr}|${ts}`

  return cleanNotes ? `${cleanNotes}\n[location:${formatted}]` : `[location:${formatted}]`
}

export function replaceVehicleCleanNotes(originalNotes: string | undefined, cleanNotes: string): string {
  const match = originalNotes?.match(/\[location:.*?\]/i)
  const next = cleanNotes.trim()
  if (!match) return next
  return next ? `${next}\n${match[0]}` : match[0]
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ""
  
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diffInSeconds < 60) {
    return "vừa xong"
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`
  }
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`
  }
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`
  }
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInDays < 30) {
    return `${diffInWeeks} tuần trước`
  }
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`
  }
  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} năm trước`
}

export function getLocationRecency(updatedAt?: string): {
  status: "live" | "today" | "old" | "none"
  label: string
  colorClass: string
  relativeText: string
} {
  if (!updatedAt) {
    return {
      status: "none",
      label: "Chưa có GPS",
      colorClass: "text-slate-400",
      relativeText: "Chưa có tín hiệu"
    }
  }

  const date = new Date(updatedAt)
  if (isNaN(date.getTime())) {
    return {
      status: "none",
      label: "Chưa có GPS",
      colorClass: "text-slate-400",
      relativeText: "Chưa có tín hiệu"
    }
  }

  const diffMs = Date.now() - date.getTime()
  const relativeText = formatRelativeTime(updatedAt)

  if (diffMs <= 30 * 60 * 1000) { // < 30 phút
    return {
      status: "live",
      label: "🟢 Trực tiếp",
      colorClass: "text-emerald-600 font-semibold",
      relativeText: `🟢 Vừa cập nhật • ${relativeText}`
    }
  } else if (diffMs <= 6 * 3600 * 1000) { // < 6 giờ
    return {
      status: "today",
      label: "🟡 Hôm nay",
      colorClass: "text-amber-600 font-medium",
      relativeText: `🟡 Cập nhật ${relativeText}`
    }
  } else {
    return {
      status: "old",
      label: "🕒 Lần cuối",
      colorClass: "text-slate-400",
      relativeText: `🕒 Lần cuối: ${relativeText}`
    }
  }
}

type VehicleStatus = "available" | "rented" | "maintenance" | "pending"
type HistoryType = "rent" | "handover" | "return" | "maintenance" | "purchase"

// Lightbox component tách riêng để tránh xung đột với Dialog
function LightboxModal({ imageSrc, onClose }: { imageSrc: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
    >
      <div 
        className="absolute inset-0 cursor-pointer" 
        onPointerDown={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
      <button
        className="absolute top-4 right-4 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors z-20 cursor-pointer"
        onPointerDown={(e) => {
          e.stopPropagation()
          onClose()
        }}
        type="button"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <img
        src={imageSrc}
        alt="Xem ảnh phóng to"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg relative z-10"
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}

interface HistoryLog {
  id: string
  timestamp: Date
  type: HistoryType
  datetime: string
  description: string
}

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: VehicleStatus
  current_km: number
  totalRentalDays?: number
  purchasePrice: number
  totalRevenue?: number
  profit?: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
  category?: "car" | "bike"
  created_at?: string
  updated_at?: string
}

const historyTypeConfig: Record<HistoryType, { label: string; className: string; dot: string }> = {
  purchase: { label: "Mua xe", className: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  rent: { label: "Đặt xe", className: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-500" },
  handover: { label: "Giao xe", className: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
  return: { label: "Nhận lại", className: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-800 border-amber-100", dot: "bg-amber-500" },
}

const vehicleActionBtnClass =
  "h-9 w-9 p-0 border-slate-200 rounded-[var(--radius-control)] hover:bg-slate-50 text-slate-500"
const vehiclePlateClass =
  "inline-flex items-center justify-center whitespace-nowrap bg-white text-slate-800 border border-slate-200 font-mono font-bold px-2.5 py-1 rounded-[var(--radius-badge)] text-sm shadow-xs tracking-wider uppercase shrink-0 select-all"

function formatLicensePlateDisplay(plate?: string) {
  if (!plate) return "Chưa biển"
  return plate.replace(/[\r\n\t]+/g, " ").trim()
}
const vehicleStatusBadgeClass =
  "inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold border"

function VehicleThumb({ src, name }: { src?: string; name: string }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-badge)] border border-slate-200 bg-slate-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Car className="h-5 w-5 text-slate-300" />
        </div>
      )}
    </div>
  )
}

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File
}

function normalizeImageList(value: unknown): Array<string | File> {
  if (Array.isArray(value)) {
    return value.filter((item) => (typeof item === "string" && item.length > 0) || isFileLike(item))
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim()
    if (trimmed.startsWith("[")) {
      try {
        return normalizeImageList(JSON.parse(trimmed))
      } catch {
        return [trimmed]
      }
    }
    return [trimmed]
  }
  return []
}

function imagePreviewSrc(img: string | File) {
  return isFileLike(img) ? URL.createObjectURL(img) : img
}

function ImageAddTile({
  onFiles,
  onPickStart,
}: {
  onFiles: (files: File[]) => void
  onPickStart?: () => void
}) {
  return (
    <div className="relative aspect-square rounded-[var(--radius-control)] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors overflow-hidden">
      <Upload className="w-6 h-6 text-slate-400 pointer-events-none" />
      <span className="text-meta mt-1 pointer-events-none">Thêm ảnh</span>
      <input
        type="file"
        accept="image/*"
        multiple
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        onClick={() => onPickStart?.()}
        onChange={(e) => {
          const files = e.target.files
          if (files?.length) onFiles(Array.from(files))
          e.target.value = ""
        }}
      />
    </div>
  )
}

function VehicleStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "amber" | "emerald" | "rose"
}) {
  const valueClass =
    tone === "amber"
      ? "text-amber-800"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-slate-900"
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 min-w-0 flex flex-col justify-center">
      <p className="text-label text-slate-500">{label}</p>
      <p className={cn("text-body font-semibold money tabular-nums mt-0.5 leading-snug break-words", valueClass)}>{value}</p>
      {hint && <p className="text-meta mt-0.5">{hint}</p>}
    </div>
  )
}

export default function VehiclesPage() {
  const { user, addAccessLog } = useAuth()
  const { vehicles, setVehicles, orders, setOrders, isLoading, refresh } = useRentalData()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)
  const pickingFileRef = useRef(false)
  const editOriginalNotesRef = useRef("")
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [newVehicle, setNewVehicle] = useState({
    name: "",
    licensePlate: "",
    color: "",
    pricePerDay: "",
    current_km: "",
    purchasePrice: "",
    notes: "",
    status: "available" as VehicleStatus,
    category: "bike" as "car" | "bike",
    vehicleImages: [] as File[],
    documentImages: [] as File[],
  })

  // State for vehicle location editing & map modal
  const [editingLocationVehicle, setEditingLocationVehicle] = useState<Vehicle | null>(null)
  const [selectedMapVehicle, setSelectedMapVehicle] = useState<Vehicle | null>(null)
  const [locationInput, setLocationInput] = useState("")
  const [savingLocation, setSavingLocation] = useState(false)
  const [isSyncingLocations, setIsSyncingLocations] = useState(false)

  const handleSyncLiveLocations = async () => {
    try {
      setIsSyncingLocations(true)
      let bridgeSucceeded = false
      let syncResultMsg = ""

      // 1. Kích hoạt đồng bộ qua Cloud Trigger API (Hỗ trợ HTTPS 3lmotohue.com mà không bị chặn Mixed Content)
      try {
        const triggerRes = await fetch("/api/vehicles/sync-trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "request" }),
        })

        if (triggerRes.ok) {
          const triggerData = await triggerRes.json()
          const requestId = triggerData.requestId

          if (requestId) {
            // Chờ Mac Bridge nhận lệnh, mở Tìm và gửi kết quả về (Polling tối đa 30s)
            const startTime = Date.now()
            while (Date.now() - startTime < 30000) {
              await new Promise((r) => setTimeout(r, 1500))
              const statusRes = await fetch(`/api/vehicles/sync-trigger?action=status&requestId=${requestId}`)
              if (statusRes.ok) {
                const statusData = await statusRes.json()
                if (statusData.status === "completed") {
                  bridgeSucceeded = true
                  syncResultMsg = "Đã mở Tìm trên Mac và đồng bộ vị trí xe thành công!"
                  break
                } else if (statusData.status === "failed") {
                  break
                }
              }
            }
          }
        }
      } catch (cloudErr) {
        console.log("Cloud trigger error:", cloudErr)
      }

      // 2. Dự phòng: Thử trực tiếp localhost:3333 nếu đang chạy trên localhost
      if (!bridgeSucceeded && typeof window !== "undefined" && window.location.hostname === "localhost") {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000)
          const res = await fetch("http://localhost:3333/api/sync", {
            method: "POST",
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (res.ok) {
            const data = await res.json()
            bridgeSucceeded = true
            syncResultMsg = data.message || "Đã mở Tìm trên Mac và đồng bộ vị trí xe thành công!"
          }
        } catch (_) {}
      }

      // 3. Tải lại danh sách xe mới nhất từ CSDL Supabase
      const { data: freshVehicles, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        showError("Không thể cập nhật danh sách vị trí: " + error.message)
      } else if (freshVehicles) {
        setVehicles(freshVehicles)
        if (bridgeSucceeded) {
          showSuccess(`🎉 ${syncResultMsg} (Đã cập nhật danh sách vị trí mới nhất)`)
        } else {
          showWarning("⚡ Chưa kết nối được với Mac Bridge (hoặc máy Mac chưa mở Bridge). Hệ thống đã làm mới dữ liệu vị trí đã lưu trên Cloud!")
        }
      }
    } catch (err: any) {
      showError("Lỗi khi đồng bộ vị trí xe: " + (err.message || ""))
    } finally {
      setIsSyncingLocations(false)
    }
  }

  const openEditLocationDialog = (vehicle: Vehicle) => {
    setEditingLocationVehicle(vehicle)
    const { location } = extractVehicleLocation(vehicle.notes)
    setLocationInput(location)
  }

  const handleSaveVehicleLocation = async () => {
    if (!editingLocationVehicle) return
    try {
      setSavingLocation(true)
      const nowIso = new Date().toISOString()
      const updatedNotes = buildVehicleNotesWithLocation(editingLocationVehicle.notes, locationInput, undefined, nowIso)

      const { error } = await supabase
        .from('vehicles')
        .update({ notes: updatedNotes, updated_at: nowIso })
        .eq('id', editingLocationVehicle.id)

      if (error) throw error

      setVehicles(prev => prev.map(v => v.id === editingLocationVehicle.id ? { ...v, notes: updatedNotes } : v))
      showSuccess(`Đã cập nhật vị trí cho xe ${editingLocationVehicle.name}`)
      setEditingLocationVehicle(null)
    } catch (err: any) {
      console.error("Error saving vehicle location:", err)
      showError(`Lỗi khi lưu vị trí: ${err.message}`)
    } finally {
      setSavingLocation(false)
    }
  }

  const vehiclePerformanceMap = useMemo(() => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    thirtyDaysAgo.setHours(0,0,0,0)

    const map: Record<string, { utilizationRate: number; revenue30d: number }> = {}

    const parseVietnamDate = (dateStr: string): Date => {
      if (!dateStr) return new Date()
      const parts = dateStr.split("/")
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr)
    }

    vehicles.forEach(vehicle => {
      const vehicleOrders = (orders || []).filter(o => o.vehicleId === vehicle.id && o.status !== "cancelled" && o.status !== "pending")
      let rentedDays = 0
      let totalRevenue30d = 0

      vehicleOrders.forEach(o => {
        const start = parseVietnamDate(o.startDate)
        const end = parseVietnamDate(o.endDate)
        start.setHours(0,0,0,0)
        end.setHours(0,0,0,0)

        const overlapStart = start < thirtyDaysAgo ? thirtyDaysAgo : start
        const overlapEnd = end > today ? today : end

        if (overlapStart <= overlapEnd) {
          const diffTime = overlapEnd.getTime() - overlapStart.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
          rentedDays += diffDays
          
          const dailyRate = o.pricePerDay || 0
          totalRevenue30d += diffDays * dailyRate
        }
      })

      if (rentedDays > 30) rentedDays = 30
      const utilizationRate = Math.round((rentedDays / 30) * 100)
      map[vehicle.id] = { utilizationRate, revenue30d: totalRevenue30d }
    })

    return map
  }, [vehicles, orders])

  // Date target state for dynamic vehicle status calculation
  const [dateFilterMode, setDateFilterMode] = useState<"today" | "tomorrow" | "dayAfter" | "custom">("today")
  const [customTargetDate, setCustomTargetDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })

  const targetCalculationDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    if (dateFilterMode === "today") {
      return d
    } else if (dateFilterMode === "tomorrow") {
      d.setDate(d.getDate() + 1)
      return d
    } else if (dateFilterMode === "dayAfter") {
      d.setDate(d.getDate() + 2)
      return d
    } else {
      return normalizeDate(customTargetDate) || d
    }
  }, [dateFilterMode, customTargetDate])

  const targetDateFormatted = useMemo(() => {
    return formatDisplayDate(targetCalculationDate)
  }, [targetCalculationDate])

  const targetDateTitle = useMemo(() => {
    if (dateFilterMode === "today") return `Hôm nay (${targetDateFormatted})`
    if (dateFilterMode === "tomorrow") return `Ngày mai (${targetDateFormatted})`
    if (dateFilterMode === "dayAfter") return `Ngày kia (${targetDateFormatted})`
    return `Ngày ${targetDateFormatted}`
  }, [dateFilterMode, targetDateFormatted])

  // Calculate dynamic status for each vehicle on targetCalculationDate
  const vehicleDynamicStatusMap = useMemo(() => {
    const map: Record<string, VehicleDateDynamicStatus> = {}
    for (const v of vehicles) {
      map[v.id] = getVehicleDynamicStatusForDate(v, targetCalculationDate, orders || [])
    }
    return map
  }, [vehicles, targetCalculationDate, orders])

  const filteredVehicles = useMemo(() => {
    const filtered = vehicles.filter((vehicle) => {
      const matchesSearch =
        vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
      
      const dynStatus = vehicleDynamicStatusMap[vehicle.id]?.effectiveStatus || vehicle.status
      const matchesStatus =
        statusFilter === "all"
          ? true
          : dynStatus === statusFilter
      return matchesSearch && matchesStatus
    })

    // Sort by performance (utilizationRate) descending
    return [...filtered].sort((a, b) => {
      const utilizationA = vehiclePerformanceMap[a.id]?.utilizationRate || 0
      const utilizationB = vehiclePerformanceMap[b.id]?.utilizationRate || 0
      
      if (utilizationB !== utilizationA) {
        return utilizationB - utilizationA
      }
      // Secondary sort: revenue30d descending
      const revA = vehiclePerformanceMap[a.id]?.revenue30d || 0
      const revB = vehiclePerformanceMap[b.id]?.revenue30d || 0
      if (revB !== revA) {
        return revB - revA
      }
      // Tertiary sort: by name
      return a.name.localeCompare(b.name)
    })
  }, [vehicles, searchTerm, statusFilter, vehicleDynamicStatusMap, vehiclePerformanceMap])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, dateFilterMode, customTargetDate])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredVehicles.length / itemsPerPage)
  }, [filteredVehicles])

  const startIndex = (currentPage - 1) * itemsPerPage
  
  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      startIndex,
      currentPage * itemsPerPage
    )
  }, [filteredVehicles, startIndex])

  const vehicleStats = useMemo(() => {
    let available = 0
    let pendingDelivery = 0
    let rented = 0
    let maintenance = 0

    for (const v of vehicles) {
      const dyn = vehicleDynamicStatusMap[v.id]
      if (dyn) {
        if (dyn.effectiveStatus === "available") available++
        else if (dyn.effectiveStatus === "pending") pendingDelivery++
        else if (dyn.effectiveStatus === "rented") rented++
        else if (dyn.effectiveStatus === "maintenance") maintenance++
      } else {
        if (v.status === "available") available++
        else if (v.status === "pending") pendingDelivery++
        else if (v.status === "rented") rented++
        else if (v.status === "maintenance") maintenance++
      }
    }

    return {
      total: vehicles.length,
      available,
      pendingDelivery,
      rented,
      maintenance,
    }
  }, [vehicles, vehicleDynamicStatusMap])

  const handleAddVehicle = async () => {
    if (!newVehicle.name || !newVehicle.name.trim()) {
      showWarning("Vui lòng nhập Loại xe!")
      return
    }
    if (!newVehicle.licensePlate || !newVehicle.licensePlate.trim()) {
      showWarning("Vui lòng nhập Biển số xe!")
      return
    }
    if (!newVehicle.pricePerDay) {
      showWarning("Vui lòng nhập Giá thuê!")
      return
    }

    try {
        // Check if licensePlate already exists
        const existingVehicle = vehicles.find(
          (v) => v.licensePlate.toLowerCase() === newVehicle.licensePlate.toLowerCase()
        )
        
        if (existingVehicle) {
          showWarning(`Xe với biển số "${newVehicle.licensePlate}" đã tồn tại!`, `Tên xe: ${existingVehicle.name}\nGiá: ${existingVehicle.pricePerDay.toLocaleString('vi-VN')} VND/ngày`)
          return
        }
        
        // Upload images first
        let vehicleImageUrls: string[] = []
        let documentImageUrls: string[] = []

        if (newVehicle.vehicleImages.length > 0) {
          console.log("Uploading vehicle images...")
          vehicleImageUrls = await uploadMultipleImages(
            newVehicle.vehicleImages.filter(isFileLike),
            "vehicles",
            "vehicle-images"
          )
        }

        if (newVehicle.documentImages.length > 0) {
          console.log("📄 Uploading document images...")
          documentImageUrls = await uploadMultipleImages(
            newVehicle.documentImages.filter(isFileLike),
            "vehicles",
            "document-images"
          )
        }

        const vehicle: any = {
          name: newVehicle.name,
          licensePlate: newVehicle.licensePlate,
          color: newVehicle.color,
          pricePerDay: parseMoneyInput(newVehicle.pricePerDay),
          current_km: parseMoneyInput(newVehicle.current_km),
          purchasePrice: parseMoneyInput(newVehicle.purchasePrice),
          notes: newVehicle.notes,
          status: newVehicle.status,
          category: newVehicle.category,
          vehicleImages: vehicleImageUrls,
          documentImages: documentImageUrls,
        }
        
        const { data, error } = await supabase
          .from('vehicles')
          .insert([vehicle])
          .select()
        
        if (error) {
          console.error("Error adding vehicle:", error)
          showError(`Lỗi: ${error.message}`)
        } else if (data && data.length > 0) {
          const insertedVehicle = data[0]
          // Add new vehicle and sort (newest first)
          const updated = [...vehicles, insertedVehicle]
          const sorted = updated.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime()
            const dateB = new Date(b.created_at || 0).getTime()
            return dateB - dateA // DESC (newest first)
          })
          setVehicles(sorted)
          if (user) logger.addVehicle(user.username, user.displayName, insertedVehicle.name, insertedVehicle.licensePlate, insertedVehicle.pricePerDay)
          setNewVehicle({ name: "", licensePlate: "", color: "", pricePerDay: "", current_km: "", purchasePrice: "", notes: "", status: "available", category: "bike", vehicleImages: [], documentImages: [] })
          setIsAddDialogOpen(false)
        } else {
          console.warn("⚠ No data returned after vehicle insertion")
          // Fallback if success but no data returned
          const updated = [...vehicles, vehicle]
          setVehicles(updated)
          setIsAddDialogOpen(false)
        }
      } catch (error) {
        console.error("Error adding vehicle:", error)
        showError(`Lỗi: ${error instanceof Error ? error.message : "Unknown"}`)
      }
  }

  const keepDialogOpenWhilePickingFile = (event: { preventDefault: () => void }) => {
    if (pickingFileRef.current) event.preventDefault()
  }

  const markPickingFile = () => {
    pickingFileRef.current = true
    window.setTimeout(() => {
      pickingFileRef.current = false
    }, 1500)
  }

  const handleImageFiles = (files: File[], type: "vehicle" | "document", isEdit: boolean = false) => {
    if (!files.length) return
    if (isEdit) {
      setEditingVehicle((prev) => {
        if (!prev) return prev
        if (type === "vehicle") {
          return {
            ...prev,
            vehicleImages: [...normalizeImageList(prev.vehicleImages), ...files] as any,
          }
        }
        return {
          ...prev,
          documentImages: [...normalizeImageList(prev.documentImages), ...files] as any,
        }
      })
      return
    }
    if (type === "vehicle") {
      setNewVehicle((prev) => ({
        ...prev,
        vehicleImages: [...normalizeImageList(prev.vehicleImages), ...files] as File[],
      }))
    } else {
      setNewVehicle((prev) => ({
        ...prev,
        documentImages: [...normalizeImageList(prev.documentImages), ...files] as File[],
      }))
    }
  }

  const removeImage = (index: number, type: 'vehicle' | 'document', isEdit: boolean = false) => {
    if (isEdit && editingVehicle) {
      if (type === 'vehicle') {
        setEditingVehicle({ ...editingVehicle, vehicleImages: normalizeImageList(editingVehicle.vehicleImages).filter((_, i) => i !== index) as any })
      } else {
        setEditingVehicle({ ...editingVehicle, documentImages: normalizeImageList(editingVehicle.documentImages).filter((_, i) => i !== index) as any })
      }
    } else {
      if (type === 'vehicle') {
        setNewVehicle(prev => ({ ...prev, vehicleImages: prev.vehicleImages.filter((_, i) => i !== index) }))
      } else {
        setNewVehicle(prev => ({ ...prev, documentImages: prev.documentImages.filter((_, i) => i !== index) }))
      }
    }
  }

  const handleEditVehicle = async () => {
    if (editingVehicle) {
      try {
        // Separate existing URL strings from new File objects
        const existingVehicleImages = normalizeImageList(editingVehicle.vehicleImages).filter(
          (img) => typeof img === "string"
        ) as string[]
        const newVehicleImageFiles = normalizeImageList(editingVehicle.vehicleImages).filter(isFileLike)

        const existingDocumentImages = normalizeImageList(editingVehicle.documentImages).filter(
          (img) => typeof img === "string"
        ) as string[]
        const newDocumentImageFiles = normalizeImageList(editingVehicle.documentImages).filter(isFileLike)

        // Upload new images if any
        let newVehicleImageUrls: string[] = []
        if (newVehicleImageFiles.length > 0) {
          console.log("Uploading new vehicle images for edit...")
          newVehicleImageUrls = await uploadMultipleImages(
            newVehicleImageFiles,
            "vehicles",
            "vehicle-images"
          )
        }

        let newDocumentImageUrls: string[] = []
        if (newDocumentImageFiles.length > 0) {
          console.log("📄 Uploading new document images for edit...")
          newDocumentImageUrls = await uploadMultipleImages(
            newDocumentImageFiles,
            "vehicles",
            "document-images"
          )
        }

        // Combine existing URLs and new uploaded URLs
        const finalVehicleImages = [...existingVehicleImages, ...newVehicleImageUrls]
        const finalDocumentImages = [...existingDocumentImages, ...newDocumentImageUrls]

        // Parse formatted money values back to numbers
        const updateData = {
          name: editingVehicle.name,
          licensePlate: editingVehicle.licensePlate,
          color: editingVehicle.color,
          pricePerDay: parseMoneyInput(editingVehicle.pricePerDay.toString()),
          current_km: parseInt(editingVehicle.current_km.toString()) || 0,
          purchasePrice: parseMoneyInput(editingVehicle.purchasePrice?.toString() || '0'),
          notes: replaceVehicleCleanNotes(editOriginalNotesRef.current, editingVehicle.notes),
          status: editingVehicle.status,
          category: editingVehicle.category,
          vehicleImages: finalVehicleImages,
          documentImages: finalDocumentImages,
        }
        
        const { error } = await supabase
          .from('vehicles')
          .update(updateData)
          .eq('id', editingVehicle.id)
        
        if (error) {
          console.error("Error updating vehicle:", error)
          showError(`Lỗi khi cập nhật: ${error.message}`)
        } else {
          // Sync with state
          const originalVehicle = vehicles.find((v) => v.id === editingVehicle.id)
          const fullUpdatedVehicle = {
            ...editingVehicle,
            ...updateData,
          }
          setVehicles(vehicles.map((v) => (v.id === editingVehicle.id ? fullUpdatedVehicle : v)))
          if (user) logger.editVehicleWithDiff(user.username, user.displayName, originalVehicle, fullUpdatedVehicle)
          setIsEditDialogOpen(false)
          setEditingVehicle(null)
        }
      } catch (error) {
        console.error("Error updating vehicle:", error)
        showError(`Lỗi: ${error instanceof Error ? error.message : "Unknown"}`)
      }
    }
  }

  const handleDeleteVehicle = async (id: string) => {
    const vehicleToDelete = vehicles.find((v) => v.id === id)
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error("Error deleting vehicle:", error)
      } else {
        setVehicles(vehicles.filter((v) => v.id !== id))
        if (vehicleToDelete && user) {
          logger.deleteVehicle(user.username, user.displayName, vehicleToDelete.name, vehicleToDelete.licensePlate)
        }
      }
    } catch (error) {
      console.error("Error deleting vehicle:", error)
    }
  }

  const openEditDialog = (vehicle: Vehicle) => {
    const loc = extractVehicleLocation(vehicle.notes)
    editOriginalNotesRef.current = vehicle.notes || ""
    setEditingVehicle({
      ...vehicle,
      notes: loc.cleanNotes,
      vehicleImages: normalizeImageList(vehicle.vehicleImages) as any,
      documentImages: normalizeImageList(vehicle.documentImages) as any,
      pricePerDay: vehicle.pricePerDay?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '' as any,
      purchasePrice: vehicle.purchasePrice?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '' as any
    })
    setIsEditDialogOpen(true)
  }

  const openDetailDialog = (vehicle: Vehicle) => {
    setViewingVehicle(vehicle)
    setIsDetailDialogOpen(true)
  }

  const openHistoryDialog = (vehicle: Vehicle) => {
    setHistoryVehicle(vehicle)
    setIsHistoryDialogOpen(true)
  }

  const getVehicleHistory = (vehicleId: string) => {
    const history: HistoryLog[] = []
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    
    // Helper to parse DD/MM/YYYY string to Date
    const parseVietnamDate = (dateStr: string): Date => {
      if (!dateStr) return new Date(0)
      const parts = dateStr.split("/")
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr) // Fallback
    }
    
    // Add purchase date
    if (vehicle?.created_at) {
      const purchaseDate = new Date(vehicle.created_at)
      history.push({
        id: `purchase-${vehicleId}`,
        timestamp: purchaseDate,
        description: "Nhập xe vào hệ thống",
        type: "purchase",
        datetime: formatDisplayDateTime(purchaseDate),
      })
    }
    
    // Add rental history from rentals
    const vehicleRentals = orders.filter((order) => order.vehicleId === vehicleId)
    vehicleRentals.forEach((rental) => {
      // Add rental booking (created_at or startDate)
      const bookingDate = rental.created_at ? new Date(rental.created_at) : parseVietnamDate(rental.startDate)
      history.push({
        id: `book-${rental.id}`,
        timestamp: bookingDate,
        description: rental.customerName,
        type: "rent",
        datetime: formatDisplayDateTime(bookingDate),
      })
      
      if (rental.status === "active" || rental.status === "completed" || rental.status === "cancelled") {
        const receivingDate = rental.received_at ? new Date(rental.received_at) : parseVietnamDate(rental.startDate)
        history.push({
          id: `receive-${rental.id}`,
          timestamp: receivingDate,
          description: rental.customerName,
          type: "handover",
          datetime: formatDisplayDateTime(receivingDate),
        })
      }
      
      if (rental.status === "completed" || rental.status === "cancelled") {
        const returnDate = rental.completed_at ? new Date(rental.completed_at) : parseVietnamDate(rental.endDate)
        history.push({
          id: `return-${rental.id}`,
          timestamp: returnDate,
          description: rental.customerName,
          type: "return",
          datetime: formatDisplayDateTime(returnDate),
        })
      }
    })
    
    // Sort by timestamp descending (newest first)
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    return history
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + " đ"
  }

  const getVehiclePerformance = (vehicleId: string) => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    thirtyDaysAgo.setHours(0,0,0,0)

    // Filter orders for this vehicle in active or completed status
    const vehicleOrders = (orders || []).filter(o => o.vehicleId === vehicleId && o.status !== "cancelled" && o.status !== "pending")

    let rentedDays = 0
    let totalRevenue30d = 0

    vehicleOrders.forEach(o => {
      const parseVietnamDate = (dateStr: string): Date => {
        if (!dateStr) return new Date()
        const parts = dateStr.split("/")
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      }

      const start = parseVietnamDate(o.startDate)
      const end = parseVietnamDate(o.endDate)
      start.setHours(0,0,0,0)
      end.setHours(0,0,0,0)

      const overlapStart = start < thirtyDaysAgo ? thirtyDaysAgo : start
      const overlapEnd = end > today ? today : end

      if (overlapStart <= overlapEnd) {
        const diffTime = overlapEnd.getTime() - overlapStart.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        rentedDays += diffDays
        
        const dailyRate = o.pricePerDay || 0
        totalRevenue30d += diffDays * dailyRate
      }
    })

    if (rentedDays > 30) rentedDays = 30
    const utilizationRate = Math.round((rentedDays / 30) * 100)

    return { utilizationRate, revenue30d: totalRevenue30d }
  }

  return (
    <ModulePageShell module="rental">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-blue-200 text-blue-700 hover:bg-blue-50 bg-white rounded-[var(--radius-control)] h-11 font-semibold text-body transition-colors"
          onClick={handleSyncLiveLocations}
          disabled={isSyncingLocations}
          title="Bấm để mở Tìm (Find My) trên Mac và đồng bộ vị trí xe mới nhất"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2 text-blue-600", isSyncingLocations && "animate-spin")} />
          {isSyncingLocations ? "Đang mở Tìm & cập nhật..." : "Cập nhật vị trí"}
        </Button>
        <Button
          className="bg-blue-600 !text-white hover:bg-blue-700 hover:!text-white rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition [&_svg]:!text-white"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm xe mới
        </Button>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsAddDialogOpen(open)
        }
      }}>
        <EntityFormDialogContent
          accent="blue"
          maxWidth="2xl"
          onPointerDownOutside={keepDialogOpenWhilePickingFile}
          onFocusOutside={keepDialogOpenWhilePickingFile}
          onInteractOutside={keepDialogOpenWhilePickingFile}
        >
          <EntityFormHeader
            title="Thêm xe mới"
            description="Nhập xe vào đội cho thuê — giá, ảnh và trạng thái"
          />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddVehicle()
            }}
          >
            <EntityFormBody>
              <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <VehicleThumb
                  src={
                    normalizeImageList(newVehicle.vehicleImages)[0]
                      ? imagePreviewSrc(normalizeImageList(newVehicle.vehicleImages)[0])
                      : undefined
                  }
                  name={newVehicle.name || "Xe mới"}
                />
                <div className="min-w-0">
                  <p className="text-title truncate">{newVehicle.name.trim() || "Xe chưa đặt tên"}</p>
                  <p className="text-meta font-mono tracking-wide">
                    {newVehicle.licensePlate.trim() || "Chưa biển số"}
                    {newVehicle.color.trim() ? ` · ${newVehicle.color.trim()}` : ""}
                  </p>
                </div>
              </div>

              <EntityFormSection title="Xe" description="Tên, biển số và tình trạng khi nhập">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EntityFormField label="Loại xe" hint="VD: Honda Vision, AB Trắng Đỏ" required>
                    <Input
                      id="name"
                      placeholder="Honda Vision"
                      autoComplete="off"
                      value={newVehicle.name}
                      onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                      className={entityFormInputClass}
                    />
                  </EntityFormField>
                  <EntityFormField label="Biển số" required>
                    <Input
                      id="licensePlate"
                      placeholder="75AA-123.45"
                      autoComplete="off"
                      value={newVehicle.licensePlate}
                      onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value })}
                      className={cn(entityFormInputClass, "font-mono")}
                    />
                  </EntityFormField>
                  <EntityFormField label="Màu xe">
                    <Input
                      id="color"
                      placeholder="Đen, trắng, đỏ"
                      value={newVehicle.color}
                      onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                      className={entityFormInputClass}
                    />
                  </EntityFormField>
                  <EntityFormField label="Số KM hiện tại">
                    <Input
                      id="current_km"
                      type="text"
                      inputMode="numeric"
                      placeholder="15.000"
                      value={newVehicle.current_km}
                      onChange={(e) => setNewVehicle({
                        ...newVehicle,
                        current_km: formatMoneyInput(e.target.value),
                      })}
                      className={cn(entityFormInputClass, "money tabular-nums")}
                    />
                  </EntityFormField>
                  <EntityFormField label="Trạng thái">
                    <Select
                      value={newVehicle.status}
                      onValueChange={(value: VehicleStatus) => setNewVehicle({ ...newVehicle, status: value })}
                    >
                      <SelectTrigger className={entityFormSelectClass}>
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 rounded-[var(--radius-control)]">
                        <SelectItem value="available">Sẵn sàng</SelectItem>
                        <SelectItem value="pending">Chờ giao</SelectItem>
                        <SelectItem value="rented">Đang thuê</SelectItem>
                        <SelectItem value="maintenance">Bảo trì</SelectItem>
                      </SelectContent>
                    </Select>
                  </EntityFormField>
                </div>
              </EntityFormSection>

              <EntityFormSection title="Giá" description="Tự thêm dấu chấm phần nghìn khi nhập">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EntityFormField label="Giá thuê / ngày" required>
                    <Input
                      id="price"
                      type="text"
                      inputMode="numeric"
                      placeholder="130.000"
                      value={newVehicle.pricePerDay}
                      onChange={(e) => {
                        setNewVehicle({ ...newVehicle, pricePerDay: formatMoneyInput(e.target.value) })
                      }}
                      className={cn(entityFormInputClass, "money tabular-nums")}
                    />
                  </EntityFormField>
                  <EntityFormField label="Giá mua xe">
                    <Input
                      id="purchasePrice"
                      type="text"
                      inputMode="numeric"
                      placeholder="32.500.000"
                      value={newVehicle.purchasePrice}
                      onChange={(e) => {
                        setNewVehicle({ ...newVehicle, purchasePrice: formatMoneyInput(e.target.value) })
                      }}
                      className={cn(entityFormInputClass, "money tabular-nums")}
                    />
                  </EntityFormField>
                </div>
              </EntityFormSection>

              <EntityFormSection title="Ảnh & ghi chú" description="Ảnh xe, giấy tờ; vị trí GPS lưu riêng sau này">
                <EntityFormField label="Ghi chú">
                  <Textarea
                    id="notes"
                    placeholder="Nguồn xe, tình trạng máy..."
                    value={newVehicle.notes}
                    onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                    className={cn(entityFormInputClass, "min-h-[80px] h-auto py-2.5")}
                  />
                </EntityFormField>

                <EntityFormField label="Ảnh xe">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {normalizeImageList(newVehicle.vehicleImages).map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreviewSrc(img)}
                          alt={`Xe ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index, "vehicle")}
                          className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <ImageAddTile
                      onPickStart={markPickingFile}
                      onFiles={(files) => handleImageFiles(files, "vehicle")}
                    />
                  </div>
                </EntityFormField>

                <EntityFormField label="Ảnh giấy tờ xe">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {normalizeImageList(newVehicle.documentImages).map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreviewSrc(img)}
                          alt={`Giấy tờ ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index, "document")}
                          className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <ImageAddTile
                      onPickStart={markPickingFile}
                      onFiles={(files) => handleImageFiles(files, "document")}
                    />
                  </div>
                </EntityFormField>
              </EntityFormSection>
            </EntityFormBody>
            <EntityFormFooter
              accent="blue"
              onCancel={() => setIsAddDialogOpen(false)}
              submitLabel="Thêm xe"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      <div className="space-y-4">
        {/* Date Filter Toolbar for Dynamic Fleet Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 sm:px-4 sm:py-3.5 rounded-[var(--radius-container)] border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Trạng thái xe ngày:</span>
                <span className="text-blue-700 font-black">{targetDateTitle}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 rounded-[var(--radius-control)] bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setDateFilterMode("today")}
                className={cn(
                  "h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-xs font-semibold ui-transition",
                  dateFilterMode === "today"
                    ? "bg-blue-600 !text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode("tomorrow")}
                className={cn(
                  "h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-xs font-semibold ui-transition",
                  dateFilterMode === "tomorrow"
                    ? "bg-blue-600 !text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                Ngày mai
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode("dayAfter")}
                className={cn(
                  "h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-xs font-semibold ui-transition",
                  dateFilterMode === "dayAfter"
                    ? "bg-blue-600 !text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                Ngày kia
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode("custom")}
                className={cn(
                  "h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-xs font-semibold ui-transition",
                  dateFilterMode === "custom"
                    ? "bg-blue-600 !text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                Chọn ngày
              </button>
            </div>

            {dateFilterMode === "custom" && (
              <Input
                type="date"
                value={customTargetDate}
                onChange={(e) => setCustomTargetDate(e.target.value)}
                className="h-9 w-36 text-xs bg-white border-slate-200 font-mono rounded-[var(--radius-control)] shadow-xs"
              />
            )}
          </div>
        </div>

        <ModuleKpiGrid columns={5}>
          <RentalKpiCard
            variant="hero"
            label="Tổng số xe"
            value={vehicleStats.total}
            sublabel={`${filteredVehicles.length} đang lọc`}
            onClick={() => setStatusFilter("all")}
            selected={statusFilter === "all"}
          />
          <RentalKpiCard
            variant="hero"
            label="Sẵn sàng"
            value={vehicleStats.available}
            sublabel={`Trống trong ${targetDateFormatted}`}
            valueClassName="text-emerald-700"
            onClick={() => setStatusFilter("available")}
            selected={statusFilter === "available"}
          />
          <RentalKpiCard
            variant="hero"
            label="Chờ giao"
            value={vehicleStats.pendingDelivery}
            sublabel={`Chờ giao trong ${targetDateFormatted}`}
            valueClassName="text-amber-700"
            onClick={() => setStatusFilter("pending")}
            selected={statusFilter === "pending"}
          />
          <RentalKpiCard
            variant="hero"
            label="Đang thuê"
            value={vehicleStats.rented}
            sublabel={`Đang chạy trong ${targetDateFormatted}`}
            valueClassName="text-blue-700"
            onClick={() => setStatusFilter("rented")}
            selected={statusFilter === "rented"}
          />
          <RentalKpiCard
            variant="hero"
            label="Bảo trì"
            value={vehicleStats.maintenance}
            sublabel="Tạm ngừng cho thuê"
            valueClassName="text-amber-700"
            onClick={() => setStatusFilter("maintenance")}
            selected={statusFilter === "maintenance"}
          />
        </ModuleKpiGrid>

      <ModuleSectionCard
        title="Danh sách xe cho thuê"
        description={`Quản lý ${filteredVehicles.length} phương tiện trong hệ thống`}
        filters={
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tên xe, biển số..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(rentalFilterInputClass, "pl-9 h-10")}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-36 h-10 rounded-[var(--radius-control)] border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="available">Sẵn sàng</SelectItem>
                <SelectItem value="pending">Chờ giao</SelectItem>
                <SelectItem value="rented">Đang thuê</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={isLoading}
              className="h-10 w-10 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 rounded-[var(--radius-control)] shadow-sm ui-transition hover:border-slate-300"
              title="Tải lại dữ liệu"
              aria-label="Tải lại dữ liệu"
            >
              <RefreshCw className={cn("w-4 h-4 text-slate-600", isLoading && "animate-spin")} />
            </Button>
          </div>
        }
      >
        <CardContent className="p-0">
          {isLoading ? (
            <ModuleEmptyState title="Đang tải dữ liệu xe..." description="Vui lòng chờ trong giây lát." />
          ) : filteredVehicles.length === 0 ? (
            <ModuleEmptyState
              title="Không tìm thấy xe nào"
              description="Thử đổi từ khóa hoặc bộ lọc, hoặc thêm xe mới vào hệ thống."
            />
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                        <th className={rentalTableHeadClass}>Loại xe</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Hiệu suất (30 ngày)</th>
                        <th className={cn(rentalTableHeadClass, "text-left min-w-[150px]")}>Vị trí</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Trạng thái</th>
                        <th className={cn(rentalTableHeadClass, "text-right")}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-body text-slate-700">
                      {paginatedVehicles.map((vehicle, index) => (
                        <tr key={vehicle.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-medium">
                            {startIndex + index + 1}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div className="flex items-center gap-3 min-w-0">
                              <VehicleThumb src={vehicle.vehicleImages?.[0]} name={vehicle.name} />
                              <div className="flex flex-col gap-1 min-w-0">
                                <button
                                  type="button"
                                  className="font-semibold text-slate-800 text-body hover:text-blue-700 hover:underline text-left truncate"
                                  onClick={() => openDetailDialog(vehicle)}
                                >
                                  {vehicle.name}
                                </button>
                                <div className="flex items-center gap-2">
                                  <span className={vehiclePlateClass}>{formatLicensePlateDisplay(vehicle.licensePlate)}</span>
                                </div>
                                <span className="text-xs font-bold text-rose-600 tabular-nums money">
                                  {formatPrice(vehicle.pricePerDay)}<span className="text-[11px] font-normal text-slate-500">/ngày</span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {(() => {
                              const { utilizationRate, revenue30d } = vehiclePerformanceMap[vehicle.id] || { utilizationRate: 0, revenue30d: 0 }
                              return (
                                <div className="flex flex-col items-center gap-1.5 w-full max-w-[7.5rem] mx-auto">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                    Lấp đầy: {utilizationRate}%
                                  </span>
                                  <div className="w-full h-1.5 rounded-[var(--radius-badge)] bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-[var(--radius-badge)] bg-blue-600"
                                      style={{ width: `${Math.min(100, Math.max(0, utilizationRate))}%` }}
                                    />
                                  </div>
                                  {revenue30d > 0 && (
                                    <span className="text-meta font-semibold text-rose-600 tabular-nums money">
                                      {formatPrice(revenue30d)}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-left">
                            {(() => {
                              const locInfo = extractVehicleLocation(vehicle.notes)
                              const locationStr = locInfo.location
                              const recency = getLocationRecency(locInfo.updatedAt)
                              return (
                                <div className="flex items-center gap-1.5 group">
                                  <button
                                    onClick={() => setSelectedMapVehicle(vehicle)}
                                    className="flex items-start gap-1.5 text-left hover:text-slate-700 transition min-w-0"
                                    title={locationStr ? `Bấm để xem vị trí xe trên bản đồ • ${recency.relativeText}` : "Chưa có vị trí xe"}
                                  >
                                    <MapPin className={cn("w-3.5 h-3.5 shrink-0 mt-0.5 self-start", locationStr ? (recency.status === "live" ? "text-emerald-500" : recency.status === "today" ? "text-amber-500" : "text-slate-400") : "text-slate-300")} />
                                    <div className="flex flex-col">
                                      <span className={cn("text-xs line-clamp-3 max-w-[220px] whitespace-normal leading-tight text-left", locationStr ? "text-slate-900 font-semibold underline decoration-slate-300 underline-offset-2 hover:text-slate-700" : "text-slate-400 italic")}>
                                        {locationStr || "Chưa có tín hiệu"}
                                      </span>
                                      {locationStr && (
                                        <span className={cn("text-[10px] mt-0.5 flex items-center gap-1", recency.colorClass)}>
                                          {recency.relativeText}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {(() => {
                              const dyn = vehicleDynamicStatusMap[vehicle.id]
                              const tone = dyn?.statusTone || (vehicle.status === "available" ? "emerald" : vehicle.status === "rented" ? "blue" : vehicle.status === "pending" ? "amber" : "rose")
                              const label = dyn?.statusLabel || getRentalVehicleStatusLabel(vehicle.status)
                              const detail = dyn?.detailText || ""
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold border",
                                      tone === "emerald" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                                      tone === "amber" && "bg-amber-50 text-amber-900 border-amber-300",
                                      tone === "blue" && "bg-blue-50 text-blue-800 border-blue-200",
                                      tone === "rose" && "bg-rose-50 text-rose-800 border-rose-200"
                                    )}
                                  >
                                    {label}
                                  </span>
                                  {detail && (
                                    <span className="text-[11px] font-medium text-slate-600 max-w-[240px] line-clamp-2 text-center leading-snug whitespace-normal" title={detail}>
                                      {detail}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={vehicleActionBtnClass}
                                onClick={() => openHistoryDialog(vehicle)}
                                title="Xem lịch sử"
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={vehicleActionBtnClass}
                                onClick={() => openDetailDialog(vehicle)}
                                title="Chi tiết"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={vehicleActionBtnClass}
                                onClick={() => openEditDialog(vehicle)}
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {user?.role === "admin" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon-sm"
                                      className="h-9 w-9 p-0 border-rose-200 rounded-[var(--radius-control)] hover:bg-rose-50 text-rose-600"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)]">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-slate-800">Xác nhận xóa xe</AlertDialogTitle>
                                      <AlertDialogDescription className="text-slate-500">
                                        Bạn có chắc chắn muốn xóa xe <span className="font-medium text-slate-800">{vehicle.name}</span> ({vehicle.licensePlate})?
                                        Hành động này không thể hoàn tác.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="border-slate-200 rounded-[var(--radius-control)]">Hủy</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteVehicle(vehicle.id)}
                                        className="bg-rose-600 !text-white hover:bg-rose-700 rounded-[var(--radius-control)]"
                                      >
                                        Xóa
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                mobile={paginatedVehicles.map((vehicle) => {
                  const locInfo = extractVehicleLocation(vehicle.notes)
                  const locationStr = locInfo.location
                  const recency = getLocationRecency(locInfo.updatedAt)

                  return (
                    <ModuleMobileCard key={vehicle.id}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <VehicleThumb src={vehicle.vehicleImages?.[0]} name={vehicle.name} />
                          <div className="flex flex-col gap-1 min-w-0">
                            <button
                              type="button"
                              className="font-semibold text-slate-800 text-body hover:text-blue-700 hover:underline text-left truncate"
                              onClick={() => openDetailDialog(vehicle)}
                            >
                              {vehicle.name}
                            </button>
                            <span className={vehiclePlateClass}>{formatLicensePlateDisplay(vehicle.licensePlate)}</span>
                          </div>
                        </div>
                        {(() => {
                          const dyn = vehicleDynamicStatusMap[vehicle.id]
                          const tone = dyn?.statusTone || (vehicle.status === "available" ? "emerald" : vehicle.status === "rented" ? "blue" : vehicle.status === "pending" ? "amber" : "rose")
                          const label = dyn?.statusLabel || getRentalVehicleStatusLabel(vehicle.status)
                          return (
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-[var(--radius-badge)] text-xs font-semibold border",
                                  tone === "emerald" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                                  tone === "amber" && "bg-amber-50 text-amber-900 border-amber-300",
                                  tone === "blue" && "bg-blue-50 text-blue-800 border-blue-200",
                                  tone === "rose" && "bg-rose-50 text-rose-800 border-rose-200"
                                )}
                              >
                                {label}
                              </span>
                              {dyn?.detailText && (
                                <span className="text-[10px] text-slate-500 max-w-[150px] line-clamp-2 text-right leading-tight whitespace-normal">
                                  {dyn.detailText}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      {/* 📍 Mobile Live Location block with 1-tap map launcher */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedMapVehicle(vehicle)}
                          className="flex items-start gap-2 text-left hover:bg-blue-50/60 transition w-full bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 active:scale-[0.99]"
                        >
                          <MapPin className={cn("w-4 h-4 shrink-0 mt-0.5 self-start", locationStr ? (recency.status === "live" ? "text-emerald-500" : recency.status === "today" ? "text-amber-500" : "text-slate-400") : "text-slate-300")} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 w-full">
                              <span className="text-[11px] font-semibold text-slate-500">Vị trí xe hiện tại:</span>
                              {locationStr && (
                                <span className={cn("text-[10px]", recency.colorClass)}>
                                  {recency.relativeText}
                                </span>
                              )}
                            </div>
                            <span className={cn("text-xs leading-tight text-left break-words mt-0.5", locationStr ? "text-slate-900 font-semibold underline decoration-slate-300 underline-offset-2" : "text-slate-400 italic")}>
                              {locationStr || "Chưa có tín hiệu"}
                            </span>
                          </div>
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-sm mt-2.5 pt-2 border-t border-slate-100/50">
                        <span className="font-semibold text-slate-900 tabular-nums money whitespace-nowrap">{formatPrice(vehicle.pricePerDay)}/ngày</span>
                        <div className="flex gap-1 items-center">
                          <Button variant="ghost" size="icon-sm" className="h-10 w-10 sm:h-9 sm:w-9 p-0 text-slate-500" onClick={() => openHistoryDialog(vehicle)} title="Lịch sử">
                            <Clock className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="h-10 w-10 sm:h-9 sm:w-9 p-0 text-slate-500" onClick={() => openDetailDialog(vehicle)} title="Chi tiết">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="h-10 w-10 sm:h-9 sm:w-9 p-0 text-slate-500" onClick={() => openEditDialog(vehicle)} title="Chỉnh sửa">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-10 w-10 sm:h-9 sm:w-9 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => {
                                if (window.confirm(`Bạn có chắc chắn muốn xóa xe ${vehicle.name} (${vehicle.licensePlate})?`)) {
                                  handleDeleteVehicle(vehicle.id)
                                }
                              }}
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </ModuleMobileCard>
                  )
                })}
              />
              <ModulePagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={filteredVehicles.length}
                itemLabel="xe"
                onPageChange={setCurrentPage}
                className="rounded-b-2xl"
              />
            </>
          )}
        </CardContent>
      </ModuleSectionCard>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsEditDialogOpen(open)
        }
      }}>
        <EntityFormDialogContent
          accent="blue"
          maxWidth="2xl"
          onPointerDownOutside={keepDialogOpenWhilePickingFile}
          onFocusOutside={keepDialogOpenWhilePickingFile}
          onInteractOutside={keepDialogOpenWhilePickingFile}
        >
          <EntityFormHeader
            title="Chỉnh sửa thông tin xe"
            description={`${editingVehicle?.licensePlate || "Cập nhật biển số, giá thuê và ảnh xe"}`}
          />
          {editingVehicle && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleEditVehicle()
              }}
            >
              <EntityFormBody>
                <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <VehicleThumb
                    src={
                      normalizeImageList(editingVehicle.vehicleImages)[0]
                        ? imagePreviewSrc(normalizeImageList(editingVehicle.vehicleImages)[0])
                        : undefined
                    }
                    name={editingVehicle.name}
                  />
                  <div className="min-w-0">
                    <p className="text-title truncate">{editingVehicle.name || "Xe chưa đặt tên"}</p>
                    <p className="text-meta font-mono">{editingVehicle.licensePlate || "Chưa biển"}</p>
                  </div>
                </div>
                <EntityFormSection title="Thông tin xe" description="Cập nhật thông tin cơ bản và giá thuê">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EntityFormField label="Loại xe" required>
                      <Input
                        id="edit-name"
                        value={editingVehicle.name}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Biển số" required>
                      <Input
                        id="edit-licensePlate"
                        value={editingVehicle.licensePlate}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, licensePlate: e.target.value })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Màu xe">
                      <Input
                        id="edit-color"
                        value={editingVehicle.color}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Số KM hiện tại">
                      <Input
                        id="edit-current_km"
                        type="number"
                        value={editingVehicle.current_km}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, current_km: parseInt(e.target.value) || 0 })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Giá thuê (VND/ngày)" required>
                      <Input
                        id="edit-price"
                        type="text"
                        value={editingVehicle.pricePerDay}
                        onChange={(e) => {
                          const formatted = formatMoneyInput(e.target.value)
                          setEditingVehicle({ ...editingVehicle, pricePerDay: formatted as any })
                        }}
                        className={cn(entityFormInputClass, "font-mono")}
                      />
                    </EntityFormField>
                    <EntityFormField label="Giá mua xe (VND)">
                      <Input
                        id="edit-purchasePrice"
                        type="text"
                        value={editingVehicle.purchasePrice}
                        onChange={(e) => {
                          const formatted = formatMoneyInput(e.target.value)
                          setEditingVehicle({ ...editingVehicle, purchasePrice: formatted as any })
                        }}
                        className={cn(entityFormInputClass, "font-mono")}
                      />
                    </EntityFormField>
                    <EntityFormField label="Trạng thái">
                      <Select
                        value={editingVehicle.status}
                        onValueChange={(value: VehicleStatus) => setEditingVehicle({ ...editingVehicle, status: value })}
                      >
                        <SelectTrigger className={entityFormSelectClass}>
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 rounded-[var(--radius-control)]">
                          <SelectItem value="available">Sẵn sàng</SelectItem>
                          <SelectItem value="pending">Chờ giao</SelectItem>
                          <SelectItem value="rented">Đang thuê</SelectItem>
                          <SelectItem value="maintenance">Bảo trì</SelectItem>
                        </SelectContent>
                      </Select>
                    </EntityFormField>
                  </div>
                  <EntityFormField label="Ghi chú" hint="Vị trí GPS được lưu riêng, không hiện trong ô này">
                    <Textarea
                      id="edit-notes"
                      value={editingVehicle.notes}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
                      placeholder="Ghi chú vận hành, nguồn xe..."
                      className={cn(entityFormInputClass, "min-h-[80px] h-auto py-2.5")}
                    />
                  </EntityFormField>

                  <EntityFormField label="Ảnh xe">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {normalizeImageList(editingVehicle.vehicleImages).map((img, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreviewSrc(img)}
                            alt={`Xe ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setLightboxImage(imagePreviewSrc(img))}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index, "vehicle", true)}
                            className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <ImageAddTile
                        onPickStart={markPickingFile}
                        onFiles={(files) => handleImageFiles(files, "vehicle", true)}
                      />
                    </div>
                  </EntityFormField>

                  <EntityFormField label="Ảnh giấy tờ xe">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {normalizeImageList(editingVehicle.documentImages).map((img, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreviewSrc(img)}
                            alt={`Giấy tờ ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setLightboxImage(imagePreviewSrc(img))}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index, "document", true)}
                            className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <ImageAddTile
                        onPickStart={markPickingFile}
                        onFiles={(files) => handleImageFiles(files, "document", true)}
                      />
                    </div>
                  </EntityFormField>
                </EntityFormSection>
              </EntityFormBody>
              <EntityFormFooter
                accent="blue"
                onCancel={() => setIsEditDialogOpen(false)}
                submitLabel="Lưu thay đổi"
              />
            </form>
          )}
        </EntityFormDialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsDetailDialogOpen(open)
        }
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="xl">
          {viewingVehicle && (() => {
            const v = viewingVehicle
            const profit = v.profit ?? 0
            const totalRevenue = v.totalRevenue ?? 0
            const vId = v.id
            const parseVN = (s: string): Date => {
              const parts = s?.split("/")
              if (parts?.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
              return new Date(s || 0)
            }
            const calcUtil = (days: number) => {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const from = new Date(); from.setDate(today.getDate() - days); from.setHours(0, 0, 0, 0)
              const vOrders = orders.filter(o => o.vehicleId === vId && o.status !== "cancelled" && o.status !== "pending")
              let rented = 0; let rev = 0
              vOrders.forEach(o => {
                const s = parseVN(o.startDate); const e = parseVN(o.endDate)
                const os = s < from ? from : s; const oe = e > today ? today : e
                if (os <= oe) {
                  const d = Math.ceil((oe.getTime() - os.getTime()) / 86400000) + 1
                  rented += d; rev += d * (o.pricePerDay || 0)
                }
              })
              if (rented > days) rented = days
              return { pct: Math.round((rented / days) * 100), rev }
            }
            const u30 = calcUtil(30)
            const totalRentalCount = orders.filter(o => o.vehicleId === vId).length
            const recentOrders = orders
              .filter(o => o.vehicleId === vId)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
              .slice(0, 4)

            const loc = extractVehicleLocation(v.notes)
            const photo = (v.vehicleImages || []).find((img) => typeof img === "string") as string | undefined

            return (
              <>
                <div className="flex items-start gap-3 sm:gap-4 mb-5">
                  <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-slate-200 bg-slate-50">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={v.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Car className="h-7 w-7 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <h2 className="text-title text-pretty">{v.name}</h2>
                    <p className="text-meta mt-0.5 font-mono tracking-wide">
                      {v.licensePlate || "Chưa biển"}
                      {v.color ? ` · ${v.color}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={cn(vehicleStatusBadgeClass, rentalVehicleStatusBadgeClass(v.status))}>
                        {getRentalVehicleStatusLabel(v.status)}
                      </span>
                      {v.category && (
                        <span className="inline-flex items-center rounded-[var(--radius-badge)] border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-label text-slate-600">
                          {v.category === "car" ? "Ô tô" : "Xe máy"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <VehicleStat label="Giá thuê / ngày" value={formatPrice(v.pricePerDay)} />
                    <VehicleStat label="Giá mua" value={formatPrice(v.purchasePrice)} tone="amber" />
                    <VehicleStat label="Tổng thu" value={formatPrice(totalRevenue)} tone="emerald" />
                    <VehicleStat
                      label="Lợi nhuận"
                      value={`${profit >= 0 ? "+" : ""}${formatPrice(profit)}`}
                      tone={profit >= 0 ? "emerald" : "rose"}
                    />
                    <VehicleStat label="Số KM hiện tại" value={`${(v.current_km || 0).toLocaleString("vi-VN")} km`} />
                    <VehicleStat label="Ngày đã cho thuê" value={`${v.totalRentalDays || 0} ngày`} />
                    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 min-w-0 flex flex-col justify-center">
                      <p className="text-label text-slate-500">Lấp đầy 30 ngày</p>
                      <p className={cn(
                        "text-body font-semibold tabular-nums mt-0.5 leading-snug",
                        u30.pct >= 70 ? "text-emerald-700" : u30.pct >= 40 ? "text-amber-800" : "text-slate-900"
                      )}>{u30.pct}%</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full", u30.pct >= 70 ? "bg-emerald-500" : u30.pct >= 40 ? "bg-amber-500" : "bg-blue-500")}
                          style={{ width: `${Math.min(100, u30.pct)}%` }}
                        />
                      </div>
                    </div>
                    <VehicleStat label="Tổng đơn thuê" value={`${totalRentalCount} đơn`} />
                  </div>

                  {loc.location && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        setSelectedMapVehicle(v)
                      }}
                      className="w-full text-left rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/80 px-3 py-3 hover:border-blue-200 hover:bg-blue-50/40 ui-transition"
                    >
                      <p className="text-label text-slate-500 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        Vị trí hiện tại
                      </p>
                      <p className="text-body text-slate-800 mt-1">{loc.location}</p>
                      {loc.updatedAt && (
                        <p className="text-meta mt-1">Cập nhật {formatRelativeTime(loc.updatedAt).replace(/[()]/g, "")}</p>
                      )}
                    </button>
                  )}

                  {loc.cleanNotes && (
                    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-3">
                      <p className="text-label text-slate-500 mb-1">Ghi chú</p>
                      <p className="text-body text-slate-700 whitespace-pre-line">{loc.cleanNotes}</p>
                    </div>
                  )}

                  {recentOrders.length > 0 && (
                    <div>
                      <p className="text-label text-slate-500 mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-2">
                        {recentOrders.map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-body font-semibold text-slate-800 truncate">{o.customerName}</p>
                              <p className="text-meta">{formatDisplayDate(o.startDate)} → {formatDisplayDate(o.endDate)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-body money tabular-nums text-slate-900">
                                {(o.totalPrice || 0).toLocaleString("vi-VN")} đ
                              </p>
                              <span className={cn(vehicleStatusBadgeClass, rentalOrderStatusBadgeClass(o.status), "mt-1")}>
                                {getRentalOrderStatusLabel(o.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(v.vehicleImages?.length > 0 || v.documentImages?.length > 0) && (
                    <div className="space-y-3">
                      {v.vehicleImages?.length > 0 && (
                        <div>
                          <p className="text-label text-slate-500 mb-2">Ảnh xe</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {v.vehicleImages.map((img, index) => (
                              <button
                                key={index}
                                type="button"
                                className="aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 hover:opacity-90 ui-transition"
                                onClick={() => setLightboxImage(img)}
                              >
                                <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {v.documentImages?.length > 0 && (
                        <div>
                          <p className="text-label text-slate-500 mb-2">Ảnh giấy tờ</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {v.documentImages.map((img, index) => (
                              <button
                                key={index}
                                type="button"
                                className="aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 hover:opacity-90 ui-transition"
                                onClick={() => setLightboxImage(img)}
                              >
                                <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 text-body border-slate-200"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        openHistoryDialog(v)
                      }}
                    >
                      <History className="w-4 h-4 mr-1.5" />
                      Xem lịch sử
                    </Button>
                    <Button
                      type="button"
                      className="h-11 flex-1 text-body bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white [&_svg]:!text-white"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        openEditDialog(v)
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Chỉnh sửa
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="lg">
          <EntityFormHeader
            title="Lịch sử xe"
            description={
              historyVehicle
                ? `${historyVehicle.name} · ${historyVehicle.licensePlate}`
                : "Hoạt động cho thuê và bảo trì"
            }
          />
          {historyVehicle && (() => {
            const logs = getVehicleHistory(historyVehicle.id)
            return logs.length === 0 ? (
              <ModuleEmptyState
                title="Chưa có lịch sử"
                description="Xe này chưa ghi nhận đơn thuê hoặc bảo trì."
              />
            ) : (
              <div className="relative pl-1">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
                <ol className="space-y-3">
                  {logs.map((log) => {
                    const cfg = historyTypeConfig[log.type]
                    return (
                      <li key={log.id} className="relative pl-8">
                        <span className={cn("absolute left-1.5 top-3 h-2.5 w-2.5 rounded-full ring-4 ring-white", cfg.dot)} />
                        <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className={cn(
                              "inline-flex items-center rounded-[var(--radius-badge)] border px-2 py-0.5 text-label font-semibold",
                              cfg.className
                            )}>
                              {cfg.label}
                            </span>
                            <time className="text-meta text-right shrink-0 tabular-nums">{log.datetime}</time>
                          </div>
                          {log.description && (
                            <p className="text-body text-slate-800 mt-1.5 break-words">{log.description}</p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })()}
          <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-6 flex justify-end border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
            <Button
              variant="outline"
              onClick={() => setIsHistoryDialogOpen(false)}
              className="h-11 w-full sm:w-auto rounded-[var(--radius-control)] border-slate-200"
            >
              Đóng
            </Button>
          </div>
        </EntityFormDialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <LightboxModal 
          imageSrc={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}

      {/* Popup nhỏ Cập nhật Vị trí xe */}
      <Dialog open={!!editingLocationVehicle} onOpenChange={(open) => !open && setEditingLocationVehicle(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md p-5 rounded-[var(--radius-container)] gap-4">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
              Cập nhật vị trí hiện tại của xe
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Xe: <strong className="text-slate-800">{editingLocationVehicle?.name}</strong> ({editingLocationVehicle?.licensePlate})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Label htmlFor="vehicle-location-input" className="text-xs font-semibold text-slate-700">
              Địa chỉ / Vị trí hiện tại của xe
            </Label>
            <Input
              id="vehicle-location-input"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Ví dụ: 102 Nguyễn Trãi, P. Thuận Hòa, TP. Huế..."
              className="h-10 text-sm bg-white border-slate-200"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveVehicleLocation()
                }
              }}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setLocationInput("Tại cửa hàng 3L Moto (102 Nguyễn Trãi, TP. Huế)")}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
              >
                🏠 Tại cửa hàng 3L Moto
              </button>
              <button
                type="button"
                onClick={() => setLocationInput("Bãi xe cơ sở 2, TP. Huế")}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
              >
                🅿️ Bãi xe cơ sở 2
              </button>
              <button
                type="button"
                onClick={() => setLocationInput("Khách đang thuê lưu hành")}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
              >
                🛵 Đang cho thuê
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Nhập địa chỉ hoặc vị trí cụ thể để dễ dàng quản lý bãi và điều phối xe. Hệ thống sẽ tự động lưu lại thời gian thực lúc bạn bấm Lưu.
            </p>
          </div>

          <DialogFooter className="pt-2 border-t flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditingLocationVehicle(null)} className="h-9 text-xs flex-1 sm:flex-none">
              Hủy
            </Button>
            <Button
              disabled={savingLocation}
              onClick={handleSaveVehicleLocation}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 gap-1.5 flex-1 sm:flex-none"
            >
              <Save className="w-4 h-4" />
              {savingLocation ? "Đang lưu..." : "Lưu vị trí & Thời gian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Xem vị trí & Bản đồ xe */}
      {selectedMapVehicle && (() => {
        const locInfo = extractVehicleLocation(selectedMapVehicle.notes)
        const locationStr = locInfo.location
        const lat = locInfo.lat
        const lng = locInfo.lng
        const recency = getLocationRecency(locInfo.updatedAt)
        const mapQuery = lat && lng ? `${lat},${lng}` : encodeURIComponent(locationStr || selectedMapVehicle.name)
        const deltaLng = 0.008
        const deltaLat = 0.005
        const osmEmbedUrl = lat && lng
          ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - deltaLng}%2C${lat - deltaLat}%2C${lng + deltaLng}%2C${lat + deltaLat}&layer=mapnik&marker=${lat}%2C${lng}`
          : `https://maps.google.com/maps?q=${encodeURIComponent(locationStr || selectedMapVehicle.name)}&hl=vi&z=15&output=embed`

        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`

        return (
          <Dialog open={!!selectedMapVehicle} onOpenChange={(open) => !open && setSelectedMapVehicle(null)}>
            <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden rounded-[var(--radius-container)] bg-white shadow-2xl border-0">
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-rose-500 animate-pulse" />
                    <DialogTitle className="font-bold text-lg text-white">{selectedMapVehicle.name}</DialogTitle>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-mono">{selectedMapVehicle.licensePlate}</span>
                  </div>
                  <p className="text-xs text-slate-300">Định vị & Bản đồ vị trí xe hiện tại</p>
                </div>
                <button onClick={() => setSelectedMapVehicle(null)} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Địa chỉ xe:</span>
                    {locInfo.updatedAt ? (
                      <span className={cn("text-[11px] font-semibold", recency.colorClass)}>
                        {recency.relativeText} ({new Date(locInfo.updatedAt).toLocaleTimeString('vi-VN')} {new Date(locInfo.updatedAt).toLocaleDateString('vi-VN')})
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Chưa có thời gian GPS</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {locationStr || "Chưa có dữ liệu vị trí cập nhật."}
                  </p>
                  {lat && lng && (
                    <p className="text-xs font-mono text-slate-500 pt-0.5">
                      Tọa độ GPS: {lat.toFixed(6)}, {lng.toFixed(6)}
                    </p>
                  )}
                </div>

                {/* Map Iframe Embed */}
                <div className="relative w-full h-72 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
                  {locationStr || (lat && lng) ? (
                    <iframe
                      title="Vehicle Location Map"
                      width="100%"
                      height="100%"
                      className="w-full h-full border-0"
                      loading="lazy"
                      src={osmEmbedUrl}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-2">
                      <MapPin className="w-8 h-8 opacity-40" />
                      <p>Chưa có dữ liệu định vị để hiển thị bản đồ</p>
                    </div>
                  )}
                </div>

                {/* Action links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
                  >
                    <MapPin className="w-4 h-4" />
                    Google Maps
                  </a>
                  <a
                    href="findmy://"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-sm transition"
                  >
                    <Car className="w-4 h-4" />
                    Apple Find My
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const v = selectedMapVehicle
                      setSelectedMapVehicle(null)
                      openEditLocationDialog(v)
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs shadow-sm transition h-auto"
                  >
                    <Pencil className="w-4 h-4" />
                    Sửa vị trí
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}
    </ModulePageShell>
  )
}
