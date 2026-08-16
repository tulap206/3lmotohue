"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  UserCheck,
  Pencil,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Database,
  History,
  LayoutDashboard,
  Bike,
  ClipboardList,
  Wrench,
  FileText,
  Settings,
  Sparkles,
  SlidersHorizontal,
  Layers,
} from "lucide-react"

export interface SubModulesAccess {
  dashboard: boolean
  vehicles: boolean
  customers: boolean
  orders: boolean
  maintenance: boolean
  reports: boolean
  settings: boolean
  accessHistory: boolean
}

export interface UserAccount {
  id: string
  username: string
  displayName: string
  role: "admin" | "staff"
  subModules: SubModulesAccess
  actions: {
    canDelete: boolean
    canBackup: boolean
    canManageUsers: boolean
  }
  createdAt?: string
}

interface UserAccountsModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function UserAccountsModal({ open: externalOpen, onOpenChange: externalOnOpenChange, trigger }: UserAccountsModalProps) {
  const { user, addAccessLog } = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = externalOpen !== undefined
  const isOpen = isControlled ? externalOpen : internalOpen

  const setIsOpen = (val: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(val)
    } else {
      setInternalOpen(val)
    }
  }

  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  
  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    role: "staff" as "admin" | "staff",
    password: "",
    subModules: {
      dashboard: true,
      vehicles: true,
      customers: true,
      orders: true,
      maintenance: true,
      reports: true,
      settings: false,
      accessHistory: false,
    },
    actions: {
      canDelete: false,
      canBackup: false,
      canManageUsers: false,
    },
  })
  
  const [activeTab, setActiveTab] = useState<"info" | "submodules" | "actions">("info")
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/auth/users")
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const mappedUsers: UserAccount[] = data.users.map((u: any) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayname,
            role: u.role,
            subModules: {
              dashboard: u.role === "admin" || u.can_access_rental !== false,
              vehicles: u.role === "admin" || u.can_access_sales !== false,
              customers: u.role === "admin" || u.can_access_pawnshop !== false,
              orders: u.role === "admin" || u.can_access_loan !== false,
              maintenance: u.role === "admin" || u.can_view_history_rental !== false,
              reports: u.role === "admin" || u.can_view_history_sales !== false,
              settings: u.role === "admin" || u.can_backup !== false,
              accessHistory: u.role === "admin" || u.can_view_access_history || false,
            },
            actions: {
              canDelete: u.role === "admin" || !!u.can_delete,
              canBackup: u.role === "admin" || !!u.can_backup,
              canManageUsers: u.role === "admin" || !!u.can_manage_users,
            },
            createdAt: u.created_at,
          }))
          setUsers(mappedUsers)
        }
      }
    } catch (err) {
      console.error("Error loading users in modal:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormData({
      username: "",
      displayName: "",
      role: "staff",
      password: "",
      subModules: {
        dashboard: true,
        vehicles: true,
        customers: true,
        orders: true,
        maintenance: true,
        reports: true,
        settings: false,
        accessHistory: false,
      },
      actions: {
        canDelete: false,
        canBackup: false,
        canManageUsers: false,
      },
    })
    setActiveTab("info")
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (userAccount: UserAccount) => {
    setEditingUser(userAccount)
    setFormData({
      username: userAccount.username,
      displayName: userAccount.displayName,
      role: userAccount.role,
      password: "",
      subModules: { ...userAccount.subModules },
      actions: { ...userAccount.actions },
    })
    setActiveTab("info")
    setFormError(null)
    setIsFormOpen(true)
  }

  // Quick Shortcuts for setting permissions
  const handleApplyShortcut = (type: "all" | "rental-core" | "none") => {
    if (type === "all") {
      setFormData((prev) => ({
        ...prev,
        subModules: {
          dashboard: true,
          vehicles: true,
          customers: true,
          orders: true,
          maintenance: true,
          reports: true,
          settings: true,
          accessHistory: true,
        },
      }))
    } else if (type === "rental-core") {
      setFormData((prev) => ({
        ...prev,
        subModules: {
          dashboard: true,
          vehicles: true,
          customers: true,
          orders: true,
          maintenance: true,
          reports: false,
          settings: false,
          accessHistory: false,
        },
      }))
    } else if (type === "none") {
      setFormData((prev) => ({
        ...prev,
        subModules: {
          dashboard: false,
          vehicles: false,
          customers: false,
          orders: false,
          maintenance: false,
          reports: false,
          settings: false,
          accessHistory: false,
        },
      }))
    }
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.username.trim() || !formData.displayName.trim()) {
      setFormError("Vui lòng điền đầy đủ tên đăng nhập và tên hiển thị")
      return
    }

    if (!editingUser && !formData.password) {
      setFormError("Mật khẩu không được để trống khi tạo tài khoản mới")
      return
    }

    if (formData.password && formData.password.length < 6) {
      setFormError("Mật khẩu phải chứa ít nhất 6 ký tự")
      return
    }

    try {
      setSubmitting(true)
      if (editingUser) {
        // Prevent removing admin from last admin
        if (editingUser.role === "admin" && formData.role === "staff") {
          const adminCount = users.filter((u) => u.role === "admin").length
          if (adminCount <= 1) {
            setFormError("Không thể xóa quyền admin của tài khoản quản trị duy nhất!")
            setSubmitting(false)
            return
          }
        }

        const res = await fetch(`/api/auth/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: formData.displayName,
            role: formData.role,
            password: formData.password || undefined,
            // Sub-modules mapping to DB columns
            canAccessRental: formData.role === "admin" || formData.subModules.dashboard,
            canAccessSales: formData.role === "admin" || formData.subModules.vehicles,
            canAccessPawnshop: formData.role === "admin" || formData.subModules.customers,
            canAccessLoan: formData.role === "admin" || formData.subModules.orders,
            canViewHistoryRental: formData.role === "admin" || formData.subModules.maintenance,
            canViewHistorySales: formData.role === "admin" || formData.subModules.reports,
            canBackup: formData.role === "admin" || formData.subModules.settings || formData.actions.canBackup,
            canViewAccessHistory: formData.role === "admin" || formData.subModules.accessHistory,
            // Actions
            canDelete: formData.role === "admin" || formData.actions.canDelete,
            canManageUsers: formData.role === "admin" || formData.actions.canManageUsers,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Lỗi khi cập nhật tài khoản")

        addAccessLog(
          "Chỉnh sửa",
          "Cài đặt - Phân quyền người dùng",
          `Cập nhật tài khoản và quyền phân hệ con: ${formData.username} (${formData.displayName})`
        )
      } else {
        const res = await fetch("/api/auth/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formData.username,
            displayName: formData.displayName,
            role: formData.role,
            password: formData.password,
            // Sub-modules mapping to DB columns
            canAccessRental: formData.role === "admin" || formData.subModules.dashboard,
            canAccessSales: formData.role === "admin" || formData.subModules.vehicles,
            canAccessPawnshop: formData.role === "admin" || formData.subModules.customers,
            canAccessLoan: formData.role === "admin" || formData.subModules.orders,
            canViewHistoryRental: formData.role === "admin" || formData.subModules.maintenance,
            canViewHistorySales: formData.role === "admin" || formData.subModules.reports,
            canBackup: formData.role === "admin" || formData.subModules.settings || formData.actions.canBackup,
            canViewAccessHistory: formData.role === "admin" || formData.subModules.accessHistory,
            // Actions
            canDelete: formData.role === "admin" || formData.actions.canDelete,
            canManageUsers: formData.role === "admin" || formData.actions.canManageUsers,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Lỗi khi tạo tài khoản")

        addAccessLog(
          "Thêm mới",
          "Cài đặt - Phân quyền người dùng",
          `Tạo tài khoản mới: ${formData.username} (${formData.displayName})`
        )
      }

      setIsFormOpen(false)
      await loadUsers()
    } catch (err: any) {
      console.error("Error submitting user form:", err)
      setFormError(err.message || "Đã xảy ra lỗi khi lưu thông tin")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (userToDelete: UserAccount) => {
    if (userToDelete.role === "admin") {
      const adminCount = users.filter((u) => u.role === "admin").length
      if (adminCount <= 1) {
        alert("Không thể xóa tài khoản admin duy nhất trong hệ thống!")
        return
      }
    }

    if (user && userToDelete.id === user.id) {
      alert("Bạn không thể xóa tài khoản của chính mình!")
      return
    }

    try {
      const res = await fetch(`/api/auth/users/${userToDelete.id}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Lỗi khi xóa tài khoản")

      addAccessLog(
        "Xóa",
        "Cài đặt - Người dùng",
        `Xóa tài khoản: ${userToDelete.username}`
      )
      await loadUsers()
    } catch (err: any) {
      console.error("Error deleting user:", err)
      alert(err.message || "Không thể xóa tài khoản này")
    }
  }

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // KPIs
  const totalAccounts = users.length
  const adminCount = users.filter((u) => u.role === "admin").length
  const staffCount = users.filter((u) => u.role === "staff").length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-[var(--radius-container)] gap-4">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Thống kê & Phân quyền Truy cập Phân hệ Con
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Cấu hình quyền truy cập 8 trang phân hệ con (Tổng quan, Quản lý xe, Khách thuê, Đơn thuê, Bảo trì, Báo cáo, Cài đặt, Lịch sử)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* KPI Cards Thống Kê */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-slate-50/80 border-slate-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Tổng tài khoản</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 money mt-0.5">{totalAccounts}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100/70 text-blue-600 shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/60 border-blue-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 truncate">Quản trị viên</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900 money mt-0.5">{adminCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-200/80 text-blue-800 shrink-0">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/60 border-emerald-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 truncate">Nhân viên</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-900 money mt-0.5">{staffCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-200/80 text-emerald-800 shrink-0">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-indigo-50/60 border-indigo-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 truncate">Trang phân hệ con</p>
                <p className="text-xl sm:text-2xl font-bold text-indigo-900 money mt-0.5">8 Trang</p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-200/80 text-indigo-800 shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc username..."
              className="pl-9 h-10 bg-white border-slate-200 text-sm rounded-[var(--radius-control)]"
            />
          </div>
          <Button
            onClick={handleOpenCreate}
            className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-[var(--radius-control)] font-medium text-sm gap-2 shrink-0 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            Thêm tài khoản mới
          </Button>
        </div>

        {/* Desktop & Tablet Table / Mobile List */}
        <div className="border border-slate-200 rounded-[var(--radius-container)] overflow-hidden bg-white">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Đang tải danh sách tài khoản...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {searchQuery ? "Không tìm thấy tài khoản phù hợp" : "Chưa có tài khoản nào"}
            </div>
          ) : (
            <>
              {/* Table view for desktop/tablet */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <th className="py-3 px-4 min-w-[160px]">Tài khoản</th>
                      <th className="py-3 px-4 min-w-[100px]">Vai Trò</th>
                      <th className="py-3 px-4 min-w-[340px]">Truy Cập Phân Hệ Con</th>
                      <th className="py-3 px-4 min-w-[130px]">Quyền Xóa</th>
                      <th className="py-3 px-4 text-right w-36 min-w-[130px]">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((account) => {
                      const isSelf = user?.id === account.id
                      const isAdmin = account.role === "admin"

                      return (
                        <tr key={account.id} className="hover:bg-slate-50/60 ui-transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {isAdmin ? (
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  <Shield className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  {account.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-sm whitespace-nowrap">{account.displayName}</p>
                                <p className="text-xs font-mono text-slate-500 flex items-center gap-1">
                                  @{account.username}
                                  {isSelf && (
                                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-semibold">
                                      Bạn
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                <Shield className="w-3 h-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Nhân viên
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Sparkles className="w-3.5 h-3.5" />
                                Toàn quyền 8 phân hệ con
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.dashboard ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Tổng quan
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.vehicles ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Quản lý xe
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.customers ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Khách thuê
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.orders ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Đơn thuê
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.maintenance ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Bảo trì
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.reports ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Báo cáo
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.settings ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Cài đặt
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${account.subModules.accessHistory ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 opacity-40 line-through"}`}>
                                  Lịch sử
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isAdmin || account.actions.canDelete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                <KeyRound className="w-3 h-3" />
                                Cho phép xóa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                                Khóa quyền xóa
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                onClick={() => handleOpenEdit(account)}
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-100 rounded-[var(--radius-control)] gap-1"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                                Phân quyền & Sửa
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isSelf}
                                    className="h-8 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-[var(--radius-control)] disabled:opacity-40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Xóa tài khoản người dùng?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bạn có chắc muốn xóa tài khoản <strong>@{account.username}</strong> ({account.displayName})? Hành động này không thể hoàn tác.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="h-10">Hủy</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(account)}
                                      className="h-10 bg-rose-600 hover:bg-rose-700 text-white"
                                    >
                                      Xóa tài khoản
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Card view for mobile screens */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredUsers.map((account) => {
                  const isSelf = user?.id === account.id
                  const isAdmin = account.role === "admin"

                  return (
                    <div key={account.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isAdmin ? (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <Shield className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {account.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{account.displayName}</p>
                            <p className="text-xs font-mono text-slate-500">
                              @{account.username}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-semibold">
                                  Bạn
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            Nhân viên
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 pt-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phân hệ con được truy cập:</p>
                        {isAdmin ? (
                          <p className="text-xs font-medium text-blue-700">✓ Toàn quyền 8 phân hệ con</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {account.subModules.dashboard && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Tổng quan</span>}
                            {account.subModules.vehicles && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Quản lý xe</span>}
                            {account.subModules.customers && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Khách thuê</span>}
                            {account.subModules.orders && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Đơn thuê</span>}
                            {account.subModules.maintenance && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Bảo trì</span>}
                            {account.subModules.reports && <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Báo cáo</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          onClick={() => handleOpenEdit(account)}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 text-xs text-slate-700 border-slate-200 hover:bg-slate-100 rounded-[var(--radius-control)] gap-1"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                          Phân quyền & Sửa
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf}
                              className="h-9 px-3 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-[var(--radius-control)] disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Xóa
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa tài khoản người dùng?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc muốn xóa tài khoản <strong>@{account.username}</strong> ({account.displayName})? Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="h-10">Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(account)}
                                className="h-10 bg-rose-600 hover:bg-rose-700 text-white"
                              >
                                Xóa tài khoản
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Smart Dialog Form Thêm / Sửa Tài khoản & Phân quyền */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-[var(--radius-container)] gap-4">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {editingUser ? <Pencil className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                {editingUser ? `Chỉnh sửa & Phân quyền: @${editingUser.username}` : "Tạo mới & Phân quyền tài khoản"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cấu hình quyền truy cập cho từng phân hệ con (Tổng quan, Quản lý xe, Khách thuê, Đơn thuê, Bảo trì, Báo cáo, Cài đặt, Lịch sử)
              </DialogDescription>
            </DialogHeader>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md ui-transition text-center ${
                  activeTab === "info"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                1. Thông tin tài khoản
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("submodules")}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md ui-transition text-center ${
                  activeTab === "submodules"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                2. Phân quyền Phân hệ Con (8 Trang)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("actions")}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md ui-transition text-center ${
                  activeTab === "actions"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                3. Quyền Thao tác & Hệ thống
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 pt-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {/* TAB 1: THÔNG TIN TÀI KHOẢN */}
              {activeTab === "info" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="sub-username" className="text-xs font-semibold text-slate-700">Tên Đăng Nhập</Label>
                      <Input
                        id="sub-username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="ví dụ: nyan, loca..."
                        disabled={!!editingUser}
                        className="mt-1 h-10 text-sm font-mono"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="sub-displayName" className="text-xs font-semibold text-slate-700">Tên Hiển Thị</Label>
                      <Input
                        id="sub-displayName"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        placeholder="ví dụ: Nguyễn Văn A..."
                        className="mt-1 h-10 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="sub-password" className="text-xs font-semibold text-slate-700">
                        {editingUser ? "Mật khẩu mới (Để trống nếu giữ nguyên)" : "Mật khẩu"}
                      </Label>
                      <Input
                        id="sub-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="mt-1 h-10 text-sm"
                        required={!editingUser}
                      />
                    </div>

                    <div>
                      <Label htmlFor="sub-role" className="text-xs font-semibold text-slate-700">Vai Trò Hệ Thống</Label>
                      <select
                        id="sub-role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "staff" })}
                        className="mt-1 w-full h-10 px-3 bg-white border border-slate-200 rounded-[var(--radius-control)] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="staff">Nhân viên (Staff - Phân quyền theo phân hệ con)</option>
                        <option value="admin">Quản trị viên (Admin - Toàn quyền tất cả trang)</option>
                      </select>
                    </div>
                  </div>

                  {formData.role === "admin" ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 font-medium">
                      💡 Tài khoản <strong>Admin (Quản trị viên)</strong> mặc định có toàn bộ quyền truy cập cả 8 trang phân hệ con.
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-xs text-slate-600 font-medium">Phân quyền nhanh cho Nhân viên:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyShortcut("all")}
                          className="h-7 text-[11px] bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          Bật cả 8 phân hệ con
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyShortcut("rental-core")}
                          className="h-7 text-[11px] bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        >
                          Chỉ Thuê xe & Đơn hàng
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyShortcut("none")}
                          className="h-7 text-[11px] bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          Tắt tất cả
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("submodules")}
                      className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Tiếp tục: Phân quyền Phân hệ Con →
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: PHÂN QUYỀN TRUY CẬP PHÂN HỆ CON (8 TRANG) */}
              {activeTab === "submodules" && (
                <div className="space-y-4">
                  {formData.role === "admin" && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      ℹ️ Đang chọn vai trò Admin. Tài khoản này tự động có quyền mở tất cả 8 trang bên dưới.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. TỔNG QUAN */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.dashboard}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, dashboard: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <LayoutDashboard className="w-4 h-4 text-blue-600" />
                          Trang Tổng quan (Dashboard)
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Trang chủ tổng quan chỉ số kinh doanh & biểu đồ</p>
                      </div>
                    </label>

                    {/* 2. QUẢN LÝ XE */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.vehicles}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, vehicles: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-blue-600" />
                          Trang Quản lý Xe
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Xem danh sách xe, thêm xe mới, tình trạng xe</p>
                      </div>
                    </label>

                    {/* 3. KHÁCH THUÊ */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.customers}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, customers: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-blue-600" />
                          Trang Khách thuê
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Danh sách khách hàng, giấy tờ CCCD, lịch sử thuê</p>
                      </div>
                    </label>

                    {/* 4. ĐƠN THUÊ */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.orders}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, orders: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ClipboardList className="w-4 h-4 text-blue-600" />
                          Trang Đơn thuê
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Tạo đơn thuê xe, trả xe, gia hạn, hợp đồng thuê</p>
                      </div>
                    </label>

                    {/* 5. BẢO TRÌ */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.maintenance}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, maintenance: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Wrench className="w-4 h-4 text-blue-600" />
                          Trang Bảo trì xe
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Nhật ký thay nhớt, bảo dưỡng định kỳ và sửa chữa</p>
                      </div>
                    </label>

                    {/* 6. BÁO CÁO */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.reports}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, reports: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Trang Báo cáo & Thống kê
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Báo cáo doanh thu, lợi nhuận và xuất file chi tiết</p>
                      </div>
                    </label>

                    {/* 7. CÀI ĐẶT & SAO LƯU */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.settings}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, settings: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Settings className="w-4 h-4 text-blue-600" />
                          Trang Sao lưu & Cài đặt
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Sao lưu dữ liệu đám mây và cài đặt hệ thống</p>
                      </div>
                    </label>

                    {/* 8. LỊCH SỬ TRUY CẬP */}
                    <label className="p-3 border border-slate-200 rounded-xl bg-white flex items-start gap-3 hover:bg-slate-50/70 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.subModules.accessHistory}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subModules: { ...prev.subModules, accessHistory: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <History className="w-4 h-4 text-blue-600" />
                          Trang Lịch sử truy cập
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Nhật ký hoạt động thao tác của tất cả các tài khoản</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("info")}
                      className="h-9 text-xs"
                    >
                      ← Quay lại Thông tin
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveTab("actions")}
                      className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Tiếp tục: Quyền Thao tác →
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 3: QUYỀN THAO TÁC & HỆ THỐNG */}
              {activeTab === "actions" && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.actions.canDelete}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            actions: { ...prev.actions, canDelete: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-rose-500" />
                          Quyền xóa dữ liệu (Xe, Đơn thuê, Khách)
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép nhân viên này có nút Xóa xe, Xóa đơn hàng và Xóa khách hàng</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.actions.canBackup}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            actions: { ...prev.actions, canBackup: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-emerald-600" />
                          Quyền sao lưu dữ liệu
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép tạo và tải file sao lưu dữ liệu hệ thống</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.actions.canManageUsers}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            actions: { ...prev.actions, canManageUsers: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-purple-600" />
                          Quyền quản lý người dùng & phân quyền
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép mở cửa sổ phân quyền này để thêm/sửa các nhân viên khác</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-between pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("submodules")}
                      className="h-9 text-xs"
                    >
                      ← Quay lại Phân hệ Con
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  className="h-10 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-5"
                >
                  {submitting ? "Đang lưu..." : editingUser ? "Lưu thay đổi & Phân quyền" : "Tạo tài khoản & Cấp quyền"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
