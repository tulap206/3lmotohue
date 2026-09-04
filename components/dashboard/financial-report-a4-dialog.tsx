"use client"

import React, { useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QUY79_BUSINESS } from "@/lib/business-info"
import { Printer, Download, X, Building2, TrendingUp, DollarSign, Wallet, Users, Bike, CheckCircle2, ShieldCheck } from "lucide-react"
import { isSalaryTransaction, isDividendTransaction, isCapitalTransaction } from "@/lib/transaction-finance"
import type { Transaction } from "@/lib/supabase"
import type { CommissionHomeRow } from "@/lib/commission-home"

interface ReportData {
  totalCustomers: number
  totalVehicles: number
  totalRentals: number
  totalRevenue: number
  totalProfit: number
  activeRentals: number
  vehiclesInMaintenance: number
  monthlyRevenue: Array<{ month: string; revenue: number }>
  commissionHomeTotal: number
  commissionByHome: CommissionHomeRow[]
  commissionHomeTotalAll: number
  commissionByHomeAll: CommissionHomeRow[]
  fleetPerformance: Array<{ name: string; licensePlate: string; activeDays: number; revenue: number; utilizationRate: number }>
  expenseStructure: Array<{ name: string; value: number }>
}

interface FinancialReportA4DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportData: ReportData
  transactions: Transaction[]
  periodLabel: string
  onExportCsv?: () => void
}

