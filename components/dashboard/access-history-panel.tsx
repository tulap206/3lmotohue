"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  History,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Eye,
  FileText,
  Car,
  Users,
  ClipboardList,
  Settings,
  RefreshCw,
  Activity,
  Database,
  Wallet,
  ShieldAlert,
  Wrench,
  UserCheck,
  Info,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDisplayDateTime } from "@/lib/format-date"
import { ModuleMobileCard, ModulePagination, ModuleResponsiveTable } from "@/components/dashboard/module-shell"

export interface AccessLogRecord {
  id: string
  username: string
  displayName: string
  action: string
  module: string
  details: string
  timestamp: string
  ipAddress?: string
  ip_address?: string
  displayname?: string
  created_at?: string
}

export type AccessHistoryModuleKey = "rental" | "sales" | "pawnshop" | "loan"
type AccessHistoryLayout = "page" | "embedded"
type AccessHistoryAccent = "red" | "blue" | "amber" | "emerald" | "violet"

const EMBEDDED_ROWS = 10
const PAGE_ROWS = 10

const MODULE_CONFIG: Record<
  AccessHistoryModuleKey,
  {
    accent: AccessHistoryAccent
    layout: AccessHistoryLayout
    title: string
    description: string
    scopeLabel: string
    hideModuleFilter: boolean
  }
> = {
  rental: {
    accent: "blue",
    layout: "page",
    title: "Lịch sử truy cập",
    description: "Theo dõi toàn bộ hoạt động và lịch sử chỉnh sửa hệ thống",
    scopeLabel: "Cho thuê xe",
    hideModuleFilter: false,
  },
  sales: {
    accent: "blue",
    layout: "embedded",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ mua bán xe",
    scopeLabel: "Mua bán xe",
    hideModuleFilter: false,
  },
  pawnshop: {
    accent: "amber",
    layout: "embedded",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ cầm đồ",
    scopeLabel: "Cầm đồ",
    hideModuleFilter: false,
  },
  loan: {
    accent: "emerald",
    layout: "embedded",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ cho vay",
    scopeLabel: "Cho vay",
    hideModuleFilter: false,
  },
}

const layoutHeight: Record<AccessHistoryLayout, string> = {
  page: "",
  embedded: "",
}

const accentStyles: Record<
  AccessHistoryAccent,
  { stripe: string; ring: string; badge: string; icon: string }
> = {
  red: {
    stripe: "from-red-400 to-red-600",
    ring: "ring-red-500/20",
    badge: "bg-rose-50 text-rose-700 border-rose-100",
    icon: "text-rose-600 bg-rose-50",
  },
  blue: {
    stripe: "from-blue-400 to-blue-600",
    ring: "ring-blue-500/20",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
    icon: "text-blue-600 bg-blue-50",
  },
  amber: {
    stripe: "from-amber-400 to-amber-500",
    ring: "ring-amber-500/20",
    badge: "bg-amber-50 text-amber-800 border-amber-100",
    icon: "text-amber-600 bg-amber-50",
  },
  emerald: {
    stripe: "from-emerald-400 to-emerald-600",
    ring: "ring-emerald-500/20",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: "text-emerald-600 bg-emerald-50",
  },
  violet: {
    stripe: "from-violet-400 to-violet-600",
    ring: "ring-violet-500/20",
    badge: "bg-violet-50 text-violet-700 border-violet-100",
    icon: "text-violet-600 bg-violet-50",
  },
}

