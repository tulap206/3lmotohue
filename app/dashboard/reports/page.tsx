"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchTransactions, insertTransaction, deleteTransaction, updateTransaction, Transaction } from "@/lib/supabase"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { calcOperatingProfit, calcOperatingRevenue, isCapitalTransaction, withCapitalTag, isSalaryTransaction, isDividendTransaction } from "@/lib/transaction-finance"
import { buildCommissionHomeReport, sumCommissionRows, type CommissionHomeRow } from "@/lib/commission-home"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { TrendingUp, Bike, Users, ClipboardList, DollarSign, Wallet, Plus, Trash2, Edit2, Search, X } from "lucide-react"
import { ModulePagination, ModulePageShell, ModuleSubpageHeader } from "@/components/dashboard/module-shell"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface ReportData {
  totalCustomers: number
  totalVehicles: number
  totalRentals: number
  totalRevenue: number
  totalProfit: number
  activeRentals: number
  vehiclesInMaintenance: number
  monthlyRevenue: Array<{ month: string; revenue: number }>
  topVehicles: Array<{ name: string; rentals: number; revenue: number }>
  /** Tổng HH Home đã trừ trong DT (đơn completed) */
  commissionHomeTotal: number
  commissionByHome: CommissionHomeRow[]
}

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: string
  current_km: number
  purchasePrice: number
  notes: string
  totalRentalDays: number
  totalRevenue: number
  profit: number
}

