"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Bike, Users, ClipboardList, TrendingUp, Wallet, Eye } from "lucide-react"
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
  id: string
  name: string
  licensePlate: string
  rentals: number
  revenue: string
  profit: string
  image?: string[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalRentals: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog states
  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<TopVehicle | null>(null)
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false)
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const vehicles = await fetchVehicles()
        const rentals = await fetchRentals()

        // Calculate stats
        const completedRentals = rentals.filter((r: any) => r.status === 'completed')
        // Revenue = sum of all revenue from completed rentals (includes extraFees)
        const totalRevenue = completedRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
        
        // Profit = total revenue - purchase price of all vehicles
        const totalVehicleCost = vehicles.reduce((sum: number, v: any) => sum + (v.purchasePrice || 0), 0)
        const totalProfit = totalRevenue - totalVehicleCost

        setStats({
          totalVehicles: vehicles.length,
          totalRevenue,
          totalProfit,
          totalRentals: rentals.length,
        })

        // Map recent rentals for display
        const recent = rentals.slice(0, 5).map((r: any) => ({
          id: r.id,
          customer: r.customerName,
          vehicle: r.vehicleName,
          price: `${(r.pricePerDay / 1000).toFixed(0)}K`,
          unit: r.totalDays,
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
            revenue: `${vehicleRevenue.toLocaleString("vi-VN")} VNĐ`,
            profit: `${vehicleProfit.toLocaleString("vi-VN")} VNĐ`,
            image: v.vehicleImages || [],
          }
        }).sort((a, b) => b.rentals - a.rentals).slice(0, 4)

        setTopVehicles(vehiclesWithRentals)
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tổng Quan</h1>
        <p className="text-gray-600 mt-1">Xem tổng hợp thông tin hoạt động</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vehicles */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/dashboard/vehicles")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tổng Số Xe</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalVehicles}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Bike className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Rentals */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/dashboard/orders")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Đơn Thuê</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalRentals}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <ClipboardList className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/dashboard/reports")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Doanh Thu</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{formatPrice(stats.totalRevenue)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/dashboard/reports")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lợi Nhuận</p>
                <p className="text-2xl font-bold text-emerald-600 mt-2">{formatPrice(stats.totalProfit)}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Rentals */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Đơn Thuê Gần Đây</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Không có đơn thuê</p>
                ) : (
                  recentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order)
                        setIsOrderDialogOpen(true)
                      }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{order.customer}</p>
                        <p className="text-sm text-gray-600">{order.vehicle}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{order.price}/ngày</p>
                        <p className="text-sm text-gray-600">{order.unit} ngày</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Vehicles */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Xe Thuê Nhiều</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topVehicles.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Không có dữ liệu</p>
                ) : (
                  topVehicles.slice(0, 5).map((vehicle) => (
                    <div
                      key={vehicle.id}
                      onClick={() => {
                        setSelectedVehicle(vehicle)
                        setIsVehicleDialogOpen(true)
                      }}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <p className="font-medium text-gray-900">{vehicle.name}</p>
                      <p className="text-xs text-gray-600">{vehicle.licensePlate}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-1">{vehicle.rentals} lần thuê</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Popular Vehicles */}
      <Card>
        <CardHeader>
          <CardTitle>Xe Cho Thuê Phổ Biến</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {topVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => {
                  setSelectedVehicle(vehicle)
                  setIsVehicleDialogOpen(true)
                }}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                {/* Image */}
                <div className="aspect-video bg-gray-200 overflow-hidden">
                  {vehicle.image && vehicle.image.length > 0 ? (
                    <img
                      src={vehicle.image[0]}
                      alt={vehicle.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400">
                      <Bike className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="font-semibold text-gray-900">{vehicle.name}</p>
                  <p className="text-sm text-gray-600">{vehicle.licensePlate}</p>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">Doanh Thu</p>
                      <p className="font-semibold text-green-600">{vehicle.revenue}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Lợi Nhuận</p>
                      <p className="font-semibold text-emerald-600">{vehicle.profit}</p>
                    </div>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedVehicle(vehicle)
                      setIsVehicleDialogOpen(true)
                    }}
                    className="w-full mt-3 bg-blue-500 hover:bg-blue-600"
                    size="sm"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Chi Tiết
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi Tiết Đơn Thuê</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Khách Hàng</p>
                <p className="font-semibold text-gray-900">{selectedOrder.customer}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Xe Thuê</p>
                <p className="font-semibold text-gray-900">{selectedOrder.vehicle}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Giá Thuê</p>
                <p className="font-semibold text-gray-900">{selectedOrder.price}/ngày</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Số Ngày</p>
                <p className="font-semibold text-gray-900">{selectedOrder.unit} ngày</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog */}
      <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi Tiết Xe</DialogTitle>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              {/* Image Gallery */}
              {selectedVehicle.image && selectedVehicle.image.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedVehicle.image.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${selectedVehicle.name} ${idx + 1}`}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Tên Xe</p>
                  <p className="font-semibold text-gray-900">{selectedVehicle.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Biển Số</p>
                  <p className="font-semibold text-gray-900">{selectedVehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lần Thuê</p>
                  <p className="font-semibold text-gray-900">{selectedVehicle.rentals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Doanh Thu</p>
                  <p className="font-semibold text-green-600">{selectedVehicle.revenue}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lợi Nhuận</p>
                  <p className="font-semibold text-emerald-600">{selectedVehicle.profit}</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  setIsVehicleDialogOpen(false)
                  router.push("/dashboard/vehicles")
                }}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                Xem Chi Tiết Đầy Đủ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
