"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { supabase } from "@/lib/supabase"
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
import { Plus, Search, Eye, Calendar, User, Bike, Pencil, X } from "lucide-react"

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
  revenue: number
  status: "pending" | "active" | "completed" | "cancelled"
  createdAt: string
}

interface Customer {
  id: string
  name: string
  phone: string
  address: string
}

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: "available" | "rented" | "maintenance"
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<RentalOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [viewingOrder, setViewingOrder] = useState<RentalOrder | null>(null)
  const [editingOrder, setEditingOrder] = useState<RentalOrder | null>(null)
  
  const [formData, setFormData] = useState({ customerId: "", vehicleId: "", startDate: "", endDate: "", deposit: "" })
  const [editFormData, setEditFormData] = useState({ customerId: "", vehicleId: "", startDate: "", endDate: "", deposit: "", extraFees: "", notes: "", status: "pending" as const })

  // Load data from Supabase
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Fetch rentals
      const { data: rentalsData } = await supabase.from("rentals").select("*").order("created_at", { ascending: false })
      setOrders(rentalsData || [])

      // Fetch customers
      const { data: customersData } = await supabase.from("customers").select("*").order("created_at", { ascending: false })
      setCustomers(customersData || [])

      // Fetch vehicles
      const { data: vehiclesData } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false })
      setVehicles(vehiclesData || [])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const s = new Date(start)
    const e = new Date(end)
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customerId || !formData.vehicleId || !formData.startDate || !formData.endDate) return

    const customer = customers.find((c) => c.id === formData.customerId)
    const vehicle = vehicles.find((v) => v.id === formData.vehicleId)
    if (!customer || !vehicle) return

    const totalDays = calculateDays(formData.startDate, formData.endDate)
    const totalPrice = totalDays * vehicle.pricePerDay

    const newOrder = {
      customerId: customer.id,
      customerName: customer.name,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      licensePlate: vehicle.licensePlate,
      startDate: formData.startDate,
      endDate: formData.endDate,
      totalDays,
      pricePerDay: vehicle.pricePerDay,
      totalPrice,
      deposit: parseInt(formData.deposit) || 0,
      extraFees: 0,
      notes: "",
      revenue: 0,
      status: "pending" as const,
    }

    try {
      const { error } = await supabase.from("rentals").insert([newOrder])
      if (error) {
        alert("❌ Lỗi: " + error.message)
      } else {
        setOrders([newOrder as RentalOrder, ...orders])
        if (user) logger.addRental(user.username, user.displayName, customer.name, vehicle.name)
        resetForm()
      }
    } catch (error) {
      alert("❌ Lỗi: " + (error instanceof Error ? error.message : "Unknown"))
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return

    const customer = customers.find((c) => c.id === editFormData.customerId)
    const vehicle = vehicles.find((v) => v.id === editFormData.vehicleId)
    if (!customer || !vehicle) return

    try {
      const { error } = await supabase.from("rentals").update(editFormData).eq("id", editingOrder.id)
      if (error) {
        alert("❌ Lỗi: " + error.message)
      } else {
        setOrders(orders.map((o) => (o.id === editingOrder.id ? { ...editingOrder, ...editFormData } : o)))
        if (user) logger.editRental(user.username, user.displayName, customer.name, vehicle.name)
        setIsEditDialogOpen(false)
        setEditingOrder(null)
      }
    } catch (error) {
      alert("❌ Lỗi: " + (error instanceof Error ? error.message : "Unknown"))
    }
  }

  const handleDeleteRental = async (orderId: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa đơn thuê này?")) return

    try {
      const { error } = await supabase.from("rentals").delete().eq("id", orderId)
      if (error) {
        alert("❌ Lỗi: " + error.message)
      } else {
        setOrders(orders.filter((o) => o.id !== orderId))
        if (user) logger.log(user.username, user.displayName, "Xóa", "Đơn thuê", `Xóa đơn #${orderId}`)
      }
    } catch (error) {
      alert("❌ Lỗi: " + (error instanceof Error ? error.message : "Unknown"))
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "active" | "completed" | "cancelled") => {
    try {
      const { error } = await supabase.from("rentals").update({ status: newStatus }).eq("id", orderId)
      if (error) {
        alert("❌ Lỗi: " + error.message)
      } else {
        setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))
        const statusLabels: Record<string, string> = { pending: "Chờ nhận xe", active: "Đang thuê", completed: "Hoàn thành", cancelled: "Đã hủy" }
        if (user) logger.log(user.username, user.displayName, "Chỉnh sửa", "Đơn thuê", `Cập nhật đơn #${orderId}: ${statusLabels[newStatus]}`)
      }
    } catch (error) {
      alert("❌ Lỗi: " + (error instanceof Error ? error.message : "Unknown"))
    }
  }

  const openEditDialog = (order: RentalOrder) => {
    setEditingOrder(order)
    setEditFormData({
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      startDate: order.startDate,
      endDate: order.endDate,
      deposit: order.deposit.toString(),
      extraFees: order.extraFees.toString(),
      notes: order.notes,
      status: order.status,
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({ customerId: "", vehicleId: "", startDate: "", endDate: "", deposit: "" })
    setIsDialogOpen(false)
  }

  const filteredOrders = orders.filter((order) => {
    const matchSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = filterStatus === "all" || order.status === filterStatus
    return matchSearch && matchStatus
  })

  if (loading) {
    return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-96 bg-gray-200 rounded"></div></div></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Đơn Thuê</h1>
          <p className="text-gray-600 mt-1">Quản lý các đơn thuê xe</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600 gap-2">
              <Plus className="w-4 h-4" />
              Thêm Đơn Thuê
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo Đơn Thuê Mới</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <Label>Khách Hàng</Label>
                <Select value={formData.customerId} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khách hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Xe</Label>
                <Select value={formData.vehicleId} onValueChange={(v) => setFormData({ ...formData, vehicleId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn xe" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name} ({v.licensePlate})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ngày Nhận</Label>
                  <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div>
                  <Label>Ngày Trả</Label>
                  <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Tiền Cọc (VND)</Label>
                <Input type="number" value={formData.deposit} onChange={(e) => setFormData({ ...formData, deposit: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Hủy</Button>
                <Button type="submit" className="bg-blue-500">Tạo Đơn</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh Sách Đơn Thuê</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input placeholder="Tìm khách, xe, biển số..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất Cả Trạng Thái</SelectItem>
                  <SelectItem value="pending">Chờ Nhận Xe</SelectItem>
                  <SelectItem value="active">Đang Thuê</SelectItem>
                  <SelectItem value="completed">Hoàn Thành</SelectItem>
                  <SelectItem value="cancelled">Đã Hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Không có đơn thuê</div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{order.customerName} - {order.vehicleName}</h3>
                          <Badge className={order.status === "pending" ? "bg-yellow-100 text-yellow-800" : order.status === "active" ? "bg-blue-100 text-blue-800" : order.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {order.status === "pending" ? "Chờ Nhận" : order.status === "active" ? "Đang Thuê" : order.status === "completed" ? "Hoàn Thành" : "Đã Hủy"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{order.licensePlate} | {order.totalDays} ngày | {order.totalPrice.toLocaleString()} VND</p>
                        <p className="text-sm text-gray-500 mt-1">{order.startDate} → {order.endDate}</p>
                      </div>
                      <div className="flex gap-2">
                        <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v as any)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Chờ Nhận</SelectItem>
                            <SelectItem value="active">Đang Thuê</SelectItem>
                            <SelectItem value="completed">Hoàn Thành</SelectItem>
                            <SelectItem value="cancelled">Hủy</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => { setViewingOrder(order); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(order)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteRental(order.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa Đơn Thuê</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label>Khách Hàng</Label>
                <Select value={editFormData.customerId} onValueChange={(v) => setEditFormData({ ...editFormData, customerId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Xe</Label>
                <Select value={editFormData.vehicleId} onValueChange={(v) => setEditFormData({ ...editFormData, vehicleId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ngày Nhận</Label>
                  <Input type="date" value={editFormData.startDate} onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })} />
                </div>
                <div>
                  <Label>Ngày Trả</Label>
                  <Input type="date" value={editFormData.endDate} onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Hủy</Button>
                <Button type="submit" className="bg-blue-500">Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
