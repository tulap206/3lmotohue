"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { showError, showWarning } from "@/lib/toast-utils"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { supabase } from "@/lib/supabase"
import { uploadMultipleImages } from "@/lib/storage"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard } from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalVehicleStatusLabel,
  rentalVehicleStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormSection,
  EntityFormFooter,
} from "@/components/dashboard/entity-form-dialog"
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
import { logger } from "@/lib/logger"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Search, Pencil, Trash2, Car, Eye, Clock, Upload, X, ImageIcon, Settings, History } from "lucide-react"
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
  timestamp: Date
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
  current_km: number
  totalRentalDays?: number
  purchasePrice: number
  totalRevenue?: number
  profit?: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
  category?: "car" | "bike"
  created_at?: string
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
  const { vehicles, setVehicles, orders, setOrders, isLoading } = useRentalData()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
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
    current_km: "",
    purchasePrice: "",
    notes: "",
    status: "available" as VehicleStatus,
    category: "bike" as "car" | "bike",
    vehicleImages: [] as File[],
    documentImages: [] as File[],
  })

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesSearch =
        vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [vehicles, searchTerm, statusFilter])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredVehicles.length / itemsPerPage)
  }, [filteredVehicles])

  const startIndex = (currentPage - 1) * itemsPerPage
  
  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      startIndex,
      currentPage * itemsPerPage
    )
  }, [filteredVehicles, startIndex])

  const vehicleStats = useMemo(() => {
    return {
      total: vehicles.length,
      available: vehicles.filter((v) => v.status === "available").length,
      rented: vehicles.filter((v) => v.status === "rented").length,
      maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    }
  }, [vehicles])

  const vehiclePerformanceMap = useMemo(() => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    thirtyDaysAgo.setHours(0,0,0,0)

    const map: Record<string, { utilizationRate: number; revenue30d: number }> = {}

    const parseVietnamDate = (dateStr: string): Date => {
      if (!dateStr) return new Date()
      const parts = dateStr.split("/")
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr)
    }

    vehicles.forEach(vehicle => {
      const vehicleOrders = (orders || []).filter(o => o.vehicleId === vehicle.id && o.status !== "cancelled" && o.status !== "pending")
      let rentedDays = 0
      let totalRevenue30d = 0

      vehicleOrders.forEach(o => {
        const start = parseVietnamDate(o.startDate)
        const end = parseVietnamDate(o.endDate)
        start.setHours(0,0,0,0)
        end.setHours(0,0,0,0)

        const overlapStart = start < thirtyDaysAgo ? thirtyDaysAgo : start
        const overlapEnd = end > today ? today : end

        if (overlapStart <= overlapEnd) {
          const diffTime = overlapEnd.getTime() - overlapStart.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
          rentedDays += diffDays
          
          const dailyRate = o.pricePerDay || 0
          totalRevenue30d += diffDays * dailyRate
        }
      })

      if (rentedDays > 30) rentedDays = 30
      const utilizationRate = Math.round((rentedDays / 30) * 100)
      map[vehicle.id] = { utilizationRate, revenue30d: totalRevenue30d }
    })

    return map
  }, [vehicles, orders])

  const handleAddVehicle = async () => {
    if (!newVehicle.name || !newVehicle.name.trim()) {
      showWarning("Vui lòng nhập Loại xe!")
      return
    }
    if (!newVehicle.licensePlate || !newVehicle.licensePlate.trim()) {
      showWarning("Vui lòng nhập Biển số xe!")
      return
    }
    if (!newVehicle.pricePerDay) {
      showWarning("Vui lòng nhập Giá thuê!")
      return
    }

    try {
        // Check if licensePlate already exists
        const existingVehicle = vehicles.find(
          (v) => v.licensePlate.toLowerCase() === newVehicle.licensePlate.toLowerCase()
        )
        
        if (existingVehicle) {
          showWarning(`Xe với biển số "${newVehicle.licensePlate}" đã tồn tại!`, `Tên xe: ${existingVehicle.name}\nGiá: ${existingVehicle.pricePerDay.toLocaleString('vi-VN')} VND/ngày`)
          return
        }
        
        // Upload images first
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

        const vehicle: any = {
          name: newVehicle.name,
          licensePlate: newVehicle.licensePlate,
          color: newVehicle.color,
          pricePerDay: parseMoneyInput(newVehicle.pricePerDay),
          current_km: parseInt(newVehicle.current_km) || 0,
          purchasePrice: parseMoneyInput(newVehicle.purchasePrice),
          notes: newVehicle.notes,
          status: newVehicle.status,
          category: newVehicle.category,
          vehicleImages: vehicleImageUrls,
          documentImages: documentImageUrls,
        }
        
        const { data, error } = await supabase
          .from('vehicles')
          .insert([vehicle])
          .select()
        
        if (error) {
          console.error("Error adding vehicle:", error)
          showError(`Lỗi: ${error.message}`)
        } else if (data && data.length > 0) {
          const insertedVehicle = data[0]
          // Add new vehicle and sort (newest first)
          const updated = [...vehicles, insertedVehicle]
          const sorted = updated.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime()
            const dateB = new Date(b.created_at || 0).getTime()
            return dateB - dateA // DESC (newest first)
          })
          setVehicles(sorted)
          if (user) logger.addVehicle(user.username, user.displayName, insertedVehicle.name, insertedVehicle.licensePlate)
          setNewVehicle({ name: "", licensePlate: "", color: "", pricePerDay: "", current_km: "", purchasePrice: "", notes: "", status: "available", category: "bike", vehicleImages: [], documentImages: [] })
          setIsAddDialogOpen(false)
        } else {
          console.warn("⚠ No data returned after vehicle insertion")
          // Fallback if success but no data returned
          const updated = [...vehicles, vehicle]
          setVehicles(updated)
          setIsAddDialogOpen(false)
        }
      } catch (error) {
        console.error("Error adding vehicle:", error)
        showError(`Lỗi: ${error instanceof Error ? error.message : "Unknown"}`)
      }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'vehicle' | 'document', isEdit: boolean = false) => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files)
      if (isEdit && editingVehicle) {
        if (type === 'vehicle') {
          setEditingVehicle({ ...editingVehicle, vehicleImages: [...(editingVehicle.vehicleImages as any), ...fileArray] as any })
        } else {
          setEditingVehicle({ ...editingVehicle, documentImages: [...(editingVehicle.documentImages as any), ...fileArray] as any })
        }
      } else {
        if (type === 'vehicle') {
          setNewVehicle(prev => ({ ...prev, vehicleImages: [...prev.vehicleImages, ...fileArray] }))
        } else {
          setNewVehicle(prev => ({ ...prev, documentImages: [...prev.documentImages, ...fileArray] }))
        }
      }
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
        // Separate existing URL strings from new File objects
        const existingVehicleImages = (editingVehicle.vehicleImages || []).filter((img: any) => typeof img === 'string') as string[]
        const newVehicleImageFiles = (editingVehicle.vehicleImages || []).filter((img: any) => img instanceof File) as unknown as File[]

        const existingDocumentImages = (editingVehicle.documentImages || []).filter((img: any) => typeof img === 'string') as string[]
        const newDocumentImageFiles = (editingVehicle.documentImages || []).filter((img: any) => img instanceof File) as unknown as File[]

        // Upload new images if any
        let newVehicleImageUrls: string[] = []
        if (newVehicleImageFiles.length > 0) {
          console.log("📸 Uploading new vehicle images for edit...")
          newVehicleImageUrls = await uploadMultipleImages(
            newVehicleImageFiles,
            "vehicles",
            "vehicle-images"
          )
        }

        let newDocumentImageUrls: string[] = []
        if (newDocumentImageFiles.length > 0) {
          console.log("📄 Uploading new document images for edit...")
          newDocumentImageUrls = await uploadMultipleImages(
            newDocumentImageFiles,
            "vehicles",
            "document-images"
          )
        }

        // Combine existing URLs and new uploaded URLs
        const finalVehicleImages = [...existingVehicleImages, ...newVehicleImageUrls]
        const finalDocumentImages = [...existingDocumentImages, ...newDocumentImageUrls]

        // Parse formatted money values back to numbers
        const updateData = {
          name: editingVehicle.name,
          licensePlate: editingVehicle.licensePlate,
          color: editingVehicle.color,
          pricePerDay: parseMoneyInput(editingVehicle.pricePerDay.toString()),
          current_km: parseInt(editingVehicle.current_km.toString()) || 0,
          purchasePrice: parseMoneyInput(editingVehicle.purchasePrice?.toString() || '0'),
          notes: editingVehicle.notes,
          status: editingVehicle.status,
          category: editingVehicle.category,
          vehicleImages: finalVehicleImages,
          documentImages: finalDocumentImages,
        }
        
        const { error } = await supabase
          .from('vehicles')
          .update(updateData)
          .eq('id', editingVehicle.id)
        
        if (error) {
          console.error("Error updating vehicle:", error)
          showError(`Lỗi khi cập nhật: ${error.message}`)
        } else {
          // Sync with state
          const fullUpdatedVehicle = {
            ...editingVehicle,
            ...updateData,
          }
          setVehicles(vehicles.map((v) => (v.id === editingVehicle.id ? fullUpdatedVehicle : v)))
          if (user) logger.editVehicle(user.username, user.displayName, editingVehicle.name, editingVehicle.licensePlate)
          setIsEditDialogOpen(false)
          setEditingVehicle(null)
        }
      } catch (error) {
        console.error("Error updating vehicle:", error)
        showError(`Lỗi: ${error instanceof Error ? error.message : "Unknown"}`)
      }
    }
  }

  const handleDeleteVehicle = async (id: string) => {
    const vehicleToDelete = vehicles.find((v) => v.id === id)
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error("Error deleting vehicle:", error)
      } else {
        setVehicles(vehicles.filter((v) => v.id !== id))
        if (vehicleToDelete && user) {
          logger.deleteVehicle(user.username, user.displayName, vehicleToDelete.name, vehicleToDelete.licensePlate)
        }
      }
    } catch (error) {
      console.error("Error deleting vehicle:", error)
    }
  }

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle({
      ...vehicle,
      pricePerDay: vehicle.pricePerDay?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '' as any,
      purchasePrice: vehicle.purchasePrice?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '' as any
    })
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
    const history: HistoryLog[] = []
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    
    // Helper to parse DD/MM/YYYY string to Date
    const parseVietnamDate = (dateStr: string): Date => {
      if (!dateStr) return new Date(0)
      const parts = dateStr.split("/")
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr) // Fallback
    }
    
    // Add purchase date
    if (vehicle?.created_at) {
      const purchaseDate = new Date(vehicle.created_at)
      history.push({
        id: `purchase-${vehicleId}`,
        timestamp: purchaseDate,
        description: "Mua xe",
        type: "rent",
        datetime: formatDisplayDateTime(purchaseDate),
      })
    }
    
    // Add rental history from rentals
    const vehicleRentals = orders.filter((order) => order.vehicleId === vehicleId)
    vehicleRentals.forEach((rental) => {
      // Add rental booking (created_at or startDate)
      const bookingDate = rental.created_at ? new Date(rental.created_at) : parseVietnamDate(rental.startDate)
      history.push({
        id: `book-${rental.id}`,
        timestamp: bookingDate,
        description: `Đặt xe - ${rental.customerName} (${rental.rentalCode || rental.id})`,
        type: "rent",
        datetime: formatDisplayDateTime(bookingDate),
      })
      
      // Add vehicle receiving (received_at or use startDate)
      if (rental.status === "active" || rental.status === "completed" || rental.status === "cancelled") {
        const receivingDate = rental.received_at ? new Date(rental.received_at) : parseVietnamDate(rental.startDate)
        history.push({
          id: `receive-${rental.id}`,
          timestamp: receivingDate,
          description: `Nhận lại xe - ${rental.customerName} (${rental.rentalCode || rental.id})`,
          type: "rent",
          datetime: formatDisplayDateTime(receivingDate),
        })
      }
      
      // Add rental return (completed_at or endDate)
      if (rental.status === "completed" || rental.status === "cancelled") {
        const returnDate = rental.completed_at ? new Date(rental.completed_at) : parseVietnamDate(rental.endDate)
        history.push({
          id: `return-${rental.id}`,
          timestamp: returnDate,
          description: `Trả xe - ${rental.customerName} (${rental.rentalCode || rental.id})`,
          type: "return",
          datetime: formatDisplayDateTime(returnDate),
        })
      }
    })
    
    // Sort by timestamp descending (newest first)
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    return history
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + " đ"
  }

  const getVehiclePerformance = (vehicleId: string) => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    thirtyDaysAgo.setHours(0,0,0,0)

    // Filter orders for this vehicle in active or completed status
    const vehicleOrders = (orders || []).filter(o => o.vehicleId === vehicleId && o.status !== "cancelled" && o.status !== "pending")

    let rentedDays = 0
    let totalRevenue30d = 0

    vehicleOrders.forEach(o => {
      const parseVietnamDate = (dateStr: string): Date => {
        if (!dateStr) return new Date()
        const parts = dateStr.split("/")
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      }

      const start = parseVietnamDate(o.startDate)
      const end = parseVietnamDate(o.endDate)
      start.setHours(0,0,0,0)
      end.setHours(0,0,0,0)

      const overlapStart = start < thirtyDaysAgo ? thirtyDaysAgo : start
      const overlapEnd = end > today ? today : end

      if (overlapStart <= overlapEnd) {
        const diffTime = overlapEnd.getTime() - overlapStart.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        rentedDays += diffDays
        
        const dailyRate = o.pricePerDay || 0
        totalRevenue30d += diffDays * dailyRate
      }
    })

    if (rentedDays > 30) rentedDays = 30
    const utilizationRate = Math.round((rentedDays / 30) * 100)

    return { utilizationRate, revenue30d: totalRevenue30d }
  }

  return (
    <ModulePageShell module="rental">
      <ModuleSubpageHeader
        module="rental"
        title="Quản lý xe"
        subtitle="Quản lý danh sách xe cho thuê của cửa hàng"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Quản lý xe" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-10 font-bold"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm xe mới
            </Button>
          </div>
        }
      />

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsAddDialogOpen(open)
        }
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title="Thêm xe mới"
            description="Nhập thông tin xe mới vào hệ thống"
          />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddVehicle()
            }}
          >
            <EntityFormBody>
              <EntityFormSection title="Thông tin xe" description="Thông tin cơ bản và giá thuê">
            <div className="form-group">
              <div className="form-row">
                <div className="form-field">
                  <Label htmlFor="name" className="form-field-label">Loại xe</Label>
                  <Input
                    id="name"
                    placeholder="VD: Toyota Vios"
                    value={newVehicle.name}
                    onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                  />
                  <p className="form-field-description">Tên hoặc model của xe</p>
                </div>
                <div className="form-field">
                  <Label htmlFor="licensePlate" className="form-field-label">Biển số</Label>
                  <Input
                    id="licensePlate"
                    placeholder="VD: 75AA-12345"
                    value={newVehicle.licensePlate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value })}
                  />
                  <p className="form-field-description">Biển số xe định danh</p>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <Label htmlFor="color" className="form-field-label">Màu xe</Label>
                  <Input
                    id="color"
                    placeholder="VD: Đen, Trắng, Đỏ"
                    value={newVehicle.color}
                    onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="current_km" className="form-field-label">Số KM hiện tại</Label>
                  <Input
                    id="current_km"
                    type="number"
                    placeholder="VD: 15000"
                    value={newVehicle.current_km}
                    onChange={(e) => setNewVehicle({ ...newVehicle, current_km: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <Label htmlFor="price" className="form-field-label">Giá thuê (VND/ngày)</Label>
                  <Input
                    id="price"
                    type="text"
                    placeholder="VD: 300.000"
                    value={newVehicle.pricePerDay}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setNewVehicle({ ...newVehicle, pricePerDay: formatted })
                    }}
                    className="font-mono"
                  />
                </div>
                <div className="form-field">
                  <Label htmlFor="purchasePrice" className="form-field-label">Giá mua xe (VND)</Label>
                  <Input
                    id="purchasePrice"
                    type="text"
                    placeholder="VD: 50.000.000"
                    value={newVehicle.purchasePrice}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setNewVehicle({ ...newVehicle, purchasePrice: formatted })
                    }}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <Label htmlFor="category" className="form-field-label">Phân loại xe</Label>
                  <Select
                    value={newVehicle.category}
                    onValueChange={(value: "car" | "bike") => setNewVehicle({ ...newVehicle, category: value })}
                  >
                    <SelectTrigger className="rounded-lg border-slate-100 bg-slate-50">
                      <SelectValue placeholder="Phân loại" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-100 rounded-lg">
                      <SelectItem value="bike">Xe máy</SelectItem>
                      <SelectItem value="car">Ô tô</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field">
                  <Label htmlFor="status" className="form-field-label">Trạng thái</Label>
                  <Select
                    value={newVehicle.status}
                    onValueChange={(value: VehicleStatus) => setNewVehicle({ ...newVehicle, status: value })}
                  >
                    <SelectTrigger className="rounded-lg border-slate-100 bg-slate-50">
                      <SelectValue placeholder="Chọn trạng thái" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-100 rounded-lg">
                      <SelectItem value="available">Sẵn sàng</SelectItem>
                      <SelectItem value="rented">Đang thuê</SelectItem>
                      <SelectItem value="maintenance">Bảo trì</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="form-field">
                <Label htmlFor="notes" className="form-field-label">Ghi chú</Label>
                <Textarea
                  id="notes"
                  placeholder="Nhập ghi chú về xe..."
                  value={newVehicle.notes}
                  onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                  className="min-h-[80px] rounded-lg bg-slate-50 border-slate-100"
                />
                <p className="form-field-description">Thêm bất kỳ thông tin bổ sung nào về xe</p>
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
                        src={img instanceof File ? URL.createObjectURL(img) : img} 
                        alt={`Xe ${index + 1}`} 
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90" 
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'vehicle')}
                        className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-blue-50 transition-colors">
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
                        src={img instanceof File ? URL.createObjectURL(img) : img} 
                        alt={`Giấy tờ ${index + 1}`} 
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'document')}
                        className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-blue-50 transition-colors">
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
              </EntityFormSection>
            </EntityFormBody>
            <EntityFormFooter
              accent="blue"
              onCancel={() => setIsAddDialogOpen(false)}
              submitLabel="Thêm xe"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RentalKpiCard variant="hero" label="Tổng số xe" value={vehicleStats.total} sublabel={`${filteredVehicles.length} đang lọc`} />
          <RentalKpiCard variant="hero"
            label="Sẵn sàng"
            value={vehicleStats.available}
            sublabel="Có thể cho thuê"
            valueClassName="text-emerald-700"
            onClick={() => setStatusFilter("available")}
          />
          <RentalKpiCard variant="hero"
            label="Đang thuê"
            value={vehicleStats.rented}
            sublabel="Xe đang cho khách"
            valueClassName="text-sky-700"
            onClick={() => setStatusFilter("rented")}
          />
          <RentalKpiCard variant="hero"
            label="Bảo trì"
            value={vehicleStats.maintenance}
            sublabel="Tạm ngừng cho thuê"
            valueClassName="text-amber-700"
            onClick={() => setStatusFilter("maintenance")}
          />
        </div>

      <ModuleSectionCard
        title="Danh sách xe cho thuê"
        description={`Quản lý ${filteredVehicles.length} phương tiện trong hệ thống`}
        filters={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tên xe, biển số..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(rentalFilterInputClass, "pl-9 h-10")}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-40 h-10 rounded-xl border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-xl">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="available">Sẵn sàng</SelectItem>
                <SelectItem value="rented">Đang thuê</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-slate-200 mx-auto mb-2 animate-pulse" />
              <p className="text-slate-400 text-sm">Đang tải dữ liệu xe...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Không tìm thấy xe nào</p>
            </div>
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center text-slate-600")}>STT</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Loại xe</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Giá thuê/ngày</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Hiệu suất (30 ngày)</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Trạng thái</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {paginatedVehicles.map((vehicle, index) => (
                        <tr key={vehicle.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-medium">
                            {startIndex + index + 1}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div className="flex flex-col gap-1.5">
                              <button
                                type="button"
                                className="font-bold text-slate-800 text-[15px] hover:text-slate-700 hover:underline text-left block"
                                onClick={() => openDetailDialog(vehicle)}
                              >
                                {vehicle.name}
                              </button>
                              <div>
                                <span className="inline-block bg-white text-slate-800 border border-slate-350 font-mono font-bold px-2.5 py-1 rounded text-xs shadow-sm tracking-wider uppercase">
                                  {vehicle.licensePlate}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-blue-600 tabular-nums">
                            {formatPrice(vehicle.pricePerDay)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {(() => {
                              const { utilizationRate, revenue30d } = vehiclePerformanceMap[vehicle.id] || { utilizationRate: 0, revenue30d: 0 }
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                    Lấp đầy: {utilizationRate}%
                                  </span>
                                  {revenue30d > 0 && (
                                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                                      {formatPrice(revenue30d)}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
                              rentalVehicleStatusBadgeClass(vehicle.status)
                            )}>
                              {getRentalVehicleStatusLabel(vehicle.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                                onClick={() => openHistoryDialog(vehicle)}
                                title="Xem lịch sử"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                                onClick={() => openDetailDialog(vehicle)}
                                title="Chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                                onClick={() => openEditDialog(vehicle)}
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {user?.role === "admin" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0 border-red-200 rounded-lg hover:bg-blue-50 text-blue-500"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
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
                                        className="bg-blue-500 text-white hover:bg-red-600 rounded-xl"
                                      >
                                        Xóa
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                mobile={paginatedVehicles.map((vehicle) => (
                  <ModuleMobileCard key={vehicle.id}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="font-bold text-slate-800 text-[15px] hover:text-slate-700 hover:underline text-left"
                          onClick={() => openDetailDialog(vehicle)}
                        >
                          {vehicle.name}
                        </button>
                        <div>
                          <span className="inline-block bg-white text-slate-800 border border-slate-350 font-mono font-bold px-2 py-0.5 rounded text-[11px] shadow-sm tracking-wider uppercase">
                            {vehicle.licensePlate}
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${rentalVehicleStatusBadgeClass(vehicle.status)}`}>
                        {getRentalVehicleStatusLabel(vehicle.status)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-2">
                      <span className="font-bold text-blue-600 tabular-nums">{formatPrice(vehicle.pricePerDay)}/ngày</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => openHistoryDialog(vehicle)}>
                          <Clock className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => openDetailDialog(vehicle)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => openEditDialog(vehicle)}>
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </ModuleMobileCard>
                ))}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-white rounded-b-2xl">
                  <div className="text-xs text-slate-500 font-medium hidden sm:block">
                    Hiển thị trang <span className="font-bold text-slate-700">{currentPage}</span> / <span className="font-bold text-slate-700">{totalPages}</span> (Tổng {filteredVehicles.length} xe)
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                    <Button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-slate-200 rounded-xl px-2.5 font-bold hover:bg-slate-50 text-slate-600"
                    >
                      Trước
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        ) {
                          return (
                            <Button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-8 w-8 text-xs rounded-xl font-bold transition-all",
                                currentPage === page
                                  ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              {page}
                            </Button>
                          )
                        }
                        if (
                          page === 2 ||
                          page === totalPages - 1
                        ) {
                          return (
                            <span key={page} className="text-slate-400 text-xs px-1 select-none">
                              ...
                            </span>
                          )
                        }
                        return null
                      })}
                    </div>
                    <Button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-slate-200 rounded-xl px-2.5 font-bold hover:bg-slate-50 text-slate-600"
                    >
                      Tiếp
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </ModuleSectionCard>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsEditDialogOpen(open)
        }
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title="Chỉnh sửa thông tin xe"
            description="Cập nhật thông tin xe trong hệ thống"
          />
          {editingVehicle && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleEditVehicle()
              }}
            >
              <EntityFormBody>
            <div className="grid gap-4">
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
                  <Label htmlFor="edit-current_km" className="text-gray-600">Số KM hiện tại</Label>
                  <Input
                    id="edit-current_km"
                    type="number"
                    value={editingVehicle.current_km}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, current_km: parseInt(e.target.value) || 0 })}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price" className="text-gray-600">Giá thuê (VND/ngày)</Label>
                  <Input
                    id="edit-price"
                    type="text"
                    value={editingVehicle.pricePerDay}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setEditingVehicle({ ...editingVehicle, pricePerDay: formatted as any })
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-purchasePrice" className="text-gray-600">Giá mua xe (VND)</Label>
                  <Input
                    id="edit-purchasePrice"
                    type="text"
                    value={editingVehicle.purchasePrice}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setEditingVehicle({ ...editingVehicle, purchasePrice: formatted as any })
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-notes" className="text-gray-600">Ghi chú</Label>
                  <textarea
                    id="edit-notes"
                    value={editingVehicle.notes}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
                    className="bg-gray-50 border-gray-200 rounded-xl p-3 border resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-category" className="text-gray-600">Phân loại xe</Label>
                  <Select
                    value={editingVehicle.category || "bike"}
                    onValueChange={(value: "car" | "bike") => setEditingVehicle({ ...editingVehicle, category: value })}
                  >
                    <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                      <SelectValue placeholder="Phân loại" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 rounded-xl">
                      <SelectItem value="bike">Xe máy</SelectItem>
                      <SelectItem value="car">Ô tô</SelectItem>
                    </SelectContent>
                  </Select>
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
                        src={(img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string)}
                        alt={`Xe ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage((img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string))}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'vehicle', true)}
                        className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-blue-50 transition-colors">
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
                        src={(img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string)}
                        alt={`Giấy tờ ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxImage((img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string))}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index, 'document', true)}
                        className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-blue-50 transition-colors">
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
              </EntityFormBody>
              <EntityFormFooter
                accent="blue"
                onCancel={() => setIsEditDialogOpen(false)}
                submitLabel="Lưu thay đổi"
              />
            </form>
          )}
        </EntityFormDialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        if (!lightboxImage) {
          setIsDetailDialogOpen(open)
        }
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="lg">
          {viewingVehicle && (() => {
            const v = viewingVehicle
            const profit = v.profit ?? 0
            const totalRevenue = v.totalRevenue ?? 0
            const vId = v.id
            const parseVN = (s: string): Date => {
              const parts = s?.split("/")
              if (parts?.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
              return new Date(s || 0)
            }
            const calcUtil = (days: number) => {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const from = new Date(); from.setDate(today.getDate() - days); from.setHours(0, 0, 0, 0)
              const vOrders = orders.filter(o => o.vehicleId === vId && o.status !== "cancelled" && o.status !== "pending")
              let rented = 0; let rev = 0
              vOrders.forEach(o => {
                const s = parseVN(o.startDate); const e = parseVN(o.endDate)
                const os = s < from ? from : s; const oe = e > today ? today : e
                if (os <= oe) {
                  const d = Math.ceil((oe.getTime() - os.getTime()) / 86400000) + 1
                  rented += d; rev += d * (o.pricePerDay || 0)
                }
              })
              if (rented > days) rented = days
              return { pct: Math.round((rented / days) * 100), rev }
            }
            const u30 = calcUtil(30)
            const totalRentalCount = orders.filter(o => o.vehicleId === vId).length
            const recentOrders = orders
              .filter(o => o.vehicleId === vId)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
              .slice(0, 4)

            return (
              <>
                <EntityFormHeader
                  title={v.name}
                  description={`${v.licensePlate || "Chưa biển"}${v.color ? ` · ${v.color}` : ""}`}
                />
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "inline-flex items-center text-[11px] font-bold px-2 py-1 rounded-full border",
                      rentalVehicleStatusBadgeClass(v.status)
                    )}>
                      {getRentalVehicleStatusLabel(v.status)}
                    </span>
                    {v.category && (
                      <span className="text-xs text-slate-500">
                        Phân loại: <span className="font-medium text-slate-800">{v.category === "car" ? "Ô tô" : "Xe máy"}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-blue-600 uppercase">Giá thuê/ngày</p>
                      <p className="text-sm font-extrabold text-blue-700 tabular-nums">{formatPrice(v.pricePerDay)}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-amber-600 uppercase">Giá mua</p>
                      <p className="text-sm font-extrabold text-amber-700 tabular-nums">{formatPrice(v.purchasePrice)}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase">Tổng thu</p>
                      <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{formatPrice(totalRevenue)}</p>
                    </div>
                    <div className={cn(
                      "border rounded-xl p-3",
                      profit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"
                    )}>
                      <p className={cn(
                        "text-[10px] font-semibold uppercase",
                        profit >= 0 ? "text-emerald-600" : "text-blue-600"
                      )}>Lợi nhuận</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        profit >= 0 ? "text-emerald-700" : "text-blue-600"
                      )}>
                        {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Số KM hiện tại</p>
                      <p className="text-sm font-bold text-slate-800">{(v.current_km || 0).toLocaleString("vi-VN")} km</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Ngày đã cho thuê</p>
                      <p className="text-sm font-bold text-slate-800">{v.totalRentalDays || 0} ngày</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Lấp đầy 30 ngày</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        u30.pct >= 70 ? "text-emerald-600" : u30.pct >= 40 ? "text-amber-600" : "text-blue-500"
                      )}>{u30.pct}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Tổng đơn thuê</p>
                      <p className="text-sm font-bold text-slate-800">{totalRentalCount} đơn</p>
                    </div>
                  </div>

                  {v.notes && v.notes.trim() && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Ghi chú</p>
                      <p className="text-xs text-slate-700 whitespace-pre-line">{v.notes}</p>
                    </div>
                  )}

                  {recentOrders.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-1.5">
                        {recentOrders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 gap-2">
                            <span className="font-bold text-slate-700 truncate">{o.customerName}</span>
                            <span className="text-slate-400 shrink-0">{formatDisplayDate(o.startDate)}</span>
                            <span className="font-bold tabular-nums text-blue-600 shrink-0">
                              {(o.totalPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(v.vehicleImages?.length > 0 || v.documentImages?.length > 0) && (
                    <div className="space-y-3">
                      {v.vehicleImages?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ảnh xe</p>
                          <div className="grid grid-cols-3 gap-2">
                            {v.vehicleImages.map((img, index) => (
                              <div
                                key={index}
                                className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLightboxImage(img)
                                }}
                              >
                                <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {v.documentImages?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ảnh giấy tờ</p>
                          <div className="grid grid-cols-3 gap-2">
                            {v.documentImages.map((img, index) => (
                              <div
                                key={index}
                                className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLightboxImage(img)
                                }}
                              >
                                <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-sm"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        openHistoryDialog(v)
                      }}
                    >
                      <History className="w-3.5 h-3.5 mr-1.5" />
                      Xem lịch sử
                    </Button>
                    <Button
                      className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        openEditDialog(v)
                      }}
                    >
                      <Settings className="w-3.5 h-3.5 mr-1.5" />
                      Chỉnh sửa
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title="Lịch sử xe"
            description={historyVehicle ? `${historyVehicle.name} - ${historyVehicle.licensePlate}` : "Hoạt động cho thuê và bảo trì"}
          />
          <div className="max-h-[450px] overflow-y-auto pr-2 py-4 my-2 scrollbar-thin">
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
          <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
          </div>
        </EntityFormDialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <LightboxModal 
          imageSrc={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}
    </ModulePageShell>
  )
}
