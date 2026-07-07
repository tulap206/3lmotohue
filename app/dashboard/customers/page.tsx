"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchCustomers, fetchRentals } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard } from "@/components/dashboard/module-shell"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Trash2, User, Phone, MapPin, Eye, Upload, Settings, Clock, Calendar } from "lucide-react"

interface Customer {
  id: string
  name: string
  phone: string
  facebook: string
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
      <Label className="text-gray-600">{label}</Label>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-red-400 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
      >
        <div className="bg-blue-50 p-3 rounded-lg">
          <Upload className="w-6 h-6 text-blue-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Thêm ảnh</p>
          <p className="text-xs text-gray-500">JPG, PNG, GIF</p>
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
          <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
        </div>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [rentals, setRentals] = useState<any[]>([])
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    facebook: "",
    address: "",
    idcard: "",
    customerphoto: [] as string[],
    cccdfront: [] as string[],
    cccdback: [] as string[],
    licensefront: [] as string[],
    licenseback: [] as string[],
  })

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)

      // Check if user is demo account (quy79)
      const isDemoAccount = user?.username === "quy79"

      if (isDemoAccount) {
        setCustomers([])
        setLoading(false)
        return
      }

      const [customersData, rentalsData] = await Promise.all([
        fetchCustomers(),
        fetchRentals()
      ])
      setRentals(rentalsData || [])

      const updated = customersData.map((customer) => {
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
        
        return {
          ...customer,
          status: statusLabel as any
        }
      })

      const sorted = updated.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
        return dateB - dateA
      })
      setCustomers(sorted)
    } catch (error) {
      console.error("Failed to load customers:", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(true)

    // Subscribe to real-time changes
    const channel = supabase
      .channel("customers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        loadData(false)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, () => {
        loadData(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.facebook.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const customerStats = {
    total: customers.length,
    renting: customers.filter((c) => c.status === "renting").length,
    pending: customers.filter((c) => c.status === "pending").length,
    inactive: customers.filter((c) => c.status === "inactive").length,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.name || formData.name.trim() === '') {
      alert('Vui lòng nhập tên khách hàng')
      return
    }
    if (!formData.phone || formData.phone.trim() === '') {
      alert('Vui lòng nhập số điện thoại')
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
          console.log(`⏭️ Skipping ${fileName} - empty base64`)
          return null
        }
        
        // Validate it's actually base64
        if (!base64.startsWith('data:')) {
          console.log(`⏭️ Skipping ${fileName} - not base64 (is URL)`)
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
      console.log("📸 Upload results:", uploadResults)
      
      uploadResults.forEach(result => {
        if (result && result.url) {
          console.log(`✅ Uploaded ${result.key}: ${result.url}`)
          uploadedImages[result.key as keyof typeof uploadedImages] = [result.url]
        } else if (result) {
          console.warn(`⚠️ No URL for ${result.key}`)
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
          facebook: formData.facebook,
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
          alert(`⚠️ Khách hàng với số điện thoại "${formData.phone}" đã tồn tại!\n\nTên: ${existingCustomer.name}\nĐịa chỉ: ${existingCustomer.address}`)
          return
        }
        
        const { error } = await supabase
          .from('customers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            facebook: formData.facebook,
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
        
        return {
          ...customer,
          status: statusLabel as any
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
      alert('Lỗi: ' + (error as any).message)
    }
  }

  const resetForm = () => {
    setFormData({ 
      name: "", 
      phone: "", 
      facebook: "", 
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

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      facebook: customer.facebook,
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
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <ModulePageShell module="rental">
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-blue-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base mt-2">
              Bạn có chắc chắn muốn xoá khách hàng <span className="font-semibold text-gray-800">"{customerToDelete?.name}"</span> không?
              <p className="text-sm text-blue-600 mt-2">⚠️ Hành động này không thể hoàn tác!</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setCustomerToDelete(null)
              }}
              className="border-gray-300"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-blue-600 text-white hover:bg-blue-700"
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
          <Button
            className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 rounded-xl"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Thêm khách hàng
          </Button>
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
                  <Label htmlFor="name" className="text-gray-600">Họ và tên</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Nguyễn Văn A"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-600">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="VD: 0901234567"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idcard" className="text-gray-600">Số CCCD/CMND</Label>
                  <Input
                    id="idcard"
                    value={formData.idcard}
                    onChange={(e) => setFormData({ ...formData, idcard: e.target.value })}
                    placeholder="VD: 079123456789"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="text-gray-600">Link Facebook</Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    placeholder="VD: https://facebook.com/username"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-gray-600">Địa chỉ</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
                
                {/* Image Upload Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <p className="font-medium text-gray-700">Thêm ảnh (tùy chọn)</p>
                  
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RentalKpiCard label="Tổng khách hàng" value={customerStats.total} sublabel={`${filteredCustomers.length} đang lọc`} />
          <RentalKpiCard label="Đang thuê" value={customerStats.renting} sublabel="Khách đang giữ xe" valueClassName="text-blue-700" />
          <RentalKpiCard label="Chờ giao xe" value={customerStats.pending} sublabel="Đơn chờ xử lý" valueClassName="text-amber-700" />
          <RentalKpiCard label="Ngừng hoạt động" value={customerStats.inactive} sublabel="Không giao dịch" valueClassName="text-slate-600" />
        </div>

      <ModuleSectionCard
        title="Danh sách khách hàng"
        description={`Quản lý ${filteredCustomers.length} khách hàng`}
        filters={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tên, SĐT, CCCD..."
                className={cn(rentalFilterInputClass, "pl-9")}
              />
            </div>
            <Button
              onClick={() => { setEditingCustomer(null); resetForm(); setIsDialogOpen(true) }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 rounded-xl text-sm font-semibold shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Thêm khách
            </Button>
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
                      <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                        <th className={rentalTableHeadClass}>Khách hàng</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Liên hệ</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>CCCD</th>
                        <th className={rentalTableHeadClass}>Địa chỉ</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Trạng thái</th>
                        <th className={cn(rentalTableHeadClass, "text-right")}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {paginatedCustomers.map((customer, index) => (
                        <tr key={customer.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-medium">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {customer.customerphoto && customer.customerphoto.length > 0 ? (
                                <img src={customer.customerphoto[0]} alt={customer.name} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                  <User className="w-4 h-4 text-slate-500" />
                                </div>
                              )}
                              <span className="font-semibold text-slate-800 capitalize">{customer.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="space-y-1 inline-flex flex-col items-center">
                              <div className="flex items-center gap-2 text-sm text-slate-700 font-semibold font-mono">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {customer.phone}
                              </div>
                              {customer.facebook && (
                                <a href={customer.facebook} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold">
                                  Facebook
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold font-mono text-sm text-slate-700">{customer.idcard || <span className="text-slate-400 font-normal">—</span>}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-700">
                            {customer.address ? (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span className="truncate max-w-[200px] font-medium">{customer.address}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${rentalCustomerStatusBadgeClass(customer.status)}`}>
                              {getRentalCustomerStatusLabel(customer.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                                onClick={() => { setHistoryCustomer(customer); setIsHistoryDialogOpen(true) }}
                                title="Lịch sử thuê"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                                onClick={() => { setViewingCustomer(customer); setIsDetailDialogOpen(true) }}
                                title="Chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                                onClick={() => handleEdit(customer)}
                                title="Chỉnh sửa"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </Button>
                              {user?.permissions.canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50"
                                  onClick={() => handleDelete(customer.id)}
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
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
                      <div className="flex items-center gap-2 min-w-0">
                        {customer.customerphoto && customer.customerphoto.length > 0 ? (
                          <img src={customer.customerphoto[0]} alt={customer.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{customer.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{customer.phone}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${rentalCustomerStatusBadgeClass(customer.status)}`}>
                        {getRentalCustomerStatusLabel(customer.status)}
                      </span>
                    </div>
                    {customer.address && (
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {customer.address}
                      </p>
                    )}
                  </ModuleMobileCard>
                ))}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500 mr-2">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-slate-200 rounded-xl"
                  >
                    Trước
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-slate-200 rounded-xl"
                  >
                    Tiếp
                  </Button>
                </div>
              )}
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
                    <p className="text-xs text-slate-500">Tổng đơn</p>
                    <p className="text-lg font-extrabold text-slate-800">{cRentals.length}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-emerald-600">Đã hoàn thành</p>
                    <p className="text-lg font-extrabold text-emerald-700">{cRentals.filter(r => r.status === "completed").length}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-red-500">Tổng doanh thu</p>
                    <p className="text-sm font-extrabold text-blue-700 tabular-nums">{totalRev.toLocaleString("vi-VN")}đ</p>
                  </div>
                </div>
                {cRentals.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">Khách hàng chưa có đơn thuê nào</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cRentals.map(r => {
                      const statusColor = r.status === "completed" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : r.status === "cancelled" ? "text-slate-500 bg-slate-50 border-slate-100" : r.status === "active" ? "text-blue-700 bg-blue-50 border-red-100" : "text-amber-700 bg-amber-50 border-amber-100"
                      const statusLabel = { pending: "Chờ giao", active: "Đang thuê", completed: "Hoàn thành", cancelled: "Đã hủy" }[r.status as string] || r.status
                      return (
                        <div key={r.id} className="py-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{r.vehicleName}</p>
                              <p className="text-xs text-slate-400 font-mono">{r.licensePlate}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>{statusLabel}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{r.startDate} → {r.endDate} · {r.totalDays} ngày</span>
                          </div>
                          <div className="flex justify-between text-xs">
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

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <EntityFormDialogContent accent="blue" maxWidth="2xl">
          <EntityFormHeader
            title="Chi tiết khách hàng"
            description="Thông tin chi tiết của khách hàng trong hệ thống"
          />
          {viewingCustomer && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Tên</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Số điện thoại</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CCCD/CMND</p>
                  <p className="font-medium text-gray-800 font-mono">{viewingCustomer.idcard}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Facebook</p>
                  <a href={viewingCustomer.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                    Xem profile
                  </a>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Địa chỉ</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Trạng thái</p>
                  <Badge className={`rounded-full border ${rentalCustomerStatusBadgeClass(viewingCustomer.status)}`}>
                    {getRentalCustomerStatusLabel(viewingCustomer.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Số lần thuê</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.totalrentals}</p>
                </div>
              </div>

              {/* Images Section */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <p className="font-medium text-gray-700">Ảnh tài liệu</p>
                
                {viewingCustomer.customerphoto && viewingCustomer.customerphoto.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Ảnh khách hàng</p>
                    <img src={viewingCustomer.customerphoto[0]} alt="Customer" className="w-full max-w-xs rounded-lg border border-gray-200" />
                  </div>
                )}
                
                {viewingCustomer.cccdfront && viewingCustomer.cccdfront.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">CCCD mặt trước</p>
                    <img src={viewingCustomer.cccdfront[0]} alt="CCCD Front" className="w-full max-w-xs rounded-lg border border-gray-200" />
                  </div>
                )}
                
                {viewingCustomer.cccdback && viewingCustomer.cccdback.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">CCCD mặt sau</p>
                    <img src={viewingCustomer.cccdback[0]} alt="CCCD Back" className="w-full max-w-xs rounded-lg border border-gray-200" />
                  </div>
                )}
                
                {viewingCustomer.licensefront && viewingCustomer.licensefront.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">GPLX mặt trước</p>
                    <img src={viewingCustomer.licensefront[0]} alt="License Front" className="w-full max-w-xs rounded-lg border border-gray-200" />
                  </div>
                )}
                
                {viewingCustomer.licenseback && viewingCustomer.licenseback.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">GPLX mặt sau</p>
                    <img src={viewingCustomer.licenseback[0]} alt="License Back" className="w-full max-w-xs rounded-lg border border-gray-200" />
                  </div>
                )}
              </div>
            </div>
          )}
        </EntityFormDialogContent>
      </Dialog>
    </ModulePageShell>
  )
}
