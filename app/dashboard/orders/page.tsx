"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { showError, showWarning } from "@/lib/toast-utils"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { logger } from "@/lib/logger"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { formatDisplayDate, formatDisplayDateTime, toDateInputValue, toStoredDateValue } from "@/lib/format-date"
import { supabase, fetchVehicles, fetchCustomers, fetchRentals, insertCustomer } from "@/lib/supabase"
import { uploadImage } from "@/lib/storage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  EntityFormInfoBox,
  EntityFormTip,
  entityFormInputClass,
} from "@/components/dashboard/entity-form-dialog"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard, ModulePagination } from "@/components/dashboard/module-shell"
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
import { Plus, Search, Eye, ClipboardList, Calendar, User, Car, Settings, X, ImageIcon, Phone, MapPin, Trash2, Printer, FileText, Play, CheckCircle, DollarSign } from "lucide-react"
import { QUY79_BUSINESS } from "@/lib/business-info"
import { PrintBusinessHeader, PrintShopPartyBlock } from "@/components/dashboard/print-business-blocks"
import {
  type RentalTerm,
  getRentalTerm,
  getRentalTermLabel,
  stripRentalTermFromNotes,
  buildRentalTermPayload,
} from "@/lib/rental-term"

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
  status: "available" | "rented" | "maintenance"
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
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
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
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerCCCD, setNewCustomerCCCD] = useState("")
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<File | null>(null)
  const [newCustomerCCCDFront, setNewCustomerCCCDFront] = useState<File | null>(null)
  const [hasCommission, setHasCommission] = useState(false)
  const { addAccessLog, user } = useAuth()
  const { orders, setOrders, customers, setCustomers, vehicles, setVehicles, isLoading: loading } = useRentalData()
  const [printingOrder, setPrintingOrder] = useState<RentalOrder | null>(null)
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
  const [formData, setFormData] = useState({
    customerId: "",
    vehicleIds: [] as string[],
    startDate: "",
    endDate: "",
    deposit: "",
    commissionHome: "",
    homeName: "",
    rentalTerm: "short" as RentalTerm,
  })
  const [editFormData, setEditFormData] = useState({
    customerId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
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

  // #4 Late fee dialog
  const [isLateFeeOpen, setIsLateFeeOpen] = useState(false)
  const [lateFeeOrderId, setLateFeeOrderId] = useState<string>("")
  const [lateFeeExtra, setLateFeeExtra] = useState("")

  // State for searchable inputs in create new order dialog
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)

  const filteredCustomersForSelect = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.phone && c.phone.toLowerCase().includes(customerSearch.toLowerCase())) || 
    c.id.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredVehiclesForSelect = vehicles.filter(v => 
    (v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
    (v.licensePlate && v.licensePlate.toLowerCase().includes(vehicleSearch.toLowerCase()))) &&
    !formData.vehicleIds.includes(v.id)
  )

  useEffect(() => {
    if (!isDialogOpen) {
      setCustomerSearch("")
      setVehicleSearch("")
      setShowCustomerDropdown(false)
      setShowVehicleDropdown(false)
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

    // Sort: Overdue -> Active (Renting) -> Pending -> Completed -> Cancelled
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
      // If same priority, sort by creation date descending
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

    if (formData.vehicleIds.length === 0) {
      showWarning("Vui lòng chọn ít nhất một xe thuê!")
      return
    }

    const selectedVehicles = vehicles.filter((v) => formData.vehicleIds.includes(v.id))
    if (selectedVehicles.length === 0) {
      showWarning("Vui lòng chọn ít nhất một xe thuê!")
      return
    }

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
        if (!newCustomerCCCD.trim()) {
          showWarning("Vui lòng nhập số CCCD khách hàng!")
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
          address: "",
          idcard: newCustomerCCCD.trim(),
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

      // Split deposit and commission equally among all selected vehicles
      const totalDeposit = parseMoneyInput(formData.deposit) || 0
      const dividedDeposit = Math.round(totalDeposit / selectedVehicles.length)

      const totalCommission = hasCommission ? (parseMoneyInput(formData.commissionHome) || 0) : 0
      const dividedCommission = Math.round(totalCommission / selectedVehicles.length)

      const homeNameVal = hasCommission ? formData.homeName.trim() : ""
      const termPayload = buildRentalTermPayload(formData.rentalTerm, "")

      const insertPayloads = selectedVehicles.map((vehicle) => {
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
    setFormData({ customerId: "", vehicleIds: [], startDate: "", endDate: "", deposit: "", commissionHome: "", homeName: "", rentalTerm: "short" })
    setIsNewCustomer(false)
    setNewCustomerName("")
    setNewCustomerPhone("")
    setNewCustomerCCCD("")
    setNewCustomerPhoto(null)
    setNewCustomerCCCDFront(null)
    setHasCommission(false)
    setIsDialogOpen(false)
  }

  const parseVNToISODate = toDateInputValue

  const openEditDialog = (order: RentalOrder) => {
    setEditingOrder(order)
    setEditFormData({
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      startDate: parseVNToISODate(order.startDate),
      endDate: parseVNToISODate(order.endDate),
      deposit: formatMoneyInput(order.deposit.toString()),
      extraFees: formatMoneyInput(order.extraFees.toString()),
      notes: stripRentalTermFromNotes(order.notes),
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

    const customer = customers.find((c) => c.id === editFormData.customerId)
    const vehicle = vehicles.find((v) => v.id === editFormData.vehicleId)
    
    if (!customer || !vehicle) return

    // Check if vehicle is already rented during this period (excluding this rental itself)
    const startDate = new Date(editFormData.startDate)
    const endDate = new Date(editFormData.endDate)
    
    if (startDate > endDate) {
      showWarning("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
      return
    }

    // TEMP: tắt kiểm tra trùng lịch để nhập đơn cũ trong quá khứ
    // const conflictingRental = orders.find((order) => {
    //   if (order.id === editingOrder.id) return false // Ignore current order
    //   if (order.vehicleId !== vehicle.id) return false
    //   if (order.status === "cancelled") return false // Ignore cancelled rentals
    //   
    //   const orderStart = new Date(order.startDate.split('/').reverse().join('-'))
    //   const orderEnd = new Date(order.endDate.split('/').reverse().join('-'))
    //   
    //   return !(endDate < orderStart || startDate > orderEnd)
    // })
    // 
    // if (conflictingRental) {
    //   showWarning(`Xe "${vehicle.name}" (${vehicle.licensePlate}) đã được thuê trong khoảng thời gian này!`, `Khách: ${conflictingRental.customerName}\nNgày: ${formatDisplayDate(conflictingRental.startDate)} - ${formatDisplayDate(conflictingRental.endDate)}\nTrạng thái: ${conflictingRental.status}`)
    //   return
    // }

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
      
      const termPayload = buildRentalTermPayload(editFormData.rentalTerm, editFormData.notes.trim())
      const updatePayload = {
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
          status: editFormData.status,
          revenue: newRevenue,
          commissionHome: newCommissionHome,
          homeName: newHomeName,
          rentalTerm: termPayload.rentalTerm,
        }

      let { error } = await supabase
        .from('rentals')
        .update(updatePayload)
        .eq('id', editingOrder.id)

      if (error && /rentalTerm/i.test(error.message || "")) {
        const { rentalTerm: _omit, ...withoutCol } = updatePayload
        ;({ error } = await supabase.from('rentals').update(withoutCol).eq('id', editingOrder.id))
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
        status: editFormData.status,
        revenue: newRevenue,
        commissionHome: newCommissionHome,
        homeName: newHomeName,
        rentalTerm: editFormData.rentalTerm,
      }

      setOrders(orders.map((o) => (o.id === editingOrder.id ? updatedOrder : o)))
      if (user) logger.editRental(user.username, user.displayName, customer.name, vehicle.name)
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
                        ? "bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)]"
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
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition"
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
          <EntityFormDialogContent accent="blue">
            <EntityFormHeader
              title="Tạo đơn thuê mới"
              description="Nhập thông tin đơn thuê xe"
            />
            <form onSubmit={handleSubmit} className="space-y-6">
              <EntityFormBody>
                <EntityFormSection title="👤 1. Thông tin khách thuê" description="Chọn khách hàng hiện có hoặc thêm khách mới để tạo đơn thuê">
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
                      <Label htmlFor="customer" className="text-slate-600">Tìm kiếm khách hàng</Label>
                      <Input
                        placeholder="Nhập tên, số điện thoại hoặc ID khách..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value)
                          setShowCustomerDropdown(true)
                          setFormData(prev => ({ ...prev, customerId: "" }))
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="bg-white border-slate-200 rounded-xl"
                        required={!isNewCustomer}
                      />
                      {showCustomerDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)} />
                          <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1">
                            {filteredCustomersForSelect.length === 0 ? (
                              <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy khách hàng nào</div>
                            ) : (
                              filteredCustomersForSelect.map((customer) => (
                                <div
                                  key={customer.id}
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, customerId: customer.id }))
                                    setCustomerSearch(`${customer.name} (${customer.phone || 'Không có SĐT'})`)
                                    setShowCustomerDropdown(false)
                                  }}
                                  className="p-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                                >
                                  <span className="font-semibold">{customer.name}</span> {customer.phone ? `- ${customer.phone}` : ''} <span className="text-sm text-slate-400">({customer.id})</span>
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
                      <EntityFormInfoBox>
                        ℹ <strong>Khách mới:</strong> Điền đầy đủ thông tin bắt buộc (*) để tạo hồ sơ khách hàng
                      </EntityFormInfoBox>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Tên khách hàng <span className="text-blue-500">*</span></Label>
                        <p className="text-sm text-slate-400">Họ và tên đầy đủ của khách</p>
                        <Input
                          placeholder="VD: Nguyễn Văn A"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Số điện thoại</Label>
                        <p className="text-sm text-slate-400">Dùng để liên lạc với khách hàng</p>
                        <Input
                          placeholder="VD: 0912345678"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Số CCCD khách <span className="text-blue-500">*</span></Label>
                        <p className="text-sm text-slate-400">Số chứng minh thư hoặc CCCD</p>
                        <Input
                          placeholder="VD: 123456789012"
                          value={newCustomerCCCD}
                          onChange={(e) => setNewCustomerCCCD(e.target.value)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Ảnh khách (tùy chọn)</Label>
                        <p className="text-sm text-slate-400">Ảnh chân dung để xác minh danh tính</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewCustomerPhoto(e.target.files?.[0] || null)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Ảnh CCCD khách (tùy chọn)</Label>
                        <p className="text-sm text-slate-400">Ảnh mặt trước chứng minh thư</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewCustomerCCCDFront(e.target.files?.[0] || null)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm p-1"
                        />
                      </div>
                    </div>
                  )}
                </EntityFormSection>

                <EntityFormSection title="🚗 2. Thông tin xe thuê" description="Chọn xe trong danh sách xe sẵn sàng để cho thuê">
                  <div className="space-y-3 relative">
                    <Label htmlFor="vehicle" className="text-slate-600 text-sm">Chọn xe thuê <span className="text-blue-500">*</span></Label>
                    
                    {/* Selected vehicles badges */}
                    {formData.vehicleIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                        {formData.vehicleIds.map((vId) => {
                          const vObj = vehicles.find(v => v.id === vId)
                          if (!vObj) return null
                          return (
                            <span 
                              key={vId} 
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 shadow-sm"
                            >
                              <span>{vObj.name} ({vObj.licensePlate})</span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    vehicleIds: prev.vehicleIds.filter(id => id !== vId) 
                                  }))
                                }}
                                className="hover:bg-blue-100 rounded p-0.5 text-blue-500 hover:text-blue-700 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <p className="text-xs text-slate-400">Tìm theo tên xe hoặc biển số (có thể chọn nhiều xe cùng lúc)</p>
                    <Input
                      placeholder="VD: Wave Alpha hoặc 75F1-12345..."
                      value={vehicleSearch}
                      onChange={(e) => {
                        setVehicleSearch(e.target.value)
                        setShowVehicleDropdown(true)
                      }}
                      onFocus={() => setShowVehicleDropdown(true)}
                      className="bg-white border-slate-200 rounded-xl"
                    />
                    
                    {showVehicleDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowVehicleDropdown(false)} />
                        <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1">
                          {filteredVehiclesForSelect.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy xe nào khả dụng</div>
                          ) : (
                            filteredVehiclesForSelect.map((vehicle) => (
                              <div
                                key={vehicle.id}
                                onClick={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    vehicleIds: [...prev.vehicleIds, vehicle.id] 
                                  }))
                                  setVehicleSearch("")
                                  setShowVehicleDropdown(false)
                                }}
                                className="p-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                              >
                                <span className="font-semibold">{vehicle.name}</span> - <span className="text-sm bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">{vehicle.licensePlate}</span> <span className="text-sm text-slate-500">({vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày)</span>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </EntityFormSection>

                <EntityFormSection title="📋 3. Chi tiết hợp đồng thuê" description="Nhập loại thuê, ngày thuê, thời hạn và tiền đặt cọc">
                  <div className="space-y-1">
                    <Label className="text-slate-600 text-sm">Loại thuê <span className="text-blue-500">*</span></Label>
                    <EntityFormToggle
                      value={formData.rentalTerm}
                      onChange={(val) => setFormData({ ...formData, rentalTerm: val as RentalTerm })}
                      options={[
                        { value: "short", label: "Thuê ngắn hạn" },
                        { value: "long", label: "Thuê dài hạn" },
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="startDate" className="text-slate-600 text-sm">Ngày bắt đầu <span className="text-blue-500">*</span></Label>
                      <p className="text-sm text-slate-400">Ngày khách nhận xe</p>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="endDate" className="text-slate-600 text-sm">Ngày kết thúc <span className="text-blue-500">*</span></Label>
                      <p className="text-sm text-slate-400">Ngày khách trả xe</p>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="deposit" className="text-slate-600 text-sm">Tiền đặt cọc <span className="text-blue-500">*</span></Label>
                    <p className="text-sm text-slate-400">Tiền cọc để bảo vệ xe (thường 30-50% giá thuê)</p>
                    <Input
                      id="deposit"
                      type="text"
                      value={formData.deposit}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setFormData({ ...formData, deposit: formatted })
                      }}
                      placeholder="VD: 500.000"
                      className="bg-white border-slate-200 rounded-xl font-mono h-9 text-sm"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      id="hasCommission"
                      type="checkbox"
                      checked={hasCommission}
                      onChange={(e) => setHasCommission(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <Label htmlFor="hasCommission" className="text-slate-700 text-sm font-semibold cursor-pointer">Chia hoa hồng</Label>
                  </div>

                  {hasCommission && (
                    <div className="grid grid-cols-1 gap-3 pt-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <div className="space-y-1">
                        <Label htmlFor="homeName" className="text-slate-600 text-sm">Tên Home</Label>
                        <p className="text-sm text-slate-400">Tên đơn vị/người chia hoa hồng</p>
                        <Input
                          id="homeName"
                          type="text"
                          value={formData.homeName}
                          onChange={(e) => setFormData({ ...formData, homeName: e.target.value })}
                          placeholder="VD: Home ABC"
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="commissionHome" className="text-slate-600 text-sm">Chia hoa hồng cho Home (VND/ngày)</Label>
                        <p className="text-sm text-slate-400">Tiền hoa hồng/ngày cho đơn vị (VD: 20.000đ/ngày)</p>
                        <Input
                          id="commissionHome"
                          type="text"
                          value={formData.commissionHome}
                          onChange={(e) => {
                            const formatted = formatMoneyInput(e.target.value)
                            setFormData({ ...formData, commissionHome: formatted })
                          }}
                          placeholder="VD: 20.000"
                          className="bg-white border-slate-200 rounded-xl font-mono h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <EntityFormTip
                    variant="green"
                    title="💡 Hướng dẫn tính toán"
                    items={[
                      "• Số ngày: Tính từ ngày bắt đầu đến ngày kết thúc (VD: 3 ngày)",
                      "• Tiền cọc: Thường 30-50% tổng giá thuê để bảo vệ xe",
                      "• Chia hoa hồng: Nếu có đơn vị môi giới, cộng số tiền hoa hồng/ngày",
                      "• Ví dụ: Toyota Vios 300k/ngày × 3 ngày = 900k, cọc 450k",
                    ]}
                  />
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

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
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
          />
          <RentalKpiCard variant="hero" label="Đang thuê" value={orderStats.active} sublabel="Đơn hiện hành" valueClassName="text-blue-700" />
          <RentalKpiCard variant="hero" label="Quá hạn" value={orderStats.overdue} sublabel="Cần theo dõi" valueClassName="text-amber-700" />
          <RentalKpiCard variant="hero"
            label="Hoàn thành"
            value={orderStats.completed}
            sublabel={`Doanh thu: ${formatPrice(orderStats.revenue)}`}
            valueClassName="text-emerald-700"
          />
        </div>

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
              <SelectTrigger className="w-full lg:w-44 h-10 rounded-xl border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-xl">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
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
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">
                Chưa có đơn {filterTerm === "long" ? "thuê dài hạn" : "thuê ngắn hạn"} nào
              </p>
            </div>
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center text-slate-600")}>STT</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Khách hàng</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Xe thuê</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Thời gian</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Số ngày</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Giá/ngày</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Tổng tiền</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Doanh thu</th>
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
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1.5">
                                <button
                                  className="font-bold text-slate-800 text-[15px] hover:text-slate-700 hover:underline text-left block"
                                  onClick={() => openVehicleDetail(order.vehicleId)}
                                >
                                  {order.vehicleName}
                                </button>
                                <div>
                                  <span className="inline-block bg-white text-slate-800 border border-slate-350 font-mono font-bold px-2.5 py-1 rounded text-sm shadow-sm tracking-wider uppercase whitespace-nowrap">
                                    {order.licensePlate}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center text-sm font-semibold text-slate-700">
                              <div className="whitespace-nowrap">{formatDisplayDate(order.startDate)}</div>
                              <div className="whitespace-nowrap"><span className="text-slate-400 text-sm mr-1">→</span>{formatDisplayDate(order.endDate)}</div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-semibold text-slate-700 whitespace-nowrap">{order.totalDays} ngày</td>
                            <td className="py-3.5 px-4 text-right font-mono text-sm tabular-nums text-blue-600 font-bold whitespace-nowrap">{order.pricePerDay.toLocaleString("vi-VN")} đ</td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="font-bold font-mono text-sm tabular-nums text-blue-600 whitespace-nowrap">{order.totalPrice.toLocaleString("vi-VN")} đ</div>
                              <div className="flex items-center justify-end mt-0.5">
                                {order.deposit > 0 ? (
                                  <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">Đã cọc {order.deposit.toLocaleString("vi-VN")}đ</span>
                                ) : (
                                  <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 whitespace-nowrap">Chưa cọc</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-sm whitespace-nowrap">
                              {order.revenue > 0 ? (
                                <span className="font-bold tabular-nums text-blue-600">
                                  {order.revenue.toLocaleString("vi-VN")} đ
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center text-sm font-bold px-2 py-0.5 rounded-full border ${rentalOrderStatusBadgeClass(order.status, isOverdue)}`}>
                                {getRentalOrderStatusLabel(order.status, isOverdue)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-end gap-1 flex-nowrap">
                                {/* #5 Quick action */}
                                {order.status === "pending" && (
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm text-emerald-700 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 gap-1" onClick={() => updateOrderStatus(order.id, "active")} title="Giao xe">
                                    <Play className="w-3 h-3" />Giao
                                  </Button>
                                )}
                                {(order.status === "active" || isOrderOverdue(order)) && (
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm text-blue-700 hover:text-blue-800 rounded-lg hover:bg-blue-50 gap-1" onClick={() => openCompleteWithLateFee(order.id)} title="Hoàn thành">
                                    <CheckCircle className="w-3 h-3" />Xong
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" onClick={() => setViewingOrder(order)} title="Xem chi tiết">
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" onClick={() => setPrintingOrder(order)} title="In hợp đồng">
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" onClick={() => openEditDialog(order)} title="Chỉnh sửa">
                                  <Settings className="w-3.5 h-3.5" />
                                </Button>
                                {user?.permissions.canDelete && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50" onClick={() => handleDeleteClick(order)} title="Xóa">
                                    <Trash2 className="w-3.5 h-3.5" />
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
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-sm text-slate-700 font-medium">{order.vehicleName}</span>
                            <span className="inline-block bg-white text-slate-800 border border-slate-350 font-mono font-bold px-1.5 py-0.5 rounded text-sm shadow-sm tracking-wider uppercase">
                              {order.licensePlate}
                            </span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full border shrink-0 ${rentalOrderStatusBadgeClass(order.status, isOverdue)}`}>
                          {getRentalOrderStatusLabel(order.status, isOverdue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{formatDisplayDate(order.startDate)} → {formatDisplayDate(order.endDate)}</span>
                        <span className="text-slate-300">·</span>
                        <span>{order.totalDays} ngày</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          {order.deposit > 0 ? (
                            <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Đã cọc</span>
                          ) : (
                            <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">Chưa cọc</span>
                          )}
                          {(order.status === "pending") && (
                            <button className="text-sm font-semibold px-2 py-0.5 rounded bg-emerald-600 text-white" onClick={() => updateOrderStatus(order.id, "active")}>Giao xe</button>
                          )}
                          {(order.status === "active" || isOverdue) && (
                            <button className="text-sm font-semibold px-2 py-0.5 rounded bg-blue-600 text-white" onClick={() => openCompleteWithLateFee(order.id)}>Xong</button>
                          )}
                        </div>
                        <span className="font-bold text-blue-600 tabular-nums text-sm">{order.totalPrice.toLocaleString("vi-VN")} đ</span>
                      </div>
                      
                      {/* Mobile action bar */}
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/50">
                        <span className="text-[10px] text-slate-400">Đơn #{order.rentalCode || order.id.substring(0, 8)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="text-slate-500 hover:text-blue-600 p-1"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPrintingOrder(order)}
                            className="text-slate-500 hover:text-blue-600 p-1"
                            title="In hợp đồng"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditDialog(order)}
                            className="text-slate-500 hover:text-blue-600 p-1"
                            title="Chỉnh sửa"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          {user?.permissions.canDelete && (
                            <button
                              onClick={() => handleDeleteClick(order)}
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
              />
            </>
          )}
        </CardContent>
      </ModuleSectionCard>
      </div>

      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <EntityFormDialogContent accent="blue" maxWidth="lg">
          {viewingOrder && (() => {
            const o = viewingOrder
            const overdue = isOrderOverdue(o)
            const term = getRentalTerm(o)
            const notesClean = stripRentalTermFromNotes(o.notes)
            const commissionTotal = (o.commissionHome || 0) * (o.totalDays || 0)
            return (
              <>
                <EntityFormHeader
                  title={`Chi tiết đơn: ${o.rentalCode || o.id.slice(0, 8)}`}
                  description={`${formatDisplayDate(o.startDate)} → ${formatDisplayDate(o.endDate)} · ${o.totalDays} ngày`}
                />
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center text-sm font-bold px-2.5 py-1 rounded-full border",
                      rentalOrderStatusBadgeClass(o.status, overdue)
                    )}>
                      {getRentalOrderStatusLabel(o.status, overdue)}
                    </span>
                    <span className={cn(
                      "inline-flex items-center text-sm font-bold px-2.5 py-1 rounded-full border",
                      term === "long"
                        ? "bg-violet-50 text-violet-700 border-violet-100"
                        : "bg-sky-50 text-sky-700 border-sky-100"
                    )}>
                      {getRentalTermLabel(term)}
                    </span>
                    {o.deposit > 0 ? (
                      <span className="inline-flex items-center text-sm font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                        Đã cọc
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-sm font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                        Chưa cọc
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-blue-600 uppercase">Tổng tiền thuê</p>
                      <p className="text-lg font-extrabold text-blue-700 tabular-nums">{formatPrice(o.totalPrice + (o.extraFees || 0))}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-amber-600 uppercase">Tiền cọc</p>
                      <p className="text-sm font-extrabold text-amber-700 tabular-nums">{formatPrice(o.deposit)}</p>
                    </div>
                    <div className={cn(
                      "border rounded-xl p-3",
                      o.status === "completed"
                        ? "bg-emerald-50 border-emerald-100"
                        : o.status === "cancelled"
                          ? "bg-amber-50 border-amber-100"
                          : "bg-slate-50 border-slate-100"
                    )}>
                      <p className={cn(
                        "text-sm font-semibold uppercase",
                        o.status === "completed" ? "text-emerald-600"
                          : o.status === "cancelled" ? "text-amber-600"
                          : "text-slate-500"
                      )}>Doanh thu</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        o.status === "completed" ? "text-emerald-700"
                          : o.status === "cancelled" ? "text-amber-700"
                          : "text-slate-400"
                      )}>
                        {o.status === "pending" || o.status === "active"
                          ? "Chưa chốt"
                          : formatPrice(o.revenue || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      onClick={() => {
                        setViewingOrder(null)
                        openCustomerDetail(o.customerId)
                      }}
                    >
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Khách hàng</p>
                      <p className="font-bold text-slate-900">{o.customerName}</p>
                      <p className="text-sm text-blue-500 mt-0.5 underline decoration-dashed">Nhấn để xem chi tiết</p>
                    </div>
                    <div
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      onClick={() => {
                        setViewingOrder(null)
                        openVehicleDetail(o.vehicleId)
                      }}
                    >
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Xe thuê</p>
                      <p className="font-bold text-slate-900">{o.vehicleName}</p>
                      <p className="text-sm font-mono text-slate-500">{o.licensePlate || "Chưa biển"}</p>
                      <p className="text-sm text-blue-500 mt-0.5 underline decoration-dashed">Nhấn để xem chi tiết</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Nhận xe</p>
                      <p className="text-sm font-bold text-slate-800">{formatDisplayDate(o.startDate)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Trả xe</p>
                      <p className="text-sm font-bold text-slate-800">{formatDisplayDate(o.endDate)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Số ngày</p>
                      <p className="text-sm font-bold text-slate-800">{o.totalDays} ngày</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Giá/ngày</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{formatPrice(o.pricePerDay)}</p>
                    </div>
                    {o.extraFees > 0 && (
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                        <p className="text-sm font-semibold text-orange-600 uppercase mb-0.5">Phí phát sinh</p>
                        <p className="text-sm font-bold text-orange-700 tabular-nums">{formatPrice(o.extraFees)}</p>
                      </div>
                    )}
                    {commissionTotal > 0 && (
                      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                        <p className="text-sm font-semibold text-violet-600 uppercase mb-0.5">HH Home{o.homeName ? ` · ${o.homeName}` : ""}</p>
                        <p className="text-sm font-bold text-violet-700 tabular-nums">{formatPrice(commissionTotal)}</p>
                      </div>
                    )}
                  </div>

                  {notesClean && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Ghi chú</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{notesClean}</p>
                    </div>
                  )}

                  {(o.status === "completed" || o.status === "cancelled") && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2">
                        <p className="text-sm font-bold text-slate-700">Chi tiết tài chính</p>
                      </div>
                      <div className="p-3 space-y-1.5">
                        {o.status === "completed" ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Tiền thuê xe</span>
                              <span className="font-bold text-emerald-600 tabular-nums">+{formatPrice(o.totalPrice)}</span>
                            </div>
                            {o.extraFees > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Phí phát sinh</span>
                                <span className="font-bold text-emerald-600 tabular-nums">+{formatPrice(o.extraFees)}</span>
                              </div>
                            )}
                            {commissionTotal > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Hoa hồng Home</span>
                                <span className="font-bold text-rose-600 tabular-nums">-{formatPrice(commissionTotal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Trả cọc khách</span>
                              <span className="font-medium text-slate-400 tabular-nums">-{formatPrice(o.deposit)}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                              <span className="font-bold text-slate-800">Doanh thu thực nhận</span>
                              <span className="font-extrabold text-emerald-700 tabular-nums">{formatPrice(o.revenue || 0)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Khách hủy — mất cọc</span>
                              <span className="font-bold text-amber-600 tabular-nums">+{formatPrice(o.deposit)}</span>
                            </div>
                            {o.extraFees > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Phí phát sinh</span>
                                <span className="font-bold text-amber-600 tabular-nums">+{formatPrice(o.extraFees)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                              <span className="font-bold text-slate-800">Doanh thu</span>
                              <span className="font-extrabold text-amber-700 tabular-nums">{formatPrice(o.revenue || 0)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-950 text-white rounded-xl p-4 flex flex-col items-center gap-2">
                    <div className="flex items-center justify-between w-full border-b border-slate-800 pb-2">
                      <span className="text-sm bg-blue-600 text-white font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        QR SHB
                      </span>
                      <span className="text-sm text-slate-400">{QUY79_BUSINESS.hotline}</span>
                    </div>
                    <div className="w-36 h-36 bg-white p-1.5 rounded-lg overflow-hidden shadow-md">
                      <img
                        src={`https://img.vietqr.io/image/SHB-${QUY79_BUSINESS.bank.accountNumber}-qr_only.png?amount=${o.totalPrice + (o.extraFees || 0)}&addInfo=${encodeURIComponent(`TT 3L MOTO ${o.rentalCode || o.id}`)}&accountName=${encodeURIComponent(QUY79_BUSINESS.bank.accountHolderLatin)}`}
                        alt="VietQR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="font-bold text-blue-400 text-sm tabular-nums">{formatPrice(o.totalPrice + (o.extraFees || 0))}</p>
                    <p className="text-sm text-slate-400 text-center">Quét QR để thanh toán cọc / tất toán</p>
                  </div>

                  <div className="flex gap-2 pt-1 flex-wrap">
                    {o.status === "pending" && (
                      <>
                        <Button
                          className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            updateOrderStatus(o.id, "active")
                            setViewingOrder(null)
                          }}
                        >
                          Xác nhận giao xe
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 h-9 text-sm"
                          onClick={() => {
                            updateOrderStatus(o.id, "cancelled")
                            setViewingOrder(null)
                          }}
                        >
                          Hủy đơn
                        </Button>
                      </>
                    )}
                    {(o.status === "active" || overdue) && o.status !== "completed" && o.status !== "cancelled" && (
                      <Button
                        className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          setViewingOrder(null)
                          openCompleteWithLateFee(o.id)
                        }}
                      >
                        Hoàn thành đơn
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-sm"
                      onClick={() => {
                        setViewingOrder(null)
                        openEditDialog(o)
                      }}
                    >
                      <Settings className="w-3.5 h-3.5 mr-1.5" />
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 text-sm px-3"
                      onClick={() => setViewingOrder(null)}
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

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title={`Sửa đơn thuê ${editingOrder?.id ?? ""}`}
            description="Chỉnh sửa thông tin đơn thuê"
          />
          <form onSubmit={handleEditSubmit}>
            <EntityFormBody>
            <div className="space-y-2">
              <Label className="text-slate-600">Loại thuê</Label>
              <EntityFormToggle
                value={editFormData.rentalTerm}
                onChange={(val) => setEditFormData({ ...editFormData, rentalTerm: val as RentalTerm })}
                options={[
                  { value: "short", label: "Thuê ngắn hạn" },
                  { value: "long", label: "Thuê dài hạn" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600">Khách hàng</Label>
              <Input
                value={editingOrder?.customerName || ""}
                disabled
                className="bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-vehicle" className="text-slate-600">Xe thuê</Label>
              <Select
                value={editFormData.vehicleId}
                onValueChange={(value) => setEditFormData({ ...editFormData, vehicleId: value })}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200 rounded-xl">
                  <SelectValue placeholder="Chọn xe" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 rounded-xl">
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} - {vehicle.licensePlate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-startDate" className="text-slate-600">Ngày bắt đầu</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={editFormData.startDate}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  className="bg-slate-50 border-slate-200 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endDate" className="text-slate-600">Ngày kết thúc</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  value={editFormData.endDate}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  className="bg-slate-50 border-slate-200 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-deposit" className="text-slate-600">Tiền đặt cọc (VND)</Label>
              <Input
                id="edit-deposit"
                type="text"
                value={editFormData.deposit}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({ ...editFormData, deposit: formatted })
                }}
                className="bg-slate-50 border-slate-200 rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-extraFees" className="text-slate-600">Phí phát sinh (VND)</Label>
              <Input
                id="edit-extraFees"
                type="text"
                value={editFormData.extraFees}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({ ...editFormData, extraFees: formatted })
                }}
                className="bg-slate-50 border-slate-200 rounded-xl font-mono"
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-homeName" className="text-slate-600">Tên Home (Homestay giới thiệu)</Label>
                <Input
                  id="edit-homeName"
                  type="text"
                  value={editFormData.homeName}
                  onChange={(e) => setEditFormData({ ...editFormData, homeName: e.target.value })}
                  placeholder="VD: Home ABC"
                  className="bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-commissionHome" className="text-slate-600">Chia hoa hồng cho Home (VND/ngày)</Label>
                <Input
                  id="edit-commissionHome"
                  type="text"
                  value={editFormData.commissionHome}
                  onChange={(e) => {
                    const formatted = formatMoneyInput(e.target.value)
                    setEditFormData({ ...editFormData, commissionHome: formatted })
                  }}
                  placeholder="VD: 20.000"
                  className="bg-slate-50 border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-slate-600">Ghi chú</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="bg-slate-50 border-slate-200 rounded-xl min-h-20 resize-y"
                placeholder="Nhập ghi chú cho đơn thuê..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status" className="text-slate-600">Trạng thái</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value: RentalOrder["status"]) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200 rounded-xl">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 rounded-xl">
                  <SelectItem value="pending">Chờ giao xe</SelectItem>
                  <SelectItem value="active">Đang thuê</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
        <EntityFormDialogContent accent="blue" maxWidth="lg">
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
                <EntityFormHeader
                  title="Chi tiết khách hàng"
                  description={getRentalCustomerStatusLabel(cust.status)}
                />
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      {cust.customerphoto && cust.customerphoto.length > 0 ? (
                        <img
                          src={cust.customerphoto[0]}
                          alt="Ảnh khách"
                          className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm cursor-pointer"
                          onClick={() => setLightboxImage(cust.customerphoto![0])}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <User className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-lg font-extrabold text-slate-900">{cust.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{cust.phone || "Chưa có SĐT"}</span>
                      </p>
                      {cust.address && (
                        <p className="text-sm text-slate-500 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          {cust.address}
                        </p>
                      )}
                      <div className="pt-1">
                        <span className={cn(
                          "inline-flex items-center text-sm font-bold px-2 py-0.5 rounded-full border",
                          rentalCustomerStatusBadgeClass(cust.status)
                        )}>
                          {getRentalCustomerStatusLabel(cust.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Số CCCD / CMND</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">{cust.idcard || "—"}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Tổng lần thuê</p>
                      <p className="text-lg font-extrabold text-slate-800">{cust.totalrentals || custRentals.length} lượt</p>
                    </div>
                  </div>

                  {docImages.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Ảnh tài liệu</p>
                      <div className="grid grid-cols-2 gap-3">
                        {docImages.map((img) => (
                          <div key={img.label}>
                            <p className="text-sm font-medium text-slate-400 mb-1">{img.label}</p>
                            <img
                              src={img.src}
                              alt={img.label}
                              className="w-full rounded-xl border border-slate-200 shadow-sm object-cover aspect-video cursor-pointer"
                              onClick={() => setLightboxImage(img.src)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {custRentals.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-1.5">
                        {custRentals.slice(0, 4).map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 gap-2">
                            <span className="font-bold text-slate-700 truncate">{r.vehicleName}</span>
                            <span className="text-slate-400 font-mono shrink-0">{r.licensePlate}</span>
                            <span className="font-bold tabular-nums text-blue-600 shrink-0">
                              {(r.totalPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                        {custRentals.length > 4 && (
                          <p className="text-sm text-slate-400 text-center">+{custRentals.length - 4} đơn khác</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-sm"
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
        <EntityFormDialogContent accent="blue" maxWidth="lg">
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

            return (
              <>
                <EntityFormHeader
                  title={v.name}
                  description={`${v.licensePlate || "Chưa biển"}${v.color ? ` · ${v.color}` : ""}`}
                />
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "inline-flex items-center text-sm font-bold px-2 py-1 rounded-full border",
                      rentalVehicleStatusBadgeClass(v.status)
                    )}>
                      {getRentalVehicleStatusLabel(v.status)}
                    </span>
                    {v.category && (
                      <span className="text-sm text-slate-500">
                        Phân loại: <span className="font-medium text-slate-800">{v.category === "car" ? "Ô tô" : "Xe máy"}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-blue-600 uppercase">Giá thuê/ngày</p>
                      <p className="text-sm font-extrabold text-blue-700 tabular-nums">{formatPrice(v.pricePerDay)}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-amber-600 uppercase">Giá mua</p>
                      <p className="text-sm font-extrabold text-amber-700 tabular-nums">{formatPrice(v.purchasePrice)}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-emerald-600 uppercase">Tổng thu</p>
                      <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{formatPrice(totalRevenue)}</p>
                    </div>
                    <div className={cn(
                      "border rounded-xl p-3",
                      profit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"
                    )}>
                      <p className={cn(
                        "text-sm font-semibold uppercase",
                        profit >= 0 ? "text-emerald-600" : "text-blue-600"
                      )}>Lợi nhuận</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        profit >= 0 ? "text-emerald-700" : "text-blue-600"
                      )}>
                        {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Số KM hiện tại</p>
                      <p className="text-sm font-bold text-slate-800">{(v.current_km || 0).toLocaleString("vi-VN")} km</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Ngày đã cho thuê</p>
                      <p className="text-sm font-bold text-slate-800">{v.totalRentalDays || 0} ngày</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Lấp đầy 30 ngày</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        u30.pct >= 70 ? "text-emerald-600" : u30.pct >= 40 ? "text-amber-600" : "text-blue-500"
                      )}>{u30.pct}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Tổng đơn thuê</p>
                      <p className="text-sm font-bold text-slate-800">{totalRentalCount} đơn</p>
                    </div>
                  </div>

                  {v.notes && v.notes.trim() && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Ghi chú</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{v.notes}</p>
                    </div>
                  )}

                  {recentOrders.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-1.5">
                        {recentOrders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 gap-2">
                            <span className="font-bold text-slate-700 truncate">{o.customerName}</span>
                            <span className="text-slate-400 shrink-0">{formatDisplayDate(o.startDate)}</span>
                            <span className="font-bold tabular-nums text-blue-600 shrink-0">
                              {(o.totalPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(v.vehicleImages?.length > 0 || v.documentImages?.length > 0) && (
                    <div className="space-y-3">
                      {v.vehicleImages?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Ảnh xe</p>
                          <div className="grid grid-cols-3 gap-2">
                            {v.vehicleImages.map((img, index) => (
                              <div
                                key={index}
                                className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLightboxImage(img)
                                }}
                              >
                                <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {v.documentImages?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Ảnh giấy tờ</p>
                          <div className="grid grid-cols-3 gap-2">
                            {v.documentImages.map((img, index) => (
                              <div
                                key={index}
                                className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLightboxImage(img)
                                }}
                              >
                                <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-sm"
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

      {/* Print Rental Contract Modal (A4 Standard Format) */}
      <Dialog open={printingOrder !== null} onOpenChange={(open) => !open && setPrintingOrder(null)}>
        <DialogContent className="max-w-4xl bg-white rounded-2xl max-h-[90vh] overflow-y-auto p-6 print:p-0 print:max-h-full print:overflow-visible print:border-none print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex justify-between items-center pr-6">
              <span>Xem trước bản in Hợp đồng thuê xe (A4)</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm gap-2"
                >
                  <Printer className="w-4 h-4" /> In Hợp Đồng (A4)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPrintingOrder(null)}
                  className="rounded-xl"
                >
                  Đóng
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              Xem trước hợp đồng cho thuê xe máy và biên nhận giao nhận xe chuẩn A4.
            </DialogDescription>
          </DialogHeader>

          {printingOrder && (() => {
            const cust = customers.find(c => c.id === printingOrder.customerId)
            const veh = vehicles.find(v => v.id === printingOrder.vehicleId)
            
            return (
              <div id="print-area" className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm max-w-[21cm] mx-auto text-slate-900 font-sans print:border-none print:shadow-none print:p-0 print:mx-0">
                {/* Print Custom Styles */}
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #print-area, #print-area * {
                      visibility: visible;
                    }
                    #print-area {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      height: 100%;
                      padding: 0;
                      margin: 0;
                      border: none;
                      box-shadow: none;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                  }
                `}} />

                <PrintBusinessHeader
                  documentTitle="HỢP ĐỒNG CHO THUÊ XE MÁY & BIÊN NHẬN"
                  metaLine={`Số HĐ: ${printingOrder.rentalCode || printingOrder.id} | Ngày lập: ${formatDisplayDate(printingOrder.createdAt || printingOrder.created_at || new Date())}`}
                />

                {/* Main Content Info */}
                <div className="grid grid-cols-2 gap-6 text-sm mb-6">
                  {/* Customer Info */}
                  <div className="border border-slate-200 rounded-xl p-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-sm">
                      BÊN A: BÊN THUÊ XE (KHÁCH HÀNG)
                    </h3>
                    <div className="space-y-1.5">
                      <p><span className="text-slate-500">Họ và tên:</span> <span className="font-bold">{printingOrder.customerName}</span></p>
                      <p><span className="text-slate-500">Số điện thoại:</span> <span className="font-semibold">{(cust as any)?.phone || 'N/A'}</span></p>
                      <p><span className="text-slate-500">CCCD/CMND:</span> {(cust as any)?.idcard || 'N/A'}</p>
                      <p><span className="text-slate-500">Địa chỉ:</span> {(cust as any)?.address || 'N/A'}</p>
                    </div>
                  </div>

                  <PrintShopPartyBlock title="BÊN B: BÊN CHO THUÊ (CỬA HÀNG)" variant="rental" />
                </div>

                {/* Vehicle Specifications */}
                <div className="border border-slate-200 rounded-xl p-4 mb-6">
                  <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-3 uppercase text-sm">CHI TIẾT PHƯƠNG TIỆN CHO THUÊ</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <p><span className="text-slate-500">Tên xe máy:</span> <span className="font-bold">{printingOrder.vehicleName}</span></p>
                    <p><span className="text-slate-500">Biển kiểm soát:</span> <span className="font-bold">{printingOrder.licensePlate}</span></p>
                    <p><span className="text-slate-500">Màu sơn:</span> {(veh as any)?.color || 'N/A'}</p>
                    <p><span className="text-slate-500">Số ODO lúc bàn giao:</span> {(veh as any)?.current_km?.toLocaleString('vi-VN') || 0} km</p>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="border-2 border-slate-200 rounded-[var(--radius-container)] p-5 bg-slate-50/50 mb-6">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 mb-3 uppercase text-sm">THỜI GIAN & CHI TIẾT THANH TOÁN</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-700">
                      <span>Thời gian thuê xe:</span>
                      <span className="font-semibold text-slate-900">{formatDisplayDate(printingOrder.startDate)} đến {formatDisplayDate(printingOrder.endDate)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Tổng số ngày thuê:</span>
                      <span className="font-semibold text-slate-900">{printingOrder.totalDays} ngày</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Đơn giá thuê / ngày:</span>
                      <span className="font-semibold text-slate-900">{printingOrder.pricePerDay.toLocaleString('vi-VN')} đ / ngày</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Tiền đặt cọc thế chấp:</span>
                      <span className="font-semibold text-amber-600">{printingOrder.deposit.toLocaleString('vi-VN')} đ</span>
                    </div>
                    {printingOrder.extraFees > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>Phí phát sinh (nếu có):</span>
                        <span className="font-semibold text-rose-600">{printingOrder.extraFees.toLocaleString('vi-VN')} đ</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base text-slate-900">
                      <span>{printingOrder.extraFees > 0 ? "Tổng chi phí thanh toán:" : "Tổng chi phí dự kiến:"}</span>
                      <span className="text-lg text-blue-600">{(printingOrder.totalPrice + (printingOrder.extraFees || 0)).toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="border border-slate-200 rounded-xl p-4 mb-6 text-sm text-slate-600 leading-relaxed">
                  <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-sm">ĐIỀU KHOẢN THỎA THUẬN</h3>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>Bên thuê xe (Bên A) cam kết tự bảo quản xe máy thuê, không sử dụng xe vào mục đích vi phạm pháp luật Việt Nam.</li>
                    <li>Bên A phải tự chịu chi phí xăng dầu, vá lốp xe trong quá trình di chuyển thuê xe.</li>
                    <li>Khi xảy ra sự cố hư hỏng nhẹ, Bên A vui lòng liên hệ ngay hotline Bên B để được hướng dẫn xử lý hoặc tìm tiệm sửa chữa uy tín. Trong trường hợp tai nạn hư hỏng nặng do lỗi của khách hàng, khách hàng phải đền bù chi phí sửa chữa xe theo bảng giá chính hãng.</li>
                    <li>Thời gian bàn giao trả xe đúng hẹn ghi trong hợp đồng. Trả xe muộn sau giờ quy định sẽ tính phí phụ thu phát sinh theo chính sách của cửa hàng.</li>
                  </ol>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 text-center text-sm mt-8 mb-16">
                  <div>
                    <p className="font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN A (KHÁCH THUÊ)</p>
                    <p className="text-sm text-slate-400 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                    <div className="h-16" />
                    <p className="font-bold text-slate-900">{printingOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN B (CỬA HÀNG)</p>
                    <p className="text-sm text-slate-400 italic mt-0.5">(Ký và đóng dấu)</p>
                    <div className="h-16" />
                    <p className="font-bold text-slate-900">Trần Đức Quý</p>
                  </div>
                </div>

                {/* Footer Notes */}
                <div className="text-center text-sm text-slate-400 border-t border-slate-100 pt-4 leading-relaxed">
                  Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ cho thuê xe máy tại Hệ thống Xe máy Quy79.<br />
                  Biên nhận này làm căn cứ bàn giao tài sản và hoàn trả tiền đặt cọc cựu sau khi kiểm tra trả xe.
                </div>
              </div>
            )
          })()}
        </DialogContent>
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
    </ModulePageShell>
  )
}
