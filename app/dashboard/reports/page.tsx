"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Bike, Users, ClipboardList, DollarSign, Wallet, MoreVertical } from "lucide-react"
import { useState } from "react"
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
  PieChart,
  Pie,
  Cell,
} from "recharts"

const monthlyRevenue = [
  { month: "T1", revenue: 32000000, profit: 12800000 },
  { month: "T2", revenue: 38000000, profit: 15200000 },
  { month: "T3", revenue: 42000000, profit: 16800000 },
  { month: "T4", revenue: 39000000, profit: 15600000 },
  { month: "T5", revenue: 45200000, profit: 18600000 },
  { month: "T6", revenue: 0, profit: 0 },
]

const dailyRentals = [
  { day: "T2", rentals: 8 },
  { day: "T3", rentals: 12 },
  { day: "T4", rentals: 10 },
  { day: "T5", rentals: 15 },
  { day: "T6", rentals: 18 },
  { day: "T7", rentals: 22 },
  { day: "CN", rentals: 20 },
]

const vehicleTypeDistribution = [
  { name: "Tay ga", value: 55, color: "#3b82f6" },
  { name: "Côn tay", value: 30, color: "#10b981" },
  { name: "Số", value: 15, color: "#f59e0b" },
]

const topPerformingVehicles = [
  { name: "Honda SH 150i", rentals: 45, revenue: 13500000, profit: 5400000 },
  { name: "Yamaha Exciter 150", rentals: 38, revenue: 9500000, profit: 3800000 },
  { name: "Honda Vision", rentals: 32, revenue: 6400000, profit: 2560000 },
  { name: "Honda Wave Alpha", rentals: 28, revenue: 4200000, profit: 1890000 },
  { name: "Yamaha NVX 155", rentals: 25, revenue: 7000000, profit: 2800000 },
]

const stats = [
  {
    title: "Doanh thu",
    value: "45.2M",
    change: "+12.5%",
    changeType: "positive",
    icon: DollarSign,
    description: "Tháng này",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    title: "Lợi nhuận",
    value: "18.6M",
    change: "+8.2%",
    changeType: "positive",
    icon: Wallet,
    description: "Biên LN 41.2%",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
  {
    title: "Đơn thuê",
    value: "128",
    change: "+8.3%",
    changeType: "positive",
    icon: ClipboardList,
    description: "Tháng này",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    title: "Khách mới",
    value: "24",
    change: "+15.2%",
    changeType: "positive",
    icon: Users,
    description: "Tháng này",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-500",
  },
  {
    title: "Tỉ lệ thuê",
    value: "66.7%",
    change: "-2.1%",
    changeType: "negative",
    icon: Bike,
    description: "32/48 xe",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
  },
]

export default function ReportsPage() {
  const [period, setPeriod] = useState("month")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Báo cáo</h1>
          <p className="text-gray-500 text-sm mt-1">Thống kê và phân tích hoạt động kinh doanh</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-40 bg-white border-gray-200 rounded-xl text-gray-700">
            <SelectValue placeholder="Chọn kỳ báo cáo" />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-white border-gray-200">
            <SelectItem value="week">Tuần này</SelectItem>
            <SelectItem value="month">Tháng này</SelectItem>
            <SelectItem value="quarter">Quý này</SelectItem>
            <SelectItem value="year">Năm nay</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-white border-0 card-shadow rounded-2xl hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                  <span className="text-xs font-medium text-gray-500">{stat.title}</span>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xl font-bold text-gray-800">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs font-medium ${stat.changeType === "positive" ? "text-emerald-500" : "text-red-500"}`}>
                  {stat.change}
                </span>
                <span className="text-xs text-gray-400">{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue & Profit Chart */}
        <Card className="bg-white border-0 card-shadow rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-gray-800">Doanh thu & Lợi nhuận</CardTitle>
                <CardDescription className="text-gray-400 text-sm">6 tháng gần nhất</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Doanh thu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-500">Lợi nhuận</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    labelStyle={{ color: "#374151" }}
                    formatter={(value: number, name: string) => [
                      `${(value / 1000000).toFixed(1)}M VND`,
                      name === "revenue" ? "Doanh thu" : "Lợi nhuận"
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} name="revenue" />
                  <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} name="profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Rentals Chart */}
        <Card className="bg-white border-0 card-shadow rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-gray-800">Lượt thuê theo ngày</CardTitle>
                <CardDescription className="text-gray-400 text-sm">Trong tuần</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-500">128</span>
                <span className="text-xs text-gray-400">Tổng</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRentals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    labelStyle={{ color: "#374151" }}
                    formatter={(value: number) => [value, "Lượt thuê"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rentals"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vehicle Type Distribution */}
        <Card className="bg-white border-0 card-shadow rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Phân bố loại xe</CardTitle>
            <CardDescription className="text-gray-400 text-sm">Tỉ lệ các loại xe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {vehicleTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number) => [`${value}%`, "Tỉ lệ"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {vehicleTypeDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-gray-500">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Performing Vehicles */}
        <Card className="lg:col-span-2 bg-white border-0 card-shadow rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Xe được thuê nhiều nhất</CardTitle>
            <CardDescription className="text-gray-400 text-sm">Top 5 xe có lượt thuê cao nhất tháng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformingVehicles.map((vehicle, index) => (
                <div key={vehicle.name} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{vehicle.name}</p>
                      <div className="text-right">
                        <p className="text-sm text-gray-800 font-semibold">{(vehicle.revenue / 1000000).toFixed(1)}M</p>
                        <p className="text-xs text-emerald-500">+{(vehicle.profit / 1000000).toFixed(1)}M</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(vehicle.rentals / 45) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-12 text-right">{vehicle.rentals} lượt</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
