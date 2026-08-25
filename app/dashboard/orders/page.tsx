"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { showError, showWarning, showSuccess } from "@/lib/toast-utils"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { logger } from "@/lib/logger"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { formatDisplayDate, formatDisplayDateTime, parseDisplayDate, toDateInputValue, toStoredDateValue } from "@/lib/format-date"
import { supabase, fetchVehicles, fetchCustomers, fetchRentals, insertCustomer } from "@/lib/supabase"
import { uploadImage } from "@/lib/storage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormSection,
  EntityFormFooter,
  EntityFormToggle,
  EntityFormField,
  entityFormInputClass,
} from "@/components/dashboard/entity-form-dialog"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard, ModulePagination, ModuleKpiGrid, ModuleEmptyState } from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalOrderStatusLabel,
  rentalOrderStatusBadgeClass,
  getRentalCustomerStatusLabel,
  rentalCustomerStatusBadgeClass,
  getRentalVehicleStatusLabel,
  rentalVehicleStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"
import { Plus, Search, Eye, Calendar, User, Car, Pencil, X, Phone, MapPin, Trash2, Play, CheckCircle, CheckCircle2, Bike, Bell, Unlink, ChevronRight, Upload, ClipboardList } from "lucide-react"
import { DailyNotificationModal } from "@/components/dashboard/daily-notification-modal"
import { QUY79_BUSINESS, getVietQrImageUrl, STATIC_PAYMENT_QR_SRC } from "@/lib/business-info"
import {
  type RentalTerm,
  getRentalTerm,
  getRentalTermLabel,
  stripRentalTermFromNotes,
  buildRentalTermPayload,
} from "@/lib/rental-term"
import { FleetTimelineView } from "@/components/dashboard/fleet-timeline-view"
import {
  classifyVehiclesForTimeline,
  checkVehicleTimelineAvailability,
  VehicleTimelineStatus,
  extractRentalTimes,
  embedRentalTimes,
  TIME_TAG_RE,
} from "@/lib/vehicle-timeline"

const WEB_BOOKING_NOTE_RE = /đặt trực tuyến từ website|\[source:web\]/i
const UNASSIGNED_VEHICLE_ID = "00000000-0000-0000-0000-000000000000"

function isWebBookingOrder(notes?: string | null): boolean {
  return WEB_BOOKING_NOTE_RE.test(stripRentalTermFromNotes(notes))
}

function isUnassignedVehicle(order: { vehicleId?: string; licensePlate?: string }) {
  return order.licensePlate === "CHỜ GÁN XE" || !order.vehicleId || order.vehicleId === UNASSIGNED_VEHICLE_ID
}

function parseVehicleDisplayNotes(notes?: string) {
  if (!notes) return { location: "", cleanNotes: "" }
  const match = notes.match(/\[location:(.*?)\]/i)
  if (!match) return { location: "", cleanNotes: notes }
  const raw = match[1].trim()
  const cleanNotes = notes.replace(/\[location:(.*?)\]/gi, "").trim()
  const location = raw.includes("|") ? (raw.split("|")[1] || raw.split("|")[0]) : raw
  return { location, cleanNotes }
}

function OrderStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "emerald" | "amber" | "muted" | "rose"
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 min-w-0 flex flex-col justify-center">
      <p className="text-label text-slate-500">{label}</p>
      <p
        className={cn(
          "text-body font-semibold tabular-nums mt-0.5 leading-snug break-words",
          tone === "emerald" && "text-emerald-700 money",
          tone === "amber" && "text-amber-800 money",
          tone === "rose" && "text-rose-700 money",
          tone === "muted" && "text-slate-400",
          tone === "default" && "text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function FilePickTile({
  label,
  file,
  onFile,
  onPickStart,
}: {
  label: string
  file: File | null
  onFile: (file: File | null) => void
  onPickStart?: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-label">{label}</p>
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-[var(--radius-control)] ui-transition",
          preview
            ? "border border-slate-200"
            : "border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2">
            <Upload className="h-5 w-5 text-slate-400" />
            <span className="text-meta text-center">{file ? file.name : "Thêm ảnh"}</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onClick={() => onPickStart?.()}
          onChange={(e) => {
            const next = e.target.files?.[0] || null
            e.target.value = ""
            onFile(next)
          }}
        />
      </div>
    </div>
  )
}

interface RentalOrder {
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
  deposit: number
  extraFees: number
  notes: string
  revenue: number // Doanh thu: cancelled = deposit (mất cọc), completed = totalPrice (trả cọc)
  status: "pending" | "active" | "completed" | "cancelled"
  createdAt?: string
  created_at?: string
  rentalCode?: string
  commissionHome?: number
  homeName?: string
  rentalTerm?: "short" | "long"
  received_at?: string
}

interface Customer {
  id: string
  name: string
  phone: string
  address?: string
  idcard: string
  totalrentals: number
  status: "active" | "inactive" | "renting" | "pending"
  createdAt?: string
  created_at?: string
  customerphoto?: string[]
  cccdfront?: string[]
  cccdback?: string[]
  licensefront?: string[]
  licenseback?: string[]
}

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: "available" | "rented" | "maintenance" | "pending"
  current_km: number
  purchasePrice: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
  totalRentalDays?: number
  totalRevenue?: number
  profit?: number
  category?: "car" | "bike"
}

const orderActionBtnClass =
  "h-9 w-9 p-0 border-slate-200 rounded-[var(--radius-control)] hover:bg-slate-50 text-slate-500"
const orderStatusBadgeClass =
  "inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold border"
const orderQuickActionClass =
  "h-11 px-3 text-body rounded-[var(--radius-control)] gap-1.5"

// Lightbox component
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

