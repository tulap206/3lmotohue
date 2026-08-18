"use client"

import Image from "next/image"
import { Mail, Phone, ExternalLink } from "lucide-react"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SOFTWARE_ABOUT } from "@/lib/business-info"
import {
  EntityFormDialogContent,
} from "@/components/dashboard/entity-form-dialog"

export function AboutSoftwareDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const year = new Date().getFullYear()
  const zaloHref = `https://zalo.me/${SOFTWARE_ABOUT.phone}`
  const telHref = `tel:${SOFTWARE_ABOUT.phone}`
  const mailHref = `mailto:${SOFTWARE_ABOUT.email}`
  const initial = SOFTWARE_ABOUT.author.trim().charAt(0).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EntityFormDialogContent accent="blue" maxWidth="md">
        <p className="text-label text-blue-700">Giới thiệu</p>
        <div className="mt-3 flex flex-col items-center text-center">
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)]">
            <Image
              src="/logo.jpg"
              alt={`${SOFTWARE_ABOUT.productName} logo`}
              fill
              sizes="112px"
              className="object-contain"
              priority
            />
          </div>
          <DialogTitle className="text-title mt-3 text-pretty">{SOFTWARE_ABOUT.productName}</DialogTitle>
          <DialogDescription className="text-meta mt-1 max-w-[22rem] text-pretty">
            {SOFTWARE_ABOUT.productLine}
          </DialogDescription>
        </div>

        <p className="text-body text-slate-600 leading-relaxed mt-4">
          Bản quyền thuộc tác giả. Sao chép, chỉnh sửa hoặc phân phối khi chưa được phép đều không hợp lệ.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <div className="h-11 w-11 shrink-0 rounded-[var(--radius-badge)] bg-white border border-slate-200 flex items-center justify-center text-body font-semibold text-slate-700">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-label text-slate-500">Tác giả</p>
            <p className="text-body font-semibold text-slate-900 truncate">{SOFTWARE_ABOUT.author}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href={mailHref}
            className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 ui-transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <Mail className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="min-w-0">
              <span className="text-label text-slate-500 block">Email</span>
              <span className="text-body font-medium text-slate-800 break-all">{SOFTWARE_ABOUT.email}</span>
            </span>
          </a>
          <a
            href={telHref}
            className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 ui-transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <Phone className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="min-w-0">
              <span className="text-label text-slate-500 block">Điện thoại</span>
              <span className="text-body font-medium tabular-nums text-slate-800">{SOFTWARE_ABOUT.phoneDisplay}</span>
            </span>
          </a>
        </div>

        <a
          href={zaloHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 text-body font-semibold text-slate-700 ui-transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          Mở Zalo
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>

        <p className="text-meta text-slate-400 mt-4">
          © {year} {SOFTWARE_ABOUT.productName}. Giữ toàn bộ quyền.
        </p>

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-4 flex border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full sm:w-auto sm:ml-auto bg-blue-600 hover:bg-blue-700 !text-white rounded-[var(--radius-control)] font-semibold"
          >
            Đóng
          </Button>
        </div>
      </EntityFormDialogContent>
    </Dialog>
  )
}
