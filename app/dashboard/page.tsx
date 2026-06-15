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
import { Bike, Users, ClipboardList, TrendingUp, Wallet, Eye , Plus, X} from "lucide-react"
import { fetchVehicles, fetchRentals, fetchTransactions, fetchCustomers, insertCustomer, supabase } from "@/lib/supabase"
import { uploadImage } from "@/lib/storage"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"

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
  const { user } = useAuth()
  const [customers, setCustomers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    customerId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    deposit: "",
    commissionHome: "",
    homeName: "",
  })
  const [customerSearch, setCustomerSearch] = useState("")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
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
    v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
    (v.licensePlate && v.licensePlate.toLowerCase().includes(vehicleSearch.toLowerCase()))
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
    setFormData({ customerId: "", vehicleId: "", startDate: "", endDate: "", deposit: "", commissionHome: "", homeName: "" })
    setIsNewCustomer(false)
    setNewCustomerName("")
    setNewCustomerPhone("")
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
    
    const vehicle = vehicles.find((v) => v.id === formData.vehicleId)
    if (!vehicle) {
      alert("⚠️ Vui lòng chọn xe thuê!")
      return
    }

    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)
    
    if (startDate > endDate) {
      alert("⚠️ Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")
      return
    }

    const conflictingRental = orders.find((order) => {
      if (order.vehicleId !== vehicle.id) return false
      if (order.status === "cancelled") return false
      
      const orderStart = new Date(order.startDate.split('/').reverse().join('-'))
      const orderEnd = new Date(order.endDate.split('/').reverse().join('-'))
      
      return !(endDate < orderStart || startDate > orderEnd)
    })
    
    if (conflictingRental) {
      alert(`⚠️ Xe "${vehicle.name}" (${vehicle.licensePlate}) đã được thuê trong khoảng thời gian này!\n\nKhách: ${conflictingRental.customerName}\nNgày: ${conflictingRental.startDate} - ${conflictingRental.endDate}\nTrạng thái: ${conflictingRental.status}`)
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
        if (!newCustomerCCCD.trim()) {
          alert("⚠️ Vui lòng nhập số CCCD khách hàng!")
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
          address: "",
          idcard: newCustomerCCCD.trim(),
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
      const totalPrice = totalDays * vehicle.pricePerDay
      const startDateVN = new Date(formData.startDate).toLocaleDateString("vi-VN")
      const now = new Date().toISOString()

      const commissionHomeVal = hasCommission ? (parseMoneyInput(formData.commissionHome) || 0) : 0
      const homeNameVal = hasCommission ? formData.homeName.trim() : ""

      const { data, error } = await supabase
        .from('rentals')
        .insert([{
          customerId,
          customerName,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          licensePlate: vehicle.licensePlate,
          startDate: startDateVN,
          endDate: new Date(formData.endDate).toLocaleDateString("vi-VN"),
          totalDays,
          pricePerDay: vehicle.pricePerDay,
          totalPrice,
          deposit: parseMoneyInput(formData.deposit),
          extraFees: 0,
          notes: "",
          revenue: 0,
          status: "pending",
          created_at: now,
          commissionHome: commissionHomeVal,
          homeName: homeNameVal,
        }])
        .select()

      if (error) {
        console.error("Error creating rental:", error)
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        loadDashboardData(false)
        resetForm()
      }
    } catch (error) {
      console.error("Exception creating rental:", error)
      alert(`❌ Lỗi tạo đơn thuê`)
    }
  }
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

  const loadDashboardData = async () => {
    try {
      const vehicles = await fetchVehicles()
      setVehicles(vehicles || [])
      const rentals = await fetchRentals()
      setOrders(rentals || [])
      const transactions = await fetchTransactions()
      const customersData = await fetchCustomers()
      setCustomers(customersData || [])

      // Calculate stats
      const completedRentals = rentals.filter((r: any) => r.status === 'completed')
      
      // Rental revenue (from completed rentals, includes extraFees via revenue field)
      const rentalRevenue = completedRentals.reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
      
      // Transaction totals
      const totalIncome = transactions
        .filter((tx: any) => tx.type === 'income')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      const totalExpense = transactions
        .filter((tx: any) => tx.type === 'expense')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      // NEW LOGIC:
      // Doanh thu = Rental revenue + Income from transactions
      const totalRevenue = rentalRevenue + totalIncome
      
      // Lợi nhuận = Rental revenue ONLY (not counting transactions)
      const totalProfit = rentalRevenue

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

  useEffect(() => {
    loadDashboardData()

    // Subscribe to real-time events for rentals, vehicles, transactions
    const dashboardChannel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => {
        loadDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        loadDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(dashboardChannel)
    }
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
            {/* ── Create Order Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-h-[90vh] overflow-y-auto max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Tạo đơn thuê mới</DialogTitle>
            <p className="text-gray-500 text-sm">Nhập thông tin đơn thuê xe</p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CỘT 1: KHÁCH THUÊ */}
              <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-gray-100 pb-6 lg:pb-0 lg:pr-6">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">1. Khách thuê</h3>
                
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(false)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${!isNewCustomer ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Khách cũ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(true)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${isNewCustomer ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Khách mới
                  </button>
                </div>

                {!isNewCustomer ? (
                  <div className="space-y-2 relative">
                    <Label htmlFor="customer" className="text-gray-600">Tìm kiếm khách hàng</Label>
                    <Input
                      placeholder="Nhập tên, số điện thoại hoặc ID khách..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setShowCustomerDropdown(true)
                        setFormData(prev => ({ ...prev, customerId: "" }))
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="bg-gray-50 border-gray-200 rounded-xl"
                      required={!isNewCustomer}
                    />
                    {showCustomerDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)} />
                        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1">
                          {filteredCustomersForSelect.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 text-center">Không tìm thấy khách hàng nào</div>
                          ) : (
                            filteredCustomersForSelect.map((customer) => (
                              <div
                                key={customer.id}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, customerId: customer.id }))
                                  setCustomerSearch(`${customer.name} (${customer.phone || 'Không có SĐT'})`)
                                  setShowCustomerDropdown(false)
                                }}
                                className="p-3 text-sm text-gray-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                              >
                                <span className="font-semibold">{customer.name}</span> {customer.phone ? `- ${customer.phone}` : ''} <span className="text-xs text-gray-400">({customer.id})</span>
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
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Tên khách hàng *</Label>
                      <Input
                        placeholder="Nhập họ và tên..."
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm"
                        required={isNewCustomer}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Số điện thoại</Label>
                      <Input
                        placeholder="Nhập số điện thoại..."
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Số CCCD khách *</Label>
                      <Input
                        placeholder="Nhập số CCCD..."
                        value={newCustomerCCCD}
                        onChange={(e) => setNewCustomerCCCD(e.target.value)}
                        className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm"
                        required={isNewCustomer}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Ảnh khách</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewCustomerPhoto(e.target.files?.[0] || null)}
                        className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm p-1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-xs">Ảnh CCCD khách</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewCustomerCCCDFront(e.target.files?.[0] || null)}
                        className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm p-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CỘT 2: XE THUÊ */}
              <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-gray-100 pb-6 lg:pb-0 lg:pr-6">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">2. Xe thuê</h3>
                <div className="space-y-2 relative">
                  <Label htmlFor="vehicle" className="text-gray-600">Chọn xe thuê</Label>
                  <Input
                    placeholder="Nhập tên xe hoặc biển số..."
                    value={vehicleSearch}
                    onChange={(e) => {
                      setVehicleSearch(e.target.value)
                      setShowVehicleDropdown(true)
                      setFormData(prev => ({ ...prev, vehicleId: "" }))
                    }}
                    onFocus={() => setShowVehicleDropdown(true)}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                  {showVehicleDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowVehicleDropdown(false)} />
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1">
                        {filteredVehiclesForSelect.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">Không tìm thấy xe nào</div>
                        ) : (
                          filteredVehiclesForSelect.map((vehicle) => (
                            <div
                              key={vehicle.id}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, vehicleId: vehicle.id }))
                                setVehicleSearch(`${vehicle.name} - ${vehicle.licensePlate}`)
                                setShowVehicleDropdown(false)
                              }}
                              className="p-3 text-sm text-gray-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                            >
                              <span className="font-semibold">{vehicle.name}</span> - <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">{vehicle.licensePlate}</span> <span className="text-xs text-gray-500">({vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày)</span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                  <input type="hidden" name="vehicleId" value={formData.vehicleId} required />
                </div>
              </div>

              {/* CỘT 3: LÊN ĐƠN */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">3. Lên đơn</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="startDate" className="text-gray-600 text-xs">Ngày bắt đầu</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="endDate" className="text-gray-600 text-xs">Ngày kết thúc</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="bg-gray-50 border-gray-200 rounded-xl h-9 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="deposit" className="text-gray-600 text-xs">Tiền đặt cọc (VND)</Label>
                  <Input
                    id="deposit"
                    type="text"
                    value={formData.deposit}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setFormData({ ...formData, deposit: formatted })
                    }}
                    placeholder="VD: 500.000"
                    className="bg-gray-50 border-gray-200 rounded-xl font-mono h-9 text-sm"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    id="hasCommission"
                    type="checkbox"
                    checked={hasCommission}
                    onChange={(e) => setHasCommission(e.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
                  />
                  <Label htmlFor="hasCommission" className="text-gray-700 text-sm font-semibold cursor-pointer">Chia hoa hồng</Label>
                </div>

                {hasCommission && (
                  <div className="grid grid-cols-1 gap-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="space-y-1">
                      <Label htmlFor="homeName" className="text-gray-600 text-xs">Tên Home</Label>
                      <Input
                        id="homeName"
                        type="text"
                        value={formData.homeName}
                        onChange={(e) => setFormData({ ...formData, homeName: e.target.value })}
                        placeholder="VD: Home ABC"
                        className="bg-white border-gray-200 rounded-xl h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="commissionHome" className="text-gray-600 text-xs">Chia hoa hồng cho Home (VND/ngày)</Label>
                      <Input
                        id="commissionHome"
                        type="text"
                        value={formData.commissionHome}
                        onChange={(e) => {
                          const formatted = formatMoneyInput(e.target.value)
                          setFormData({ ...formData, commissionHome: formatted })
                        }}
                        placeholder="VD: 20.000"
                        className="bg-white border-gray-200 rounded-xl font-mono h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-gray-200">
                Hủy
              </Button>
              <Button type="submit" className="bg-red-600 text-white hover:bg-red-700 rounded-xl">
                Tạo đơn
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Order Detail Dialog ── */}
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
