"use client"

import { Mail, Phone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SOFTWARE_ABOUT } from "@/lib/business-info"

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden bg-white p-0 rounded-[var(--radius-container)] border-slate-200 max-w-sm max-h-[min(90dvh,calc(100dvh-1rem))]">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600" />

        <DialogHeader className="space-y-0 px-5 pt-6 pb-4 text-left pr-12">
          <p className="text-meta font-semibold tracking-wide text-blue-700">Giới thiệu</p>
          <DialogTitle className="text-title mt-1">{SOFTWARE_ABOUT.productName}</DialogTitle>
          <DialogDescription className="text-meta mt-1.5 text-pretty">
            {SOFTWARE_ABOUT.productLine}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          <p className="text-body text-slate-600 leading-relaxed">
            Bản quyền phần mềm thuộc về tác giả. Mọi sao chép, chỉnh sửa hoặc phân phối khi chưa được cho phép đều không hợp lệ.
          </p>

          <div className="rounded-[var(--radius-container)] border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-3">
            <div>
              <p className="text-label text-slate-500">Tác giả</p>
              <p className="text-body font-semibold text-slate-900 mt-0.5">{SOFTWARE_ABOUT.author}</p>
            </div>
            <div>
              <p className="text-label text-slate-500">Email</p>
              <a
                href={mailHref}
                className="mt-0.5 inline-flex items-center gap-1.5 text-body font-medium text-blue-700 hover:underline break-all"
              >
                <Mail className="w-4 h-4 shrink-0" />
                {SOFTWARE_ABOUT.email}
              </a>
            </div>
            <div>
              <p className="text-label text-slate-500">Điện thoại / Zalo</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <a
                  href={telHref}
                  className="inline-flex items-center gap-1.5 text-body font-medium text-blue-700 hover:underline"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  {SOFTWARE_ABOUT.phoneDisplay}
                </a>
                <a
                  href={zaloHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-meta font-semibold text-slate-600 hover:text-blue-700 hover:underline"
                >
                  Mở Zalo
                </a>
              </div>
            </div>
          </div>

          <p className="text-meta text-slate-400">
            © {year} {SOFTWARE_ABOUT.productName}. Giữ toàn bộ quyền.
          </p>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 !text-white rounded-[var(--radius-control)] font-semibold"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