export default function ReportsPage() {
  const router = useRouter()
  const { addAccessLog, user } = useAuth()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
    isCapital: false,
    timestamp: new Date().toLocaleDateString('en-CA'),
  })
  const [editFormData, setEditFormData] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
    isCapital: false,
    timestamp: "",
  })

  const loadTransactions = async (resetPage = true) => {
    try {
      const data = await fetchTransactions()
      setTransactions(data)
      if (resetPage) setCurrentPage(1) // Reset to first page only when requested
      console.log("✅ Loaded transactions from Supabase:", data.length)
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
      setTransactions([])
    }
  }

  useEffect(() => {
    loadReportData(true)
    loadTransactions(true)

    // Subscribe to real-time events for reports/transactions
    const reportsChannel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(reportsChannel)
    }
  }, [])

  // Pagination calculations with search filter
  const filteredTransactions = transactions.filter((tx) => {
    const query = searchQuery.toLowerCase()
    return (
      tx.description.toLowerCase().includes(query) ||
      tx.user.toLowerCase().includes(query) ||
      tx.amount.toString().includes(query) ||
      tx.type.toLowerCase().includes(query)
    )
  })

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("📝 Adding transaction:", formData)
    
    if (!formData.description) {
      return
    }
    if (!formData.amount) {
      return
    }
    if (!user) {
      return
    }

    try {
       const newTransaction = await insertTransaction({
        type: formData.type,
        description: withCapitalTag(formData.description, formData.isCapital),
        amount: parseMoneyInput(formData.amount),
        user: user.username,
        timestamp: formData.timestamp ? new Date(formData.timestamp + "T12:00:00").toISOString() : new Date().toISOString(),
      })
      
      console.log("✅ Transaction saved to Supabase:", newTransaction)
      
      setTransactions([newTransaction, ...transactions])
      setFormData({ type: "income", description: "", amount: "", isCapital: false, timestamp: new Date().toLocaleDateString('en-CA') })
      setIsAddTransactionOpen(false)
      
      // Log action if user exists
      if (user?.username) {
        try {
          addAccessLog("Thêm", "Thu/Chi", `${formData.type === "income" ? "Thu" : "Chi"}: ${formData.description}`)
        } catch (logError) {
          console.error("Warning: Could not log action", logError)
        }
      }
    } catch (error) {
      console.error("❌ Error adding transaction:", error)
    }
  }

  const handleDeleteTransaction = (tx: Transaction) => {
    // Only admin can delete
    if (user?.role !== 'admin') {
      alert('❌ Chỉ admin có quyền xoá khoản thu/chi')
      return
    }
    setTransactionToDelete(tx)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return
    
    try {
      await deleteTransaction(transactionToDelete.id)
      
      // Reload transactions from Supabase
      await loadTransactions()
      
      setDeleteConfirmOpen(false)
      setTransactionToDelete(null)
      addAccessLog("Xoá", "Thu/Chi", `Xoá: ${transactionToDelete.description}`)
    } catch (error) {
      console.error("Error deleting transaction:", error)
    }
  }

  const handleEditTransaction = (tx: Transaction) => {
    // Only admin can edit
    if (user?.role !== 'admin') {
      alert('❌ Chỉ admin có quyền sửa khoản thu/chi')
      return
    }
    setEditingTransaction(tx)
    setEditFormData({
      type: tx.type,
      description: (tx.description || "").replace(/^\s*\[vốn\]\s*/i, ""),
      amount: tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      isCapital: isCapitalTransaction(tx),
      timestamp: new Date(tx.timestamp || tx.created_at || new Date()).toLocaleDateString('en-CA'),
    })
    setIsEditTransactionOpen(true)
  }

  const handleConfirmEdit = async () => {
    if (!editingTransaction || !editFormData.description || !editFormData.amount) {
      console.error("❌ Validation failed:", { editingTransaction, editFormData })
      return
    }
    
    const parsedAmount = parseMoneyInput(editFormData.amount)
    const nextDescription = withCapitalTag(editFormData.description, editFormData.isCapital)
    
    console.log("📝 Updating transaction:", editingTransaction.id, {
      type: editFormData.type,
      description: nextDescription,
      amount: parsedAmount,
    })
    
    try {
      await updateTransaction(editingTransaction.id, {
        type: editFormData.type as "income" | "expense",
        description: nextDescription,
        amount: parsedAmount,
        timestamp: editFormData.timestamp ? new Date(editFormData.timestamp + "T12:00:00").toISOString() : editingTransaction.timestamp,
      })
      
      // Reload transactions from Supabase
      await loadTransactions()
      
      setIsEditTransactionOpen(false)
      setEditingTransaction(null)
      addAccessLog("Sửa", "Thu/Chi", `Sửa: ${editFormData.description}`)
      
      console.log("✅ Edit completed successfully")
    } catch (error) {
      console.error("❌ Error updating transaction:", error)
    }
  }

  const loadReportData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      console.log("📊 Loading report data...")

      // Fetch from Supabase
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
      
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("*")
      
      const { data: rentalsData, error: rentalsError } = await supabase
        .from("rentals")
        .select("*")

      // Handle errors
      if (customersError) console.error("Customers error:", customersError)
      if (vehiclesError) console.error("Vehicles error:", vehiclesError)
      if (rentalsError) console.error("Rentals error:", rentalsError)

      const customers = customersData || []
      const vehicles = vehiclesData || []
      const rentals = rentalsData || []

      console.log("📊 Fetched data:", {
        customers: customers.length,
        vehicles: vehicles.length,
        rentals: rentals.length,
      })

      // Calculate statistics
      const totalCustomers = customers.length || 0
      const totalVehicles = vehicles.length || 0
      const totalRentals = rentals.length || 0

      // Rental revenue (completed orders; prefer revenue field)
      const rentalRevenue = rentals
        .filter((r: any) => r.status === "completed")
        .reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
      
      // P&L vận hành: bỏ qua góp vốn / mua xe
      const totalRevenue = calcOperatingRevenue(rentalRevenue, transactions)
      const totalProfit = calcOperatingProfit(rentalRevenue, transactions)
      
      const totalIncomeFromTransactions = transactions
        .filter((tx: any) => tx.type === 'income')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      const totalExpenseFromTransactions = transactions
        .filter((tx: any) => tx.type === 'expense')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      // Active rentals = pending status
      const activeRentals = rentals.filter((r: any) => r.status === "pending").length
      
      // Vehicles in maintenance
      const vehiclesInMaintenance = vehicles.filter((v: any) => v.status === "maintenance").length

      console.log("💰 Calculations:", { 
        rentalRevenue, 
        totalIncomeFromTransactions,
        totalExpenseFromTransactions,
        totalRevenue, 
        totalProfit, 
        activeRentals, 
        totalCustomers, 
        totalVehicles, 
        totalRentals 
      })

      // Monthly data
      const monthlyData: Record<string, number> = {}
      
      // Helper to parse DD/MM/YYYY format
      const parseVietnamDate = (dateStr: string): Date => {
        if (!dateStr) return new Date(0)
        const parts = dateStr.split("/")
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      }
      
      rentals.forEach((rental: any) => {
        if (rental.status !== "completed") return
        const dateStr = rental.endDate || rental.startDate
        if (!dateStr) return
        const date = parseVietnamDate(dateStr)
        if (isNaN(date.getTime())) return
        const monthKey = `T${date.getMonth() + 1}`
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (rental.revenue || rental.totalPrice || 0)
      })

      const monthlyRevenue = [
        { month: "T1", revenue: monthlyData["T1"] || 0 },
        { month: "T2", revenue: monthlyData["T2"] || 0 },
        { month: "T3", revenue: monthlyData["T3"] || 0 },
        { month: "T4", revenue: monthlyData["T4"] || 0 },
        { month: "T5", revenue: monthlyData["T5"] || 0 },
        { month: "T6", revenue: monthlyData["T6"] || 0 },
        { month: "T7", revenue: monthlyData["T7"] || 0 },
        { month: "T8", revenue: monthlyData["T8"] || 0 },
        { month: "T9", revenue: monthlyData["T9"] || 0 },
        { month: "T10", revenue: monthlyData["T10"] || 0 },
        { month: "T11", revenue: monthlyData["T11"] || 0 },
        { month: "T12", revenue: monthlyData["T12"] || 0 },
      ]

      // Top vehicles - calculate from rentals
      const vehiclesWithStats = vehicles.map((v: any) => {
        const vehicleRentals = rentals.filter((r: any) => r.vehicleId === v.id && r.status === 'completed')
        const revenue = vehicleRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
        return {
          name: v.name,
          rentals: vehicleRentals.length,
          revenue: revenue,
        }
      })

      const topVehicles = vehiclesWithStats
        .filter((v: any) => v.revenue > 0) // Only show vehicles with revenue
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)

      const commissionByHome = buildCommissionHomeReport(rentals, { completedOnly: true })
      const commissionHomeTotal = sumCommissionRows(commissionByHome)

      console.log("📈 Report ready:", { totalCustomers, totalVehicles, totalRevenue, commissionHomeTotal })

      const finalData: ReportData = {
        totalCustomers,
        totalVehicles,
        totalRentals,
        totalRevenue,
        totalProfit,
        activeRentals,
        vehiclesInMaintenance,
        monthlyRevenue,
        topVehicles,
        commissionHomeTotal,
        commissionByHome,
      }

      setReportData(finalData)
      addAccessLog("Xem", "Báo cáo", "Xem báo cáo tổng quan")
    } catch (error) {
      console.error("Failed to load report data:", error)
      // Set default empty data
      setReportData({
        totalCustomers: 0,
        totalVehicles: 0,
        totalRentals: 0,
        totalRevenue: 0,
        totalProfit: 0,
        activeRentals: 0,
        vehiclesInMaintenance: 0,
        monthlyRevenue: [
          { month: "T1", revenue: 0 },
          { month: "T2", revenue: 0 },
          { month: "T3", revenue: 0 },
          { month: "T4", revenue: 0 },
          { month: "T5", revenue: 0 },
          { month: "T6", revenue: 0 },
        ],
        topVehicles: [],
        commissionHomeTotal: 0,
        commissionByHome: [],
      })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 h-24 bg-slate-200 rounded"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="p-6">
        <Card className="bg-rose-50 border-rose-200">
          <CardContent className="pt-6">
            <p className="text-rose-700">Không thể tải dữ liệu báo cáo</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)
  
  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const rentalOnly = reportData.totalRevenue - transactions
    .filter((tx) => tx.type === 'income' && !isCapitalTransaction(tx))
    .reduce((sum, tx) => sum + tx.amount, 0)
  const cashOnHand = rentalOnly + totalIncome - totalExpense

  const stats = [
    {
      title: "Doanh Thu",
      value: `${reportData.totalRevenue.toLocaleString("vi-VN")} đ`,
      change: `${reportData.totalRentals} đơn`,
      icon: DollarSign,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Lợi Nhuận",
      value: `${reportData.totalProfit.toLocaleString("vi-VN")} đ`,
      change: `${reportData.totalProfit > 0 ? "↑" : "↓"} LN`,
      icon: TrendingUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
    },
    {
      title: "Tiền Quỹ Còn Lại",
      value: `${cashOnHand.toLocaleString("vi-VN")} đ`,
      change: "số dư quỹ tích lũy",
      icon: Wallet,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
    },
    {
      title: "Tổng Xe",
      value: reportData.totalVehicles.toString(),
      change: `${reportData.activeRentals} đang thuê`,
      icon: Bike,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Tổng Khách",
      value: reportData.totalCustomers.toString(),
      change: `${reportData.totalRentals} lượt thuê`,
      icon: Users,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-500",
    },
    {
      title: "Tổng Đơn",
      value: reportData.totalRentals.toString(),
      change: `${reportData.activeRentals} đang thuê`,
      icon: ClipboardList,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
    },
  ]

  return (
    <ModulePageShell module="rental">
      <ModuleSubpageHeader
        module="rental"
        title="Báo cáo"
        subtitle="Tổng hợp doanh thu, lợi nhuận và thu/chi"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Báo cáo" },
        ]}
      />
      {/* Delete Transaction Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-title">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-body mt-2">
              Bạn có chắc chắn muốn xoá khoản {transactionToDelete?.type === "income" ? "THU" : "CHI"} <span className="font-semibold text-slate-800">"{transactionToDelete?.description}"</span> không?
              <p className="text-meta text-rose-600 mt-2">Số tiền: {transactionToDelete?.amount.toLocaleString("vi-VN")} VND</p>
              <p className="text-meta text-rose-600">Nhập bởi: {transactionToDelete?.user}</p>
              <p className="text-meta text-rose-600">Hành động này không thể hoàn tác.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setTransactionToDelete(null)
              }}
              className="border-slate-300"
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

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditTransactionOpen} onOpenChange={setIsEditTransactionOpen}>
        <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Sửa Khoản Thu/Chi</DialogTitle>
            <DialogDescription className="text-slate-500">Cập nhật thông tin khoản thu/chi</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmEdit() }} className="space-y-4">
            <div>
              <Label className="text-slate-700 text-sm font-medium">Loại</Label>
              <Select value={editFormData.type} onValueChange={(val) => setEditFormData({...editFormData, type: val as "income" | "expense"})}>
                <SelectTrigger className="border-slate-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Thu</SelectItem>
                  <SelectItem value="expense">Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Phân loại khoản</Label>
              <Select
                value={editFormData.isCapital ? "capital" : "operating"}
                onValueChange={(val) => setEditFormData({ ...editFormData, isCapital: val === "capital" })}
              >
                <SelectTrigger className="border-slate-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operating">Vận hành (tính vào lợi nhuận)</SelectItem>
                  <SelectItem value="capital">Vốn / mua tài sản (không tính LN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Mô Tả</Label>
              <Input
                placeholder="Nhập mô tả"
                value={editFormData.description}
                onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                className="border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Ngày Giao Dịch</Label>
              <Input
                type="date"
                value={editFormData.timestamp}
                onChange={(e) => setEditFormData({...editFormData, timestamp: e.target.value})}
                className="border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-medium">Số Tiền (VND)</Label>
              <Input
                type="text"
                placeholder="Nhập số tiền (VD: 1.000.000)"
                value={editFormData.amount}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({...editFormData, amount: formatted})
                }}
                className="border-slate-300 rounded-lg font-mono"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-500 text-white hover:bg-blue-600 rounded-lg">
              Cập nhật
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {stats.map((stat, idx) => (
          <Card 
            key={idx}
            className={`${stat.title === "Tổng Xe" || stat.title === "Tổng Khách" ? "cursor-pointer hover:shadow-lg transition" : ""}`}
            onClick={() => {
              if (stat.title === "Tổng Xe") router.push("/dashboard/vehicles")
              if (stat.title === "Tổng Khách") router.push("/dashboard/customers")
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`${stat.iconBg} p-2 rounded-lg`}>
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <div className="text-xl md:text-2xl font-bold break-words">{stat.value}</div>
              <p className="text-sm text-slate-500 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
          <CardTitle className="text-base md:text-lg">Doanh Thu Theo Tháng</CardTitle>
          <CardDescription className="text-sm md:text-sm">Doanh thu hàng tháng</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reportData.monthlyRevenue} margin={{ top: 10, right: 5, left: -15, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={35} />
              <Tooltip
                formatter={(value: any) => `${value.toLocaleString("vi-VN")} đ`}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "12px"
                }}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Vehicles */}
      <Card>
        <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
          <CardTitle className="text-base md:text-lg">Xe Top Doanh Thu</CardTitle>
          <CardDescription className="text-sm md:text-sm">Top 5 xe có doanh thu cao nhất</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          {reportData.topVehicles.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {reportData.topVehicles.map((vehicle, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start justify-between border-b pb-2 md:pb-3 last:border-b-0 cursor-pointer hover:bg-slate-50 p-2 rounded transition gap-2"
                  onClick={async () => {
                    const { data } = await supabase
                      .from('vehicles')
                      .select('*')
                      .eq('name', vehicle.name)
                      .single()
                    
                    if (data) {
                      setSelectedVehicle(data)
                      setIsDetailOpen(true)
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 break-words">{vehicle.name}</p>
                    <p className="text-sm text-slate-500">{vehicle.rentals} lần thuê</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm text-blue-600 break-words">
                      {vehicle.revenue.toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-6 text-sm">Chưa có dữ liệu xe</p>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Chi tiết xe</DialogTitle>
            <DialogDescription className="text-slate-500">Thông tin chi tiết của xe</DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <p className="text-sm text-slate-500">Tên xe</p>
                  <p className="font-medium text-slate-800 text-sm">{selectedVehicle.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Biển số</p>
                  <p className="font-medium text-slate-800 text-sm">{selectedVehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Màu sắc</p>
                  <p className="font-medium text-slate-800 text-sm">{selectedVehicle.color}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Giá/ngày</p>
                  <p className="font-medium text-slate-800 text-sm">{selectedVehicle.pricePerDay.toLocaleString()} đ</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Trạng thái</p>
                  <p className="font-medium text-slate-800">{selectedVehicle.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Km hiện tại</p>
                  <p className="font-medium text-slate-800">{selectedVehicle.current_km} km</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Giá mua</p>
                  <p className="font-medium text-slate-800">{selectedVehicle.purchasePrice.toLocaleString("vi-VN")} đ</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Doanh thu</p>
                  <p className="font-medium text-slate-800">{selectedVehicle.totalRevenue.toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Ghi chú</p>
                  <p className="font-medium text-slate-800">{selectedVehicle.notes || "Không có"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-3 md:pb-4 p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <CardTitle className="text-base md:text-lg">Theo Dõi Thu/Chi</CardTitle>
              <CardDescription className="text-meta font-medium">Quản lý các khoản thu/chi nằm ngoài đơn thuê xe</CardDescription>
            </div>
            <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
              <Button onClick={() => setIsAddTransactionOpen(true)} className="bg-blue-500 text-white hover:bg-blue-600 text-sm w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nhập Thu/Chi
              </Button>
              <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-slate-800">Thêm Khoản Thu/Chi</DialogTitle>
                  <DialogDescription className="text-slate-500">Nhập thông tin khoản thu hoặc chi</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Loại</Label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val as "income" | "expense"})}>
                      <SelectTrigger className="border-slate-300 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Thu</SelectItem>
                        <SelectItem value="expense">Chi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Phân loại khoản</Label>
                    <Select
                      value={formData.isCapital ? "capital" : "operating"}
                      onValueChange={(val) => setFormData({ ...formData, isCapital: val === "capital" })}
                    >
                      <SelectTrigger className="border-slate-300 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operating">Vận hành (tính vào lợi nhuận)</SelectItem>
                        <SelectItem value="capital">Vốn / mua tài sản (không tính LN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Mô Tả (ví dụ: mua định vị, sửa xe)</Label>
                    <Input
                      placeholder="Nhập mô tả"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Ngày Giao Dịch</Label>
                    <Input
                      type="date"
                      value={formData.timestamp}
                      onChange={(e) => setFormData({...formData, timestamp: e.target.value})}
                      className="border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Số Tiền (VND)</Label>
                    <Input
                      type="text"
                      placeholder="Nhập số tiền (VD: 1.000.000)"
                      value={formData.amount}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setFormData({...formData, amount: formatted})
                      }}
                      className="border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-500 text-white hover:bg-blue-600 rounded-lg">
                    Thêm
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Tìm kiếm: mô tả, user, tiền, loại..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10 border-slate-300 rounded-lg text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          {transactions.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm md:text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 md:p-3 font-semibold text-slate-700">Thời gian</th>
                      <th className="text-left p-2 md:p-3 font-semibold text-slate-700">Thu/Chi</th>
                      <th className="text-left p-2 md:p-3 font-semibold text-slate-700 hidden sm:table-cell">Người</th>
                      <th className="text-right p-2 md:p-3 font-semibold text-slate-700">Tiền</th>
                      <th className="text-center p-2 md:p-3 font-semibold text-slate-700">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2 md:p-3 text-slate-600 text-sm">{new Date(tx.timestamp).toLocaleString("vi-VN")}</td>
                        <td className="p-2 md:p-3">
                          <span className={tx.type === "income" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                            {tx.type === "income" ? "✓" : "✗"} {tx.description}
                          </span>
                        </td>
                        <td className="p-2 md:p-3 text-slate-600 hidden sm:table-cell text-sm">{tx.user}</td>
                        <td className={`p-2 md:p-3 text-right font-semibold text-sm md:text-sm ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                          {tx.type === "income" ? "+" : "-"} {tx.amount.toLocaleString("vi-VN")}
                        </td>
                        <td className="p-2 md:p-3 text-center">
                          {user?.role === 'admin' ? (
                            <div className="flex gap-1 md:gap-2 justify-center">
                              <button
                                onClick={() => handleEditTransaction(tx)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition"
                                title="Sửa"
                              >
                                <Edit2 className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx)}
                                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded transition"
                                title="Xoá"
                              >
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">Admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ModulePagination
                page={currentPage}
                totalPages={Math.max(1, totalPages)}
                totalItems={filteredTransactions.length}
                itemLabel="giao dịch"
                onPageChange={setCurrentPage}
                className="border-t border-slate-200 pt-3 mt-0 px-0 bg-transparent"
              />
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">
              <p className="text-sm">Chưa có khoản thu/chi nào</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {(() => {
        // Calculate totals from transactions
        const totalIncome = transactions
          .filter((tx) => tx.type === 'income')
          .reduce((sum, tx) => sum + tx.amount, 0)
        
        const totalExpense = transactions
          .filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => sum + tx.amount, 0)
        
        // Filter out salary and dividend transactions from operational profit calculations
        const salaryExpenses = transactions
          .filter(isSalaryTransaction)
          .reduce((sum, tx) => sum + tx.amount, 0)

        const dividendExpenses = transactions
          .filter(isDividendTransaction)
          .reduce((sum, tx) => sum + tx.amount, 0)
        
        // NOTE: reportData.totalRevenue/Profit = P&L vận hành (không gồm góp vốn/mua xe/chia cổ tức)
        const rentalOnly = reportData.totalRevenue - transactions
          .filter((tx) => tx.type === 'income' && !isCapitalTransaction(tx))
          .reduce((sum, tx) => sum + tx.amount, 0)
        const cashOnHand = rentalOnly + totalIncome - totalExpense
        
        // Operating profit before salaries (Gross Operating Profit)
        const operatingProfitBeforeSalary = reportData.totalProfit + salaryExpenses
        
        // Equal split estimation for shareholders (example: 3 partners)
        const partnerShare = reportData.totalProfit > 0 ? Math.floor(reportData.totalProfit / 3) : 0
        
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200 lg:col-span-2">
              <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg text-blue-800">
                  <TrendingUp className="w-5 h-5" />
                  Tóm Tắt Báo Cáo Tài Chính
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-4 p-3 md:p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">🚗 Tổng xe</p>
                    <p className="font-semibold text-base text-slate-800">{reportData.totalVehicles}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">👥 Tổng khách</p>
                    <p className="font-semibold text-base text-slate-800">{reportData.totalCustomers}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">📋 Tổng đơn</p>
                    <p className="font-semibold text-base text-slate-800">{reportData.totalRentals}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">💰 Doanh thu thuê xe</p>
                    <p className="font-semibold text-base text-blue-600 break-words">{reportData.totalRevenue.toLocaleString("vi-VN")} đ</p>
                  </div>
                </div>
                
                <div className="border-t border-blue-200 pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">📈 LN Vận hành (trước lương)</p>
                      <p className="font-semibold text-base text-emerald-700 break-words">
                        {operatingProfitBeforeSalary.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">👥 Tổng chi lương NV</p>
                      <p className="font-semibold text-base text-rose-600 break-words">
                        -{salaryExpenses.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">📊 Lợi nhuận ròng vận hành</p>
                      <p className="font-semibold text-base text-emerald-600 break-words">
                        {reportData.totalProfit.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">📥 Tổng thu (bao gồm vốn)</p>
                      <p className="font-semibold text-base text-emerald-600 break-words">
                        +{(rentalOnly + totalIncome).toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">📤 Tổng chi (gồm cả lương/vốn)</p>
                      <p className="font-semibold text-base text-rose-600">
                        -{totalExpense.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">💸 Cổ tức đã chia</p>
                      <p className="font-semibold text-base text-indigo-600 break-words">
                        -{dividendExpenses.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">🏠 Chi HH Home</p>
                      <p className="font-semibold text-base text-amber-700 break-words">
                        -{reportData.commissionHomeTotal.toLocaleString("vi-VN")} đ
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">đã trừ trong doanh thu</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">💵 Tiền mặt hiện có</p>
                      <p className={`font-semibold text-base ${cashOnHand >= 0 ? 'text-blue-600' : 'text-rose-600'} break-words`}>
                        {cashOnHand.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                  </div>
                  
                  {reportData.commissionByHome.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-blue-100 pt-3">
                      <p className="text-xs font-semibold text-slate-500">Hoa hồng chi tiết theo Home</p>
                      {reportData.commissionByHome.slice(0, 3).map((row) => (
                        <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-700 truncate">{row.name} · {row.count} đơn</span>
                          <span className="font-semibold text-amber-700 tabular-nums shrink-0">
                            {row.total.toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="pb-2 p-3 md:p-4">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg text-slate-800">
                  <Users className="w-5 h-5 text-slate-500" />
                  Phân Chia Cổ Đông
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Bảng chia đề xuất theo lợi nhuận ròng tháng trước
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-700 p-3 md:p-4 space-y-4">
                <div className="bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Lợi nhuận ròng vận hành:</span>
                    <span className="font-bold text-slate-700">{reportData.totalProfit.toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Đã chia trong kỳ:</span>
                    <span className="font-bold text-indigo-600">-{dividendExpenses.toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-800">
                    <span>Còn lại cần chia:</span>
                    <span className={reportData.totalProfit - dividendExpenses >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {(reportData.totalProfit - dividendExpenses).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-600 text-xs">Phân chia theo tỷ lệ (Đề xuất 3 bên bằng nhau):</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200/50">
                      <div>
                        <p className="font-medium text-slate-800">Cổ đông Admin</p>
                        <p className="text-[10px] text-slate-400">Tỷ lệ: 33.33%</p>
                      </div>
                      <p className="font-bold text-slate-700 tabular-nums">{partnerShare.toLocaleString("vi-VN")}đ</p>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200/50">
                      <div>
                        <p className="font-medium text-slate-800">Cổ đông Lộc A</p>
                        <p className="text-[10px] text-slate-400">Tỷ lệ: 33.33%</p>
                      </div>
                      <p className="font-bold text-slate-700 tabular-nums">{partnerShare.toLocaleString("vi-VN")}đ</p>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200/50">
                      <div>
                        <p className="font-medium text-slate-800">Cổ đông Lộc B</p>
                        <p className="text-[10px] text-slate-400">Tỷ lệ: 33.33%</p>
                      </div>
                      <p className="font-bold text-slate-700 tabular-nums">{partnerShare.toLocaleString("vi-VN")}đ</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })()}
    </ModulePageShell>
  )
}
