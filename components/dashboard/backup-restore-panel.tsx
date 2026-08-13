"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CloudUpload,
  Download,
  FileJson,
  Lock,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  Bike,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDisplayDateTime } from "@/lib/format-date"
import {
  ACCENT_BADGE_CLASS,
  ACCENT_BTN_CLASS,
  ACCENT_BTN_OUTLINE_CLASS,
  type ModuleAccent,
} from "@/lib/module-theme"
import {
  ModuleEmptyState,
  ModuleMobileCard,
  ModulePagination,
  ModuleResponsiveTable,
  ModuleSectionCard,
  moduleDestructiveBtnClass,
  moduleDialogContentClass,
} from "@/components/dashboard/module-shell"
import { rentalTableHeadClass } from "@/components/dashboard/rental-ui"

export type BackupAccent = ModuleAccent

export interface BackupFileItem {
  name: string
  created_at: string
  size: number
  url: string
}

type BackupPreviewData = {
  timestamp?: string
  customers?: unknown[]
  vehicles?: unknown[]
  rentals?: unknown[]
  [key: string]: unknown
}

type BackupCounts = {
  customers: number
  vehicles: number
  rentals: number
  timestamp?: string
}

type PendingRestore =
  | { kind: "cloud"; url: string; name: string }
  | { kind: "upload"; file: File; name: string }

const FILES_PER_PAGE = 10

function formatFileDate(iso: string) {
  return formatDisplayDateTime(iso)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function isAutoBackup(name: string) {
  return name.startsWith("auto-backup-")
}

function asRecord(item: unknown): Record<string, unknown> | null {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return item as Record<string, unknown>
  }
  return null
}

