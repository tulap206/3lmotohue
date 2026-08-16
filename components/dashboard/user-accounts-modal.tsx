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
  Car,
  Gem,
  Coins,
  Tag,
  Check,
  SlidersHorizontal,
  Sparkles,
  Layers,
} from "lucide-react"

export interface ModulePermission {
  access: boolean
  canDelete: boolean
  canBackup: boolean
  canViewHistory: boolean
}

export interface UserAccount {
  id: string
  username: string
  displayName: string
  role: "admin" | "staff"
  modules: {
    rental: ModulePermission
    pawnshop: ModulePermission
    loan: ModulePermission
    sales: ModulePermission
  }
  globalPermissions: {
    canDelete: boolean
    canBackup: boolean
    canViewAccessHistory: boolean
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
  
  // Detailed modular form data
  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    role: "staff" as "admin" | "staff",
    password: "",
    modules: {
      rental: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
      pawnshop: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
      loan: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
      sales: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
    },
    globalPermissions: {
      canDelete: false,
      canBackup: false,
      canViewAccessHistory: true,
      canManageUsers: false,
    },
  })
  
  const [activeTab, setActiveTab] = useState<"info" | "modules" | "global">("info")
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
            modules: {
              rental: {
                access: u.role === "admin" || u.can_access_rental !== false,
                canDelete: u.role === "admin" || !!u.can_delete_rental,
                canBackup: u.role === "admin" || !!u.can_backup_rental,
                canViewHistory: u.role === "admin" || u.can_view_history_rental !== false,
              },
              pawnshop: {
                access: u.role === "admin" || u.can_access_pawnshop !== false,
                canDelete: u.role === "admin" || !!u.can_delete_pawnshop,
                canBackup: u.role === "admin" || !!u.can_backup_pawnshop,
                canViewHistory: u.role === "admin" || u.can_view_history_pawnshop !== false,
              },
              loan: {
                access: u.role === "admin" || u.can_access_loan !== false,
                canDelete: u.role === "admin" || !!u.can_delete_loan,
                canBackup: u.role === "admin" || !!u.can_backup_loan,
                canViewHistory: u.role === "admin" || u.can_view_history_loan !== false,
              },
              sales: {
                access: u.role === "admin" || u.can_access_sales !== false,
                canDelete: u.role === "admin" || !!u.can_delete_sales,
                canBackup: u.role === "admin" || !!u.can_backup_sales,
                canViewHistory: u.role === "admin" || u.can_view_history_sales !== false,
              },
            },
            globalPermissions: {
              canDelete: u.role === "admin" || !!u.can_delete,
              canBackup: u.role === "admin" || !!u.can_backup,
              canViewAccessHistory: u.role === "admin" || u.can_view_access_history !== false,
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
      modules: {
        rental: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
        pawnshop: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
        loan: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
        sales: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
      },
      globalPermissions: {
        canDelete: false,
        canBackup: false,
        canViewAccessHistory: true,
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
      modules: {
        rental: { ...userAccount.modules.rental },
        pawnshop: { ...userAccount.modules.pawnshop },
        loan: { ...userAccount.modules.loan },
        sales: { ...userAccount.modules.sales },
      },
      globalPermissions: { ...userAccount.globalPermissions },
    })
    setActiveTab("info")
    setFormError(null)
    setIsFormOpen(true)
  }

  // Quick Shortcuts for setting permissions
  const handleApplyShortcut = (type: "all" | "read-only" | "none") => {
    if (type === "all") {
      setFormData((prev) => ({
        ...prev,
        modules: {
          rental: { access: true, canDelete: true, canBackup: true, canViewHistory: true },
          pawnshop: { access: true, canDelete: true, canBackup: true, canViewHistory: true },
          loan: { access: true, canDelete: true, canBackup: true, canViewHistory: true },
          sales: { access: true, canDelete: true, canBackup: true, canViewHistory: true },
        },
        globalPermissions: {
          canDelete: true,
          canBackup: true,
          canViewAccessHistory: true,
          canManageUsers: false,
        },
      }))
    } else if (type === "read-only") {
      setFormData((prev) => ({
        ...prev,
        modules: {
          rental: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
          pawnshop: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
          loan: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
          sales: { access: true, canDelete: false, canBackup: false, canViewHistory: true },
        },
        globalPermissions: {
          canDelete: false,
          canBackup: false,
          canViewAccessHistory: true,
          canManageUsers: false,
        },
      }))
    } else if (type === "none") {
      setFormData((prev) => ({
        ...prev,
        modules: {
          rental: { access: false, canDelete: false, canBackup: false, canViewHistory: false },
          pawnshop: { access: false, canDelete: false, canBackup: false, canViewHistory: false },
          loan: { access: false, canDelete: false, canBackup: false, canViewHistory: false },
          sales: { access: false, canDelete: false, canBackup: false, canViewHistory: false },
        },
        globalPermissions: {
          canDelete: false,
          canBackup: false,
          canViewAccessHistory: false,
          canManageUsers: false,
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
            // Modular permissions
            canAccessRental: formData.role === "admin" || formData.modules.rental.access,
            canAccessPawnshop: formData.role === "admin" || formData.modules.pawnshop.access,
            canAccessLoan: formData.role === "admin" || formData.modules.loan.access,
            canAccessSales: formData.role === "admin" || formData.modules.sales.access,
            canDeleteRental: formData.role === "admin" || formData.modules.rental.canDelete,
            canDeletePawnshop: formData.role === "admin" || formData.modules.pawnshop.canDelete,
            canDeleteLoan: formData.role === "admin" || formData.modules.loan.canDelete,
            canDeleteSales: formData.role === "admin" || formData.modules.sales.canDelete,
            canBackupRental: formData.role === "admin" || formData.modules.rental.canBackup,
            canBackupPawnshop: formData.role === "admin" || formData.modules.pawnshop.canBackup,
            canBackupLoan: formData.role === "admin" || formData.modules.loan.canBackup,
            canBackupSales: formData.role === "admin" || formData.modules.sales.canBackup,
            canViewHistoryRental: formData.role === "admin" || formData.modules.rental.canViewHistory,
            canViewHistoryPawnshop: formData.role === "admin" || formData.modules.pawnshop.canViewHistory,
            canViewHistoryLoan: formData.role === "admin" || formData.modules.loan.canViewHistory,
            canViewHistorySales: formData.role === "admin" || formData.modules.sales.canViewHistory,
            // Global permissions
            canDelete: formData.role === "admin" || formData.globalPermissions.canDelete,
            canBackup: formData.role === "admin" || formData.globalPermissions.canBackup,
            canViewAccessHistory: formData.role === "admin" || formData.globalPermissions.canViewAccessHistory,
            canManageUsers: formData.role === "admin" || formData.globalPermissions.canManageUsers,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Lỗi khi cập nhật tài khoản")

        addAccessLog(
          "Chỉnh sửa",
          "Cài đặt - Phân quyền người dùng",
          `Cập nhật tài khoản và phân quyền: ${formData.username} (${formData.displayName})`
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
            // Modular permissions
            canAccessRental: formData.role === "admin" || formData.modules.rental.access,
            canAccessPawnshop: formData.role === "admin" || formData.modules.pawnshop.access,
            canAccessLoan: formData.role === "admin" || formData.modules.loan.access,
            canAccessSales: formData.role === "admin" || formData.modules.sales.access,
            canDeleteRental: formData.role === "admin" || formData.modules.rental.canDelete,
            canDeletePawnshop: formData.role === "admin" || formData.modules.pawnshop.canDelete,
            canDeleteLoan: formData.role === "admin" || formData.modules.loan.canDelete,
            canDeleteSales: formData.role === "admin" || formData.modules.sales.canDelete,
            canBackupRental: formData.role === "admin" || formData.modules.rental.canBackup,
            canBackupPawnshop: formData.role === "admin" || formData.modules.pawnshop.canBackup,
            canBackupLoan: formData.role === "admin" || formData.modules.loan.canBackup,
            canBackupSales: formData.role === "admin" || formData.modules.sales.canBackup,
            canViewHistoryRental: formData.role === "admin" || formData.modules.rental.canViewHistory,
            canViewHistoryPawnshop: formData.role === "admin" || formData.modules.pawnshop.canViewHistory,
            canViewHistoryLoan: formData.role === "admin" || formData.modules.loan.canViewHistory,
            canViewHistorySales: formData.role === "admin" || formData.modules.sales.canViewHistory,
            // Global permissions
            canDelete: formData.role === "admin" || formData.globalPermissions.canDelete,
            canBackup: formData.role === "admin" || formData.globalPermissions.canBackup,
            canViewAccessHistory: formData.role === "admin" || formData.globalPermissions.canViewAccessHistory,
            canManageUsers: formData.role === "admin" || formData.globalPermissions.canManageUsers,
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
                Thống kê & Phân quyền Tài khoản theo Phân hệ
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Quản lý quyền truy cập các phân hệ (Thuê xe, Cầm đồ, Cho vay, Mua bán) & quyền thao tác của nhân viên
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

          <Card className="bg-purple-50/60 border-purple-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 truncate">Số Phân hệ</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-900 money mt-0.5">4 Phân Hệ</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-200/80 text-purple-800 shrink-0">
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
                <table className="w-full text-left text-sm min-w-[780px]">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <th className="py-3 px-4 min-w-[160px]">Tài khoản</th>
                      <th className="py-3 px-4 min-w-[100px]">Vai Trò</th>
                      <th className="py-3 px-4 min-w-[300px]">Truy Cập Phân Hệ</th>
                      <th className="py-3 px-4 min-w-[160px]">Quyền Xóa / Thao tác</th>
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Sparkles className="w-3.5 h-3.5" />
                                Toàn quyền truy cập cả 4 phân hệ
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${
                                    account.modules.rental.access
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-slate-50 text-slate-400 border-slate-200 opacity-50 line-through"
                                  }`}
                                >
                                  <Car className="w-3 h-3" />
                                  Thuê xe
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${
                                    account.modules.pawnshop.access
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-50 text-slate-400 border-slate-200 opacity-50 line-through"
                                  }`}
                                >
                                  <Gem className="w-3 h-3" />
                                  Cầm đồ
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${
                                    account.modules.loan.access
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-50 text-slate-400 border-slate-200 opacity-50 line-through"
                                  }`}
                                >
                                  <Coins className="w-3 h-3" />
                                  Cho vay
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${
                                    account.modules.sales.access
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-slate-50 text-slate-400 border-slate-200 opacity-50 line-through"
                                  }`}
                                >
                                  <Tag className="w-3 h-3" />
                                  Mua bán
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isAdmin ? (
                              <span className="text-xs font-medium text-slate-600">Được phép xóa & sao lưu</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {account.globalPermissions.canDelete ||
                                account.modules.rental.canDelete ||
                                account.modules.pawnshop.canDelete ||
                                account.modules.loan.canDelete ||
                                account.modules.sales.canDelete ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                    <KeyRound className="w-3 h-3" />
                                    Có quyền xóa
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                                    Không được xóa
                                  </span>
                                )}
                              </div>
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
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phân hệ truy cập:</p>
                        {isAdmin ? (
                          <p className="text-xs font-medium text-blue-700">✓ Toàn quyền 4 phân hệ</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {account.modules.rental.access && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">Thuê xe</span>}
                            {account.modules.pawnshop.access && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">Cầm đồ</span>}
                            {account.modules.loan.access && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">Cho vay</span>}
                            {account.modules.sales.access && <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">Mua bán</span>}
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
                Cấu hình tài khoản và phân quyền chi tiết từng phân hệ hoạt động (Thuê xe, Cầm đồ, Cho vay, Mua bán)
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
                onClick={() => setActiveTab("modules")}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md ui-transition text-center ${
                  activeTab === "modules"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                2. Phân quyền theo Phân hệ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("global")}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md ui-transition text-center ${
                  activeTab === "global"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                3. Quyền hệ thống
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
                      <Label htmlFor="smart-username" className="text-xs font-semibold text-slate-700">Tên Đăng Nhập</Label>
                      <Input
                        id="smart-username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="ví dụ: nyan, loca..."
                        disabled={!!editingUser}
                        className="mt-1 h-10 text-sm font-mono"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="smart-displayName" className="text-xs font-semibold text-slate-700">Tên Hiển Thị</Label>
                      <Input
                        id="smart-displayName"
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
                      <Label htmlFor="smart-password" className="text-xs font-semibold text-slate-700">
                        {editingUser ? "Mật khẩu mới (Để trống nếu giữ nguyên)" : "Mật khẩu"}
                      </Label>
                      <Input
                        id="smart-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="mt-1 h-10 text-sm"
                        required={!editingUser}
                      />
                    </div>

                    <div>
                      <Label htmlFor="smart-role" className="text-xs font-semibold text-slate-700">Vai Trò Hệ Thống</Label>
                      <select
                        id="smart-role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "staff" })}
                        className="mt-1 w-full h-10 px-3 bg-white border border-slate-200 rounded-[var(--radius-control)] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="staff">Nhân viên (Staff - Phân quyền theo phân hệ)</option>
                        <option value="admin">Quản trị viên (Admin - Toàn quyền hệ thống)</option>
                      </select>
                    </div>
                  </div>

                  {formData.role === "admin" ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 font-medium">
                      💡 Tài khoản <strong>Admin (Quản trị viên)</strong> mặc định có toàn bộ quyền truy cập và thao tác trên cả 4 phân hệ.
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600 font-medium">Phân quyền nhanh cho Nhân viên:</span>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyShortcut("all")}
                          className="h-7 text-[11px] bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          Tất cả phân hệ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyShortcut("read-only")}
                          className="h-7 text-[11px] bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        >
                          Chỉ xem (Không xóa)
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("modules")}
                      className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Tiếp tục: Phân quyền Phân hệ →
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: PHÂN QUYỀN THEO PHÂN HỆ */}
              {activeTab === "modules" && (
                <div className="space-y-4">
                  {formData.role === "admin" && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      ℹ️ Đang chọn vai trò Admin. Tài khoản này sẽ có toàn quyền truy cập tất cả phân hệ bên dưới.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* 1. CHO THUÊ XE */}
                    <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                          <Car className="w-4 h-4 text-blue-600" />
                          Phân hệ Cho thuê xe
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin"}
                            checked={formData.role === "admin" || formData.modules.rental.access}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  rental: { ...prev.modules.rental, access: e.target.checked },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Cho truy cập</span>
                        </label>
                      </div>

                      <div className="space-y-2 pt-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.rental.access}
                            checked={formData.role === "admin" || formData.modules.rental.canDelete}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  rental: { ...prev.modules.rental, canDelete: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-rose-600"
                          />
                          <span>Quyền xóa xe / đơn thuê xe</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.rental.access}
                            checked={formData.role === "admin" || formData.modules.rental.canBackup}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  rental: { ...prev.modules.rental, canBackup: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-emerald-600"
                          />
                          <span>Quyền sao lưu dữ liệu cho thuê</span>
                        </label>
                      </div>
                    </div>

                    {/* 2. CẦM ĐỒ */}
                    <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                          <Gem className="w-4 h-4 text-amber-600" />
                          Phân hệ Cầm đồ
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin"}
                            checked={formData.role === "admin" || formData.modules.pawnshop.access}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  pawnshop: { ...prev.modules.pawnshop, access: e.target.checked },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Cho truy cập</span>
                        </label>
                      </div>

                      <div className="space-y-2 pt-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.pawnshop.access}
                            checked={formData.role === "admin" || formData.modules.pawnshop.canDelete}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  pawnshop: { ...prev.modules.pawnshop, canDelete: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-rose-600"
                          />
                          <span>Quyền xóa hợp đồng cầm đồ</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.pawnshop.access}
                            checked={formData.role === "admin" || formData.modules.pawnshop.canBackup}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  pawnshop: { ...prev.modules.pawnshop, canBackup: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-emerald-600"
                          />
                          <span>Quyền sao lưu dữ liệu cầm đồ</span>
                        </label>
                      </div>
                    </div>

                    {/* 3. CHO VAY */}
                    <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-emerald-600" />
                          Phân hệ Cho vay
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin"}
                            checked={formData.role === "admin" || formData.modules.loan.access}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  loan: { ...prev.modules.loan, access: e.target.checked },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Cho truy cập</span>
                        </label>
                      </div>

                      <div className="space-y-2 pt-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.loan.access}
                            checked={formData.role === "admin" || formData.modules.loan.canDelete}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  loan: { ...prev.modules.loan, canDelete: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-rose-600"
                          />
                          <span>Quyền xóa hợp đồng cho vay</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.loan.access}
                            checked={formData.role === "admin" || formData.modules.loan.canBackup}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  loan: { ...prev.modules.loan, canBackup: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-emerald-600"
                          />
                          <span>Quyền sao lưu dữ liệu cho vay</span>
                        </label>
                      </div>
                    </div>

                    {/* 4. MUA BÁN XE */}
                    <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-bold text-xs text-purple-900 flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-purple-600" />
                          Phân hệ Mua bán xe
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin"}
                            checked={formData.role === "admin" || formData.modules.sales.access}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  sales: { ...prev.modules.sales, access: e.target.checked },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Cho truy cập</span>
                        </label>
                      </div>

                      <div className="space-y-2 pt-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.sales.access}
                            checked={formData.role === "admin" || formData.modules.sales.canDelete}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  sales: { ...prev.modules.sales, canDelete: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-rose-600"
                          />
                          <span>Quyền xóa dữ liệu mua bán</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            disabled={formData.role === "admin" || !formData.modules.sales.access}
                            checked={formData.role === "admin" || formData.modules.sales.canBackup}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                modules: {
                                  ...prev.modules,
                                  sales: { ...prev.modules.sales, canBackup: e.target.checked },
                                },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-emerald-600"
                          />
                          <span>Quyền sao lưu dữ liệu mua bán</span>
                        </label>
                      </div>
                    </div>
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
                      onClick={() => setActiveTab("global")}
                      className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Tiếp tục: Quyền Hệ thống →
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 3: QUYỀN HỆ THỐNG */}
              {activeTab === "global" && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.globalPermissions.canDelete}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            globalPermissions: { ...prev.globalPermissions, canDelete: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-rose-500" />
                          Quyền xóa dữ liệu chung
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép thao tác xóa danh mục khách hàng, xe và các bản ghi tổng thể</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.globalPermissions.canBackup}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            globalPermissions: { ...prev.globalPermissions, canBackup: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-emerald-600" />
                          Quyền sao lưu & khôi phục dữ liệu
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép tải và khôi phục bản sao lưu hệ thống trong trang Cài đặt</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.globalPermissions.canViewAccessHistory}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            globalPermissions: { ...prev.globalPermissions, canViewAccessHistory: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <History className="w-4 h-4 text-blue-600" />
                          Quyền xem lịch sử truy cập nhật ký
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép xem nhật ký hoạt động hệ thống của các nhân viên khác</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                      <input
                        type="checkbox"
                        disabled={formData.role === "admin"}
                        checked={formData.role === "admin" || formData.globalPermissions.canManageUsers}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            globalPermissions: { ...prev.globalPermissions, canManageUsers: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-purple-600" />
                          Quyền quản lý người dùng & phân quyền
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Cho phép mở cửa sổ phân quyền này để thêm/sửa nhân viên khác</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-between pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("modules")}
                      className="h-9 text-xs"
                    >
                      ← Quay lại Phân hệ
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
