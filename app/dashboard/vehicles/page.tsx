"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchVehicles } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Search, Pencil, Trash2, Bike, Eye, Clock, Upload, X, ImageIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

type VehicleStatus = "available" | "rented" | "maintenance"
type HistoryType = "rent" | "return" | "maintenance"

// Lightbox component tách riêng để tránh xung đột với Dialog
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

interface HistoryLog {
  id: string
  vehicleId: string
  type: HistoryType
  datetime: string
  description: string
}

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: VehicleStatus
  currentKm: number
  totalRentalDays: number
  purchasePrice: number
  totalRevenue: number
  profit: number
  maintenanceCost: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
}

const statusConfig: Record<VehicleStatus, { label: string; className: string }> = {
  available: { label: "Sẵn sàng", className: "bg-emerald-50 text-emerald-600" },
  rented: { label: "Đang thuê", className: "bg-blue-50 text-blue-600" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-600" },
}

const historyTypeConfig: Record<HistoryType, { label: string; className: string }> = {
  rent: { label: "Cho thuê", className: "bg-blue-50 text-blue-600" },
  return: { label: "Nhận lại xe", className: "bg-emerald-50 text-emerald-600" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-600" },
}

export default function VehiclesPage() {
  const { user, addAccessLog } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [newVehicle, setNewVehicle] = useState({
    name: "",
    licensePlate: "",
    color: "",
    pricePerDay: "",
    currentKm: "",
    purchasePrice: "",
    notes: "",
    status: "available" as VehicleStatus,
    vehicleImages: [] as string[],
    documentImages: [] as string[],
  })

  useEffect(() => {
    const loadVehicles = async () => {
      setIsLoading(true)
      try {
        const data = await fetchVehicles()
        setVehicles(data)
      } catch (error) {
        console.error("Failed to fetch vehicles:", error)
        setVehicles([])
      } finally {
        setIsLoading(false)
      }
    }
    loadVehicles()
  }, [])

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddVehicle = async () => {
    if (newVehicle.name && newVehicle.licensePlate && newVehicle.pricePerDay) {
      try {
        const { error } = await supabase
          .from('vehicles')
          .insert([{
            name: newVehicle.name,
            licensePlate: newVehicle.licensePlate,
            color: newVehicle.color,
            pricePerDay: parseInt(newVehicle.pricePerDay),
            currentKm: parseInt(newVehicle.currentKm) || 0,
            purchasePrice: parseInt(newVehicle.purchasePrice) || 0,
            notes: newVehicle.notes,
            status: newVehicle.status,
            vehicleImages: newVehicle.vehicleImages,
            documentImages: newVehicle.documentImages,
          }])
        
        if (error) {
          console.error("Error adding vehicle:", error)
        } else {
          // Reload vehicles from Supabase
          const updated = await fetchVehicles()
          setVehicles(updated)
          addAccessLog("Thêm mới", "Quản lý xe", `Thêm xe mới: ${newVehicle.name} (${newVehicle.licensePlate})`)
          setNewVehicle({ name: "", licensePlate: "", color: "", pricePerDay: "", currentKm: "", purchasePrice: "", notes: "", status: "available", vehicleImages: [], documentImages: [] })
          setIsAddDialogOpen(false)
        }
      } catch (error) {
        console.error("Error adding vehicle:", error)
      }
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'vehicle' | 'document', isEdit: boolean = false) => {
    const files = e.target.files
    if (files) {
      const newImages: string[] = []
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          newImages.push(reader.result as string)
          if (newImages.length === files.length) {
            if (isEdit && editingVehicle) {
              if (type === 'vehicle') {
                setEditingVehicle({ ...editingVehicle, vehicleImages: [...editingVehicle.vehicleImages, ...newImages] })
              } else {
                setEditingVehicle({ ...editingVehicle, documentImages: [...editingVehicle.documentImages, ...newImages] })
              }
            } else {
              if (type === 'vehicle') {
                setNewVehicle(prev => ({ ...prev, vehicleImages: [...prev.vehicleImages, ...newImages] }))
              } else {
                setNewVehicle(prev => ({ ...prev, documentImages: [...prev.documentImages, ...newImages] }))
              }
            }
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number, type: 'vehicle' | 'document', isEdit: boolean = false) => {
    if (isEdit && editingVehicle) {
      if (type === 'vehicle') {
        setEditingVehicle({ ...editingVehicle, vehicleImages: editingVehicle.vehicleImages.filter((_, i) => i !== index) })
      } else {
        setEditingVehicle({ ...editingVehicle, documentImages: editingVehicle.documentImages.filter((_, i) => i !== index) })
      }
    } else {
      if (type === 'vehicle') {
        setNewVehicle(prev => ({ ...prev, vehicleImages: prev.vehicleImages.filter((_, i) => i !== index) }))
      } else {
        setNewVehicle(prev => ({ ...prev, documentImages: prev.documentImages.filter((_, i) => i !== index) }))
      }
    }
  }

  const handleEditVehicle = async () => {
    if (editingVehicle) {
      try {
        const { error } = await (await import("@/lib/supabase")).supabase
          .from('vehicles')
          .update(editingVehicle)
          .eq('id', editingVehicle.id)
        
        if (error) {
          console.error("Error updating vehicle:", error)
        } else {
          setVehicles(vehicles.map((v) => (v.id === editingVehicle.id ? editingVehicle : v)))
          addAccessLog("Chỉnh sửa", "Quản lý xe", `Sửa thông tin xe: ${editingVehicle.name} (${editingVehicle.licensePlate})`)
          setIsEditDialogOpen(false)
          setEditingVehicle(null)
        }
      } catch (error) {
        console.error("Error updating vehicle:", error)
      }
    }
  }

  const handleDeleteVehicle = async (id: string) => {
    const vehicleToDelete = vehicles.find((v) => v.id === id)
    try {
      const { error } = await (await import("@/lib/supabase")).supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error("Error deleting vehicle:", error)
      } else {
        setVehicles(vehicles.filter((v) => v.id !== id))
        if (vehicleToDelete) {
          addAccessLog("Xóa", "Quản lý xe", `Xóa xe: ${vehicleToDelete.name} (${vehicleToDelete.licensePlate})`)
        }
      }
    } catch (error) {
      console.error("Error deleting vehicle:", error)
    }
  }

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle({ ...vehicle })
    setIsEditDialogOpen(true)
  }

  const openDetailDialog = (vehicle: Vehicle) => {
    setViewingVehicle(vehicle)
    setIsDetailDialogOpen(true)
  }

  const openHistoryDialog = (vehicle: Vehicle) => {
    setHistoryVehicle(vehicle)
    setIsHistoryDialogOpen(true)
  }

  const getVehicleHistory = (vehicleId: string) => {
    return []
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + " VND"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Quản lý xe</h1>
          <p className="text-gray-500 text-sm">Quản lý danh sách xe cho thuê của cửa hàng</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsAddDialogOpen(open)
        }
      }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Thêm xe mới
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-800">Thêm xe mới</DialogTitle>
              <DialogDescription className="text-gray-500">Nhập thông tin xe mới vào hệ thống</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-gray-600">Loại xe</Label>
                  <Input
                    id="name"
                    placeholder="VD: Honda SH 150i"
                    value={newVehicle.name}
                    onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="licensePlate" className="text-gray-600">Biển số</Label>
                  <Input
                    id="licensePlate"
                    placeholder="VD: 75AA-12345"
                    value={newVehicle.licensePlate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="color" className="text-gray-600">Màu xe</Label>
                  <Input
                    id="color"
                    placeholder="VD: Đen, Trắng, Đỏ"
                    value={newVehicle.color}
                    onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currentKm" className="text-gray-600">Số KM hiện tại</Label>
                  <Input
                    id="currentKm"
                    type="number"
                    placeholder="VD: 15000"
                    value={newVehicle.currentKm}
                    onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price" className="text-gray-600">Giá thuê (VND/ngày)</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="VD: 300000"
                    value={newVehicle.pricePerDay}
                    onChange={(e) => setNewVehicle({ ...newVehicle, pricePerDay: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="purchasePrice" className="text-gray-600">Giá mua xe (VND)</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    placeholder="VD: 50000000"
                    value={newVehicle.purchasePrice}
                    onChange={(e) => setNewVehicle({ ...newVehicle, purchasePrice: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status" className="text-gray-600">Trạng thái</Label>
                <Select
                  value={newVehicle.status}
                  onValueChange={(value: VehicleStatus) => setNewVehicle({ ...newVehicle, status: value })}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 rounded-xl">
                    <SelectItem value="available">Sẵn sàng</SelectItem>
                    <SelectItem value="rented">Đang thuê</SelectItem>
                    <SelectItem value="maintenance">Bảo trì</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes" className="text-gray-600">Ghi chú</Label>
                <Textarea
                  id="notes"
                  placeholder="Nhập ghi chú về xe..."
                  value={newVehicle.notes}
                  onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                  className="bg-gray-50 border-gray-200 rounded-xl min-h-[80px]"
                />
              </div>
              
              {/* Vehicle Images */}
              <div className="grid gap-2">
                <Label className="text-gray-600">Ảnh xe</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {newVehicle.vehicleImages.map((img, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group"
                    >
                      <img 
                        src={img} 
                        alt={`Xe ${index + 1}`} 
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90" 
                        onClick={() => setLightboxImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'vehicle')}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-1">Thêm ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'vehicle')}
                    />
                  </label>
                </div>
              </div>

              {/* Document Images */}
              <div className="grid gap-2">
                <Label className="text-gray-600">Ảnh giấy tờ xe</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {newVehicle.documentImages.map((img, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group"
                    >
                      <img 
                        src={img} 
                        alt={`Giấy tờ ${index + 1}`} 
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'document')}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-1">Thêm ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'document')}
                    />
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl border-gray-200">
                Hủy
              </Button>
              <Button onClick={handleAddVehicle} className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
                Thêm xe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo loại xe hoặc biển số..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-gray-50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Lọc theo trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 rounded-xl">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="available">Sẵn sàng</SelectItem>
                <SelectItem value="rented">Đang thuê</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles List */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">Danh sách xe</CardTitle>
          <CardDescription className="text-gray-500">
            Hiển thị {filteredVehicles.length} / {vehicles.length} xe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Bike className="w-12 h-12 mb-3 opacity-50 animate-pulse" />
              <p>Đang tải dữ liệu xe...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Bike className="w-12 h-12 mb-3 opacity-50" />
              <p>Không tìm thấy xe nào</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead className="w-16 text-center text-gray-500 font-medium">STT</TableHead>
                      <TableHead className="text-gray-500 font-medium">Loại xe</TableHead>
                      <TableHead className="text-gray-500 font-medium text-right">Giá thuê/ngày</TableHead>
                      <TableHead className="text-gray-500 font-medium text-center">Trạng thái</TableHead>
                      <TableHead className="text-gray-500 font-medium text-center w-20">Lịch sử</TableHead>
                      <TableHead className="text-gray-500 font-medium text-center w-40">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle, index) => (
                      <TableRow key={vehicle.id} className="hover:bg-gray-50">
                        <TableCell className="text-center text-gray-500 font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-800">{vehicle.name}</div>
                          <div className="text-sm text-gray-500 font-mono">{vehicle.licensePlate}</div>
                        </TableCell>
                        <TableCell className="text-right text-blue-600 font-medium">
                          {formatPrice(vehicle.pricePerDay)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[vehicle.status].className}`}
                          >
                            {statusConfig[vehicle.status].label}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-amber-500 hover:bg-amber-50"
                            onClick={() => openHistoryDialog(vehicle)}
                          >
                            <Clock className="h-4 w-4" />
                            <span className="sr-only">Lịch sử</span>
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50"
                              onClick={() => openDetailDialog(vehicle)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Chi tiết</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                              onClick={() => openEditDialog(vehicle)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Sửa</span>
                            </Button>
                            {user?.permissions.canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Xóa</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white border-gray-200 rounded-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-gray-800">Xác nhận xóa xe</AlertDialogTitle>
                                    <AlertDialogDescription className="text-gray-500">
                                      Bạn có chắc chắn muốn xóa xe <span className="font-medium text-gray-800">{vehicle.name}</span> ({vehicle.licensePlate})? 
                                      Hành động này không thể hoàn tác.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-gray-200 rounded-xl">Hủy</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteVehicle(vehicle.id)}
                                      className="bg-red-500 text-white hover:bg-red-600 rounded-xl"
                                    >
                                      Xóa
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredVehicles.map((vehicle) => (
                  <div 
                    key={vehicle.id} 
                    className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Vehicle Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Bike className="w-5 h-5 text-blue-500" />
                    </div>
                    
                    {/* Vehicle Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-800 truncate">{vehicle.name}</h3>
                          <p className="text-sm text-gray-500 font-mono">{vehicle.licensePlate}</p>
                        </div>
                        <span
                          className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[vehicle.status].className}`}
                        >
                          {statusConfig[vehicle.status].label}
                        </span>
                      </div>
                      
                      {/* Price */}
                      <div className="mt-1">
                        <span className="text-sm font-medium text-blue-600">
                          {formatPrice(vehicle.pricePerDay)}/ngày
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-amber-500 hover:bg-amber-50"
                        onClick={() => openHistoryDialog(vehicle)}
                      >
                        <Clock className="h-4 w-4" />
                        <span className="sr-only">Lịch sử</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50"
                        onClick={() => openDetailDialog(vehicle)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Chi tiết</span>
                      </Button>
                      {user?.permissions.canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Xóa</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white border-gray-200 rounded-2xl mx-4">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-gray-800">Xác nhận xóa xe</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-500">
                                Bạn có chắc chắn muốn xóa xe <span className="font-medium text-gray-800">{vehicle.name}</span> ({vehicle.licensePlate})? 
                                Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-gray-200 rounded-xl">Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteVehicle(vehicle.id)}
                                className="bg-red-500 text-white hover:bg-red-600 rounded-xl"
                              >
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsEditDialogOpen(open)
        }
      }}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Chỉnh sửa thông tin xe</DialogTitle>
            <DialogDescription className="text-gray-500">Cập nhật thông tin xe trong hệ thống</DialogDescription>
          </DialogHeader>
          {editingVehicle && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name" className="text-gray-600">Loại xe</Label>
                  <Input
                    id="edit-name"
                    value={editingVehicle.name}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-licensePlate" className="text-gray-600">Biển số</Label>
                  <Input
                    id="edit-licensePlate"
                    value={editingVehicle.licensePlate}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, licensePlate: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-color" className="text-gray-600">Màu xe</Label>
                  <Input
                    id="edit-color"
                    value={editingVehicle.color}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-currentKm" className="text-gray-600">Số KM hiện tại</Label>
                  <Input
                    id="edit-currentKm"
                    type="number"
                    value={editingVehicle.currentKm}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, currentKm: parseInt(e.target.value) || 0 })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price" className="text-gray-600">Giá thuê (VND/ngày)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={editingVehicle.pricePerDay}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, pricePerDay: parseInt(e.target.value) || 0 })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-purchasePrice" className="text-gray-600">Giá mua xe (VND)</Label>
                  <Input
                    id="edit-purchasePrice"
                    type="number"
                    value={editingVehicle.purchasePrice}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, purchasePrice: parseInt(e.target.value) || 0 })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-maintenanceCost" className="text-gray-600">Phí bảo trì (VND)</Label>
                  <Input
                    id="edit-maintenanceCost"
                    type="number"
                    value={editingVehicle.maintenanceCost}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, maintenanceCost: parseInt(e.target.value) || 0 })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-status" className="text-gray-600">Trạng thái</Label>
                  <Select
                    value={editingVehicle.status}
                    onValueChange={(value: VehicleStatus) => setEditingVehicle({ ...editingVehicle, status: value })}
                  >
                    <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                      <SelectValue placeholder="Chọn trạng thái" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 rounded-xl">
                      <SelectItem value="available">Sẵn sàng</SelectItem>
                      <SelectItem value="rented">Đang thuê</SelectItem>
                      <SelectItem value="maintenance">Bảo trì</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes" className="text-gray-600">Ghi chú</Label>
                <Textarea
                  id="edit-notes"
                  value={editingVehicle.notes}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
                  className="bg-gray-50 border-gray-200 rounded-xl min-h-[80px]"
                />
              </div>
              
              {/* Vehicle Images */}
              <div className="grid gap-2">
                <Label className="text-gray-600">Ảnh xe</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {editingVehicle.vehicleImages.map((img, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group"
                    >
                      <img 
                        src={img} 
                        alt={`Xe ${index + 1}`} 
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'vehicle', true)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-1">Thêm ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'vehicle', true)}
                    />
                  </label>
                </div>
              </div>

              {/* Document Images */}
              <div className="grid gap-2">
                <Label className="text-gray-600">Ảnh giấy tờ xe</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {editingVehicle.documentImages.map((img, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group"
                    >
                      <img 
                        src={img} 
                        alt={`Giấy tờ ${index + 1}`} 
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'document', true)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-1">Thêm ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'document', true)}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl border-gray-200">
              Hủy
            </Button>
            <Button onClick={handleEditVehicle} className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsDetailDialogOpen(open)
        }
      }}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" />
              Chi tiết xe
            </DialogTitle>
            <DialogDescription className="text-gray-500">Thông tin chi tiết của xe trong hệ thống</DialogDescription>
          </DialogHeader>
          {viewingVehicle && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Loại xe</p>
                  <p className="text-sm font-medium text-gray-800">{viewingVehicle.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Biển số</p>
                  <p className="text-sm font-medium text-gray-800 font-mono">{viewingVehicle.licensePlate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Màu xe</p>
                  <p className="text-sm font-medium text-gray-800">{viewingVehicle.color || "Chưa cập nhật"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Trạng thái</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[viewingVehicle.status].className}`}>
                    {statusConfig[viewingVehicle.status].label}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Giá thuê (theo ngày)</p>
                  <p className="text-sm font-medium text-blue-600">{formatPrice(viewingVehicle.pricePerDay)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Số KM hiện tại</p>
                  <p className="text-sm font-medium text-gray-800">{viewingVehicle.currentKm.toLocaleString("vi-VN")} km</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Giá mua xe</p>
                  <p className="text-sm font-medium text-gray-800">{formatPrice(viewingVehicle.purchasePrice)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Số ngày đã cho thuê</p>
                  <p className="text-sm font-medium text-gray-800">{viewingVehicle.totalRentalDays} ngày</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Phí bảo trì</p>
                  <p className="text-sm font-medium text-amber-600">{formatPrice(viewingVehicle.maintenanceCost)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Tổng thu</p>
                  <p className="text-sm font-medium text-emerald-600">{formatPrice(viewingVehicle.totalRevenue)}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs text-gray-500">Lợi nhuận</p>
                  <p className="text-sm font-medium text-blue-600">{formatPrice(viewingVehicle.profit)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Ghi chú</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">{viewingVehicle.notes || "Không có ghi chú"}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Tỷ suất lợi nhuận trên vốn:</span>
                  <span className="font-semibold text-blue-600">
                    {viewingVehicle.purchasePrice > 0 ? ((viewingVehicle.profit / viewingVehicle.purchasePrice) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Vehicle Images */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">Ảnh xe</p>
                {viewingVehicle.vehicleImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewingVehicle.vehicleImages.map((img, index) => (
                      <div 
                        key={index} 
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLightboxImage(img)
                        }}
                      >
                        <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-4 rounded-xl">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm">Chưa có ảnh xe</span>
                  </div>
                )}
              </div>

              {/* Document Images */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">Ảnh giấy tờ xe</p>
                {viewingVehicle.documentImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewingVehicle.documentImages.map((img, index) => (
                      <div 
                        key={index} 
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLightboxImage(img)
                        }}
                      >
                        <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-4 rounded-xl">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm">Chưa có ảnh giấy tờ xe</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
            <Button 
              onClick={() => {
                setIsDetailDialogOpen(false)
                if (viewingVehicle) openEditDialog(viewingVehicle)
              }} 
              className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Chỉnh sửa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-card-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-chart-4" />
              Lịch sử xe
            </DialogTitle>
            <DialogDescription>
              {historyVehicle ? `${historyVehicle.name} - ${historyVehicle.licensePlate}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {historyVehicle && (
              <div className="space-y-4">
                {getVehicleHistory(historyVehicle.id).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Chưa có lịch sử hoạt động</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {getVehicleHistory(historyVehicle.id).map((log) => (
                        <div key={log.id} className="relative pl-10">
                          <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
                            log.type === "rent" ? "bg-chart-2" : 
                            log.type === "return" ? "bg-primary" : "bg-chart-5"
                          }`} />
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${historyTypeConfig[log.type].className}`}>
                                {historyTypeConfig[log.type].label}
                              </span>
                              <span className="text-xs text-muted-foreground">{log.datetime}</span>
                            </div>
                            <p className="text-sm text-card-foreground">{log.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <LightboxModal 
          imageSrc={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}
    </div>
  )
}
