"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye, ClipboardList, Calendar, User, Car, Pencil, X, ImageIcon, Phone, MapPin, Facebook, Trash2 } from "lucide-react"

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
}

interface Customer {
  id: string
  name: string
  phone: string
  facebook?: string
  address?: string
  idcard: string
  totalrentals: number
  status: "active" | "inactive"
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

const statusMap = {
  pending: { label: "Chờ giao xe", className: "bg-amber-50 text-amber-600" },
  active: { label: "Đang thuê", className: "bg-blue-50 text-blue-600" },
  completed: { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-600" },
  cancelled: { label: "Đã hủy", className: "bg-gray-100 text-gray-500" },
}

const vehicleStatusConfig = {
  available: { label: "Sẵn sàng", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  rented: { label: "Đang thuê", className: "bg-blue-50 text-blue-700 border-blue-100" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-700 border-amber-100" },
}

export default function OrdersPage() {
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerCCCD, setNewCustomerCCCD] = useState("")
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<File | null>(null)
  const [newCustomerCCCDFront, setNewCustomerCCCDFront] = useState<File | null>(null)
  const [hasCommission, setHasCommission] = useState(false)
  const { addAccessLog, user } = useAuth()
  const [orders, setOrders] = useState<RentalOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
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
        const end = new Date(parts[2], parts[1] - 1, parts[0])
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
    vehicleId: "",
    startDate: "",
    endDate: "",
    deposit: "",
    commissionHome: "",
    homeName: "",
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
  })

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
    v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
    (v.licensePlate && v.licensePlate.toLowerCase().includes(vehicleSearch.toLowerCase()))
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
  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)

      // Check if user is demo account (demo)
      const isDemoAccount = user?.username === "demo"

      if (isDemoAccount) {
        setVehicles([])
        setCustomers([])
        setOrders([])
        setLoading(false)
        return
      }

      const [vehiclesData, customersData, rentalsData] = await Promise.all([
        fetchVehicles(),
        fetchCustomers(),
        fetchRentals(),
      ])
      setVehicles(vehiclesData || [])
      setCustomers(customersData || [])

