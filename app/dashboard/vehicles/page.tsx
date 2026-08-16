"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { showError, showWarning, showSuccess } from "@/lib/toast-utils"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { supabase } from "@/lib/supabase"
import { uploadMultipleImages } from "@/lib/storage"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard, ModulePagination, ModuleKpiGrid, ModuleEmptyState } from "@/components/dashboard/module-shell"
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
  EntityFormField,
  entityFormInputClass,
  entityFormSelectClass,
} from "@/components/dashboard/entity-form-dialog"
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-date"
import { logger } from "@/lib/logger"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
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
import { Plus, Search, Pencil, Trash2, Car, Eye, Clock, Upload, X, History, MapPin, Save } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

export function extractVehicleLocation(notes?: string): { location: string; cleanNotes: string } {
  if (!notes) return { location: "", cleanNotes: "" }
  const match = notes.match(/\[location:(.*?)\]/i)
  if (match) {
    const location = match[1].trim()
    const cleanNotes = notes.replace(/\[location:(.*?)\]/gi, "").trim()
    return { location, cleanNotes }
  }
  return { location: "", cleanNotes: notes }
}

export function buildVehicleNotesWithLocation(existingNotes: string | undefined, location: string): string {
  const { cleanNotes } = extractVehicleLocation(existingNotes)
  const locStr = location.trim()
  if (!locStr) return cleanNotes
  return cleanNotes ? `${cleanNotes}\n[location:${locStr}]` : `[location:${locStr}]`
}

type VehicleStatus = "available" | "rented" | "maintenance" | "pending"
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
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
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

const historyTypeConfig: Record<HistoryType, { label: string; className: string }> = {
  rent: { label: "Cho thuê", className: "bg-blue-50 text-blue-600" },
  return: { label: "Nhận lại xe", className: "bg-emerald-50 text-emerald-600" },
  maintenance: { label: "Bảo trì", className: "bg-amber-50 text-amber-600" },
}

const vehicleActionBtnClass =
  "h-9 w-9 p-0 border-slate-200 rounded-[var(--radius-control)] hover:bg-slate-50 text-slate-500"
const vehiclePlateClass =
  "inline-block bg-white text-slate-800 border border-slate-200 font-mono font-bold px-2.5 py-1 rounded-[var(--radius-badge)] text-sm shadow-sm tracking-wider uppercase"
const vehicleStatusBadgeClass =
  "inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold border"

