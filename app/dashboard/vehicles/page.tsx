"use client"

import { useState, useEffect } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Pencil, Trash2, Bike } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

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

export default function VehiclesPage() {
  const { addAccessLog } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    licensePlate: "",
    color: "",
    pricePerDay: "",
    currentKm: "",
    purchasePrice: "",
    notes: "",
    status: "available" as const,
  })

  // Load vehicles from Supabase
  useEffect(() => {
    const loadVehicles = async () => {
      try {
        setLoading(true)
        const data = await fetchVehicles()
        setVehicles(data || [])
      } catch (error) {
        console.error("Failed to load vehicles:", error)
      } finally {
        setLoading(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingVehicle) {
        const { error } = await supabase
          .from("vehicles")
          .update({
            name: formData.name,
            licensePlate: formData.licensePlate,
            color: formData.color,
            pricePerDay: parseInt(formData.pricePerDay),
            currentKm: parseInt(formData.currentKm) || 0,
            purchasePrice: parseInt(formData.purchasePrice) || 0,
            notes: formData.notes,
            status: formData.status,
          })
          .eq("id", editingVehicle.id)

        if (error) throw error
        addAccessLog("Chỉnh sửa", "Quản lý xe", `Sửa xe: ${formData.name}`)
      } else {
        const { error } = await supabase.from("vehicles").insert([
          {
            name: formData.name,
            licensePlate: formData.licensePlate,
            color: formData.color,
            pricePerDay: parseInt(formData.pricePerDay),
            currentKm: parseInt(formData.currentKm) || 0,
            purchasePrice: parseInt(formData.purchasePrice) || 0,
            notes: formData.notes,
            status: "available",
            vehicleImages: [],
            documentImages: [],
          },
        ])

        if (error) throw error
        addAccessLog("Thêm mới", "Quản lý xe", `Thêm xe mới: ${formData.name}`)
      }

      const updated = await fetchVehicles()
      setVehicles(updated || [])
      resetForm()
    } catch (error) {
      console.error("Error saving vehicle:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const vehicle = vehicles.find((v) => v.id === id)
      const { error } = await supabase.from("vehicles").delete().eq("id", id)

      if (error) throw error

      const updated = await fetchVehicles()
      setVehicles(updated || [])
      if (vehicle) {
        addAccessLog("Xóa", "Quản lý xe", `Xóa xe: ${vehicle.name}`)
      }
    } catch (error) {
      console.error("Error deleting vehicle:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      licensePlate: "",
      color: "",
      pricePerDay: "",
      currentKm: "",
      purchasePrice: "",
      notes: "",
      status: "available",
    })
    setEditingVehicle(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      name: vehicle.name,
      licensePlate: vehicle.licensePlate,
      color: vehicle.color,
      pricePerDay: vehicle.pricePerDay.toString(),
      currentKm: vehicle.currentKm.toString(),
      purchasePrice: vehicle.purchasePrice.toString(),
      notes: vehicle.notes,
      status: vehicle.status,
    })
    setIsDialogOpen(true)
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    available: { label: "Sẵn sàng", className: "bg-emerald-50 text-emerald-600" },
    rented: { label: "Đang thuê", className: "bg-blue-50 text-blue-600" },
    maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-600" },
  }

  if (loading) {
    return <div className="p-6">Đang tải...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Quản Lý Xe</h1>
        <p className="text-gray-500">Quản lý danh sách xe cho thuê</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Danh Sách Xe</CardTitle>
              <CardDescription>Tổng số xe: {vehicles.length}</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm()
                    setIsDialogOpen(true)
                  }}
                  className="bg-blue-500 text-white hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm Xe
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingVehicle ? "Sửa Xe" : "Thêm Xe Mới"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Tên Xe</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Biển Số</Label>
                    <Input
                      value={formData.licensePlate}
                      onChange={(e) =>
                        setFormData({ ...formData, licensePlate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Màu Sắc</Label>
                    <Input
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Giá Thuê/Ngày (VNĐ)</Label>
                    <Input
                      type="number"
                      value={formData.pricePerDay}
                      onChange={(e) =>
                        setFormData({ ...formData, pricePerDay: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Km Hiện Tại</Label>
                    <Input
                      type="number"
                      value={formData.currentKm}
                      onChange={(e) =>
                        setFormData({ ...formData, currentKm: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Giá Mua (VNĐ)</Label>
                    <Input
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          purchasePrice: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Ghi Chú</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-blue-500 hover:bg-blue-600">
                      {editingVehicle ? "Cập Nhật" : "Thêm"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Tìm xe theo tên hoặc biển số..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="available">Sẵn sàng</SelectItem>
                <SelectItem value="rented">Đang thuê</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Tên Xe</th>
                  <th className="text-left py-3 px-4">Biển Số</th>
                  <th className="text-left py-3 px-4">Giá/Ngày</th>
                  <th className="text-left py-3 px-4">Trạng Thái</th>
                  <th className="text-right py-3 px-4">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4">{vehicle.name}</td>
                    <td className="py-4 px-4">{vehicle.licensePlate}</td>
                    <td className="py-4 px-4">{vehicle.pricePerDay.toLocaleString()} VNĐ</td>
                    <td className="py-4 px-4">
                      <Badge
                        className={
                          statusConfig[vehicle.status]?.className ||
                          "bg-gray-100"
                        }
                      >
                        {statusConfig[vehicle.status]?.label || vehicle.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(vehicle)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(vehicle.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredVehicles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Không tìm thấy xe nào
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
