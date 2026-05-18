"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Bike, Users, ClipboardList, TrendingUp, Wallet, MoreVertical } from "lucide-react"
import { fetchVehicles, fetchRentals } from "@/lib/supabase"

interface DashboardStats {
  totalVehicles: number
  totalRevenue: number
  totalProfit: number
  totalRentals: number
}

interface RecentOrder {
  id: string
  customer: string
  vehicle: string
  price: string
  unit: number
}

interface TopVehicle {
  name: string
  rentals: number
  revenue: string
  profit: string
  image: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalRentals: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const vehicles = await fetchVehicles()
        const rentals = await fetchRentals()

        // Calculate stats
        const completedRentals = rentals.filter((r: any) => r.status === 'completed')
        const totalRevenue = completedRentals.reduce((sum: number, r: any) => sum + (r.totalPrice || 0), 0)
        const totalProfit = vehicles.reduce((sum: number, v: any) => sum + (v.profit || 0), 0)

        setStats({
          totalVehicles: vehicles.length,
          totalRevenue,
          totalProfit,
          totalRentals: rentals.length,
        })

        // Map recent rentals for display
        const recent = rentals.slice(0, 4).map((r: any) => ({
          id: r.id,
          customer: r.customerName,
          vehicle: r.vehicleName,
          price: `${(r.pricePerDay / 1000).toFixed(0)}K`,
          unit: r.totalDays,
        }))
        setRecentOrders(recent)

        // Sort vehicles by rental count for top vehicles
        const vehiclesWithRentals = vehicles.map((v: any) => ({
          name: v.name,
          rentals: rentals.filter((r: any) => r.vehicleId === v.id && r.status === 'completed').length,
          revenue: `${((v.totalRevenue || 0) / 1000000).toFixed(1)}M`,
          profit: `${((v.profit || 0) / 1000000).toFixed(1)}M`,
          image: "/logo.jpg",
        })).sort((a, b) => b.rentals - a.rentals).slice(0, 4)

        setTopVehicles(vehiclesWithRentals)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const statsDisplay = [
    {
      title: "Tổng số xe",
      value: stats.totalVehicles.toString(),
      change: "+4%",
      changeType: "positive",
      description: "Tháng này",
      icon: Bike,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Doanh thu",
      value: `${(stats.totalRevenue / 1000000).toFixed(1)}M`,
      change: "-6%",
      changeType: "negative",
      description: "Tháng này",
      icon: TrendingUp,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Lợi nhuận",
      value: `${(stats.totalProfit / 1000000).toFixed(1)}M`,
      change: "-6%",
      changeType: "negative",
      description: "Tháng này",
      icon: Wallet,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
    },
    {
      title: "Đơn thuê",
      value: stats.totalRentals.toString(),
      change: "+8%",
      changeType: "positive",
      description: "Tháng này",
      icon: ClipboardList,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statsDisplay.map((stat) => (
          <Card key={stat.title} className="bg-white border-0 card-shadow rounded-2xl hover-lift">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{stat.title}</span>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-sm font-medium ${stat.changeType === "positive" ? "text-emerald-500" : "text-red-500"}`}>
                  {stat.change}
                </span>
                <span className="text-sm text-gray-400">{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <Card className="lg:col-span-2 bg-white border-0 card-shadow rounded-2xl">
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-800 pb-4">Đơn thuê gần đây</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-3 text-xs font-medium text-gray-400 uppercase">Xe</th>
                    <th className="pb-3 text-xs font-medium text-gray-400 uppercase">Ngày</th>
                    <th className="pb-3 text-xs font-medium text-gray-400 uppercase">Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                            <Bike className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{order.vehicle}</p>
                            <p className="text-xs text-gray-400">{order.customer}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-gray-600">{order.unit} ngày</td>
                      <td className="py-3 text-sm font-medium text-gray-800">{order.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Top Markets / Vehicles */}
        <Card className="bg-white border-0 card-shadow rounded-2xl">
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-800 pb-4">Xe được thuê nhiều</h3>
            <div className="space-y-3">
              {topVehicles.map((vehicle, index) => (
                <div key={vehicle.name} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{vehicle.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-6">
                      <svg viewBox="0 0 60 20" className="w-full h-full">
                        <path
                          d={`M0,${15 - index * 2} Q15,${10 - index} 30,${12 - index} T60,${8 + index}`}
                          fill="none"
                          stroke={index % 2 === 0 ? "#3b82f6" : "#f59e0b"}
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 w-12 text-right">{vehicle.rentals}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Top Selling Products / Vehicles Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Xe cho thuê phổ biến</h2>
          <select className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500">
            <option>Tháng này</option>
            <option>Tuần này</option>
            <option>Năm nay</option>
          </select>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {topVehicles.map((vehicle, index) => (
            <Card key={vehicle.name} className="bg-white border-0 card-shadow rounded-2xl hover-lift overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-800">{vehicle.name}</p>
                  <p className="text-xs text-gray-500">{vehicle.rentals} lượt thuê</p>
                  <span className={`inline-block mt-1 text-xs font-medium ${index === 2 ? "text-red-500" : "text-emerald-500"}`}>
                    {index === 2 ? "Hết xe" : "Còn xe"}
                  </span>
                </div>
                <div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center">
                  <Bike className="w-12 h-12 text-gray-300" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