export function FinancialReportA4Dialog({
  open,
  onOpenChange,
  reportData,
  transactions,
  periodLabel,
  onExportCsv,
}: FinancialReportA4DialogProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const formatMoney = (amount: number) => {
    return `${Math.round(amount || 0).toLocaleString("vi-VN")} đ`
  }

  // Calculations
  const salaryExpenses = transactions
    .filter(isSalaryTransaction)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)

  const dividendExpenses = transactions
    .filter(isDividendTransaction)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)

  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)

  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)

  let maintenanceExp = 0
  let fuelExp = 0
  let capitalExp = 0
  let otherOperatingExp = 0

  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const desc = (tx.description || "").toLowerCase()
      if (isDividendTransaction(tx)) {
        // Dividend
      } else if (isSalaryTransaction(tx)) {
        // Salary
      } else if (isCapitalTransaction(tx)) {
        capitalExp += tx.amount || 0
      } else if (/(sửa|nhông|xích|nhớt|vỏ|ruột|phanh|bình|acquy|bảo dưỡng|thay thế)/i.test(desc)) {
        maintenanceExp += tx.amount || 0
      } else if (/(grab|xăng|xe\s*ôm|vận\s*chuyển|giao xe)/i.test(desc)) {
        fuelExp += tx.amount || 0
      } else {
        otherOperatingExp += tx.amount || 0
      }
    })

  const rentalOnly =
    reportData.totalRevenue -
    transactions
      .filter((tx) => tx.type === "income" && !isCapitalTransaction(tx))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

  const cashOnHand = rentalOnly + totalIncome - totalExpense
  const totalOperatingExpenses = salaryExpenses + maintenanceExp + fuelExp + otherOperatingExp

  const partnerShareTotal = reportData.totalProfit > 0 ? Math.floor(reportData.totalProfit / 2) : 0
  const partnerDividendPerPerson = Math.floor(dividendExpenses / 2)
  const remainingToDistribute = reportData.totalProfit - dividendExpenses
  const partnerShareRemaining = remainingToDistribute > 0 ? Math.floor(remainingToDistribute / 2) : 0

  const handlePrint = () => {
    window.print()
  }

  const currentDateStr = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const currentTimeStr = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })
  const reportCode = `BC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-[96vw] max-h-[92vh] overflow-y-auto p-0 bg-slate-100 border-slate-300 rounded-[var(--radius-container)] shadow-2xl flex flex-col"
      >
        {/* Modal Top Actions Toolbar (Hidden on Print) */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shadow-md print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm tracking-wide text-white">Xem trước Báo cáo A4</h3>
              <p className="text-xs text-slate-400">Định dạng chuẩn in ấn & lưu trữ hồ sơ tài chính</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExportCsv && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExportCsv}
                className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
                Tải CSV
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              In báo cáo / Lưu PDF
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Printable A4 Paper Container */}
        <div className="p-4 sm:p-8 flex justify-center bg-slate-100/90 print:p-0 print:bg-white">
          <div
            id="financial-report-a4-page"
            ref={printRef}
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-10 shadow-lg border border-slate-200 print:border-0 print:shadow-none print:p-0 print:m-0 print:w-full"
          >
            {/* 1. Header Section */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white font-black text-xs px-2 py-0.5 rounded tracking-widest">
                      3L MOTO
                    </span>
                    <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                      {QUY79_BUSINESS.brandName} HUẾ
                    </h1>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {QUY79_BUSINESS.branches[0]}
                  </p>
                  <p className="text-xs text-slate-600">
                    Hotline: <span className="font-semibold text-slate-800">{QUY79_BUSINESS.hotline}</span> | Website: <span className="font-semibold text-blue-700">{QUY79_BUSINESS.website}</span>
                  </p>
                </div>
                <div className="text-left sm:text-right border-l-2 sm:border-l-0 pl-3 sm:pl-0 border-blue-600">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    Hệ thống Quản trị & Kế toán
                  </span>
                  <h2 className="text-base font-extrabold uppercase text-slate-900 mt-1 tracking-tight">
                    BÁO CÁO TÀI CHÍNH & VẬN HÀNH
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Kỳ báo cáo: <span className="font-bold text-slate-900">{periodLabel}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Mã BC: {reportCode} • Lập lúc: {currentTimeStr} {currentDateStr}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Key Operational & Financial Summary Cards (Section I) */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  I. Tổng quan Chỉ số Hoạt động Cốt lõi
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Quy mô xe & Đơn</div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {reportData.totalVehicles} <span className="text-xs font-normal text-slate-500">xe</span> / {reportData.totalRentals} <span className="text-xs font-normal text-slate-500">đơn</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Đang thuê: <span className="font-bold text-blue-600">{reportData.activeRentals}</span> • Bảo dưỡng: <span className="font-bold text-amber-600">{reportData.vehiclesInMaintenance}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/40">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-tight">Doanh thu vận hành</div>
                  <div className="text-base font-black text-blue-900 mt-0.5">
                    {formatMoney(reportData.totalRevenue)}
                  </div>
                  <div className="text-[10px] text-blue-700/80 mt-0.5">
                    Đã trừ {formatMoney(reportData.commissionHomeTotal)} HH Home
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-tight">Lợi nhuận ròng (P&L)</div>
                  <div className="text-base font-black text-emerald-800 mt-0.5">
                    {formatMoney(reportData.totalProfit)}
                  </div>
                  <div className="text-[10px] text-emerald-700/80 mt-0.5">
                    Hiệu quả sau toàn bộ chi phí
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Tiền mặt tồn quỹ</div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {formatMoney(cashOnHand)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Số dư khả dụng thực tế
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Section II: P&L Statement */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  II. Báo cáo Kết quả Hoạt động Kinh doanh (P&L Vận hành)
                </h3>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="p-2 pl-3">STT</th>
                      <th className="p-2">Hạng mục Doanh thu & Chi phí</th>
                      <th className="p-2 text-right">Số tiền (VNĐ)</th>
                      <th className="p-2 pr-3 text-slate-500">Ghi chú nghiệp vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-blue-50/30 font-semibold text-slate-900">
                      <td className="p-2 pl-3 text-blue-700">1</td>
                      <td className="p-2 text-blue-900 font-bold">Tổng doanh thu thuê xe thực tế (A)</td>
                      <td className="p-2 text-right text-blue-800 font-bold">{formatMoney(reportData.totalRevenue)}</td>
                      <td className="p-2 pr-3 text-slate-600">Đã chiết khấu hoa hồng đối tác Homestay</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-3 text-slate-400">1.1</td>
                      <td className="p-2 pl-6 text-slate-600">Chiết khấu hoa hồng đối tác Homestay</td>
                      <td className="p-2 text-right text-amber-700 font-medium">-{formatMoney(reportData.commissionHomeTotal)}</td>
                      <td className="p-2 pr-3 text-slate-500">Giảm trừ doanh thu trực tiếp cho {reportData.commissionByHome.length} đối tác</td>
                    </tr>
                    <tr className="font-semibold text-slate-800 bg-slate-50/50">
                      <td className="p-2 pl-3 text-slate-700">2</td>
                      <td className="p-2 font-bold">Tổng chi phí vận hành trong kỳ (B)</td>
                      <td className="p-2 text-right text-rose-700 font-bold">-{formatMoney(totalOperatingExpenses)}</td>
                      <td className="p-2 pr-3 text-slate-600">Chi phí nhân sự & vận hành trực tiếp</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 pl-3 text-slate-400">2.1</td>
                      <td className="p-1.5 pl-6 text-slate-600">Chi phí lương nhân viên & cộng tác viên</td>
                      <td className="p-1.5 text-right text-slate-800">-{formatMoney(salaryExpenses)}</td>
                      <td className="p-1.5 pr-3 text-slate-500">Lương cố định & thưởng theo ca</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 pl-3 text-slate-400">2.2</td>
                      <td className="p-1.5 pl-6 text-slate-600">Chi phí sửa xe, bảo dưỡng, thay thế phụ tùng</td>
                      <td className="p-1.5 text-right text-slate-800">-{formatMoney(maintenanceExp)}</td>
                      <td className="p-1.5 pr-3 text-slate-500">Nhớt, nhông xích, phanh, lốp, acquy, phụ tùng</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 pl-3 text-slate-400">2.3</td>
                      <td className="p-1.5 pl-6 text-slate-600">Chi phí xăng xe, di chuyển, giao nhận xe</td>
                      <td className="p-1.5 text-right text-slate-800">-{formatMoney(fuelExp)}</td>
                      <td className="p-1.5 pr-3 text-slate-500">Xăng, giao xe tận nơi cho khách</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 pl-3 text-slate-400">2.4</td>
                      <td className="p-1.5 pl-6 text-slate-600">Chi phí vận hành & quản lý khác</td>
                      <td className="p-1.5 text-right text-slate-800">-{formatMoney(otherOperatingExp)}</td>
                      <td className="p-1.5 pr-3 text-slate-500">Vật tư, chi phí phát sinh nhỏ</td>
                    </tr>
                    <tr className="bg-emerald-50/80 font-bold text-slate-900 border-t-2 border-emerald-200 text-[12px]">
                      <td className="p-2.5 pl-3 text-emerald-800">3</td>
                      <td className="p-2.5 text-emerald-950 font-black">LỢI NHUẬN RÒNG HOẠT ĐỘNG (C = A - B)</td>
                      <td className="p-2.5 text-right text-emerald-800 font-black text-sm">{formatMoney(reportData.totalProfit)}</td>
                      <td className="p-2.5 pr-3 text-emerald-900 font-semibold">Căn cứ để phân bổ lợi nhuận cổ đông</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Section III: Shareholder Profit Distribution (50% - 50%) */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    III. Báo cáo Phân chia Lợi nhuận Cổ đông (Cơ cấu 50% - 50%)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Quy chuẩn chia đôi sau khi trừ toàn bộ chi phí</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="p-2 pl-3">Cổ đông / Thành viên</th>
                      <th className="p-2 text-center">Tỷ lệ góp</th>
                      <th className="p-2 text-right">Lợi nhuận được chia</th>
                      <th className="p-2 text-right">Đã tạm ứng / Nhận</th>
                      <th className="p-2 pr-3 text-right">Còn lại thực nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2 pl-3 font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Cổ đông Admin
                      </td>
                      <td className="p-2 text-center font-bold text-slate-700">50.0%</td>
                      <td className="p-2 text-right font-semibold text-slate-900">{formatMoney(partnerShareTotal)}</td>
                      <td className="p-2 text-right text-rose-600 font-medium">-{formatMoney(partnerDividendPerPerson)}</td>
                      <td className="p-2 pr-3 text-right font-black text-emerald-700">{formatMoney(partnerShareRemaining)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2 pl-3 font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Cổ đông Lộc A
                      </td>
                      <td className="p-2 text-center font-bold text-slate-700">50.0%</td>
                      <td className="p-2 text-right font-semibold text-slate-900">{formatMoney(partnerShareTotal)}</td>
                      <td className="p-2 text-right text-rose-600 font-medium">-{formatMoney(partnerDividendPerPerson)}</td>
                      <td className="p-2 pr-3 text-right font-black text-emerald-700">{formatMoney(partnerShareRemaining)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="p-2 pl-3 uppercase">Tổng cộng phân bổ</td>
                      <td className="p-2 text-center">100.0%</td>
                      <td className="p-2 text-right">{formatMoney(reportData.totalProfit)}</td>
                      <td className="p-2 text-right text-rose-700">-{formatMoney(dividendExpenses)}</td>
                      <td className="p-2 pr-3 text-right text-emerald-800 font-black">{formatMoney(remainingToDistribute)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Section IV: Cashflow & Top Performance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* Cashflow Box */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    IV. Dòng tiền & Tồn quỹ Thực tế
                  </h3>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Tổng tiền thu vào (Thuê + Khác):</span>
                    <span className="font-bold text-emerald-700">+{formatMoney(rentalOnly + totalIncome)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Tổng tiền chi ra (Chi phí + Vốn + Cổ tức):</span>
                    <span className="font-bold text-rose-700">-{formatMoney(totalExpense)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cổ tức / Tạm ứng đã chi cổ đông:</span>
                    <span className="font-semibold text-slate-800">-{formatMoney(dividendExpenses)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                    <span className="text-blue-900">Tiền mặt tồn quỹ hiện hữu:</span>
                    <span className="text-sm font-black text-blue-700">{formatMoney(cashOnHand)}</span>
                  </div>
                </div>
              </div>

              {/* Top Homestay Partners Summary */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    V. Top Đối tác Homestay & Hiệu suất Xe
                  </h3>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Đối tác Homestay tiêu biểu:</span>
                    <span className="text-[10px] text-slate-500">{reportData.commissionByHome.length} đối tác</span>
                  </div>
                  {reportData.commissionByHome.slice(0, 3).map((home, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[140px] text-slate-700 font-medium">
                        {idx + 1}. {home.name}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {home.count} đơn • <strong className="text-amber-700">{formatMoney(home.total)}</strong>
                      </span>
                    </div>
                  ))}
                  {reportData.commissionByHome.length === 0 && (
                    <div className="text-[11px] text-slate-400 italic">Chưa có hoa hồng homestay trong kỳ</div>
                  )}

                  <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-700 font-semibold">
                    <span>Top xe doanh thu cao:</span>
                    <span className="text-blue-700">
                      {reportData.fleetPerformance[0]
                        ? `${reportData.fleetPerformance[0].name} (${formatMoney(reportData.fleetPerformance[0].revenue)})`
                        : "Chưa có"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Section VI: Signatures Section */}
            <div className="mt-8 pt-4 border-t border-slate-300">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-800">Người lập biểu</p>
                  <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký & ghi rõ họ tên)</p>
                  <div className="h-16 flex items-end justify-center">
                    <p className="text-xs font-semibold text-slate-700">{QUY79_BUSINESS.operators}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-slate-800">Kế toán / Kiểm soát</p>
                  <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký & ghi rõ họ tên)</p>
                  <div className="h-16 flex items-end justify-center">
                    <p className="text-xs font-semibold text-slate-700">Hệ thống 3L MOTO</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-slate-800">Đại diện cơ sở / Giám đốc</p>
                  <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký, đóng dấu & ghi rõ họ tên)</p>
                  <div className="h-16 flex items-end justify-center">
                    <p className="text-xs font-semibold text-slate-900">{QUY79_BUSINESS.representative}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400">
                Báo cáo tài chính nội bộ được trích xuất tự động từ phần mềm quản lý vận hành 3L MOTO HUẾ ({QUY79_BUSINESS.website}).
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Global Print Styles for Perfect A4 Output */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #financial-report-a4-page,
          #financial-report-a4-page * {
            visibility: visible !important;
          }
          #financial-report-a4-page {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </Dialog>
  )
}
