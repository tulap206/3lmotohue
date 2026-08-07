"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { showError, showWarning } from "@/lib/toast-utils"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { logger } from "@/lib/logger"
import { supabase, fetchCustomers, fetchRentals } from "@/lib/supabase"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard, ModulePagination } from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalCustomerStatusLabel,
  rentalCustomerStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormFooter,
} from "@/components/dashboard/entity-form-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Search, Trash2, User, Phone, MapPin, Eye, Upload, Settings, Clock, Calendar, History } from "lucide-react"

interface Customer {
  id: string
  name: string
  phone: string
  address: string
  idcard: string
  totalrentals: number
  status: "active" | "inactive" | "renting" | "pending"
  createdAt?: string
  created_at?: string
  customerphoto?: string[]
  cccdfront?: string[]
  cccdback?: string[]
  licensefront?: string[]
  licenseback?: string[]
}

// Image upload button component
const ImageUploadButton = ({ 
  label, 
  onImageSelected,
  preview
}: { 
  label: string
  onImageSelected: (base64: string) => void
  preview?: string
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  return (
    <div className="space-y-2">
      <Label className="text-slate-600">{label}</Label>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-blue-400 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
      >
        <div className="bg-blue-50 p-3 rounded-lg">
          <Upload className="w-6 h-6 text-blue-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">Thêm ảnh</p>
          <p className="text-sm text-slate-500">JPG, PNG, GIF</p>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
              const base64 = event.target?.result as string
              onImageSelected(base64)
            }
            reader.readAsDataURL(file)
          }
        }}
      />
      {preview && (
        <div className="relative w-fit">
          <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
        </div>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const { user } = useAuth()
  const { customers, setCustomers, orders: rentals, isLoading: loading } = useRentalData()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    idcard: "",
    customerphoto: [] as string[],
    cccdfront: [] as string[],
    cccdback: [] as string[],
    licensefront: [] as string[],
    licenseback: [] as string[],
  })


  const [filterStatus, setFilterStatus] = useState("all")

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter(
      (customer) => {
        const matchesSearch =
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery)
        
        const matchesStatus = filterStatus === "all" || customer.status === filterStatus
        
        return matchesSearch && matchesStatus
      }
    )

    // Sort: renting -> pending -> active -> inactive
    return [...filtered].sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === "renting") return 1
        if (status === "pending") return 2
        if (status === "active") return 3
        if (status === "inactive") return 4
        return 5
      }
      const priorityA = getPriority(a.status)
      const priorityB = getPriority(b.status)
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      // Secondary sort: created_at / createdAt descending
      const timeA = new Date(a.created_at || a.createdAt || 0).getTime()
      const timeB = new Date(b.created_at || b.createdAt || 0).getTime()
      return timeB - timeA
    })
  }, [customers, searchQuery, filterStatus])

  // Reset page when search query or status filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredCustomers.length / itemsPerPage)
  }, [filteredCustomers])

  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredCustomers, currentPage])

  const customerStats = useMemo(() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    const newThisMonth = customers.filter((c) => {
      const raw = c.created_at || c.createdAt
      if (!raw) return false
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return false
      return d.getMonth() === month && d.getFullYear() === year
    }).length

    return {
      total: customers.length,
      renting: customers.filter((c) => c.status === "renting").length,
      pending: customers.filter((c) => c.status === "pending").length,
      inactive: customers.filter((c) => c.status === "inactive").length,
      month: month + 1,
      newThisMonth,
    }
  }, [customers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.name || formData.name.trim() === '') {
      showWarning('Vui lòng nhập tên khách hàng')
      return
    }
    if (!formData.phone || formData.phone.trim() === '') {
      showWarning('Vui lòng nhập số điện thoại')
      return
    }
    
    try {
      // Start with empty or existing images depending on if editing
      let uploadedImages = {
        customerphoto: editingCustomer?.customerphoto || [],
        cccdfront: editingCustomer?.cccdfront || [],
        cccdback: editingCustomer?.cccdback || [],
        licensefront: editingCustomer?.licensefront || [],
        licenseback: editingCustomer?.licenseback || [],
      }

      // Upload images to Supabase Storage
      const uploadImage = async (base64: string, folder: string, fileName: string) => {
        if (!base64 || base64.length === 0) {
          console.log(`⏭ Skipping ${fileName} - empty base64`)
          return null
        }
        
        // Validate it's actually base64
        if (!base64.startsWith('data:')) {
          console.log(`⏭ Skipping ${fileName} - not base64 (is URL)`)
          return null
        }
        
        try {
          console.log(`📤 Uploading ${fileName} to ${folder}...`)
          
          // Convert base64 to blob
          const parts = base64.split(',')
          if (parts.length !== 2) {
            console.error(`❌ Invalid base64 format for ${fileName}`)
            return null
          }
          
          const base64Data = parts[1]
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'image/jpeg' })

          const path = `${folder}/${fileName}`
          const { data, error } = await supabase.storage
            .from('customer-documents')
            .upload(path, blob, { upsert: true })

          if (error) {
            console.error(`❌ Storage error for ${fileName}:`, error)
            return null
          }
          
          console.log(`✅ Uploaded successfully: ${path}`)
          
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('customer-documents')
            .getPublicUrl(path)
          
          console.log(`🔗 Public URL: ${urlData.publicUrl}`)
          return urlData.publicUrl
        } catch (error) {
          console.error(`❌ Error uploading ${fileName}:`, error)
          return null
        }
      }

      // Sanitization helper for storage key filenames
      const sanitizeFilename = (name: string): string => {
        return name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/[^a-zA-Z0-9.\-_]/g, "-")
          .replace(/-+/g, "-")
          .toLowerCase()
      }

      // Upload all images in parallel
      const uploadPromises = []
      const safeName = sanitizeFilename(formData.name)
      
      // Helper to check if string is base64 (not a URL)
      const isBase64 = (str: string | undefined | null): boolean => {
        if (!str || typeof str !== 'string') return false
        return str.startsWith('data:')
      }
      
      if (formData.customerphoto && formData.customerphoto.length > 0 && isBase64(formData.customerphoto[0])) {
        uploadPromises.push(
          uploadImage(formData.customerphoto[0], 'customer-photos', `${safeName}-${Date.now()}.jpg`)
            .then(url => ({ key: 'customerphoto', url }))
        )
      }
      if (formData.cccdfront && formData.cccdfront.length > 0 && isBase64(formData.cccdfront[0])) {
        uploadPromises.push(
          uploadImage(formData.cccdfront[0], 'cccd-front', `${safeName}-front-${Date.now()}.jpg`)
            .then(url => ({ key: 'cccdfront', url }))
        )
      }
      if (formData.cccdback && formData.cccdback.length > 0 && isBase64(formData.cccdback[0])) {
        uploadPromises.push(
          uploadImage(formData.cccdback[0], 'cccd-back', `${safeName}-back-${Date.now()}.jpg`)
            .then(url => ({ key: 'cccdback', url }))
        )
      }
      if (formData.licensefront && formData.licensefront.length > 0 && isBase64(formData.licensefront[0])) {
        uploadPromises.push(
          uploadImage(formData.licensefront[0], 'license-front', `${safeName}-license-front-${Date.now()}.jpg`)
            .then(url => ({ key: 'licensefront', url }))
        )
      }
      if (formData.licenseback && formData.licenseback.length > 0 && isBase64(formData.licenseback[0])) {
        uploadPromises.push(
          uploadImage(formData.licenseback[0], 'license-back', `${safeName}-license-back-${Date.now()}.jpg`)
            .then(url => ({ key: 'licenseback', url }))
        )
      }

      // Wait for all uploads
      const uploadResults = await Promise.all(uploadPromises)
      console.log("Upload results:", uploadResults)
      
      uploadResults.forEach(result => {
        if (result && result.url) {
          console.log(`✅ Uploaded ${result.key}: ${result.url}`)
          uploadedImages[result.key as keyof typeof uploadedImages] = [result.url]
        } else if (result) {
          console.warn(`⚠ No URL for ${result.key}`)
        }
      })
      
      console.log("📷 Final uploadedImages:", uploadedImages)

      if (editingCustomer) {
        console.log("📝 Editing customer:", editingCustomer.id)
        console.log("🔄 formData images:", {
          customerphoto: formData.customerphoto?.[0]?.substring(0, 50),
          cccdfront: formData.cccdfront?.[0]?.substring(0, 50),
        })
        
        const updateData: any = {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          idcard: formData.idcard,
        }
        
        // Merge: use new uploaded images if available, otherwise keep existing
        updateData.customerphoto = uploadedImages.customerphoto.length > 0 
          ? uploadedImages.customerphoto 
          : (editingCustomer.customerphoto || [])
        
        updateData.cccdfront = uploadedImages.cccdfront.length > 0 
          ? uploadedImages.cccdfront 
          : (editingCustomer.cccdfront || [])
        
        updateData.cccdback = uploadedImages.cccdback.length > 0 
          ? uploadedImages.cccdback 
          : (editingCustomer.cccdback || [])
        
        updateData.licensefront = uploadedImages.licensefront.length > 0 
          ? uploadedImages.licensefront 
          : (editingCustomer.licensefront || [])
        
        updateData.licenseback = uploadedImages.licenseback.length > 0 
          ? uploadedImages.licenseback 
          : (editingCustomer.licenseback || [])
        
        console.log("💾 Final data to update:", updateData)

        const { error } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', editingCustomer.id)
        
        if (error) {
          console.error("❌ Update error:", error)
          throw error
        }
        console.log("✅ Customer updated successfully")
        if (user) logger.editCustomer(user.username, user.displayName, formData.name)
      } else {
        // Check if phone already exists
        const existingCustomer = customers.find(
          (c) => c.phone === formData.phone
        )
        
        if (existingCustomer) {
          showWarning(`Khách hàng với số điện thoại "${formData.phone}" đã tồn tại!`, `Tên: ${existingCustomer.name}\nĐịa chỉ: ${existingCustomer.address}`)
          return
        }
        
        const { error } = await supabase
          .from('customers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            facebook: "",
            address: formData.address,
            idcard: formData.idcard,
            totalrentals: 0,
            status: "active",
            customerphoto: uploadedImages.customerphoto,
            cccdfront: uploadedImages.cccdfront,
            cccdback: uploadedImages.cccdback,
            licensefront: uploadedImages.licensefront,
            licenseback: uploadedImages.licenseback,
          }])
        
        if (error) throw error
        if (user) logger.addCustomer(user.username, user.displayName, formData.name, formData.phone)
      }
      
      const [updatedCustomers, rentalsData] = await Promise.all([
        fetchCustomers(),
        fetchRentals()
      ])
      const updated = updatedCustomers.map((customer) => {
        const activeRental = rentalsData.find(
          (rental: any) => rental.customerId === customer.id && rental.status === "active"
        )
        const pendingRental = rentalsData.find(
          (rental: any) => rental.customerId === customer.id && rental.status === "pending"
        )
        
        let statusLabel = "active"
        if (activeRental) {
          statusLabel = "renting"
        } else if (pendingRental) {
          statusLabel = "pending"
        } else if (customer.status === "inactive") {
          statusLabel = "inactive"
        }

        const totalrentals = rentalsData.filter((r) => r.customerId === customer.id).length
        
        return {
          ...customer,
          status: statusLabel as any,
          totalrentals
        }
      })
      const sorted = updated.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
        return dateB - dateA
      })
      setCustomers(sorted)
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving customer:", error)
      showError('Lỗi: ' + (error as any).message)
    }
  }

  const resetForm = () => {
    setFormData({ 
      name: "", 
      phone: "", 
      address: "", 
      idcard: "",
      customerphoto: [],
      cccdfront: [],
      cccdback: [],
      licensefront: [],
      licenseback: [],
    })
    setEditingCustomer(null)
  }

  const openDetailDialog = (customer: Customer) => {
    setViewingCustomer(customer)
    setIsDetailDialogOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      idcard: customer.idcard,
      customerphoto: customer.customerphoto || [],
      cccdfront: customer.cccdfront || [],
      cccdback: customer.cccdback || [],
      licensefront: customer.licensefront || [],
      licenseback: customer.licenseback || [],
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    const customer = customers.find((c) => c.id === id)
    if (customer) {
      setCustomerToDelete(customer)
      setDeleteConfirmOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return
    
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id)
      
      if (error) throw error
      setCustomers(customers.filter((c) => c.id !== customerToDelete.id))
      if (user) {
        logger.deleteCustomer(user.username, user.displayName, customerToDelete.name)
      }
      setDeleteConfirmOpen(false)
      setCustomerToDelete(null)
    } catch (error) {
      console.error("Error deleting customer:", error)
    }
  }

  if (loading) {
    return (
      <ModulePageShell module="rental">
        <div className="space-y-6">
          <div className="h-16 skeleton rounded-[var(--radius-container)]" />
          <div className="h-96 skeleton rounded-[var(--radius-container)]" />
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell module="rental">
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-base mt-2">
              Bạn có chắc chắn muốn xoá khách hàng <span className="font-semibold text-slate-800">"{customerToDelete?.name}"</span> không?
              <p className="text-meta text-rose-600 mt-2">Hành động này không thể hoàn tác.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setCustomerToDelete(null)
              }}
              className="border-slate-300"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModuleSubpageHeader
        module="rental"
        sticky
        title="Khách hàng"
        subtitle="Quản lý thông tin khách hàng thuê xe"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Khách hàng" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition"
              onClick={() => { setEditingCustomer(null); resetForm(); setIsDialogOpen(true) }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm khách hàng
            </Button>
          </div>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <EntityFormDialogContent accent="blue" maxWidth="2xl">
              <EntityFormHeader
                title={editingCustomer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
                description={editingCustomer ? "Cập nhật thông tin khách hàng" : "Nhập thông tin khách hàng mới"}
              />
              <form onSubmit={handleSubmit}>
                <EntityFormBody>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-600">Họ và tên</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Nguyễn Văn A"
                    className="bg-slate-50 border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-600">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="VD: 0901234567"
                    className="bg-slate-50 border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idcard" className="text-slate-600">Số CCCD/CMND</Label>
                  <Input
                    id="idcard"
                    value={formData.idcard}
                    onChange={(e) => setFormData({ ...formData, idcard: e.target.value })}
                    placeholder="VD: 079123456789"
                    className="bg-slate-50 border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-slate-600">Địa chỉ</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM"
                    className="bg-slate-50 border-slate-200 rounded-xl"
                    required
                  />
                </div>
                
                {/* Image Upload Section */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <p className="font-medium text-slate-700">Thêm ảnh (tùy chọn)</p>
                  
                  <ImageUploadButton
                    label="Ảnh khách hàng"
                    preview={formData.customerphoto?.[0]}
                    onImageSelected={(base64) => setFormData({ ...formData, customerphoto: base64 ? [base64] : [] })}
                  />

                  <ImageUploadButton
                    label="Ảnh CCCD mặt trước"
                    preview={formData.cccdfront?.[0]}
                    onImageSelected={(base64) => setFormData({ ...formData, cccdfront: base64 ? [base64] : [] })}
                  />

                  <ImageUploadButton
                    label="Ảnh CCCD mặt sau"
                    preview={formData.cccdback?.[0]}
                    onImageSelected={(base64) => setFormData({ ...formData, cccdback: base64 ? [base64] : [] })}
                  />

                  <ImageUploadButton
                    label="Ảnh GPLX mặt trước"
                    preview={formData.licensefront?.[0]}
                    onImageSelected={(base64) => setFormData({ ...formData, licensefront: base64 ? [base64] : [] })}
                  />

                  <ImageUploadButton
                    label="Ảnh GPLX mặt sau"
                    preview={formData.licenseback?.[0]}
                    onImageSelected={(base64) => setFormData({ ...formData, licenseback: base64 ? [base64] : [] })}
                  />
                </div>
                
                </EntityFormBody>
                <EntityFormFooter
                  accent="blue"
                  onCancel={() => { setIsDialogOpen(false); resetForm(); }}
                  submitLabel={editingCustomer ? "Cập nhật" : "Thêm"}
                />
              </form>
            </EntityFormDialogContent>
          </Dialog>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <RentalKpiCard
            variant="hero"
            label="Tổng khách hàng"
            value={customerStats.total}
            sublabel={
              <>
                <span className="block">{filteredCustomers.length} đang lọc</span>
                <span className="block mt-0.5">
                  Số khách tháng {customerStats.month}: {customerStats.newThisMonth} khách
                </span>
              </>
            }
          />
          <RentalKpiCard variant="hero" label="Đang thuê" value={customerStats.renting} sublabel="Khách đang giữ xe" valueClassName="text-blue-700" />
          <RentalKpiCard variant="hero" label="Chờ giao xe" value={customerStats.pending} sublabel="Đơn chờ xử lý" valueClassName="text-amber-700" />
          <RentalKpiCard variant="hero" label="Ngừng hoạt động" value={customerStats.inactive} sublabel="Không giao dịch" valueClassName="text-slate-600" />
        </div>

      <ModuleSectionCard
        title="Danh sách khách hàng"
        description={`Quản lý ${filteredCustomers.length} khách hàng trong hệ thống`}
        filters={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tên, SĐT, CCCD..."
                className={cn(rentalFilterInputClass, "pl-9 h-10")}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-40 h-10 rounded-xl border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-xl">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="renting">Đang thuê xe</SelectItem>
                <SelectItem value="pending">Chờ giao xe</SelectItem>
                <SelectItem value="inactive">Ngừng hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Không tìm thấy khách hàng nào</p>
            </div>
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center text-slate-600")}>STT</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Khách hàng</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Liên hệ</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>CCCD</th>
                        <th className={cn(rentalTableHeadClass, "text-slate-600")}>Địa chỉ</th>
                        <th className={cn(rentalTableHeadClass, "text-center text-slate-600")}>Trạng thái</th>
                        <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {paginatedCustomers.map((customer, index) => (
                        <tr key={customer.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-medium">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {customer.customerphoto && customer.customerphoto.length > 0 ? (
                                <img src={customer.customerphoto[0]} alt={customer.name} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-bold">
                                  {customer.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                 <button
                                   type="button"
                                   className="font-bold text-slate-800 hover:text-slate-700 hover:underline text-left"
                                   onClick={() => openDetailDialog(customer)}
                                 >
                                   {customer.name}
                                 </button>
                                 <p className="text-sm text-slate-400 font-medium">
                                   Đã thuê: <span className="font-bold text-blue-600">{customer.totalrentals} lượt</span>
                                 </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-0.5 text-sm">
                              <span className="font-medium text-slate-700 inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {customer.phone}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center text-sm font-semibold font-mono text-slate-600">
                            {customer.idcard || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-500 max-w-[200px] truncate">
                            {customer.address}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold border",
                              rentalCustomerStatusBadgeClass(customer.status)
                            )}>
                              {getRentalCustomerStatusLabel(customer.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                                onClick={() => { setHistoryCustomer(customer); setIsHistoryDialogOpen(true) }}
                                title="Lịch sử thuê"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                                onClick={() => openDetailDialog(customer)}
                                title="Chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                                onClick={() => handleEdit(customer)}
                                title="Chỉnh sửa"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 border-rose-200 rounded-lg hover:bg-rose-50 text-rose-500"
                                onClick={() => handleDelete(customer.id)}
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                mobile={paginatedCustomers.map((customer) => (
                  <ModuleMobileCard key={customer.id}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        {customer.customerphoto && customer.customerphoto.length > 0 ? (
                          <img src={customer.customerphoto[0]} alt={customer.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-bold">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <button
                            type="button"
                            className="font-bold text-slate-800 text-sm hover:text-slate-700 hover:underline text-left"
                            onClick={() => openDetailDialog(customer)}
                          >
                            {customer.name}
                          </button>
                          <p className="text-sm text-slate-500">Đã thuê: <span className="font-bold text-blue-600">{customer.totalrentals} lượt</span></p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full border shrink-0 ${rentalCustomerStatusBadgeClass(customer.status)}`}>
                        {getRentalCustomerStatusLabel(customer.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {customer.phone}
                      </div>
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {customer.address}
                      </div>
                    </div>
                    <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-slate-100/50 items-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => { setHistoryCustomer(customer); setIsHistoryDialogOpen(true) }} title="Lịch sử thuê">
                        <Clock className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => openDetailDialog(customer)} title="Chi tiết">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => handleEdit(customer)} title="Chỉnh sửa">
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                      {user?.permissions.canDelete && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700" 
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa khách hàng ${customer.name}?`)) {
                              handleDelete(customer.id)
                            }
                          }}
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </ModuleMobileCard>
                ))}
              />
              <ModulePagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={filteredCustomers.length}
                itemLabel="khách"
                onPageChange={setCurrentPage}
                className="rounded-b-2xl"
              />
            </>
          )}
        </CardContent>
      </ModuleSectionCard>
      </div>

      {/* #12 Customer rental history dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title={`Lịch sử thuê — ${historyCustomer?.name ?? ""}`}
            description="Tất cả các đơn thuê xe của khách hàng này"
          />
          {historyCustomer && (() => {
            const cRentals = rentals.filter(r => r.customerId === historyCustomer.id)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
            const totalRev = cRentals.filter(r => r.status === "completed").reduce((s: number, r: any) => s + (r.revenue || r.totalPrice || 0), 0)
            const totalSpend = cRentals.reduce((s: number, r: any) => s + (r.totalPrice || 0), 0)
            return (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-sm text-slate-500">Tổng đơn</p>
                    <p className="text-lg font-extrabold text-slate-800">{cRentals.length}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-sm text-emerald-600">Đã hoàn thành</p>
                    <p className="text-lg font-extrabold text-emerald-700">{cRentals.filter(r => r.status === "completed").length}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-sm text-blue-500">Tổng doanh thu</p>
                    <p className="text-sm font-extrabold text-blue-700 tabular-nums">{totalRev.toLocaleString("vi-VN")}đ</p>
                  </div>
                </div>
                {cRentals.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">Khách hàng chưa có đơn thuê nào</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cRentals.map(r => {
                      const statusColor = r.status === "completed" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : r.status === "cancelled" ? "text-slate-500 bg-slate-50 border-slate-100" : r.status === "active" ? "text-blue-700 bg-blue-50 border-blue-100" : "text-amber-700 bg-amber-50 border-amber-100"
                      const statusLabel = { pending: "Chờ giao", active: "Đang thuê", completed: "Hoàn thành", cancelled: "Đã hủy" }[r.status as string] || r.status
                      return (
                        <div key={r.id} className="py-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{r.vehicleName}</p>
                              <p className="text-sm text-slate-400 font-mono">{r.licensePlate}</p>
                            </div>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>{statusLabel}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{r.startDate} → {r.endDate} · {r.totalDays} ngày</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{(r.pricePerDay || 0).toLocaleString("vi-VN")}đ/ngày · Cọc {(r.deposit || 0).toLocaleString("vi-VN")}đ</span>
                            <span className={`font-bold tabular-nums ${r.status === "completed" ? "text-emerald-600" : "text-slate-600"}`}>
                              {r.status === "completed" ? `+${(r.revenue || r.totalPrice || 0).toLocaleString("vi-VN")}đ` : `${(r.totalPrice || 0).toLocaleString("vi-VN")}đ`}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        setIsDetailDialogOpen(open)
        if (!open) setViewingCustomer(null)
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="lg">
          {viewingCustomer && (() => {
            const cust = viewingCustomer
            const custRentals = rentals
              .filter((r) => r.customerId === cust.id)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
            const docImages = [
              ...(cust.cccdfront?.[0] ? [{ label: "CCCD mặt trước", src: cust.cccdfront[0] }] : []),
              ...(cust.cccdback?.[0] ? [{ label: "CCCD mặt sau", src: cust.cccdback[0] }] : []),
              ...(cust.licensefront?.[0] ? [{ label: "GPLX mặt trước", src: cust.licensefront[0] }] : []),
              ...(cust.licenseback?.[0] ? [{ label: "GPLX mặt sau", src: cust.licenseback[0] }] : []),
            ]
            return (
              <>
                <EntityFormHeader
                  title="Chi tiết khách hàng"
                  description={getRentalCustomerStatusLabel(cust.status)}
                />
                <div className="p-4 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      {cust.customerphoto && cust.customerphoto.length > 0 ? (
                        <img
                          src={cust.customerphoto[0]}
                          alt="Ảnh khách"
                          className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <User className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-lg font-extrabold text-slate-900">{cust.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{cust.phone || "Chưa có SĐT"}</span>
                      </p>
                      {cust.address && (
                        <p className="text-sm text-slate-500 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          {cust.address}
                        </p>
                      )}
                      <div className="pt-1">
                        <span className={cn(
                          "inline-flex items-center text-sm font-bold px-2 py-0.5 rounded-full border",
                          rentalCustomerStatusBadgeClass(cust.status)
                        )}>
                          {getRentalCustomerStatusLabel(cust.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Số CCCD / CMND</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">{cust.idcard || "—"}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Tổng lần thuê</p>
                      <p className="text-lg font-extrabold text-slate-800">{cust.totalrentals || custRentals.length} lượt</p>
                    </div>
                  </div>

                  {docImages.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Ảnh tài liệu</p>
                      <div className="grid grid-cols-2 gap-3">
                        {docImages.map((img) => (
                          <div key={img.label}>
                            <p className="text-sm font-medium text-slate-400 mb-1">{img.label}</p>
                            <img
                              src={img.src}
                              alt={img.label}
                              className="w-full rounded-xl border border-slate-200 shadow-sm object-cover aspect-video"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {custRentals.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-1.5">
                        {custRentals.slice(0, 4).map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 gap-2">
                            <span className="font-bold text-slate-700 truncate">{r.vehicleName}</span>
                            <span className="text-slate-400 font-mono shrink-0">{r.licensePlate}</span>
                            <span className="font-bold tabular-nums text-blue-600 shrink-0">
                              {(r.totalPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                        {custRentals.length > 4 && (
                          <p className="text-sm text-slate-400 text-center">+{custRentals.length - 4} đơn khác</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-sm"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        setHistoryCustomer(cust)
                        setIsHistoryDialogOpen(true)
                      }}
                    >
                      <History className="w-3.5 h-3.5 mr-1.5" />
                      Xem lịch sử
                    </Button>
                    <Button
                      className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        handleEdit(cust)
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
    </ModulePageShell>
  )
}
