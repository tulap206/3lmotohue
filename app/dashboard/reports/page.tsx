"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
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

export default function ReportsPage() {
  const { addAccessLog } = useAuth()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportData()
  }, [])

  const loadReportData = async () => {
    try {
      setLoading(true)
      console.log("📊 Loading report data...")

      // Fetch from Supabase with error handling
      const [customersRes, vehiclesRes, rentalsRes] = await Promise.all([
        supabase.from("customers").select("*").catch((e) => {
          console.error("Customers fetch error:", e)
          return { data: [] }
        }),
        supabase.from("vehicles").select("*").catch((e) => {
          console.error("Vehicles fetch error:", e)
          return { data: [] }
        }),
        supabase.from("rentals").select("*").catch((e) => {
          console.error("Rentals fetch error:", e)
          return { data: [] }
        }),
      ])

      const customers = customersRes.data || []
      const vehicles = vehiclesRes.data || []
      const rentals = rentalsRes.data || []

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
      value: `${(reportData.totalRevenue / 1000000).toFixed(1)}M`,
      change: `${reportData.totalRentals} đơn`,
      icon: DollarSign,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Lợi Nhuận",
      value: `${(reportData.totalProfit / 1000000).toFixed(1)}M`,
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
                formatter={(value: any) => `${(value / 1000000).toFixed(1)}M`}
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
                <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{vehicle.name}</p>
                    <p className="text-xs text-gray-500">{vehicle.rentals} lần thuê</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {(vehicle.revenue / 1000000).toFixed(1)}M
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
          <p>💰 Doanh thu: {(reportData.totalRevenue / 1000000).toFixed(1)}M VNĐ</p>
          <p>📈 Lợi nhuận: {(reportData.totalProfit / 1000000).toFixed(1)}M VNĐ</p>
        </CardContent>
      </Card>
    </div>
  )
}
