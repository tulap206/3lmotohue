"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchTransactions, insertTransaction, deleteTransaction, updateTransaction, Transaction } from "@/lib/supabase"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
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
import { ModulePagination } from "@/components/dashboard/module-shell"
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
  })
  const [editFormData, setEditFormData] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
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
        description: formData.description,
        amount: parseMoneyInput(formData.amount),
        user: user.username,
        timestamp: new Date().toISOString(),
      })
      
      console.log("✅ Transaction saved to Supabase:", newTransaction)
      
      setTransactions([newTransaction, ...transactions])
      setFormData({ type: "income", description: "", amount: "" })
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
      description: tx.description,
      amount: tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    })
    setIsEditTransactionOpen(true)
  }

  const handleConfirmEdit = async () => {
    if (!editingTransaction || !editFormData.description || !editFormData.amount) {
      console.error("❌ Validation failed:", { editingTransaction, editFormData })
      return
    }
    
    const parsedAmount = parseMoneyInput(editFormData.amount)
    
    console.log("📝 Updating transaction:", editingTransaction.id, {
      type: editFormData.type,
      description: editFormData.description,
      amount: parsedAmount,
    })
    
    try {
      await updateTransaction(editingTransaction.id, {
        type: editFormData.type as "income" | "expense",
        description: editFormData.description,
        amount: parsedAmount,
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

      // Rental revenue (totalPrice field)
      const rentalRevenue = rentals.reduce((sum: number, r: any) => sum + (r.totalPrice || 0), 0)
      
      // Transaction totals
      const totalIncomeFromTransactions = transactions
        .filter((tx: any) => tx.type === 'income')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      const totalExpenseFromTransactions = transactions
        .filter((tx: any) => tx.type === 'expense')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      // NEW LOGIC:
      // Doanh thu = Rental revenue + Income from transactions
      const totalRevenue = rentalRevenue + totalIncomeFromTransactions
      
      // Lợi nhuận = Rental revenue only (not counting transactions)
      const totalProfit = rentalRevenue
      
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
        if (rental.startDate) {
          const date = parseVietnamDate(rental.startDate)
          const monthKey = `T${date.getMonth() + 1}`
          // Use revenue (includes extraFees) instead of totalPrice
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (rental.revenue || rental.totalPrice || 0)
        }
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

      console.log("📈 Report ready:", { totalCustomers, totalVehicles, totalRevenue })

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
              <CardContent className="pt-6 h-24 bg-gray-200 rounded"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="p-6">
        <Card className="bg-blue-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-700">Không thể tải dữ liệu báo cáo</p>
          </CardContent>
        </Card>
      </div>
    )
  }

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
      icon: Wallet,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 w-full">
      {/* Delete Transaction Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base mt-2">
              Bạn có chắc chắn muốn xoá khoản {transactionToDelete?.type === "income" ? "THU" : "CHI"} <span className="font-semibold text-gray-800">"{transactionToDelete?.description}"</span> không?
              <p className="text-sm text-red-600 mt-2">⚠️ Số tiền: {transactionToDelete?.amount.toLocaleString("vi-VN")} VND</p>
              <p className="text-sm text-red-600">⚠️ Nhập bởi: {transactionToDelete?.user}</p>
              <p className="text-sm text-red-600">⚠️ Hành động này không thể hoàn tác!</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setTransactionToDelete(null)
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

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditTransactionOpen} onOpenChange={setIsEditTransactionOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Sửa Khoản Thu/Chi</DialogTitle>
            <DialogDescription className="text-gray-500">Cập nhật thông tin khoản thu/chi</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmEdit() }} className="space-y-4">
            <div>
              <Label className="text-gray-700 text-sm font-medium">Loại</Label>
              <Select value={editFormData.type} onValueChange={(val) => setEditFormData({...editFormData, type: val as "income" | "expense"})}>
                <SelectTrigger className="border-gray-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Thu</SelectItem>
                  <SelectItem value="expense">Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-700 text-sm font-medium">Mô Tả</Label>
              <Input
                placeholder="Nhập mô tả"
                value={editFormData.description}
                onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                className="border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-gray-700 text-sm font-medium">Số Tiền (VND)</Label>
              <Input
                type="text"
                placeholder="Nhập số tiền (VD: 1.000.000)"
                value={editFormData.amount}
                onChange={(e) => {
                  const formatted = formatMoneyInput(e.target.value)
                  setEditFormData({...editFormData, amount: formatted})
                }}
                className="border-gray-300 rounded-lg font-mono"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-500 text-white hover:bg-blue-600 rounded-lg">
              Cập nhật
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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
              <p className="text-sm text-gray-500 mt-1">{stat.change}</p>
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
                  className="flex items-start justify-between border-b pb-2 md:pb-3 last:border-b-0 cursor-pointer hover:bg-gray-50 p-2 rounded transition gap-2"
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
                    <p className="font-medium text-sm text-gray-900 break-words">{vehicle.name}</p>
                    <p className="text-sm text-gray-500">{vehicle.rentals} lần thuê</p>
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
            <p className="text-gray-500 text-center py-6 text-sm">Chưa có dữ liệu xe</p>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Chi tiết xe</DialogTitle>
            <DialogDescription className="text-gray-500">Thông tin chi tiết của xe</DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tên xe</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicle.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Biển số</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Màu sắc</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicle.color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá/ngày</p>
                  <p className="font-medium text-gray-800 text-sm">{selectedVehicle.pricePerDay.toLocaleString()} đ</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Trạng thái</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Km hiện tại</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.current_km} km</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá mua</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.purchasePrice.toLocaleString("vi-VN")} đ</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Doanh thu</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.totalRevenue.toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Ghi chú</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.notes || "Không có"}</p>
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
              <CardDescription className="text-red-600 font-medium text-sm md:text-sm">Quản lý các khoản thu/chi nằm ngoài đơn thuê xe</CardDescription>
            </div>
            <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
              <Button onClick={() => setIsAddTransactionOpen(true)} className="bg-blue-500 text-white hover:bg-blue-600 text-sm w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nhập Thu/Chi
              </Button>
              <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-gray-800">Thêm Khoản Thu/Chi</DialogTitle>
                  <DialogDescription className="text-gray-500">Nhập thông tin khoản thu hoặc chi</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Loại</Label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val as "income" | "expense"})}>
                      <SelectTrigger className="border-gray-300 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Thu</SelectItem>
                        <SelectItem value="expense">Chi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Mô Tả (ví dụ: mua định vị, sửa xe)</Label>
                    <Input
                      placeholder="Nhập mô tả"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Số Tiền (VND)</Label>
                    <Input
                      type="text"
                      placeholder="Nhập số tiền (VD: 1.000.000)"
                      value={formData.amount}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setFormData({...formData, amount: formatted})
                      }}
                      className="border-gray-300 rounded-lg font-mono"
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Tìm kiếm: mô tả, user, tiền, loại..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10 border-gray-300 rounded-lg text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 md:p-3 font-semibold text-gray-700">Thời gian</th>
                      <th className="text-left p-2 md:p-3 font-semibold text-gray-700">Thu/Chi</th>
                      <th className="text-left p-2 md:p-3 font-semibold text-gray-700 hidden sm:table-cell">Người</th>
                      <th className="text-right p-2 md:p-3 font-semibold text-gray-700">Tiền</th>
                      <th className="text-center p-2 md:p-3 font-semibold text-gray-700">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 md:p-3 text-gray-600 text-sm">{new Date(tx.timestamp).toLocaleString("vi-VN")}</td>
                        <td className="p-2 md:p-3">
                          <span className={tx.type === "income" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                            {tx.type === "income" ? "✓" : "✗"} {tx.description}
                          </span>
                        </td>
                        <td className="p-2 md:p-3 text-gray-600 hidden sm:table-cell text-sm">{tx.user}</td>
                        <td className={`p-2 md:p-3 text-right font-semibold text-sm md:text-sm ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
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
                                className="text-red-600 hover:text-red-800 hover:bg-blue-50 p-1 rounded transition"
                                title="Xoá"
                              >
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Admin</span>
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
                className="border-t border-gray-200 pt-3 mt-0 px-0 bg-transparent"
              />
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
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
        
        // NOTE: reportData.totalRevenue = Rental revenue + Income transactions
        // reportData.totalProfit = Rental revenue only
        // So to get rental revenue: we need to subtract income from totalRevenue
        // Better: use totalProfit which is rental revenue only
        const rentalRevenue = reportData.totalProfit // This is rental revenue only
        
        // Calculate cash on hand
        // = Rental revenue + Income from transactions - Expenses from transactions
        const cashOnHand = rentalRevenue + totalIncome - totalExpense
        
        return (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <TrendingUp className="w-5 h-5" />
                Tóm Tắt
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-3 p-3 md:p-4">
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">🚗 Tổng xe</p>
                  <p className="font-semibold text-base md:text-lg text-gray-800">{reportData.totalVehicles}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">👥 Tổng khách</p>
                  <p className="font-semibold text-base md:text-lg text-gray-800">{reportData.totalCustomers}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">📋 Tổng đơn</p>
                  <p className="font-semibold text-base md:text-lg text-gray-800">{reportData.totalRentals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">💰 Doanh thu</p>
                  <p className="font-semibold text-base md:text-lg text-blue-600 break-words text-sm md:text-base">{reportData.totalRevenue.toLocaleString("vi-VN")}</p>
                </div>
              </div>
              
              <div className="border-t border-blue-200 pt-3">
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">📈 Lợi nhuận</p>
                    <p className="font-semibold text-base md:text-lg text-emerald-600 break-words text-sm md:text-base">{reportData.totalProfit.toLocaleString("vi-VN")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">📥 Tổng thu</p>
                    <p className="font-semibold text-base md:text-lg text-green-600 break-words text-sm md:text-base">+{(rentalRevenue + totalIncome).toLocaleString("vi-VN")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">📤 Tổng chi</p>
                    <p className="font-semibold text-base md:text-lg text-red-600 text-sm md:text-base">-{totalExpense.toLocaleString("vi-VN")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">💵 Tiền hiện có</p>
                    <p className={`font-semibold text-base md:text-lg ${cashOnHand >= 0 ? 'text-blue-600' : 'text-red-600'} text-sm md:text-base break-words`}>
                      {cashOnHand.toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
