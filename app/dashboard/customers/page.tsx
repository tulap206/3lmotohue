"use client"

import { useState, useEffect } from "react"
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
import { Plus, Search, Pencil, Trash2, User, Phone, MapPin, Eye } from "lucide-react"

interface Customer {
  id: string
  name: string
  phone: string
  facebook: string
  address: string
  idcard: string
  totalrentals: number
  status: "active" | "inactive"
  createdat: string
  customerPhoto?: string[]
  cccdFront?: string[]
  cccdBack?: string[]
  licenseFront?: string[]
  licenseBack?: string[]
}

export default function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    facebook: "",
    address: "",
    idcard: "",
    customerPhoto: [] as string[],
    cccdFront: [] as string[],
    cccdBack: [] as string[],
    licenseFront: [] as string[],
    licenseBack: [] as string[],
  })

  // Load customers from Supabase
  useEffect(() => {
    const loadData = async () => {
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
    loadData()
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
            idcard: formData.idcard,
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
            idcard: formData.idcard,
            totalrentals: 0,
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
      idcard: "",
      customerPhoto: [],
      cccdFront: [],
      cccdBack: [],
      licenseFront: [],
      licenseBack: [],
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
      customerPhoto: customer.customerPhoto || [],
      cccdFront: customer.cccdFront || [],
      cccdBack: customer.cccdBack || [],
      licenseFront: customer.licenseFront || [],
      licenseBack: customer.licenseBack || [],
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    const customerToDelete = customers.find((c) => c.id === id)
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      setCustomers(customers.filter((c) => c.id !== id))
      if (customerToDelete && user) {
        logger.deleteCustomer(user.username, user.displayName, customerToDelete.name)
      }
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Khách hàng</h1>
          <p className="text-gray-500 text-sm">Quản lý thông tin khách hàng thuê xe</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Thêm khách hàng
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-gray-200 rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-800">
                {editingCustomer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                {editingCustomer ? "Cập nhật thông tin khách hàng" : "Nhập thông tin khách hàng mới"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                
                <div className="space-y-2">
                  <Label className="text-gray-600">Ảnh khách hàng</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string
                          setFormData({ ...formData, customerPhoto: [base64] })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                  {formData.customerPhoto?.length > 0 && (
                    <img src={formData.customerPhoto[0]} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600">Ảnh CCCD mặt trước</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string
                          setFormData({ ...formData, cccdFront: [base64] })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                  {formData.cccdFront?.length > 0 && (
                    <img src={formData.cccdFront[0]} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600">Ảnh CCCD mặt sau</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string
                          setFormData({ ...formData, cccdBack: [base64] })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                  {formData.cccdBack?.length > 0 && (
                    <img src={formData.cccdBack[0]} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600">Ảnh GPLX mặt trước</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string
                          setFormData({ ...formData, licenseFront: [base64] })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                  {formData.licenseFront?.length > 0 && (
                    <img src={formData.licenseFront[0]} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600">Ảnh GPLX mặt sau</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string
                          setFormData({ ...formData, licenseBack: [base64] })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="bg-gray-50 border-gray-200 rounded-xl"
                  />
                  {formData.licenseBack?.length > 0 && (
                    <img src={formData.licenseBack[0]} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="rounded-xl">
                  Hủy
                </Button>
                <Button type="submit" className="bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
                  {editingCustomer ? "Cập nhật" : "Thêm"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm theo tên, số điện thoại hoặc Facebook..."
          className="pl-10 bg-white border-gray-200 rounded-xl"
        />
      </div>

      <Card className="border-gray-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-gray-800">Danh sách khách hàng</CardTitle>
          <CardDescription className="text-gray-500">
            Tổng cộng {filteredCustomers.length} khách hàng
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Không tìm thấy khách hàng nào
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Khách hàng</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Liên hệ</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">CCCD</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Địa chỉ</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Trạng thái</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-800">{customer.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {customer.phone}
                          </div>
                          <a href={customer.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                            Facebook
                          </a>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-700">{customer.idcard}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {customer.address}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={customer.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}>
                          {customer.status === "active" ? "Hoạt động" : "Ngừng"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setViewingCustomer(customer); setIsDetailDialogOpen(true); }} className="text-gray-600 hover:text-gray-900">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(customer)} className="text-gray-600 hover:text-gray-900">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(customer.id)} className="text-red-600 hover:text-red-900">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="bg-white border-gray-200 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Chi tiết khách hàng</DialogTitle>
            <DialogDescription className="text-gray-500">Thông tin chi tiết của khách hàng trong hệ thống</DialogDescription>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-4">
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
                  <a href={viewingCustomer.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                    Xem profile
                  </a>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Địa chỉ</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Trạng thái</p>
                  <Badge className={viewingCustomer.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}>
                    {viewingCustomer.status === "active" ? "Hoạt động" : "Ngừng"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Số lần thuê</p>
                  <p className="font-medium text-gray-800">{viewingCustomer.totalrentals}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
