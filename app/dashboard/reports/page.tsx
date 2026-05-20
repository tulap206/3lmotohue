"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
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
import { TrendingUp, Bike, Users, ClipboardList, DollarSign, Wallet, Plus } from "lucide-react"
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

interface Transaction {
  id: string
  type: "income" | "expense"
  description: string
  amount: number
  user: string
  timestamp: string
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
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [formData, setFormData] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
  })

  useEffect(() => {
    loadReportData()
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      // Load from localStorage instead of Supabase
      const stored = localStorage.getItem('transactions')
      if (stored) {
        setTransactions(JSON.parse(stored))
      }
    } catch (error) {
      console.error("Failed to load transactions:", error)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("📝 Adding transaction:", formData)
    
    if (!formData.description) {
      alert("❌ Vui lòng nhập mô tả")
      return
    }
    if (!formData.amount) {
      alert("❌ Vui lòng nhập số tiền")
      return
    }
    if (!user) {
      alert("❌ Vui lòng đăng nhập lại")
      return
    }

    try {
      const newTransaction: Transaction = {
        id: `tx-${Date.now()}`,
        type: formData.type,
        description: formData.description,
        amount: parseInt(formData.amount),
        user: user.username,
        timestamp: new Date().toISOString(),
      }
      
      console.log("✅ Transaction object:", newTransaction)
      
      const updatedTransactions = [newTransaction, ...transactions]
      setTransactions(updatedTransactions)
      
      // Save to localStorage
      localStorage.setItem('transactions', JSON.stringify(updatedTransactions))
      console.log("💾 Saved to localStorage")
      
      setFormData({ type: "income", description: "", amount: "" })
      setIsAddTransactionOpen(false)
      
      // Log action if user exists
      if (user?.username) {
        try {
          addAccessLog("Thêm", "Thu/Chi", `${formData.type === "income" ? "Thu" : "Chi"}: ${formData.description}`)
        } catch (logError) {
          console.error("Warning: Could not log action", logError)
          // Don't fail if logging fails
        }
      }
      
      alert("✅ Thêm khoản thu/chi thành công!")
    } catch (error) {
      console.error("❌ Error adding transaction:", error)
      alert("❌ Lỗi thêm khoản thu/chi: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  const loadReportData = async () => {
    try {
      setLoading(true)
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

      // Revenue from rentals (totalPrice field)
      const totalRevenue = rentals.reduce((sum: number, r: any) => sum + (r.totalPrice || 0), 0)
      
      // Profit from vehicles if available, otherwise calculate from revenue
      const totalProfit = vehicles.reduce((sum: number, v: any) => sum + (v.profit || 0), 0) || Math.round(totalRevenue * 0.3)
      
      // Active rentals = pending status
      const activeRentals = rentals.filter((r: any) => r.status === "pending").length
      
      // Vehicles in maintenance
      const vehiclesInMaintenance = vehicles.filter((v: any) => v.status === "maintenance").length

      console.log("💰 Calculations:", { totalRevenue, totalProfit, activeRentals, totalCustomers, totalVehicles, totalRentals })

      // Monthly data
      const monthlyData: Record<string, number> = {}
      rentals.forEach((rental: any) => {
        if (rental.startDate) {
          const date = new Date(rental.startDate)
          const monthKey = `T${date.getMonth() + 1}`
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (rental.totalPrice || 0)
        }
      })

      const monthlyRevenue = [
        { month: "T1", revenue: monthlyData["T1"] || 0 },
        { month: "T2", revenue: monthlyData["T2"] || 0 },
        { month: "T3", revenue: monthlyData["T3"] || 0 },
        { month: "T4", revenue: monthlyData["T4"] || 0 },
        { month: "T5", revenue: monthlyData["T5"] || 0 },
        { month: "T6", revenue: monthlyData["T6"] || 0 },
      ]

      // Top vehicles - use totalRevenue field
      const topVehicles = vehicles
        .map((v: any) => ({
          name: v.name,
          rentals: v.totalRentalDays || 0,
          revenue: v.totalRevenue || 0,
        }))
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
      setLoading(false)
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
        <Card className="bg-red-50 border-red-200">
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
      value: `${reportData.totalRevenue.toLocaleString("vi-VN")} VNĐ`,
      change: `${reportData.totalRentals} đơn`,
      icon: DollarSign,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Lợi Nhuận",
      value: `${reportData.totalProfit.toLocaleString("vi-VN")} VNĐ`,
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
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card 
            key={idx}
            className={stat.title === "Tổng Xe" || stat.title === "Tổng Khách" ? "cursor-pointer hover:shadow-lg transition" : ""}
            onClick={() => {
              if (stat.title === "Tổng Xe") router.push("/dashboard/vehicles")
              if (stat.title === "Tổng Khách") router.push("/dashboard/customers")
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`${stat.iconBg} p-2 rounded-lg`}>
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Doanh Thu Theo Tháng</CardTitle>
          <CardDescription>Doanh thu hàng tháng</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reportData.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: any) => `${value.toLocaleString("vi-VN")} VNĐ`}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
              <Bar dataKey="revenue" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Vehicles */}
      <Card>
        <CardHeader>
          <CardTitle>Xe Top Doanh Thu</CardTitle>
          <CardDescription>Top 5 xe có doanh thu cao nhất</CardDescription>
        </CardHeader>
        <CardContent>
          {reportData.topVehicles.length > 0 ? (
            <div className="space-y-4">
              {reportData.topVehicles.map((vehicle, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between border-b pb-3 last:border-b-0 cursor-pointer hover:bg-gray-50 p-2 rounded transition"
                  onClick={async () => {
                    // Fetch full vehicle data
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
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{vehicle.name}</p>
                    <p className="text-xs text-gray-500">{vehicle.rentals} lần thuê</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {vehicle.revenue.toLocaleString("vi-VN")} VNĐ
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Chưa có dữ liệu xe</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Tên xe</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Biển số</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Màu sắc</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.color}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Giá/ngày</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.pricePerDay.toLocaleString()} VNĐ</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Trạng thái</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Km hiện tại</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.current_km} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Giá mua</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.purchasePrice.toLocaleString("vi-VN")} VNĐ</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Doanh thu</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.totalRevenue.toLocaleString("vi-VN")} VNĐ</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Ghi chú</p>
                  <p className="font-medium text-gray-800">{selectedVehicle.notes || "Không có"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Theo Dõi Thu/Chi</CardTitle>
            <CardDescription>Quản lý các khoản thu/chi ngoài đơn thuê</CardDescription>
          </div>
          <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
            <Button onClick={() => setIsAddTransactionOpen(true)} className="bg-blue-500 text-white hover:bg-blue-600">
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
                    type="number"
                    placeholder="Nhập số tiền"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="border-gray-300 rounded-lg"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-500 text-white hover:bg-blue-600 rounded-lg">
                  Thêm
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Thời gian</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Khoản Thu/Chi</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Người (User)</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Số Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-gray-600">
                        {new Date(tx.timestamp).toLocaleString("vi-VN")}
                      </td>
                      <td className="p-3">
                        <span className={tx.type === "income" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {tx.type === "income" ? "✓" : "✗"} {tx.description}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{tx.user}</td>
                      <td className={`p-3 text-right font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "income" ? "+" : "-"} {tx.amount.toLocaleString("vi-VN")} VND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Chưa có khoản thu/chi nào</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Tóm Tắt
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>📊 Tổng khách: {reportData.totalCustomers}</p>
          <p>🚗 Tổng xe: {reportData.totalVehicles}</p>
          <p>💰 Doanh thu: {reportData.totalRevenue.toLocaleString("vi-VN")} VNĐ</p>
          <p>📈 Lợi nhuận: {reportData.totalProfit.toLocaleString("vi-VN")} VNĐ</p>
        </CardContent>
      </Card>
    </div>
  )
}
