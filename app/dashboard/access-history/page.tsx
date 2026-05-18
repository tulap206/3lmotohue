"use client"

import { useState } from "react"
import { useAuth, AccessLog } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  History, 
  User, 
  LogIn, 
  LogOut, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  FileText,
  Bike,
  Users,
  ClipboardList,
  Filter,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react"

const actionIconMap: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  "Đăng nhập": { icon: LogIn, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  "Đăng xuất": { icon: LogOut, color: "text-gray-500", bgColor: "bg-gray-100" },
  "Thêm mới": { icon: Plus, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  "Chỉnh sửa": { icon: Pencil, color: "text-amber-600", bgColor: "bg-amber-50" },
  "Xóa": { icon: Trash2, color: "text-red-600", bgColor: "bg-red-50" },
  "Xem": { icon: Eye, color: "text-blue-600", bgColor: "bg-blue-50" },
}

const moduleIconMap: Record<string, { icon: React.ElementType; color: string }> = {
  "Hệ thống": { icon: Settings, color: "text-gray-600" },
  "Quản lý xe": { icon: Bike, color: "text-blue-600" },
  "Khách thuê": { icon: Users, color: "text-emerald-600" },
  "Đơn thuê": { icon: ClipboardList, color: "text-amber-600" },
  "Báo cáo": { icon: FileText, color: "text-violet-600" },
}

export default function AccessHistoryPage() {
  const { accessLogs } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAccount, setFilterAccount] = useState<string>("all")
  const [filterModule, setFilterModule] = useState<string>("all")
  const [filterAction, setFilterAction] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Get unique values for filters
  const accounts = Array.from(new Set(accessLogs.map(log => log.username)))
  const modules = Array.from(new Set(accessLogs.map(log => log.module)))
  const actions = Array.from(new Set(accessLogs.map(log => log.action)))

  // Filter logs
  const filteredLogs = accessLogs
    .filter(log => {
      const matchSearch = 
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchAccount = filterAccount === "all" || log.username === filterAccount
      const matchModule = filterModule === "all" || log.module === filterModule
      const matchAction = filterAction === "all" || log.action === filterAction
      return matchSearch && matchAccount && matchModule && matchAction
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Group logs by date
  const groupedLogs = paginatedLogs.reduce((groups, log) => {
    const timestamp = new Date(log.timestamp)
    const dateKey = timestamp.toLocaleDateString("vi-VN", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    })
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(log)
    return groups
  }, {} as Record<string, AccessLog[]>)

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  const getActionStyle = (action: string) => {
    return actionIconMap[action] || { icon: Eye, color: "text-gray-600", bgColor: "bg-gray-100" }
  }

  const getModuleStyle = (module: string) => {
    return moduleIconMap[module] || { icon: FileText, color: "text-gray-600" }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Lịch sử truy cập</h1>
          <p className="text-gray-500 mt-1">Theo dõi tất cả hoạt động trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <History className="w-4 h-4" />
          <span>Tổng: {filteredLogs.length} hoạt động</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 bg-gray-50 border-gray-200 rounded-xl"
              />
            </div>

            {/* Filter by account */}
            <Select value={filterAccount} onValueChange={(value) => { setFilterAccount(value); setCurrentPage(1) }}>
              <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Tài khoản" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 rounded-xl">
                <SelectItem value="all">Tất cả tài khoản</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account} value={account}>{account}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter by module */}
            <Select value={filterModule} onValueChange={(value) => { setFilterModule(value); setCurrentPage(1) }}>
              <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 rounded-xl">
                <SelectItem value="all">Tất cả module</SelectItem>
                {modules.map(module => (
                  <SelectItem key={module} value={module}>{module}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter by action type */}
            <Select value={filterAction} onValueChange={(value) => { setFilterAction(value); setCurrentPage(1) }}>
              <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Loại thao tác" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 rounded-xl">
                <SelectItem value="all">Tất cả thao tác</SelectItem>
                {actions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="bg-white border-0 card-shadow rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">Nhật ký hoạt động</CardTitle>
          <CardDescription className="text-gray-500">
            Hiển thị {paginatedLogs.length} / {filteredLogs.length} hoạt động
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <History className="w-12 h-12 mb-3 opacity-50" />
              <p>Chưa có hoạt động nào được ghi nhận</p>
              <p className="text-sm mt-1">Hãy thực hiện các thao tác trên hệ thống để xem lịch sử</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                <div key={date}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 px-4 sm:px-0 mb-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">{date}</span>
                  </div>

                  {/* Logs for this date */}
                  <div className="divide-y divide-gray-100">
                    {dateLogs.map((log) => {
                      const actionStyle = getActionStyle(log.action)
                      const moduleStyle = getModuleStyle(log.module)
                      const ActionIcon = actionStyle.icon
                      const ModuleIcon = moduleStyle.icon

                      return (
                        <div 
                          key={log.id} 
                          className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors"
                        >
                          {/* Action Icon */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${actionStyle.bgColor} flex items-center justify-center`}>
                            <ActionIcon className={`w-5 h-5 ${actionStyle.color}`} />
                          </div>

                          {/* Log Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-800">{log.displayName}</span>
                                  <span className="text-xs text-gray-400">({log.username})</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionStyle.bgColor} ${actionStyle.color}`}>
                                    {log.action}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 text-xs ${moduleStyle.color}`}>
                                    <ModuleIcon className="w-3 h-3" />
                                    {log.module}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(log.timestamp)}
                                  </span>
                                  <span>IP: {log.ipAddress}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-gray-200"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className={`h-8 w-8 rounded-lg ${
                            currentPage === page 
                              ? "bg-blue-500 text-white hover:bg-blue-600" 
                              : "border-gray-200"
                          }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-gray-200"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
