"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { showError, showWarning } from "@/lib/toast-utils"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { logger } from "@/lib/logger"
import { supabase, fetchCustomers, fetchRentals } from "@/lib/supabase"
import { ModulePageShell, ModuleSubpageHeader, ModuleSectionCard, ModuleResponsiveTable, ModuleMobileCard, ModulePagination, ModuleKpiGrid, ModuleEmptyState } from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalCustomerStatusLabel,
  rentalCustomerStatusBadgeClass,
  getRentalOrderStatusLabel,
  rentalOrderStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { formatDisplayDate } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormSection,
  EntityFormFooter,
  EntityFormField,
  entityFormInputClass,
} from "@/components/dashboard/entity-form-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Plus, Search, Trash2, User, Phone, MapPin, Eye, Upload, Pencil, Clock, Calendar, History } from "lucide-react"

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
  preview,
  onPickStart,
}: {
  label: string
  onImageSelected: (base64: string) => void
  preview?: string
  onPickStart?: () => void
}) => {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-label">{label}</p>
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-[var(--radius-control)] ui-transition",
          preview
            ? "border border-slate-200"
            : "border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2">
            <Upload className="h-5 w-5 text-slate-400" />
            <span className="text-meta text-center">Thêm ảnh</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onClick={() => onPickStart?.()}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            const reader = new FileReader()
            reader.onload = (event) => {
              onImageSelected(event.target?.result as string)
            }
            reader.readAsDataURL(file)
          }}
        />
      </div>
    </div>
  )
}

const customerActionBtnClass =
  "h-9 w-9 p-0 border-slate-200 rounded-[var(--radius-control)] hover:bg-slate-50 text-slate-500"
const customerStatusBadgeClass =
  "inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold border"

/** Hiển thị số CCCD — bỏ tiền tố placeholder `CCCD_` nếu có. */
function formatCustomerIdCard(idcard?: string | null): string {
  const raw = (idcard || "").trim()
  if (!raw) return "—"
  return raw.replace(/^CCCD_/i, "")
}

function CustomerStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "emerald"
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 min-w-0 flex flex-col justify-center">
      <p className="text-label text-slate-500">{label}</p>
      <p className={cn(
        "text-body font-semibold tabular-nums mt-0.5 leading-snug break-words",
        tone === "emerald" ? "text-emerald-700 money" : "text-slate-900"
      )}>{value}</p>
    </div>
  )
}

