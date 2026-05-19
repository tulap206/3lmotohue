"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchCustomers } from "@/lib/supabase"
import { logger } from "@/lib/logger"
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
import { Plus, Search, Pencil, Trash2, User, Phone, MapPin, Eye, Facebook, Upload, X, ImageIcon } from "lucide-react"

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

export default function CustomersPage() {
  const { user, addAccessLog } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    facebook: "",
    address: "",
    idCard: "",
    customerPhoto: [] as string[],
    cccdFront: [] as string[],
    cccdBack: [] as string[],
    licenseFront: [] as string[],
    licenseBack: [] as string[],
  })

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true)
        const data = await fetchCustomers()
        setCustomers(data)
      } catch (error) {
        console.error("Failed to load customers:", error)
      } finally {
        setLoading(false)
      }
    }
    loadCustomers()
  }, [])

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.facebook.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone,
            facebook: formData.facebook,
            address: formData.address,
            idCard: formData.idCard,
            customerPhoto: formData.customerPhoto,
            cccdFront: formData.cccdFront,
            cccdBack: formData.cccdBack,
            licenseFront: formData.licenseFront,
            licenseBack: formData.licenseBack,
          })
          .eq('id', editingCustomer.id)
        
        if (error) throw error
        if (user) logger.editCustomer(user.username, user.displayName, formData.name)
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            facebook: formData.facebook,
            address: formData.address,
            idCard: formData.idCard,
            totalRentals: 0,
            status: "active",
            customerPhoto: formData.customerPhoto,
            cccdFront: formData.cccdFront,
            cccdBack: formData.cccdBack,
            licenseFront: formData.licenseFront,
            licenseBack: formData.licenseBack,
          }])
        
        if (error) throw error
        if (user) logger.addCustomer(user.username, user.displayName, formData.name, formData.phone)
      }
      
      const updatedCustomers = await fetchCustomers()
      setCustomers(updatedCustomers)
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving customer:", error)
    }
  }

  const resetForm = () => {
    setFormData({ 
      name: "", 
      phone: "", 
      facebook: "", 
      address: "", 
      idCard: "",
      customerPhoto: [],
      cccdFront: [],
      cccdBack: [],
      licenseFront: [],
      licenseBack: [],
    })
    setEditingCustomer(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      facebook: customer.facebook,
      address: customer.address,
      idCard: customer.idCard,
      customerPhoto: customer.customerPhoto,
      cccdFront: customer.cccdFront,
      cccdBack: customer.cccdBack,
      licenseFront: customer.licenseFront,
      licenseBack: customer.licenseBack,
    })
    setIsDialogOpen(true)
  }

  const handleView = (customer: Customer) => {
    setViewingCustomer(customer)
    setIsDetailDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const customerToDelete = customers.find((c) => c.id === id)
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      if (customerToDelete) {
        if (user) logger.deleteCustomer(user.username, user.displayName, customerToDelete.name)
      }
      
      const updatedCustomers = await fetchCustomers()
      setCustomers(updatedCustomers)
    } catch (error) {
      console.error("Error deleting customer:", error)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof formData) => {
    const files = e.target.files
    if (files) {
      const newImages: string[] = []
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          newImages.push(reader.result as string)
          if (newImages.length === files.length) {
            setFormData(prev => ({ 
              ...prev, 
              [field]: [...(prev[field] as string[]), ...newImages] 
            }))
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number, field: keyof typeof formData) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }))
  }

  const ImageUploadSection = ({ 
    label, 
    field, 
    images 
  }: { 
    label: string; 
    field: keyof typeof formData; 
    images: string[] 
  }) => (
    <div className="grid gap-2">
      <Label className="text-gray-600">{label}</Label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {images.map((img, index) => (
          <div 
            key={index} 
            className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group"
          >
            <img 
              src={img} 
              alt={`${label} ${index + 1}`} 
              className="w-full h-full object-cover cursor-pointer hover:opacity-90"
              onClick={() => setLightboxImage(img)}
            />
            <button
              type="button"
              onClick={() => removeImage(index, field)}
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
            onChange={(e) => handleImageUpload(e, field)}
          />
        </label>
      </div>
    </div>
  )

  const ImageViewSection = ({ 
    label, 
    images 
  }: { 
    label: string; 
    images: string[] 
  }) => (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-500 mb-3">{label}</p>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div 
              key={index} 
              className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxImage(img)
              }}
            >
              <img src={img} alt={`${label} ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-400 bg-gray-50 p-4 rounded-xl">
          <ImageIcon className="w-5 h-5" />
          <span className="text-sm">Chưa có ảnh</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Đang tải khách hàng...</p>
        </div>
      )}
      
      {!loading && (
      <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Khách thuê</h1>
          <p className="text-gray-500 text-sm">Quản lý thông tin khách hàng thuê xe</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { 
          if (!lightboxImage) {
            setIsDialogOpen(open); 
            if (!open) resetForm(); 
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Thêm khách hàng
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-gray-200 rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-800">
                {editingCustomer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                {editingCustomer ? "Cập nhật thông tin khách hàng" : "Nhập thông tin khách hàng mới"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
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
                  <Label htmlFor="idCard" className="text-gray-600">Số CCCD/CMND</Label>
                  <Input
                    id="idCard"
                    value={formData.idCard}
                    onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                    placeholder="VD: 079123456789"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="facebook" className="text-gray-600">Link Facebook</Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    placeholder="VD: https://facebook.com/username"
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                </div>
                <div className="space-y-2 col-span-2">
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
              </div>

              {/* Image Upload Sections */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <ImageUploadSection label="Ảnh khách hàng" field="customerPhoto" images={formData.customerPhoto} />
                <ImageUploadSection label="Ảnh CCCD mặt trước" field="cccdFront" images={formData.cccdFront} />
                <ImageUploadSection label="Ảnh CCCD mặt sau" field="cccdBack" images={formData.cccdBack} />
                <ImageUploadSection label="Ảnh GPLX mặt trước" field="licenseFront" images={formData.licenseFront} />
                <ImageUploadSection label="Ảnh GPLX mặt sau" field="licenseBack" images={formData.licenseBack} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-gray-200">
                  Hủy
                </Button>
                <Button type="submit" className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
                  {editingCustomer ? "Cập nhật" : "Thêm"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên, số điện thoại hoặc Facebook..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">Danh sách khách hàng</CardTitle>
          <CardDescription className="text-gray-500">Tổng cộng {filteredCustomers.length} khách hàng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Liên hệ</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">CCCD</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Địa chỉ</th>
                  <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Lượt thuê</th>
                  <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden">
                          {customer.customerPhoto.length > 0 ? (
                            <img src={customer.customerPhoto[0]} alt={customer.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{customer.name}</p>
                          <p className="text-xs text-gray-400">{customer.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 hidden sm:table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {customer.phone}
                        </div>
                        {customer.facebook && (
                          <a 
                            href={customer.facebook} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600"
                          >
                            <Facebook className="w-3 h-3" />
                            Facebook
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-sm text-gray-700 hidden md:table-cell">
                      {customer.idCard}
                    </td>
                    <td className="py-4 px-2 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-sm text-gray-500 max-w-xs truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {customer.address}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-sm font-medium text-blue-600">{customer.totalRentals}</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <Badge className={customer.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}>
                        {customer.status === "active" ? "Hoạt động" : "Ngừng"}
                      </Badge>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-gray-400 hover:text-emerald-500 hover:bg-emerald-50" 
                          onClick={() => handleView(customer)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-500 hover:bg-blue-50" onClick={() => handleEdit(customer)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {user?.permissions.canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(customer.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <User className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-400">Không tìm thấy khách hàng nào</p>
            </div>
          )}
        </CardContent>
      </Card>

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
              Chi tiết thông tin khách hàng
            </DialogTitle>
            <DialogDescription className="text-gray-500">Thông tin chi tiết của khách hàng trong hệ thống</DialogDescription>
          </DialogHeader>
          {viewingCustomer && (
            <div className="py-4">
              {/* Customer Avatar */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden">
                  {viewingCustomer.customerPhoto.length > 0 ? (
                    <img 
                      src={viewingCustomer.customerPhoto[0]} 
                      alt={viewingCustomer.name} 
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightboxImage(viewingCustomer.customerPhoto[0])}
                    />
                  ) : (
                    <User className="w-10 h-10 text-blue-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{viewingCustomer.name}</h3>
                  <p className="text-sm text-gray-500">{viewingCustomer.id}</p>
                  <Badge className={viewingCustomer.status === "active" ? "bg-emerald-50 text-emerald-600 mt-1" : "bg-gray-100 text-gray-500 mt-1"}>
                    {viewingCustomer.status === "active" ? "Hoạt động" : "Ngừng"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Số điện thoại</p>
                  <p className="text-sm font-medium text-gray-800">{viewingCustomer.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Số CCCD/CMND</p>
                  <p className="text-sm font-medium text-gray-800 font-mono">{viewingCustomer.idCard}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-gray-500">Link Facebook</p>
                  {viewingCustomer.facebook ? (
                    <a 
                      href={viewingCustomer.facebook} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-2"
                    >
                      <Facebook className="w-4 h-4" />
                      {viewingCustomer.facebook}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Chưa cập nhật</p>
                  )}
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-gray-500">Địa chỉ</p>
                  <p className="text-sm font-medium text-gray-800">{viewingCustomer.address}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Số lượt thuê</p>
                  <p className="text-sm font-medium text-blue-600">{viewingCustomer.totalRentals} lượt</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Ngày đăng ký</p>
                  <p className="text-sm font-medium text-gray-800">{viewingCustomer.createdAt}</p>
                </div>
              </div>

              {/* Image Sections */}
              <ImageViewSection label="Ảnh khách hàng" images={viewingCustomer.customerPhoto} />
              <ImageViewSection label="Ảnh CCCD mặt trước" images={viewingCustomer.cccdFront} />
              <ImageViewSection label="Ảnh CCCD mặt sau" images={viewingCustomer.cccdBack} />
              <ImageViewSection label="Ảnh GPLX mặt trước" images={viewingCustomer.licenseFront} />
              <ImageViewSection label="Ảnh GPLX mặt sau" images={viewingCustomer.licenseBack} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className="rounded-xl border-gray-200">
              Đóng
            </Button>
            <Button 
              onClick={() => {
                setIsDetailDialogOpen(false)
                if (viewingCustomer) handleEdit(viewingCustomer)
              }} 
              className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Chỉnh sửa
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
      </>
      )}
    </div>
  )
}