function pickLabel(item: unknown, keys: string[], fallback: string) {
  const row = asRecord(item)
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function countsFromPreview(data: BackupPreviewData): BackupCounts {
  return {
    customers: Array.isArray(data.customers) ? data.customers.length : 0,
    vehicles: Array.isArray(data.vehicles) ? data.vehicles.length : 0,
    rentals: Array.isArray(data.rentals) ? data.rentals.length : 0,
    timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
  }
}

async function downloadBackupFile(file: BackupFileItem) {
  try {
    const response = await fetch(file.url)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(file.url, "_blank")
  }
}

export function BackupAccessDenied() {
  return (
    <div className="rounded-[var(--radius-container)] border border-slate-200 bg-white px-6 py-12 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-rose-500" />
      <h3 className="text-title text-slate-800">Truy cập bị hạn chế</h3>
      <p className="text-body text-slate-500 mt-2 max-w-sm mx-auto">
        Bạn không có quyền sao lưu và khôi phục dữ liệu.
      </p>
    </div>
  )
}

export function BackupRestorePanel({
  accent,
  moduleName,
  scopeLabel,
  fileHint,
  files,
  filesLoading,
  loading,
  message,
  canBackup,
  canRestore,
  canDelete = false,
  onBackup,
  onRestoreUpload,
  onRestoreFile,
  onDeleteFile,
  onRefresh,
}: {
  accent: BackupAccent
  moduleName: string
  scopeLabel: string
  fileHint?: string
  files: BackupFileItem[]
  filesLoading: boolean
  loading: boolean
  message: { type: "success" | "error"; text: string } | null
  canBackup: boolean
  canRestore: boolean
  canDelete?: boolean
  onBackup: () => void
  onRestoreUpload: (file: File) => void
  onRestoreFile: (url: string, name: string) => void
  onDeleteFile?: (name: string) => void
  onRefresh: () => void
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailFile, setDetailFile] = useState<BackupFileItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<BackupPreviewData | null>(null)
  const [detailRaw, setDetailRaw] = useState("")

  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null)
  const [restorePreview, setRestorePreview] = useState<BackupCounts | null>(null)
  const [restorePreviewLoading, setRestorePreviewLoading] = useState(false)
  const [restorePreviewError, setRestorePreviewError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(files.length / FILES_PER_PAGE))

  useEffect(() => {
    setPage(1)
  }, [files.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedFiles = useMemo(
    () => files.slice((page - 1) * FILES_PER_PAGE, page * FILES_PER_PAGE),
    [files, page]
  )

  const latestFile = files[0]
  const autoCount = files.filter((f) => isAutoBackup(f.name)).length

  const openBackupDetail = async (file: BackupFileItem) => {
    setDetailFile(file)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData(null)
    setDetailRaw("")

    try {
      const response = await fetch(file.url)
      if (!response.ok) {
        throw new Error(`Không tải được tệp (${response.status})`)
      }
      const text = await response.text()
      const parsed = JSON.parse(text) as BackupPreviewData
      setDetailData(parsed)
      setDetailRaw(text.length > 120_000 ? `${text.slice(0, 120_000)}\n\n… (đã rút gọn, tệp quá lớn)` : text)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Không đọc được nội dung tệp sao lưu")
    } finally {
      setDetailLoading(false)
    }
  }

  const beginCloudRestore = async (url: string, name: string) => {
    if (!canRestore) return
    setPendingRestore({ kind: "cloud", url, name })
    setRestorePreview(null)
    setRestorePreviewError(null)
    setRestorePreviewLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error("Không tải được tệp sao lưu")
      const parsed = (await response.json()) as BackupPreviewData
      if (!parsed.customers || !parsed.vehicles || !parsed.rentals) {
        throw new Error("File backup không hợp lệ")
      }
      setRestorePreview(countsFromPreview(parsed))
    } catch (err) {
      setRestorePreviewError(err instanceof Error ? err.message : "Không đọc được tệp")
    } finally {
      setRestorePreviewLoading(false)
    }
  }

  const beginUploadRestore = async (file: File) => {
    if (!canRestore) return
    setPendingRestore({ kind: "upload", file, name: file.name })
    setRestorePreview(null)
    setRestorePreviewError(null)
    setRestorePreviewLoading(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as BackupPreviewData
      if (!parsed.customers || !parsed.vehicles || !parsed.rentals) {
        throw new Error("File backup không hợp lệ")
      }
      setRestorePreview(countsFromPreview(parsed))
    } catch (err) {
      setRestorePreviewError(err instanceof Error ? err.message : "File backup không hợp lệ")
    } finally {
      setRestorePreviewLoading(false)
    }
  }

  const confirmRestore = () => {
    if (!pendingRestore || restorePreviewError) return
    if (pendingRestore.kind === "cloud") {
      onRestoreFile(pendingRestore.url, pendingRestore.name)
    } else {
      onRestoreUpload(pendingRestore.file)
    }
    setPendingRestore(null)
    setRestorePreview(null)
    setDetailOpen(false)
  }

  const customers = Array.isArray(detailData?.customers) ? detailData.customers : []
  const vehicles = Array.isArray(detailData?.vehicles) ? detailData.vehicles : []
  const rentals = Array.isArray(detailData?.rentals) ? detailData.rentals : []
  const backupTimestamp =
    typeof detailData?.timestamp === "string" ? detailData.timestamp : detailFile?.created_at

  return (
    <>
      <div className="space-y-6">
        {message && (
          <div
            role="status"
            className={cn(
              "flex items-start gap-3 rounded-[var(--radius-control)] border px-4 py-3",
              message.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-rose-100 bg-rose-50 text-rose-800"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="text-body font-medium leading-relaxed whitespace-pre-line">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-8 rounded-[var(--radius-container)] border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/40">
              <p className="text-title">Thao tác</p>
              <p className="text-meta mt-0.5">
                {moduleName} · {scopeLabel}
              </p>
            </div>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={onBackup}
                disabled={loading || !canBackup}
                className={cn(
                  "h-11 flex-1 rounded-[var(--radius-control)] text-body font-semibold",
                  ACCENT_BTN_CLASS[accent],
                  !canBackup && "opacity-60"
                )}
              >
                <CloudUpload className="h-4 w-4 mr-2" />
                {loading ? "Đang xử lý…" : "Sao lưu lên đám mây"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => canRestore && uploadRef.current?.click()}
                disabled={loading || !canRestore}
                className={cn(
                  "h-11 flex-1 rounded-[var(--radius-control)] text-body font-semibold border-slate-200",
                  canRestore ? "text-slate-700 hover:bg-slate-50" : "opacity-60"
                )}
              >
                {canRestore ? (
                  <Upload className="h-4 w-4 mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {canRestore ? "Khôi phục từ file JSON" : "Khôi phục — chỉ admin"}
              </Button>
              <input
                ref={uploadRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) void beginUploadRestore(file)
                }}
                disabled={loading || !canRestore}
              />
            </div>
          </div>

          <div className="lg:col-span-4 rounded-[var(--radius-container)] border border-slate-200/80 bg-white px-4 sm:px-5 py-4 flex flex-col justify-center gap-3">
            <div>
              <p className="text-label">Bản sao lưu</p>
              <p className="text-title money tabular-nums text-slate-800 mt-0.5">
                {filesLoading ? "…" : files.length}
                <span className="text-meta font-normal ml-1.5">{autoCount} tự động</span>
              </p>
            </div>
            <div>
              <p className="text-label">Mới nhất</p>
              <p className="text-body text-slate-700 mt-0.5">
                {latestFile ? formatFileDate(latestFile.created_at) : "Chưa có"}
              </p>
            </div>
            <p className="text-meta leading-relaxed">
              Tự động lúc 17h mỗi ngày. File quá 30 ngày được dọn. Khôi phục ghi đè toàn bộ dữ liệu hiện tại.
            </p>
          </div>
        </div>

        <ModuleSectionCard
          title="Bản sao lưu trên đám mây"
          description={fileHint || "Nhấn tên file để xem nội dung. Khôi phục sẽ ghi đè dữ liệu hiện tại."}
          badge={
            <span className={cn("border text-label px-2 py-0.5 rounded-[var(--radius-badge)]", ACCENT_BADGE_CLASS[accent])}>
              {files.length} file
            </span>
          }
          filters={
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={filesLoading}
              className="h-11 rounded-[var(--radius-control)] border-slate-200 text-body font-semibold"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", filesLoading && "animate-spin")} />
              Làm mới
            </Button>
          }
        >
          <CardContent className="p-0">
            {filesLoading ? (
              <div className="divide-y divide-slate-100 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 my-1 rounded-[var(--radius-badge)] bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <ModuleEmptyState
                title="Chưa có bản sao lưu"
                description="Bấm Sao lưu lên đám mây để tạo bản đầu tiên, hoặc đợi bản tự động lúc 17h."
              />
            ) : (
              <>
                <ModuleResponsiveTable
                  desktop={
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                          <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                          <th className={rentalTableHeadClass}>Loại</th>
                          <th className={rentalTableHeadClass}>Tên file</th>
                          <th className={rentalTableHeadClass}>Thời gian</th>
                          <th className={cn(rentalTableHeadClass, "text-right")}>Dung lượng</th>
                          <th className={cn(rentalTableHeadClass, "text-right")}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedFiles.map((file, idx) => (
                          <tr
                            key={file.name}
                            className="hover:bg-slate-50/60 ui-transition"
                          >
                            <td className="px-4 py-3 text-center text-meta tabular-nums">
                              {(page - 1) * FILES_PER_PAGE + idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex text-label font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border",
                                  isAutoBackup(file.name)
                                    ? "bg-slate-50 text-slate-600 border-slate-100"
                                    : "bg-blue-50 text-blue-700 border-blue-100"
                                )}
                              >
                                {isAutoBackup(file.name) ? "Tự động" : "Thủ công"}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[280px]">
                              <button
                                type="button"
                                onClick={() => openBackupDetail(file)}
                                className="text-body font-medium text-slate-800 hover:text-blue-700 text-left truncate max-w-full ui-transition"
                                title="Xem chi tiết"
                              >
                                {file.name}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-body text-slate-500 whitespace-nowrap tabular-nums">
                              {formatFileDate(file.created_at)}
                            </td>
                            <td className="px-4 py-3 text-right text-body text-slate-500 tabular-nums whitespace-nowrap">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => downloadBackupFile(file)}
                                  disabled={loading}
                                  className="h-10 w-10 p-0 rounded-[var(--radius-control)] text-slate-500 hover:text-blue-700"
                                  title="Tải về"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void beginCloudRestore(file.url, file.name)}
                                  disabled={loading || !canRestore}
                                  className={cn(
                                    "h-10 rounded-[var(--radius-control)] text-label font-semibold",
                                    ACCENT_BTN_OUTLINE_CLASS[accent],
                                    !canRestore && "opacity-50"
                                  )}
                                >
                                  {canRestore ? "Khôi phục" : <Lock className="h-3.5 w-3.5" />}
                                </Button>
                                {canDelete && onDeleteFile && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setPendingDelete(file.name)}
                                    disabled={loading}
                                    className="h-10 w-10 p-0 rounded-[var(--radius-control)] text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    title="Xóa file"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                  mobile={
                    <>
                      {pagedFiles.map((file, idx) => (
                        <ModuleMobileCard key={file.name}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-meta tabular-nums mb-1">
                                #{(page - 1) * FILES_PER_PAGE + idx + 1}
                              </p>
                              <button
                                type="button"
                                onClick={() => openBackupDetail(file)}
                                className="text-body font-semibold text-slate-800 text-left break-all"
                              >
                                {file.name}
                              </button>
                              <p className="text-meta mt-1">{formatFileDate(file.created_at)}</p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-label font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border",
                                isAutoBackup(file.name)
                                  ? "bg-slate-50 text-slate-600 border-slate-100"
                                  : "bg-blue-50 text-blue-700 border-blue-100"
                              )}
                            >
                              {isAutoBackup(file.name) ? "Tự động" : "Thủ công"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-meta tabular-nums">{formatFileSize(file.size)}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadBackupFile(file)}
                                className="h-10 w-10 p-0 rounded-[var(--radius-control)]"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void beginCloudRestore(file.url, file.name)}
                                disabled={loading || !canRestore}
                                className="h-10 rounded-[var(--radius-control)] text-label font-semibold"
                              >
                                {canRestore ? "Khôi phục" : <Lock className="h-3.5 w-3.5" />}
                              </Button>
                              {canDelete && onDeleteFile && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPendingDelete(file.name)}
                                  className="h-10 w-10 p-0 rounded-[var(--radius-control)] text-rose-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </ModuleMobileCard>
                      ))}
                    </>
                  }
                />
                <ModulePagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={files.length}
                  itemLabel="file"
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </ModuleSectionCard>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setDetailFile(null)
            setDetailData(null)
            setDetailError(null)
            setDetailRaw("")
          }
        }}
      >
        <DialogContent className={cn(moduleDialogContentClass, "max-w-3xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0")}>
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-title flex items-center gap-2">
              <FileJson className="h-4 w-4 text-blue-600" />
              Chi tiết tệp sao lưu
            </DialogTitle>
            <DialogDescription className="text-meta break-all">{detailFile?.name}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {detailLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-16 rounded-[var(--radius-control)] bg-slate-100 animate-pulse" />
                <div className="h-32 rounded-[var(--radius-control)] bg-slate-100 animate-pulse" />
              </div>
            ) : detailError ? (
              <div className="rounded-[var(--radius-control)] border border-rose-100 bg-rose-50 px-4 py-3 text-body text-rose-700">
                {detailError}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-[var(--radius-control)] border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-meta flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Khách hàng
                    </p>
                    <p className="text-title money tabular-nums mt-0.5">{customers.length}</p>
                  </div>
                  <div className="rounded-[var(--radius-control)] border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-meta flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5" /> Xe
                    </p>
                    <p className="text-title money tabular-nums mt-0.5">{vehicles.length}</p>
                  </div>
                  <div className="rounded-[var(--radius-control)] border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-meta flex items-center gap-1">
                      <ClipboardList className="h-3.5 w-3.5" /> Đơn thuê
                    </p>
                    <p className="text-title money tabular-nums mt-0.5">{rentals.length}</p>
                  </div>
                  <div className="rounded-[var(--radius-control)] border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-meta flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Thời điểm
                    </p>
                    <p className="text-label font-semibold text-slate-800 mt-0.5 leading-snug">
                      {backupTimestamp ? formatFileDate(backupTimestamp) : "—"}
                    </p>
                  </div>
                </div>

                {detailFile && (
                  <p className="text-meta">
                    Dung lượng {formatFileSize(detailFile.size)} · tạo trên cloud {formatFileDate(detailFile.created_at)}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <PreviewList
                    title="Khách hàng (mẫu)"
                    empty="Không có khách hàng"
                    items={customers.slice(0, 5).map((item, i) =>
                      pickLabel(item, ["name", "fullName", "phone", "id"], `Khách #${i + 1}`)
                    )}
                    more={Math.max(0, customers.length - 5)}
                  />
                  <PreviewList
                    title="Xe (mẫu)"
                    empty="Không có xe"
                    items={vehicles.slice(0, 5).map((item, i) => {
                      const name = pickLabel(item, ["name", "model", "id"], `Xe #${i + 1}`)
                      const plate = pickLabel(item, ["licensePlate", "license_plate", "bienso"], "")
                      return plate ? `${name} · ${plate}` : name
                    })}
                    more={Math.max(0, vehicles.length - 5)}
                  />
                  <PreviewList
                    title="Đơn thuê (mẫu)"
                    empty="Không có đơn thuê"
                    items={rentals.slice(0, 5).map((item, i) =>
                      pickLabel(item, ["rentalCode", "rental_code", "id", "customerName"], `Đơn #${i + 1}`)
                    )}
                    more={Math.max(0, rentals.length - 5)}
                  />
                </div>

                <div>
                  <p className="text-label mb-2">Nội dung JSON</p>
                  <pre className="max-h-56 overflow-auto rounded-[var(--radius-control)] border border-slate-100 bg-slate-50 text-slate-700 text-meta leading-relaxed p-3 font-mono whitespace-pre-wrap break-all">
                    {detailRaw || "—"}
                  </pre>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t border-slate-100 shrink-0 gap-2">
            {detailFile && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-[var(--radius-control)] border-slate-200"
                  onClick={() => downloadBackupFile(detailFile)}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Tải về
                </Button>
                <Button
                  type="button"
                  className={cn("h-11 rounded-[var(--radius-control)]", ACCENT_BTN_CLASS[accent])}
                  disabled={loading || !canRestore || detailLoading || !!detailError}
                  onClick={() => void beginCloudRestore(detailFile.url, detailFile.name)}
                >
                  Khôi phục từ tệp này
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingRestore}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRestore(null)
            setRestorePreview(null)
            setRestorePreviewError(null)
          }
        }}
      >
        <DialogContent className={cn(moduleDialogContentClass, "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-title text-rose-700">Xác nhận khôi phục</DialogTitle>
            <DialogDescription className="text-body text-slate-600 mt-2">
              Dữ liệu {scopeLabel.toLowerCase()} hiện tại sẽ bị ghi đè hoàn toàn. Không hoàn tác được.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-2">
            <p className="text-body text-slate-700 break-all">
              <span className="text-label">File: </span>
              {pendingRestore?.name}
            </p>
            {restorePreviewLoading ? (
              <p className="text-meta">Đang đọc nội dung tệp…</p>
            ) : restorePreviewError ? (
              <p className="text-body text-rose-700">{restorePreviewError}</p>
            ) : restorePreview ? (
              <ul className="text-body text-slate-700 space-y-1">
                <li>Khách hàng: {restorePreview.customers}</li>
                <li>Xe: {restorePreview.vehicles}</li>
                <li>Đơn thuê: {restorePreview.rentals}</li>
                {restorePreview.timestamp && (
                  <li>Ngày sao lưu: {formatFileDate(restorePreview.timestamp)}</li>
                )}
              </ul>
            ) : null}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[var(--radius-control)] border-slate-200"
              onClick={() => {
                setPendingRestore(null)
                setRestorePreview(null)
                setRestorePreviewError(null)
              }}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className={cn("h-11", moduleDestructiveBtnClass)}
              disabled={loading || restorePreviewLoading || !!restorePreviewError}
              onClick={confirmRestore}
            >
              Khôi phục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className={cn(moduleDialogContentClass, "max-w-sm")}>
          <DialogHeader>
            <DialogTitle className="text-title text-rose-700">Xóa bản sao lưu</DialogTitle>
            <DialogDescription className="text-body text-slate-600 mt-2 break-all">
              Xóa file {pendingDelete}? Hành động này không hoàn tác được.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[var(--radius-control)] border-slate-200"
              onClick={() => setPendingDelete(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className={cn("h-11", moduleDestructiveBtnClass)}
              onClick={() => {
                if (pendingDelete && onDeleteFile) onDeleteFile(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Xóa file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PreviewList({
  title,
  items,
  empty,
  more,
}: {
  title: string
  items: string[]
  empty: string
  more: number
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-100 overflow-hidden">
      <div className="bg-slate-50/80 px-3 py-2 border-b border-slate-100">
        <p className="text-label font-semibold text-slate-700">{title}</p>
      </div>
      <ul className="px-3 py-2 space-y-1.5 min-h-[7rem]">
        {items.length === 0 ? (
          <li className="text-meta">{empty}</li>
        ) : (
          items.map((label, idx) => (
            <li key={`${label}-${idx}`} className="text-body text-slate-700 truncate" title={label}>
              {label}
            </li>
          ))
        )}
        {more > 0 && <li className="text-meta">+{more} mục khác</li>}
      </ul>
    </div>
  )
}
