"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchVehicles } from "@/lib/supabase"
import { uploadMultipleImages } from "@/lib/storage"
import { logVehicleAction } from "@/lib/logging"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Plus, Search, Pencil, Trash2, Bike, Eye, Upload, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

type VehicleStatus = "available" | "rented" | "maintenance"

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: VehicleStatus
  currentKm: number
  purchasePrice: number
  notes: string
  vehicleImages?: string[]
  documentImages?: string[]
}

const statusConfig: Record<VehicleStatus, { label: string; className: string }> = {
  available: { label: "Sẵn sàng", className: "bg-emerald-50 text-emerald-600" },
  rented: { label: "Đang thuê", className: "bg-blue-50 text-blue-600" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-600" },
}

export default function VehiclesPage() {
  const { user, addAccessLog } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  // Form states
  const [newVehicle, setNewVehicle] = useState({
    name: "",
    licensePlate: "",
    color: "",
    pricePerDay: "",
    currentKm: "",
    purchasePrice: "",
    notes: "",
    status: "available" as VehicleStatus,
    vehicleImages: [] as File[],
    documentImages: [] as File[],
  })

  // Load vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      try {
        setIsLoading(true)
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

  // Filter vehicles
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Handle add vehicle
  const handleAddVehicle = async () => {
    if (!newVehicle.name || !newVehicle.licensePlate || !newVehicle.pricePerDay) {
      alert("❌ Vui lòng điền đầy đủ thông tin (Tên, Biển số, Giá)")
      return
    }

    try {
      // Upload images
      let vehicleImageUrls: string[] = []
      let documentImageUrls: string[] = []

      if (newVehicle.vehicleImages.length > 0) {
        console.log("📸 Uploading vehicle images...")
        vehicleImageUrls = await uploadMultipleImages(
          newVehicle.vehicleImages,
          "vehicles",
          "vehicle-images"
        )
      }

      if (newVehicle.documentImages.length > 0) {
        console.log("📄 Uploading document images...")
        documentImageUrls = await uploadMultipleImages(
          newVehicle.documentImages,
          "vehicles",
          "document-images"
        )
      }

      const vehicleData = {
        name: newVehicle.name,
        licensePlate: newVehicle.licensePlate,
        color: newVehicle.color,
        pricePerDay: parseInt(newVehicle.pricePerDay),
        currentKm: parseInt(newVehicle.currentKm) || 0,
        purchasePrice: parseInt(newVehicle.purchasePrice) || 0,
        notes: newVehicle.notes,
        status: newVehicle.status,
        vehicleImages: vehicleImageUrls,
        documentImages: documentImageUrls,
      }

      console.log("📝 Adding vehicle:", vehicleData)

      const { data, error } = await supabase
        .from("vehicles")
        .insert([vehicleData])
        .select()

      if (error) {
        console.error("❌ Error adding vehicle:", error)
        alert(`❌ Lỗi thêm xe: ${error.message}`)
        return
      }

      console.log("✅ Vehicle added:", data)
      
      // Reload list
      const updatedVehicles = await fetchVehicles()
      setVehicles(updatedVehicles)
      
      // Log action
      logVehicleAction(
        addAccessLog,
        "Thêm mới",
        newVehicle.name,
        newVehicle.licensePlate,
        `Giá: ${newVehicle.pricePerDay} VNĐ/ngày`
      )

      // Reset form
      setNewVehicle({
        name: "",
        licensePlate: "",
        color: "",
        pricePerDay: "",
        currentKm: "",
        purchasePrice: "",
        notes: "",
        status: "available",
        vehicleImages: [],
        documentImages: [],
      })
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error("❌ Exception:", error)
      alert(`❌ Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "vehicle" | "document") => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files)
      if (type === "vehicle") {
        setNewVehicle(prev => ({
          ...prev,
          vehicleImages: [...prev.vehicleImages, ...fileArray]
        }))
      } else {
        setNewVehicle(prev => ({
          ...prev,
          documentImages: [...prev.documentImages, ...fileArray]
        }))
      }
    }
  }

  // Remove image
  const removeImageFile = (index: number, type: "vehicle" | "document") => {
    if (type === "vehicle") {
      setNewVehicle(prev => ({
        ...prev,
        vehicleImages: prev.vehicleImages.filter((_, i) => i !== index)
      }))
    } else {
      setNewVehicle(prev => ({
        ...prev,
        documentImages: prev.documentImages.filter((_, i) => i !== index)
      }))
    }
  }

  // Handle delete vehicle
  const handleDeleteVehicle = async (id: string) => {
    try {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", id)

      if (error) throw error

      setVehicles(vehicles.filter(v => v.id !== id))
      logVehicleAction(
        addAccessLog,
        "Xóa",
        viewingVehicle?.name || "",
        viewingVehicle?.licensePlate || "",
        "Xóa xe khỏi hệ thống"
      )
    } catch (error) {
      alert(`❌ Lỗi xóa xe: ${error instanceof Error ? error.message : "Unknown"}`)
    }
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value)
  }

  if (isLoading) {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản Lý Xe</h1>
          <p className="text-gray-600 mt-1">Quản lý thông tin và trạng thái xe</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
              <Plus className="w-4 h-4" />
              Thêm Xe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm Xe Mới</DialogTitle>
              <DialogDescription>Nhập thông tin xe mới vào hệ thống</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Loại Xe *</Label>
                  <Input
                    placeholder="VD: Honda SH 150i"
                    value={newVehicle.name}
                    onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Biển Số *</Label>
                  <Input
                    placeholder="VD: 29A-12345"
                    value={newVehicle.licensePlate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Màu Xe</Label>
                  <Input
                    placeholder="VD: Đen, Trắng"
                    value={newVehicle.color}
                    onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Số KM Hiện Tại</Label>
                  <Input
                    type="number"
                    placeholder="VD: 15000"
                    value={newVehicle.currentKm}
                    onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Giá Thuê (VND/ngày) *</Label>
                  <Input
                    type="number"
                    placeholder="VD: 300000"
                    value={newVehicle.pricePerDay}
                    onChange={(e) => setNewVehicle({ ...newVehicle, pricePerDay: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Giá Mua (VND)</Label>
                  <Input
                    type="number"
                    placeholder="VD: 50000000"
                    value={newVehicle.purchasePrice}
                    onChange={(e) => setNewVehicle({ ...newVehicle, purchasePrice: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Trạng Thái</Label>
                <Select value={newVehicle.status} onValueChange={(val: any) => setNewVehicle({ ...newVehicle, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Sẵn Sàng</SelectItem>
                    <SelectItem value="rented">Đang Thuê</SelectItem>
                    <SelectItem value="maintenance">Bảo Trì</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ghi Chú</Label>
                <Textarea
                  placeholder="Nhập ghi chú..."
                  value={newVehicle.notes}
                  onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                  className="min-h-20"
                />
              </div>

              {/* Vehicle Images */}
              <div>
                <Label>Ảnh Xe</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {newVehicle.vehicleImages.map((file, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={`Ảnh ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                      <button type="button" onClick={() => removeImageFile(i, 'vehicle')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-blue-50">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e, 'vehicle')} />
                  </label>
                </div>
              </div>

              {/* Document Images */}
              <div>
                <Label>Ảnh Giấy Tờ</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {newVehicle.documentImages.map((file, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={`Giấy ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                      <button type="button" onClick={() => removeImageFile(i, 'document')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-blue-50">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e, 'document')} />
                  </label>
                </div>
              </div>

              <Button onClick={handleAddVehicle} className="bg-blue-500 hover:bg-blue-600 w-full">
                Thêm Xe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm theo tên hoặc biển số..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất Cả Trạng Thái</SelectItem>
                <SelectItem value="available">Sẵn Sàng</SelectItem>
                <SelectItem value="rented">Đang Thuê</SelectItem>
                <SelectItem value="maintenance">Bảo Trì</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh Sách Xe ({filteredVehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại Xe</TableHead>
                  <TableHead>Biển Số</TableHead>
                  <TableHead>Giá Thuê</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead>Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Không có xe nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.name}</TableCell>
                      <TableCell>{vehicle.licensePlate}</TableCell>
                      <TableCell>{formatPrice(vehicle.pricePerDay)}</TableCell>
                      <TableCell>{vehicle.currentKm.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[vehicle.status].className}`}>
                          {statusConfig[vehicle.status].label}
                        </span>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Dialog open={isViewDialogOpen && viewingVehicle?.id === vehicle.id} onOpenChange={(open) => {
                          if (open) {
                            setViewingVehicle(vehicle)
                            setIsViewDialogOpen(true)
                          } else {
                            setIsViewDialogOpen(false)
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-2">
                              <Eye className="w-4 h-4" />
                              Xem
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{vehicle.name}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-600">Biển Số</p>
                                  <p className="font-semibold">{vehicle.licensePlate}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Màu</p>
                                  <p className="font-semibold">{vehicle.color || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Giá Thuê</p>
                                  <p className="font-semibold">{formatPrice(vehicle.pricePerDay)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">KM Hiện Tại</p>
                                  <p className="font-semibold">{vehicle.currentKm.toLocaleString()} km</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Giá Mua</p>
                                  <p className="font-semibold">{formatPrice(vehicle.purchasePrice)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Trạng Thái</p>
                                  <p className="font-semibold">{statusConfig[vehicle.status].label}</p>
                                </div>
                              </div>

                              {vehicle.notes && (
                                <div className="border-t pt-4">
                                  <p className="text-sm text-gray-600 mb-2">Ghi Chú</p>
                                  <p className="text-sm bg-gray-50 p-3 rounded">{vehicle.notes}</p>
                                </div>
                              )}

                              {/* Vehicle Images */}
                              {vehicle.vehicleImages && vehicle.vehicleImages.length > 0 && (
                                <div className="border-t pt-4">
                                  <p className="text-sm text-gray-600 mb-2">Ảnh Xe</p>
                                  <div className="grid grid-cols-4 gap-2">
                                    {vehicle.vehicleImages.map((img, i) => (
                                      <img key={i} src={img} alt={`Ảnh ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Document Images */}
                              {vehicle.documentImages && vehicle.documentImages.length > 0 && (
                                <div className="border-t pt-4">
                                  <p className="text-sm text-gray-600 mb-2">Ảnh Giấy Tờ</p>
                                  <div className="grid grid-cols-4 gap-2">
                                    {vehicle.documentImages.map((img, i) => (
                                      <img key={i} src={img} alt={`Giấy ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                                    ))}
                                  </div>
                                </div>
                              )}

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" className="w-full">Xóa Xe</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Xóa Xe?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bạn có chắc muốn xóa {vehicle.name} ({vehicle.licensePlate})?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteVehicle(vehicle.id)} className="bg-red-600">
                                      Xóa
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
