"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { supabase, fetchTransactions, fetchUserDisplayNames, getUserDisplayName, insertTransaction, deleteTransaction, updateTransaction, Transaction } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { formatMoneyInput, parseMoneyInput } from "@/lib/format-money"
import { calcOperatingProfit, calcOperatingRevenue, isCapitalTransaction, withCapitalTag, isSalaryTransaction, isDividendTransaction } from "@/lib/transaction-finance"
import { buildCommissionHomeReport, sumCommissionRows, type CommissionHomeRow } from "@/lib/commission-home"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  EntityFormDialogContent,
  EntityFormHeader,
  EntityFormBody,
  EntityFormFooter,
  EntityFormField,
  EntityFormToggle,
  entityFormInputClass,
} from "@/components/dashboard/entity-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { showSuccess, showError } from "@/lib/toast-utils"
import { TrendingUp, Bike, Users, ClipboardList, DollarSign, Wallet, Plus, Trash2, Edit2, Search, X, Home, Building2, Eye, Car, RefreshCw, Coins } from "lucide-react"
import { cn } from "@/lib/utils"
import { rentalTableHeadClass, RentalKpiCard } from "@/components/dashboard/rental-ui"
import { formatDisplayDate } from "@/lib/format-date"
import { ModulePagination, ModulePageShell, ModuleResponsiveTable, ModuleMobileCard, ModuleEmptyState, ModuleKpiGrid, ModuleSectionCard } from "@/components/dashboard/module-shell"
import { MonthlyRevenueChart, ExpenseStructureChart } from "@/components/dashboard/rental-charts"
import { FinancialReportA4Dialog } from "@/components/dashboard/financial-report-a4-dialog"

interface ReportData {
  totalCustomers: number
  totalVehicles: number
  totalRentals: number
  totalRevenue: number
  totalProfit: number
  activeRentals: number
  vehiclesInMaintenance: number
  monthlyRevenue: Array<{ month: string; revenue: number }>
  /** Tổng HH Home đã trừ trong DT (đơn completed) */
  commissionHomeTotal: number
  commissionByHome: CommissionHomeRow[]
  commissionHomeTotalAll: number
  commissionByHomeAll: CommissionHomeRow[]
  fleetPerformance: Array<{ name: string; licensePlate: string; activeDays: number; revenue: number; utilizationRate: number }>
  expenseStructure: Array<{ name: string; value: number }>
}