      // Sort rentals by created_at descending (newest first) - client-side backup
      const sortedRentals = (rentalsData || []).sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA // DESC (newest first)
      })
      
      // Generate rentalCode for each rental if not already present
      const rentalsWithCodes = sortedRentals.map((rental) => {
        if (!rental.rentalCode) {
          const code = generateRentalCodeFromUUID(
            rental.customerName,
            rental.licensePlate,
            rental.startDate,
            rental.id
          )
          return { ...rental, rentalCode: code }
        }
        return rental
      })
      
      setOrders(rentalsWithCodes)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(true)

    // Subscribe to real-time changes
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, () => {
        loadData(false)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => {
        loadData(false)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        loadData(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      (order.rentalCode || order.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.vehicleName.toLowerCase().includes(searchQuery.toLowerCase())
    
    let matchesStatus = false
    if (filterStatus === "all") {
      matchesStatus = true
    } else if (filterStatus === "overdue") {
      matchesStatus = isOrderOverdue(order)
    } else {
      matchesStatus = order.status === filterStatus
    }
    return matchesSearch && matchesStatus
  })

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus])

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const vehicle = vehicles.find((v) => v.id === formData.vehicleId)
    if (!vehicle) {
      alert("⚠️ Vui lòng chọn xe thuê!")
      return
    }

    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)
    
    if (startDate > endDate) {
      alert("⚠️ Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
      return
    }

    const conflictingRental = orders.find((order) => {
      if (order.vehicleId !== vehicle.id) return false
      if (order.status === "cancelled") return false
      
      const orderStart = new Date(order.startDate.split('/').reverse().join('-'))
      const orderEnd = new Date(order.endDate.split('/').reverse().join('-'))
      
      return !(endDate < orderStart || startDate > orderEnd)
    })
    
    if (conflictingRental) {
      alert(`⚠️ Xe "${vehicle.name}" (${vehicle.licensePlate}) đã được thuê trong khoảng thời gian này!\n\nKhách: ${conflictingRental.customerName}\nNgày: ${conflictingRental.startDate} - ${conflictingRental.endDate}\nTrạng thái: ${conflictingRental.status}`)
      return
    }

    let customerId = formData.customerId
    let customerName = ""

    try {
      if (isNewCustomer) {
        if (!newCustomerName.trim()) {
          alert("⚠️ Vui lòng nhập tên khách hàng!")
          return
        }
        if (!newCustomerCCCD.trim()) {
          alert("⚠️ Vui lòng nhập số CCCD khách hàng!")
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
          alert("❌ Không thể tạo khách hàng mới")
          return
        }

        customerId = newCust.id
        customerName = newCust.name
      } else {
        const customer = customers.find((c) => c.id === formData.customerId)
        if (!customer) {
          alert("⚠️ Vui lòng chọn khách hàng!")
          return
        }
        customerId = customer.id
        customerName = customer.name
      }

      const totalDays = calculateTotalDays(formData.startDate, formData.endDate)
      const totalPrice = totalDays * vehicle.pricePerDay
      const startDateVN = new Date(formData.startDate).toLocaleDateString("vi-VN")
      const now = new Date().toISOString()

      const commissionHomeVal = hasCommission ? (parseMoneyInput(formData.commissionHome) || 0) : 0
      const homeNameVal = hasCommission ? formData.homeName.trim() : ""

      const { data, error } = await supabase
        .from('rentals')
        .insert([{
          customerId,
          customerName,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          licensePlate: vehicle.licensePlate,
          startDate: startDateVN,
          endDate: new Date(formData.endDate).toLocaleDateString("vi-VN"),
          totalDays,
          pricePerDay: vehicle.pricePerDay,
          totalPrice,
          deposit: parseMoneyInput(formData.deposit),
          extraFees: 0,
          notes: "",
          revenue: 0,
          status: "pending",
          created_at: now,
          commissionHome: commissionHomeVal,
          homeName: homeNameVal,
        }])
        .select()

      if (error) {
        console.error("Error creating rental:", error)
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        const newRental = data[0]
        const rentalCode = generateRentalCodeFromUUID(customerName, vehicle.licensePlate, startDateVN, newRental.id)
        const orderWithCode = { ...newRental, rentalCode }
        setOrders([orderWithCode, ...orders])
        if (user) logger.addRental(user.username, user.displayName, customerName, vehicle.name)
        resetForm()
      }
    } catch (error) {
      console.error("Exception creating rental:", error)
      alert(`❌ Lỗi tạo đơn thuê`)
    }
  }

  const resetForm = () => {
    setFormData({ customerId: "", vehicleId: "", startDate: "", endDate: "", deposit: "", commissionHome: "", homeName: "" })
    setIsNewCustomer(false)
    setNewCustomerName("")
    setNewCustomerPhone("")
    setNewCustomerCCCD("")
    setNewCustomerPhoto(null)
    setNewCustomerCCCDFront(null)
    setHasCommission(false)
    setIsDialogOpen(false)
  }

  // Helper to convert DD/MM/YYYY to YYYY-MM-DD for HTML5 date input
  const parseVNToISODate = (vnDate: string): string => {
    if (!vnDate) return ""
    const parts = vnDate.split("/")
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0')
      const month = parts[1].padStart(2, '0')
      const year = parts[2]
      return `${year}-${month}-${day}`
    }
    return ""
  }

  const openEditDialog = (order: RentalOrder) => {
    setEditingOrder(order)
    setEditFormData({
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      startDate: parseVNToISODate(order.startDate),
      endDate: parseVNToISODate(order.endDate),
      deposit: formatMoneyInput(order.deposit.toString()),
      extraFees: formatMoneyInput(order.extraFees.toString()),
      notes: order.notes,
      status: order.status,
      commissionHome: formatMoneyInput((order.commissionHome || 0).toString()),
      homeName: order.homeName || "",
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
      alert("⚠️ Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
      return
    }

    const conflictingRental = orders.find((order) => {
      if (order.id === editingOrder.id) return false // Ignore current order
      if (order.vehicleId !== vehicle.id) return false
      if (order.status === "cancelled") return false // Ignore cancelled rentals
      
      const orderStart = new Date(order.startDate.split('/').reverse().join('-'))
      const orderEnd = new Date(order.endDate.split('/').reverse().join('-'))
      
      return !(endDate < orderStart || startDate > orderEnd)
    })
    
    if (conflictingRental) {
      alert(`⚠️ Xe "${vehicle.name}" (${vehicle.licensePlate}) đã được thuê trong khoảng thời gian này!\n\nKhách: ${conflictingRental.customerName}\nNgày: ${conflictingRental.startDate} - ${conflictingRental.endDate}\nTrạng thái: ${conflictingRental.status}`)
      return
    }

    try {
      const newExtraFees = parseMoneyInput(editFormData.extraFees)
      const newDeposit = parseMoneyInput(editFormData.deposit)
      const newCommissionHome = parseMoneyInput(editFormData.commissionHome) || 0
      const newHomeName = editFormData.homeName.trim()
      
      // Convert inputs back to vi-VN locale dates
      const newStartDate = new Date(editFormData.startDate).toLocaleDateString("vi-VN")
      const newEndDate = new Date(editFormData.endDate).toLocaleDateString("vi-VN")
      
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
      
      // Update to Supabase
      const { error } = await supabase
        .from('rentals')
        .update({
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
          notes: editFormData.notes.trim(),
          status: editFormData.status,
          revenue: newRevenue,
          commissionHome: newCommissionHome,
          homeName: newHomeName,
        })
        .eq('id', editingOrder.id)

      if (error) {
        console.error("Error updating rental:", error)
        alert(`❌ Lỗi: ${error.message}`)
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
        notes: editFormData.notes.trim(),
        status: editFormData.status,
        revenue: newRevenue,
        commissionHome: newCommissionHome,
        homeName: newHomeName,
      }

      setOrders(orders.map((o) => (o.id === editingOrder.id ? updatedOrder : o)))
      if (user) logger.editRental(user.username, user.displayName, customer.name, vehicle.name)
      setIsEditDialogOpen(false)
      setEditingOrder(null)
    } catch (error) {
      console.error("Exception updating rental:", error)
      alert(`❌ Lỗi cập nhật đơn thuê`)
    }
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
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      setOrders(orders.map((o) => (o.id === orderId ? { ...o, ...updateData, status: newStatus, revenue } : o)))
      const statusLabels: Record<string, string> = { pending: "Chờ giao xe", active: "Đang thuê", completed: "Hoàn thành", cancelled: "Đã hủy" }
      if (user) logger.log(user.username, user.displayName, 'Chỉnh sửa', 'Đơn thuê', `Cập nhật đơn ${orderId}: ${statusLabels[newStatus]}`)
    } catch (error) {
      console.error("Exception updating rental status:", error)
      alert(`❌ Lỗi cập nhật trạng thái đơn thuê`)
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
      alert("Lỗi khi xóa đơn thuê: " + (error as any).message)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 w-full">
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-blue-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá đơn thuê
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base mt-2">
              Bạn có chắc chắn muốn xoá đơn thuê mã <span className="font-semibold text-gray-800">"{orderToDelete?.rentalCode || orderToDelete?.id}"</span> của khách hàng <span className="font-semibold text-gray-800">"{orderToDelete?.customerName}"</span> không?
              <p className="text-sm text-blue-600 mt-2">⚠️ Hành động này không thể hoàn tác!</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setOrderToDelete(null)
              }}
              className="border-gray-300"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-gray-800">Đơn thuê</h1>
          <p className="text-gray-500 text-xs md:text-sm">Quản lý các đơn thuê xe</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm">
              <Plus className="w-4 h-4 mr-2" />
              Tạo đơn thuê mới
            </Button>
          </DialogTrigger>
                    <DialogContent className="bg-white border-gray-200 rounded-2xl max-h-[90vh] overflow-y-auto max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800">Tạo đơn thuê mới</DialogTitle>
              <DialogDescription className="text-gray-500">Nhập thông tin đơn thuê xe</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                
                {/* CỘT 1: KHÁCH THUÊ */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">👤 1. Thông Tin Khách Thuê</h3>
                  <p className="text-xs text-slate-500">Chọn khách hàng hiện có hoặc thêm khách mới để tạo đơn thuê</p>
                  
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(false)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${!isNewCustomer ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Khách cũ
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(true)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${isNewCustomer ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Khách mới
                    </button>
                  </div>

                  {!isNewCustomer ? (
                    <div className="space-y-2 relative">
                      <Label htmlFor="customer" className="text-gray-600">Tìm kiếm khách hàng</Label>
                      <Input
                        placeholder="Nhập tên, số điện thoại hoặc ID khách..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value)
                          setShowCustomerDropdown(true)
                          setFormData(prev => ({ ...prev, customerId: "" }))
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="bg-white border-gray-200 rounded-xl"
                        required={!isNewCustomer}
                      />
                      {showCustomerDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)} />
                          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1">
                            {filteredCustomersForSelect.length === 0 ? (
                              <div className="p-3 text-sm text-gray-500 text-center">Không tìm thấy khách hàng nào</div>
                            ) : (
                              filteredCustomersForSelect.map((customer) => (
                                <div
                                  key={customer.id}
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, customerId: customer.id }))
                                    setCustomerSearch(`${customer.name} (${customer.phone || 'Không có SĐT'})`)
                                    setShowCustomerDropdown(false)
                                  }}
                                  className="p-3 text-sm text-gray-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                >
                                  <span className="font-semibold">{customer.name}</span> {customer.phone ? `- ${customer.phone}` : ''} <span className="text-xs text-gray-400">({customer.id})</span>
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
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs text-blue-800">
                        ℹ️ <strong>Khách mới:</strong> Điền đầy đủ thông tin bắt buộc (*) để tạo hồ sơ khách hàng
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Tên khách hàng <span className="text-blue-500">*</span></Label>
                        <p className="text-[11px] text-slate-400">Họ và tên đầy đủ của khách</p>
                        <Input
                          placeholder="VD: Nguyễn Văn A"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Số điện thoại</Label>
                        <p className="text-[11px] text-slate-400">Dùng để liên lạc với khách hàng</p>
                        <Input
                          placeholder="VD: 0912345678"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Số CCCD khách <span className="text-blue-500">*</span></Label>
                        <p className="text-[11px] text-slate-400">Số chứng minh thư hoặc CCCD</p>
                        <Input
                          placeholder="VD: 123456789012"
                          value={newCustomerCCCD}
                          onChange={(e) => setNewCustomerCCCD(e.target.value)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">📸 Ảnh khách (tùy chọn)</Label>
                        <p className="text-[11px] text-slate-400">Ảnh chân dung để xác minh danh tính</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewCustomerPhoto(e.target.files?.[0] || null)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">📸 Ảnh CCCD khách (tùy chọn)</Label>
                        <p className="text-[11px] text-slate-400">Ảnh mặt trước chứng minh thư</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewCustomerCCCDFront(e.target.files?.[0] || null)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm p-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* CỘT 2: XE THUÊ */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">🚗 2. Thông Tin Xe Thuê</h3>
                  <p className="text-xs text-slate-500">Chọn xe trong danh sách xe sẵn sàng để cho thuê</p>
                  <div className="space-y-2 relative">
                    <Label htmlFor="vehicle" className="text-gray-600 text-xs">Chọn xe thuê <span className="text-blue-500">*</span></Label>
                    <p className="text-[11px] text-slate-400">Tìm theo tên xe hoặc biển số</p>
                    <Input
                      placeholder="VD: Toyota Vios hoặc 75AA-12345..."
                      value={vehicleSearch}
                      onChange={(e) => {
                        setVehicleSearch(e.target.value)
                        setShowVehicleDropdown(true)
                        setFormData(prev => ({ ...prev, vehicleId: "" }))
                      }}
                      onFocus={() => setShowVehicleDropdown(true)}
                      className="bg-white border-gray-200 rounded-xl"
                      required
                    />
                    {showVehicleDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowVehicleDropdown(false)} />
                        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1">
                          {filteredVehiclesForSelect.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 text-center">Không tìm thấy xe nào</div>
                          ) : (
                            filteredVehiclesForSelect.map((vehicle) => (
                              <div
                                key={vehicle.id}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, vehicleId: vehicle.id }))
                                  setVehicleSearch(`${vehicle.name} - ${vehicle.licensePlate}`)
                                  setShowVehicleDropdown(false)
                                }}
                                className="p-3 text-sm text-gray-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                              >
                                <span className="font-semibold">{vehicle.name}</span> - <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">{vehicle.licensePlate}</span> <span className="text-xs text-gray-500">({vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày)</span>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                    <input type="hidden" name="vehicleId" value={formData.vehicleId} required />
                  </div>
                </div>

                {/* CỘT 3: LÊN ĐƠN */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">📋 3. Chi Tiết Hợp Đồng Thuê</h3>
                  <p className="text-xs text-slate-500">Nhập ngày thuê, thời hạn và tiền đặt cọc</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="startDate" className="text-gray-600 text-xs">Ngày bắt đầu <span className="text-blue-500">*</span></Label>
                      <p className="text-[11px] text-slate-400">Ngày khách nhận xe</p>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="endDate" className="text-gray-600 text-xs">Ngày kết thúc <span className="text-blue-500">*</span></Label>
                      <p className="text-[11px] text-slate-400">Ngày khách trả xe</p>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="deposit" className="text-gray-600 text-xs">Tiền đặt cọc <span className="text-blue-500">*</span></Label>
                    <p className="text-[11px] text-slate-400">Tiền cọc để bảo vệ xe (thường 30-50% giá thuê)</p>
                    <Input
                      id="deposit"
                      type="text"
                      value={formData.deposit}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setFormData({ ...formData, deposit: formatted })
                      }}
                      placeholder="VD: 500.000"
                      className="bg-white border-gray-200 rounded-xl font-mono h-9 text-sm"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      id="hasCommission"
                      type="checkbox"
                      checked={hasCommission}
                      onChange={(e) => setHasCommission(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <Label htmlFor="hasCommission" className="text-gray-700 text-sm font-semibold cursor-pointer">Chia hoa hồng</Label>
                  </div>

                  {hasCommission && (
                    <div className="grid grid-cols-1 gap-3 pt-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <div className="space-y-1">
                        <Label htmlFor="homeName" className="text-gray-600 text-xs">Tên Home</Label>
                        <p className="text-[11px] text-slate-400">Tên đơn vị/người chia hoa hồng</p>
                        <Input
                          id="homeName"
                          type="text"
                          value={formData.homeName}
                          onChange={(e) => setFormData({ ...formData, homeName: e.target.value })}
                          placeholder="VD: Home ABC"
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="commissionHome" className="text-gray-600 text-xs">Chia hoa hồng cho Home (VND/ngày)</Label>
                        <p className="text-[11px] text-slate-400">Tiền hoa hồng/ngày cho đơn vị (VD: 20.000đ/ngày)</p>
                        <Input
                          id="commissionHome"
                          type="text"
                          value={formData.commissionHome}
                          onChange={(e) => {
                            const formatted = formatMoneyInput(e.target.value)
                            setFormData({ ...formData, commissionHome: formatted })
                          }}
                          placeholder="VD: 20.000"
                          className="bg-white border-gray-200 rounded-xl font-mono h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tip Box */}
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 mt-4 text-xs text-green-800">
                    <p className="font-semibold mb-1">💡 Hướng dẫn tính toán:</p>
                    <ul className="space-y-1 text-[11px]">
                      <li>• <strong>Số ngày:</strong> Tính từ ngày bắt đầu đến ngày kết thúc (VD: 3 ngày)</li>
                      <li>• <strong>Tiền cọc:</strong> Thường 30-50% tổng giá thuê để bảo vệ xe</li>
                      <li>• <strong>Chia hoa hồng:</strong> Nếu có đơn vị môi giới, cộng số tiền hoa hồng/ngày</li>
                      <li>• <strong>Ví dụ:</strong> Toyota Vios 300k/ngày × 3 ngày = 900k, cọc 450k</li>
                    </ul>
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-gray-200">
                  Hủy
                </Button>
                <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl">
                  Tạo đơn
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo mã đơn, khách hàng hoặc xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 rounded-xl"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Lọc theo trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 rounded-xl">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="pending">Chờ giao xe</SelectItem>
                <SelectItem value="active">Đang thuê</SelectItem>
                <SelectItem value="overdue">Quá hạn</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardHeader className="pb-3 md:pb-4 p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-semibold text-gray-800">Danh sách đơn thuê</CardTitle>
          <CardDescription className="text-xs md:text-sm text-gray-500">Tổng cộng {filteredOrders.length} đơn thuê</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          {filteredOrders.length > 0 ? (
            <div className="max-h-[75vh] overflow-y-auto">
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center w-12">STT</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-left">Khách hàng</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-left">Xe thuê</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center">Thời gian</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center">Số ngày</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-right">Giá/ngày</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-right">Tổng tiền</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-right">Doanh thu</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center">Trạng thái</th>
                      <th className="py-3.5 px-4 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedOrders.map((order, index) => {
                      const isOverdue = isOrderOverdue(order)
                      const sc = isOverdue 
                        ? { label: "Quá hạn", className: "bg-orange-50 text-orange-600 border border-orange-200 font-bold" }
                        : (statusMap[order.status] || statusMap.pending)
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center text-slate-500 font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                          <td className="py-3 px-4 text-left">
                            <button
                              className="font-semibold text-slate-900 hover:text-slate-700 hover:underline text-left capitalize"
                              onClick={() => openCustomerDetail(order.customerId)}
                            >
                              {order.customerName}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-left">
                            <div>
                              <button
                                className="font-semibold text-slate-900 hover:text-slate-700 hover:underline text-left block"
                                onClick={() => openVehicleDetail(order.vehicleId)}
                              >
                                {order.vehicleName}
                              </button>
                              <span className="text-[10px] text-slate-400 font-mono">{order.licensePlate}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-[11px] text-slate-700 whitespace-nowrap">
                            <span>{order.startDate}</span>
                            <span className="text-slate-400 mx-1.5">→</span>
                            <span>{order.endDate}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700">{order.totalDays} ngày</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">{order.pricePerDay.toLocaleString("vi-VN")} đ</td>
                          <td className="py-3 px-4 text-right">
                            <div className={`font-bold font-mono ${isOverdue ? 'text-blue-600' : 'text-slate-900'}`}>{order.totalPrice.toLocaleString("vi-VN")} đ</div>
                            <div className="text-[10px] text-slate-400 font-mono">Cọc: {order.deposit.toLocaleString("vi-VN")} đ</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {order.revenue > 0 ? (
                              <span className={`font-semibold ${order.status === "cancelled" ? "text-amber-600" : "text-emerald-600"}`}>
                                {order.revenue.toLocaleString("vi-VN")} đ
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={sc.className}>
                              {sc.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => setViewingOrder(order)}
                                title="Xem chi tiết"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => openEditDialog(order)}
                                title="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {user?.permissions.canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => handleDeleteClick(order)}
                                  title="Xóa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {paginatedOrders.map((order) => (
                  <div key={order.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:shadow transition-all">
                    {/* Top row: Code + Status */}
                    <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Mã đơn</p>
                        <p className="font-semibold text-sm text-gray-800">{order.rentalCode || order.id}</p>
                      </div>
                      <Badge className={
                        isOrderOverdue(order)
                          ? "bg-orange-50 text-orange-600 border border-orange-200 font-bold"
                          : statusMap[order.status].className
                      }>
                        {isOrderOverdue(order) ? "Quá hạn" : statusMap[order.status].label}
                      </Badge>
                    </div>
                    
                    {/* 2 cols: Customer + Vehicle */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Khách hàng</p>
                        <button
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left break-words"
                          onClick={() => openCustomerDetail(order.customerId)}
                        >
                          {order.customerName}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Xe thuê</p>
                        <button
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left break-words"
                          onClick={() => openVehicleDetail(order.vehicleId)}
                        >
                          {order.vehicleName}
                        </button>
                        <p className="text-xs text-gray-400">{order.licensePlate}</p>
                      </div>
                    </div>

                    {/* 2 cols: Dates + Days */}
                    <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Thời gian</p>
                        <p className="text-sm text-gray-700">{order.startDate}</p>
                        <p className="text-xs text-gray-500">→ {order.endDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Số ngày</p>
                        <p className="text-sm font-semibold text-gray-800">{order.totalDays} ngày</p>
                        <p className="text-xs text-gray-500">{order.pricePerDay.toLocaleString("vi-VN")}/ngày</p>
                      </div>
                    </div>

                    {/* 2 cols: Total Price + Revenue */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Tổng tiền</p>
                        <p className="text-sm font-semibold text-blue-600">{order.totalPrice.toLocaleString("vi-VN")} VND</p>
                        <p className="text-xs text-gray-500">Cọc: {order.deposit.toLocaleString("vi-VN")}</p>
                        {order.homeName && (
                          <p className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-1 border border-amber-200">
                            {order.homeName} (-{(order.commissionHome || 0).toLocaleString("vi-VN")}đ/n)
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Doanh thu</p>
                        {order.revenue > 0 ? (
                          <>
                            <p className={`text-sm font-semibold ${order.status === "cancelled" ? "text-amber-600" : "text-emerald-600"}`}>
                              {order.revenue.toLocaleString("vi-VN")} VND
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400">-</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 text-xs md:text-sm"
                        onClick={() => setViewingOrder(order)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Xem
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 text-xs md:text-sm"
                        onClick={() => openEditDialog(order)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Sửa
                      </Button>
                      {user?.permissions.canDelete && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 text-xs md:text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                          onClick={() => handleDeleteClick(order)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Xóa
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Phân trang */}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                  <span className="text-xs text-gray-500 mr-2">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-gray-200 rounded-xl"
                  >
                    Trước
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-gray-200 rounded-xl"
                  >
                    Tiếp
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Chưa có đơn thuê nào</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              Chi tiết đơn thuê {viewingOrder?.id}
            </DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Khách hàng</p>
                  <button 
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      openCustomerDetail(viewingOrder.customerId)
                    }}
                  >
                    {viewingOrder.customerName}
                  </button>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Xe thuê</p>
                  <button 
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      openVehicleDetail(viewingOrder.vehicleId)
                    }}
                  >
                    {viewingOrder.vehicleName}
                  </button>
                  <p className="text-xs text-gray-400">{viewingOrder.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày bắt đầu</p>
                  <p className="font-medium text-gray-800">{viewingOrder.startDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày kết thúc</p>
                  <p className="font-medium text-gray-800">{viewingOrder.endDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số ngày thuê</p>
                  <p className="font-medium text-gray-800">{viewingOrder.totalDays} ngày</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá thuê/ngày</p>
                  <p className="font-medium text-gray-800">{viewingOrder.pricePerDay.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tiền cọc</p>
                  <p className="font-medium text-gray-800">{viewingOrder.deposit.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tổng tiền thuê</p>
                  <p className="font-medium text-blue-600 text-lg">{viewingOrder.totalPrice.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phí phát sinh</p>
                  <p className="font-medium text-gray-800">
                    {viewingOrder.extraFees > 0
                      ? `${viewingOrder.extraFees.toLocaleString("vi-VN")} VND`
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ghi chú</p>
                <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">
                  {viewingOrder.notes || "—"}
                </p>
              </div>
              
              {/* Thông tin doanh thu */}
              <div className="pt-4 border-t border-gray-100">
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <h4 className="font-medium text-gray-800 text-sm">Thông tin tài chính</h4>
                  {viewingOrder.status === "pending" && (
                    <p className="text-sm text-gray-500">Chưa có doanh thu (đang chờ nhận xe)</p>
                  )}
                  {viewingOrder.status === "active" && (
                    <p className="text-sm text-gray-500">Chưa có doanh thu (đang trong quá trình thuê)</p>
                  )}
                  {viewingOrder.status === "completed" && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tiền thuê xe:</span>
                        <span className="font-medium text-emerald-600">+{viewingOrder.totalPrice.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Trả cọc cho khách:</span>
                        <span className="font-medium text-gray-500">-{viewingOrder.deposit.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Doanh thu thực nhận:</span>
                        <span className="font-bold text-emerald-600">{viewingOrder.revenue.toLocaleString("vi-VN")} VND</span>
                      </div>
                    </div>
                  )}
                  {viewingOrder.status === "cancelled" && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Khách hủy - Mất cọc:</span>
                        <span className="font-medium text-amber-600">+{viewingOrder.deposit.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Doanh thu:</span>
                        <span className="font-bold text-amber-600">{viewingOrder.revenue.toLocaleString("vi-VN")} VND</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {viewingOrder.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700 rounded-xl"
                    onClick={() => {
                      updateOrderStatus(viewingOrder.id, "active")
                      setViewingOrder(null)
                    }}
                  >
                    Xác nhận giao xe
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-gray-200"
                    onClick={() => {
                      updateOrderStatus(viewingOrder.id, "cancelled")
                      setViewingOrder(null)
                    }}
                  >
                    Hủy đơn
                  </Button>
                </div>
              )}
              {viewingOrder.status === "active" && (
                <Button
                  className="w-full bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl"
                  onClick={() => {
                    updateOrderStatus(viewingOrder.id, "completed")
                    setViewingOrder(null)
                  }}
                >
                  Hoàn thành đơn
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Sửa đơn thuê {editingOrder?.id}</DialogTitle>
            <DialogDescription className="text-gray-500">Chỉnh sửa thông tin đơn thuê</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-600">Khách hàng</Label>
              <Input
                value={editingOrder?.customerName || ""}
                disabled
                className="bg-gray-100 border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-vehicle" className="text-gray-600">Xe thuê</Label>
              <Select
                value={editFormData.vehicleId}
                onValueChange={(value) => setEditFormData({ ...editFormData, vehicleId: value })}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Chọn xe" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
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
                <Label htmlFor="edit-startDate" className="text-gray-600">Ngày bắt đầu</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={editFormData.startDate}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endDate" className="text-gray-600">Ngày kết thúc</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  value={editFormData.endDate}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-deposit" className="text-gray-600">Tiền đặt cọc (VND)</Label>
              <Input
                id="edit-deposit"
                type="text"
                value={editFormData.deposit}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({ ...editFormData, deposit: formatted })
                }}
                className="bg-gray-50 border-gray-200 rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-extraFees" className="text-gray-600">Phí phát sinh (VND)</Label>
              <Input
                id="edit-extraFees"
                type="text"
                value={editFormData.extraFees}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({ ...editFormData, extraFees: formatted })
                }}
                className="bg-gray-50 border-gray-200 rounded-xl font-mono"
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-homeName" className="text-gray-600">Tên Home (Homestay giới thiệu)</Label>
                <Input
                  id="edit-homeName"
                  type="text"
                  value={editFormData.homeName}
                  onChange={(e) => setEditFormData({ ...editFormData, homeName: e.target.value })}
                  placeholder="VD: Home ABC"
                  className="bg-gray-50 border-gray-200 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-commissionHome" className="text-gray-600">Chia hoa hồng cho Home (VND/ngày)</Label>
                <Input
                  id="edit-commissionHome"
                  type="text"
                  value={editFormData.commissionHome}
                  onChange={(e) => {
                    const formatted = formatMoneyInput(e.target.value)
                    setEditFormData({ ...editFormData, commissionHome: formatted })
                  }}
                  placeholder="VD: 20.000"
                  className="bg-gray-50 border-gray-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-gray-600">Ghi chú</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="bg-gray-50 border-gray-200 rounded-xl min-h-20 resize-y"
                placeholder="Nhập ghi chú cho đơn thuê..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status" className="text-gray-600">Trạng thái</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value: RentalOrder["status"]) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
                  <SelectItem value="pending">Chờ giao xe</SelectItem>
                  <SelectItem value="active">Đang thuê</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl border-gray-200">
                Hủy
              </Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl">
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={!!viewingCustomer} onOpenChange={(open) => {
        if (!open && !lightboxImage) setViewingCustomer(null)
      }}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Chi tiết khách hàng
            </DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Họ tên</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mã khách hàng</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số điện thoại</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-800">{viewingCustomer.phone}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Facebook</p>
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <a
                      href={viewingCustomer.facebook || ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline truncate"
                    >
                      {(viewingCustomer.facebook || "").replace("https://facebook.com/", "")}
                    </a>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Địa chỉ</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-800">{viewingCustomer.address}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">CCCD</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.idcard}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số lần thuê</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.totalrentals} lần</p>
                </div>
              </div>

              {/* Customer Photo */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh khách hàng</p>
                {(viewingCustomer.customerphoto?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {(viewingCustomer.customerphoto || []).map((img, index) => (
                      <div 
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      >
                        <img src={img} alt={`Ảnh ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-3 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              {/* CCCD Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh CCCD</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt trước</p>
                    {(viewingCustomer.cccdfront?.length ?? 0) > 0 ? (
                      <div
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage((viewingCustomer.cccdfront || [])[0])}
                      >
                        <img src={(viewingCustomer.cccdfront || [])[0]} alt="CCCD mặt trước" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt sau</p>
                    {(viewingCustomer.cccdback?.length ?? 0) > 0 ? (
                      <div
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage((viewingCustomer.cccdback || [])[0])}
                      >
                        <img src={(viewingCustomer.cccdback || [])[0]} alt="CCCD mặt sau" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* License Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Giấy phép lái xe</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt trước</p>
                    {(viewingCustomer.licensefront?.length ?? 0) > 0 ? (
                      <div
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage((viewingCustomer.licensefront || [])[0])}
                      >
                        <img src={(viewingCustomer.licensefront || [])[0]} alt="GPLX mặt trước" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt sau</p>
                    {(viewingCustomer.licenseback?.length ?? 0) > 0 ? (
                      <div
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage((viewingCustomer.licenseback || [])[0])}
                      >
                        <img src={(viewingCustomer.licenseback || [])[0]} alt="GPLX mặt sau" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCustomer(null)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog */}
      <Dialog open={!!viewingVehicle} onOpenChange={(open) => {
        if (!open && !lightboxImage) setViewingVehicle(null)
      }}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              Chi tiết xe
            </DialogTitle>
          </DialogHeader>
          {viewingVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Loại xe</p>
                  <p className="font-medium text-gray-800">{viewingVehicle.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Biển số</p>
                  <p className="font-medium text-gray-800 font-mono">{viewingVehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Màu xe</p>
                  <p className="font-medium text-gray-800">{viewingVehicle.color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Trạng thái</p>
                  <Badge className={vehicleStatusConfig[viewingVehicle.status].className}>
                    {vehicleStatusConfig[viewingVehicle.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá thuê/ngày</p>
                  <p className="font-medium text-blue-600">{(viewingVehicle.pricePerDay ?? 0).toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số KM hiện tại</p>
                  <p className="font-medium text-gray-800">{(viewingVehicle.current_km ?? 0).toLocaleString("vi-VN")} km</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá mua xe</p>
                  <p className="font-medium text-gray-800">{(viewingVehicle.purchasePrice ?? 0).toLocaleString("vi-VN")} VND</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ghi chú</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-xl">{viewingVehicle.notes || "Không có ghi chú"}</p>
              </div>

              {/* Vehicle Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh xe</p>
                {(viewingVehicle.vehicleImages?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingVehicle.vehicleImages.map((img, index) => (
                      <div 
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      >
                        <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-3 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Chưa có ảnh xe</span>
                  </div>
                )}
              </div>

              {/* Document Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh giấy tờ xe</p>
                {(viewingVehicle.documentImages?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingVehicle.documentImages.map((img, index) => (
                      <div 
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      >
                        <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-3 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Chưa có ảnh giấy tờ</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingVehicle(null)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxImage && (
        <LightboxModal 
          imageSrc={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}
    </div>
  )
}
