"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { supabase, fetchVehicles, fetchCustomers, fetchRentals } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye, ClipboardList, Calendar, User, Bike, Pencil, X, ImageIcon, Phone, MapPin, Facebook } from "lucide-react"

interface RentalOrder {
  id: string
  customerId: string
  customerName: string
  vehicleId: string
  vehicleName: string
  licensePlate: string
  startDate: string
  endDate: string
  totalDays: number
  pricePerDay: number
  totalPrice: number
  deposit: number
  extraFees: number
  notes: string
  revenue: number // Doanh thu: cancelled = deposit (mất cọc), completed = totalPrice (trả cọc)
  status: "pending" | "active" | "completed" | "cancelled"
  createdAt: string
}

interface Customer {
  id: string
  name: string
  phone: string
  facebook: string
  address: string
  idCard: string
  totalRentals: number
  status: "active" | "inactive"
  createdAt: string
  customerPhoto: string[]
  cccdFront: string[]
  cccdBack: string[]
  licenseFront: string[]
  licenseBack: string[]
}

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: "available" | "rented" | "maintenance"
  currentKm: number
  purchasePrice: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
}

// Lightbox component
function LightboxModal({ imageSrc, onClose }: { imageSrc: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
    >
      <div 
        className="absolute inset-0 cursor-pointer" 
        onPointerDown={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
      <button
        className="absolute top-4 right-4 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors z-20 cursor-pointer"
        onPointerDown={(e) => {
          e.stopPropagation()
          onClose()
        }}
        type="button"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <img
        src={imageSrc}
        alt="Xem ảnh phóng to"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg relative z-10"
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}

const statusMap = {
  pending: { label: "Chờ nhận xe", className: "bg-amber-50 text-amber-600" },
  active: { label: "Đang thuê", className: "bg-blue-50 text-blue-600" },
  completed: { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-600" },
  cancelled: { label: "Đã hủy", className: "bg-gray-100 text-gray-500" },
}

const vehicleStatusConfig = {
  available: { label: "Sẵn sàng", className: "bg-emerald-50 text-emerald-600" },
  rented: { label: "Đang thuê", className: "bg-blue-50 text-blue-600" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-600" },
}

export default function OrdersPage() {
  const { addAccessLog, user } = useAuth()
  const [orders, setOrders] = useState<RentalOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingOrder, setViewingOrder] = useState<RentalOrder | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
  const [editingOrder, setEditingOrder] = useState<RentalOrder | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    customerId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    deposit: "",
  })
  const [editFormData, setEditFormData] = useState({
    customerId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    deposit: "",
    extraFees: "",
    notes: "",
    status: "pending" as RentalOrder["status"],
  })

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [vehiclesData, customersData, rentalsData] = await Promise.all([
          fetchVehicles(),
          fetchCustomers(),
          fetchRentals(),
        ])
        setVehicles(vehiclesData || [])
        setCustomers(customersData || [])
        
        // Sort rentals by created_at descending (newest first) - client-side backup
        const sortedRentals = (rentalsData || []).sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime()
          const dateB = new Date(b.created_at || 0).getTime()
          return dateB - dateA // DESC (newest first)
        })
        setOrders(sortedRentals)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.vehicleName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === "all" || order.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const calculateTotalDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const customer = customers.find((c) => c.id === formData.customerId)
    const vehicle = vehicles.find((v) => v.id === formData.vehicleId)
    
    if (!customer || !vehicle) return

    const totalDays = calculateTotalDays(formData.startDate, formData.endDate)
    const totalPrice = totalDays * vehicle.pricePerDay

    try {
      // Insert to Supabase
      const { data, error } = await supabase
        .from('rentals')
        .insert([{
          customerId: customer.id,
          customerName: customer.name,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          licensePlate: vehicle.licensePlate,
          startDate: new Date(formData.startDate).toLocaleDateString("vi-VN"),
          endDate: new Date(formData.endDate).toLocaleDateString("vi-VN"),
          totalDays,
          pricePerDay: vehicle.pricePerDay,
          totalPrice,
          deposit: parseInt(formData.deposit),
          extraFees: 0,
          notes: "",
          revenue: 0,
          status: "pending",
        }])
        .select()

      if (error) {
        console.error("Error creating rental:", error)
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        const newOrder = data[0]
        setOrders([newOrder, ...orders])
        if (user) logger.addRental(user.username, user.displayName, customer.name, vehicle.name)
        resetForm()
      }
    } catch (error) {
      console.error("Exception creating rental:", error)
      alert(`❌ Lỗi tạo đơn thuê`)
    }
  }

  const resetForm = () => {
    setFormData({ customerId: "", vehicleId: "", startDate: "", endDate: "", deposit: "" })
    setIsDialogOpen(false)
  }

  const openEditDialog = (order: RentalOrder) => {
    setEditingOrder(order)
    setEditFormData({
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      startDate: "",
      endDate: "",
      deposit: order.deposit.toString(),
      extraFees: order.extraFees.toString(),
      notes: order.notes,
      status: order.status,
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return

    const customer = customers.find((c) => c.id === editFormData.customerId)
    const vehicle = vehicles.find((v) => v.id === editFormData.vehicleId)
    
    if (!customer || !vehicle) return

    try {
      // Update to Supabase
      const { error } = await supabase
        .from('rentals')
        .update({
          customerId: customer.id,
          customerName: customer.name,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          licensePlate: vehicle.licensePlate,
          deposit: parseInt(editFormData.deposit) || 0,
          extraFees: parseInt(editFormData.extraFees) || 0,
          notes: editFormData.notes.trim(),
          status: editFormData.status,
        })
        .eq('id', editingOrder.id)

      if (error) {
        console.error("Error updating rental:", error)
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      const updatedOrder: RentalOrder = {
        ...editingOrder,
        customerId: customer.id,
        customerName: customer.name,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        licensePlate: vehicle.licensePlate,
        deposit: parseInt(editFormData.deposit) || 0,
        extraFees: parseInt(editFormData.extraFees) || 0,
        notes: editFormData.notes.trim(),
        status: editFormData.status,
      }

      setOrders(orders.map((o) => (o.id === editingOrder.id ? updatedOrder : o)))
      if (user) logger.editRental(user.username, user.displayName, customer.name, vehicle.name)
      setIsEditDialogOpen(false)
      setEditingOrder(null)
    } catch (error) {
      console.error("Exception updating rental:", error)
      alert(`❌ Lỗi cập nhật đơn thuê`)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: RentalOrder["status"]) => {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return

    try {
      // Tính doanh thu dựa trên trạng thái
      let revenue = 0
      if (newStatus === "cancelled") {
        // Hủy đơn: khách mất cọc -> doanh thu = tiền cọc
        revenue = order.deposit
      } else if (newStatus === "completed") {
        // Hoàn thành: trả cọc, thu tiền thuê -> doanh thu = tiền thuê
        revenue = order.totalPrice
      }
      // pending và active chưa có doanh thu
      
      // Update to Supabase
      const { error } = await supabase
        .from('rentals')
        .update({ status: newStatus, revenue })
        .eq('id', orderId)

      if (error) {
        console.error("Error updating rental status:", error)
        alert(`❌ Lỗi: ${error.message}`)
        return
      }

      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus, revenue } : o)))
      const statusLabels: Record<string, string> = { pending: "Chờ nhận xe", active: "Đang thuê", completed: "Hoàn thành", cancelled: "Đã hủy" }
      if (user) logger.log(user.username, user.displayName, 'Chỉnh sửa', 'Đơn thuê', `Cập nhật đơn ${orderId}: ${statusLabels[newStatus]}`)
    } catch (error) {
      console.error("Exception updating rental status:", error)
      alert(`❌ Lỗi cập nhật trạng thái đơn thuê`)
    }
  }

  const openCustomerDetail = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId)
    if (customer) {
      setViewingCustomer(customer)
    }
  }

  const openVehicleDetail = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (vehicle) {
      setViewingVehicle(vehicle)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Đơn thuê</h1>
          <p className="text-gray-500 text-sm">Quản lý các đơn thuê xe</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Tạo đơn thuê mới
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-gray-200 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800">Tạo đơn thuê mới</DialogTitle>
              <DialogDescription className="text-gray-500">Nhập thông tin đơn thuê xe</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer" className="text-gray-600">Khách hàng</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                    <SelectValue placeholder="Chọn khách hàng" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 rounded-xl">
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle" className="text-gray-600">Xe thuê</Label>
                <Select
                  value={formData.vehicleId}
                  onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                    <SelectValue placeholder="Chọn xe" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 rounded-xl">
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} - {vehicle.licensePlate} ({vehicle.pricePerDay.toLocaleString("vi-VN")}/ngày)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-gray-600">Ngày bắt đầu</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-gray-600">Ngày kết thúc</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit" className="text-gray-600">Tiền đặt cọc (VND)</Label>
                <Input
                  id="deposit"
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                  placeholder="VD: 500000"
                  className="bg-gray-50 border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-gray-200">
                  Hủy
                </Button>
                <Button type="submit" className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
                  Tạo đơn
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo mã đơn, khách hàng hoặc xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 rounded-xl"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Lọc theo trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 rounded-xl">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="pending">Chờ nhận xe</SelectItem>
                <SelectItem value="active">Đang thuê</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">Danh sách đơn thuê</CardTitle>
          <CardDescription className="text-gray-500">Tổng cộng {filteredOrders.length} đơn thuê</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Xe thuê</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Thời gian</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Tổng tiền</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Doanh thu</th>
                  <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-2">
                      <span className="font-medium text-gray-800">{order.id}</span>
                    </td>
                    <td className="py-4 px-2">
                      <button
                        className="flex items-center gap-2 text-left hover:text-blue-600 transition-colors"
                        onClick={() => openCustomerDetail(order.customerId)}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 hover:text-blue-600 hover:underline">{order.customerName}</span>
                      </button>
                    </td>
                    <td className="py-4 px-2 hidden sm:table-cell">
                      <button
                        className="flex items-center gap-2 text-left hover:text-blue-600 transition-colors"
                        onClick={() => openVehicleDetail(order.vehicleId)}
                      >
                        <Bike className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-700 hover:text-blue-600 hover:underline">{order.vehicleName}</p>
                          <p className="text-xs text-gray-400">{order.licensePlate}</p>
                        </div>
                      </button>
                    </td>
                    <td className="py-4 px-2 hidden md:table-cell">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {order.startDate} - {order.endDate}
                      </div>
                      <p className="text-xs text-gray-400">{order.totalDays} ngày</p>
                    </td>
                    <td className="py-4 px-2 text-right hidden lg:table-cell">
                      <p className="text-sm font-medium text-blue-600">{order.totalPrice.toLocaleString("vi-VN")} VND</p>
                      <p className="text-xs text-gray-400">Cọc: {order.deposit.toLocaleString("vi-VN")}</p>
                    </td>
                    <td className="py-4 px-2 text-right hidden xl:table-cell">
                      {order.revenue > 0 ? (
                        <p className={`text-sm font-medium ${order.status === "cancelled" ? "text-amber-600" : "text-emerald-600"}`}>
                          {order.revenue.toLocaleString("vi-VN")} VND
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">-</p>
                      )}
                    </td>
                    <td className="py-4 px-2 text-center">
                      <Badge className={statusMap[order.status].className}>
                        {statusMap[order.status].label}
                      </Badge>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-gray-400 hover:text-blue-600 hover:bg-blue-50" 
                          onClick={() => setViewingOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-gray-400 hover:text-amber-600 hover:bg-amber-50" 
                          onClick={() => openEditDialog(order)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-400">Không tìm thấy đơn thuê nào</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Order Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-500" />
              Chi tiết đơn thuê {viewingOrder?.id}
            </DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Khách hàng</p>
                  <button 
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      openCustomerDetail(viewingOrder.customerId)
                    }}
                  >
                    {viewingOrder.customerName}
                  </button>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Xe thuê</p>
                  <button 
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      openVehicleDetail(viewingOrder.vehicleId)
                    }}
                  >
                    {viewingOrder.vehicleName}
                  </button>
                  <p className="text-xs text-gray-400">{viewingOrder.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày bắt đầu</p>
                  <p className="font-medium text-gray-800">{viewingOrder.startDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày kết thúc</p>
                  <p className="font-medium text-gray-800">{viewingOrder.endDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số ngày thuê</p>
                  <p className="font-medium text-gray-800">{viewingOrder.totalDays} ngày</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá thuê/ngày</p>
                  <p className="font-medium text-gray-800">{viewingOrder.pricePerDay.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tiền cọc</p>
                  <p className="font-medium text-gray-800">{viewingOrder.deposit.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tổng tiền thuê</p>
                  <p className="font-medium text-blue-600 text-lg">{viewingOrder.totalPrice.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phí phát sinh</p>
                  <p className="font-medium text-gray-800">
                    {viewingOrder.extraFees > 0
                      ? `${viewingOrder.extraFees.toLocaleString("vi-VN")} VND`
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ghi chú</p>
                <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">
                  {viewingOrder.notes || "—"}
                </p>
              </div>
              
              {/* Thông tin doanh thu */}
              <div className="pt-4 border-t border-gray-100">
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <h4 className="font-medium text-gray-800 text-sm">Thông tin tài chính</h4>
                  {viewingOrder.status === "pending" && (
                    <p className="text-sm text-gray-500">Chưa có doanh thu (đang chờ nhận xe)</p>
                  )}
                  {viewingOrder.status === "active" && (
                    <p className="text-sm text-gray-500">Chưa có doanh thu (đang trong quá trình thuê)</p>
                  )}
                  {viewingOrder.status === "completed" && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tiền thuê xe:</span>
                        <span className="font-medium text-emerald-600">+{viewingOrder.totalPrice.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Trả cọc cho khách:</span>
                        <span className="font-medium text-gray-500">-{viewingOrder.deposit.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Doanh thu thực nhận:</span>
                        <span className="font-bold text-emerald-600">{viewingOrder.revenue.toLocaleString("vi-VN")} VND</span>
                      </div>
                    </div>
                  )}
                  {viewingOrder.status === "cancelled" && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Khách hủy - Mất cọc:</span>
                        <span className="font-medium text-amber-600">+{viewingOrder.deposit.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Doanh thu:</span>
                        <span className="font-bold text-amber-600">{viewingOrder.revenue.toLocaleString("vi-VN")} VND</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {viewingOrder.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1 bg-blue-500 text-white hover:bg-blue-600 rounded-xl"
                    onClick={() => {
                      updateOrderStatus(viewingOrder.id, "active")
                      setViewingOrder(null)
                    }}
                  >
                    Xác nhận giao xe
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-gray-200"
                    onClick={() => {
                      updateOrderStatus(viewingOrder.id, "cancelled")
                      setViewingOrder(null)
                    }}
                  >
                    Hủy đơn
                  </Button>
                </div>
              )}
              {viewingOrder.status === "active" && (
                <Button
                  className="w-full bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl"
                  onClick={() => {
                    updateOrderStatus(viewingOrder.id, "completed")
                    setViewingOrder(null)
                  }}
                >
                  Hoàn thành đơn
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Sửa đơn thuê {editingOrder?.id}</DialogTitle>
            <DialogDescription className="text-gray-500">Chỉnh sửa thông tin đơn thuê</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-customer" className="text-gray-600">Khách hàng</Label>
              <Select
                value={editFormData.customerId}
                onValueChange={(value) => setEditFormData({ ...editFormData, customerId: value })}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-vehicle" className="text-gray-600">Xe thuê</Label>
              <Select
                value={editFormData.vehicleId}
                onValueChange={(value) => setEditFormData({ ...editFormData, vehicleId: value })}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Chọn xe" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} - {vehicle.licensePlate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-deposit" className="text-gray-600">Tiền đặt cọc (VND)</Label>
              <Input
                id="edit-deposit"
                type="number"
                min={0}
                value={editFormData.deposit}
                onChange={(e) => setEditFormData({ ...editFormData, deposit: e.target.value })}
                className="bg-gray-50 border-gray-200 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-extraFees" className="text-gray-600">Phí phát sinh (VND)</Label>
              <Input
                id="edit-extraFees"
                type="number"
                min={0}
                value={editFormData.extraFees}
                onChange={(e) => setEditFormData({ ...editFormData, extraFees: e.target.value })}
                className="bg-gray-50 border-gray-200 rounded-xl"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-gray-600">Ghi chú</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="bg-gray-50 border-gray-200 rounded-xl min-h-20 resize-y"
                placeholder="Nhập ghi chú cho đơn thuê..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status" className="text-gray-600">Trạng thái</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value: RentalOrder["status"]) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
                  <SelectItem value="pending">Chờ nhận xe</SelectItem>
                  <SelectItem value="active">Đang thuê</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl border-gray-200">
                Hủy
              </Button>
              <Button type="submit" className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={!!viewingCustomer} onOpenChange={(open) => {
        if (!open && !lightboxImage) setViewingCustomer(null)
      }}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Chi tiết khách hàng
            </DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Họ tên</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mã khách hàng</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số điện thoại</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-800">{viewingCustomer.phone}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Facebook</p>
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-500" />
                    <a 
                      href={viewingCustomer.facebook} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline truncate"
                    >
                      {viewingCustomer.facebook.replace("https://facebook.com/", "")}
                    </a>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Địa chỉ</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-800">{viewingCustomer.address}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">CCCD</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.idCard}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số lần thuê</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.totalRentals} lần</p>
                </div>
              </div>

              {/* Customer Photo */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh khách hàng</p>
                {viewingCustomer.customerPhoto.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingCustomer.customerPhoto.map((img, index) => (
                      <div 
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      >
                        <img src={img} alt={`Ảnh ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-3 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              {/* CCCD Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh CCCD</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt trước</p>
                    {viewingCustomer.cccdFront.length > 0 ? (
                      <div 
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(viewingCustomer.cccdFront[0])}
                      >
                        <img src={viewingCustomer.cccdFront[0]} alt="CCCD mặt trước" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt sau</p>
                    {viewingCustomer.cccdBack.length > 0 ? (
                      <div 
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(viewingCustomer.cccdBack[0])}
                      >
                        <img src={viewingCustomer.cccdBack[0]} alt="CCCD mặt sau" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* License Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Giấy phép lái xe</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt trước</p>
                    {viewingCustomer.licenseFront.length > 0 ? (
                      <div 
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(viewingCustomer.licenseFront[0])}
                      >
                        <img src={viewingCustomer.licenseFront[0]} alt="GPLX mặt trước" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Mặt sau</p>
                    {viewingCustomer.licenseBack.length > 0 ? (
                      <div 
                        className="aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(viewingCustomer.licenseBack[0])}
                      >
                        <img src={viewingCustomer.licenseBack[0]} alt="GPLX mặt sau" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCustomer(null)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog */}
      <Dialog open={!!viewingVehicle} onOpenChange={(open) => {
        if (!open && !lightboxImage) setViewingVehicle(null)
      }}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-500" />
              Chi tiết xe
            </DialogTitle>
          </DialogHeader>
          {viewingVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Loại xe</p>
                  <p className="font-medium text-gray-800">{viewingVehicle.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Biển số</p>
                  <p className="font-medium text-gray-800 font-mono">{viewingVehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Màu xe</p>
                  <p className="font-medium text-gray-800">{viewingVehicle.color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Trạng thái</p>
                  <Badge className={vehicleStatusConfig[viewingVehicle.status].className}>
                    {vehicleStatusConfig[viewingVehicle.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá thuê/ngày</p>
                  <p className="font-medium text-blue-600">{viewingVehicle.pricePerDay.toLocaleString("vi-VN")} VND</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số KM hiện tại</p>
                  <p className="font-medium text-gray-800">{viewingVehicle.currentKm.toLocaleString("vi-VN")} km</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Giá mua xe</p>
                  <p className="font-medium text-gray-800">{viewingVehicle.purchasePrice.toLocaleString("vi-VN")} VND</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ghi chú</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-xl">{viewingVehicle.notes || "Không có ghi chú"}</p>
              </div>

              {/* Vehicle Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh xe</p>
                {viewingVehicle.vehicleImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingVehicle.vehicleImages.map((img, index) => (
                      <div 
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      >
                        <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-3 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Chưa có ảnh xe</span>
                  </div>
                )}
              </div>

              {/* Document Images */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Ảnh giấy tờ xe</p>
                {viewingVehicle.documentImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingVehicle.documentImages.map((img, index) => (
                      <div 
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      >
                        <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-3 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Chưa có ảnh giấy tờ</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingVehicle(null)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxImage && (
        <LightboxModal 
          imageSrc={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}
    </div>
  )
}
