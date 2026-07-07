"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Building2, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChartEmpty, ChartShell } from "@/components/dashboard/chart-primitives"

const PAGE_SIZE = 10

export type OverdueRentalRow = {
  id: string
  customerName: string
  vehicleName: string
  licensePlate: string
  endDate: string
  daysOver: number
}

export type CommissionHomeRow = {
  name: string
  count: number
  total: number
}

function PanelPagination({
  page,
  totalItems,
  onPageChange,
  accentClass,
}: {
  page: number
  totalItems: number
  onPageChange: (page: number) => void
  accentClass: string
}) {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE)
  if (totalPages <= 1) return null

  const pages: (number | "ellipsis")[] = []
  if (totalPages <= 6) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push("ellipsis")
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push("ellipsis")
    pages.push(totalPages)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100/90 bg-slate-50/40">
      <p className="text-xs text-slate-500 tabular-nums">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} / {totalItems}
      </p>
      <div className="flex items-center gap-1 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 rounded-lg px-2.5 text-xs font-semibold border-slate-200"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
          Trước
        </Button>
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={page === p ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 w-8 rounded-lg p-0 text-xs font-bold",
                page === p ? accentClass : "border-slate-200"
              )}
            >
              {p}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 rounded-lg px-2.5 text-xs font-semibold border-slate-200"
        >
          Sau
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>
    </div>
  )
}

export function OverdueOrdersPanel({
  orders,
}: {
  orders: OverdueRentalRow[]
}) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  const sorted = useMemo(
    () => [...orders].sort((a, b) => b.daysOver - a.daysOver),
    [orders]
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (orders.length === 0) {
    return (
      <ChartShell
        title="Đơn Quá Hạn"
        description="Hợp đồng thuê đã quá ngày trả xe — cần liên hệ khách"
        icon={<AlertTriangle className="w-4 h-4" />}
        accent="rose"
      >
        <ChartEmpty label="Không có đơn quá hạn" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Đơn Quá Hạn"
      description="Hợp đồng thuê đã quá ngày trả xe — cần liên hệ khách"
      icon={<AlertTriangle className="w-4 h-4" />}
      accent="rose"
      headerExtra={
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tổng</p>
          <p className="text-lg font-extrabold text-rose-600 tabular-nums leading-none">{orders.length}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">đơn</p>
        </div>
      }
    >
      <div className="flex flex-col -mx-4 -mb-4 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[320px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10">#</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Khách</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Xe</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Quá hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {slice.map((row, index) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer hover:bg-rose-50/40 transition-colors"
                  onClick={() => router.push(`/dashboard/orders?status=overdue`)}
                >
                  <td className="py-2.5 px-4 text-xs text-slate-400 font-medium tabular-nums">
                    {(safePage - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="py-2.5 px-4 min-w-0">
                    <p className="font-semibold text-slate-800 truncate text-sm">{row.customerName}</p>
                    <p className="text-[11px] text-slate-500 sm:hidden truncate">
                      {row.vehicleName} · {row.licensePlate}
                    </p>
                  </td>
                  <td className="py-2.5 px-4 hidden sm:table-cell min-w-0">
                    <p className="text-slate-700 truncate">{row.vehicleName}</p>
                    <p className="text-[11px] text-slate-400">{row.licensePlate}</p>
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md tabular-nums">
                      {row.daysOver} ngày
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Hạn {row.endDate}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PanelPagination
          page={safePage}
          totalItems={sorted.length}
          onPageChange={setPage}
          accentClass="bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
        />
      </div>
    </ChartShell>
  )
}

export function CommissionHomeReportPanel({
  rows,
  formatPrice,
}: {
  rows: CommissionHomeRow[]
  formatPrice: (n: number) => string
}) {
  const [page, setPage] = useState(1)

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.total - a.total),
    [rows]
  )

  const grandTotal = sorted.reduce((s, r) => s + r.total, 0)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (rows.length === 0) {
    return (
      <ChartShell
        title="Báo Cáo Hoa Hồng Home"
        description="Tổng hoa hồng theo từng Home từ các đơn đang có"
        icon={<Building2 className="w-4 h-4" />}
        accent="amber"
      >
        <ChartEmpty label="Chưa có đơn chia hoa hồng Home" />
      </ChartShell>
    )
  }

  return (
    <ChartShell
      title="Báo Cáo Hoa Hồng Home"
      description="Tổng hoa hồng theo từng Home từ các đơn đang có"
      icon={<Building2 className="w-4 h-4" />}
      accent="amber"
      headerExtra={
        <div className="text-right shrink-0 max-w-[8rem]">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tổng</p>
          <p className="text-sm font-extrabold text-amber-700 tabular-nums leading-tight truncate" title={formatPrice(grandTotal)}>
            {formatPrice(grandTotal)}
          </p>
        </div>
      }
    >
      <div className="flex flex-col -mx-4 -mb-4 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[280px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10">#</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Home</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Đơn</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Hoa hồng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {slice.map((row, index) => {
                const pct = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0
                return (
                  <tr key={row.name} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-2.5 px-4 text-xs text-slate-400 font-medium tabular-nums">
                      {(safePage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="py-2.5 px-4 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{row.name}</p>
                      <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden max-w-[140px]">
                        <div
                          className="h-full rounded-full bg-amber-500/80 transition-all duration-500"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex min-w-[1.75rem] justify-center text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">
                        {row.count}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-amber-700 tabular-nums whitespace-nowrap">
                      {formatPrice(row.total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {sorted.length > PAGE_SIZE && (
          <PanelPagination
            page={safePage}
            totalItems={sorted.length}
            onPageChange={setPage}
            accentClass="bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
          />
        )}
      </div>
    </ChartShell>
  )
}
