"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Database,
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
  TrendingUp,
  Search,
  X,
} from "lucide-react"
import { SkeletonMetricCards, SkeletonTable, SkeletonCharts } from "@/components/ui/skeleton-loader"
import { MonthlyRevenueChart, RentalStatusChart, RentalFleetChart, RentalIncomeExpenseChart } from "@/components/dashboard/rental-charts"
import { OverdueOrdersPanel, CommissionHomeReportPanel } from "@/components/dashboard/rental-overview-panels"
import { RentalKpiCard, rentalTableHeadClass, getRentalTransactionTypeLabel } from "@/components/dashboard/rental-ui"
import { ModulePageShell, ModuleBrandHeader, ModuleSectionCard, ModuleSectionTitle, ModuleKpiGrid, ModuleResponsiveTable, ModuleMobileCard, ModulePagination, ModuleEmptyState, ModuleToolbar, moduleFilterInputClass } from "@/components/dashboard/module-shell"
import { cn } from "@/lib/utils"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormSection,
  EntityFormFooter,
  EntityFormToggle,
  EntityFormInfoBox,
  EntityFormTip,
} from "@/components/dashboard/entity-form-dialog"
import { fetchVehicles, fetchRentals, fetchTransactions, fetchCustomers, insertCustomer, insertTransaction, deleteTransaction, updateTransaction, supabase } from "@/lib/supabase"
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
import { formatDisplayDate, toStoredDateValue } from "@/lib/format-date"
import { calcOperatingProfit, calcOperatingRevenue, isCapitalTransaction, withCapitalTag, isSalaryTransaction, isDividendTransaction } from "@/lib/transaction-finance"
import { buildCommissionHomeReport, sumCommissionRows } from "@/lib/commission-home"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"