export default function ReportsPage() {
  const router = useRouter()
  const { addAccessLog, user } = useAuth()
  
  // Date range filters
  const [filterPeriod, setFilterPeriod] = useState<"all" | "this-month" | "last-month" | "this-year" | "custom">("all")
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA')
  })

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  const [fleetPage, setFleetPage] = useState(1)
  const fleetItemsPerPage = 10

  // Commission Table State
  const [commissionSearchQuery, setCommissionSearchQuery] = useState("")
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<"completed" | "all">("completed")
  const [commissionPage, setCommissionPage] = useState(1)
  const [selectedHomeForDetail, setSelectedHomeForDetail] = useState<CommissionHomeRow | null>(null)
  const commissionItemsPerPage = 5

  const [isA4PreviewOpen, setIsA4PreviewOpen] = useState(false)
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
    isCapital: false,
    timestamp: new Date().toLocaleDateString('en-CA'),
  })
  const [editFormData, setEditFormData] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
    isCapital: false,
    timestamp: "",
  })

  const loadTransactions = async (resetPage = true) => {
    try {
      const [data, displayNames] = await Promise.all([fetchTransactions(), fetchUserDisplayNames()])
      setTransactions(data)
      setUserDisplayNames(displayNames)
      if (resetPage) setCurrentPage(1) // Reset to first page only when requested
      console.log("✅ Loaded transactions from Supabase:", data.length)
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
      setTransactions([])
    }
  }

  const handleExportReport = () => {
    if (!reportData) {
      showError("Chưa có dữ liệu báo cáo để xuất")
      return
    }

    try {
      const periodLabel = filterPeriod === "this-month"
        ? "Tháng này"
        : filterPeriod === "last-month"
        ? "Tháng trước"
        : filterPeriod === "this-year"
        ? "Năm nay"
        : filterPeriod === "custom"
        ? `Từ ${startDate} đến ${endDate}`
        : "Tất cả thời gian"

      const salaryExpenses = transactions
        .filter(isSalaryTransaction)
        .reduce((sum, tx) => sum + tx.amount, 0)
      const dividendExpenses = transactions
        .filter(isDividendTransaction)
        .reduce((sum, tx) => sum + tx.amount, 0)
      const totalIncome = transactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0)
      const totalExpense = transactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)
      const rentalOnly = reportData.totalRevenue - transactions
        .filter((tx) => tx.type === 'income' && !isCapitalTransaction(tx))
        .reduce((sum, tx) => sum + tx.amount, 0)
      const cashOnHand = rentalOnly + totalIncome - totalExpense
      const operatingProfitBeforeSalary = reportData.totalProfit + salaryExpenses
      const partnerShareTotal = reportData.totalProfit > 0 ? Math.floor(reportData.totalProfit / 2) : 0
      const remainingToDistribute = reportData.totalProfit - dividendExpenses
      const partnerShareRemaining = remainingToDistribute > 0 ? Math.floor(remainingToDistribute / 2) : 0

      const rows: string[][] = [
        ["BÁO CÁO TÀI CHÍNH & VẬN HÀNH - 3L MOTOHUE"],
        [`Kỳ báo cáo: ${periodLabel}`],
        [`Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`],
        [],
        ["1. CHỈ SỐ HOẠT ĐỘNG CHỦ CHỐT"],
        ["Chỉ số", "Giá trị"],
        ["Tổng xe trong hệ thống", `${reportData.totalVehicles} xe`],
        ["Tổng khách hàng", `${reportData.totalCustomers} khách`],
        ["Tổng đơn thuê", `${reportData.totalRentals} đơn`],
        ["Doanh thu thuê xe", `${reportData.totalRevenue.toLocaleString("vi-VN")} đ`],
        ["Lợi nhuận ròng vận hành", `${reportData.totalProfit.toLocaleString("vi-VN")} đ`],
        [],
        ["2. HIỆU QUẢ KINH DOANH (P&L VẬN HÀNH)"],
        ["Hạng mục", "Số tiền (VNĐ)", "Ghi chú"],
        ["Doanh thu thuê xe", `${reportData.totalRevenue.toLocaleString("vi-VN")} đ`, "Đã trừ hoa hồng Homestay"],
        ["Chiết khấu hoa hồng Homestay", `-${reportData.commissionHomeTotal.toLocaleString("vi-VN")} đ`, "Chiết khấu cho đối tác"],
        ["LN vận hành (trước lương)", `${operatingProfitBeforeSalary.toLocaleString("vi-VN")} đ`, "Doanh thu trừ hoa hồng"],
        ["Tổng chi lương nhân viên", `-${salaryExpenses.toLocaleString("vi-VN")} đ`, "Chi phí nhân sự"],
        ["Lợi nhuận ròng vận hành", `${reportData.totalProfit.toLocaleString("vi-VN")} đ`, "Lợi nhuận thực tế sau chi phí"],
        [],
        ["3. DÒNG TIỀN THỰC TẾ & QUỸ TIỀN MẶT"],
        ["Hạng mục", "Số tiền (VNĐ)", "Ghi chú"],
        ["Tổng tiền thu vào (gồm cả vốn)", `+${(rentalOnly + totalIncome).toLocaleString("vi-VN")} đ`, "Tiền thực thu"],
        ["Tổng tiền chi ra (gồm cả lương/vốn)", `-${totalExpense.toLocaleString("vi-VN")} đ`, "Tiền thực chi"],
        ["Cổ tức đã chia", `-${dividendExpenses.toLocaleString("vi-VN")} đ`, "Đã tạm ứng cho cổ đông"],
        ["Tiền mặt tồn quỹ hiện có", `${cashOnHand.toLocaleString("vi-VN")} đ`, "Số dư khả dụng"],
        [],
        ["4. PHÂN CHIA CỔ ĐÔNG (50% - 50%)"],
        ["Cổ đông", "Tỷ lệ", "Lợi nhuận được chia", "Đã nhận kỳ này", "Còn lại cần chi"],
        ["Cổ đông Admin", "50%", `${partnerShareTotal.toLocaleString("vi-VN")} đ`, `-${Math.floor(dividendExpenses / 2).toLocaleString("vi-VN")} đ`, `${partnerShareRemaining.toLocaleString("vi-VN")} đ`],
        ["Cổ đông Lộc A", "50%", `${partnerShareTotal.toLocaleString("vi-VN")} đ`, `-${Math.floor(dividendExpenses / 2).toLocaleString("vi-VN")} đ`, `${partnerShareRemaining.toLocaleString("vi-VN")} đ`],
        ["Tổng cộng", "100%", `${reportData.totalProfit.toLocaleString("vi-VN")} đ`, `-${dividendExpenses.toLocaleString("vi-VN")} đ`, `${remainingToDistribute.toLocaleString("vi-VN")} đ`],
        [],
        ["5. BÁO CÁO HOA HỒNG HOMESTAY"],
        ["Tên Homestay", "Số đơn thuê", "Tổng hoa hồng (VNĐ)"],
        ...reportData.commissionByHome.map(h => [h.name, `${h.count}`, `${h.total.toLocaleString("vi-VN")} đ`]),
        [],
        ["6. HIỆU SUẤT ĐỘI XE"],
        ["Tên xe", "Biển số", "Số ngày chạy", "Doanh thu (VNĐ)", "Tỷ lệ sử dụng"],
        ...reportData.fleetPerformance.map(v => [v.name, v.licensePlate, `${v.activeDays} ngày`, `${v.revenue.toLocaleString("vi-VN")} đ`, `${v.utilizationRate}%`]),
      ]

      const csvContent = "\uFEFF" + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `Bao-cao-3LMotoHue-${new Date().toISOString().split("T")[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showSuccess("Xuất báo cáo thành công!")
    } catch (err) {
      console.error("Export error:", err)
      showError("Có lỗi xảy ra khi xuất báo cáo")
    }
  }

  useEffect(() => {
    loadReportData(true)
    loadTransactions(true)

    // Subscribe to real-time events for reports/transactions
    const reportsChannel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        loadReportData(false)
        loadTransactions(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(reportsChannel)
    }
  }, [])

  useEffect(() => {
    setFleetPage(1)
    loadReportData(false)
  }, [filterPeriod, startDate, endDate])

  // Pagination calculations with search filter
  const filteredTransactions = transactions.filter((tx) => {
    const query = searchQuery.toLowerCase()
    return (
      tx.description.toLowerCase().includes(query) ||
      getUserDisplayName(tx.user, userDisplayNames).toLowerCase().includes(query) ||
      (tx.user || "").toLowerCase().includes(query) ||
      tx.amount.toString().includes(query) ||
      tx.type.toLowerCase().includes(query)
    )
  })

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  // Commission calculations
  const activeCommissionRows = useMemo(() => {
    if (!reportData) return []
    const baseRows = commissionStatusFilter === "completed" 
      ? (reportData.commissionByHome || [])
      : (reportData.commissionByHomeAll || [])
    
    const q = commissionSearchQuery.toLowerCase().trim()
    if (!q) return baseRows
    return baseRows.filter((row) => row.name.toLowerCase().includes(q))
  }, [reportData, commissionStatusFilter, commissionSearchQuery])

  const totalCommissionPages = Math.max(1, Math.ceil(activeCommissionRows.length / commissionItemsPerPage))
  const safeCommissionPage = Math.min(commissionPage, totalCommissionPages)
  const paginatedCommissionRows = activeCommissionRows.slice(
    (safeCommissionPage - 1) * commissionItemsPerPage,
    safeCommissionPage * commissionItemsPerPage
  )

  const commissionTotals = useMemo(() => {
    return {
      homes: activeCommissionRows.length,
      orders: activeCommissionRows.reduce((sum, r) => sum + r.count, 0),
      days: activeCommissionRows.reduce((sum, r) => sum + r.totalDays, 0),
      amount: activeCommissionRows.reduce((sum, r) => sum + r.total, 0),
    }
  }, [activeCommissionRows])

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("📝 Adding transaction:", formData)
    
    if (!formData.description) {
      return
    }
    if (!formData.amount) {
      return
    }
    if (!user) {
      return
    }

    try {
       const newTransaction = await insertTransaction({
        type: formData.type,
        description: withCapitalTag(formData.description, formData.isCapital),
        amount: parseMoneyInput(formData.amount),
        user: user.username,
        timestamp: formData.timestamp ? new Date(formData.timestamp + "T12:00:00").toISOString() : new Date().toISOString(),
      })
      
      console.log("✅ Transaction saved to Supabase:", newTransaction)
      
      setTransactions([newTransaction, ...transactions])
      setFormData({ type: "income", description: "", amount: "", isCapital: false, timestamp: new Date().toLocaleDateString('en-CA') })
      setIsAddTransactionOpen(false)
      
      // Log action if user exists
      if (user?.username) {
        try {
          const parsedAmount = parseMoneyInput(formData.amount)
          const desc = withCapitalTag(formData.description, formData.isCapital)
          logger.addTransaction(user.username, user.displayName, formData.type, desc, parsedAmount)
        } catch (logError) {
          console.error("Warning: Could not log action", logError)
        }
      }
    } catch (error) {
      console.error("❌ Error adding transaction:", error)
    }
  }

  const handleDeleteTransaction = (tx: Transaction) => {
    // Only admin can delete
    if (user?.role !== 'admin') {
      alert('❌ Chỉ admin có quyền xoá khoản thu/chi')
      return
    }
    setTransactionToDelete(tx)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return
    
    try {
      await deleteTransaction(transactionToDelete.id)
      
      // Reload transactions from Supabase
      await loadTransactions()
      
      setDeleteConfirmOpen(false)
      if (user?.username) {
        logger.deleteTransaction(
          user.username,
          user.displayName,
          transactionToDelete.type as "income" | "expense",
          transactionToDelete.description,
          transactionToDelete.amount
        )
      }
      setTransactionToDelete(null)
    } catch (error) {
      console.error("Error deleting transaction:", error)
    }
  }

  const handleEditTransaction = (tx: Transaction) => {
    // Only admin can edit
    if (user?.role !== 'admin') {
      alert('❌ Chỉ admin có quyền sửa khoản thu/chi')
      return
    }
    setEditingTransaction(tx)
    setEditFormData({
      type: tx.type,
      description: (tx.description || "").replace(/^\s*\[vốn\]\s*/i, ""),
      amount: tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      isCapital: isCapitalTransaction(tx),
      timestamp: new Date(tx.timestamp || tx.created_at || new Date()).toLocaleDateString('en-CA'),
    })
    setIsEditTransactionOpen(true)
  }

  const handleConfirmEdit = async () => {
    if (!editingTransaction || !editFormData.description || !editFormData.amount) {
      console.error("❌ Validation failed:", { editingTransaction, editFormData })
      return
    }
    
    const parsedAmount = parseMoneyInput(editFormData.amount)
    const nextDescription = withCapitalTag(editFormData.description, editFormData.isCapital)
    
    console.log("📝 Updating transaction:", editingTransaction.id, {
      type: editFormData.type,
      description: nextDescription,
      amount: parsedAmount,
    })
    
    try {
      const updatedTxData = {
        type: editFormData.type as "income" | "expense",
        description: nextDescription,
        amount: parsedAmount,
        timestamp: editFormData.timestamp ? new Date(editFormData.timestamp + "T12:00:00").toISOString() : editingTransaction.timestamp,
      }
      await updateTransaction(editingTransaction.id, updatedTxData)
      
      // Reload transactions from Supabase
      await loadTransactions()
      
      setIsEditTransactionOpen(false)
      if (user?.username) {
        logger.editTransactionWithDiff(user.username, user.displayName, editingTransaction, {
          ...editingTransaction,
          ...updatedTxData,
        })
      }
      setEditingTransaction(null)
      
      console.log("✅ Edit completed successfully")
    } catch (error) {
      console.error("❌ Error updating transaction:", error)
    }
  }

  const loadReportData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      console.log("📊 Loading report data...")

      // Fetch from Supabase
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
      
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("*")
      
      const { data: rentalsData, error: rentalsError } = await supabase
        .from("rentals")
        .select("*")

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")

      // Handle errors
      if (customersError) console.error("Customers error:", customersError)
      if (vehiclesError) console.error("Vehicles error:", vehiclesError)
      if (rentalsError) console.error("Rentals error:", rentalsError)
      if (transactionsError) console.error("Transactions error:", transactionsError)

      const customers = customersData || []
      const vehicles = vehiclesData || []
      const rentals = rentalsData || []
      const fetchedTransactions = transactionsData || []

      console.log("📊 Fetched data:", {
        customers: customers.length,
        vehicles: vehicles.length,
        rentals: rentals.length,
        transactions: fetchedTransactions.length,
      })

      // Calculate date ranges
      const getPeriodDateRange = (period: string, customStart: string, customEnd: string) => {
        const now = new Date()
        let start = new Date(0)
        let end = new Date(2100, 0, 1)

        if (period === "this-month") {
          start = new Date(now.getFullYear(), now.getMonth(), 1)
          start.setHours(0, 0, 0, 0)
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          end.setHours(23, 59, 59, 999)
        } else if (period === "last-month") {
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          start.setHours(0, 0, 0, 0)
          end = new Date(now.getFullYear(), now.getMonth(), 0)
          end.setHours(23, 59, 59, 999)
        } else if (period === "this-year") {
          start = new Date(now.getFullYear(), 0, 1)
          start.setHours(0, 0, 0, 0)
          end = new Date(now.getFullYear(), 11, 31)
          end.setHours(23, 59, 59, 999)
        } else if (period === "custom") {
          if (customStart) {
            start = new Date(customStart + "T00:00:00")
          }
          if (customEnd) {
            end = new Date(customEnd + "T23:59:59")
          }
        }
        return { start, end }
      }

      // Helper to parse DD/MM/YYYY format
      const parseVietnamDate = (dateStr: string): Date => {
        if (!dateStr) return new Date(0)
        const parts = dateStr.split("/")
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      }

      const { start, end } = getPeriodDateRange(filterPeriod, startDate, endDate)

      // Cửa sổ lấp đầy: không dùng 1970→2100 (lọc "Tất cả") vì mẫu số quá lớn → luôn ra 0%.
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)
      let utilStart = new Date(start)
      let utilEnd = end > todayEnd ? new Date(todayEnd) : new Date(end)
      if (filterPeriod === "all") {
        let earliest: Date | null = null
        for (const r of rentals as any[]) {
          const d = parseVietnamDate(r.startDate || r.start_date)
          if (!Number.isNaN(d.getTime()) && d.getTime() > 0) {
            if (!earliest || d < earliest) earliest = d
          }
        }
        utilStart = earliest ? new Date(earliest) : new Date(todayEnd)
        utilStart.setHours(0, 0, 0, 0)
        utilEnd = new Date(todayEnd)
      }
      const msPerDay = 1000 * 60 * 60 * 24
      const totalDaysInPeriod = Math.max(
        1,
        Math.round((utilEnd.getTime() - utilStart.getTime()) / msPerDay) + 1
      )

      // Filter rentals & transactions in this period
      const filteredRentals = rentals.filter((r: any) => {
        const rDate = parseVietnamDate(r.endDate || r.startDate)
        return rDate >= start && rDate <= end
      })

      const filteredTx = fetchedTransactions.filter((tx: any) => {
        const txDate = new Date(tx.timestamp || tx.created_at || "")
        return txDate >= start && txDate <= end
      })

      // Calculate statistics
      const totalCustomers = customers.length || 0
      const totalVehicles = vehicles.length || 0
      const totalRentals = filteredRentals.length || 0

      // Rental revenue (completed orders; prefer revenue field)
      const rentalRevenue = filteredRentals
        .filter((r: any) => r.status === "completed")
        .reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)
      
      // P&L vận hành: bỏ qua góp vốn / mua xe
      const totalRevenue = calcOperatingRevenue(rentalRevenue, filteredTx)
      const totalProfit = calcOperatingProfit(rentalRevenue, filteredTx)
      
      const totalIncomeFromTransactions = filteredTx
        .filter((tx: any) => tx.type === 'income')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      const totalExpenseFromTransactions = filteredTx
        .filter((tx: any) => tx.type === 'expense')
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
      
      // Active rentals = pending status
      const activeRentals = rentals.filter((r: any) => r.status === "pending").length
      
      // Vehicles in maintenance
      const vehiclesInMaintenance = vehicles.filter((v: any) => v.status === "maintenance").length

      console.log("💰 Calculations:", { 
        rentalRevenue, 
        totalIncomeFromTransactions,
        totalExpenseFromTransactions,
        totalRevenue, 
        totalProfit, 
        activeRentals, 
        totalCustomers, 
        totalVehicles, 
        totalRentals 
      })

      // Monthly data
      const monthlyData: Record<string, number> = {}
      
      filteredRentals.forEach((rental: any) => {
        if (rental.status !== "completed") return
        const dateStr = rental.endDate || rental.startDate
        if (!dateStr) return
        const date = parseVietnamDate(dateStr)
        if (isNaN(date.getTime())) return
        const monthKey = `T${date.getMonth() + 1}`
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (rental.revenue || rental.totalPrice || 0)
      })

      const monthlyRevenue = [
        { month: "T1", revenue: monthlyData["T1"] || 0 },
        { month: "T2", revenue: monthlyData["T2"] || 0 },
        { month: "T3", revenue: monthlyData["T3"] || 0 },
        { month: "T4", revenue: monthlyData["T4"] || 0 },
        { month: "T5", revenue: monthlyData["T5"] || 0 },
        { month: "T6", revenue: monthlyData["T6"] || 0 },
        { month: "T7", revenue: monthlyData["T7"] || 0 },
        { month: "T8", revenue: monthlyData["T8"] || 0 },
        { month: "T9", revenue: monthlyData["T9"] || 0 },
        { month: "T10", revenue: monthlyData["T10"] || 0 },
        { month: "T11", revenue: monthlyData["T11"] || 0 },
        { month: "T12", revenue: monthlyData["T12"] || 0 },
      ]

      // Helper to calculate overlap days for fleet utilization
      const getOverlapDays = (rStartStr: string, rEndStr: string, periodStart: Date, periodEnd: Date): number => {
        const rStart = parseVietnamDate(rStartStr)
        const rEnd = parseVietnamDate(rEndStr)
        if (isNaN(rStart.getTime()) || isNaN(rEnd.getTime())) return 0
        
        const overlapStart = rStart > periodStart ? rStart : periodStart
        const overlapEnd = rEnd < periodEnd ? rEnd : periodEnd
        
        if (overlapStart > overlapEnd) return 0
        
        const diffTime = overlapEnd.getTime() - overlapStart.getTime()
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)
      }

      // Fleet utilization and performance calculation
      const fleetPerformance = vehicles.map((v: any) => {
        const vehicleRentals = rentals.filter((r: any) => (r.vehicleId || r.vehicle_id) === v.id)
        
        // Sum overlap days in utilization window
        const activeDays = Math.min(
          totalDaysInPeriod,
          vehicleRentals.reduce((sum: number, r: any) => {
            if (r.status !== "active" && r.status !== "completed") return sum
            return sum + getOverlapDays(r.startDate || r.start_date, r.endDate || r.end_date, utilStart, utilEnd)
          }, 0)
        )

        // Sum revenue in period
        const revenue = vehicleRentals
          .filter((r: any) => {
            const rDate = parseVietnamDate(r.endDate || r.startDate)
            return r.status === 'completed' && rDate >= start && rDate <= end
          })
          .reduce((sum: number, r: any) => sum + (r.revenue || r.totalPrice || 0), 0)

        const utilizationRate = Math.min(100, Math.round((activeDays / totalDaysInPeriod) * 100))

        return {
          name: v.name,
          licensePlate: v.licensePlate || "",
          activeDays,
          revenue,
          utilizationRate,
        }
      }).sort((a, b) => b.revenue - a.revenue)

      // Expense Structure grouping
      let dividendExp = 0
      let salaryExp = 0
      let capitalExp = 0
      let maintenanceExp = 0
      let fuelExp = 0
      let otherExp = 0

      filteredTx.filter((tx: any) => tx.type === 'expense').forEach((tx: any) => {
        const desc = (tx.description || "").toLowerCase()
        if (isDividendTransaction(tx)) {
          dividendExp += tx.amount || 0
        } else if (isSalaryTransaction(tx)) {
          salaryExp += tx.amount || 0
        } else if (isCapitalTransaction(tx)) {
          capitalExp += tx.amount || 0
        } else if (/(sửa|nhông|xích|nhớt|vỏ|ruột|phanh|bình|acquy)/i.test(desc)) {
          maintenanceExp += tx.amount || 0
        } else if (/(grab|xăng|xe\s*ôm|vận\s*chuyển)/i.test(desc)) {
          fuelExp += tx.amount || 0
        } else {
          otherExp += tx.amount || 0
        }
      })

      const expenseStructure = [
        { name: "Cổ tức", value: dividendExp },
        { name: "Lương nhân viên", value: salaryExp },
        { name: "Vốn & Tài sản", value: capitalExp },
        { name: "Sửa xe & bảo dưỡng", value: maintenanceExp },
        { name: "Di chuyển & xăng", value: fuelExp },
        { name: "Chi phí khác", value: otherExp },
      ].filter(item => item.value > 0)

      const commissionByHome = buildCommissionHomeReport(filteredRentals, { completedOnly: true })
      const commissionHomeTotal = sumCommissionRows(commissionByHome)
      const commissionByHomeAll = buildCommissionHomeReport(filteredRentals, { completedOnly: false })
      const commissionHomeTotalAll = sumCommissionRows(commissionByHomeAll)

      console.log("📈 Report ready:", { totalCustomers, totalVehicles, totalRevenue, commissionHomeTotal })

      const finalData: ReportData = {
        totalCustomers,
        totalVehicles,
        totalRentals,
        totalRevenue,
        totalProfit,
        activeRentals,
        vehiclesInMaintenance,
        monthlyRevenue,
        commissionHomeTotal,
        commissionByHome,
        commissionHomeTotalAll,
        commissionByHomeAll,
        fleetPerformance,
        expenseStructure,
      }

      setReportData(finalData)
      addAccessLog("Xem", "Báo cáo", `Xem báo cáo kỳ: ${filterPeriod}`)
    } catch (error) {
      console.error("Failed to load report data:", error)
      // Set default empty data
      setReportData({
        totalCustomers: 0,
        totalVehicles: 0,
        totalRentals: 0,
        totalRevenue: 0,
        totalProfit: 0,
        activeRentals: 0,
        vehiclesInMaintenance: 0,
        monthlyRevenue: [
          { month: "T1", revenue: 0 },
          { month: "T2", revenue: 0 },
          { month: "T3", revenue: 0 },
          { month: "T4", revenue: 0 },
          { month: "T5", revenue: 0 },
          { month: "T6", revenue: 0 },
        ],
        commissionHomeTotal: 0,
        commissionByHome: [],
        commissionHomeTotalAll: 0,
        commissionByHomeAll: [],
        fleetPerformance: [],
        expenseStructure: [],
      })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 h-24 bg-slate-200 rounded"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="p-6">
        <Card className="bg-rose-50 border-rose-200">
          <CardContent className="pt-6">
            <p className="text-rose-700">Không thể tải dữ liệu báo cáo</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)
  
  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const rentalOnly = reportData.totalRevenue - transactions
    .filter((tx) => tx.type === 'income' && !isCapitalTransaction(tx))
    .reduce((sum, tx) => sum + tx.amount, 0)
  const cashOnHand = rentalOnly + totalIncome - totalExpense
  const formatPrice = (value: number) => `${value.toLocaleString("vi-VN")} đ`

  const periodLabelText = filterPeriod === "this-month"
    ? "Tháng này"
    : filterPeriod === "last-month"
    ? "Tháng trước"
    : filterPeriod === "this-year"
    ? "Năm nay"
    : filterPeriod === "custom"
    ? `Từ ${formatDisplayDate(startDate)} đến ${formatDisplayDate(endDate)}`
    : "Toàn bộ thời gian"

  const stats = [
    {
      title: "Doanh thu",
      value: `${reportData.totalRevenue.toLocaleString("vi-VN")} đ`,
      change: `${reportData.totalRentals} đơn`,
      icon: DollarSign,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      accent: "blue" as const,
      onClick: () => {
        document.getElementById("charts-section")?.scrollIntoView({ behavior: "smooth" })
      },
    },
    {
      title: "Lợi nhuận",
      value: `${reportData.totalProfit.toLocaleString("vi-VN")} đ`,
      change: `${reportData.totalProfit > 0 ? "↑" : "↓"} LN`,
      icon: TrendingUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      accent: "blue" as const,
      onClick: () => {
        document.getElementById("finance-summary-section")?.scrollIntoView({ behavior: "smooth" })
      },
    },
    {
      title: "Tiền Quỹ Còn Lại",
      value: `${cashOnHand.toLocaleString("vi-VN")} đ`,
      change: "số dư quỹ tích lũy",
      icon: Wallet,
      iconBg: "bg-slate-50",
      iconColor: "text-slate-500",
      accent: "blue" as const,
      onClick: () => {
        document.getElementById("transactions-section")?.scrollIntoView({ behavior: "smooth" })
      },
    },
    {
      title: "Chi Hoa Hồng Home",
      value: `${reportData.commissionHomeTotal.toLocaleString("vi-VN")} đ`,
      change: `${reportData.commissionByHome.length} đối tác (${reportData.commissionByHome.reduce((s, r) => s + r.count, 0)} đơn)`,
      icon: Home,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      accent: "blue" as const,
      onClick: () => {
        document.getElementById("commission-section")?.scrollIntoView({ behavior: "smooth" })
      },
    },
    {
      title: "Tổng xe",
      value: reportData.totalVehicles.toString(),
      change: `${reportData.activeRentals} đang thuê`,
      icon: Bike,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      accent: "blue" as const,
      onClick: () => router.push("/dashboard/vehicles"),
    },
    {
      title: "Tổng đơn",
      value: reportData.totalRentals.toString(),
      change: `${reportData.activeRentals} đang thuê`,
      icon: ClipboardList,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      accent: "blue" as const,
      onClick: () => router.push("/dashboard/orders"),
    },
  ]

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    const startTime = Date.now()
    try {
      await loadReportData(false)
      const elapsed = Date.now() - startTime
      if (elapsed < 400) {
        await new Promise((r) => setTimeout(r, 400 - elapsed))
      }
      showSuccess("Đã làm mới dữ liệu báo cáo")
    } catch (error) {
      console.error("Report refresh error:", error)
      showError("Không thể làm mới dữ liệu báo cáo")
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <ModulePageShell module="rental">
      <div className="flex flex-wrap items-center justify-end gap-2 w-full">
        <Select value={filterPeriod} onValueChange={(val) => setFilterPeriod(val as any)}>
          <SelectTrigger className="w-[180px] bg-white border-slate-300 rounded-[var(--radius-control)] h-11 text-body font-semibold">
            <SelectValue placeholder="Chọn kỳ báo cáo" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="this-month">Tháng này</SelectItem>
            <SelectItem value="last-month">Tháng trước</SelectItem>
            <SelectItem value="this-year">Năm nay</SelectItem>
            <SelectItem value="custom">Tự chọn khoảng ngày</SelectItem>
          </SelectContent>
        </Select>

        {filterPeriod === "custom" && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-[var(--radius-control)] px-2.5 h-11">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[135px] h-8 border-0 p-0 text-sm bg-transparent focus-visible:ring-0"
            />
            <span className="text-meta text-slate-400 font-bold">→</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[135px] h-8 border-0 p-0 text-sm bg-transparent focus-visible:ring-0"
            />
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleManualRefresh}
          disabled={isRefreshing || loading}
          className="h-11 w-11 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-50 text-slate-700 border-slate-300 rounded-[var(--radius-control)] shadow-sm ui-transition hover:border-slate-400"
          title="Tải lại dữ liệu"
          aria-label="Tải lại dữ liệu"
        >
          <RefreshCw className={cn("w-4 h-4 text-slate-600", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Delete Transaction Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-slate-200 rounded-[var(--radius-container)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-title">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận xoá
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-body mt-2">
              Bạn có chắc chắn muốn xoá khoản {transactionToDelete?.type === "income" ? "THU" : "CHI"} <span className="font-semibold text-slate-800">"{transactionToDelete?.description}"</span> không?
              <p className="text-meta text-rose-600 mt-2">Số tiền: {transactionToDelete?.amount.toLocaleString("vi-VN")} VND</p>
              <p className="text-meta text-rose-600">Nhập bởi: {transactionToDelete?.user}</p>
              <p className="text-meta text-rose-600">Hành động này không thể hoàn tác.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setTransactionToDelete(null)
              }}
              className="border-slate-300"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-rose-600 !text-white hover:bg-rose-700"
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditTransactionOpen} onOpenChange={setIsEditTransactionOpen}>
        <EntityFormDialogContent accent={editFormData.type === "income" ? "emerald" : "red"} maxWidth="lg">
          <EntityFormHeader
            title="Sửa khoản thu/chi"
            description="Cập nhật loại, ngày và số tiền"
          />
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmEdit() }}>
            <EntityFormBody>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-title truncate">{editFormData.description.trim() || "Chưa có mô tả"}</p>
                  <p className="text-meta">
                    {editFormData.type === "income" ? "Thu" : "Chi"}
                    {" · "}
                    {editFormData.isCapital ? "Vốn / tài sản" : "Vận hành"}
                  </p>
                </div>
                <p className={cn(
                  "text-body font-semibold money tabular-nums shrink-0",
                  editFormData.type === "income" ? "text-emerald-700" : "text-rose-700"
                )}>
                  {editFormData.amount ? `${editFormData.type === "income" ? "+" : "-"}${editFormData.amount} đ` : "—"}
                </p>
              </div>

              <EntityFormField label="Loại">
                <EntityFormToggle
                  value={editFormData.type}
                  onChange={(val) => setEditFormData({ ...editFormData, type: val as "income" | "expense" })}
                  options={[
                    { value: "income", label: "Thu" },
                    { value: "expense", label: "Chi" },
                  ]}
                />
              </EntityFormField>
              <EntityFormField label="Phân loại">
                <EntityFormToggle
                  value={editFormData.isCapital ? "capital" : "operating"}
                  onChange={(val) => setEditFormData({ ...editFormData, isCapital: val === "capital" })}
                  options={[
                    { value: "operating", label: "Vận hành" },
                    { value: "capital", label: "Vốn" },
                  ]}
                />
                <p className="text-meta mt-1.5">
                  {editFormData.isCapital ? "Không tính vào lợi nhuận (góp vốn, mua xe, tài sản)." : "Tính vào lợi nhuận vận hành."}
                </p>
              </EntityFormField>
              <EntityFormField label="Mô tả" required>
                <Input
                  placeholder="Sửa xe, mua định vị..."
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  className={entityFormInputClass}
                />
              </EntityFormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EntityFormField label="Ngày giao dịch">
                  <Input
                    type="date"
                    value={editFormData.timestamp}
                    onChange={(e) => setEditFormData({...editFormData, timestamp: e.target.value})}
                    className={entityFormInputClass}
                  />
                </EntityFormField>
                <EntityFormField label="Số tiền" required>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={editFormData.amount}
                    onChange={(e) => {
                      const formatted = formatMoneyInput(e.target.value)
                      setEditFormData({...editFormData, amount: formatted})
                    }}
                    className={cn(entityFormInputClass, "font-mono")}
                  />
                </EntityFormField>
              </div>
            </EntityFormBody>
            <EntityFormFooter
              accent={editFormData.type === "income" ? "emerald" : "red"}
              onCancel={() => setIsEditTransactionOpen(false)}
              submitLabel="Cập nhật"
            />
          </form>
        </EntityFormDialogContent>
      </Dialog>

      {/* Stats Cards */}
      <ModuleKpiGrid columns={3}>
        {stats.map((stat, idx) => (
          <RentalKpiCard
            key={idx}
            variant="hero"
            accent={stat.accent}
            label={stat.title}
            value={stat.value}
            sublabel={stat.change}
            onClick={stat.onClick}
          />
        ))}
      </ModuleKpiGrid>

      <div id="charts-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch scroll-mt-20">
        <MonthlyRevenueChart data={reportData.monthlyRevenue} formatPrice={formatPrice} />
        <ExpenseStructureChart data={reportData.expenseStructure} formatPrice={formatPrice} />
      </div>

      {/* Fleet Performance Analytics */}
      <Card id="fleet-section" className="scroll-mt-20">
        <CardHeader className="pb-2 md:pb-4 p-3 md:p-4">
          <CardTitle className="text-title flex items-center gap-2 text-slate-900">
            <Bike className="w-5 h-5 text-blue-600" />
            Hiệu Suất Vận Hành Đội Xe
          </CardTitle>
          <CardDescription className="text-meta text-slate-500">
            Chi tiết số ngày hoạt động, doanh thu và tỷ lệ lấp đầy trong khoảng thời gian lọc
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reportData.fleetPerformance.length === 0 ? (
            <ModuleEmptyState title="Không có dữ liệu đội xe" description="Chưa có xe hoặc chưa có đơn thuê trong kỳ lọc." />
          ) : (
            <>
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left text-meta border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3">Xe máy</th>
                        <th className="p-3">Biển số</th>
                        <th className="p-3 text-center">Số ngày chạy</th>
                        <th className="p-3 text-right">Doanh thu thuê</th>
                        <th className="p-3 text-center">Hiệu suất lấp đầy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.fleetPerformance
                        .slice((fleetPage - 1) * fleetItemsPerPage, fleetPage * fleetItemsPerPage)
                        .map((item, idx) => (
                        <tr key={`${item.licensePlate}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-medium tabular-nums">
                            {(fleetPage - 1) * fleetItemsPerPage + idx + 1}
                          </td>
                          <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="p-3 text-slate-500 tabular-nums">{item.licensePlate}</td>
                          <td className="p-3 text-center text-slate-700 font-medium tabular-nums">{item.activeDays} ngày</td>
                          <td className="p-3 text-right font-bold text-emerald-600 tabular-nums">{item.revenue.toLocaleString("vi-VN")} đ</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-12 bg-slate-100 rounded-[var(--radius-badge)] h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-[var(--radius-badge)] ${
                                    item.utilizationRate >= 70
                                      ? "bg-emerald-500"
                                      : item.utilizationRate >= 40
                                        ? "bg-amber-500"
                                        : "bg-blue-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, item.utilizationRate))}%` }}
                                />
                              </div>
                              <span className={`font-semibold tabular-nums ${
                                item.utilizationRate >= 70
                                  ? "text-emerald-600"
                                  : item.utilizationRate >= 40
                                    ? "text-amber-600"
                                    : "text-slate-900"
                              }`}>
                                {item.utilizationRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                mobile={
                  <>
                    {reportData.fleetPerformance
                      .slice((fleetPage - 1) * fleetItemsPerPage, fleetPage * fleetItemsPerPage)
                      .map((item, idx) => (
                      <ModuleMobileCard key={`${item.licensePlate}-${idx}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-meta tabular-nums mb-0.5">#{(fleetPage - 1) * fleetItemsPerPage + idx + 1}</p>
                            <p className="text-body font-semibold text-slate-800">{item.name}</p>
                            <p className="text-meta tabular-nums mt-0.5">{item.licensePlate}</p>
                          </div>
                          <p className="text-body font-semibold text-emerald-600 money tabular-nums shrink-0">
                            {item.revenue.toLocaleString("vi-VN")} đ
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-body text-slate-600">{item.activeDays} ngày chạy</span>
                          <span className={`text-body font-semibold tabular-nums ${
                            item.utilizationRate >= 70
                              ? "text-emerald-600"
                              : item.utilizationRate >= 40
                                ? "text-amber-600"
                                : "text-slate-800"
                          }`}>
                            Lấp đầy {item.utilizationRate}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-[var(--radius-badge)] bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-[var(--radius-badge)] ${
                              item.utilizationRate >= 70
                                ? "bg-emerald-500"
                                : item.utilizationRate >= 40
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, item.utilizationRate))}%` }}
                          />
                        </div>
                      </ModuleMobileCard>
                    ))}
                  </>
                }
              />
              <ModulePagination
                page={fleetPage}
                totalPages={Math.max(1, Math.ceil(reportData.fleetPerformance.length / fleetItemsPerPage))}
                totalItems={reportData.fleetPerformance.length}
                itemLabel="xe"
                onPageChange={setFleetPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card id="transactions-section" className="scroll-mt-20">
        <CardHeader className="pb-3 md:pb-4 p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <CardTitle className="text-title">Theo Dõi Thu/Chi</CardTitle>
              <CardDescription className="text-meta font-medium">Quản lý các khoản thu/chi nằm ngoài đơn thuê xe</CardDescription>
            </div>
            <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
              <Button onClick={() => setIsAddTransactionOpen(true)} className="bg-blue-600 !text-white hover:bg-blue-700 text-body h-11 rounded-[var(--radius-control)] w-full sm:w-auto [&_svg]:!text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nhập thu/chi
              </Button>
              <EntityFormDialogContent accent={formData.type === "income" ? "emerald" : "red"} maxWidth="lg">
                <EntityFormHeader
                  title="Thêm khoản thu/chi"
                  description="Khoản ngoài đơn thuê — vận hành hoặc vốn"
                />
                <form onSubmit={handleAddTransaction}>
                  <EntityFormBody>
                    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-title truncate">{formData.description.trim() || "Khoản mới"}</p>
                        <p className="text-meta">
                          {formData.type === "income" ? "Thu" : "Chi"}
                          {" · "}
                          {formData.isCapital ? "Vốn / tài sản" : "Vận hành"}
                        </p>
                      </div>
                      <p className={cn(
                        "text-body font-semibold money tabular-nums shrink-0",
                        formData.type === "income" ? "text-emerald-700" : "text-rose-700"
                      )}>
                        {formData.amount ? `${formData.type === "income" ? "+" : "-"}${formData.amount} đ` : "—"}
                      </p>
                    </div>

                    <EntityFormField label="Loại">
                      <EntityFormToggle
                        value={formData.type}
                        onChange={(val) => setFormData({ ...formData, type: val as "income" | "expense" })}
                        options={[
                          { value: "income", label: "Thu" },
                          { value: "expense", label: "Chi" },
                        ]}
                      />
                    </EntityFormField>
                    <EntityFormField label="Phân loại">
                      <EntityFormToggle
                        value={formData.isCapital ? "capital" : "operating"}
                        onChange={(val) => setFormData({ ...formData, isCapital: val === "capital" })}
                        options={[
                          { value: "operating", label: "Vận hành" },
                          { value: "capital", label: "Vốn" },
                        ]}
                      />
                      <p className="text-meta mt-1.5">
                        {formData.isCapital ? "Không tính vào lợi nhuận (góp vốn, mua xe, tài sản)." : "Tính vào lợi nhuận vận hành."}
                      </p>
                    </EntityFormField>
                    <EntityFormField label="Mô tả" required>
                      <Input
                        placeholder="Sửa xe, mua định vị..."
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className={entityFormInputClass}
                      />
                    </EntityFormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <EntityFormField label="Ngày giao dịch">
                        <Input
                          type="date"
                          value={formData.timestamp}
                          onChange={(e) => setFormData({...formData, timestamp: e.target.value})}
                          className={entityFormInputClass}
                        />
                      </EntityFormField>
                      <EntityFormField label="Số tiền" required>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="1.000.000"
                          value={formData.amount}
                          onChange={(e) => {
                            const formatted = formatMoneyInput(e.target.value)
                            setFormData({...formData, amount: formatted})
                          }}
                          className={cn(entityFormInputClass, "font-mono")}
                        />
                      </EntityFormField>
                    </div>
                  </EntityFormBody>
                  <EntityFormFooter
                    accent={formData.type === "income" ? "emerald" : "red"}
                    onCancel={() => setIsAddTransactionOpen(false)}
                    submitLabel="Thêm"
                  />
                </form>
              </EntityFormDialogContent>
            </Dialog>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Tìm kiếm: mô tả, user, tiền, loại..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10 border-slate-200 rounded-[var(--radius-control)] text-body h-11"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          {filteredTransactions.length === 0 ? (
            <ModuleEmptyState
              title="Không tìm thấy giao dịch"
              description="Thử đổi từ khóa tìm kiếm."
            />
          ) : (
            <div className="space-y-3 md:space-y-4">
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                        <th className={rentalTableHeadClass}>Loại</th>
                        <th className={rentalTableHeadClass}>Ngày</th>
                        <th className={rentalTableHeadClass}>Mô tả</th>
                        <th className={cn(rentalTableHeadClass, "text-right")}>Số tiền</th>
                        <th className={rentalTableHeadClass}>Người thực hiện</th>
                        {user?.role === "admin" && (
                          <th className={cn(rentalTableHeadClass, "text-center w-24")}>Tác vụ</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {paginatedTransactions.map((tx, index) => (
                        <tr key={tx.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center text-sm text-slate-400 font-medium">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3 px-4">
                            {isDividendTransaction(tx) ? (
                              <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-700 border-slate-200">
                                Cổ tức
                              </span>
                            ) : isSalaryTransaction(tx) ? (
                              <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-600 border-slate-200">
                                Lương NV
                              </span>
                            ) : isCapitalTransaction(tx) ? (
                              <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-amber-50 text-amber-700 border-amber-100">
                                Vốn/Tài sản
                              </span>
                            ) : (
                              <span className={`inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border ${
                                tx.type === "income"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : "bg-rose-50 text-rose-700 border-rose-100"
                              }`}>
                                {tx.type === "income" ? "Thu" : "Chi"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-medium">{formatDisplayDate(tx.timestamp || tx.created_at)}</td>
                          <td className="py-3 px-4 text-slate-600">{tx.description}</td>
                          <td className={`py-3 px-4 text-right font-semibold tabular-nums ${
                            tx.type === "income" ? "text-emerald-700" : "text-rose-600"
                          }`}>
                            {tx.type === "income" ? "+" : "-"}{tx.amount.toLocaleString("vi-VN")}đ
                          </td>
                          <td className="py-3 px-4 text-slate-500">{getUserDisplayName(tx.user, userDisplayNames)}</td>
                          {user?.role === "admin" && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => handleEditTransaction(tx)}
                                  className="h-9 w-9 inline-flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-[var(--radius-control)] transition"
                                  title="Sửa"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(tx)}
                                  className="h-9 w-9 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-control)] transition"
                                  title="Xoá"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                mobile={paginatedTransactions.map((tx, index) => (
                  <ModuleMobileCard key={tx.id}>
                    <div className="flex justify-between items-start gap-2">
                      {isDividendTransaction(tx) ? (
                        <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-700 border-slate-200">
                          Cổ tức
                        </span>
                      ) : isSalaryTransaction(tx) ? (
                        <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-slate-100 text-slate-600 border-slate-200">
                          Lương NV
                        </span>
                      ) : isCapitalTransaction(tx) ? (
                        <span className="inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border bg-amber-50 text-amber-700 border-amber-100">
                          Vốn/Tài sản
                        </span>
                      ) : (
                        <span className={`inline-flex text-meta font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border ${
                          tx.type === "income"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          {tx.type === "income" ? "Thu" : "Chi"}
                        </span>
                      )}
                      <span className="text-meta text-slate-400 font-medium">
                        {formatDisplayDate(tx.timestamp || tx.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 my-1">{tx.description}</p>
                    <div className="flex justify-between items-center text-sm">
                      <span className={`font-bold tabular-nums ${tx.type === "income" ? "text-emerald-700" : "text-rose-600"}`}>
                        {tx.type === "income" ? "+" : "-"}{tx.amount.toLocaleString("vi-VN")}đ
                      </span>
                      <span className="text-meta text-slate-500">bởi {getUserDisplayName(tx.user, userDisplayNames)}</span>
                    </div>
                    {user?.role === "admin" && (
                      <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-slate-100/50">
                        <button
                          onClick={() => handleEditTransaction(tx)}
                          className="h-11 px-3 inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-body font-medium rounded-[var(--radius-control)]"
                          title="Sửa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx)}
                          className="h-11 px-3 inline-flex items-center gap-1.5 text-rose-500 hover:text-rose-600 text-body font-medium rounded-[var(--radius-control)]"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa
                        </button>
                      </div>
                    )}
                  </ModuleMobileCard>
                ))}
              />

              <ModulePagination
                page={currentPage}
                totalPages={Math.max(1, totalPages)}
                totalItems={filteredTransactions.length}
                itemLabel="giao dịch"
                onPageChange={setCurrentPage}
                className="border-t border-slate-200 pt-3 mt-0 px-0 bg-transparent"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bảng Báo Cáo Tiền Chi Hoa Hồng Homestay / Đối Tác */}
      <Card id="commission-section" className="scroll-mt-20 border-slate-100 bg-white shadow-sm overflow-hidden rounded-[var(--radius-container)]">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-amber-50 text-amber-700">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-title font-bold text-slate-800">
                    Báo cáo Chi Hoa Hồng Homestay / Đối tác
                  </CardTitle>
                  <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-label font-bold text-amber-800">
                    {commissionTotals.amount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <CardDescription className="text-meta text-slate-500 mt-0.5">
                  Thống kê chi tiết tiền hoa hồng trả cho từng đơn vị homestay / đối tác giới thiệu thuê xe theo kỳ báo cáo
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-meta">
                <span className="text-slate-500">
                  Đối tác: <strong className="text-slate-800 tabular-nums">{commissionTotals.homes}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Lượt đơn: <strong className="text-slate-800 tabular-nums">{commissionTotals.orders}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Ngày thuê: <strong className="text-slate-800 tabular-nums">{commissionTotals.days}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Tìm kiếm theo tên Homestay, đối tác..."
                value={commissionSearchQuery}
                onChange={(e) => {
                  setCommissionSearchQuery(e.target.value)
                  setCommissionPage(1)
                }}
                className="pl-9 pr-9 border-slate-200 rounded-[var(--radius-control)] text-body h-10 bg-white"
              />
              {commissionSearchQuery && (
                <button
                  onClick={() => {
                    setCommissionSearchQuery("")
                    setCommissionPage(1)
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Select
              value={commissionStatusFilter}
              onValueChange={(v: "completed" | "all") => {
                setCommissionStatusFilter(v)
                setCommissionPage(1)
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-[13rem] rounded-[var(--radius-control)] border-slate-200 bg-white text-body text-slate-800 font-medium">
                <SelectValue placeholder="Trạng thái đơn" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="completed">Chỉ đơn hoàn thành</SelectItem>
                <SelectItem value="all">Tất cả đơn (gồm đang thuê)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-4">
          {activeCommissionRows.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Home className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-base">Không có dữ liệu hoa hồng trong kỳ này</p>
                <p className="text-meta text-slate-500 max-w-md mx-auto">
                  {commissionStatusFilter === "completed"
                    ? "Chưa có đơn hoàn thành nào có ghi nhận tiền hoa hồng Homestay/Đối tác trong kỳ lọc."
                    : "Chưa có đơn nào có hoa hồng trong kỳ lọc hiện tại."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {commissionStatusFilter === "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCommissionStatusFilter("all")}
                    className="border-amber-200 text-amber-800 hover:bg-amber-50 font-semibold"
                  >
                    Xem tất cả đơn (gồm đang thuê)
                  </Button>
                )}
                {filterPeriod !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilterPeriod("all")}
                    className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Xem tất cả kỳ
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ModuleResponsiveTable
                desktop={
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                        <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                        <th className={rentalTableHeadClass}>Homestay / Đối tác</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Số lượt đơn</th>
                        <th className={cn(rentalTableHeadClass, "text-center")}>Tổng ngày thuê</th>
                        <th className={cn(rentalTableHeadClass, "text-right")}>Mức hoa hồng TB / ngày</th>
                        <th className={cn(rentalTableHeadClass, "text-right")}>Tổng tiền hoa hồng</th>
                        <th className={cn(rentalTableHeadClass, "text-center w-28")}>Chi tiết đơn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {paginatedCommissionRows.map((row, index) => (
                        <tr key={row.name} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center text-sm text-slate-400 font-medium tabular-nums">
                            {(safeCommissionPage - 1) * commissionItemsPerPage + index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                                <Home className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-slate-900 text-body">{row.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-meta font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                              {row.count} đơn
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-medium tabular-nums text-slate-700">
                            {row.totalDays} ngày
                          </td>
                          <td className="py-3 px-4 text-right font-medium tabular-nums text-slate-600">
                            {row.avgPerDay.toLocaleString("vi-VN")} đ/ngày
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-amber-700 text-base">
                            {row.total.toLocaleString("vi-VN")} đ
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedHomeForDetail(row)}
                              className="h-8 px-2.5 text-label font-semibold rounded-[var(--radius-control)] border-amber-200 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Xem ({row.orders.length})
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/90">
                      <tr className="font-bold text-slate-800">
                        <td colSpan={2} className="py-3 px-4 text-left">
                          Tổng cộng ({commissionTotals.homes} đối tác)
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-blue-700">
                          {commissionTotals.orders} đơn
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-slate-800">
                          {commissionTotals.days} ngày
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-normal text-meta">
                          —
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-amber-800 text-base">
                          {commissionTotals.amount.toLocaleString("vi-VN")} đ
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                }
                mobile={
                  <div className="space-y-2">
                    {paginatedCommissionRows.map((row, index) => (
                      <ModuleMobileCard key={row.name}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-meta text-slate-400 font-semibold tabular-nums">
                              #{(safeCommissionPage - 1) * commissionItemsPerPage + index + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-body">{row.name}</span>
                          </div>
                          <span className="font-bold text-base text-amber-700 tabular-nums">
                            {row.total.toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-meta text-slate-600 my-1 bg-slate-50 p-2 rounded-lg">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Số đơn</span>
                            <span className="font-semibold text-slate-800">{row.count} đơn</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Tổng ngày</span>
                            <span className="font-semibold text-slate-800">{row.totalDays} ngày</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">HH TB/ngày</span>
                            <span className="font-semibold text-slate-800">{row.avgPerDay.toLocaleString("vi-VN")} đ</span>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedHomeForDetail(row)}
                            className="h-8 px-3 text-label font-semibold rounded-[var(--radius-control)] border-amber-200 text-amber-800 hover:bg-amber-50"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Xem chi tiết {row.orders.length} đơn
                          </Button>
                        </div>
                      </ModuleMobileCard>
                    ))}

                    <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-3 flex justify-between items-center text-sm">
                      <span className="font-bold text-amber-950">Tổng tiền hoa hồng ({commissionTotals.homes} đối tác)</span>
                      <span className="font-bold text-base text-amber-800 tabular-nums">
                        {commissionTotals.amount.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                  </div>
                }
              />

              {totalCommissionPages > 1 && (
                <ModulePagination
                  page={safeCommissionPage}
                  totalPages={totalCommissionPages}
                  totalItems={activeCommissionRows.length}
                  itemLabel="đối tác"
                  onPageChange={setCommissionPage}
                  className="border-t border-slate-200 pt-3 mt-0 px-0 bg-transparent"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Dialog xem chi tiết danh sách đơn của 1 Home */}
      <Dialog open={!!selectedHomeForDetail} onOpenChange={(open) => !open && setSelectedHomeForDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-title">
              <Home className="h-5 w-5 text-amber-600" />
              Chi tiết đơn giới thiệu: {selectedHomeForDetail?.name}
            </DialogTitle>
            <DialogDescription>
              Danh sách các đơn thuê xe qua {selectedHomeForDetail?.name} trong kỳ báo cáo
            </DialogDescription>
          </DialogHeader>

          {selectedHomeForDetail && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-2 bg-amber-50/60 p-3 rounded-lg border border-amber-200/70 text-center">
                <div>
                  <p className="text-meta text-slate-500 font-medium">Tổng số đơn</p>
                  <p className="text-body font-bold text-slate-900 mt-0.5">{selectedHomeForDetail.count} đơn</p>
                </div>
                <div>
                  <p className="text-meta text-slate-500 font-medium">Tổng ngày thuê</p>
                  <p className="text-body font-bold text-slate-900 mt-0.5">{selectedHomeForDetail.totalDays} ngày</p>
                </div>
                <div>
                  <p className="text-meta text-slate-500 font-medium">Tổng tiền hoa hồng</p>
                  <p className="text-body font-bold text-amber-800 mt-0.5">{selectedHomeForDetail.total.toLocaleString("vi-VN")} đ</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-meta">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-center">STT</th>
                      <th className="px-3 py-2">Khách / Mã đơn</th>
                      <th className="px-3 py-2">Xe thuê</th>
                      <th className="px-3 py-2">Thời gian</th>
                      <th className="px-3 py-2 text-right">Mức HH/ngày</th>
                      <th className="px-3 py-2 text-right">Tiền HH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedHomeForDetail.orders.map((ord, idx) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5 text-center text-slate-400 font-medium tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-900">{ord.customerName}</p>
                          {ord.rentalCode && <p className="font-mono text-slate-400 text-[11px]">{ord.rentalCode}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-800">{ord.vehicleName}</p>
                          {ord.licensePlate && <p className="font-mono text-slate-500 text-[11px]">{ord.licensePlate}</p>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p>{formatDisplayDate(ord.startDate)} - {formatDisplayDate(ord.endDate)}</p>
                          <span className="text-[11px] text-slate-500 font-medium">({ord.totalDays} ngày)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                          {ord.commissionHome.toLocaleString("vi-VN")} đ
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold font-mono text-amber-700 tabular-nums">
                          {ord.totalCommission.toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelectedHomeForDetail(null)} className="h-10 px-5 font-semibold">
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary */}
      {(() => {
        // Calculate totals from transactions
        const totalIncome = transactions
          .filter((tx) => tx.type === 'income')
          .reduce((sum, tx) => sum + tx.amount, 0)
        
        const totalExpense = transactions
          .filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => sum + tx.amount, 0)
        
        // Filter out salary and dividend transactions from operational profit calculations
        const salaryExpenses = transactions
          .filter(isSalaryTransaction)
          .reduce((sum, tx) => sum + tx.amount, 0)

        const dividendExpenses = transactions
          .filter(isDividendTransaction)
          .reduce((sum, tx) => sum + tx.amount, 0)
        
        // NOTE: reportData.totalRevenue/Profit = P&L vận hành (không gồm góp vốn/mua xe/chia cổ tức)
        const rentalOnly = reportData.totalRevenue - transactions
          .filter((tx) => tx.type === 'income' && !isCapitalTransaction(tx))
          .reduce((sum, tx) => sum + tx.amount, 0)
        const cashOnHand = rentalOnly + totalIncome - totalExpense
        
        // Operating profit before salaries (Gross Operating Profit)
        const operatingProfitBeforeSalary = reportData.totalProfit + salaryExpenses
        
        // Phân chia 2 cổ đông: Admin (50%) và Lộc A (50%)
        const remainingToDistribute = reportData.totalProfit - dividendExpenses
        const partnerShareTotal = reportData.totalProfit > 0 ? Math.floor(reportData.totalProfit / 2) : 0
        const partnerShareRemaining = remainingToDistribute > 0 ? Math.floor(remainingToDistribute / 2) : 0
        
        return (
          <div id="finance-summary-section" className="grid grid-cols-1 lg:grid-cols-12 gap-5 scroll-mt-20">
            {/* Cột trái: Tóm tắt Báo Cáo Tài Chính (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-[var(--radius-container)]">
                <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-blue-100/80 flex items-center justify-center text-blue-700">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                        Tóm Tắt Báo Cáo Tài Chính
                      </CardTitle>
                      <CardDescription className="text-meta text-slate-500">
                        Hiệu quả kinh doanh và dòng tiền ngân quỹ thực tế
                      </CardDescription>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                    {filterPeriod === "this-month"
                      ? "Tháng này"
                      : filterPeriod === "last-month"
                      ? "Tháng trước"
                      : filterPeriod === "this-year"
                      ? "Năm nay"
                      : filterPeriod === "custom"
                      ? `${startDate} → ${endDate}`
                      : "Toàn bộ"}
                  </span>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-5">
                  {/* Quick KPI Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <div>
                      <p className="text-label text-slate-500">Quy mô xe</p>
                      <p className="text-base font-bold text-slate-800 mt-0.5">{reportData.totalVehicles} <span className="text-xs font-normal text-slate-500">xe</span></p>
                    </div>
                    <div>
                      <p className="text-label text-slate-500">Khách hàng</p>
                      <p className="text-base font-bold text-slate-800 mt-0.5">{reportData.totalCustomers} <span className="text-xs font-normal text-slate-500">khách</span></p>
                    </div>
                    <div>
                      <p className="text-label text-slate-500">Tổng đơn thuê</p>
                      <p className="text-base font-bold text-slate-800 mt-0.5">{reportData.totalRentals} <span className="text-xs font-normal text-slate-500">đơn</span></p>
                    </div>
                    <div>
                      <p className="text-label text-slate-500">Doanh thu thuê</p>
                      <p className="text-base font-bold text-slate-900 money mt-0.5">{reportData.totalRevenue.toLocaleString("vi-VN")} đ</p>
                    </div>
                  </div>

                  {/* 2 Blocks: P&L vs Cash Flow */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Block 1: P&L Vận Hành */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-blue-600" />
                            1. P&L Vận Hành
                          </span>
                          <span className="text-[11px] font-medium text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-md">Kinh doanh</span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-meta">LN trước lương:</span>
                            <span className="font-semibold text-slate-800 tabular-nums">
                              {operatingProfitBeforeSalary.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-meta">Chi lương NV:</span>
                            <span className="font-semibold text-rose-600 tabular-nums">
                              -{salaryExpenses.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-meta">Chiết khấu HH Home:</span>
                            <span className="font-semibold text-amber-700 tabular-nums">
                              -{reportData.commissionHomeTotal.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-blue-200/80 pt-2.5 flex justify-between items-baseline bg-white/80 p-2.5 rounded-lg border border-blue-100">
                        <span className="font-bold text-slate-800 text-sm">Lợi nhuận ròng:</span>
                        <span className="font-bold text-lg text-emerald-700 tabular-nums">
                          {reportData.totalProfit.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </div>

                    {/* Block 2: Dòng Tiền & Tồn Quỹ */}
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            2. Quỹ Tiền Mặt
                          </span>
                          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md">Dòng tiền</span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-meta">Tổng tiền thu vào:</span>
                            <span className="font-semibold text-emerald-700 tabular-nums">
                              +{(rentalOnly + totalIncome).toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-meta">Tổng tiền chi ra:</span>
                            <span className="font-semibold text-rose-600 tabular-nums">
                              -{totalExpense.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="text-meta">Cổ tức đã chia:</span>
                            <span className="font-semibold text-slate-700 tabular-nums">
                              -{dividendExpenses.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-emerald-200/80 pt-2.5 flex justify-between items-baseline bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                        <span className="font-bold text-slate-800 text-sm">Tiền mặt tồn quỹ:</span>
                        <span className={cn("font-bold text-lg tabular-nums", cashOnHand >= 0 ? "text-slate-900" : "text-rose-600")}>
                          {cashOnHand.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Homestay commission highlights */}
                  {reportData.commissionByHome.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top hoa hồng Homestay</p>
                        <span className="text-meta text-slate-400">{reportData.commissionByHome.length} đối tác</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {reportData.commissionByHome.slice(0, 3).map((row) => (
                          <div key={row.name} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/60 text-meta">
                            <span className="text-slate-800 font-medium truncate">{row.name}</span>
                            <span className="font-bold text-amber-800 tabular-nums shrink-0 ml-1">
                              {row.total.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cột phải: Phân Chia Cổ Đông (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-[var(--radius-container)] h-full flex flex-col justify-between">
                <div>
                  <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-indigo-100/80 flex items-center justify-center text-indigo-700">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                          Phân Chia Cổ Đông
                        </CardTitle>
                        <CardDescription className="text-meta text-slate-500">
                          Tỷ lệ đồng thuận 50% - 50% theo kết quả kỳ này
                        </CardDescription>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      50 / 50
                    </span>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Summary Card */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100/80 space-y-2">
                      <div className="flex justify-between items-center text-sm text-slate-600">
                        <span className="text-meta">LN ròng vận hành:</span>
                        <span className="font-bold text-slate-800 tabular-nums">{reportData.totalProfit.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-slate-600">
                        <span className="text-meta">Đã chia trong kỳ:</span>
                        <span className="font-bold text-slate-700 tabular-nums">-{dividendExpenses.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-indigo-200/60 font-semibold text-slate-900">
                        <span className="text-sm">Tổng còn lại cần chia:</span>
                        <span className={cn("text-base font-bold tabular-nums", remainingToDistribute >= 0 ? "text-emerald-700" : "text-rose-600")}>
                          {remainingToDistribute.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </div>

                    {/* Shareholder Breakdown */}
                    <div className="space-y-3 pt-1">
                      {/* Cổ đông Admin */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                              AD
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">Cổ đông Admin</p>
                              <p className="text-xs text-slate-400">Tỷ lệ sở hữu 50%</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            50%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs border-t border-slate-100">
                          <div>
                            <p className="text-slate-400 text-meta">Được hưởng (50% LN):</p>
                            <p className="font-semibold text-slate-700 text-sm mt-0.5 tabular-nums">
                              {partnerShareTotal.toLocaleString("vi-VN")} đ
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 text-meta">Còn lại cần nhận:</p>
                            <p className={cn("font-bold text-sm mt-0.5 tabular-nums", partnerShareRemaining >= 0 ? "text-emerald-700" : "text-rose-600")}>
                              {partnerShareRemaining.toLocaleString("vi-VN")} đ
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Cổ đông Lộc A */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                              LA
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">Cổ đông Lộc A</p>
                              <p className="text-xs text-slate-400">Tỷ lệ sở hữu 50%</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            50%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs border-t border-slate-100">
                          <div>
                            <p className="text-slate-400 text-meta">Được hưởng (50% LN):</p>
                            <p className="font-semibold text-slate-700 text-sm mt-0.5 tabular-nums">
                              {partnerShareTotal.toLocaleString("vi-VN")} đ
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 text-meta">Còn lại cần nhận:</p>
                            <p className={cn("font-bold text-sm mt-0.5 tabular-nums", partnerShareRemaining >= 0 ? "text-emerald-700" : "text-rose-600")}>
                              {partnerShareRemaining.toLocaleString("vi-VN")} đ
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>
        )
      })()}

      <FinancialReportA4Dialog
        open={isA4PreviewOpen}
        onOpenChange={setIsA4PreviewOpen}
        reportData={reportData}
        transactions={transactions}
        periodLabel={periodLabelText}
        onExportCsv={handleExportReport}
      />
    </ModulePageShell>
  )
}
