"use client"

// Force cache bust - v2024.05.18.01
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { fetchCustomers, fetchVehicles, fetchRentals } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Bike, Users, ClipboardList, DollarSign, Wallet } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts"

interface ReportData {
  totalCustomers: number
  totalVehicles: number
  totalRentals: number
  totalRevenue: number
  totalProfit: number
  activeRentals: number
  vehiclesInMaintenance: number
  monthlyRevenue: Array<{ month: string; revenue: number; profit: number }>
  topVehicles: Array<{ name: string; rentals: number; revenue: number; profit: number }>
}

export default function ReportsPage() {
  const { addAccessLog } = useAuth()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportData()
    addAccessLog("Xem", "Báo cáo", "Xem báo cáo tổng quan")
  }, [])

  const loadReportData = async () => {
    try {
      setLoading(true)
      console.log("📊 Loading report data from Supabase...")
      
      const [customers, vehicles, rentals] = await Promise.all([
        fetchCustomers(),
        fetchVehicles(),
        fetchRentals(),
      ])

      console.log("📊 Data loaded:", { 
        customersCount: customers.length, 
        vehiclesCount: vehicles.length, 
        rentalsCount: rentals.length 
      })

      // Calculate statistics
      const totalCustomers = customers.length
      const totalVehicles = vehicles.length
      const totalRentals = rentals.length

      // Revenue & Profit calculations
      const totalRevenue = rentals.reduce((sum, r) => sum + (r.totalPrice || 0), 0)
      const totalProfit = vehicles.reduce((sum, v) => sum + (v.profit || 0), 0)
      
      console.log("💰 Calculations:", { totalRevenue, totalProfit, rentalsLength: rentals.length })
      const activeRentals = rentals.filter((r) => r.status === "active").length
      const vehiclesInMaintenance = vehicles.filter((v) => v.status === "maintenance").length

      // Monthly revenue (grouping by month from rental dates)
      const monthlyData: Record<string, { revenue: number; profit: number }> = {}
      rentals.forEach((rental) => {
        if (rental.startDate) {
          const date = new Date(rental.startDate)
          const monthKey = `T${date.getMonth() + 1}`
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, profit: 0 }
          }
          monthlyData[monthKey].revenue += rental.totalPrice || 0
        }
      })

      const monthlyRevenue = [
        { month: "T1", revenue: monthlyData["T1"]?.revenue || 0, profit: monthlyData["T1"]?.profit || 0 },
        { month: "T2", revenue: monthlyData["T2"]?.revenue || 0, profit: monthlyData["T2"]?.profit || 0 },
        { month: "T3", revenue: monthlyData["T3"]?.revenue || 0, profit: monthlyData["T3"]?.profit || 0 },
        { month: "T4", revenue: monthlyData["T4"]?.revenue || 0, profit: monthlyData["T4"]?.profit || 0 },
        { month: "T5", revenue: monthlyData["T5"]?.revenue || 0, profit: monthlyData["T5"]?.profit || 0 },
        { month: "T6", revenue: monthlyData["T6"]?.revenue || 0, profit: monthlyData["T6"]?.profit || 0 },
      ]

      // Top performing vehicles
      const vehicleRentals = vehicles
        .map((v) => ({
          name: v.name,
          licensePlate: v.licensePlate,
          rentals: v.totalRentalDays || 0,
          revenue: v.totalRevenue || 0,
          profit: v.profit || 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      console.log("📈 Report data prepared:", {
        totalCustomers,
        totalVehicles,
        totalRentals,
        totalRevenue,
        topVehiclesCount: vehicleRentals.length,
      })

      setReportData({
        totalCustomers,
        totalVehicles,
        totalRentals,
        totalRevenue,
        totalProfit,
        activeRentals,
        vehiclesInMaintenance,
        monthlyRevenue,
        topVehicles: vehicleRentals,
      })
    } catch (error) {
      console.error("Failed to load report data:", error)
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
      value: `${(reportData.totalRevenue / 1000000).toFixed(1)}M`,
      change: `${reportData.totalRentals} đơn`,
      icon: DollarSign,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Lợi Nhuận",
      value: `${(reportData.totalProfit / 1000000).toFixed(1)}M`,
      change: `${reportData.totalProfit > 0 ? "↑" : "↓"}`,
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
          <Card key={idx}>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle>Doanh Thu Theo Tháng</CardTitle>
            <CardDescription>Doanh thu hàng tháng năm nay</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" name="Doanh Thu" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle>Xe Top Doanh Thu</CardTitle>
            <CardDescription>5 xe có doanh thu cao nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.topVehicles.map((vehicle, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{vehicle.name}</p>
                    <p className="text-xs text-gray-500">{vehicle.rentals} lần thuê</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{(vehicle.revenue / 1000000).toFixed(1)}M</p>
                    <p className="text-xs text-gray-500">{(vehicle.profit / 1000000).toFixed(1)}M LN</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Tóm Tắt Báo Cáo
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>
            • <span className="font-semibold">Tổng doanh thu:</span> {(reportData.totalRevenue / 1000000).toFixed(1)}M VNĐ từ {reportData.totalRentals} đơn thuê
          </p>
          <p>
            • <span className="font-semibold">Lợi nhuận ròng:</span> {(reportData.totalProfit / 1000000).toFixed(1)}M VNĐ
          </p>
          <p>
            • <span className="font-semibold">Tỷ lệ lợi nhuận:</span> {reportData.totalRevenue > 0 ? ((reportData.totalProfit / reportData.totalRevenue) * 100).toFixed(1) : 0}%
          </p>
          <p>
            • <span className="font-semibold">Xe đang hoạt động:</span> {reportData.activeRentals} / {reportData.totalVehicles}
          </p>
          <p>
            • <span className="font-semibold">Xe bảo trì:</span> {reportData.vehiclesInMaintenance} chiếc
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