interface DashboardStats {
  totalVehicles: number
  totalRevenue: number
  totalProfit: number
  totalRentals: number
  pendingRentals: number
  activeRentals: number
  overdueRentals: number
  cashOnHand: number
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
    vehicleIds: [] as string[],
    startDate: "",
    endDate: "",
    deposit: "0",
    commissionHome: "",
    homeName: "",
  })
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [isNewCustomer, setIsNewCustomer] = useState(true)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")
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
    (v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
    (v.licensePlate && v.licensePlate.toLowerCase().includes(vehicleSearch.toLowerCase()))) &&
    !formData.vehicleIds.includes(v.id)
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
    setFormData({ customerId: "", vehicleIds: [], startDate: "", endDate: "", deposit: "0", commissionHome: "", homeName: "" })
    setIsNewCustomer(true)
    setNewCustomerName("")
    setNewCustomerPhone("")
    setNewCustomerAddress("")
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
    
    if (formData.vehicleIds.length === 0) {
      alert("⚠️ Vui lòng chọn ít nhất một xe thuê!")
      return
    }

    const selectedVehicles = vehicles.filter((v) => formData.vehicleIds.includes(v.id))
    if (selectedVehicles.length === 0) {
      alert("⚠️ Vui lòng chọn ít nhất một xe thuê!")
      return
    }

    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)
    
    if (startDate > endDate) {
      alert("⚠️ Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
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
        if (!newCustomerPhone.trim()) {
          alert("⚠️ Vui lòng nhập số điện thoại khách hàng!")
          return
        }
        if (!newCustomerAddress.trim()) {
          alert("⚠️ Vui lòng nhập địa chỉ khách hàng!")
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
      const startDateVN = toStoredDateValue(formData.startDate)
      const now = new Date().toISOString()

      // Split deposit and commission equally among all selected vehicles
      const totalDeposit = parseMoneyInput(formData.deposit) || 0
      const dividedDeposit = Math.round(totalDeposit / selectedVehicles.length)

      const totalCommission = hasCommission ? (parseMoneyInput(formData.commissionHome) || 0) : 0
      const dividedCommission = Math.round(totalCommission / selectedVehicles.length)

      const homeNameVal = hasCommission ? formData.homeName.trim() : ""

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
          notes: "",
          revenue: 0,
          status: "pending",
          created_at: now,
          commissionHome: dividedCommission,
          homeName: homeNameVal,
          rentalTerm: "short",
        }
      })

      let { data, error } = await supabase
        .from('rentals')
        .insert(insertPayloads)
        .select()

      if (error && /rentalTerm/i.test(error.message || "")) {
        const withoutCols = insertPayloads.map(({ rentalTerm: _omit, ...rest }) => ({
          ...rest,
          notes: "[rentalTerm:short]"
        }))
        ;({ data, error } = await supabase.from('rentals').insert(withoutCols).select())
      }

      if (error) {
        console.error("Error creating rentals:", error)
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        loadDashboardData(false)
        resetForm()
      }
    } catch (error) {
      console.error("Exception creating rentals:", error)
      alert(`❌ Lỗi tạo đơn thuê`)
    }
  }
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalRentals: 0,
    pendingRentals: 0,
    activeRentals: 0,
    overdueRentals: 0,
    cashOnHand: 0,
  })
  const [loading, setLoading] = useState(true)

  // Reports & Transactions States
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [txSearchQuery, setTxSearchQuery] = useState("")
  const [txCurrentPage, setTxCurrentPage] = useState(1)
  const [isAddTxOpen, setIsAddTxOpen] = useState(false)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<any | null>(null)
  const [txDeleteConfirmOpen, setTxDeleteConfirmOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<any | null>(null)
  
  const [txFormData, setTxFormData] = useState({
    type: "income",
    description: "",
    amount: "",
    isCapital: false,
    timestamp: new Date().toLocaleDateString('en-CA'),
  })
  
  const [txEditFormData, setTxEditFormData] = useState({
    type: "income",
    description: "",
    amount: "",
    isCapital: false,
    timestamp: "",
  })
  
  const loadDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      // Check if user is demo account (quy79)
      const isDemoAccount = user?.username === "quy79"

      const vehicles = isDemoAccount ? [] : (await fetchVehicles()) || []
      setVehicles(vehicles)
      const rentals = isDemoAccount ? [] : (await fetchRentals()) || []
      setOrders(rentals)
      const transactions = isDemoAccount ? [] : (await fetchTransactions()) || []
      const customersData = isDemoAccount ? [] : (await fetchCustomers()) || []
      setCustomers(customersData)

      // Calculate stats
      const completedRentals = rentals.filter((r: any) => r.status === 'completed')
      const pendingRentals = rentals.filter((r: any) => r.status === 'pending')
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
      
      // Doanh thu thuê (đơn hoàn tất; revenue đã trừ hoa hồng + gồm phụ phí)
      const rentalRevenue = completedRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)

      // P&L vận hành: bỏ qua góp vốn / mua xe (khoản vốn & tài sản)
      const totalRevenue = calcOperatingRevenue(rentalRevenue, transactions)
      const totalProfit = calcOperatingProfit(rentalRevenue, transactions)

      // Tiền quỹ còn lại = Doanh thu thuê + Tổng thu khác - Tổng chi khác
      const totalIncome = transactions
        .filter((tx: any) => tx.type === 'income')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      const totalExpense = transactions
        .filter((tx: any) => tx.type === 'expense')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      const rentalOnly = totalRevenue - transactions
        .filter((tx: any) => tx.type === 'income' && !isCapitalTransaction(tx))
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      const cashOnHand = rentalOnly + totalIncome - totalExpense

      setStats({
        totalVehicles: vehicles.length,
        totalRevenue,
        totalProfit,
        totalRentals: rentals.length,
        pendingRentals: pendingRentals.length,
        activeRentals: activeRentals.length,
        overdueRentals: overdueRentals.length,
        cashOnHand,
      })

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
      // Chỉ đơn hoàn tất; ghi nhận theo ngày kết thúc (khi chốt doanh thu), khớp KPI tháng
      rentals.forEach((rental: any) => {
        if (rental.status !== "completed") return
        const dateStr = rental.endDate || rental.startDate
        if (!dateStr) return
        const date = parseVietnamDate(dateStr)
        if (isNaN(date.getTime())) return
        const monthKey = `Thg ${date.getMonth() + 1}`
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (rental.revenue || rental.totalPrice || 0)
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
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [user?.username])

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

  const rentalStatusChartData = useMemo(() => {
    const overdue = orders.filter((o) => isOrderOverdue(o)).length
    const active = orders.filter((o) => o.status === "active" && !isOrderOverdue(o)).length
    return [
      { name: "Chờ xử lý", value: orders.filter((o) => o.status === "pending").length },
      { name: "Đang thuê", value: active },
      { name: "Quá hạn", value: overdue },
      { name: "Hoàn thành", value: orders.filter((o) => o.status === "completed").length },
      { name: "Đã hủy", value: orders.filter((o) => o.status === "cancelled").length },
    ]
  }, [orders])

  const rentalFleetChartData = useMemo(() => [
    { name: "Sẵn sàng", value: vehicles.filter((v) => v.status === "available").length },
    { name: "Đang cho thuê", value: vehicles.filter((v) => v.status === "rented").length },
    { name: "Bảo trì", value: vehicles.filter((v) => v.status === "maintenance").length },
  ], [vehicles])

  const rentalIncomeExpenseChartData = useMemo(() => {
    const monthly: Record<string, { name: string; income: number; expense: number }> = {}
    for (let i = 1; i <= 12; i++) {
      const key = `Thg ${i}`
      monthly[key] = { name: key, income: 0, expense: 0 }
    }
    transactions.forEach((tx) => {
      if (isCapitalTransaction(tx)) return
      const date = new Date(tx.timestamp || tx.created_at || "")
      if (isNaN(date.getTime())) return
      const key = `Thg ${date.getMonth() + 1}`
      if (!monthly[key]) monthly[key] = { name: key, income: 0, expense: 0 }
      if (tx.type === "income") monthly[key].income += tx.amount || 0
      else monthly[key].expense += tx.amount || 0
    })
    return Object.values(monthly)
  }, [transactions])

  // New KPI: Lấp đầy tháng này, Doanh thu tháng này
  const thisMonthKpis = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    const parseVN = (s: string): Date => {
      if (!s) return new Date(0)
      const parts = s.split("/")
      if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      return new Date(s)
    }

    const monthStart = new Date(currentYear, currentMonth, 1)
    const monthEnd = new Date(currentYear, currentMonth, daysInMonth)

    // Per vehicle: count rented days in this month (active/completed orders)
    let totalVehicleDays = 0
    let totalRentedDays = 0
    vehicles.forEach(v => {
      totalVehicleDays += daysInMonth
      const vOrders = orders.filter(o => o.vehicleId === v.id && o.status !== "cancelled")
      vOrders.forEach(o => {
        const start = parseVN(o.startDate)
        const end = parseVN(o.endDate)
        const overlapStart = start < monthStart ? monthStart : start
        const overlapEnd = end > monthEnd ? monthEnd : end
        if (overlapStart <= overlapEnd) {
          const diff = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1
          totalRentedDays += diff
        }
      })
    })
    const utilizationPct = totalVehicleDays > 0 ? Math.round((totalRentedDays / totalVehicleDays) * 100) : 0

    // Revenue this month: completed rentals ending this month + manual income this month
    const completedOrdersThisMonth = orders.filter(o => {
      if (o.status !== "completed") return false
      const end = parseVN(o.endDate)
      return end.getMonth() === currentMonth && end.getFullYear() === currentYear
    })
    const rentalRevenueThisMonth = completedOrdersThisMonth.reduce((sum: number, o: any) => sum + (o.revenue || o.totalPrice || 0), 0)

    const txThisMonth = transactions.filter((tx) => {
      const date = new Date(tx.timestamp || tx.created_at || "")
      if (isNaN(date.getTime())) return false
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })
    const revenueThisMonth = calcOperatingRevenue(rentalRevenueThisMonth, txThisMonth)
    const profitThisMonth = calcOperatingProfit(rentalRevenueThisMonth, txThisMonth)

    // HH Home tháng này: đơn hoàn thành kết thúc trong tháng (khớp chốt DT; đã trừ trong revenue)
    const commissionReport = buildCommissionHomeReport(orders, {
      month: currentMonth,
      year: currentYear,
      completedOnly: true,
    })
    const commissionThisMonth = sumCommissionRows(commissionReport)

    return {
      utilizationPct,
      revenueThisMonth,
      profitThisMonth,
      ordersCountThisMonth: completedOrdersThisMonth.length,
      commissionReport,
      commissionThisMonth,
    }
  }, [vehicles, orders, transactions])

  const overdueOrderRows = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orders
      .filter((o) => isOrderOverdue(o))
      .map((o) => {
        const parts = o.endDate?.split("/") || []
        const endDate =
          parts.length === 3
            ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            : new Date()
        endDate.setHours(0, 0, 0, 0)
        const daysOver = Math.max(0, Math.floor((today.getTime() - endDate.getTime()) / 86400000))
        return {
          id: o.id,
          customerName: o.customerName || "—",
          vehicleName: o.vehicleName || "—",
          licensePlate: o.licensePlate || "—",
          endDate: o.endDate || "—",
          daysOver,
        }
      })
  }, [orders])

  // Filtered and paginated transactions for Dashboard
  const txItemsPerPage = 10

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const query = txSearchQuery.toLowerCase().trim()
        if (!query) return true

        const matchDescription = (tx.description || "").toLowerCase().includes(query)
        const matchUser = (tx.user || "").toLowerCase().includes(query)
        const matchAmount = String(tx.amount || "").includes(query)
        const matchType = (tx.type === "income" ? "thu" : "chi").includes(query)

        return matchDescription || matchUser || matchAmount || matchType
      })
      .sort((a, b) => new Date(b.timestamp || b.created_at || 0).getTime() - new Date(a.timestamp || a.created_at || 0).getTime())
  }, [transactions, txSearchQuery])

  const txTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / txItemsPerPage))
  const txSafePage = Math.min(txCurrentPage, txTotalPages)

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice((txSafePage - 1) * txItemsPerPage, txSafePage * txItemsPerPage)
  }, [filteredTransactions, txSafePage])

  // Transactions CRUD handlers
  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txFormData.description || !txFormData.amount || !user) return

    try {
      const newTx = await insertTransaction({
        type: txFormData.type as "income" | "expense",
        description: withCapitalTag(txFormData.description, txFormData.isCapital),
        amount: parseMoneyInput(txFormData.amount),
        user: user.username,
        timestamp: txFormData.timestamp ? new Date(txFormData.timestamp + "T12:00:00").toISOString() : new Date().toISOString(),
      })
      
      setTransactions([newTx, ...transactions])
      setTxFormData({ type: "income", description: "", amount: "", isCapital: false, timestamp: new Date().toLocaleDateString('en-CA') })
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
      description: (tx.description || "").replace(/^\s*\[vốn\]\s*/i, ""),
      amount: tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      isCapital: isCapitalTransaction(tx),
      timestamp: new Date(tx.timestamp || tx.created_at || new Date()).toLocaleDateString('en-CA'),
    })
    setIsEditTxOpen(true)
  }

  const handleConfirmEditTx = async () => {
    if (!editingTx || !txEditFormData.description || !txEditFormData.amount) return
    const parsedAmount = parseMoneyInput(txEditFormData.amount)
    const nextDescription = withCapitalTag(txEditFormData.description, txEditFormData.isCapital)
    try {
      await updateTransaction(editingTx.id, {
        type: txEditFormData.type as "income" | "expense",
        description: nextDescription,
        amount: parsedAmount,
        timestamp: txEditFormData.timestamp ? new Date(txEditFormData.timestamp + "T12:00:00").toISOString() : editingTx.timestamp,
      })
      
      setTransactions(transactions.map(t => t.id === editingTx.id ? { ...t, type: txEditFormData.type, description: nextDescription, amount: parsedAmount, timestamp: txEditFormData.timestamp ? new Date(txEditFormData.timestamp + "T12:00:00").toISOString() : t.timestamp } : t))
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
      <ModulePageShell module="rental">
        <div className="space-y-6">
          <div className="h-20 skeleton rounded-[var(--radius-container)]" />
          <SkeletonMetricCards count={5} />
          <SkeletonCharts />
          <SkeletonTable rows={5} />
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell module="rental">
      <ModuleBrandHeader
        module="rental"
        title={
          <>
            Tổng quan{" "}
            <span className="text-blue-600 font-semibold">Cho thuê xe · 3L Moto</span>
          </>
        }
        subtitle="Vận hành đội xe và theo dõi hiệu suất kinh doanh"
        actions={
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-[var(--radius-control)] text-body font-semibold shadow-sm h-11 px-4 ui-transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tạo đơn thuê mới
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Nhóm chỉ số vận hành */}
        <div className="space-y-2.5">
          <ModuleSectionTitle title="Vận hành đội xe" />
          <ModuleKpiGrid columns={6}>
            <RentalKpiCard
              variant="hero"
              label="Tổng xe"
              value={stats.totalVehicles}
              sublabel="trong hệ thống"
              onClick={() => router.push("/dashboard/vehicles")}
            />
            <RentalKpiCard
              variant="hero"
              label="Chờ giao xe"
              value={stats.pendingRentals}
              valueClassName="text-amber-700"
              sublabel="chưa giao xe"
              onClick={() => router.push("/dashboard/orders?status=pending")}
            />
            <RentalKpiCard
              variant="hero"
              label="Xe đang thuê"
              value={stats.activeRentals}
              valueClassName="text-blue-700"
              sublabel="khách đang chạy"
              onClick={() => router.push("/dashboard/orders?status=active")}
            />
            <RentalKpiCard
              variant="hero"
              label="Đơn thuê"
              value={stats.totalRentals}
              sublabel="tổng số đơn"
              onClick={() => router.push("/dashboard/orders")}
            />
            <RentalKpiCard
              variant="hero"
              label={`Đơn tháng ${new Date().getMonth() + 1}`}
              value={thisMonthKpis.ordersCountThisMonth}
              sublabel="đơn hoàn thành"
              onClick={() => router.push("/dashboard/orders")}
            />
            <RentalKpiCard
              variant="hero"
              label="Quá hạn"
              value={stats.overdueRentals}
              valueClassName="text-amber-700"
              sublabel="đơn trễ hạn trả"
              onClick={() => router.push("/dashboard/orders?status=overdue")}
            />
          </ModuleKpiGrid>
        </div>

        {/* Nhóm chỉ số tài chính */}
        <div className="space-y-2.5">
          <ModuleSectionTitle title="Hiệu suất tài chính" />
          <ModuleKpiGrid columns={6}>
            <RentalKpiCard
              variant="hero"
              label="Tổng doanh thu"
              value={formatPrice(stats.totalRevenue)}
              valueClassName="text-emerald-700"
              sublabel="thuê + thu vận hành"
            />
            <RentalKpiCard
              variant="hero"
              label="Tổng lợi nhuận"
              value={formatPrice(stats.totalProfit)}
              valueClassName="text-blue-700"
              sublabel="sau chi vận hành"
            />
            <RentalKpiCard
              variant="hero"
              label={`Doanh thu tháng ${new Date().getMonth() + 1}`}
              value={formatPrice(thisMonthKpis.revenueThisMonth)}
              sublabel={
                thisMonthKpis.commissionThisMonth > 0
                  ? `đã trừ HH Home ${formatPrice(thisMonthKpis.commissionThisMonth)}`
                  : "đơn + thu vận hành"
              }
              valueClassName="text-emerald-700"
            />
            <RentalKpiCard
              variant="hero"
              label={`Lợi nhuận tháng ${new Date().getMonth() + 1}`}
              value={formatPrice(thisMonthKpis.profitThisMonth)}
              sublabel={
                thisMonthKpis.commissionThisMonth > 0
                  ? `sau chi vận hành + HH Home`
                  : "sau chi vận hành"
              }
              valueClassName="text-blue-700"
            />
            <RentalKpiCard
              variant="hero"
              label="Tiền quỹ còn lại"
              value={formatPrice(stats.cashOnHand)}
              valueClassName={stats.cashOnHand >= 0 ? "text-blue-700" : "text-rose-700"}
              sublabel="số dư quỹ tích lũy"
            />
            <RentalKpiCard
              variant="hero"
              label="Tỷ lệ lấp đầy"
              value={`${thisMonthKpis.utilizationPct}%`}
              sublabel="hiệu suất sử dụng xe"
              valueClassName={thisMonthKpis.utilizationPct >= 70 ? "text-emerald-700" : thisMonthKpis.utilizationPct >= 40 ? "text-amber-600" : "text-blue-600"}
            />
          </ModuleKpiGrid>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RentalStatusChart data={rentalStatusChartData} />
          <RentalFleetChart data={rentalFleetChartData} />
          <MonthlyRevenueChart data={monthlyRevenue} formatPrice={formatPrice} />
          <RentalIncomeExpenseChart data={rentalIncomeExpenseChartData} formatPrice={formatPrice} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <OverdueOrdersPanel orders={overdueOrderRows} />
          <CommissionHomeReportPanel
            rows={thisMonthKpis.commissionReport}
            formatPrice={formatPrice}
            periodLabel={`Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}
          />
        </div>

        <ModuleSectionCard
          title="Giao dịch gần đây"
          description="Quản lý các giao dịch thu/chi trong hệ thống"
          filters={
            <ModuleToolbar className="sm:w-auto">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Tìm kiếm giao dịch..."
                  value={txSearchQuery}
                  onChange={(e) => {
                    setTxSearchQuery(e.target.value)
                    setTxCurrentPage(1)
                  }}
                  className={cn(moduleFilterInputClass, "pl-9 focus-visible:ring-blue-500")}
                />
              </div>
              <Button
                onClick={() => setIsAddTxOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-[var(--radius-control)] text-body font-semibold shrink-0 ui-transition"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nhập Thu/Chi
              </Button>
            </ModuleToolbar>
          }
        >
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <ModuleEmptyState
                title="Chưa có giao dịch nào"
                description="Thêm khoản thu hoặc chi để theo dõi dòng tiền vận hành."
              />
            ) : filteredTransactions.length === 0 ? (
              <ModuleEmptyState
                title="Không tìm thấy giao dịch"
                description="Thử đổi từ khóa tìm kiếm."
              />
            ) : (
              <>
                <ModuleResponsiveTable
                  desktop={
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                          <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                          <th className={rentalTableHeadClass}>Loại</th>
                          <th className={rentalTableHeadClass}>Ngày</th>
                          <th className={rentalTableHeadClass}>Mô tả</th>
                          <th className={cn(rentalTableHeadClass, "text-right")}>Số tiền</th>
                          <th className={rentalTableHeadClass}>Người thực hiện</th>
                          {user?.role === "admin" && (
                            <th className={cn(rentalTableHeadClass, "text-center w-24")}>Tác vụ</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                        {paginatedTransactions.map((tx, index) => (
                          <tr key={tx.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 text-center text-sm text-slate-400 font-medium">
                              {(txSafePage - 1) * txItemsPerPage + index + 1}
                            </td>
                            <td className="py-3 px-4">
                              {isDividendTransaction(tx) ? (
                                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border bg-purple-50 text-purple-700 border-purple-100">
                                  Cổ tức
                                </span>
                              ) : isSalaryTransaction(tx) ? (
                                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-100">
                                  Lương NV
                                </span>
                              ) : isCapitalTransaction(tx) ? (
                                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-100">
                                  Vốn/Tài sản
                                </span>
                              ) : (
                                <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border ${
                                  tx.type === "income"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-rose-50 text-rose-700 border-rose-100"
                                }`}>
                                  {getRentalTransactionTypeLabel(tx.type)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-medium">{formatDisplayDate(tx.timestamp || tx.created_at)}</td>
                            <td className="py-3 px-4 text-slate-600">{tx.description}</td>
                            <td className={`py-3 px-4 text-right font-semibold tabular-nums ${
                              tx.type === "income" ? "text-emerald-700" : "text-rose-600"
                            }`}>
                              {tx.type === "income" ? "+" : "-"}{formatPrice(tx.amount)}
                            </td>
                            <td className="py-3 px-4 text-slate-500">{tx.user}</td>
                            {user?.role === "admin" && (
                              <td className="py-3 px-4 text-center">
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => handleEditTx(tx)}
                                    className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded-lg transition"
                                    title="Sửa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTx(tx)}
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition"
                                    title="Xoá"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                  mobile={paginatedTransactions.map((tx, index) => (
                    <ModuleMobileCard key={tx.id}>
                      <div className="flex justify-between items-start gap-2">
                        {isDividendTransaction(tx) ? (
                          <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border bg-purple-50 text-purple-700 border-purple-100">
                            Cổ tức
                          </span>
                        ) : isSalaryTransaction(tx) ? (
                          <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-100">
                            Lương NV
                          </span>
                        ) : isCapitalTransaction(tx) ? (
                          <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-100">
                            Vốn/Tài sản
                          </span>
                        ) : (
                          <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border ${
                            tx.type === "income"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {getRentalTransactionTypeLabel(tx.type)}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">
                          {formatDisplayDate(tx.timestamp || tx.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 my-1">{tx.description}</p>
                      <div className="flex justify-between items-center text-sm">
                        <span className={`font-bold tabular-nums ${tx.type === "income" ? "text-emerald-700" : "text-rose-600"}`}>
                          {tx.type === "income" ? "+" : "-"}{formatPrice(tx.amount)}
                        </span>
                        <span className="text-slate-500 text-xs">bởi {tx.user}</span>
                      </div>
                      {user?.role === "admin" && (
                        <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-slate-100/50">
                          <button
                            onClick={() => handleEditTx(tx)}
                            className="text-slate-500 hover:text-blue-600 p-1 flex items-center gap-1 text-xs font-medium"
                            title="Sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx)}
                            className="text-rose-500 hover:text-rose-600 p-1 flex items-center gap-1 text-xs font-medium"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa
                          </button>
                        </div>
                      )}
                    </ModuleMobileCard>
                  ))}
                />

                <ModulePagination
                  page={txSafePage}
                  totalPages={txTotalPages}
                  totalItems={filteredTransactions.length}
                  itemLabel="giao dịch"
                  onPageChange={setTxCurrentPage}
                  className="bg-slate-50/20 sm:px-6"
                />
              </>
            )}
          </CardContent>
        </ModuleSectionCard>
      </div>

      <Dialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="md">
          <EntityFormHeader
            title="Thêm Khoản Thu/Chi"
            description="Nhập thông tin khoản thu hoặc chi"
          />
          <form onSubmit={handleAddTx}>
            <EntityFormBody>
              <div>
                <Label className="text-slate-700 text-sm font-medium">Loại</Label>
                <Select value={txFormData.type} onValueChange={(val) => setTxFormData({ ...txFormData, type: val as "income" | "expense" })}>
                  <SelectTrigger className="border-slate-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="income">Thu</SelectItem>
                    <SelectItem value="expense">Chi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-medium">Phân loại khoản</Label>
                <Select
                  value={txFormData.isCapital ? "capital" : "operating"}
                  onValueChange={(val) => setTxFormData({ ...txFormData, isCapital: val === "capital" })}
                >
                  <SelectTrigger className="border-slate-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="operating">Vận hành (tính vào lợi nhuận)</SelectItem>
                    <SelectItem value="capital">Vốn / mua tài sản (không tính LN)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">Ví dụ vốn: góp vốn, mua xe, mũ, định vị. Không làm lệch doanh thu/lợi nhuận.</p>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-medium">Mô Tả</Label>
                <Input
                  placeholder="Nhập mô tả (ví dụ: mua định vị, sửa xe)"
                  value={txFormData.description}
                  onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                  className="border-slate-300 rounded-lg"
                />
              </div>
               <div>
                 <Label className="text-slate-700 text-sm font-medium">Ngày Giao Dịch</Label>
                 <Input
                   type="date"
                   value={txFormData.timestamp}
                   onChange={(e) => setTxFormData({ ...txFormData, timestamp: e.target.value })}
                   className="border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                 />
               </div>
               <div>
                 <Label className="text-slate-700 text-sm font-medium">Số Tiền (VND)</Label>
                 <Input
                   type="text"
                   placeholder="Nhập số tiền (VD: 1.000.000)"
                   value={txFormData.amount}
                   onChange={(e) => {
                     const formatted = formatMoneyInput(e.target.value)
                     setTxFormData({ ...txFormData, amount: formatted })
                   }}
                   className="border-slate-300 rounded-lg font-mono"
                 />
               </div>
             </EntityFormBody>
            <EntityFormFooter
              accent="blue"
              onCancel={() => setIsAddTxOpen(false)}
              submitLabel="Thêm"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      {/* ── Transaction Confirm Delete Dialog ── */}
      <Dialog open={txDeleteConfirmOpen} onOpenChange={setTxDeleteConfirmOpen}>
        <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-slate-600 mt-2 text-body">
              Bạn có chắc chắn muốn xoá khoản {txToDelete?.type === "income" ? "THU" : "CHI"}{" "}
              <span className="font-semibold text-slate-800">&ldquo;{txToDelete?.description}&rdquo;</span> không?
              <p className="text-meta text-rose-600 mt-2">Số tiền: {txToDelete?.amount.toLocaleString("vi-VN")} đ</p>
              <p className="text-meta text-rose-600">Nhập bởi: {txToDelete?.user}</p>
              <p className="text-meta text-rose-600">Hành động này không thể hoàn tác.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setTxDeleteConfirmOpen(false)
                setTxToDelete(null)
              }}
              className="border-slate-300 rounded-[var(--radius-control)]"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDeleteTx}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-[var(--radius-control)]"
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Transaction Edit Dialog ── */}
      <Dialog open={isEditTxOpen} onOpenChange={setIsEditTxOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="md">
          <EntityFormHeader
            title="Sửa Khoản Thu/Chi"
            description="Cập nhật thông tin khoản thu/chi"
          />
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmEditTx(); }}>
            <EntityFormBody>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Loại</Label>
              <Select value={txEditFormData.type} onValueChange={(val) => setTxEditFormData({...txEditFormData, type: val as "income" | "expense"})}>
                <SelectTrigger className="border-slate-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="income">Thu</SelectItem>
                  <SelectItem value="expense">Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Phân loại khoản</Label>
              <Select
                value={txEditFormData.isCapital ? "capital" : "operating"}
                onValueChange={(val) => setTxEditFormData({ ...txEditFormData, isCapital: val === "capital" })}
              >
                <SelectTrigger className="border-slate-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="operating">Vận hành (tính vào lợi nhuận)</SelectItem>
                  <SelectItem value="capital">Vốn / mua tài sản (không tính LN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Mô Tả</Label>
              <Input
                placeholder="Nhập mô tả"
                value={txEditFormData.description}
                onChange={(e) => setTxEditFormData({...txEditFormData, description: e.target.value})}
                className="border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Ngày Giao Dịch</Label>
              <Input
                type="date"
                value={txEditFormData.timestamp}
                onChange={(e) => setTxEditFormData({ ...txEditFormData, timestamp: e.target.value })}
                className="border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Số Tiền (VND)</Label>
              <Input
                type="text"
                placeholder="Nhập số tiền (VD: 1.000.000)"
                value={txEditFormData.amount}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setTxEditFormData({...txEditFormData, amount: formatted})
                }}
                className="border-slate-300 rounded-lg font-mono"
              />
            </div>
            </EntityFormBody>
            <EntityFormFooter
              accent="blue"
              onCancel={() => setIsEditTxOpen(false)}
              submitLabel="Cập nhật"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      {/* ── Create Order Dialog ── */}
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
                        ℹ️ <strong>Khách mới:</strong> Điền đầy đủ thông tin bắt buộc (*) để tạo hồ sơ khách hàng
                      </EntityFormInfoBox>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Tên khách hàng <span className="text-rose-500">*</span></Label>
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
                        <Label className="text-slate-600 text-sm">Số điện thoại <span className="text-rose-500">*</span></Label>
                        <Input
                          placeholder="Nhập số điện thoại..."
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Địa chỉ khách <span className="text-rose-500">*</span></Label>
                        <Input
                          placeholder="Nhập địa chỉ..."
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                          required={isNewCustomer}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Số CCCD khách (tùy chọn)</Label>
                        <Input
                          placeholder="Nhập số CCCD..."
                          value={newCustomerCCCD}
                          onChange={(e) => setNewCustomerCCCD(e.target.value)}
                          className="bg-white border-slate-200 rounded-xl h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-slate-600 text-sm">Ảnh CCCD (tùy chọn)</Label>
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
                    <Label htmlFor="vehicle" className="text-slate-600 text-sm">Chọn xe thuê <span className="text-rose-500">*</span></Label>
                    
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

                <EntityFormSection title="📋 3. Chi tiết hợp đồng thuê" description="Nhập ngày thuê, thời hạn và tiền đặt cọc">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="startDate" className="text-slate-600 text-sm">Ngày bắt đầu</Label>
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
                      <Label htmlFor="endDate" className="text-slate-600 text-sm">Ngày kết thúc</Label>
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
                    <Label htmlFor="deposit" className="text-slate-600 text-sm">Tiền đặt cọc (VND)</Label>
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
    </ModulePageShell>
  )
}