const actionIconMap: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  "Đăng nhập": { icon: LogIn, color: "text-emerald-700", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Đăng xuất": { icon: LogOut, color: "text-slate-600", bg: "bg-slate-100 text-slate-700 border-slate-200" },
  "Thêm mới": { icon: Plus, color: "text-blue-700", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  "Chỉnh sửa": { icon: Pencil, color: "text-amber-700", bg: "bg-amber-50 text-amber-800 border-amber-200" },
  "Xóa": { icon: Trash2, color: "text-rose-700", bg: "bg-rose-50 text-rose-700 border-rose-200" },
  "Xoá": { icon: Trash2, color: "text-rose-700", bg: "bg-rose-50 text-rose-700 border-rose-200" },
  "Bảo trì": { icon: Wrench, color: "text-amber-700", bg: "bg-amber-50 text-amber-800 border-amber-200" },
  "Trả xe": { icon: Car, color: "text-emerald-700", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Sao lưu": { icon: Database, color: "text-slate-700", bg: "bg-slate-100 text-slate-700 border-slate-200" },
  "Sao lưu dữ liệu": { icon: Database, color: "text-slate-700", bg: "bg-slate-100 text-slate-700 border-slate-200" },
  "Sao lưu tự động": { icon: Database, color: "text-slate-700", bg: "bg-slate-100 text-slate-700 border-slate-200" },
  "Khôi phục": { icon: RefreshCw, color: "text-slate-700", bg: "bg-slate-100 text-slate-700 border-slate-200" },
  "Khôi phục dữ liệu": { icon: RefreshCw, color: "text-slate-700", bg: "bg-slate-100 text-slate-700 border-slate-200" },
  "Xem": { icon: Eye, color: "text-slate-600", bg: "bg-slate-100 text-slate-600 border-slate-200" },
  "Truy cập": { icon: Activity, color: "text-slate-600", bg: "bg-slate-100 text-slate-600 border-slate-200" },
}

const moduleIconMap: Record<string, { icon: React.ElementType; color: string; badgeColor: string }> = {
  "Quản lý xe": { icon: Car, color: "text-blue-600", badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
  "Đơn thuê": { icon: ClipboardList, color: "text-violet-600", badgeColor: "bg-violet-50 text-violet-700 border-violet-200" },
  "Quản lý khách hàng": { icon: Users, color: "text-emerald-600", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Bảo trì xe": { icon: Wrench, color: "text-amber-600", badgeColor: "bg-amber-50 text-amber-800 border-amber-200" },
  "Thu / Chi": { icon: Wallet, color: "text-rose-600", badgeColor: "bg-rose-50 text-rose-700 border-rose-200" },
  "Báo cáo": { icon: FileText, color: "text-indigo-600", badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "Quản lý tài khoản": { icon: UserCheck, color: "text-cyan-600", badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  "Cài đặt & Sao lưu": { icon: Database, color: "text-slate-600", badgeColor: "bg-slate-100 text-slate-700 border-slate-200" },
  "Hệ thống & Đăng nhập": { icon: Settings, color: "text-slate-500", badgeColor: "bg-slate-100 text-slate-600 border-slate-200" },
}

function extractIpFromDetails(details: string): string | undefined {
  if (!details) return undefined
  const match = details.match(/IP:\s*([0-9a-fA-F:.]+)/i) || details.match(/\bIP\s+([0-9a-fA-F:.]+)/i)
  return match?.[1]
}

function stripIpFromDetails(details: string): string {
  if (!details) return ""
  return details
    .replace(/IP:\s*[0-9a-fA-F:.]+\s*\|\s*/i, "")
    .replace(/IP:\s*[0-9a-fA-F:.]+\s*/i, "")
    .trim()
}

function normalizeLog(log: AccessLogRecord): AccessLogRecord {
  const rawDetails = log.details || ""
  const ipAddress =
    log.ipAddress ||
    log.ip_address ||
    extractIpFromDetails(rawDetails) ||
    undefined

  return {
    ...log,
    timestamp: log.timestamp || log.created_at || "",
    username: log.username || "",
    displayName: log.displayName || log.displayname || log.username || "",
    details: stripIpFromDetails(rawDetails),
    module: log.module || "",
    action: log.action || "",
    ipAddress,
  }
}

export function isTelegramLog(log: AccessLogRecord): boolean {
  const u = (log.username || "").toLowerCase()
  const m = (log.module || "").toLowerCase()
  const d = (log.displayName || log.displayname || "").toLowerCase()
  const details = (log.details || "").toLowerCase()
  const a = (log.action || "").toLowerCase()

  if (u.includes("telegram")) return true
  if (m.includes("telegram")) return true
  if (d.includes("telegram")) return true
  if (a.includes("telegram")) return true
  if (
    details.includes("hệ thống telegram") ||
    details.includes("thông báo telegram") ||
    (details.includes("nhận sự kiện:") && details.includes("token:")) ||
    details.includes("chatid:")
  ) {
    return true
  }
  return false
}

/**
 * Chuẩn hóa phân hệ thông minh, map dữ liệu cũ và mới vào nhóm phân hệ chính xác
 */
export function getModuleLabel(mod: string): string {
  const lower = (mod || "").toLowerCase().trim()
  if (lower.includes("bảo trì") || lower.includes("bảo dưỡng") || lower === "maintenance") {
    return "Bảo trì xe"
  }
  if (
    lower.includes("đơn thuê") ||
    lower.includes("thuê xe") ||
    lower.includes("hợp đồng") ||
    lower.includes("đơn hàng") ||
    lower === "rentals" ||
    lower === "orders"
  ) {
    return "Đơn thuê"
  }
  if (lower.includes("khách hàng") || lower.includes("khách thuê") || lower === "customers") {
    return "Quản lý khách hàng"
  }
  if (lower.includes("xe") || lower === "vehicles") {
    return "Quản lý xe"
  }
  if (
    lower.includes("thu/chi") ||
    lower.includes("thu chi") ||
    lower.includes("sổ quỹ") ||
    lower.includes("giao dịch") ||
    lower === "transactions"
  ) {
    return "Thu / Chi"
  }
  if (lower.includes("báo cáo") || lower.includes("thống kê") || lower === "reports") {
    return "Báo cáo"
  }
  if (
    lower.includes("người dùng") ||
    lower.includes("tài khoản") ||
    lower.includes("phân quyền") ||
    lower.includes("user")
  ) {
    return "Quản lý tài khoản"
  }
  if (
    lower.includes("sao lưu") ||
    lower.includes("khôi phục") ||
    lower.includes("cài đặt") ||
    lower.includes("settings")
  ) {
    return "Cài đặt & Sao lưu"
  }
  if (
    lower.includes("đăng nhập") ||
    lower.includes("đăng xuất") ||
    lower.includes("hệ thống") ||
    lower.includes("trang chủ") ||
    lower.includes("system")
  ) {
    return "Hệ thống & Đăng nhập"
  }
  return mod || "Hệ thống & Đăng nhập"
}

export function getActionLabel(act: string): string {
  const lower = (act || "").toLowerCase().trim()
  if (lower.includes("đăng nhập") || lower === "login") return "Đăng nhập"
  if (lower.includes("đăng xuất") || lower === "logout") return "Đăng xuất"
  if (lower.includes("thêm") || lower.includes("tạo") || lower === "insert" || lower === "create") return "Thêm mới"
  if (lower.includes("sửa") || lower.includes("cập nhật") || lower === "edit" || lower === "update") return "Chỉnh sửa"
  if (lower.includes("xóa") || lower.includes("xoá") || lower === "delete" || lower === "remove") return "Xóa"
  if (lower.includes("bảo trì") || lower.includes("bảo dưỡng")) return "Bảo trì"
  if (lower.includes("trả xe")) return "Trả xe"
  if (lower.includes("sao lưu")) return "Sao lưu dữ liệu"
  if (lower.includes("khôi phục")) return "Khôi phục dữ liệu"
  if (lower.includes("gửi thông báo") || lower.includes("thông báo")) return "Gửi thông báo"
  if (lower === "xem" || lower.includes("xem chi tiết")) return "Xem"
  if (lower.includes("truy cập")) return "Truy cập"
  return act || "Thao tác"
}

function isNoiseActionLabel(label: string) {
  return /^(test|testing|debug)$/i.test(label.trim())
}

function formatCompactDate(dateString: string) {
  return formatDisplayDateTime(dateString)
}

function panelShellClass(layout: AccessHistoryLayout) {
  if (layout === "embedded") return "access-history-panel flex flex-col"
  return cn("access-history-panel flex min-h-0 flex-col", layoutHeight[layout])
}

/**
 * Phân tích chuỗi chi tiết log để tách nội dung chính, danh sách thay đổi (diff) và thiết bị
 */
function parseLogDetails(rawDetails: string) {
  let mainText = rawDetails || ""
  let deviceText = ""
  let diffItems: string[] = []

  // Tách [Thiết bị: ...]
  const deviceMatch = mainText.match(/\[Thiết bị:\s*(.*?)\]/i)
  if (deviceMatch) {
    deviceText = deviceMatch[1]
    mainText = mainText.replace(/\[Thiết bị:\s*.*?\]/i, "").trim()
  }

  // Tách [thay đổi 1, thay đổi 2]
  const diffMatch = mainText.match(/\[(.*?)\]$/)
  if (diffMatch && diffMatch[1].includes("→")) {
    const diffRaw = diffMatch[1]
    diffItems = diffRaw.split(",").map((s) => s.trim()).filter(Boolean)
    mainText = mainText.replace(/\[(.*?)\]$/, "").trim()
  }

  return { mainText, deviceText, diffItems }
}

export function AccessHistoryDenied({
  layout = "embedded",
  message = "Bạn không có quyền xem lịch sử truy cập phân hệ này.",
}: {
  layout?: AccessHistoryLayout
  message?: string
}) {
  return (
    <div className={panelShellClass(layout)}>
      <div className="module-card flex flex-1 flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/30 px-6 py-10 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-500" />
        <h3 className="text-sm font-bold text-rose-800">Truy cập bị hạn chế</h3>
        <p className="mt-1 text-sm text-rose-600">{message}</p>
      </div>
    </div>
  )
}

export function AccessHistoryModuleSection({
  module,
  logs,
  loading,
  onRefresh,
  allowed,
  itemsPerPage,
  dbUsers = [],
}: {
  module: AccessHistoryModuleKey
  logs: AccessLogRecord[]
  loading: boolean
  onRefresh: () => void
  allowed: boolean
  itemsPerPage?: number
  dbUsers?: any[]
}) {
  const config = MODULE_CONFIG[module]

  if (!allowed) {
    return <AccessHistoryDenied layout={config.layout} />
  }

  return (
    <AccessHistoryPanel
      logs={logs}
      loading={loading}
      onRefresh={onRefresh}
      accent={config.accent}
      layout={config.layout}
      title={config.title}
      description={config.description}
      scopeLabel={config.scopeLabel}
      hideModuleFilter={config.hideModuleFilter}
      itemsPerPage={itemsPerPage}
      dbUsers={dbUsers}
    />
  )
}

export function AccessHistoryPanel({
  logs,
  loading,
  onRefresh,
  title = "Lịch sử truy cập",
  description = "Theo dõi toàn bộ hoạt động và lịch sử chỉnh sửa hệ thống",
  scopeLabel,
  hideModuleFilter = false,
  layout = "page",
  accent = "blue",
  itemsPerPage: itemsPerPageProp,
  dbUsers = [],
}: {
  logs: AccessLogRecord[]
  loading: boolean
  onRefresh: () => void
  title?: string
  description?: string
  scopeLabel?: string
  hideModuleFilter?: boolean
  layout?: AccessHistoryLayout
  accent?: AccessHistoryAccent
  itemsPerPage?: number
  dbUsers?: any[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAccount, setFilterAccount] = useState("all")
  const [filterModule, setFilterModule] = useState("all")
  const [filterAction, setFilterAction] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AccessLogRecord | null>(null)

  const styles = accentStyles[accent]
  const itemsPerPage = itemsPerPageProp ?? (layout === "page" ? PAGE_ROWS : EMBEDDED_ROWS)

  // Normalize logs and filter out internal telegram notifications
  const normalizedLogs = useMemo(() => {
    return logs.filter((log) => !isTelegramLog(log)).map(normalizeLog)
  }, [logs])

  // Lấy danh sách tài khoản từ DB (auth_users)
  const accounts = useMemo(() => {
    const seen = new Set<string>()
    const fromDb = dbUsers
      .map((u) => {
        const username = String(u.username || "").trim()
        const displayName = String(u.displayName || u.displayname || username).trim()
        return { username, displayName }
      })
      .filter((u) => {
        const key = u.username.toLowerCase()
        if (!u.username || key === "system" || seen.has(key)) return false
        seen.add(key)
        return true
      })

    return fromDb.sort((a, b) => {
      if (a.username.toLowerCase() === "admin") return -1
      if (b.username.toLowerCase() === "admin") return 1
      return a.username.localeCompare(b.username)
    })
  }, [dbUsers])

  // Danh sách phân hệ chuẩn hóa
  const modules = useMemo(() => {
    const order = [
      "Quản lý xe",
      "Đơn thuê",
      "Quản lý khách hàng",
      "Bảo trì xe",
      "Thu / Chi",
      "Báo cáo",
      "Quản lý tài khoản",
      "Cài đặt & Sao lưu",
      "Hệ thống & Đăng nhập",
    ]
    const presentModules = Array.from(new Set(normalizedLogs.map((log) => getModuleLabel(log.module)))).filter(Boolean)
    const sorted = order.filter((m) => presentModules.includes(m))
    const others = presentModules.filter((m) => !order.includes(m))
    return [...sorted, ...others]
  }, [normalizedLogs])

  // Lọc hành động động theo phân hệ đang chọn
  const actions = useMemo(() => {
    let filteredForAction = normalizedLogs
    if (filterModule !== "all") {
      filteredForAction = normalizedLogs.filter((log) => getModuleLabel(log.module) === filterModule)
    }
    const rawActions = Array.from(new Set(filteredForAction.map((log) => getActionLabel(log.action))))
      .filter((action) => Boolean(action) && !isNoiseActionLabel(action))

    const priority = [
      "Thêm mới",
      "Chỉnh sửa",
      "Xóa",
      "Bảo trì",
      "Trả xe",
      "Đăng nhập",
      "Đăng xuất",
      "Xem",
      "Sao lưu dữ liệu",
      "Khôi phục dữ liệu",
    ]
    return priority.filter((p) => rawActions.includes(p)).concat(rawActions.filter((a) => !priority.includes(a)))
  }, [normalizedLogs, filterModule])

  const filteredLogs = useMemo(
    () =>
      normalizedLogs
        .filter((log) => {
          const q = searchQuery.toLowerCase().trim()
          const matchSearch =
            !q ||
            log.details.toLowerCase().includes(q) ||
            log.username.toLowerCase().includes(q) ||
            log.displayName.toLowerCase().includes(q) ||
            log.module.toLowerCase().includes(q) ||
            log.action.toLowerCase().includes(q) ||
            (log.ipAddress || "").toLowerCase().includes(q)
          const matchAccount = filterAccount === "all" || log.username === filterAccount
          const matchModule = filterModule === "all" || getModuleLabel(log.module) === filterModule
          const matchAction = filterAction === "all" || getActionLabel(log.action) === filterAction
          return matchSearch && matchAccount && matchModule && matchAction
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [normalizedLogs, searchQuery, filterAccount, filterModule, filterAction]
  )

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )

  if (loading) {
    return (
      <div className={panelShellClass(layout)}>
        <div className="module-card relative flex flex-1 animate-pulse flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", styles.stripe)} />
          <div className="h-12 border-b border-slate-100 bg-slate-50/80" />
          <div className="flex-1 bg-slate-50/40" />
          <div className="h-10 border-t border-slate-100" />
        </div>
      </div>
    )
  }

  return (
    <div className={panelShellClass(layout)}>
      <div
        className={cn(
          "module-card relative flex flex-col overflow-hidden rounded-[var(--radius-container)] border border-slate-100 bg-white shadow-sm ring-1",
          styles.ring
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 z-10 h-0.5 bg-gradient-to-r", styles.stripe)} />

        {/* Toolbar */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-3 py-3 md:px-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:min-w-[180px] sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm theo nội dung, biển số, IP..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-11 rounded-[var(--radius-control)] border-slate-200 bg-white pl-9 text-body"
              />
            </div>

            {/* Lọc theo tài khoản */}
            <Select
              value={filterAccount}
              onValueChange={(value) => {
                setFilterAccount(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-11 w-full sm:w-[10.5rem] rounded-[var(--radius-control)] border-slate-200 bg-white text-body text-slate-800 font-medium">
                <SelectValue placeholder="Tất cả tài khoản" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">Tất cả tài khoản</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.username} value={account.username}>
                    {account.displayName && account.displayName !== account.username
                      ? `${account.displayName} (@${account.username})`
                      : `@${account.username}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Lọc theo Phân hệ */}
            {!hideModuleFilter && (
              <Select
                value={filterModule}
                onValueChange={(value) => {
                  setFilterModule(value)
                  setFilterAction("all")
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-11 w-full sm:w-[11.5rem] rounded-[var(--radius-control)] border-slate-200 bg-white text-body text-slate-800 font-medium">
                  <SelectValue placeholder="Tất cả phân hệ" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all">Tất cả phân hệ</SelectItem>
                  {modules.map((moduleName) => {
                    const modConfig = moduleIconMap[moduleName]
                    const IconComp = modConfig?.icon || Settings
                    return (
                      <SelectItem key={moduleName} value={moduleName}>
                        <div className="flex items-center gap-2">
                          <IconComp className={cn("h-3.5 w-3.5", modConfig?.color || "text-slate-500")} />
                          <span>{moduleName}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}

            {/* Lọc theo Hành động */}
            <Select
              value={filterAction}
              onValueChange={(value) => {
                setFilterAction(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-11 w-full sm:w-[10.5rem] rounded-[var(--radius-control)] border-slate-200 bg-white text-body text-slate-800 font-medium">
                <SelectValue placeholder="Tất cả hành động" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">Tất cả hành động</SelectItem>
                {actions.map((action) => {
                  const actConfig = actionIconMap[action]
                  const IconComp = actConfig?.icon || Activity
                  return (
                    <SelectItem key={action} value={action}>
                      <div className="flex items-center gap-2">
                        <IconComp className={cn("h-3.5 w-3.5", actConfig?.color || "text-slate-600")} />
                        <span>{action}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Button
              onClick={onRefresh}
              variant="outline"
              size="icon"
              disabled={loading}
              className="h-11 w-11 shrink-0 rounded-[var(--radius-control)] border-slate-200 hover:bg-slate-100"
              title="Làm mới"
            >
              <RefreshCw className={cn("h-4 w-4 text-slate-500", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div>
          {filteredLogs.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center px-4">
              <History className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-title text-slate-600 font-semibold">Không có dữ liệu lịch sử</p>
              <p className="text-meta mt-1 max-w-sm text-slate-400">
                Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc tài khoản / phân hệ / hành động.
              </p>
            </div>
          ) : (
            <div>
              <ModuleResponsiveTable
                desktop={
                  <table className="access-history-table w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <tr className="border-b border-slate-200 text-label font-bold text-slate-600">
                        <th className="w-12 px-3 py-2.5 text-center">STT</th>
                        <th className="w-[8rem] px-2 py-2.5">Thời gian</th>
                        <th className="w-[9.5rem] px-2 py-2.5">Người dùng</th>
                        <th className="w-[11.5rem] px-2 py-2.5">Hành động & Phân hệ</th>
                        <th className="px-3 py-2.5">Chi tiết thay đổi</th>
                        <th className="w-12 px-2 py-2.5 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-body text-slate-700">
                      {paginatedLogs.map((log, index) => {
                        const standardModule = getModuleLabel(log.module)
                        const standardAction = getActionLabel(log.action)
                        const actionConfig = actionIconMap[standardAction] ||
                          actionIconMap[log.action] || {
                            icon: Activity,
                            color: "text-slate-600",
                            bg: "bg-slate-100 text-slate-700 border-slate-200",
                          }
                        const moduleConfig = moduleIconMap[standardModule] ||
                          moduleIconMap[log.module] || {
                            icon: Settings,
                            color: "text-slate-500",
                            badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
                          }
                        const ActionIcon = actionConfig.icon
                        const ModuleIcon = moduleConfig.icon

                        const { mainText, deviceText, diffItems } = parseLogDetails(log.details)

                        return (
                          <tr
                            key={log.id}
                            className="access-history-row hover:bg-slate-50/80 transition-colors group cursor-pointer"
                            onClick={() => setSelectedLogForDetail(log)}
                          >
                            <td className="px-3 py-3 text-center text-meta font-semibold text-slate-400 tabular-nums">
                              {(safePage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 font-mono text-meta text-slate-600 font-medium">
                              {formatCompactDate(log.timestamp)}
                            </td>
                            <td className="px-2 py-3">
                              <div className="truncate font-semibold text-slate-900 text-body" title={log.displayName}>
                                {log.displayName}
                              </div>
                              <div className="truncate font-mono text-meta text-slate-400 mt-0.5">@{log.username}</div>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-label font-semibold",
                                    actionConfig.bg
                                  )}
                                >
                                  <ActionIcon className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{standardAction}</span>
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 truncate text-meta text-slate-600 font-medium">
                                <ModuleIcon className={cn("h-3.5 w-3.5 shrink-0", moduleConfig.color)} />
                                <span className="truncate">{standardModule}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="space-y-1">
                                <p className="text-slate-800 font-semibold text-body leading-snug" title={mainText}>
                                  {mainText || "—"}
                                </p>

                                {/* Hiển thị các trường thay đổi diff trực quan */}
                                {diffItems.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {diffItems.map((diff, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 rounded-md bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 text-meta text-amber-900 font-medium"
                                      >
                                        <span className="font-semibold text-amber-950">{diff.split("→")[0]}</span>
                                        {diff.includes("→") && (
                                          <>
                                            <span className="text-amber-600 font-bold">→</span>
                                            <span className="font-bold text-amber-900">{diff.split("→")[1]}</span>
                                          </>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-meta">
                                  {log.ipAddress && (
                                    <span className="font-mono font-semibold text-rose-600 inline-flex items-center gap-1">
                                      <Globe className="h-3 w-3 inline opacity-70" />
                                      IP {log.ipAddress}
                                    </span>
                                  )}
                                  {deviceText && (
                                    <span className="text-slate-400 inline-flex items-center gap-1">
                                      <Monitor className="h-3 w-3 inline opacity-70" />
                                      {deviceText}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedLogForDetail(log)
                                }}
                                title="Xem đầy đủ"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                }
                mobile={
                  <div className="space-y-2 p-2">
                    {paginatedLogs.map((log, index) => {
                      const standardModule = getModuleLabel(log.module)
                      const standardAction = getActionLabel(log.action)
                      const actionConfig = actionIconMap[standardAction] ||
                        actionIconMap[log.action] || {
                          icon: Activity,
                          color: "text-slate-600",
                          bg: "bg-slate-100 text-slate-700 border-slate-200",
                        }
                      const moduleConfig = moduleIconMap[standardModule] ||
                        moduleIconMap[log.module] || {
                          icon: Settings,
                          color: "text-slate-500",
                          badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
                        }
                      const ActionIcon = actionConfig.icon
                      const ModuleIcon = moduleConfig.icon
                      const { mainText, deviceText, diffItems } = parseLogDetails(log.details)

                      return (
                        <div key={log.id} onClick={() => setSelectedLogForDetail(log)} className="cursor-pointer">
                          <ModuleMobileCard className="active:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-meta font-semibold text-slate-400 tabular-nums">
                              #{(safePage - 1) * itemsPerPage + index + 1}
                            </span>
                            <span className="text-meta font-mono text-slate-500">{formatCompactDate(log.timestamp)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-body font-bold text-slate-900">{log.displayName}</p>
                              <p className="text-meta font-mono text-slate-400">@{log.username}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-label font-semibold",
                                  actionConfig.bg
                                )}
                              >
                                <ActionIcon className="h-3 w-3" />
                                {standardAction}
                              </span>
                              <span className="inline-flex items-center gap-1 text-meta text-slate-500 font-medium">
                                <ModuleIcon className={cn("h-3 w-3", moduleConfig.color)} />
                                {standardModule}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5 border border-slate-100">
                            <p className="text-body text-slate-800 font-medium break-words leading-snug">{mainText || "—"}</p>
                            {diffItems.length > 0 && (
                              <div className="space-y-1 pt-1">
                                {diffItems.map((diff, i) => (
                                  <div
                                    key={i}
                                    className="rounded bg-amber-100/70 border border-amber-200 px-2 py-1 text-meta text-amber-900 font-medium break-words"
                                  >
                                    {diff}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-meta">
                            <p className="font-mono font-bold text-rose-600">IP {log.ipAddress || "—"}</p>
                            {deviceText && <p className="text-slate-400 truncate max-w-[180px]">{deviceText}</p>}
                          </div>
                        </ModuleMobileCard>
                      </div>
                    )
                    })}
                  </div>
                }
              />
            </div>
          )}
        </div>

        <ModulePagination
          page={safePage}
          totalPages={Math.max(1, totalPages)}
          totalItems={filteredLogs.length}
          itemLabel="kết quả"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Dialog xem chi tiết log đầy đủ */}
      <Dialog open={!!selectedLogForDetail} onOpenChange={(open) => !open && setSelectedLogForDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-title">
              <History className="h-5 w-5 text-blue-600" />
              Chi tiết nhật ký hoạt động
            </DialogTitle>
          </DialogHeader>

          {selectedLogForDetail && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <p className="text-label text-slate-500 font-medium">Người thực hiện</p>
                  <p className="text-body font-bold text-slate-900 mt-0.5">{selectedLogForDetail.displayName}</p>
                  <p className="text-meta font-mono text-slate-500">@{selectedLogForDetail.username}</p>
                </div>
                <div>
                  <p className="text-label text-slate-500 font-medium">Thời gian</p>
                  <p className="text-body font-semibold text-slate-900 mt-0.5 font-mono">
                    {formatCompactDate(selectedLogForDetail.timestamp)}
                  </p>
                </div>
                <div>
                  <p className="text-label text-slate-500 font-medium">Phân hệ</p>
                  <div className="flex items-center gap-1.5 mt-1 font-semibold text-body text-slate-800">
                    {(() => {
                      const mod = getModuleLabel(selectedLogForDetail.module)
                      const cfg = moduleIconMap[mod]
                      const Icon = cfg?.icon || Settings
                      return (
                        <>
                          <Icon className={cn("h-4 w-4", cfg?.color)} />
                          <span>{mod}</span>
                        </>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <p className="text-label text-slate-500 font-medium">Hành động</p>
                  <div className="mt-1">
                    {(() => {
                      const act = getActionLabel(selectedLogForDetail.action)
                      const cfg = actionIconMap[act] || {
                        icon: Activity,
                        bg: "bg-slate-100 text-slate-700 border-slate-200",
                      }
                      const Icon = cfg.icon
                      return (
                        <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-label font-bold", cfg.bg)}>
                          <Icon className="h-3.5 w-3.5" />
                          {act}
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-label text-slate-700 font-bold mb-1.5">Nội dung chi tiết thay đổi</p>
                {(() => {
                  const { mainText, diffItems } = parseLogDetails(selectedLogForDetail.details)
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <p className="text-body text-slate-800 font-medium leading-relaxed">{mainText}</p>
                      {diffItems.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <p className="text-label text-amber-900 font-bold">Các mục thay đổi:</p>
                          {diffItems.map((diff, idx) => (
                            <div
                              key={idx}
                              className="rounded bg-amber-50 border border-amber-200 p-2 text-body text-amber-950 font-medium"
                            >
                              {diff}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-meta">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-rose-500" />
                    Địa chỉ IP:
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    {selectedLogForDetail.ipAddress || "Không xác định"}
                  </span>
                </div>
                {(() => {
                  const { deviceText } = parseLogDetails(selectedLogForDetail.details)
                  if (!deviceText) return null
                  return (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Monitor className="h-3.5 w-3.5 text-slate-600" />
                        Thiết bị & Trình duyệt:
                      </span>
                      <span className="font-medium text-slate-700">{deviceText}</span>
                    </div>
                  )
                })()}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelectedLogForDetail(null)} className="h-10 px-5 font-semibold">
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
