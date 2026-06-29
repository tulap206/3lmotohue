"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Car,
  Users,
  ClipboardList,
  TrendingUp,
  Wallet,
  Eye,
  ArrowRight,
  Database,
  CheckCircle2,
  Clock,
  Bike,
  Plus,
  X,
  AlertTriangle,
  DollarSign,
  Edit2,
  Trash2,
  Search,
  Pencil,
} from "lucide-react"
import { fetchVehicles, fetchRentals, fetchTransactions, fetchCustomers, insertCustomer, insertTransaction, deleteTransaction, updateTransaction, supabase } from "@/lib/supabase"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { uploadImage } from "@/lib/storage"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { MetricCard } from "@/components/ui/metric-card"
import { SkeletonMetricCards, SkeletonTable } from "@/components/ui/skeleton-loader"
import { EmptyTable } from "@/components/ui/empty-state"


interface DashboardStats {
  totalVehicles: number
  totalRevenue: number
  totalProfit: number
  totalRentals: number
  activeRentals: number
  overdueRentals: number
}

interface RecentOrder {
  id: string
  customer: string
  vehicle: string
  price: string
  unit: number
  status: string
  endDate?: string
}

interface TopVehicle {
  id: string
  name: string
  licensePlate: string
  rentals: number
  revenue: string
  profit: string
  image?: string[]
  category?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  active: { label: "Đang thuê", className: "bg-blue-50 text-blue-700 border border-blue-100" },
  pending: { label: "Chờ xử lý", className: "bg-amber-50 text-amber-700 border border-amber-100" },
  cancelled: { label: "Đã hủy", className: "bg-slate-100 text-slate-500 border border-slate-200" },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<any[]>([])

