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
  CalendarCheck,
  Bell,
  Bike,
  Upload,
} from "lucide-react"
import { DailySummaryDialog } from "@/components/dashboard/daily-summary-dialog"
import { DailyNotificationModal } from "@/components/dashboard/daily-notification-modal"
import { SkeletonMetricCards, SkeletonTable, SkeletonCharts } from "@/components/ui/skeleton-loader"
import { MonthlyRevenueChart, RentalStatusChart, RentalFleetChart, RentalIncomeExpenseChart } from "@/components/dashboard/rental-charts"
import { OverdueOrdersPanel, CommissionHomeReportPanel } from "@/components/dashboard/rental-overview-panels"
import { TodayHandoverSchedule } from "@/components/dashboard/today-handover-schedule"
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
  EntityFormField,
  entityFormInputClass,
} from "@/components/dashboard/entity-form-dialog"
import { fetchVehicles, fetchRentals, fetchTransactions, fetchCustomers, fetchUserDisplayNames, getUserDisplayName, insertCustomer, insertTransaction, deleteTransaction, updateTransaction, supabase } from "@/lib/supabase"
import { uploadImage } from "@/lib/storage"
import { Input } from "@/components/ui/input"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { formatDisplayDate, parseDisplayDate, toStoredDateValue } from "@/lib/format-date"
import { calcOperatingProfit, calcOperatingRevenue, isCapitalTransaction, withCapitalTag, isSalaryTransaction, isDividendTransaction } from "@/lib/transaction-finance"
import { buildCommissionHomeReport, sumCommissionRows } from "@/lib/commission-home"
import { Textarea } from "@/components/ui/textarea"
import { buildRentalTermPayload } from "@/lib/rental-term"
import { extractRentalTimes, embedRentalTimes } from "@/lib/vehicle-timeline"
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
  const [isDailySummaryOpen, setIsDailySummaryOpen] = useState(false)
  const [isDailyNotificationOpen, setIsDailyNotificationOpen] = useState(false)
  const [hasCheckedDailyNotification, setHasCheckedDailyNotification] = useState(false)

  // Auto-open daily notification popup on first load/login of the day
  useEffect(() => {
    if (orders.length === 0 || hasCheckedDailyNotification) return

    const todayStr = new Date().toISOString().split('T')[0]
    const lastCheckDate = typeof window !== "undefined" ? localStorage.getItem("daily_notification_last_date") : null

    if (lastCheckDate !== todayStr) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const in2DaysEnd = new Date(today)
      in2DaysEnd.setDate(today.getDate() + 2)
      in2DaysEnd.setHours(23, 59, 59, 999)

      const overdueCount = orders.filter((o) => {
        if (o.status !== "active") return false
        const end = parseDisplayDate(o.endDate)
        if (!end) return false
        end.setHours(0, 0, 0, 0)
        return end < today
      }).length

      const upcomingCount = orders.filter((o) => {
        if (o.status !== "pending") return false
        const start = parseDisplayDate(o.startDate)
        if (!start) return false
        start.setHours(0, 0, 0, 0)
        return start >= today && start <= in2DaysEnd
      }).length

      if (overdueCount > 0 || upcomingCount > 0) {
        setIsDailyNotificationOpen(true)
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("daily_notification_last_date", todayStr)
      }
    }

    setHasCheckedDailyNotification(true)
  }, [orders, hasCheckedDailyNotification])

  // Count total pending & overdue items for badge
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
    pickupTime: "08:00",
    returnTime: "12:00",
    deposit: "0",
    notes: "",
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
    setFormData({ customerId: "", vehicleIds: [], startDate: "", endDate: "", pickupTime: "08:00", returnTime: "12:00", deposit: "0", notes: "", commissionHome: "", homeName: "" })
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
    setUnassignedQuantity("1")
    setUnassignedPricePerDay("120.000")
    setDeferVehicleAssign(false)
    setIsDialogOpen(false)
  }

  const [unassignedQuantity, setUnassignedQuantity] = useState("1")
  const [unassignedPricePerDay, setUnassignedPricePerDay] = useState("120.000")
  const [deferVehicleAssign, setDeferVehicleAssign] = useState(false)

  useEffect(() => {
    if (!isDialogOpen) {
      setDeferVehicleAssign(false)
      setUnassignedQuantity("1")
      setUnassignedPricePerDay("120.000")
    }
  }, [isDialogOpen])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const selectedVehicles = vehicles.filter((v) => formData.vehicleIds.includes(v.id))
    if (!deferVehicleAssign && selectedVehicles.length === 0) {
      alert("⚠️ Chọn xe thuê hoặc tích “Chưa chọn gán xe”.")
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

      // Split deposit and commission equally among target vehicles
      const totalDeposit = parseMoneyInput(formData.deposit) || 0
      const dividedDeposit = Math.round(totalDeposit / targetVehicles.length)

      const totalCommission = hasCommission ? (parseMoneyInput(formData.commissionHome) || 0) : 0
      const dividedCommission = Math.round(totalCommission / targetVehicles.length)

      const homeNameVal = hasCommission ? formData.homeName.trim() : ""
      const rawNotes = formData.notes ? formData.notes.trim() : ""
      const notesWithTime = embedRentalTimes(rawNotes, formData.pickupTime || "08:00", formData.returnTime || "12:00")

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
          notes: notesWithTime,
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
          notes: buildRentalTermPayload("short", notesWithTime).notes
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
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({})
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
      const displayNames = isDemoAccount ? {} : await fetchUserDisplayNames()
      if (user?.username) {
        const key = user.username.toLowerCase()
        displayNames[key] = user.displayName || displayNames[key] || user.username
      }
      setCustomers(customersData)
      setUserDisplayNames(displayNames)

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
      { name: "Chờ giao xe", value: orders.filter((o) => o.status === "pending").length },
      { name: "Đang thuê", value: active },
      { name: "Quá hạn", value: overdue },
      { name: "Hoàn thành", value: orders.filter((o) => o.status === "completed").length },
      { name: "Đã hủy", value: orders.filter((o) => o.status === "cancelled").length },
    ]
  }, [orders])

  const rentalFleetChartData = useMemo(() => [
    { name: "Sẵn sàng", value: vehicles.filter((v) => v.status === "available").length },
    { name: "Chờ giao", value: vehicles.filter((v) => v.status === "pending").length },
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
        const matchUser = getUserDisplayName(tx.user, userDisplayNames).toLowerCase().includes(query) ||
          (tx.user || "").toLowerCase().includes(query)
        const matchAmount = String(tx.amount || "").includes(query)
        const matchType = (tx.type === "income" ? "thu" : "chi").includes(query)

        return matchDescription || matchUser || matchAmount || matchType
      })
      .sort((a, b) => new Date(b.timestamp || b.created_at || 0).getTime() - new Date(a.timestamp || a.created_at || 0).getTime())
  }, [transactions, txSearchQuery, userDisplayNames])

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
            <span className="hidden sm:inline text-blue-600 font-semibold">Cho thuê xe · 3L Moto</span>
          </>
        }
        subtitle="Vận hành đội xe và theo dõi hiệu suất kinh doanh"
        actions={
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-center md:gap-2.5">
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="col-span-2 md:col-span-1 bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white rounded-[var(--radius-control)] text-body font-semibold shadow-sm h-11 px-4 ui-transition [&_svg]:!text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="sm:hidden">Tạo đơn</span>
              <span className="hidden sm:inline">Tạo đơn thuê mới</span>
            </Button>
            <Button
              onClick={() => setIsDailyNotificationOpen(true)}
              variant="outline"
              className="min-w-0 bg-white hover:bg-slate-50 text-slate-700 border-slate-300 rounded-[var(--radius-control)] text-body font-semibold shadow-sm h-11 px-3 ui-transition [&_svg]:text-amber-500 hover:border-slate-400 relative"
            >
              <Bell className="w-4 h-4 mr-1.5 shrink-0 text-amber-500" />
              <span className="truncate">Thông báo</span>
              {dailyNotifyBadgeCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white leading-none shrink-0">
                  {dailyNotifyBadgeCount}
                </span>
              )}
            </Button>
            <Button
              onClick={() => setIsDailySummaryOpen(true)}
              variant="outline"
              className="min-w-0 bg-white hover:bg-slate-50 text-slate-700 border-slate-300 rounded-[var(--radius-control)] text-body font-semibold shadow-sm h-11 px-3 ui-transition [&_svg]:text-blue-600 hover:border-slate-400"
            >
              <CalendarCheck className="w-4 h-4 mr-1.5 shrink-0 text-blue-600" />
              <span className="truncate">Tổng ngày</span>
            </Button>
          </div>
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
              valueClassName="text-rose-600"
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
              valueClassName="text-slate-900"
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
              valueClassName="text-slate-900"
            />
            <RentalKpiCard
              variant="hero"
              label="Tiền quỹ còn lại"
              value={formatPrice(stats.cashOnHand)}
              valueClassName={stats.cashOnHand >= 0 ? "text-slate-900" : "text-rose-700"}
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

        {/* Lịch trình Giao & Thu hồi xe hôm nay theo giờ */}
        <TodayHandoverSchedule
          orders={orders}
          vehicles={vehicles}
          customers={customers}
          onDeliverOrder={() => router.push("/dashboard/orders")}
          onCompleteOrder={() => router.push("/dashboard/orders")}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 min-w-0">
            <MonthlyRevenueChart data={monthlyRevenue} formatPrice={formatPrice} />
          </div>
          <div className="lg:col-span-5 min-w-0">
            <RentalStatusChart data={rentalStatusChartData} />
          </div>
          <div className="lg:col-span-7 min-w-0">
            <RentalIncomeExpenseChart data={rentalIncomeExpenseChartData} formatPrice={formatPrice} />
          </div>
          <div className="lg:col-span-5 min-w-0">
            <RentalFleetChart data={rentalFleetChartData} />
          </div>
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
                className="bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white h-11 rounded-[var(--radius-control)] text-body font-semibold shrink-0 ui-transition [&_svg]:!text-white"
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
                                <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-700 border-slate-200">
                                  Cổ tức
                                </span>
                              ) : isSalaryTransaction(tx) ? (
                                <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-600 border-slate-200">
                                  Lương NV
                                </span>
                              ) : isCapitalTransaction(tx) ? (
                                <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-amber-50 text-amber-700 border-amber-100">
                                  Vốn/Tài sản
                                </span>
                              ) : (
                                <span className={`inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border ${
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
                            <td className="py-3 px-4 text-slate-500">{getUserDisplayName(tx.user, userDisplayNames)}</td>
                            {user?.role === "admin" && (
                              <td className="py-3 px-4 text-center">
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => handleEditTx(tx)}
                                    className="h-9 w-9 inline-flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-[var(--radius-control)] transition"
                                    title="Sửa"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTx(tx)}
                                    className="h-9 w-9 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-control)] transition"
                                    title="Xoá"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
                          <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-700 border-slate-200">
                            Cổ tức
                          </span>
                        ) : isSalaryTransaction(tx) ? (
                          <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-600 border-slate-200">
                            Lương NV
                          </span>
                        ) : isCapitalTransaction(tx) ? (
                          <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-amber-50 text-amber-700 border-amber-100">
                            Vốn/Tài sản
                          </span>
                        ) : (
                          <span className={`inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border ${
                            tx.type === "income"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {getRentalTransactionTypeLabel(tx.type)}
                          </span>
                        )}
                        <span className="text-meta text-slate-400 font-medium">
                          {formatDisplayDate(tx.timestamp || tx.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 my-1">{tx.description}</p>
                      <div className="flex justify-between items-center text-sm">
                        <span className={`font-bold tabular-nums ${tx.type === "income" ? "text-emerald-700" : "text-rose-600"}`}>
                          {tx.type === "income" ? "+" : "-"}{formatPrice(tx.amount)}
                        </span>
                        <span className="text-meta text-slate-500">bởi {getUserDisplayName(tx.user, userDisplayNames)}</span>
                      </div>
                      {user?.role === "admin" && (
                        <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-slate-100/50">
                          <button
                            onClick={() => handleEditTx(tx)}
                            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-meta font-medium rounded-[var(--radius-control)]"
                            title="Sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx)}
                            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-rose-500 hover:text-rose-600 text-meta font-medium rounded-[var(--radius-control)]"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
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
        <EntityFormDialogContent accent={txFormData.type === "income" ? "emerald" : "red"} maxWidth="lg">
          <EntityFormHeader
            title="Thêm khoản thu/chi"
            description="Khoản ngoài đơn thuê — vận hành hoặc vốn"
          />
          <form onSubmit={handleAddTx}>
            <EntityFormBody>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-title truncate">{txFormData.description.trim() || "Khoản mới"}</p>
                  <p className="text-meta">
                    {txFormData.type === "income" ? "Thu" : "Chi"}
                    {" · "}
                    {txFormData.isCapital ? "Vốn / tài sản" : "Vận hành"}
                  </p>
                </div>
                <p className={cn(
                  "text-body font-semibold money tabular-nums shrink-0",
                  txFormData.type === "income" ? "text-emerald-700" : "text-rose-700"
                )}>
                  {txFormData.amount ? `${txFormData.type === "income" ? "+" : "-"}${txFormData.amount} đ` : "—"}
                </p>
              </div>
              <EntityFormField label="Loại">
                <EntityFormToggle
                  value={txFormData.type}
                  onChange={(val) => setTxFormData({ ...txFormData, type: val as "income" | "expense" })}
                  options={[
                    { value: "income", label: "Thu" },
                    { value: "expense", label: "Chi" },
                  ]}
                />
              </EntityFormField>
              <EntityFormField label="Phân loại">
                <EntityFormToggle
                  value={txFormData.isCapital ? "capital" : "operating"}
                  onChange={(val) => setTxFormData({ ...txFormData, isCapital: val === "capital" })}
                  options={[
                    { value: "operating", label: "Vận hành" },
                    { value: "capital", label: "Vốn" },
                  ]}
                />
                <p className="text-meta mt-1.5">
                  {txFormData.isCapital ? "Không tính vào lợi nhuận (góp vốn, mua xe, tài sản)." : "Tính vào lợi nhuận vận hành."}
                </p>
              </EntityFormField>
              <EntityFormField label="Mô tả" required>
                <Input
                  placeholder="Sửa xe, mua định vị..."
                  value={txFormData.description}
                  onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                  className={entityFormInputClass}
                />
              </EntityFormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EntityFormField label="Ngày giao dịch">
                  <Input
                    type="date"
                    value={txFormData.timestamp}
                    onChange={(e) => setTxFormData({ ...txFormData, timestamp: e.target.value })}
                    className={entityFormInputClass}
                  />
                </EntityFormField>
                <EntityFormField label="Số tiền" required>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={txFormData.amount}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setTxFormData({ ...txFormData, amount: formatted })
                    }}
                    className={cn(entityFormInputClass, "font-mono")}
                  />
                </EntityFormField>
              </div>
            </EntityFormBody>
            <EntityFormFooter
              accent={txFormData.type === "income" ? "emerald" : "red"}
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
        <EntityFormDialogContent accent={txEditFormData.type === "income" ? "emerald" : "red"} maxWidth="lg">
          <EntityFormHeader
            title="Sửa khoản thu/chi"
            description="Cập nhật loại, ngày và số tiền"
          />
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmEditTx(); }}>
            <EntityFormBody>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-title truncate">{txEditFormData.description.trim() || "Chưa có mô tả"}</p>
                  <p className="text-meta">
                    {txEditFormData.type === "income" ? "Thu" : "Chi"}
                    {" · "}
                    {txEditFormData.isCapital ? "Vốn / tài sản" : "Vận hành"}
                  </p>
                </div>
                <p className={cn(
                  "text-body font-semibold money tabular-nums shrink-0",
                  txEditFormData.type === "income" ? "text-emerald-700" : "text-rose-700"
                )}>
                  {txEditFormData.amount ? `${txEditFormData.type === "income" ? "+" : "-"}${txEditFormData.amount} đ` : "—"}
                </p>
              </div>
              <EntityFormField label="Loại">
                <EntityFormToggle
                  value={txEditFormData.type}
                  onChange={(val) => setTxEditFormData({ ...txEditFormData, type: val as "income" | "expense" })}
                  options={[
                    { value: "income", label: "Thu" },
                    { value: "expense", label: "Chi" },
                  ]}
                />
              </EntityFormField>
              <EntityFormField label="Phân loại">
                <EntityFormToggle
                  value={txEditFormData.isCapital ? "capital" : "operating"}
                  onChange={(val) => setTxEditFormData({ ...txEditFormData, isCapital: val === "capital" })}
                  options={[
                    { value: "operating", label: "Vận hành" },
                    { value: "capital", label: "Vốn" },
                  ]}
                />
                <p className="text-meta mt-1.5">
                  {txEditFormData.isCapital ? "Không tính vào lợi nhuận (góp vốn, mua xe, tài sản)." : "Tính vào lợi nhuận vận hành."}
                </p>
              </EntityFormField>
              <EntityFormField label="Mô tả" required>
                <Input
                  placeholder="Sửa xe, mua định vị..."
                  value={txEditFormData.description}
                  onChange={(e) => setTxEditFormData({...txEditFormData, description: e.target.value})}
                  className={entityFormInputClass}
                />
              </EntityFormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EntityFormField label="Ngày giao dịch">
                  <Input
                    type="date"
                    value={txEditFormData.timestamp}
                    onChange={(e) => setTxEditFormData({ ...txEditFormData, timestamp: e.target.value })}
                    className={entityFormInputClass}
                  />
                </EntityFormField>
                <EntityFormField label="Số tiền" required>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={txEditFormData.amount}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setTxEditFormData({...txEditFormData, amount: formatted})
                    }}
                    className={cn(entityFormInputClass, "font-mono")}
                  />
                </EntityFormField>
              </div>
            </EntityFormBody>
            <EntityFormFooter
              accent={txEditFormData.type === "income" ? "emerald" : "red"}
              onCancel={() => setIsEditTxOpen(false)}
              submitLabel="Cập nhật"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      {/* ── Create Order Dialog ── */}
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
                      ? ` · ${formData.pickupTime || "08:00"} ${formData.startDate} → ${formData.returnTime || "12:00"} ${formData.endDate}`
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
                        {[
                          { label: "Ảnh khách", file: newCustomerPhoto, set: setNewCustomerPhoto },
                          { label: "CCCD mặt trước", file: newCustomerCCCDFront, set: setNewCustomerCCCDFront },
                        ].map((slot) => (
                          <div key={slot.label} className="space-y-1.5 min-w-0">
                            <p className="text-label">{slot.label}</p>
                            <div className={cn(
                              "relative aspect-[4/3] overflow-hidden rounded-[var(--radius-control)]",
                              slot.file ? "border border-slate-200" : "border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50"
                            )}>
                              <div className="flex h-full flex-col items-center justify-center gap-1 px-2">
                                <Upload className="h-5 w-5 text-slate-400" />
                                <span className="text-meta text-center truncate w-full px-1">{slot.file ? slot.file.name : "Thêm ảnh"}</span>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                onClick={markPickingFile}
                                onChange={(e) => {
                                  slot.set(e.target.files?.[0] || null)
                                  e.target.value = ""
                                }}
                              />
                            </div>
                          </div>
                        ))}
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
                        <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-[var(--radius-control)] shadow-lg max-h-60 overflow-y-auto mt-1">
                          {filteredVehiclesForSelect.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500 text-center">Không có xe khả dụng</div>
                          ) : (
                            filteredVehiclesForSelect.map((vehicle) => (
                              <div
                                key={vehicle.id}
                                onClick={() => {
                                  setDeferVehicleAssign(false)
                                  setFormData(prev => ({
                                    ...prev,
                                    vehicleIds: [...prev.vehicleIds, vehicle.id]
                                  }))
                                  setVehicleSearch("")
                                  setShowVehicleDropdown(false)
                                }}
                                className="p-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer ui-transition border-b border-slate-50 last:border-0"
                              >
                                <span className="font-semibold">{vehicle.name}</span>
                                {" · "}
                                <span className="font-mono">{vehicle.licensePlate}</span>
                                <span className="text-slate-500"> · {vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày</span>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </EntityFormSection>

                <EntityFormSection title="Hợp đồng" description="Thời gian thuê và tiền cọc">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <EntityFormField label="Ngày & Giờ nhận xe" required>
                      <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-7 text-xs sm:text-sm px-2 sm:px-3")}
                          required
                        />
                        <Input
                          id="pickupTime"
                          type="time"
                          value={formData.pickupTime}
                          onChange={(e) => setFormData({ ...formData, pickupTime: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-5 font-mono text-xs text-center px-1")}
                          title="Giờ nhận xe"
                        />
                      </div>
                    </EntityFormField>
                    <EntityFormField label="Ngày & Giờ trả xe" required>
                      <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-7 text-xs sm:text-sm px-2 sm:px-3")}
                          required
                        />
                        <Input
                          id="returnTime"
                          type="time"
                          value={formData.returnTime}
                          onChange={(e) => setFormData({ ...formData, returnTime: e.target.value })}
                          className={cn(entityFormInputClass, "col-span-5 font-mono text-xs text-center px-1")}
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

      <DailySummaryDialog
        isOpen={isDailySummaryOpen}
        onClose={() => setIsDailySummaryOpen(false)}
        orders={orders}
        vehicles={vehicles}
        transactions={transactions}
      />

      <DailyNotificationModal
        isOpen={isDailyNotificationOpen}
        onClose={() => setIsDailyNotificationOpen(false)}
        orders={orders}
        vehicles={vehicles}
      />
    </ModulePageShell>
  )
}