function CustomerAvatar({ src, name }: { src?: string; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="h-11 w-11 shrink-0 rounded-[var(--radius-badge)] object-cover border border-slate-200"
    />
  ) : (
    <div className="h-11 w-11 shrink-0 rounded-[var(--radius-badge)] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-body font-semibold">
      {name.charAt(0).toUpperCase()}
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
  const pickingFileRef = useRef(false)
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

  const keepDialogOpenWhilePickingFile = (event: { preventDefault: () => void }) => {
    if (pickingFileRef.current) event.preventDefault()
  }

  const markPickingFile = () => {
    pickingFileRef.current = true
    window.setTimeout(() => {
      pickingFileRef.current = false
    }, 1500)
  }

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
        if (user) {
          logger.editCustomerWithDiff(user.username, user.displayName, editingCustomer, {
            ...editingCustomer,
            ...formData,
            ...updateData,
          })
        }
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
      idcard: formatCustomerIdCard(customer.idcard) === "—" ? "" : formatCustomerIdCard(customer.idcard),
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
              className="bg-rose-600 !text-white hover:bg-rose-700 hover:!text-white"
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
              className="bg-blue-600 !text-white hover:bg-blue-700 hover:!text-white rounded-[var(--radius-control)] h-11 font-semibold text-body ui-transition [&_svg]:!text-white"
              onClick={() => { setEditingCustomer(null); resetForm(); setIsDialogOpen(true) }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm khách hàng
            </Button>
          </div>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <EntityFormDialogContent
              accent="blue"
              maxWidth="2xl"
              onPointerDownOutside={keepDialogOpenWhilePickingFile}
              onFocusOutside={keepDialogOpenWhilePickingFile}
              onInteractOutside={keepDialogOpenWhilePickingFile}
            >
              <EntityFormHeader
                title={editingCustomer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
                description={editingCustomer ? "Cập nhật liên hệ, CCCD và ảnh giấy tờ" : "Nhập liên hệ, CCCD và ảnh giấy tờ"}
              />
              <form onSubmit={handleSubmit}>
                <EntityFormBody>
                  <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <CustomerAvatar src={formData.customerphoto?.[0]} name={formData.name.trim() || "K"} />
                    <div className="min-w-0">
                      <p className="text-title truncate">{formData.name.trim() || "Khách chưa đặt tên"}</p>
                      <p className="text-meta">
                        {formData.phone.trim() || "Chưa số điện thoại"}
                        {formData.address.trim() ? ` · ${formData.address.trim()}` : ""}
                      </p>
                    </div>
                  </div>

                  <EntityFormSection title="Thông tin khách" description="Liên hệ và định danh">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <EntityFormField label="Họ và tên" required>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nguyễn Văn A"
                          autoComplete="name"
                          className={entityFormInputClass}
                          required
                        />
                      </EntityFormField>
                      <EntityFormField label="Số điện thoại" required>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="0901234567"
                          autoComplete="tel"
                          className={cn(entityFormInputClass, "tabular-nums")}
                          required
                        />
                      </EntityFormField>
                      <EntityFormField label="Số CCCD / CMND" required>
                        <Input
                          id="idcard"
                          inputMode="numeric"
                          value={formData.idcard}
                          onChange={(e) => setFormData({ ...formData, idcard: e.target.value.replace(/^CCCD_/i, "") })}
                          placeholder="079123456789"
                          className={cn(entityFormInputClass, "font-mono")}
                          required
                        />
                      </EntityFormField>
                      <EntityFormField label="Địa chỉ" required>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Tây Lộc, TP. Huế"
                          autoComplete="street-address"
                          className={entityFormInputClass}
                          required
                        />
                      </EntityFormField>
                    </div>
                  </EntityFormSection>

                  <EntityFormSection title="Ảnh tài liệu" description="Tùy chọn — CCCD, GPLX, ảnh khách">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <ImageUploadButton
                        label="Ảnh khách"
                        preview={formData.customerphoto?.[0]}
                        onPickStart={markPickingFile}
                        onImageSelected={(base64) => setFormData({ ...formData, customerphoto: base64 ? [base64] : [] })}
                      />
                      <ImageUploadButton
                        label="CCCD mặt trước"
                        preview={formData.cccdfront?.[0]}
                        onPickStart={markPickingFile}
                        onImageSelected={(base64) => setFormData({ ...formData, cccdfront: base64 ? [base64] : [] })}
                      />
                      <ImageUploadButton
                        label="CCCD mặt sau"
                        preview={formData.cccdback?.[0]}
                        onPickStart={markPickingFile}
                        onImageSelected={(base64) => setFormData({ ...formData, cccdback: base64 ? [base64] : [] })}
                      />
                      <ImageUploadButton
                        label="GPLX mặt trước"
                        preview={formData.licensefront?.[0]}
                        onPickStart={markPickingFile}
                        onImageSelected={(base64) => setFormData({ ...formData, licensefront: base64 ? [base64] : [] })}
                      />
                      <ImageUploadButton
                        label="GPLX mặt sau"
                        preview={formData.licenseback?.[0]}
                        onPickStart={markPickingFile}
                        onImageSelected={(base64) => setFormData({ ...formData, licenseback: base64 ? [base64] : [] })}
                      />
                    </div>
                  </EntityFormSection>
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
        <ModuleKpiGrid columns={4}>
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
            onClick={() => setFilterStatus("all")}
            selected={filterStatus === "all"}
          />
          <RentalKpiCard
            variant="hero"
            label="Chờ giao xe"
            value={customerStats.pending}
            sublabel="Đơn chờ xử lý"
            valueClassName="text-amber-700"
            onClick={() => setFilterStatus("pending")}
            selected={filterStatus === "pending"}
          />
          <RentalKpiCard
            variant="hero"
            label="Đang thuê"
            value={customerStats.renting}
            sublabel="Khách đang giữ xe"
            valueClassName="text-blue-700"
            onClick={() => setFilterStatus("renting")}
            selected={filterStatus === "renting"}
          />
          <RentalKpiCard
            variant="hero"
            label="Ngừng hoạt động"
            value={customerStats.inactive}
            sublabel="Không giao dịch"
            valueClassName="text-slate-600"
            onClick={() => setFilterStatus("inactive")}
            selected={filterStatus === "inactive"}
          />
        </ModuleKpiGrid>

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
              <SelectTrigger className="w-full lg:w-36 h-10 rounded-[var(--radius-control)] border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="pending">Chờ giao xe</SelectItem>
                <SelectItem value="renting">Đang thuê xe</SelectItem>
                <SelectItem value="inactive">Ngừng hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <ModuleEmptyState
              title="Không tìm thấy khách hàng nào"
              description="Thử đổi từ khóa hoặc bộ lọc, hoặc thêm khách hàng mới."
            />
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
                    <tbody className="divide-y divide-slate-50 text-body text-slate-700">
                      {paginatedCustomers.map((customer, index) => (
                        <tr key={customer.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-medium">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <CustomerAvatar src={customer.customerphoto?.[0]} name={customer.name} />
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  className="font-semibold text-slate-800 text-body hover:text-blue-700 hover:underline text-left truncate block"
                                  onClick={() => openDetailDialog(customer)}
                                >
                                  {customer.name}
                                </button>
                                <p className="text-meta font-medium">
                                  Đã thuê: <span className="font-semibold text-slate-600">{customer.totalrentals} lượt</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-0.5 text-sm">
                              <span className="font-medium text-slate-700 inline-flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center text-sm font-semibold font-mono text-slate-600">
                            {formatCustomerIdCard(customer.idcard)}
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-500 max-w-[200px] truncate">
                            {customer.address || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn(customerStatusBadgeClass, rentalCustomerStatusBadgeClass(customer.status))}>
                              {getRentalCustomerStatusLabel(customer.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={customerActionBtnClass}
                                onClick={() => { setHistoryCustomer(customer); setIsHistoryDialogOpen(true) }}
                                title="Lịch sử thuê"
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={customerActionBtnClass}
                                onClick={() => openDetailDialog(customer)}
                                title="Chi tiết"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className={customerActionBtnClass}
                                onClick={() => handleEdit(customer)}
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="h-9 w-9 p-0 border-rose-200 rounded-[var(--radius-control)] hover:bg-rose-50 text-rose-600"
                                onClick={() => handleDelete(customer.id)}
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
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
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <CustomerAvatar src={customer.customerphoto?.[0]} name={customer.name} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="font-semibold text-slate-800 text-body hover:text-blue-700 hover:underline text-left truncate"
                            onClick={() => openDetailDialog(customer)}
                          >
                            {customer.name}
                          </button>
                          <p className="text-meta">Đã thuê: <span className="font-semibold text-slate-600">{customer.totalrentals} lượt</span></p>
                        </div>
                      </div>
                      <span className={cn(customerStatusBadgeClass, "shrink-0", rentalCustomerStatusBadgeClass(customer.status))}>
                        {getRentalCustomerStatusLabel(customer.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {customer.phone}
                      </div>
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {customer.address}
                      </div>
                    </div>
                    <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-slate-100/50 items-center">
                      <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => { setHistoryCustomer(customer); setIsHistoryDialogOpen(true) }} title="Lịch sử thuê">
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => openDetailDialog(customer)} title="Chi tiết">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="h-9 w-9 p-0 text-slate-500" onClick={() => handleEdit(customer)} title="Chỉnh sửa">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {user?.permissions.canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-9 w-9 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa khách hàng ${customer.name}?`)) {
                              handleDelete(customer.id)
                            }
                          }}
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <EntityFormDialogContent accent="blue" maxWidth="xl">
          <EntityFormHeader
            title={historyCustomer ? `Lịch sử thuê` : "Lịch sử thuê"}
            description={
              historyCustomer
                ? `${historyCustomer.name} · ${historyCustomer.phone || "Chưa SĐT"}`
                : "Tất cả đơn thuê của khách"
            }
          />
          {historyCustomer && (() => {
            const cRentals = rentals.filter(r => r.customerId === historyCustomer.id)
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
            const completedCount = cRentals.filter(r => r.status === "completed").length
            const totalRev = cRentals.filter(r => r.status === "completed").reduce((s: number, r: any) => s + (r.revenue || r.totalPrice || 0), 0)
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <CustomerStat label="Tổng đơn" value={`${cRentals.length}`} />
                  <CustomerStat label="Đã hoàn thành" value={`${completedCount}`} tone="emerald" />
                  <div className="col-span-2 sm:col-span-1">
                    <CustomerStat label="Tổng doanh thu" value={`${totalRev.toLocaleString("vi-VN")} đ`} tone="emerald" />
                  </div>
                </div>
                {cRentals.length === 0 ? (
                  <ModuleEmptyState
                    title="Chưa có đơn thuê"
                    description="Khách này chưa có đơn thuê xe trong hệ thống."
                  />
                ) : (
                  <ol className="space-y-2">
                    {cRentals.map(r => (
                      <li
                        key={r.id}
                        className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-body font-semibold text-slate-800 truncate">{r.vehicleName}</p>
                            <p className="text-meta font-mono">{r.licensePlate}</p>
                          </div>
                          <span className={cn(customerStatusBadgeClass, rentalOrderStatusBadgeClass(r.status), "shrink-0")}>
                            {getRentalOrderStatusLabel(r.status)}
                          </span>
                        </div>
                        <p className="text-meta flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          {formatDisplayDate(r.startDate)} → {formatDisplayDate(r.endDate)} · {r.totalDays} ngày
                        </p>
                        <div className="flex items-end justify-between gap-2">
                          <span className="text-meta">
                            {(r.pricePerDay || 0).toLocaleString("vi-VN")} đ/ngày · Cọc {(r.deposit || 0).toLocaleString("vi-VN")} đ
                          </span>
                          <span className={cn(
                            "text-body font-semibold money tabular-nums shrink-0",
                            r.status === "completed" ? "text-emerald-700" : "text-slate-900"
                          )}>
                            {r.status === "completed"
                              ? `+${(r.revenue || r.totalPrice || 0).toLocaleString("vi-VN")} đ`
                              : `${(r.totalPrice || 0).toLocaleString("vi-VN")} đ`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex justify-end border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                  <Button
                    variant="outline"
                    onClick={() => setIsHistoryDialogOpen(false)}
                    className="h-11 w-full sm:w-auto rounded-[var(--radius-control)] border-slate-200"
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        setIsDetailDialogOpen(open)
        if (!open) setViewingCustomer(null)
      }}>
        <EntityFormDialogContent accent="blue" maxWidth="xl">
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
                <div className="flex items-start gap-3 sm:gap-4 mb-5">
                  <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-slate-200 bg-slate-50">
                    {cust.customerphoto?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cust.customerphoto[0]} alt={cust.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-7 w-7 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <h2 className="text-title text-pretty">{cust.name}</h2>
                    <p className="text-meta mt-0.5 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {cust.phone || "Chưa có SĐT"}
                    </p>
                    {cust.address && (
                      <p className="text-meta mt-0.5 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span>{cust.address}</span>
                      </p>
                    )}
                    <div className="mt-2">
                      <span className={cn(customerStatusBadgeClass, rentalCustomerStatusBadgeClass(cust.status))}>
                        {getRentalCustomerStatusLabel(cust.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <CustomerStat label="Số CCCD / CMND" value={formatCustomerIdCard(cust.idcard)} />
                    <CustomerStat label="Tổng lần thuê" value={`${cust.totalrentals || custRentals.length} lượt`} />
                  </div>

                  {docImages.length > 0 && (
                    <div>
                      <p className="text-label text-slate-500 mb-2">Ảnh tài liệu</p>
                      <div className="grid grid-cols-2 gap-2">
                        {docImages.map((img) => (
                          <div key={img.label} className="min-w-0">
                            <p className="text-meta mb-1">{img.label}</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.src}
                              alt={img.label}
                              className="w-full rounded-[var(--radius-control)] border border-slate-200 object-cover aspect-video"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {custRentals.length > 0 && (
                    <div>
                      <p className="text-label text-slate-500 mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-2">
                        {custRentals.slice(0, 4).map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-body font-semibold text-slate-800 truncate">{r.vehicleName}</p>
                              <p className="text-meta font-mono">{r.licensePlate}</p>
                            </div>
                            <p className="text-body font-semibold money tabular-nums text-slate-900 shrink-0">
                              {(r.totalPrice || 0).toLocaleString("vi-VN")} đ
                            </p>
                          </div>
                        ))}
                        {custRentals.length > 4 && (
                          <p className="text-meta text-center">+{custRentals.length - 4} đơn khác</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 text-body border-slate-200"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        setHistoryCustomer(cust)
                        setIsHistoryDialogOpen(true)
                      }}
                    >
                      <History className="w-4 h-4 mr-1.5" />
                      Xem lịch sử
                    </Button>
                    <Button
                      type="button"
                      className="h-11 flex-1 text-body bg-blue-600 hover:bg-blue-700 !text-white hover:!text-white [&_svg]:!text-white"
                      onClick={() => {
                        setIsDetailDialogOpen(false)
                        handleEdit(cust)
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
    </ModulePageShell>
  )
}