  const isOrderOverdue = (order: any) => {
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
  const [vehicles, setVehicles] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    customerId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    deposit: "",
    commissionHome: "",
    homeName: "",
  })
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerCCCD, setNewCustomerCCCD] = useState("")
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<File | null>(null)
  const [newCustomerCCCDFront, setNewCustomerCCCDFront] = useState<File | null>(null)
  const [hasCommission, setHasCommission] = useState(false)

  const filteredCustomersForSelect = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.phone && c.phone.toLowerCase().includes(customerSearch.toLowerCase())) || 
    c.id.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredVehiclesForSelect = vehicles.filter(v => 
    v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
    (v.licensePlate && v.licensePlate.toLowerCase().includes(vehicleSearch.toLowerCase()))
  )

  const calculateTotalDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const generateRentalCodeFromUUID = (customerName: string, licensePlate: string, startDate: string, uuid: string) => {
    const removeVietnameseDiacritics = (str: string) => {
      return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    }
    const nameParts = removeVietnameseDiacritics(customerName).trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]
    const cleanPlate = licensePlate.replace(/[\s-]/g, "").toUpperCase()
    const dateParts = startDate.split("/")
    const dateFormatted = String(dateParts[0]).padStart(2, "0") + String(dateParts[1]).padStart(2, "0") + String(dateParts[2]).padStart(4, "0")
    const uuidPart = uuid.substring(0, 8).toUpperCase()
    return `${lastName}-${cleanPlate}-${dateFormatted}-${uuidPart}`
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
    setCustomerSearch("")
    setVehicleSearch("")
    setIsDialogOpen(false)
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
        loadDashboardData(false)
        resetForm()
      }
    } catch (error) {
      console.error("Exception creating rental:", error)
      alert(`❌ Lỗi tạo đơn thuê`)
    }
  }
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalRentals: 0,
    activeRentals: 0,
    overdueRentals: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<TopVehicle | null>(null)
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false)
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false)

  // Reports & Transactions States
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([])
  const [topRevenueVehicles, setTopRevenueVehicles] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [txSearchQuery, setTxSearchQuery] = useState("")
  const [txCurrentPage, setTxCurrentPage] = useState(1)
  const [isAddTxOpen, setIsAddTxOpen] = useState(false)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<any | null>(null)
  const [txDeleteConfirmOpen, setTxDeleteConfirmOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<any | null>(null)
  const [isVehicleDetailOpen, setIsVehicleDetailOpen] = useState(false)
  const [selectedVehicleDetail, setSelectedVehicleDetail] = useState<any | null>(null)
  
  const [txFormData, setTxFormData] = useState({
    type: "income",
    description: "",
    amount: "",
  })
  
  const [txEditFormData, setTxEditFormData] = useState({
    type: "income",
    description: "",
    amount: "",
  })
  
  const txItemsPerPage = 10

  const loadDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      // Check if user is demo account (demo)
      const isDemoAccount = user?.username === "demo"

      const vehicles = isDemoAccount ? [] : (await fetchVehicles()) || []
      setVehicles(vehicles)
      const rentals = isDemoAccount ? [] : (await fetchRentals()) || []
      setOrders(rentals)
      const transactions = isDemoAccount ? [] : (await fetchTransactions()) || []
      const customersData = isDemoAccount ? [] : (await fetchCustomers()) || []
      setCustomers(customersData)

      // Calculate stats
      const completedRentals = rentals.filter((r: any) => r.status === 'completed')
      const activeRentals = rentals.filter((r: any) => r.status === 'active')
      
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const overdueRentals = rentals.filter((r: any) => {
        if (r.status === 'completed' || r.status === 'cancelled') return false
        if (!r.endDate) return false
        try {
          const parts = r.endDate.split('/')
          if (parts.length === 3) {
            const end = new Date(parts[2], parts[1] - 1, parts[0])
            end.setHours(0, 0, 0, 0)
            return end < now
          }
        } catch (e) {
          console.error(e)
        }
        return false
      })
      
      // Rental revenue (from completed rentals, includes extraFees via revenue field)
      const rentalRevenue = completedRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)

      
      // Transaction totals
      const totalIncome = transactions
        .filter((tx: any) => tx.type === 'income')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      // Doanh thu = Rental revenue + Income from transactions
      const totalRevenue = rentalRevenue + totalIncome
      
      // Lợi nhuận = Rental revenue ONLY (not counting transactions)
      const totalProfit = rentalRevenue

      setStats({
        totalVehicles: vehicles.length,
        totalRevenue,
        totalProfit,
        totalRentals: rentals.length,
        activeRentals: activeRentals.length,
        overdueRentals: overdueRentals.length,
      })

      // Map recent rentals for display (slice to 5 for grid symmetry)
      const recent = rentals.slice(0, 5).map((r: any) => ({
        id: r.id,
        customer: r.customerName,
        vehicle: r.vehicleName,
        price: `${(r.pricePerDay / 1000).toFixed(0)}K`,
        unit: r.totalDays,
        status: r.status,
        endDate: r.endDate,
      }))
      setRecentOrders(recent)

      // Sort vehicles by rental count for top vehicles
      const vehiclesWithRentals = vehicles.map((v: any) => {
        // Calculate vehicle profit = revenue from rentals - purchase price
        const vehicleRentals = rentals.filter((r: any) => r.vehicleId === v.id && r.status === 'completed')
        const vehicleRevenue = vehicleRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
        const vehicleProfit = vehicleRevenue - (v.purchasePrice || 0)
        
        return {
          id: v.id,
          name: v.name,
          licensePlate: v.licensePlate,
          rentals: vehicleRentals.length,
          revenue: vehicleRevenue,
          revenueStr: `${vehicleRevenue.toLocaleString("vi-VN")} ₫`,
          profit: `${vehicleProfit.toLocaleString("vi-VN")} ₫`,
          image: v.vehicleImages || [],
          category: v.category,
        }
      })
      
      const sortedByRentals = [...vehiclesWithRentals].sort((a, b) => b.rentals - a.rentals).slice(0, 5)
      setTopVehicles(sortedByRentals)

      // Reports computations
      setTransactions(transactions)

      const parseVietnamDate = (dateStr: string) => {
        if (!dateStr) return new Date(0)
        const parts = dateStr.split("/")
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      }
      
      const monthlyData: Record<string, number> = {}
      rentals.forEach((rental: any) => {
        if (rental.startDate) {
          const date = parseVietnamDate(rental.startDate)
          const monthKey = `Thg ${date.getMonth() + 1}`
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (rental.revenue || rental.totalPrice || 0)
        }
      })

      const computedMonthlyRevenue = [
        { month: "Thg 1", revenue: monthlyData["Thg 1"] || 0 },
        { month: "Thg 2", revenue: monthlyData["Thg 2"] || 0 },
        { month: "Thg 3", revenue: monthlyData["Thg 3"] || 0 },
        { month: "Thg 4", revenue: monthlyData["Thg 4"] || 0 },
        { month: "Thg 5", revenue: monthlyData["Thg 5"] || 0 },
        { month: "Thg 6", revenue: monthlyData["Thg 6"] || 0 },
        { month: "Thg 7", revenue: monthlyData["Thg 7"] || 0 },
        { month: "Thg 8", revenue: monthlyData["Thg 8"] || 0 },
        { month: "Thg 9", revenue: monthlyData["Thg 9"] || 0 },
        { month: "Thg 10", revenue: monthlyData["Thg 10"] || 0 },
        { month: "Thg 11", revenue: monthlyData["Thg 11"] || 0 },
        { month: "Thg 12", revenue: monthlyData["Thg 12"] || 0 },
      ]
      setMonthlyRevenue(computedMonthlyRevenue)

      const vehiclesWithRevenueStats = vehicles.map((v: any) => {
        const vehicleRentals = rentals.filter((r: any) => r.vehicleId === v.id && r.status === 'completed')
        const revenue = vehicleRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
        return {
          name: v.name,
          rentals: vehicleRentals.length,
          revenue: revenue,
        }
      }).filter((v: any) => v.revenue > 0).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
      setTopRevenueVehicles(vehiclesWithRevenueStats)
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData(true)

    // Subscribe to real-time events for rentals, vehicles, transactions
    const dashboardChannel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => {
        loadDashboardData(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        loadDashboardData(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadDashboardData(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(dashboardChannel)
    }
  }, [loadDashboardData])

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value)
  }

  // Transactions CRUD handlers
  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txFormData.description || !txFormData.amount || !user) return

    try {
      const newTx = await insertTransaction({
        type: txFormData.type as "income" | "expense",
        description: txFormData.description,
        amount: parseMoneyInput(txFormData.amount),
        user: user.username,
        timestamp: new Date().toISOString(),
      })
      
      setTransactions([newTx, ...transactions])
      setTxFormData({ type: "income", description: "", amount: "" })
      setIsAddTxOpen(false)
      
      // Reload stats/report data
      await loadDashboardData(false)
      
      if (user?.username) {
        try {
          await supabase.from("access_logs").insert({
            username: user.username,
            displayName: user.displayName || user.username,
            action: "Thêm mới",
            module: "Thu/Chi",
            details: `${txFormData.type === "income" ? "Thu" : "Chi"}: ${txFormData.description}`,
            timestamp: new Date().toISOString()
          })
        } catch (logError) {
          console.error("Warning: Could not log action", logError)
        }
      }
    } catch (error) {
      console.error("Error adding transaction:", error)
    }
  }

  const handleDeleteTx = (tx: any) => {
    if (user?.role !== 'admin') {
      alert('❌ Chỉ admin có quyền xoá khoản thu/chi')
      return
    }
    setTxToDelete(tx)
    setTxDeleteConfirmOpen(true)
  }

  const handleConfirmDeleteTx = async () => {
    if (!txToDelete) return
    try {
      await deleteTransaction(txToDelete.id)
      setTransactions(transactions.filter(t => t.id !== txToDelete.id))
      setTxDeleteConfirmOpen(false)
      setTxToDelete(null)
      await loadDashboardData(false)
      
      if (user?.username) {
        await supabase.from("access_logs").insert({
          username: user.username,
          displayName: user.displayName || user.username,
          action: "Xóa",
          module: "Thu/Chi",
          details: `Xoá: ${txToDelete.description}`,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error("Error deleting transaction:", error)
    }
  }

  const handleEditTx = (tx: any) => {
    if (user?.role !== 'admin') {
      alert('❌ Chỉ admin có quyền sửa khoản thu/chi')
      return
    }
    setEditingTx(tx)
    setTxEditFormData({
      type: tx.type,
      description: tx.description,
      amount: tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    })
    setIsEditTxOpen(true)
  }

  const handleConfirmEditTx = async () => {
    if (!editingTx || !txEditFormData.description || !txEditFormData.amount) return
    const parsedAmount = parseMoneyInput(txEditFormData.amount)
    try {
      await updateTransaction(editingTx.id, {
        type: txEditFormData.type as "income" | "expense",
        description: txEditFormData.description,
        amount: parsedAmount,
      })
      
      setTransactions(transactions.map(t => t.id === editingTx.id ? { ...t, type: txEditFormData.type, description: txEditFormData.description, amount: parsedAmount } : t))
      setIsEditTxOpen(false)
      setEditingTx(null)
      await loadDashboardData(false)
      
      if (user?.username) {
        await supabase.from("access_logs").insert({
          username: user.username,
          displayName: user.displayName || user.username,
          action: "Chỉnh sửa",
          module: "Thu/Chi",
          details: `Sửa: ${txEditFormData.description}`,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error("Error updating transaction:", error)
    }
  }


  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 bg-slate-200 rounded-2xl" />
          <div className="h-72 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 italic uppercase">
            3L <span className="text-blue-600">MOTO</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            3L Moto · Tổng quan kinh doanh và vận hành cho thuê xe chuyên nghiệp
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Dữ liệu Supabase</span>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tạo đơn thuê mới
          </Button>
        </div>

      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Tổng Xe */}
        <MetricCard
          label="Tổng Xe"
          value={stats.totalVehicles}
          icon={<Car className="w-5 h-5" />}
          iconColor="text-blue-600"
          delay={0}
          onClick={() => router.push("/dashboard/vehicles")}
          backgroundColor="bg-white"
        />

        {/* Xe Đang Thuê */}
        <MetricCard
          label="Xe Đang Thuê"
          value={stats.activeRentals}
          icon={<Clock className="w-5 h-5" />}
          iconColor="text-blue-600"
          delay={1}
          onClick={() => router.push("/dashboard/orders?status=active")}
          backgroundColor="bg-white"
        />

        {/* Đơn thuê */}
        <MetricCard
          label="Đơn Thuê"
          value={stats.totalRentals}
          icon={<ClipboardList className="w-5 h-5" />}
          iconColor="text-blue-600"
          delay={2}
          onClick={() => router.push("/dashboard/orders")}
          backgroundColor="bg-white"
        />

        {/* Quá Hạn */}
        <MetricCard
          label="Quá Hạn"
          value={stats.overdueRentals}
          valueClassName="text-red-600"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="text-red-600"
          delay={3}
          onClick={() => router.push("/dashboard/orders?status=overdue")}
          backgroundColor="bg-white"
        />

        {/* Doanh Thu */}
        <MetricCard
          label="Doanh Thu"
          value={formatPrice(stats.totalRevenue)}
          icon={<Wallet className="w-5 h-5" />}
          iconColor="text-blue-600"
          delay={4}
          onClick={() => document.getElementById("reports-section")?.scrollIntoView({ behavior: "smooth" })}
          backgroundColor="bg-white"
        />

        {/* Lợi nhuận */}
        <MetricCard
          label="Lợi Nhuận"
          value={formatPrice(stats.totalProfit)}
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="text-emerald-600"
          delay={5}
          onClick={() => document.getElementById("reports-section")?.scrollIntoView({ behavior: "smooth" })}
          backgroundColor="bg-white"
        />
      </div>

      {/* ── Main Grid: Recent Orders + Top Revenue + Top Rentals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Rentals */}
        <div>
          <Card className="rounded-2xl border-slate-100 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">Đơn Thuê Gần Đây</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs h-7 px-3 rounded-lg"
                  onClick={() => router.push("/dashboard/orders")}
                >
                  Xem tất cả
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1">
              <div className="space-y-1">
                {recentOrders.length === 0 ? (
                  <div className="text-center py-10">
                    <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Chưa có đơn thuê nào</p>
                  </div>
                ) : (
                  recentOrders.map((order) => {
                    const isOverdue = isOrderOverdue(order)
                    const sc = isOverdue 
                      ? { label: "Quá hạn", className: "bg-orange-50 text-orange-600 border border-orange-200" }
                      : (statusConfig[order.status] || statusConfig.pending)
                    return (
                      <div
                        key={order.id}
                        onClick={() => { setSelectedOrder(order); setIsOrderDialogOpen(true) }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer transition-all duration-200 group border-b border-slate-100/50 last:border-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Car className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate capitalize">{order.customer}</p>
                            <p className="text-xs text-slate-500 truncate">{order.vehicle}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.className}`}>
                            {sc.label}
                          </span>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-800">{order.price}</p>
                            <p className="text-xs text-slate-400">{order.unit} ngày</p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Xe Top Doanh Thu */}
        <div>
          <Card className="rounded-2xl border-slate-100 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">Xe Top Doanh Thu</CardTitle>
                <CardDescription className="text-xs text-slate-500">Top 5 xe có doanh thu cao nhất</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1">
              {topRevenueVehicles.length > 0 ? (
                <div className="space-y-1">
                  {topRevenueVehicles.map((vehicle, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between border-b border-slate-100/50 p-2.5 rounded-xl hover:bg-slate-50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer transition-all duration-200 gap-2 last:border-0"
                      onClick={async () => {
                        const { data } = await supabase
                          .from('vehicles')
                          .select('*')
                          .eq('name', vehicle.name)
                          .single()
                        
                        if (data) {
                          setSelectedVehicleDetail(data)
                          setIsVehicleDetailOpen(true)
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-black text-slate-300 w-4 text-center flex-shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{vehicle.name}</p>
                          <p className="text-xs text-slate-400">{vehicle.rentals} lần thuê</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm text-slate-800 break-words">
                          {vehicle.revenue.toLocaleString("vi-VN")} đ
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-10 text-sm">Chưa có dữ liệu xe</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Vehicles */}
        <div>
          <Card className="rounded-2xl border-slate-100 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">Xe Thuê Nhiều Nhất</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs h-7 px-3 rounded-lg"
                  onClick={() => router.push("/dashboard/vehicles")}
                >
                  Xem tất cả
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1">
              <div className="space-y-1">
                {topVehicles.length === 0 ? (
                  <div className="text-center py-10">
                    <Car className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Chưa có dữ liệu</p>
                  </div>
                ) : (
                  topVehicles.map((vehicle, idx) => (
                    <div
                      key={vehicle.id}
                      onClick={() => { setSelectedVehicle(vehicle); setIsVehicleDialogOpen(true) }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer transition-all duration-200 border-b border-slate-100/50 last:border-0"
                    >
                      <span className="text-xs font-black text-slate-300 w-4 text-center flex-shrink-0">{idx + 1}</span>
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {vehicle.category === "bike"
                          ? <Bike className="w-4 h-4 text-slate-500" />
                          : <Car className="w-4 h-4 text-slate-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{vehicle.name}</p>
                        <p className="text-xs text-slate-400">{vehicle.licensePlate}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-600 flex-shrink-0">{vehicle.rentals} lần</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>



      {/* ── Financial Reports Section ── */}
      <div id="reports-section" className="mt-8 mb-6 border-t border-slate-100 pt-8">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          📊 Báo Cáo Tài Chính & Hiệu Suất
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Doanh Thu Theo Tháng */}
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border-slate-100 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
              <CardTitle className="text-base font-bold text-slate-800">Doanh Thu Theo Tháng</CardTitle>
              <CardDescription className="text-xs text-slate-500">Doanh thu hàng tháng</CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-4 flex-1">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyRevenue} margin={{ top: 20, right: 5, left: -15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={35} />
                  <Tooltip
                    formatter={(value: any) => `${value.toLocaleString("vi-VN")} VNĐ`}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px"
                    }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    label={{ 
                      position: 'top', 
                      fill: '#475569', 
                      fontSize: 9, 
                      formatter: (value: number) => value > 0 ? (value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toLocaleString() + 'k') : '' 
                    }} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Xe Được Thuê Nhiều */}
        <div className="lg:col-span-3">
          {topVehicles.length > 0 && (
            <Card className="rounded-2xl border-slate-100 shadow-sm h-full flex flex-col">
              <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
                <CardTitle className="text-base font-bold text-slate-800">Xe Được Thuê Nhiều</CardTitle>
                <CardDescription className="text-xs text-slate-500">Những mẫu xe có doanh số tốt nhất</CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-4 flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {topVehicles.slice(0, 2).map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-100 transition-all cursor-pointer group flex flex-col h-full"
                      onClick={() => { setSelectedVehicle(vehicle); setIsVehicleDialogOpen(true) }}
                    >
                      {/* Image */}
                      <div className="aspect-video bg-slate-100 overflow-hidden relative">
                        {vehicle.image && vehicle.image.length > 0 ? (
                          <img
                            src={vehicle.image[0]}
                            alt={vehicle.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                            {vehicle.category === "bike"
                              ? <Bike className="w-10 h-10 text-slate-400" />
                              : <Car className="w-10 h-10 text-slate-400" />
                            }
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm truncate">{vehicle.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{vehicle.licensePlate}</p>

                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <p className="text-slate-400">Doanh thu</p>
                              <p className="font-semibold text-slate-800 truncate">{Number(vehicle.revenue).toLocaleString("vi-VN")} đ</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Lần thuê</p>
                              <p className="font-bold text-blue-600">{vehicle.rentals} lần</p>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedVehicle(vehicle)
                            setIsVehicleDialogOpen(true)
                          }}
                          variant="outline"
                          className="w-full mt-3 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl h-7 text-[11px] font-semibold"
                          size="sm"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Chi Tiết
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Theo Dõi Thu/Chi (Expanded to Width 100%) */}
      <div className="w-full mb-6">
        {(() => {
          const query = txSearchQuery.toLowerCase()
          const filteredTx = transactions.filter((tx) => {
            return (
              tx.description.toLowerCase().includes(query) ||
              tx.user.toLowerCase().includes(query) ||
              tx.amount.toString().includes(query) ||
              tx.type.toLowerCase().includes(query)
            )
          })

          const totalTxPages = Math.max(1, Math.ceil(filteredTx.length / txItemsPerPage))
          const activePage = Math.min(txCurrentPage, totalTxPages)
          const startTxIndex = (activePage - 1) * txItemsPerPage
          const endTxIndex = startTxIndex + txItemsPerPage
          const paginatedTx = filteredTx.slice(startTxIndex, endTxIndex)

          return (
            <Card className="rounded-2xl border-slate-100 shadow-sm h-full">
              <CardHeader className="pb-3 md:pb-4 p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Theo Dõi Thu/Chi</CardTitle>
                    <CardDescription className="text-blue-600 font-medium text-xs">Quản lý các khoản thu/chi ngoài đơn thuê</CardDescription>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                    {/* Add Transaction Dialog */}
                    <Dialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-8 font-semibold w-full sm:w-auto">
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Ghi chép thu/chi
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-slate-200 rounded-2xl max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="text-slate-800">Ghi Chép Thu/Chi Mới</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddTx} className="space-y-4 pt-2">
                          <div className="space-y-1.5">
                            <Label className="text-slate-700 font-semibold text-xs">Loại giao dịch</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant={txFormData.type === "income" ? "default" : "outline"}
                                className={cn(
                                  "rounded-xl text-xs h-9 font-semibold",
                                  txFormData.type === "income" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                )}
                                onClick={() => setTxFormData(prev => ({ ...prev, type: "income" }))}
                              >
                                Thu tiền (+)
                              </Button>
                              <Button
                                type="button"
                                variant={txFormData.type === "expense" ? "default" : "outline"}
                                className={cn(
                                  "rounded-xl text-xs h-9 font-semibold",
                                  txFormData.type === "expense" ? "bg-red-600 text-white hover:bg-red-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                )}
                                onClick={() => setTxFormData(prev => ({ ...prev, type: "expense" }))}
                              >
                                Chi tiền (-)
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-slate-700 font-semibold text-xs">Số tiền (VND)</Label>
                            <Input
                              type="number"
                              required
                              placeholder="Nhập số tiền..."
                              value={txFormData.amount}
                              onChange={(e) => setTxFormData(prev => ({ ...prev, amount: e.target.value }))}
                              className="rounded-xl border-slate-200 h-9 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-slate-700 font-semibold text-xs">Mô tả chi tiết</Label>
                            <Input
                              type="text"
                              required
                              placeholder="Lý do thu/chi..."
                              value={txFormData.description}
                              onChange={(e) => setTxFormData(prev => ({ ...prev, description: e.target.value }))}
                              className="rounded-xl border-slate-200 h-9 text-sm"
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { setIsAddTxOpen(false); setTxFormData({ type: "income", description: "", amount: "" }) }}
                              className="rounded-xl border-slate-200 text-xs h-9 font-semibold"
                            >
                              Hủy
                            </Button>
                            <Button
                              type="submit"
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-9 font-semibold"
                            >
                              Lưu lại
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {/* Search Field */}
                    <div className="relative w-full sm:w-44">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="search"
                        placeholder="Tìm kiếm..."
                        value={txSearchQuery}
                        onChange={(e) => { setTxSearchQuery(e.target.value); setTxCurrentPage(1) }}
                        className="pl-8 h-8 rounded-lg text-xs border-slate-200 w-full"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                {paginatedTx.length > 0 ? (
                  <div className="space-y-3">
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100/80">
                      <table className="w-full text-left border-collapse table-striped">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider w-10 text-center">STT</th>
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider text-center">Thời gian</th>
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider text-center">Loại</th>
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Mô tả chi tiết</th>
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider text-right">Số tiền</th>
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider text-center">Người nhập</th>
                            <th className="p-2.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider text-center w-20">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTx.map((tx, index) => (
                            <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/40 table-row-hover transition-colors">
                              <td className="p-2.5 text-center text-slate-400 font-medium text-xs">
                                {startTxIndex + index + 1}
                              </td>
                              <td className="p-2.5 text-slate-500 text-[11px]">
                                {new Date(tx.timestamp).toLocaleString("vi-VN")}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                                  tx.type === "income" 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                    : "bg-red-50 text-red-700 border-red-100"
                                )}>
                                  {tx.type === "income" ? "Thu" : "Chi"}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-700 text-xs font-medium max-w-[200px] truncate" title={tx.description}>
                                {tx.description}
                              </td>
                              <td className={cn(
                                "p-2.5 text-right font-bold text-xs",
                                tx.type === "income" ? "text-emerald-600" : "text-red-600"
                              )}>
                                {tx.type === "income" ? "+" : "-"} {tx.amount.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="p-2.5 text-slate-600 text-xs font-semibold text-center uppercase tracking-wide">
                                {tx.user}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                                    onClick={() => handleEditTx(tx)}
                                    title="Sửa"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  {user?.permissions.canDelete && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                      onClick={() => { setTxToDelete(tx); setTxDeleteConfirmOpen(true) }}
                                      title="Xoá"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card-based List */}
                    <div className="block md:hidden space-y-3">
                      {paginatedTx.map((tx, index) => (
                        <div key={tx.id} className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl space-y-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold">STT: {startTxIndex + index + 1}</span>
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                              tx.type === "income" 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                : "bg-red-50 text-red-700 border-red-100"
                            )}>
                              {tx.type === "income" ? "Thu" : "Chi"}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Số tiền:</span>
                              <span className={cn(
                                "font-bold",
                                tx.type === "income" ? "text-emerald-600" : "text-red-600"
                              )}>
                                {tx.type === "income" ? "+" : "-"} {tx.amount.toLocaleString("vi-VN")} đ
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Thời gian:</span>
                              <span className="text-slate-700">{new Date(tx.timestamp).toLocaleString("vi-VN")}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Người nhập:</span>
                              <span className="text-slate-700 font-semibold uppercase">{tx.user}</span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-100/50">
                              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Mô tả chi tiết</p>
                              <p className="text-slate-700 text-xs break-all whitespace-pre-wrap">{tx.description}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-slate-100/50">
                            <Button
                              type="button"
                              onClick={() => handleEditTx(tx)}
                              variant="outline"
                              className="flex-1 h-9 rounded-xl border-slate-200 text-xs text-slate-700 font-semibold hover:bg-slate-50"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Sửa
                            </Button>
                            {user?.permissions.canDelete && (
                              <Button
                                type="button"
                                onClick={() => { setTxToDelete(tx); setTxDeleteConfirmOpen(true) }}
                                variant="outline"
                                className="flex-1 h-9 rounded-xl border-red-100 text-xs text-red-600 font-semibold hover:bg-red-50 hover:border-red-200"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Xoá
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-3 gap-2 sm:gap-0">
                      <div className="text-[11px] text-slate-500">
                        <span>{startTxIndex + 1}</span> - <span>{Math.min(endTxIndex, filteredTx.length)}</span> / <span>{filteredTx.length}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTxCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={activePage === 1}
                          className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          ←
                        </button>
                        <div className="px-2 py-0.5 border border-slate-200 rounded-lg bg-slate-50">
                          <span className="text-[11px] font-bold text-slate-700">{activePage}/{totalTxPages}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTxCurrentPage(prev => Math.min(totalTxPages, prev + 1))}
                          disabled={activePage === totalTxPages}
                          className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <p className="text-xs">Chưa có khoản thu/chi nào</p>
                  </div>
                )}
                              </CardContent>
              </Card>
            )
          })()}
      </div>

      {/* ── Transaction Confirm Delete Dialog ── */}
      <Dialog open={txDeleteConfirmOpen} onOpenChange={setTxDeleteConfirmOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2 text-sm">
              Bạn có chắc chắn muốn xoá khoản {txToDelete?.type === "income" ? "THU" : "CHI"} <span className="font-semibold text-gray-800">"{txToDelete?.description}"</span> không?
              <p className="text-sm text-blue-600 mt-2">⚠️ Số tiền: {txToDelete?.amount.toLocaleString("vi-VN")} đ</p>
              <p className="text-sm text-blue-600">⚠️ Nhập bởi: {txToDelete?.user}</p>
              <p className="text-sm text-blue-600">⚠️ Hành động này không thể hoàn tác!</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setTxDeleteConfirmOpen(false)
                setTxToDelete(null)
              }}
              className="border-gray-300"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDeleteTx}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Transaction Edit Dialog ── */}
      <Dialog open={isEditTxOpen} onOpenChange={setIsEditTxOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Sửa Khoản Thu/Chi</DialogTitle>
            <DialogDescription className="text-gray-500">Cập nhật thông tin khoản thu/chi</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmEditTx(); }} className="space-y-4">
            <div>
              <Label className="text-gray-700 text-sm font-medium">Loại</Label>
              <Select value={txEditFormData.type} onValueChange={(val) => setTxEditFormData({...txEditFormData, type: val as "income" | "expense"})}>
                <SelectTrigger className="border-gray-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="income">Thu</SelectItem>
                  <SelectItem value="expense">Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-700 text-sm font-medium">Mô Tả</Label>
              <Input
                placeholder="Nhập mô tả"
                value={txEditFormData.description}
                onChange={(e) => setTxEditFormData({...txEditFormData, description: e.target.value})}
                className="border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-gray-700 text-sm font-medium">Số Tiền (VND)</Label>
              <Input
                type="text"
                placeholder="Nhập số tiền (VD: 1.000.000)"
                value={txEditFormData.amount}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setTxEditFormData({...txEditFormData, amount: formatted})
                }}
                className="border-gray-300 rounded-lg font-mono"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-lg">
              Cập nhật
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Vehicle Detail Dialog ── */}
      <Dialog open={isVehicleDetailOpen} onOpenChange={setIsVehicleDetailOpen}>
        <DialogContent className="bg-white rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Chi tiết xe</DialogTitle>
            <DialogDescription className="text-gray-500">Thông tin chi tiết của xe</DialogDescription>
          </DialogHeader>
          {selectedVehicleDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <p className="text-xs text-gray-500">Tên xe</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Biển số</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.licensePlate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Màu sắc</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.color}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Giá/ngày</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.pricePerDay?.toLocaleString() || 0} VNĐ</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Trạng thái</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Km hiện tại</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.current_km || 0} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Giá mua</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.purchasePrice?.toLocaleString("vi-VN") || 0} VNĐ</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ghi chú</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicleDetail.notes || "Không có"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Order Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogContent className="bg-white border-gray-200 rounded-2xl max-h-[90vh] overflow-y-auto max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800">Tạo đơn thuê mới</DialogTitle>
              <DialogDescription className="text-gray-500">Nhập thông tin đơn thuê xe</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                
                {/* CỘT 1: KHÁCH THUÊ */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">1. Khách thuê</h3>
                  
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
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Tên khách hàng *</Label>
                        <Input
                          placeholder="Nhập họ và tên..."
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Số điện thoại</Label>
                        <Input
                          placeholder="Nhập số điện thoại..."
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Số CCCD khách *</Label>
                        <Input
                          placeholder="Nhập số CCCD..."
                          value={newCustomerCCCD}
                          onChange={(e) => setNewCustomerCCCD(e.target.value)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Ảnh khách</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewCustomerPhoto(e.target.files?.[0] || null)}
                          className="bg-white border-gray-200 rounded-xl h-9 text-sm p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">Ảnh CCCD khách</Label>
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
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">2. Xe thuê</h3>
                  <div className="space-y-2 relative">
                    <Label htmlFor="vehicle" className="text-gray-600">Chọn xe thuê</Label>
                    <Input
                      placeholder="Nhập tên xe hoặc biển số..."
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
                  <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">3. Lên đơn</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="startDate" className="text-gray-600 text-xs">Ngày bắt đầu</Label>
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
                      <Label htmlFor="endDate" className="text-gray-600 text-xs">Ngày kết thúc</Label>
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
                    <Label htmlFor="deposit" className="text-gray-600 text-xs">Tiền đặt cọc (VND)</Label>
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
                    <div className="grid grid-cols-1 gap-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="space-y-1">
                        <Label htmlFor="homeName" className="text-gray-600 text-xs">Tên Home</Label>
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

      {/* ── Order Detail Dialog ── */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Chi Tiết Đơn Thuê</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3">
              {[
                { label: "Khách hàng", value: selectedOrder.customer },
                { label: "Xe thuê", value: selectedOrder.vehicle },
                { label: "Giá thuê", value: `${selectedOrder.price}/ngày` },
                { label: "Số ngày", value: `${selectedOrder.unit} ngày` },
                { label: "Trạng thái", value: statusConfig[selectedOrder.status]?.label || selectedOrder.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-800">{value}</span>
                </div>
              ))}
              <Button
                onClick={() => { setIsOrderDialogOpen(false); router.push("/dashboard/orders") }}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl mt-2"
              >
                Xem đơn thuê đầy đủ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Vehicle Detail Dialog ── */}
      <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Chi Tiết Xe</DialogTitle>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              {selectedVehicle.image && selectedVehicle.image.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedVehicle.image.slice(0, 4).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${selectedVehicle.name} ${idx + 1}`}
                      className="w-full h-36 object-cover rounded-xl"
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Tên xe", value: selectedVehicle.name },
                  { label: "Biển số", value: selectedVehicle.licensePlate },
                  { label: "Số lần thuê", value: `${selectedVehicle.rentals} lần` },
                  { label: "Doanh thu", value: selectedVehicle.revenue },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => { setIsVehicleDialogOpen(false); router.push("/dashboard/vehicles") }}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Xem Chi Tiết Đầy Đủ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
