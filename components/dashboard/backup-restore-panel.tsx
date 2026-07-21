"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  FileJson,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDisplayDateTime } from "@/lib/format-date"

export type BackupAccent = "red" | "blue" | "amber" | "emerald"

export interface BackupFileItem {
  name: string
  created_at: string
  size: number
  url: string
}

const accentStyles: Record<
  BackupAccent,
  { stripe: string; backupBtn: string; icon: string; ring: string; badge: string }
> = {
  red: {
    stripe: "from-red-400 to-red-600",
    backupBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    icon: "text-blue-600 bg-blue-50",
    ring: "hover:border-red-200",
    badge: "bg-blue-50 text-blue-700",
  },
  blue: {
    stripe: "from-blue-400 to-blue-600",
    backupBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    icon: "text-blue-600 bg-blue-50",
    ring: "hover:border-blue-200",
    badge: "bg-blue-50 text-blue-700",
  },
  amber: {
    stripe: "from-amber-400 to-amber-500",
    backupBtn: "bg-amber-500 hover:bg-amber-600 text-slate-950",
    icon: "text-amber-600 bg-amber-50",
    ring: "hover:border-amber-200",
    badge: "bg-amber-50 text-amber-800",
  },
  emerald: {
    stripe: "from-emerald-400 to-emerald-600",
    backupBtn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    icon: "text-emerald-600 bg-emerald-50",
    ring: "hover:border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700",
  },
}

function formatFileDate(iso: string) {
  return formatDisplayDateTime(iso)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
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
    <div className="rounded-2xl border border-red-100 bg-blue-50/40 p-6 text-center">
      <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-red-500" />
      <h3 className="text-sm font-bold text-red-800">Truy cập bị hạn chế</h3>
      <p className="mt-1 text-sm text-blue-600">Bạn không có quyền sao lưu và khôi phục dữ liệu.</p>
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
  onRestoreUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRestoreFile: (url: string, name: string) => void
  onDeleteFile?: (name: string) => void
  onRefresh: () => void
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const styles = accentStyles[accent]

  return (
    <div className="flex max-h-[calc(100vh-6.5rem)] flex-col gap-3 overflow-hidden">
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", styles.stripe)} />

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-800">Sao lưu & khôi phục</h2>
              <p className="truncate text-sm text-slate-500">{moduleName}</p>
            </div>
          </div>
          <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold sm:inline", styles.badge)}>
            {scopeLabel}
          </span>
        </div>

        {message && (
          <div
            className={cn(
              "mx-4 mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
              message.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-red-100 bg-blue-50 text-red-800"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <p className="line-clamp-2 whitespace-pre-line font-medium leading-relaxed">{message.text}</p>
          </div>
        )}

        <div className="grid min-h-0 grid-cols-1 gap-3 p-4 lg:grid-cols-12">
          <div className="flex flex-col gap-2 lg:col-span-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => canBackup && !loading && onBackup()}
                disabled={loading || !canBackup}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center transition-colors",
                  styles.ring,
                  !canBackup && "cursor-not-allowed opacity-60"
                )}
              >
                <CloudUpload className={cn("h-5 w-5", styles.icon.split(" ")[0])} />
                <span className="text-sm font-bold text-slate-800">Sao lưu</span>
                <span className="text-sm leading-tight text-slate-400">Lên đám mây</span>
              </button>

              <button
                type="button"
                onClick={() => canRestore && uploadRef.current?.click()}
                disabled={loading || !canRestore}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center transition-colors hover:border-emerald-200",
                  !canRestore && "cursor-not-allowed opacity-60"
                )}
              >
                <Upload className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-800">
                  {canRestore ? "Khôi phục" : "Chỉ Admin"}
                </span>
                <span className="text-sm leading-tight text-slate-400">Từ file JSON</span>
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={onRestoreUpload}
                disabled={loading || !canRestore}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onBackup}
                disabled={loading || !canBackup}
                className={cn("h-8 flex-1 rounded-lg text-sm font-semibold", styles.backupBtn)}
              >
                {loading ? "Đang xử lý..." : "Thực hiện sao lưu"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => uploadRef.current?.click()}
                disabled={loading || !canRestore}
                className="h-8 flex-1 rounded-lg border-emerald-200 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Chọn file
              </Button>
            </div>

            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-2 text-sm leading-relaxed text-amber-800">
              Khôi phục sẽ ghi đè toàn bộ dữ liệu {scopeLabel.toLowerCase()} hiện tại. Kiểm tra kỹ trước khi xác nhận.
            </p>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-100 lg:col-span-8">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">Bản sao lưu trên đám mây</p>
                <p className="truncate text-sm text-slate-400">
                  {fileHint || "Các file JSON lưu trên Supabase Storage"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-md bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-500 tabular-nums">
                  {files.length} file
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRefresh}
                  disabled={filesLoading}
                  className="h-7 w-7 rounded-lg p-0"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", filesLoading && "animate-spin")} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {filesLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải...
                </div>
              ) : files.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-slate-400">
                  <FileJson className="h-6 w-6 text-slate-300" />
                  Chưa có bản sao lưu
                </div>
              ) : (
                <div className="max-h-[min(340px,calc(100vh-16rem))] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-white text-sm font-semibold uppercase tracking-wide text-slate-400">
                      <tr className="border-b border-slate-100">
                        <th className="px-3 py-2 font-semibold">Tên file</th>
                        <th className="hidden px-2 py-2 font-semibold sm:table-cell">Thời gian</th>
                        <th className="px-2 py-2 text-right font-semibold">Size</th>
                        <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr
                          key={file.name}
                          className="border-b border-slate-50 transition-colors hover:bg-slate-50/80"
                        >
                          <td className="max-w-[140px] truncate px-3 py-2 font-medium text-slate-800 sm:max-w-[220px]" title={file.name}>
                            {file.name}
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2 text-slate-500 sm:table-cell">
                            {formatFileDate(file.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-500">
                            {formatFileSize(file.size)}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadBackupFile(file)}
                                disabled={loading}
                                className="h-7 w-7 rounded-md p-0 text-slate-500 hover:text-blue-600"
                                title="Tải về"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onRestoreFile(file.url, file.name)}
                                disabled={loading || !canRestore}
                                className="h-7 rounded-md px-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:text-slate-300"
                              >
                                {canRestore ? "Khôi phục" : "🔒"}
                              </Button>
                              {canDelete && onDeleteFile && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDeleteFile(file.name)}
                                  disabled={loading}
                                  className="h-7 w-7 rounded-md p-0 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                  title="Xóa file"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