export default function OrdersPage() {
  const router = useRouter()
  const [isNewCustomer, setIsNewCustomer] = useState(true)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")
  const [newCustomerCCCD, setNewCustomerCCCD] = useState("")
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<File | null>(null)
  const [newCustomerCCCDFront, setNewCustomerCCCDFront] = useState<File | null>(null)
  const [hasCommission, setHasCommission] = useState(false)
  const { addAccessLog, user } = useAuth()
  const { orders, setOrders, customers, setCustomers, vehicles, setVehicles, isLoading: loading } = useRentalData()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterTerm, setFilterTerm] = useState<RentalTerm>("short")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  const isOrderOverdue = (order: RentalOrder) => {
    if (order.status === 'completed' || order.status === 'cancelled') return false
    if (!order.endDate) return false
    try {
      const parts = order.endDate.split('/')
      if (parts.length === 3) {
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const end = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
        end.setHours(0, 0, 0, 0)
        return end < now
      }
    } catch (e) {
      console.error(e)
    }
    return false
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get("status")
      if (statusParam) {
        setFilterStatus(statusParam)
      }
    }
  }, [])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingOrder, setViewingOrder] = useState<RentalOrder | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
  const [editingOrder, setEditingOrder] = useState<RentalOrder | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<RentalOrder | null>(null)
  const [isDailyNotificationOpen, setIsDailyNotificationOpen] = useState(false)

  const dailyNotifyBadgeCount = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const in2DaysEnd = new Date(today)
    in2DaysEnd.setDate(today.getDate() + 2)
    in2DaysEnd.setHours(23, 59, 59, 999)

    const overdue = orders.filter((o) => {
      if (o.status !== "active") return false
      const end = parseDisplayDate(o.endDate)
      if (!end) return false
      end.setHours(0, 0, 0, 0)
      return end < today
    }).length

    const upcoming = orders.filter((o) => {
      if (o.status !== "pending") return false
      const start = parseDisplayDate(o.startDate)
      if (!start) return false
      start.setHours(0, 0, 0, 0)
      return start >= today && start <= in2DaysEnd
    }).length

    return overdue + upcoming
  }, [orders])
  const [formData, setFormData] = useState({
    customerId: "",
    vehicleIds: [] as string[],
    startDate: "",
    endDate: "",
    pickupTime: "13:00",
    returnTime: "12:00",
    deposit: "0",
    notes: "",
    commissionHome: "",
    homeName: "",
    rentalTerm: "short" as RentalTerm,
  })
  const [editFormData, setEditFormData] = useState({
    customerId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    pickupTime: "13:00",
    returnTime: "12:00",
    deposit: "",
    extraFees: "",
    notes: "",
    status: "pending" as RentalOrder["status"],
    commissionHome: "",
    homeName: "",
    rentalTerm: "short" as RentalTerm,
  })

  // #9 Server-side search
  const [serverSearchOrders, setServerSearchOrders] = useState<RentalOrder[] | null>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const pickingFileRef = useRef(false)
  const keepDialogOpenWhilePickingFile = (event: { preventDefault: () => void }) => {
    if (pickingFileRef.current) event.preventDefault()
  }
  const markPickingFile = () => {
    pickingFileRef.current = true
    window.setTimeout(() => {
      pickingFileRef.current = false
    }, 1500)
  }

  // #4 Late fee dialog
  const [isLateFeeOpen, setIsLateFeeOpen] = useState(false)
  const [lateFeeOrderId, setLateFeeOrderId] = useState<string>("")
  const [lateFeeExtra, setLateFeeExtra] = useState("")

  // State for searchable inputs in create new order dialog
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)

  // Unassigned vehicle booking states
  const [unassignedQuantity, setUnassignedQuantity] = useState("1")
  const [unassignedPricePerDay, setUnassignedPricePerDay] = useState("120.000")
  const [deferVehicleAssign, setDeferVehicleAssign] = useState(false)
  const [assigningOrder, setAssigningOrder] = useState<RentalOrder | null>(null)
  const [assignVehicleSearch, setAssignVehicleSearch] = useState("")
  const [selectedVehiclesForAssignList, setSelectedVehiclesForAssignList] = useState<Vehicle[]>([])
  const [assigningSubmitting, setAssigningSubmitting] = useState(false)

  const [viewMode, setViewMode] = useState<"table" | "timeline">("table")

  const filteredCustomersForSelect = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.phone && c.phone.toLowerCase().includes(customerSearch.toLowerCase())) || 
    c.id.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // Đánh giá trạng thái khả dụng của xe theo timeline cho khoảng ngày & giờ đang chọn
  const evaluatedVehiclesForForm = useMemo(() => {
    return classifyVehiclesForTimeline(
      vehicles,
      formData.startDate,
      formData.endDate,
      orders,
      undefined,
      formData.pickupTime,
      formData.returnTime
    )
  }, [vehicles, formData.startDate, formData.endDate, formData.pickupTime, formData.returnTime, orders])

  const filteredVehiclesForSelect = useMemo(() => {
    const q = vehicleSearch.toLowerCase().trim()
    const list = evaluatedVehiclesForForm.allEvaluated.filter(({ vehicle }) => {
      if (formData.vehicleIds.includes(vehicle.id)) return false
      if (!q) return true
      return (
        vehicle.name.toLowerCase().includes(q) ||
        (vehicle.licensePlate && vehicle.licensePlate.toLowerCase().includes(q)) ||
        (vehicle.color && vehicle.color.toLowerCase().includes(q))
      )
    })

    return list.sort((a, b) => {
      const order = { optimal: 1, conditional: 2, unavailable: 3 }
      return order[a.status.statusCategory] - order[b.status.statusCategory]
    })
  }, [evaluatedVehiclesForForm, vehicleSearch, formData.vehicleIds])

  const evaluatedVehiclesForEdit = useMemo(() => {
    if (!editingOrder) return null
    return classifyVehiclesForTimeline(
      vehicles,
      editFormData.startDate,
      editFormData.endDate,
      orders,
      editingOrder.id,
      editFormData.pickupTime,
      editFormData.returnTime
    )
  }, [vehicles, editFormData.startDate, editFormData.endDate, editFormData.pickupTime, editFormData.returnTime, orders, editingOrder])

  useEffect(() => {
    if (!isDialogOpen) {
      setCustomerSearch("")
      setVehicleSearch("")
      setShowCustomerDropdown(false)
      setShowVehicleDropdown(false)
      setDeferVehicleAssign(false)
      setUnassignedQuantity("1")
      setUnassignedPricePerDay("120.000")
    }
  }, [isDialogOpen])

  // Load data from Supabase


  const todayVN = useMemo(() => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
  }, [])

  const filteredOrders = useMemo(() => {
    const base = serverSearchOrders !== null ? serverSearchOrders : orders
    const filtered = base.filter((order) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q || serverSearchOrders !== null ||
        (order.rentalCode || order.id || "").toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.vehicleName.toLowerCase().includes(q)

      let matchesStatus = false
      if (filterStatus === "all") matchesStatus = true
      else if (filterStatus === "overdue") matchesStatus = isOrderOverdue(order)
      else if (filterStatus === "return_today") matchesStatus = (order.status === "active" || isOrderOverdue(order)) && order.endDate === todayVN
      else if (filterStatus === "pickup_today") matchesStatus = order.status === "pending" && order.startDate === todayVN
      else matchesStatus = order.status === filterStatus

      const matchesTerm = getRentalTerm(order) === filterTerm

      return matchesSearch && matchesStatus && matchesTerm
    })

    const dateTime = (value: string | Date | null | undefined) => {
      const d = parseDisplayDate(value)
      return d ? d.getTime() : Number.POSITIVE_INFINITY
    }

    // Quá hạn → đang thuê (gần hết hạn trước) → chờ giao → hoàn thành → huỷ
    return [...filtered].sort((a, b) => {
      const getPriority = (order: RentalOrder) => {
        if (isOrderOverdue(order)) return 1
        if (order.status === "active") return 2
        if (order.status === "pending") return 3
        if (order.status === "completed") return 4
        if (order.status === "cancelled") return 5
        return 6
      }
      const priorityA = getPriority(a)
      const priorityB = getPriority(b)
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      if (priorityA <= 2) {
        return dateTime(a.endDate) - dateTime(b.endDate)
      }
      if (priorityA === 3) {
        return dateTime(a.startDate) - dateTime(b.startDate)
      }
      const timeA = new Date(a.created_at || a.createdAt || 0).getTime()
      const timeB = new Date(b.created_at || b.createdAt || 0).getTime()
      return timeB - timeA
    })
  }, [orders, serverSearchOrders, searchQuery, filterStatus, filterTerm, todayVN])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, filterTerm])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredOrders.length / itemsPerPage)
  }, [filteredOrders])

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredOrders, currentPage])

  const orderStats = useMemo(() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    const scoped = orders.filter((o) => getRentalTerm(o) === filterTerm)
    const newThisMonth = scoped.filter((o) => {
      const raw = o.created_at || o.createdAt
      if (!raw) return false
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return false
      return d.getMonth() === month && d.getFullYear() === year
    }).length

    return {
      total: scoped.length,
      pending: scoped.filter((o) => o.status === "pending").length,
      active: scoped.filter((o) => o.status === "active").length,
      overdue: scoped.filter((o) => isOrderOverdue(o)).length,
      completed: scoped.filter((o) => o.status === "completed").length,
      revenue: scoped
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + (o.revenue || o.totalPrice || 0), 0),
      month: month + 1,
      newThisMonth,
    }
  }, [orders, filterTerm])

  const termCounts = useMemo(() => ({
    short: orders.filter((o) => getRentalTerm(o) === "short").length,
    long: orders.filter((o) => getRentalTerm(o) === "long").length,
  }), [orders])

  const formatPrice = (n: number) => `${n.toLocaleString("vi-VN")}đ`

  const calculateTotalDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const generateRentalCodeFromUUID = (customerName: string, licensePlate: string, startDate: string, uuid: string) => {
    // Remove Vietnamese diacritics and get last name
    const removeVietnameseDiacritics = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    }

    // Get last name (last word of customer name)
    const nameParts = removeVietnameseDiacritics(customerName).trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]

    // Remove spaces and dashes from license plate, UPPERCASE
    const cleanPlate = licensePlate.replace(/[\s-]/g, "").toUpperCase()

    // Format date DDMMYYYY from VI-VN format (DD/MM/YYYY)
    const dateParts = startDate.split("/")
    const dateFormatted = String(dateParts[0]).padStart(2, "0") + String(dateParts[1]).padStart(2, "0") + String(dateParts[2]).padStart(4, "0")

    // Use first 8 chars of UUID for uniqueness
    const uuidPart = uuid.substring(0, 8).toUpperCase()

    return `${lastName}-${cleanPlate}-${dateFormatted}-${uuidPart}`
  }

  const generateRentalId = (customerName: string, licensePlate: string, startDate: string) => {
    // Remove Vietnamese diacritics and get last name
    const removeVietnameseDiacritics = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    }

    // Get last name (last word of customer name)
    const nameParts = removeVietnameseDiacritics(customerName).trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]

    // Remove spaces and dashes from license plate, UPPERCASE
    const cleanPlate = licensePlate.replace(/[\s-]/g, "").toUpperCase()

    // Format date DDMMYYYY from VI-VN format (DD/MM/YYYY)
    const dateParts = startDate.split("/")
    // dateParts[0] = DD, dateParts[1] = MM, dateParts[2] = YYYY
    const dateFormatted = String(dateParts[0]).padStart(2, "0") + String(dateParts[1]).padStart(2, "0") + String(dateParts[2]).padStart(4, "0")

    return `${lastName}-${cleanPlate}-${dateFormatted}`
  }

  // #9 Server-side search handler
  const handleSearchChange = (term: string) => {
    setSearchQuery(term)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!term.trim()) { setServerSearchOrders(null); return }
    searchDebounceRef.current = setTimeout(async () => {
      const t = term.trim()
      try {
        const { data } = await supabase.from("rentals").select("*")
          .or(`customerName.ilike.%${t}%,vehicleName.ilike.%${t}%,licensePlate.ilike.%${t}%,rentalCode.ilike.%${t}%`)
          .limit(100)
        setServerSearchOrders(data as RentalOrder[] || [])
      } catch { setServerSearchOrders(null) }
    }, 400)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const selectedVehicles = vehicles.filter((v) => formData.vehicleIds.includes(v.id))
    if (!deferVehicleAssign && selectedVehicles.length === 0) {
      showWarning("Chọn xe thuê hoặc tích “Chưa chọn gán xe”.")
      return
    }
    const isUnassigned = deferVehicleAssign || selectedVehicles.length === 0
    const unassignedPriceVal = parseMoneyInput(unassignedPricePerDay) || 120000

    const quantity = isUnassigned ? Math.max(1, parseInt(unassignedQuantity, 10) || 1) : selectedVehicles.length

    const targetVehicles = isUnassigned
      ? Array.from({ length: quantity }, (_, i) => ({
          id: "00000000-0000-0000-0000-000000000000",
          name: quantity > 1 ? `Chưa gán xe (Xe ${i + 1}/${quantity})` : "Chưa gán xe",
          licensePlate: "CHỜ GÁN XE",
          pricePerDay: unassignedPriceVal,
        }))
      : selectedVehicles

    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)
    
    if (startDate > endDate) {
      showWarning("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
      return
    }

    let customerId = formData.customerId
    let customerName = ""

    try {
      if (isNewCustomer) {
        if (!newCustomerName.trim()) {
          showWarning("Vui lòng nhập tên khách hàng!")
          return
        }
        if (!newCustomerPhone.trim()) {
          showWarning("Vui lòng nhập số điện thoại khách hàng!")
          return
        }
        if (!newCustomerAddress.trim()) {
          showWarning("Vui lòng nhập địa chỉ khách hàng!")
          return
        }
        let customerphoto: string[] = []
        let cccdfront: string[] = []

        if (newCustomerPhoto) {
          const url = await uploadImage(newCustomerPhoto, "customer-documents", "customer-photos")
          if (url) customerphoto = [url]
        }
        if (newCustomerCCCDFront) {
          const url = await uploadImage(newCustomerCCCDFront, "customer-documents", "cccd-front")
          if (url) cccdfront = [url]
        }

        const newCust = await insertCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          facebook: "",
          address: newCustomerAddress.trim(),
          idcard: newCustomerCCCD.trim() || `CCCD_${Date.now()}`,
          totalrentals: 0,
          status: "active",
          customerphoto,
          cccdfront,
          cccdback: [],
          licensefront: [],
          licenseback: []
        })

        if (!newCust) {
          showError("Không thể tạo khách hàng mới")
          return
        }

        customerId = newCust.id
        customerName = newCust.name
      } else {
        const customer = customers.find((c) => c.id === formData.customerId)
        if (!customer) {
          showWarning("Vui lòng chọn khách hàng!")
          return
        }
        customerId = customer.id
        customerName = customer.name
      }

      const totalDays = calculateTotalDays(formData.startDate, formData.endDate)
      const startDateVN = toStoredDateValue(formData.startDate)
      const now = new Date().toISOString()

      // Split deposit and commission equally among target vehicles
      const totalDeposit = parseMoneyInput(formData.deposit) || 0
      const dividedDeposit = Math.round(totalDeposit / targetVehicles.length)

      const totalCommission = hasCommission ? (parseMoneyInput(formData.commissionHome) || 0) : 0
      const dividedCommission = Math.round(totalCommission / targetVehicles.length)

      const homeNameVal = hasCommission ? formData.homeName.trim() : ""
      const notesWithTimes = embedRentalTimes(
        formData.notes ? formData.notes.trim() : "",
        formData.pickupTime,
        formData.returnTime
      )
      const termPayload = buildRentalTermPayload(formData.rentalTerm, notesWithTimes)

      const insertPayloads = targetVehicles.map((vehicle) => {
        const totalPrice = totalDays * vehicle.pricePerDay
        return {
          customerId,
          customerName,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          licensePlate: vehicle.licensePlate,
          startDate: startDateVN,
          endDate: toStoredDateValue(formData.endDate),
          totalDays,
          pricePerDay: vehicle.pricePerDay,
          totalPrice,
          deposit: dividedDeposit,
          extraFees: 0,
          notes: termPayload.notes,
          revenue: 0,
          status: "pending",
          created_at: now,
          commissionHome: dividedCommission,
          homeName: homeNameVal,
          rentalTerm: termPayload.rentalTerm,
        }
      })

      let { data, error } = await supabase
        .from('rentals')
        .insert(insertPayloads)
        .select()

      if (error && /rentalTerm/i.test(error.message || "")) {
        const withoutCols = insertPayloads.map(({ rentalTerm: _omit, ...rest }) => rest)
        ;({ data, error } = await supabase.from('rentals').insert(withoutCols).select())
      }

      if (error) {
        console.error("Error creating rentals:", error)
        showError(`Lỗi: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        const ordersWithCode = data.map((newRental) => {
          const rentalCode = generateRentalCodeFromUUID(customerName, newRental.licensePlate, startDateVN, newRental.id)
          return { ...newRental, rentalCode, rentalTerm: formData.rentalTerm }
        })
        setOrders([...ordersWithCode, ...orders])

        // Add action logs for each rented vehicle
        if (user) {
          selectedVehicles.forEach((vehicle) => {
            logger.addRental(user.username, user.displayName, customerName, vehicle.name)
          })
        }
        resetForm()
      }
    } catch (error) {
      console.error("Exception creating rentals:", error)
      showError(`Lỗi tạo đơn thuê`)
    }
  }

  const resetForm = () => {
    setFormData({
      customerId: "",
      vehicleIds: [],
      startDate: "",
      endDate: "",
      pickupTime: "13:00",
      returnTime: "12:00",
      deposit: "0",
      notes: "",
      commissionHome: "",
      homeName: "",
      rentalTerm: "short",
    })
    setIsNewCustomer(true)
    setNewCustomerName("")
    setNewCustomerPhone("")
    setNewCustomerAddress("")
    setNewCustomerCCCD("")
    setNewCustomerPhoto(null)
    setNewCustomerCCCDFront(null)
    setHasCommission(false)
    setUnassignedQuantity("1")
    setUnassignedPricePerDay("120.000")
    setDeferVehicleAssign(false)
    setIsDialogOpen(false)
  }

  // Handle deliver order (Giao xe) or open AssignVehicleModal if unassigned
  const handleDeliverOrderClick = (order: RentalOrder) => {
    if (isUnassignedVehicle(order)) {
      setAssigningOrder(order)
      setSelectedVehiclesForAssignList([])
      setAssignVehicleSearch("")
    } else {
      updateOrderStatus(order.id, "active")
    }
  }

  const availableVehiclesForAssign = useMemo(() => {
    if (!assigningOrder) return []
    const q = assignVehicleSearch.toLowerCase().trim()
    const times = extractRentalTimes(assigningOrder.notes)
    const evaluated = classifyVehiclesForTimeline(
      vehicles,
      assigningOrder.startDate,
      assigningOrder.endDate,
      orders,
      assigningOrder.id,
      times.pickupTime,
      times.returnTime
    )

    return evaluated.allEvaluated
      .filter(({ vehicle }) => {
        if (selectedVehiclesForAssignList.some((item) => item.id === vehicle.id)) return true
        if (!q) return true
        return (
          vehicle.name.toLowerCase().includes(q) ||
          (vehicle.licensePlate && vehicle.licensePlate.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => {
        const order = { optimal: 1, conditional: 2, unavailable: 3 }
        return order[a.status.statusCategory] - order[b.status.statusCategory]
      })
  }, [vehicles, assigningOrder, orders, assignVehicleSearch, selectedVehiclesForAssignList])

  const handleQuickBookFromTimeline = (vehicle: Vehicle, date: Date) => {
    const dStr = toDateInputValue(date)
    setFormData({
      customerId: "",
      vehicleIds: [vehicle.id],
      startDate: dStr,
      endDate: dStr,
      pickupTime: "13:00",
      returnTime: "12:00",
      deposit: "0",
      notes: "",
      commissionHome: "",
      homeName: "",
      rentalTerm: "short",
    })
    setIsNewCustomer(false)
    setIsDialogOpen(true)
  }

  const handleConfirmAssignVehicle = async () => {
    if (!assigningOrder || selectedVehiclesForAssignList.length === 0) return
    try {
      setAssigningSubmitting(true)
      const now = new Date().toISOString()
      
      // Find all pending unassigned orders for this customer starting with assigningOrder
      const customerPendingOrders = orders.filter(o => 
        o.customerId === assigningOrder.customerId && 
        o.status === "pending" && 
        isUnassignedVehicle(o)
      )

      // Pair each selected vehicle with a pending order
      const updatePromises = selectedVehiclesForAssignList.map(async (v, index) => {
        const targetOrder = customerPendingOrders[index] || assigningOrder
        const totalPrice = targetOrder.totalDays * v.pricePerDay

        const { error } = await supabase
          .from('rentals')
          .update({
            vehicleId: v.id,
            vehicleName: v.name,
            licensePlate: v.licensePlate,
            pricePerDay: v.pricePerDay,
            totalPrice,
            status: 'active',
            received_at: now
          })
          .eq('id', targetOrder.id)

        if (error) throw error

        return { orderId: targetOrder.id, vehicle: v, totalPrice }
      })

      const results = await Promise.all(updatePromises)

      // Update orders local state
      setOrders(prev => prev.map(o => {
        const match = results.find(r => r.orderId === o.id)
        if (match) {
          return {
            ...o,
            vehicleId: match.vehicle.id,
            vehicleName: match.vehicle.name,
            licensePlate: match.vehicle.licensePlate,
            pricePerDay: match.vehicle.pricePerDay,
            totalPrice: match.totalPrice,
            status: 'active',
            received_at: now
          }
        }
        return o
      }))

      // Update vehicles state (mark assigned vehicles as rented)
      const assignedIds = selectedVehiclesForAssignList.map(v => v.id)
      setVehicles(prev => prev.map(v => assignedIds.includes(v.id) ? { ...v, status: 'rented' as Vehicle['status'] } : v))

      if (user) {
        selectedVehiclesForAssignList.forEach(v => {
          logger.addRental(user.username, user.displayName, assigningOrder.customerName, v.name)
        })
      }

      showSuccess(`Đã gán ${selectedVehiclesForAssignList.length} xe và bàn giao cho khách ${assigningOrder.customerName}!`)
      setAssigningOrder(null)
      setSelectedVehiclesForAssignList([])
    } catch (err: any) {
      console.error("Error assigning vehicles:", err)
      showError(`Lỗi khi gán xe: ${err.message}`)
    } finally {
      setAssigningSubmitting(false)
    }
  }

  const parseVNToISODate = toDateInputValue

  const openEditDialog = (order: RentalOrder) => {
    setEditingOrder(order)
    const times = extractRentalTimes(order.notes)
    setEditFormData({
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      startDate: parseVNToISODate(order.startDate),
      endDate: parseVNToISODate(order.endDate),
      pickupTime: times.pickupTime,
      returnTime: times.returnTime,
      deposit: formatMoneyInput(order.deposit.toString()),
      extraFees: formatMoneyInput(order.extraFees.toString()),
      notes: stripRentalTermFromNotes(order.notes).replace(TIME_TAG_RE, "").trim(),
      status: order.status,
      commissionHome: formatMoneyInput((order.commissionHome || 0).toString()),
      homeName: order.homeName || "",
      rentalTerm: getRentalTerm(order),
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return

    const customer = customers.find((c) => c.id === editFormData.customerId) || {
      id: editFormData.customerId || editingOrder.customerId,
      name: editingOrder.customerName,
    }

    const previousVehicleId = editingOrder.vehicleId
    const isUnassigning = editFormData.vehicleId === UNASSIGNED_VEHICLE_ID
    let vehicle = isUnassigning
      ? {
          id: UNASSIGNED_VEHICLE_ID,
          name: "Chưa gán xe",
          licensePlate: "CHỜ GÁN XE",
          pricePerDay: editingOrder.pricePerDay || 0,
          color: "",
          status: "available" as const,
          current_km: 0,
          purchasePrice: 0,
          notes: "",
          vehicleImages: [] as string[],
          documentImages: [] as string[],
          totalRentalDays: 0,
          totalRevenue: 0,
          profit: 0,
        }
      : vehicles.find((v) => v.id === editFormData.vehicleId)
    if (!vehicle) {
      vehicle = {
        id: editFormData.vehicleId || editingOrder.vehicleId,
        name: editingOrder.vehicleName || "Chưa gán xe",
        licensePlate: editingOrder.licensePlate || "CHỜ GÁN XE",
        pricePerDay: editingOrder.pricePerDay || 0,
        color: "",
        status: "available",
        current_km: 0,
        purchasePrice: 0,
        notes: "",
        vehicleImages: [],
        documentImages: [],
        totalRentalDays: 0,
        totalRevenue: 0,
        profit: 0,
      }
    }

    if (!customer || !vehicle) {
      showWarning("Không tìm thấy thông tin xe hoặc khách hàng tương ứng!")
      return
    }

    // Check if vehicle is already rented during this period (excluding this rental itself)
    const startDate = new Date(editFormData.startDate)
    const endDate = new Date(editFormData.endDate)
    
    if (startDate > endDate) {
      showWarning("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
      return
    }

    try {
      const newExtraFees = parseMoneyInput(editFormData.extraFees)
      const newDeposit = parseMoneyInput(editFormData.deposit)
      const newCommissionHome = parseMoneyInput(editFormData.commissionHome) || 0
      const newHomeName = editFormData.homeName.trim()
      
      // Convert inputs back to vi-VN locale dates
      const newStartDate = toStoredDateValue(editFormData.startDate)
      const newEndDate = toStoredDateValue(editFormData.endDate)
      
      // Calculate totalDays and totalPrice
      const totalDays = calculateTotalDays(editFormData.startDate, editFormData.endDate)
      const totalPrice = totalDays * vehicle.pricePerDay
      
      // Recalculate revenue based on current status + new extraFees - home commission
      const commissionTotal = newCommissionHome * totalDays
      let newRevenue = editingOrder.revenue || 0
      if (editFormData.status === "completed") {
        newRevenue = totalPrice + newExtraFees - commissionTotal
      } else if (editFormData.status === "cancelled") {
        newRevenue = newDeposit + newExtraFees
      }
      
      const notesWithTimes = embedRentalTimes(
        editFormData.notes.trim(),
        editFormData.pickupTime,
        editFormData.returnTime
      )
      const termPayload = buildRentalTermPayload(editFormData.rentalTerm, notesWithTimes)
      const nextStatus: RentalOrder["status"] =
        isUnassigning && editFormData.status === "active" ? "pending" : editFormData.status
      const updatePayload: Record<string, unknown> = {
          customerId: customer.id,
          customerName: customer.name,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          licensePlate: vehicle.licensePlate,
          startDate: newStartDate,
          endDate: newEndDate,
          totalDays,
          pricePerDay: vehicle.pricePerDay,
          totalPrice,
          deposit: newDeposit,
          extraFees: newExtraFees,
          notes: termPayload.notes,
          status: nextStatus,
          revenue: newRevenue,
          commissionHome: newCommissionHome,
          homeName: newHomeName,
          rentalTerm: termPayload.rentalTerm,
        }
      if (isUnassigning) {
        updatePayload.received_at = null
      }

      let { error } = await supabase
        .from('rentals')
        .update(updatePayload)
        .eq('id', editingOrder.id)

      if (error && /rentalTerm/i.test(error.message || "")) {
        const { rentalTerm: _omit, ...withoutCol } = updatePayload
        ;({ error } = await supabase.from('rentals').update(withoutCol).eq('id', editingOrder.id))
      }
      if (error && /received_at/i.test(error.message || "")) {
        const { received_at: _omitReceived, ...withoutReceived } = updatePayload
        ;({ error } = await supabase.from('rentals').update(withoutReceived).eq('id', editingOrder.id))
      }

      if (error) {
        console.error("Error updating rental:", error)
        showError(`Lỗi: ${error.message}`)
        return
      }

      // Generate updated order object
      const updatedOrder: RentalOrder = {
        ...editingOrder,
        customerId: customer.id,
        customerName: customer.name,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        licensePlate: vehicle.licensePlate,
        startDate: newStartDate,
        endDate: newEndDate,
        totalDays,
        pricePerDay: vehicle.pricePerDay,
        totalPrice,
        deposit: newDeposit,
        extraFees: newExtraFees,
        notes: termPayload.notes,
        status: nextStatus,
        revenue: newRevenue,
        commissionHome: newCommissionHome,
        homeName: newHomeName,
        rentalTerm: editFormData.rentalTerm,
        received_at: isUnassigning ? undefined : editingOrder.received_at,
      }

      setOrders(orders.map((o) => (o.id === editingOrder.id ? updatedOrder : o)))

      const previousStillUsed = orders.some(
        (o) =>
          o.id !== editingOrder.id &&
          o.vehicleId === previousVehicleId &&
          (o.status === "active" || o.status === "pending") &&
          !isUnassignedVehicle(o)
      )
      setVehicles((prev) =>
        prev.map((v) => {
          if (
            previousVehicleId &&
            previousVehicleId !== UNASSIGNED_VEHICLE_ID &&
            v.id === previousVehicleId &&
            previousVehicleId !== vehicle.id &&
            !previousStillUsed
          ) {
            return { ...v, status: "available" as Vehicle["status"] }
          }
          if (vehicle.id !== UNASSIGNED_VEHICLE_ID && v.id === vehicle.id) {
            return {
              ...v,
              status: (nextStatus === "active" ? "rented" : nextStatus === "pending" ? "pending" : v.status) as Vehicle["status"],
            }
          }
          return v
        })
      )

      if (user) logger.editRental(user.username, user.displayName, customer.name, vehicle.name)
      showSuccess(
        isUnassigning
          ? `Đã huỷ gán xe cho đơn thuê ${editingOrder.customerName}. Đơn chuyển về chờ giao xe.`
          : `Đã lưu thay đổi cho đơn thuê ${editingOrder.customerName} thành công!`
      )
      setIsEditDialogOpen(false)
      setEditingOrder(null)
    } catch (error) {
      console.error("Exception updating rental:", error)
      showError(`Lỗi cập nhật đơn thuê`)
    }
  }

  // #4 Complete with late fee
  const openCompleteWithLateFee = (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    if (isOrderOverdue(order)) {
      setLateFeeOrderId(orderId)
      setLateFeeExtra("")
      setIsLateFeeOpen(true)
    } else {
      updateOrderStatus(orderId, "completed")
    }
  }

  const handleConfirmLateFee = async () => {
    const extra = parseMoneyInput(lateFeeExtra) || 0
    const order = orders.find(o => o.id === lateFeeOrderId)
    if (!order) return
    // update extraFees first then complete
    if (extra > 0) {
      await supabase.from("rentals").update({ extraFees: (order.extraFees || 0) + extra }).eq("id", lateFeeOrderId)
      setOrders(prev => prev.map(o => o.id === lateFeeOrderId ? { ...o, extraFees: (o.extraFees || 0) + extra } : o))
    }
    setIsLateFeeOpen(false)
    await updateOrderStatus(lateFeeOrderId, "completed")
  }

  const updateOrderStatus = async (orderId: string, newStatus: RentalOrder["status"]) => {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return

    try {
      // Tính doanh thu dựa trên trạng thái + chi phí phát sinh - hoa hồng home
      let revenue = 0
      const extraFees = order.extraFees || 0
      const commissionHome = order.commissionHome || 0
      const commissionTotal = commissionHome * order.totalDays
      
      if (newStatus === "cancelled") {
        // Hủy đơn: khách mất cọc + chi phí phát sinh -> doanh thu = tiền cọc + extraFees
        revenue = order.deposit + extraFees
      } else if (newStatus === "completed") {
        // Hoàn thành: trả cọc, thu tiền thuê + chi phí phát sinh - hoa hồng -> doanh thu = tiền thuê + extraFees - commissionTotal
        revenue = order.totalPrice + extraFees - commissionTotal
      }
      // pending và active chưa có doanh thu
      
      // DB doesn't have received_at or completed_at columns, so we only update status and revenue
      const updateData = { status: newStatus, revenue }

      // Update to Supabase
      const { error } = await supabase
        .from('rentals')
        .update(updateData)
        .eq('id', orderId)

      if (error) {
        console.error("Error updating rental status:", error)
        showError(`Lỗi: ${error.message}`)
        return
      }

      setOrders(orders.map((o) => (o.id === orderId ? { ...o, ...updateData, status: newStatus, revenue } : o)))
      const statusLabels: Record<string, string> = { pending: "Chờ giao xe", active: "Đang thuê", completed: "Hoàn thành", cancelled: "Đã hủy" }
      if (user) logger.log(user.username, user.displayName, 'Chỉnh sửa', 'Đơn thuê', `Cập nhật đơn ${orderId}: ${statusLabels[newStatus]}`)
    } catch (error) {
      console.error("Exception updating rental status:", error)
      showError(`Lỗi cập nhật trạng thái đơn thuê`)
    }
  }

  const openCustomerDetail = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId)
    if (customer) {
      setViewingCustomer(customer)
    }
  }

  const openVehicleDetail = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (vehicle) {
      setViewingVehicle(vehicle)
    }
  }

  const handleDeleteClick = (order: RentalOrder) => {
    setOrderToDelete(order)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return
    
    try {
      const { error } = await supabase
        .from('rentals')
        .delete()
        .eq('id', orderToDelete.id)
      
      if (error) throw error
      
      setOrders(orders.filter((o) => o.id !== orderToDelete.id))
      if (user) {
        logger.log(user.username, user.displayName, 'Xóa', 'Đơn thuê', `Xóa đơn thuê: ${orderToDelete.customerName} - ${orderToDelete.vehicleName} (${orderToDelete.rentalCode || orderToDelete.id})`)
      }
      setDeleteConfirmOpen(false)
      setOrderToDelete(null)
    } catch (error) {
      console.error("Error deleting rental:", error)
      showError("Lỗi khi xóa đơn thuê: " + (error as any).message)
    }
  }

  if (loading) {
    return (
      <ModulePageShell module="rental">
        <div className="space-y-6">
          <div className="h-16 skeleton rounded-[var(--radius-container)]" />
          <div className="h-96 skeleton rounded-[var(--radius-container)]" />
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell module="rental">
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá đơn thuê
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-base mt-2">
              Bạn có chắc chắn muốn xoá đơn thuê mã <span className="font-semibold text-slate-800">"{orderToDelete?.rentalCode || orderToDelete?.id}"</span> của khách hàng <span className="font-semibold text-slate-800">"{orderToDelete?.customerName}"</span> không?
              <p className="text-meta text-rose-600 mt-2">Hành động này không thể hoàn tác.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setOrderToDelete(null)
              }}
              className="border-slate-300"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModuleSubpageHeader
        module="rental"
        title="Đơn thuê"
        subtitle="Quản lý các đơn thuê xe"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Đơn thuê" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div
              role="group"
              aria-label="Chế độ xem"
              className="inline-flex items-center p-1 rounded-[var(--radius-control)] bg-slate-100 border border-slate-200"
            >
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "relative h-10 px-3 rounded-[calc(var(--radius-control)-2px)] text-body font-semibold ui-transition flex items-center gap-1.5",
                  viewMode === "table"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Danh sách</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "relative h-10 px-3 rounded-[calc(var(--radius-control)-2px)] text-body font-semibold ui-transition flex items-center gap-1.5",
                  viewMode === "timeline"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                )}
              >
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Sơ đồ Timeline</span>
              </button>
            </div>

            <div
              role="group"
              aria-label="Lọc loại thuê"
              className="inline-flex items-center p-1 rounded-[var(--radius-control)] bg-slate-100 border border-slate-200"
            >
              {([
                { value: "short" as const, label: "Thuê ngắn hạn" },
                { value: "long" as const, label: "Thuê dài hạn" },
              ]).map((opt) => {
                const active = filterTerm === opt.value
                const count = termCounts[opt.value]
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilterTerm(opt.value)}
                    className={cn(
                      "relative h-10 px-3.5 rounded-[calc(var(--radius-control)-2px)] text-body font-semibold ui-transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1",
                      active
                        ? "bg-blue-600 !text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)]"
                        : "text-slate-500 hover:text-slate-800 hover:bg-white/80"
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {opt.label}
                      <span
                        className={cn(
                          "inline-flex min-w-[1.35rem] h-5 items-center justify-center rounded-md px-1 text-label font-bold tabular-nums",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-slate-200/80 text-slate-600"
                        )}
                      >
                        {count}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <Button
              variant="outline"
              onClick={() => setIsDailyNotificationOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition [&_svg]:text-amber-500 hover:border-slate-400 relative"
            >
              <Bell className="w-4 h-4 mr-1.5 text-amber-500" />
              Thông báo
              {dailyNotifyBadgeCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white leading-none">
                  {dailyNotifyBadgeCount}
                </span>
              )}
            </Button>
            <Button
              className="bg-blue-600 !text-white hover:bg-blue-700 hover:!text-white rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition [&_svg]:!text-white"
              onClick={() => {
                setFormData((prev) => ({ ...prev, rentalTerm: filterTerm }))
                setIsDialogOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Tạo đơn thuê mới
            </Button>
          </div>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <EntityFormDialogContent
            accent="blue"
            maxWidth="2xl"
            onPointerDownOutside={keepDialogOpenWhilePickingFile}
            onFocusOutside={keepDialogOpenWhilePickingFile}
            onInteractOutside={keepDialogOpenWhilePickingFile}
          >
            <EntityFormHeader
              title="Tạo đơn thuê mới"
              description="Khách, xe và thời hạn thuê"
            />
            <form onSubmit={handleSubmit}>
              <EntityFormBody>
                <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="h-11 w-11 shrink-0 rounded-[var(--radius-badge)] bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-title truncate">
                      {isNewCustomer
                        ? (newCustomerName.trim() || "Khách mới")
                        : (customerSearch.trim() || "Chưa chọn khách")}
                    </p>
                    <p className="text-meta truncate">
                      {formData.vehicleIds.length > 0
                        ? `${formData.vehicleIds.length} xe`
                        : deferVehicleAssign
                          ? "Chưa gán xe"
                          : "Chưa chọn xe"}
                      {formData.startDate && formData.endDate
                        ? ` · ${formData.startDate} → ${formData.endDate}`
                        : ""}
                    </p>
                  </div>
                </div>

                <EntityFormSection title="Khách thuê" description="Khách cũ hoặc hồ sơ mới">
                  <EntityFormToggle
                    value={isNewCustomer ? "new" : "existing"}
                    onChange={(val) => setIsNewCustomer(val === "new")}
                    options={[
                      { value: "existing", label: "Khách cũ" },
                      { value: "new", label: "Khách mới" },
                    ]}
                  />

                  {!isNewCustomer ? (
                    <div className="space-y-2 relative">
                      <EntityFormField label="Tìm khách hàng" required>
                        <Input
                          placeholder="Tên hoặc số điện thoại"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            setShowCustomerDropdown(true)
                            setFormData(prev => ({ ...prev, customerId: "" }))
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          className={entityFormInputClass}
                          required={!isNewCustomer}
                        />
                      </EntityFormField>
                      {showCustomerDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)} />
                          <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-[var(--radius-control)] shadow-lg max-h-60 overflow-y-auto mt-1">
                            {filteredCustomersForSelect.length === 0 ? (
                              <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy khách hàng</div>
                            ) : (
                              filteredCustomersForSelect.map((customer) => (
                                <div
                                  key={customer.id}
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, customerId: customer.id }))
                                    setCustomerSearch(`${customer.name} (${customer.phone || "Không SĐT"})`)
                                    setShowCustomerDropdown(false)
                                  }}
                                  className="p-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer ui-transition border-b border-slate-50 last:border-0"
                                >
                                  <span className="font-semibold">{customer.name}</span>
                                  {customer.phone ? ` · ${customer.phone}` : ""}
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                      <input type="hidden" name="customerId" value={formData.customerId} required={!isNewCustomer} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-meta">Điền * để tạo hồ sơ khách cùng lúc với đơn.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EntityFormField label="Họ và tên" required>
                          <Input
                            placeholder="Nguyễn Văn A"
                            autoComplete="name"
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            className={entityFormInputClass}
                            required={isNewCustomer}
                          />
                        </EntityFormField>
                        <EntityFormField label="Số điện thoại" required>
                          <Input
                            type="tel"
                            inputMode="tel"
                            placeholder="0901234567"
                            autoComplete="tel"
                            value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                            className={cn(entityFormInputClass, "tabular-nums")}
                            required={isNewCustomer}
                          />
                        </EntityFormField>
                        <EntityFormField label="Địa chỉ" required>
                          <Input
                            placeholder="Tây Lộc, TP. Huế"
                            autoComplete="street-address"
                            value={newCustomerAddress}
                            onChange={(e) => setNewCustomerAddress(e.target.value)}
                            className={entityFormInputClass}
                            required={isNewCustomer}
                          />
                        </EntityFormField>
                        <EntityFormField label="Số CCCD / CMND">
                          <Input
                            inputMode="numeric"
                            placeholder="079123456789"
                            value={newCustomerCCCD}
                            onChange={(e) => setNewCustomerCCCD(e.target.value.replace(/^CCCD_/i, ""))}
                            className={cn(entityFormInputClass, "font-mono")}
                          />
                        </EntityFormField>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FilePickTile
                          label="Ảnh khách"
                          file={newCustomerPhoto}
                          onFile={setNewCustomerPhoto}
                          onPickStart={markPickingFile}
                        />
                        <FilePickTile
                          label="CCCD mặt trước"
                          file={newCustomerCCCDFront}
                          onFile={setNewCustomerCCCDFront}
                          onPickStart={markPickingFile}
                        />
                      </div>
                    </div>
                  )}
                </EntityFormSection>

                <EntityFormSection title="Xe thuê" description="Chọn xe sẵn sàng hoặc để trống, gán lúc giao">
                  <div className="space-y-3 relative">
                    {formData.vehicleIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {formData.vehicleIds.map((vId) => {
                          const vObj = vehicles.find(v => v.id === vId)
                          if (!vObj) return null
                          return (
                            <span
                              key={vId}
                              className="inline-flex items-center gap-1.5 text-meta font-semibold px-2.5 py-1 rounded-[var(--radius-badge)] bg-blue-50 text-blue-700 border border-blue-100"
                            >
                              <span className="truncate max-w-[12rem]">{vObj.name} · {vObj.licensePlate}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    vehicleIds: prev.vehicleIds.filter(id => id !== vId)
                                  }))
                                }}
                                className="hover:bg-blue-100 rounded p-0.5 text-blue-500 hover:text-blue-700 ui-transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <EntityFormField label="Tìm xe">
                      <Input
                        placeholder="Tên xe hoặc biển số"
                        value={vehicleSearch}
                        disabled={deferVehicleAssign}
                        onChange={(e) => {
                          setVehicleSearch(e.target.value)
                          setShowVehicleDropdown(true)
                        }}
                        onFocus={() => {
                          if (!deferVehicleAssign) setShowVehicleDropdown(true)
                        }}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deferVehicleAssign}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setDeferVehicleAssign(checked)
                          if (checked) {
                            setFormData((prev) => ({ ...prev, vehicleIds: [] }))
                            setVehicleSearch("")
                            setShowVehicleDropdown(false)
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-body font-semibold text-slate-700">Chưa chọn gán xe</span>
                    </label>

                    {deferVehicleAssign && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <EntityFormField label="Số lượng xe">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={20}
                            value={unassignedQuantity}
                            onChange={(e) => setUnassignedQuantity(e.target.value)}
                            placeholder="1"
                            className={cn(entityFormInputClass, "font-bold")}
                          />
                        </EntityFormField>
                        <EntityFormField label="Đơn giá / xe / ngày">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={unassignedPricePerDay}
                            onChange={(e) => setUnassignedPricePerDay(formatMoneyInput(e.target.value))}
                            placeholder="120.000"
                            className={cn(entityFormInputClass, "font-mono")}
                          />
                        </EntityFormField>
                      </div>
                    )}

                    {showVehicleDropdown && !deferVehicleAssign && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowVehicleDropdown(false)} />
                        <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-[var(--radius-control)] shadow-xl max-h-72 overflow-y-auto mt-1 divide-y divide-slate-100">
                          {filteredVehiclesForSelect.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500 text-center">Không có xe khả dụng</div>
                          ) : (
                            filteredVehiclesForSelect.map(({ vehicle, status }) => {
                              const isBlocked = !status.isAvailable
                              return (
                                <div
                                  key={vehicle.id}
                                  onClick={() => {
                                    if (isBlocked) return
                                    setDeferVehicleAssign(false)
                                    setFormData((prev) => ({
                                      ...prev,
                                      vehicleIds: [...prev.vehicleIds, vehicle.id],
                                    }))
                                    setVehicleSearch("")
                                    setShowVehicleDropdown(false)
                                  }}
                                  className={cn(
                                    "p-3 text-xs flex items-center justify-between gap-2 ui-transition",
                                    isBlocked
                                      ? "bg-slate-50/90 text-slate-400 cursor-not-allowed opacity-75"
                                      : "hover:bg-blue-50/50 cursor-pointer text-slate-800"
                                  )}
                                >
                                  <div className="space-y-0.5 min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{vehicle.name}</span>
                                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[11px]">
                                        {vehicle.licensePlate}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                      <span>{vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày</span>
                                      {status.reason && (
                                        <span className="truncate max-w-[200px] text-slate-400">· {status.reason}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                                        status.badgeTone === "emerald" && "bg-emerald-100 text-emerald-800",
                                        status.badgeTone === "amber" && "bg-amber-100 text-amber-900 border border-amber-300",
                                        status.badgeTone === "rose" && "bg-rose-100 text-rose-800",
                                        status.badgeTone === "slate" && "bg-slate-100 text-slate-600"
                                      )}
                                    >
                                      {status.badgeLabel}
                                    </span>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </EntityFormSection>

                <EntityFormSection title="Hợp đồng" description="Loại thuê, ngày và tiền cọc">
                  <EntityFormField label="Loại thuê" required>
                    <EntityFormToggle
                      value={formData.rentalTerm}
                      onChange={(val) => setFormData({ ...formData, rentalTerm: val as RentalTerm })}
                      options={[
                        { value: "short", label: "Ngắn hạn" },
                        { value: "long", label: "Dài hạn" },
                      ]}
                    />
                  </EntityFormField>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EntityFormField label="Ngày & Giờ nhận xe" required>
                      <div className="grid grid-cols-5 gap-2">
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-3")}
                          required
                        />
                        <Input
                          id="pickupTime"
                          type="time"
                          value={formData.pickupTime}
                          onChange={(e) => setFormData({ ...formData, pickupTime: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-2 font-mono text-xs text-center px-1")}
                          title="Giờ nhận xe"
                        />
                      </div>
                    </EntityFormField>
                    <EntityFormField label="Ngày & Giờ trả xe" required>
                      <div className="grid grid-cols-5 gap-2">
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-3")}
                          required
                        />
                        <Input
                          id="returnTime"
                          type="time"
                          value={formData.returnTime}
                          onChange={(e) => setFormData({ ...formData, returnTime: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-2 font-mono text-xs text-center px-1")}
                          title="Giờ trả xe"
                        />
                      </div>
                    </EntityFormField>
                  </div>

                  <EntityFormField label="Tiền đặt cọc" required>
                    <Input
                      id="deposit"
                      type="text"
                      inputMode="numeric"
                      value={formData.deposit}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setFormData({ ...formData, deposit: formatted })
                      }}
                      placeholder="500.000"
                      className={cn(entityFormInputClass, "font-mono")}
                      required
                    />
                  </EntityFormField>

                  <EntityFormField label="Ghi chú">
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Giờ trả xe, giảm giá, đã cọc..."
                      className={cn(entityFormInputClass, "min-h-16 resize-y")}
                    />
                  </EntityFormField>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      id="hasCommission"
                      type="checkbox"
                      checked={hasCommission}
                      onChange={(e) => setHasCommission(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-body font-semibold text-slate-700">Chia hoa hồng</span>
                  </label>

                  {hasCommission && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-[var(--radius-control)] border border-amber-100 bg-amber-50 p-3">
                      <EntityFormField label="Tên Home">
                        <Input
                          id="homeName"
                          type="text"
                          value={formData.homeName}
                          onChange={(e) => setFormData({ ...formData, homeName: e.target.value })}
                          placeholder="Home ABC"
                          className={entityFormInputClass}
                        />
                      </EntityFormField>
                      <EntityFormField label="Hoa hồng / ngày">
                        <Input
                          id="commissionHome"
                          type="text"
                          inputMode="numeric"
                          value={formData.commissionHome}
                          onChange={(e) => {
                            const formatted = formatMoneyInput(e.target.value)
                            setFormData({ ...formData, commissionHome: formatted })
                          }}
                          placeholder="20.000"
                          className={cn(entityFormInputClass, "font-mono")}
                        />
                      </EntityFormField>
                    </div>
                  )}
                </EntityFormSection>
              </EntityFormBody>

              <EntityFormFooter
                accent="blue"
                onCancel={resetForm}
                submitLabel="Tạo đơn"
              />
            </form>
          </EntityFormDialogContent>
        </Dialog>

        {viewMode === "timeline" ? (
          <FleetTimelineView
            vehicles={vehicles}
            rentals={orders}
            onSelectOrder={(rental) => {
              const fullOrder = orders.find((o) => o.id === rental.id) || (rental as RentalOrder)
              openEditDialog(fullOrder)
            }}
            onQuickBookVehicle={handleQuickBookFromTimeline}
          />
        ) : (
          <div className="space-y-4">
            <ModuleKpiGrid columns={5}>
          <RentalKpiCard
            variant="hero"
            label="Tổng đơn thuê"
            value={orderStats.total}
            sublabel={
              <>
                <span className="block">{filteredOrders.length} đang lọc</span>
                <span className="block mt-0.5">
                  Số đơn tháng {orderStats.month}: {orderStats.newThisMonth} đơn
                </span>
              </>
            }
            onClick={() => setFilterStatus("all")}
            selected={filterStatus === "all"}
          />
          <RentalKpiCard
            variant="hero"
            label="Chờ giao xe"
            value={orderStats.pending}
            sublabel="Chưa giao xe"
            valueClassName="text-amber-700"
            onClick={() => setFilterStatus("pending")}
            selected={filterStatus === "pending"}
          />
          <RentalKpiCard
            variant="hero"
            label="Đang thuê"
            value={orderStats.active}
            sublabel="Đơn hiện hành"
            valueClassName="text-blue-700"
            onClick={() => setFilterStatus("active")}
            selected={filterStatus === "active"}
          />
          <RentalKpiCard
            variant="hero"
            label="Quá hạn"
            value={orderStats.overdue}
            sublabel="Cần theo dõi"
            valueClassName="text-rose-600"
            onClick={() => setFilterStatus("overdue")}
            selected={filterStatus === "overdue"}
          />
          <RentalKpiCard
            variant="hero"
            label="Hoàn thành"
            value={orderStats.completed}
            sublabel={`Doanh thu: ${formatPrice(orderStats.revenue)}`}
            valueClassName="text-emerald-700"
            onClick={() => setFilterStatus("completed")}
            selected={filterStatus === "completed"}
          />
        </ModuleKpiGrid>

      <ModuleSectionCard
        title="Danh sách đơn thuê xe"
        description={`${filteredOrders.length} đơn · ${getRentalTermLabel(filterTerm)}`}
        filters={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Mã đơn, khách, xe..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={cn(rentalFilterInputClass, "pl-9 h-10")}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-44 h-10 rounded-[var(--radius-control)] border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pickup_today">Nhận xe hôm nay</SelectItem>
                <SelectItem value="return_today">Trả xe hôm nay</SelectItem>
                <SelectItem value="pending">Chờ giao xe</SelectItem>
                <SelectItem value="active">Đang thuê</SelectItem>
                <SelectItem value="overdue">Quá hạn</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <ModuleEmptyState
              title={`Chưa có đơn ${filterTerm === "long" ? "thuê dài hạn" : "thuê ngắn hạn"}`}
              description="Thử đổi từ khóa hoặc bộ lọc, hoặc tạo đơn thuê mới."
              action={
                <Button
                  className="bg-blue-600 !text-white hover:bg-blue-700 hover:!text-white rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition [&_svg]:!text-white"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, rentalTerm: filterTerm }))
                    setIsDialogOpen(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo đơn thuê mới
                </Button>
              }
            />
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center text-slate-600")}>STT</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Khách</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Xe thuê</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Thời gian</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Tổng tiền</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Thu</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Trạng thái</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {paginatedOrders.map((order, index) => {
                        const isOverdue = isOrderOverdue(order)
                        return (
                          <tr key={order.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                            <td className="py-3.5 px-4 min-w-[100px] max-w-[140px]">
                              <button
                                className="font-semibold text-slate-900 hover:text-slate-700 hover:underline text-left capitalize line-clamp-2 block"
                                onClick={() => openCustomerDetail(order.customerId)}
                              >
                                {order.customerName}
                              </button>
                              {isWebBookingOrder(order.notes) && (
                                <p className="text-meta text-blue-600 mt-0.5">(đặt từ Web)</p>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1.5">
                                <button
                                  className="font-bold text-slate-800 text-body hover:text-slate-700 hover:underline text-left block"
                                  onClick={() => openVehicleDetail(order.vehicleId)}
                                >
                                  {order.vehicleName}
                                </button>
                                <div>
                                  <span className="inline-block bg-white text-slate-800 border border-slate-200 font-mono font-bold px-2.5 py-1 rounded-[var(--radius-badge)] text-sm shadow-sm tracking-wider uppercase whitespace-nowrap">
                                    {order.licensePlate}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center text-sm font-semibold text-slate-700">
                              <div className="whitespace-nowrap">{formatDisplayDate(order.startDate)}</div>
                              <div className="whitespace-nowrap"><span className="text-slate-400 text-sm mr-1">→</span>{formatDisplayDate(order.endDate)}</div>
                              <div className="text-meta text-slate-500 mt-0.5 whitespace-nowrap">{order.totalDays} ngày</div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="font-bold money text-sm tabular-nums text-slate-900 whitespace-nowrap">{order.totalPrice.toLocaleString("vi-VN")} đ</div>
                              <div className="text-meta text-slate-500 mt-0.5 whitespace-nowrap">{order.pricePerDay.toLocaleString("vi-VN")} đ/ngày</div>
                              <div className="flex items-center justify-end mt-0.5">
                                {order.deposit > 0 ? (
                                  <span className="text-sm font-semibold px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">Đã cọc {order.deposit.toLocaleString("vi-VN")}đ</span>
                                ) : (
                                  <span className="text-sm font-semibold px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-amber-50 text-amber-600 border border-amber-100 whitespace-nowrap">Chưa cọc</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-sm whitespace-nowrap">
                              {order.revenue > 0 ? (
                                <span className="font-bold money tabular-nums text-rose-600">
                                  {order.revenue.toLocaleString("vi-VN")} đ
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className={cn(orderStatusBadgeClass, rentalOrderStatusBadgeClass(order.status, isOverdue))}>
                                {getRentalOrderStatusLabel(order.status, isOverdue)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-end gap-1 flex-nowrap">
                                {order.status === "pending" && (
                                  <Button variant="ghost" size="sm" className={cn(orderQuickActionClass, "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50")} onClick={() => handleDeliverOrderClick(order)} title="Giao xe">
                                    <Play className="w-3.5 h-3.5" />Giao
                                  </Button>
                                )}
                                {(order.status === "active" || isOrderOverdue(order)) && (
                                  <Button variant="ghost" size="sm" className={cn(orderQuickActionClass, "text-blue-700 hover:text-blue-800 hover:bg-blue-50")} onClick={() => openCompleteWithLateFee(order.id)} title="Hoàn thành">
                                    <CheckCircle className="w-3.5 h-3.5" />Xong
                                  </Button>
                                )}
                                <Button variant="outline" size="icon-sm" className={orderActionBtnClass} onClick={() => setViewingOrder(order)} title="Xem chi tiết">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="icon-sm" className={orderActionBtnClass} onClick={() => openEditDialog(order)} title="Chỉnh sửa">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {user?.permissions.canDelete && (
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    className="h-9 w-9 p-0 border-rose-200 rounded-[var(--radius-control)] hover:bg-rose-50 text-rose-600"
                                    onClick={() => handleDeleteClick(order)}
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                }
                mobile={paginatedOrders.map((order) => {
                  const isOverdue = isOrderOverdue(order)
                  return (
                    <ModuleMobileCard key={order.id}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{order.customerName}</p>
                          {isWebBookingOrder(order.notes) && (
                            <p className="text-meta text-blue-600">(đặt từ Web)</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-sm text-slate-700 font-medium">{order.vehicleName}</span>
                            <span className="inline-block bg-white text-slate-800 border border-slate-200 font-mono font-bold px-1.5 py-0.5 rounded-[var(--radius-badge)] text-sm shadow-sm tracking-wider uppercase">
                              {order.licensePlate}
                            </span>
                          </div>
                        </div>
                        <span className={cn(orderStatusBadgeClass, "shrink-0", rentalOrderStatusBadgeClass(order.status, isOverdue))}>
                          {getRentalOrderStatusLabel(order.status, isOverdue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatDisplayDate(order.startDate)} → {formatDisplayDate(order.endDate)}</span>
                        <span className="text-slate-300">·</span>
                        <span>{order.totalDays} ngày</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          {order.deposit > 0 ? (
                            <span className="text-sm font-semibold px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-emerald-50 text-emerald-700 border border-emerald-100">Đã cọc</span>
                          ) : (
                            <span className="text-sm font-semibold px-1.5 py-0.5 rounded-[var(--radius-badge)] bg-amber-50 text-amber-600 border border-amber-100">Chưa cọc</span>
                          )}
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              className="h-9 px-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 !text-white rounded-[var(--radius-control)]"
                              onClick={() => handleDeliverOrderClick(order)}
                            >
                              Giao xe
                            </Button>
                          )}
                          {(order.status === "active" || isOverdue) && (
                            <Button
                              size="sm"
                              className="h-9 px-2.5 text-sm bg-blue-600 hover:bg-blue-700 !text-white rounded-[var(--radius-control)]"
                              onClick={() => openCompleteWithLateFee(order.id)}
                            >
                              Xong
                            </Button>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 money tabular-nums text-sm">{order.totalPrice.toLocaleString("vi-VN")} đ</span>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/50">
                        <span className="text-meta text-slate-400">Đơn #{order.rentalCode || order.id.substring(0, 8)}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => setViewingOrder(order)} title="Xem chi tiết">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => openEditDialog(order)} title="Chỉnh sửa">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {user?.permissions.canDelete && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-9 w-9 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleDeleteClick(order)}
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
                totalItems={filteredOrders.length}
                itemLabel="đơn"
                onPageChange={setCurrentPage}
                className="rounded-b-2xl"
              />
            </>
          )}
        </CardContent>
      </ModuleSectionCard>
      </div>
      )}

      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <EntityFormDialogContent accent="blue" maxWidth="lg">
          {viewingOrder && (() => {
            const o = viewingOrder
            const overdue = isOrderOverdue(o)
            const term = getRentalTerm(o)
            const notesClean = stripRentalTermFromNotes(o.notes)
            const commissionTotal = (o.commissionHome || 0) * (o.totalDays || 0)
            const payable = o.totalPrice + (o.extraFees || 0)
            return (
              <>
                <EntityFormHeader
                  title="Chi tiết đơn"
                  description={`${o.rentalCode || o.id.slice(0, 8)} · ${formatDisplayDate(o.startDate)} → ${formatDisplayDate(o.endDate)} · ${o.totalDays} ngày`}
                />
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(orderStatusBadgeClass, rentalOrderStatusBadgeClass(o.status, overdue))}>
                      {getRentalOrderStatusLabel(o.status, overdue)}
                    </span>
                    <span className={cn(
                      orderStatusBadgeClass,
                      term === "long"
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {getRentalTermLabel(term)}
                    </span>
                    {o.deposit > 0 ? (
                      <span className={cn(orderStatusBadgeClass, "bg-emerald-50 text-emerald-700 border-emerald-100")}>
                        Đã cọc
                      </span>
                    ) : (
                      <span className={cn(orderStatusBadgeClass, "bg-amber-50 text-amber-700 border-amber-100")}>
                        Chưa cọc
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <OrderStat label="Tổng tiền thuê" value={formatPrice(payable)} />
                    <OrderStat
                      label="Tiền cọc"
                      value={formatPrice(o.deposit)}
                      tone={o.deposit > 0 ? "emerald" : "amber"}
                    />
                    <div className="col-span-2 sm:col-span-1">
                      <OrderStat
                        label="Doanh thu"
                        value={o.status === "pending" || o.status === "active" ? "Chưa chốt" : formatPrice(o.revenue || 0)}
                        tone={
                          o.status === "completed" ? "emerald"
                            : o.status === "cancelled" ? "amber"
                            : "muted"
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 text-left ui-transition hover:border-blue-200 hover:bg-blue-50/40"
                      onClick={() => {
                        setViewingOrder(null)
                        openCustomerDetail(o.customerId)
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-label text-slate-500">Khách hàng</p>
                        <p className="text-body font-semibold text-slate-900 truncate">{o.customerName}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 text-left ui-transition hover:border-blue-200 hover:bg-blue-50/40"
                      onClick={() => {
                        setViewingOrder(null)
                        openVehicleDetail(o.vehicleId)
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-label text-slate-500">Xe thuê</p>
                        <p className="text-body font-semibold text-slate-900 truncate">{o.vehicleName}</p>
                        <p className="text-meta font-mono">{o.licensePlate || "Chưa biển"}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <OrderStat label="Nhận xe" value={formatDisplayDate(o.startDate)} />
                    <OrderStat label="Trả xe" value={formatDisplayDate(o.endDate)} />
                    <OrderStat label="Số ngày" value={`${o.totalDays} ngày`} />
                    <OrderStat label="Giá/ngày" value={formatPrice(o.pricePerDay)} />
                    {o.extraFees > 0 && (
                      <OrderStat label="Phí phát sinh" value={formatPrice(o.extraFees)} tone="amber" />
                    )}
                    {commissionTotal > 0 && (
                      <OrderStat
                        label={o.homeName ? `HH · ${o.homeName}` : "Hoa hồng Home"}
                        value={formatPrice(commissionTotal)}
                      />
                    )}
                  </div>

                  {notesClean && (
                    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-label text-slate-500 mb-1">Ghi chú</p>
                      <p className="text-body text-slate-700 whitespace-pre-line">{notesClean}</p>
                    </div>
                  )}

                  {(o.status === "completed" || o.status === "cancelled") && (
                    <div className="rounded-[var(--radius-control)] border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2">
                        <p className="text-label font-semibold text-slate-700">Chi tiết tài chính</p>
                      </div>
                      <div className="p-3 space-y-1.5">
                        {o.status === "completed" ? (
                          <>
                            <div className="flex justify-between gap-3 text-body">
                              <span className="text-slate-500">Tiền thuê xe</span>
                              <span className="font-semibold text-emerald-600 tabular-nums shrink-0">+{formatPrice(o.totalPrice)}</span>
                            </div>
                            {o.extraFees > 0 && (
                              <div className="flex justify-between gap-3 text-body">
                                <span className="text-slate-500">Phí phát sinh</span>
                                <span className="font-semibold text-emerald-600 tabular-nums shrink-0">+{formatPrice(o.extraFees)}</span>
                              </div>
                            )}
                            {commissionTotal > 0 && (
                              <div className="flex justify-between gap-3 text-body">
                                <span className="text-slate-500">Hoa hồng Home</span>
                                <span className="font-semibold text-rose-600 tabular-nums shrink-0">-{formatPrice(commissionTotal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-3 text-body">
                              <span className="text-slate-500">Trả cọc khách</span>
                              <span className="font-medium text-slate-400 tabular-nums shrink-0">-{formatPrice(o.deposit)}</span>
                            </div>
                            <div className="flex justify-between gap-3 text-body pt-2 border-t border-slate-100">
                              <span className="font-semibold text-slate-800">Doanh thu thực nhận</span>
                              <span className="font-semibold text-emerald-700 money tabular-nums shrink-0">{formatPrice(o.revenue || 0)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between gap-3 text-body">
                              <span className="text-slate-500">Khách hủy — mất cọc</span>
                              <span className="font-semibold text-amber-600 tabular-nums shrink-0">+{formatPrice(o.deposit)}</span>
                            </div>
                            {o.extraFees > 0 && (
                              <div className="flex justify-between gap-3 text-body">
                                <span className="text-slate-500">Phí phát sinh</span>
                                <span className="font-semibold text-amber-600 tabular-nums shrink-0">+{formatPrice(o.extraFees)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-3 text-body pt-2 border-t border-slate-100">
                              <span className="font-semibold text-slate-800">Doanh thu</span>
                              <span className="font-semibold text-amber-700 money tabular-nums shrink-0">{formatPrice(o.revenue || 0)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="mx-auto sm:mx-0 h-36 w-36 shrink-0 overflow-hidden rounded-lg bg-white p-1.5 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getVietQrImageUrl({
                          amount: payable,
                          addInfo: `TT 3L MOTO ${o.rentalCode || o.id.slice(0, 8)}`,
                        })}
                        alt="VietQR BIDV Lê Quốc Lộc"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = STATIC_PAYMENT_QR_SRC
                        }}
                      />
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-label text-slate-500">QR thanh toán · cọc / tất toán</p>
                      <p className="text-body font-semibold text-slate-900">{QUY79_BUSINESS.bank.accountHolder}</p>
                      <p className="text-body font-mono tabular-nums text-slate-800">{QUY79_BUSINESS.bank.accountNumber}</p>
                      <p className="text-meta">{QUY79_BUSINESS.bank.name} - {QUY79_BUSINESS.bank.branch}</p>
                      <p className="text-body font-semibold money tabular-nums text-slate-900 mt-1">{formatPrice(payable)}</p>
                    </div>
                  </div>

                  <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:w-auto rounded-[var(--radius-control)] border-slate-200"
                      onClick={() => setViewingOrder(null)}
                    >
                      Đóng
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:flex-1 rounded-[var(--radius-control)]"
                      onClick={() => {
                        setViewingOrder(null)
                        openEditDialog(o)
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Chỉnh sửa
                    </Button>
                    {o.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          className="h-11 w-full sm:flex-1 rounded-[var(--radius-control)]"
                          onClick={() => {
                            updateOrderStatus(o.id, "cancelled")
                            setViewingOrder(null)
                          }}
                        >
                          Hủy đơn
                        </Button>
                        <Button
                          className="h-11 w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 !text-white rounded-[var(--radius-control)] [&_svg]:!text-white"
                          onClick={() => {
                            updateOrderStatus(o.id, "active")
                            setViewingOrder(null)
                          }}
                        >
                          Giao xe
                        </Button>
                      </>
                    )}
                    {(o.status === "active" || overdue) && o.status !== "completed" && o.status !== "cancelled" && (
                      <Button
                        className="h-11 w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 !text-white rounded-[var(--radius-control)] [&_svg]:!text-white"
                        onClick={() => {
                          setViewingOrder(null)
                          openCompleteWithLateFee(o.id)
                        }}
                      >
                        Hoàn thành
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title="Sửa đơn thuê"
            description={`${editingOrder?.rentalCode || editingOrder?.id?.slice(0, 8) || ""} · ${editingOrder?.customerName || ""}`}
          />
          <form onSubmit={handleEditSubmit}>
            <EntityFormBody>
            <EntityFormSection title="Thông tin đơn" description="Loại thuê, xe và thời hạn">
            <EntityFormField label="Loại thuê">
              <EntityFormToggle
                value={editFormData.rentalTerm}
                onChange={(val) => setEditFormData({ ...editFormData, rentalTerm: val as RentalTerm })}
                options={[
                  { value: "short", label: "Ngắn hạn" },
                  { value: "long", label: "Dài hạn" },
                ]}
              />
            </EntityFormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntityFormField label="Khách hàng">
              <Input
                value={editingOrder?.customerName || ""}
                disabled
                className={cn(entityFormInputClass, "bg-slate-100 text-slate-500 cursor-not-allowed")}
              />
            </EntityFormField>

            <EntityFormField label="Xe thuê">
              <Select
                value={editFormData.vehicleId}
                onValueChange={(value) => {
                  const next = { ...editFormData, vehicleId: value }
                  if (value === UNASSIGNED_VEHICLE_ID && editFormData.status === "active") {
                    next.status = "pending"
                  }
                  setEditFormData(next)
                }}
              >
                <SelectTrigger className={entityFormInputClass}>
                  <SelectValue placeholder="Chọn xe" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 rounded-[var(--radius-control)]">
                  <SelectItem value={UNASSIGNED_VEHICLE_ID}>Chưa gán xe</SelectItem>
                  {(evaluatedVehiclesForEdit?.allEvaluated || vehicles.map(v => ({ vehicle: v, status: { isAvailable: true, badgeLabel: "", badgeTone: "slate" as const } })))
                    .map(({ vehicle, status }) => (
                      <SelectItem
                        key={vehicle.id}
                        value={vehicle.id}
                        disabled={!status.isAvailable && vehicle.id !== editFormData.vehicleId}
                      >
                        {vehicle.name} – {vehicle.licensePlate} {status.badgeLabel ? `(${status.badgeLabel})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {editingOrder &&
                !isUnassignedVehicle(editingOrder) &&
                editFormData.vehicleId !== UNASSIGNED_VEHICLE_ID &&
                (editFormData.status === "pending" || editFormData.status === "active") && (
                  <button
                    type="button"
                    className="mt-1.5 inline-flex items-center gap-1 text-meta text-rose-600 hover:text-rose-700"
                    onClick={() =>
                      setEditFormData({
                        ...editFormData,
                        vehicleId: UNASSIGNED_VEHICLE_ID,
                        status: editFormData.status === "active" ? "pending" : editFormData.status,
                      })
                    }
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Huỷ gán xe
                  </button>
                )}
              {editFormData.vehicleId === UNASSIGNED_VEHICLE_ID && (
                <p className="text-meta text-slate-500 mt-1.5">
                  Đơn chờ giao xe. Gán xe lại khi bàn giao.
                </p>
              )}
            </EntityFormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EntityFormField label="Ngày & Giờ nhận xe" required>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    id="edit-startDate"
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className={cn(entityFormInputClass, "col-span-3")}
                    required
                  />
                  <Input
                    id="edit-pickupTime"
                    type="time"
                    value={editFormData.pickupTime}
                    onChange={(e) => setEditFormData({ ...editFormData, pickupTime: e.target.value })}
                    className={cn(entityFormInputClass, "col-span-2 font-mono text-xs text-center px-1")}
                    title="Giờ nhận xe"
                  />
                </div>
              </EntityFormField>
              <EntityFormField label="Ngày & Giờ trả xe" required>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    id="edit-endDate"
                    type="date"
                    value={editFormData.endDate}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                    className={cn(entityFormInputClass, "col-span-3")}
                    required
                  />
                  <Input
                    id="edit-returnTime"
                    type="time"
                    value={editFormData.returnTime}
                    onChange={(e) => setEditFormData({ ...editFormData, returnTime: e.target.value })}
                    className={cn(entityFormInputClass, "col-span-2 font-mono text-xs text-center px-1")}
                    title="Giờ trả xe"
                  />
                </div>
              </EntityFormField>
            </div>
            </EntityFormSection>

            <EntityFormSection title="Tài chính" description="Cọc, phí phát sinh và hoa hồng">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntityFormField label="Tiền đặt cọc">
              <Input
                id="edit-deposit"
                type="text"
                inputMode="numeric"
                value={editFormData.deposit}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({ ...editFormData, deposit: formatted })
                }}
                className={cn(entityFormInputClass, "font-mono")}
                required
              />
            </EntityFormField>

            <EntityFormField label="Phí phát sinh">
              <Input
                id="edit-extraFees"
                type="text"
                inputMode="numeric"
                value={editFormData.extraFees}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({ ...editFormData, extraFees: formatted })
                }}
                className={cn(entityFormInputClass, "font-mono")}
                placeholder="0"
              />
            </EntityFormField>
              <EntityFormField label="Tên Home">
              <Input
                  id="edit-homeName"
                  type="text"
                  value={editFormData.homeName}
                  onChange={(e) => setEditFormData({ ...editFormData, homeName: e.target.value })}
                  placeholder="Home ABC"
                  className={entityFormInputClass}
                />
            </EntityFormField>
              <EntityFormField label="Hoa hồng / ngày">
              <Input
                  id="edit-commissionHome"
                  type="text"
                  inputMode="numeric"
                  value={editFormData.commissionHome}
                  onChange={(e) => {
                    const formatted = formatMoneyInput(e.target.value)
                    setEditFormData({ ...editFormData, commissionHome: formatted })
                  }}
                  placeholder="20.000"
                  className={cn(entityFormInputClass, "font-mono")}
                />
            </EntityFormField>
            </div>

            <EntityFormField label="Ghi chú">
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className={cn(entityFormInputClass, "min-h-16 resize-y")}
                placeholder="Ghi chú đơn thuê..."
              />
            </EntityFormField>

            <EntityFormField label="Trạng thái">
              <Select
                value={editFormData.status}
                onValueChange={(value: RentalOrder["status"]) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger className={entityFormInputClass}>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 rounded-[var(--radius-control)]">
                  <SelectItem value="pending">Chờ giao xe</SelectItem>
                  <SelectItem value="active">Đang thuê</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </EntityFormField>
            </EntityFormSection>

            </EntityFormBody>
            <EntityFormFooter
              accent="blue"
              onCancel={() => setIsEditDialogOpen(false)}
              submitLabel="Lưu thay đổi"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={!!viewingCustomer} onOpenChange={(open) => {
        if (!open && !lightboxImage) setViewingCustomer(null)
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="xl">
          {viewingCustomer && (() => {
            const cust = viewingCustomer
            const custRentals = orders
              .filter((r) => r.customerId === cust.id)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
            const docImages = [
              ...(cust.cccdfront?.[0] ? [{ label: "CCCD mặt trước", src: cust.cccdfront[0] }] : []),
              ...(cust.cccdback?.[0] ? [{ label: "CCCD mặt sau", src: cust.cccdback[0] }] : []),
              ...(cust.licensefront?.[0] ? [{ label: "GPLX mặt trước", src: cust.licensefront[0] }] : []),
              ...(cust.licenseback?.[0] ? [{ label: "GPLX mặt sau", src: cust.licenseback[0] }] : []),
            ]
            return (
              <>
                <div className="flex items-start gap-3 sm:gap-4 mb-5">
                  <button
                    type="button"
                    className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-slate-200 bg-slate-50"
                    onClick={() => cust.customerphoto?.[0] && setLightboxImage(cust.customerphoto[0])}
                  >
                    {cust.customerphoto?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cust.customerphoto[0]} alt={cust.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-7 w-7 text-slate-300" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1 pr-6">
                    <h2 className="text-title text-pretty">{cust.name}</h2>
                    <p className="text-meta mt-0.5 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {cust.phone || "Chưa có SĐT"}
                    </p>
                    {cust.address && (
                      <p className="text-meta mt-0.5 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span>{cust.address}</span>
                      </p>
                    )}
                    <div className="mt-2">
                      <span className={cn(orderStatusBadgeClass, rentalCustomerStatusBadgeClass(cust.status))}>
                        {getRentalCustomerStatusLabel(cust.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <OrderStat label="Số CCCD / CMND" value={(cust.idcard || "").replace(/^CCCD_/i, "") || "—"} />
                    <OrderStat label="Tổng lần thuê" value={`${cust.totalrentals || custRentals.length} lượt`} />
                  </div>

                  {docImages.length > 0 && (
                    <div>
                      <p className="text-label text-slate-500 mb-2">Ảnh tài liệu</p>
                      <div className="grid grid-cols-2 gap-2">
                        {docImages.map((img) => (
                          <button
                            key={img.label}
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => setLightboxImage(img.src)}
                          >
                            <p className="text-meta mb-1">{img.label}</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.src}
                              alt={img.label}
                              className="w-full rounded-[var(--radius-control)] border border-slate-200 object-cover aspect-video"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {custRentals.length > 0 && (
                    <div>
                      <p className="text-label text-slate-500 mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-2">
                        {custRentals.slice(0, 4).map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 text-left ui-transition hover:border-blue-200 hover:bg-blue-50/40"
                            onClick={() => {
                              setViewingCustomer(null)
                              setViewingOrder(r)
                            }}
                          >
                            <div className="min-w-0">
                              <p className="text-body font-semibold text-slate-800 truncate">{r.vehicleName}</p>
                              <p className="text-meta font-mono">{r.licensePlate}</p>
                            </div>
                            <p className="text-body font-semibold money tabular-nums text-slate-900 shrink-0">
                              {(r.totalPrice || 0).toLocaleString("vi-VN")} đ
                            </p>
                          </button>
                        ))}
                        {custRentals.length > 4 && (
                          <p className="text-meta text-center">+{custRentals.length - 4} đơn khác</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex justify-end border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:w-auto rounded-[var(--radius-control)] border-slate-200"
                      onClick={() => setViewingCustomer(null)}
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog — same layout as /dashboard/vehicles */}
      <Dialog open={!!viewingVehicle} onOpenChange={(open) => {
        if (!open && !lightboxImage) setViewingVehicle(null)
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="xl">
          {viewingVehicle && (() => {
            const v = viewingVehicle
            const vId = v.id
            const completedRev = orders
              .filter((o) => o.vehicleId === vId && o.status === "completed")
              .reduce((s, o) => s + (o.revenue || o.totalPrice || 0), 0)
            const totalRevenue = v.totalRevenue ?? completedRev
            const profit = v.profit ?? (totalRevenue - (v.purchasePrice || 0))
            const parseVN = (s: string): Date => {
              const parts = s?.split("/")
              if (parts?.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
              return new Date(s || 0)
            }
            const calcUtil = (days: number) => {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const from = new Date(); from.setDate(today.getDate() - days); from.setHours(0, 0, 0, 0)
              const vOrders = orders.filter((o) => o.vehicleId === vId && o.status !== "cancelled" && o.status !== "pending")
              let rented = 0
              vOrders.forEach((o) => {
                const s = parseVN(o.startDate); const e = parseVN(o.endDate)
                const os = s < from ? from : s; const oe = e > today ? today : e
                if (os <= oe) {
                  rented += Math.ceil((oe.getTime() - os.getTime()) / 86400000) + 1
                }
              })
              if (rented > days) rented = days
              return { pct: Math.round((rented / days) * 100) }
            }
            const u30 = calcUtil(30)
            const totalRentalCount = orders.filter((o) => o.vehicleId === vId).length
            const recentOrders = orders
              .filter((o) => o.vehicleId === vId)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
              .slice(0, 4)
            const loc = parseVehicleDisplayNotes(v.notes)
            const photo = (v.vehicleImages || []).find((img) => typeof img === "string") as string | undefined

            return (
              <>
                <div className="flex items-start gap-3 sm:gap-4 mb-5">
                  <button
                    type="button"
                    className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-slate-200 bg-slate-50"
                    onClick={() => photo && setLightboxImage(photo)}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={v.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Car className="h-7 w-7 text-slate-300" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1 pr-6">
                    <h2 className="text-title text-pretty">{v.name}</h2>
                    <p className="text-meta mt-0.5 font-mono tracking-wide">
                      {v.licensePlate || "Chưa biển"}
                      {v.color ? ` · ${v.color}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={cn(orderStatusBadgeClass, rentalVehicleStatusBadgeClass(v.status))}>
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
                    <OrderStat label="Giá thuê / ngày" value={formatPrice(v.pricePerDay)} />
                    <OrderStat label="Giá mua" value={formatPrice(v.purchasePrice)} tone="amber" />
                    <OrderStat label="Tổng thu" value={formatPrice(totalRevenue)} tone="emerald" />
                    <OrderStat
                      label="Lợi nhuận"
                      value={`${profit >= 0 ? "+" : ""}${formatPrice(profit)}`}
                      tone={profit >= 0 ? "emerald" : "rose"}
                    />
                    <OrderStat label="Số KM hiện tại" value={`${(v.current_km || 0).toLocaleString("vi-VN")} km`} />
                    <OrderStat label="Ngày đã cho thuê" value={`${v.totalRentalDays || 0} ngày`} />
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
                    <OrderStat label="Tổng đơn thuê" value={`${totalRentalCount} đơn`} />
                  </div>

                  {loc.location && (
                    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/80 px-3 py-3">
                      <p className="text-label text-slate-500 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        Vị trí hiện tại
                      </p>
                      <p className="text-body text-slate-800 mt-1">{loc.location}</p>
                    </div>
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
                          <button
                            key={o.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 text-left ui-transition hover:border-blue-200 hover:bg-blue-50/40"
                            onClick={() => {
                              setViewingVehicle(null)
                              setViewingOrder(o)
                            }}
                          >
                            <div className="min-w-0">
                              <p className="text-body font-semibold text-slate-800 truncate">{o.customerName}</p>
                              <p className="text-meta">{formatDisplayDate(o.startDate)} → {formatDisplayDate(o.endDate)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-body money tabular-nums text-slate-900">
                                {(o.totalPrice || 0).toLocaleString("vi-VN")} đ
                              </p>
                              <span className={cn(orderStatusBadgeClass, rentalOrderStatusBadgeClass(o.status), "mt-1")}>
                                {getRentalOrderStatusLabel(o.status)}
                              </span>
                            </div>
                          </button>
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
                                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex justify-end border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:w-auto rounded-[var(--radius-control)] border-slate-200"
                      onClick={() => setViewingVehicle(null)}
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxImage && (
        <LightboxModal
          imageSrc={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* #4 Late fee dialog */}
      <Dialog open={isLateFeeOpen} onOpenChange={setIsLateFeeOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="sm">
          <EntityFormHeader title="Phí phát sinh quá hạn" description="Đơn thuê quá hạn - nhập phí phát sinh thêm (nếu có) trước khi hoàn thành" />
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
              ⚠ Đơn thuê đã quá ngày kết thúc. Có phí phát sinh do quá hạn không?
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Phí phát sinh thêm (VND)</label>
              <Input
                type="text"
                value={lateFeeExtra}
                onChange={e => setLateFeeExtra(formatMoneyInput(e.target.value))}
                placeholder="VD: 50.000 (để trống nếu không có)"
                className="rounded-xl font-mono"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsLateFeeOpen(false)}>Hủy</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl" onClick={handleConfirmLateFee}>
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Hoàn thành đơn
              </Button>
            </div>
          </div>
        </EntityFormDialogContent>
      </Dialog>

      {/* Modal Chọn xe gán cho đơn đặt trước */}
      <Dialog open={!!assigningOrder} onOpenChange={(open) => !open && setAssigningOrder(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md p-5 rounded-[var(--radius-container)] gap-4">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bike className="w-5 h-5 text-emerald-600 shrink-0" />
              Chọn xe gán & Giao cho khách
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Khách hàng: <strong className="text-slate-800">{assigningOrder?.customerName}</strong> ({assigningOrder?.totalDays} ngày thuê: {assigningOrder?.startDate} → {assigningOrder?.endDate})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm xe rảnh theo tên hoặc biển số..."
                value={assignVehicleSearch}
                onChange={(e) => setAssignVehicleSearch(e.target.value)}
                className="pl-9 h-10 text-sm bg-white border-slate-200"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Xe đang sẵn sàng ở bãi ({availableVehiclesForAssign.length} xe):
              </p>
              {selectedVehiclesForAssignList.length > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Đã chọn {selectedVehiclesForAssignList.length} xe
                </span>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
              {availableVehiclesForAssign.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Không tìm thấy xe nào khả dụng trong khoảng thời gian này
                </div>
              ) : (
                availableVehiclesForAssign.map(({ vehicle: v, status }) => {
                  const isSelected = selectedVehiclesForAssignList.some(item => item.id === v.id)
                  const isBlocked = !status.isAvailable
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (isBlocked) return
                        setSelectedVehiclesForAssignList(prev => {
                          const exists = prev.some(item => item.id === v.id)
                          if (exists) return prev.filter(item => item.id !== v.id)
                          return [...prev, v]
                        })
                      }}
                      className={cn(
                        "p-3 text-sm flex items-center justify-between cursor-pointer ui-transition",
                        isSelected && "bg-emerald-50/80 border-l-4 border-l-emerald-600",
                        !isSelected && !isBlocked && "hover:bg-slate-50",
                        isBlocked && "bg-slate-50/80 text-slate-400 cursor-not-allowed opacity-75"
                      )}
                    >
                      <div className="min-w-0 pr-2 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{v.name}</p>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1",
                              status.badgeTone === "emerald" && "bg-emerald-100 text-emerald-800",
                              status.badgeTone === "amber" && "bg-amber-100 text-amber-900 border border-amber-300",
                              status.badgeTone === "rose" && "bg-rose-100 text-rose-800",
                              status.badgeTone === "slate" && "bg-slate-100 text-slate-600"
                            )}
                          >
                            {status.badgeLabel}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded border border-slate-200">
                            {v.licensePlate}
                          </span>
                          <span>· {v.pricePerDay.toLocaleString("vi-VN")}đ/ngày</span>
                          {status.reason && <span className="text-slate-400 truncate max-w-[160px]">· {status.reason}</span>}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setAssigningOrder(null)} className="h-10 text-xs flex-1 sm:flex-none">
              Hủy
            </Button>
            <Button
              disabled={selectedVehiclesForAssignList.length === 0 || assigningSubmitting}
              onClick={handleConfirmAssignVehicle}
              className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 gap-1.5 flex-1 sm:flex-none"
            >
              <Play className="w-4 h-4" />
              {assigningSubmitting
                ? "Đang gán xe..."
                : selectedVehiclesForAssignList.length > 1
                ? `Gán ${selectedVehiclesForAssignList.length} xe & Giao`
                : "Xác nhận Gán xe & Giao xe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DailyNotificationModal
        isOpen={isDailyNotificationOpen}
        onClose={() => setIsDailyNotificationOpen(false)}
        orders={orders}
        vehicles={vehicles}
        onDeliverOrderClick={(order) => {
          setAssigningOrder(order)
          setSelectedVehiclesForAssignList([])
        }}
      />
    </ModulePageShell>
  )
}