function VehicleThumb({ src, name }: { src?: string; name: string }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-badge)] border border-slate-200 bg-slate-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Car className="h-5 w-5 text-slate-300" />
        </div>
      )}
    </div>
  )
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

  // State for vehicle location editing
  const [editingLocationVehicle, setEditingLocationVehicle] = useState<Vehicle | null>(null)
  const [locationInput, setLocationInput] = useState("")
  const [savingLocation, setSavingLocation] = useState(false)

  const openEditLocationDialog = (vehicle: Vehicle) => {
    setEditingLocationVehicle(vehicle)
    const { location } = extractVehicleLocation(vehicle.notes)
    setLocationInput(location)
  }

  const handleSaveVehicleLocation = async () => {
    if (!editingLocationVehicle) return
    try {
      setSavingLocation(true)
      const updatedNotes = buildVehicleNotesWithLocation(editingLocationVehicle.notes, locationInput)

      const { error } = await supabase
        .from('vehicles')
        .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
        .eq('id', editingLocationVehicle.id)

      if (error) throw error

      setVehicles(prev => prev.map(v => v.id === editingLocationVehicle.id ? { ...v, notes: updatedNotes } : v))
      showSuccess(`Đã cập nhật vị trí cho xe ${editingLocationVehicle.name}`)
      setEditingLocationVehicle(null)
    } catch (err: any) {
      console.error("Error saving vehicle location:", err)
      showError(`Lỗi khi lưu vị trí: ${err.message}`)
    } finally {
      setSavingLocation(false)
    }
  }

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

  const pendingDeliveryVehicleIds = useMemo(() => {
    const ids = new Set<string>()
    for (const order of orders || []) {
      if (order.status === "pending" && order.vehicleId) ids.add(order.vehicleId)
    }
    return ids
  }, [orders])

  const filteredVehicles = useMemo(() => {
    const filtered = vehicles.filter((vehicle) => {
      const matchesSearch =
        vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus =
        statusFilter === "all"
          ? true
          : vehicle.status === statusFilter
      return matchesSearch && matchesStatus
    })

    // Sort by performance (utilizationRate) descending
    return [...filtered].sort((a, b) => {
      const utilizationA = vehiclePerformanceMap[a.id]?.utilizationRate || 0
      const utilizationB = vehiclePerformanceMap[b.id]?.utilizationRate || 0
      
      if (utilizationB !== utilizationA) {
        return utilizationB - utilizationA
      }
      // Secondary sort: revenue30d descending
      const revA = vehiclePerformanceMap[a.id]?.revenue30d || 0
      const revB = vehiclePerformanceMap[b.id]?.revenue30d || 0
      if (revB !== revA) {
        return revB - revA
      }
      // Tertiary sort: by name
      return a.name.localeCompare(b.name)
    })
  }, [vehicles, searchTerm, statusFilter, vehiclePerformanceMap])

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
      pendingDelivery: vehicles.filter((v) => v.status === "pending").length,
      rented: vehicles.filter((v) => v.status === "rented").length,
      maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    }
  }, [vehicles])

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
          console.log("Uploading vehicle images...")
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
          console.log("Uploading new vehicle images for edit...")
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
              className="bg-blue-600 !text-white hover:bg-blue-700 hover:!text-white rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition [&_svg]:!text-white"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EntityFormField label="Loại xe" hint="Tên hoặc model của xe" required>
                    <Input
                      id="name"
                      placeholder="VD: Honda Vision"
                      value={newVehicle.name}
                      onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                      className={entityFormInputClass}
                    />
                  </EntityFormField>
                  <EntityFormField label="Biển số" hint="Biển số xe định danh" required>
                    <Input
                      id="licensePlate"
                      placeholder="VD: 75AA-12345"
                      value={newVehicle.licensePlate}
                      onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value })}
                      className={entityFormInputClass}
                    />
                  </EntityFormField>
                  <EntityFormField label="Màu xe">
                    <Input
                      id="color"
                      placeholder="VD: Đen, Trắng, Đỏ"
                      value={newVehicle.color}
                      onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                      className={entityFormInputClass}
                    />
                  </EntityFormField>
                  <EntityFormField label="Số KM hiện tại">
                    <Input
                      id="current_km"
                      type="number"
                      placeholder="VD: 15000"
                      value={newVehicle.current_km}
                      onChange={(e) => setNewVehicle({ ...newVehicle, current_km: e.target.value })}
                      className={entityFormInputClass}
                    />
                  </EntityFormField>
                  <EntityFormField label="Giá thuê (VND/ngày)" required>
                    <Input
                      id="price"
                      type="text"
                      placeholder="VD: 300.000"
                      value={newVehicle.pricePerDay}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setNewVehicle({ ...newVehicle, pricePerDay: formatted })
                      }}
                      className={cn(entityFormInputClass, "font-mono")}
                    />
                  </EntityFormField>
                  <EntityFormField label="Giá mua xe (VND)">
                    <Input
                      id="purchasePrice"
                      type="text"
                      placeholder="VD: 50.000.000"
                      value={newVehicle.purchasePrice}
                      onChange={(e) => {
                        const formatted = formatMoneyInput(e.target.value)
                        setNewVehicle({ ...newVehicle, purchasePrice: formatted })
                      }}
                      className={cn(entityFormInputClass, "font-mono")}
                    />
                  </EntityFormField>
                  <EntityFormField label="Phân loại xe">
                    <Select
                      value={newVehicle.category}
                      onValueChange={(value: "car" | "bike") => setNewVehicle({ ...newVehicle, category: value })}
                    >
                      <SelectTrigger className={entityFormSelectClass}>
                        <SelectValue placeholder="Phân loại" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                        <SelectItem value="bike">Xe máy</SelectItem>
                        <SelectItem value="car">Ô tô</SelectItem>
                      </SelectContent>
                    </Select>
                  </EntityFormField>
                  <EntityFormField label="Trạng thái">
                    <Select
                      value={newVehicle.status}
                      onValueChange={(value: VehicleStatus) => setNewVehicle({ ...newVehicle, status: value })}
                    >
                      <SelectTrigger className={entityFormSelectClass}>
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                        <SelectItem value="available">Sẵn sàng</SelectItem>
                        <SelectItem value="pending">Chờ giao</SelectItem>
                        <SelectItem value="rented">Đang thuê</SelectItem>
                        <SelectItem value="maintenance">Bảo trì</SelectItem>
                      </SelectContent>
                    </Select>
                  </EntityFormField>
                </div>
                <EntityFormField label="Ghi chú" hint="Thông tin bổ sung về xe">
                  <Textarea
                    id="notes"
                    placeholder="Nhập ghi chú về xe..."
                    value={newVehicle.notes}
                    onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                    className={cn(entityFormInputClass, "min-h-[80px] h-auto py-2.5")}
                  />
                </EntityFormField>

                <EntityFormField label="Ảnh xe">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {newVehicle.vehicleImages.map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img instanceof File ? URL.createObjectURL(img) : img}
                          alt={`Xe ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index, "vehicle")}
                          className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-[var(--radius-control)] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-meta mt-1">Thêm ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, "vehicle")}
                      />
                    </label>
                  </div>
                </EntityFormField>

                <EntityFormField label="Ảnh giấy tờ xe">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {newVehicle.documentImages.map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img instanceof File ? URL.createObjectURL(img) : img}
                          alt={`Giấy tờ ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index, "document")}
                          className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-[var(--radius-control)] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-meta mt-1">Thêm ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, "document")}
                      />
                    </label>
                  </div>
                </EntityFormField>
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
        <ModuleKpiGrid columns={5}>
          <RentalKpiCard
            variant="hero"
            label="Tổng số xe"
            value={vehicleStats.total}
            sublabel={`${filteredVehicles.length} đang lọc`}
            onClick={() => setStatusFilter("all")}
            selected={statusFilter === "all"}
          />
          <RentalKpiCard
            variant="hero"
            label="Sẵn sàng"
            value={vehicleStats.available}
            sublabel="Có thể cho thuê"
            valueClassName="text-emerald-700"
            onClick={() => setStatusFilter("available")}
            selected={statusFilter === "available"}
          />
          <RentalKpiCard
            variant="hero"
            label="Chờ giao"
            value={vehicleStats.pendingDelivery}
            sublabel="Chờ giao xe"
            valueClassName="text-amber-700"
            onClick={() => setStatusFilter("pending")}
            selected={statusFilter === "pending"}
          />
          <RentalKpiCard
            variant="hero"
            label="Đang thuê"
            value={vehicleStats.rented}
            sublabel="Xe đang cho khách"
            valueClassName="text-blue-700"
            onClick={() => setStatusFilter("rented")}
            selected={statusFilter === "rented"}
          />
          <RentalKpiCard
            variant="hero"
            label="Bảo trì"
            value={vehicleStats.maintenance}
            sublabel="Tạm ngừng cho thuê"
            valueClassName="text-amber-700"
            onClick={() => setStatusFilter("maintenance")}
            selected={statusFilter === "maintenance"}
          />
        </ModuleKpiGrid>

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
              <SelectTrigger className="w-full lg:w-36 h-10 rounded-[var(--radius-control)] border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="available">Sẵn sàng</SelectItem>
                <SelectItem value="pending">Chờ giao</SelectItem>
                <SelectItem value="rented">Đang thuê</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <CardContent className="p-0">
          {isLoading ? (
            <ModuleEmptyState title="Đang tải dữ liệu xe..." description="Vui lòng chờ trong giây lát." />
          ) : filteredVehicles.length === 0 ? (
            <ModuleEmptyState
              title="Không tìm thấy xe nào"
              description="Thử đổi từ khóa hoặc bộ lọc, hoặc thêm xe mới vào hệ thống."
            />
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                        <th className={rentalTableHeadClass}>Loại xe</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Hiệu suất (30 ngày)</th>
                        <th className={cn(rentalTableHeadClass, "text-left min-w-[150px]")}>Vị trí</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Trạng thái</th>
                        <th className={cn(rentalTableHeadClass, "text-right")}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-body text-slate-700">
                      {paginatedVehicles.map((vehicle, index) => (
                        <tr key={vehicle.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-medium">
                            {startIndex + index + 1}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div className="flex items-center gap-3 min-w-0">
                              <VehicleThumb src={vehicle.vehicleImages?.[0]} name={vehicle.name} />
                              <div className="flex flex-col gap-1 min-w-0">
                                <button
                                  type="button"
                                  className="font-semibold text-slate-800 text-body hover:text-blue-700 hover:underline text-left truncate"
                                  onClick={() => openDetailDialog(vehicle)}
                                >
                                  {vehicle.name}
                                </button>
                                <div className="flex items-center gap-2">
                                  <span className={vehiclePlateClass}>{vehicle.licensePlate}</span>
                                </div>
                                <span className="text-xs font-bold text-rose-600 tabular-nums money">
                                  {formatPrice(vehicle.pricePerDay)}<span className="text-[11px] font-normal text-slate-500">/ngày</span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {(() => {
                              const { utilizationRate, revenue30d } = vehiclePerformanceMap[vehicle.id] || { utilizationRate: 0, revenue30d: 0 }
                              return (
                                <div className="flex flex-col items-center gap-1.5 w-full max-w-[7.5rem] mx-auto">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                    Lấp đầy: {utilizationRate}%
                                  </span>
                                  <div className="w-full h-1.5 rounded-[var(--radius-badge)] bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-[var(--radius-badge)] bg-blue-600"
                                      style={{ width: `${Math.min(100, Math.max(0, utilizationRate))}%` }}
                                    />
                                  </div>
                                  {revenue30d > 0 && (
                                    <span className="text-meta font-semibold text-rose-600 tabular-nums money">
                                      {formatPrice(revenue30d)}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-left">
                            {(() => {
                              const { location } = extractVehicleLocation(vehicle.notes)
                              return (
                                <div className="flex items-center gap-1.5 group">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className={cn("text-xs font-medium truncate max-w-[130px]", location ? "text-slate-800 font-semibold" : "text-slate-400 italic")}>
                                    {location || "chưa cập nhật"}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => openEditLocationDialog(vehicle)}
                                    className="h-6 w-6 p-0 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-md transition-colors shrink-0"
                                    title="Chỉnh sửa vị trí xe"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn(vehicleStatusBadgeClass, rentalVehicleStatusBadgeClass(vehicle.status))}>
                              {getRentalVehicleStatusLabel(vehicle.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={vehicleActionBtnClass}
                                onClick={() => openHistoryDialog(vehicle)}
                                title="Xem lịch sử"
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={vehicleActionBtnClass}
                                onClick={() => openDetailDialog(vehicle)}
                                title="Chi tiết"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={vehicleActionBtnClass}
                                onClick={() => openEditDialog(vehicle)}
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {user?.role === "admin" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon-sm"
                                      className="h-9 w-9 p-0 border-rose-200 rounded-[var(--radius-control)] hover:bg-rose-50 text-rose-600"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)]">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-slate-800">Xác nhận xóa xe</AlertDialogTitle>
                                      <AlertDialogDescription className="text-slate-500">
                                        Bạn có chắc chắn muốn xóa xe <span className="font-medium text-slate-800">{vehicle.name}</span> ({vehicle.licensePlate})?
                                        Hành động này không thể hoàn tác.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="border-slate-200 rounded-[var(--radius-control)]">Hủy</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteVehicle(vehicle.id)}
                                        className="bg-rose-600 !text-white hover:bg-rose-700 rounded-[var(--radius-control)]"
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
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <VehicleThumb src={vehicle.vehicleImages?.[0]} name={vehicle.name} />
                        <div className="flex flex-col gap-1 min-w-0">
                          <button
                            type="button"
                            className="font-semibold text-slate-800 text-body hover:text-blue-700 hover:underline text-left truncate"
                            onClick={() => openDetailDialog(vehicle)}
                          >
                            {vehicle.name}
                          </button>
                          <span className={vehiclePlateClass}>{vehicle.licensePlate}</span>
                        </div>
                      </div>
                      <span className={cn(vehicleStatusBadgeClass, "shrink-0", rentalVehicleStatusBadgeClass(vehicle.status))}>
                        {getRentalVehicleStatusLabel(vehicle.status)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-slate-100/50">
                      <span className="font-semibold text-slate-900 tabular-nums money">{formatPrice(vehicle.pricePerDay)}/ngày</span>
                      <div className="flex gap-1 items-center">
                        <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => openHistoryDialog(vehicle)} title="Lịch sử">
                          <Clock className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => openDetailDialog(vehicle)} title="Chi tiết">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => openEditDialog(vehicle)} title="Chỉnh sửa">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {user?.permissions.canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-9 w-9 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc chắn muốn xóa xe ${vehicle.name} (${vehicle.licensePlate})?`)) {
                                handleDeleteVehicle(vehicle.id)
                              }
                            }}
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </ModuleMobileCard>
                ))}
              />
              <ModulePagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={filteredVehicles.length}
                itemLabel="xe"
                onPageChange={setCurrentPage}
                className="rounded-b-2xl"
              />
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
                <EntityFormSection title="Thông tin xe" description="Cập nhật thông tin cơ bản và giá thuê">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EntityFormField label="Loại xe" required>
                      <Input
                        id="edit-name"
                        value={editingVehicle.name}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Biển số" required>
                      <Input
                        id="edit-licensePlate"
                        value={editingVehicle.licensePlate}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, licensePlate: e.target.value })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Màu xe">
                      <Input
                        id="edit-color"
                        value={editingVehicle.color}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Số KM hiện tại">
                      <Input
                        id="edit-current_km"
                        type="number"
                        value={editingVehicle.current_km}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, current_km: parseInt(e.target.value) || 0 })}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <EntityFormField label="Giá thuê (VND/ngày)" required>
                      <Input
                        id="edit-price"
                        type="text"
                        value={editingVehicle.pricePerDay}
                        onChange={(e) => {
                          const formatted = formatMoneyInput(e.target.value)
                          setEditingVehicle({ ...editingVehicle, pricePerDay: formatted as any })
                        }}
                        className={cn(entityFormInputClass, "font-mono")}
                      />
                    </EntityFormField>
                    <EntityFormField label="Giá mua xe (VND)">
                      <Input
                        id="edit-purchasePrice"
                        type="text"
                        value={editingVehicle.purchasePrice}
                        onChange={(e) => {
                          const formatted = formatMoneyInput(e.target.value)
                          setEditingVehicle({ ...editingVehicle, purchasePrice: formatted as any })
                        }}
                        className={cn(entityFormInputClass, "font-mono")}
                      />
                    </EntityFormField>
                    <EntityFormField label="Phân loại xe">
                      <Select
                        value={editingVehicle.category || "bike"}
                        onValueChange={(value: "car" | "bike") => setEditingVehicle({ ...editingVehicle, category: value })}
                      >
                        <SelectTrigger className={entityFormSelectClass}>
                          <SelectValue placeholder="Phân loại" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 rounded-[var(--radius-control)]">
                          <SelectItem value="bike">Xe máy</SelectItem>
                          <SelectItem value="car">Ô tô</SelectItem>
                        </SelectContent>
                      </Select>
                    </EntityFormField>
                    <EntityFormField label="Trạng thái">
                      <Select
                        value={editingVehicle.status}
                        onValueChange={(value: VehicleStatus) => setEditingVehicle({ ...editingVehicle, status: value })}
                      >
                        <SelectTrigger className={entityFormSelectClass}>
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 rounded-[var(--radius-control)]">
                          <SelectItem value="available">Sẵn sàng</SelectItem>
                          <SelectItem value="pending">Chờ giao</SelectItem>
                          <SelectItem value="rented">Đang thuê</SelectItem>
                          <SelectItem value="maintenance">Bảo trì</SelectItem>
                        </SelectContent>
                      </Select>
                    </EntityFormField>
                  </div>
                  <EntityFormField label="Ghi chú">
                    <Textarea
                      id="edit-notes"
                      value={editingVehicle.notes}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
                      className={cn(entityFormInputClass, "min-h-[80px] h-auto py-2.5")}
                    />
                  </EntityFormField>

                  <EntityFormField label="Ảnh xe">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {editingVehicle.vehicleImages.map((img, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string)}
                            alt={`Xe ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setLightboxImage((img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string))}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index, "vehicle", true)}
                            className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square rounded-[var(--radius-control)] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-meta mt-1">Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, "vehicle", true)}
                        />
                      </label>
                    </div>
                  </EntityFormField>

                  <EntityFormField label="Ảnh giấy tờ xe">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {editingVehicle.documentImages.map((img, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200 group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string)}
                            alt={`Giấy tờ ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setLightboxImage((img as any) instanceof File ? URL.createObjectURL((img as any)) : (img as string))}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index, "document", true)}
                            className="absolute top-2 right-2 w-11 h-11 bg-rose-600 !text-white rounded-[var(--radius-badge)] flex items-center justify-center hover:bg-rose-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 ui-transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square rounded-[var(--radius-control)] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-meta mt-1">Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, "document", true)}
                        />
                      </label>
                    </div>
                  </EntityFormField>
                </EntityFormSection>
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
                      vehicleStatusBadgeClass,
                      rentalVehicleStatusBadgeClass(v.status)
                    )}>
                      {getRentalVehicleStatusLabel(v.status)}
                    </span>
                    {v.category && (
                      <span className="text-sm text-slate-500">
                        Phân loại: <span className="font-medium text-slate-800">{v.category === "car" ? "Ô tô" : "Xe máy"}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-[var(--radius-control)] p-3">
                      <p className="text-meta text-slate-500">Giá thuê/ngày</p>
                      <p className="text-sm font-extrabold text-slate-900 money tabular-nums">{formatPrice(v.pricePerDay)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-[var(--radius-control)] p-3">
                      <p className="text-meta text-slate-500">Giá mua</p>
                      <p className="text-sm font-extrabold text-amber-700 tabular-nums">{formatPrice(v.purchasePrice)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-[var(--radius-control)] p-3">
                      <p className="text-meta text-slate-500">Tổng thu</p>
                      <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{formatPrice(totalRevenue)}</p>
                    </div>
                    <div className={cn(
                      "border rounded-xl p-3",
                      profit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"
                    )}>
                      <p className={cn(
                        "text-sm font-semibold uppercase",
                        profit >= 0 ? "text-emerald-600" : "text-slate-500"
                      )}>Lợi nhuận</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        profit >= 0 ? "text-emerald-700 money" : "text-slate-900 money"
                      )}>
                        {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-meta text-slate-500 mb-0.5">Số KM hiện tại</p>
                      <p className="text-sm font-bold text-slate-800">{(v.current_km || 0).toLocaleString("vi-VN")} km</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-meta text-slate-500 mb-0.5">Ngày đã cho thuê</p>
                      <p className="text-sm font-bold text-slate-800">{v.totalRentalDays || 0} ngày</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-meta text-slate-500 mb-0.5">Lấp đầy 30 ngày</p>
                      <p className={cn(
                        "text-sm font-extrabold tabular-nums",
                        u30.pct >= 70 ? "text-emerald-600" : u30.pct >= 40 ? "text-amber-600" : "text-blue-500"
                      )}>{u30.pct}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-meta text-slate-500 mb-0.5">Tổng đơn thuê</p>
                      <p className="text-sm font-bold text-slate-800">{totalRentalCount} đơn</p>
                    </div>
                  </div>

                  {v.notes && v.notes.trim() && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-meta text-slate-500 mb-1">Ghi chú</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{v.notes}</p>
                    </div>
                  )}

                  {recentOrders.length > 0 && (
                    <div>
                      <p className="text-meta text-slate-500 mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-1.5">
                        {recentOrders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 gap-2">
                            <span className="font-bold text-slate-700 truncate">{o.customerName}</span>
                            <span className="text-slate-400 shrink-0">{formatDisplayDate(o.startDate)}</span>
                            <span className="font-bold tabular-nums text-slate-900 money shrink-0">
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
                          <p className="text-meta text-slate-500 mb-2">Ảnh xe</p>
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
                          <p className="text-meta text-slate-500 mb-2">Ảnh giấy tờ</p>
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
                      className="flex-1 h-11 text-body"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        openHistoryDialog(v)
                      }}
                    >
                      <History className="w-4 h-4 mr-1.5" />
                      Xem lịch sử
                    </Button>
                    <Button
                      className="flex-1 h-11 text-body bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white [&_svg]:!text-white"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        openEditDialog(v)
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
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
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Chưa có lịch sử hoạt động</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                    <div className="space-y-4">
                      {getVehicleHistory(historyVehicle.id).map((log) => (
                        <div key={log.id} className="relative pl-10">
                          <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
                            log.type === "rent" ? "bg-blue-500" :
                            log.type === "return" ? "bg-emerald-500" : "bg-amber-500"
                          }`} />
                          <div className="bg-slate-50 border border-slate-100 rounded-[var(--radius-control)] p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-badge)] text-sm font-medium ${historyTypeConfig[log.type].className}`}>
                                {historyTypeConfig[log.type].label}
                              </span>
                              <span className="text-sm text-muted-foreground">{log.datetime}</span>
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
          <div className="flex justify-end pt-4 border-t border-slate-100 mt-2">
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)} className="rounded-xl border-slate-200">
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

      {/* Popup nhỏ Cập nhật Vị trí xe */}
      <Dialog open={!!editingLocationVehicle} onOpenChange={(open) => !open && setEditingLocationVehicle(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md p-5 rounded-[var(--radius-container)] gap-4">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
              Cập nhật vị trí hiện tại của xe
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Xe: <strong className="text-slate-800">{editingLocationVehicle?.name}</strong> ({editingLocationVehicle?.licensePlate})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Label htmlFor="vehicle-location-input" className="text-xs font-semibold text-slate-700">
              Địa chỉ / Vị trí hiện tại của xe
            </Label>
            <Input
              id="vehicle-location-input"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Ví dụ: Bãi xe A, 123 Lê Lợi, Khách đang gửi..."
              className="h-10 text-sm bg-white border-slate-200"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveVehicleLocation()
                }
              }}
            />
            <p className="text-[11px] text-slate-500">
              Nhập địa chỉ hoặc vị trí cụ thể để dễ dàng quản lý bãi và điều phối xe. Để trống nếu muốn xóa vị trí.
            </p>
          </div>

          <DialogFooter className="pt-2 border-t flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditingLocationVehicle(null)} className="h-9 text-xs flex-1 sm:flex-none">
              Hủy
            </Button>
            <Button
              disabled={savingLocation}
              onClick={handleSaveVehicleLocation}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 gap-1.5 flex-1 sm:flex-none"
            >
              <Save className="w-4 h-4" />
              {savingLocation ? "Đang lưu..." : "Lưu vị trí"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageShell>
  )
}
