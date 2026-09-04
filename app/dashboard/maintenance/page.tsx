"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { markVehicleAsMaintained, calculateMaintenanceStatus, MaintenanceVehicle } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog } from "@/components/ui/dialog"
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
import {
  EntityFormDialogContent,
} from "@/components/dashboard/entity-form-dialog"
import { Check, AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp, ImageIcon, Eye, Car, MapPin } from "lucide-react"
import { toast } from "sonner"
import {
  ModulePageShell,
  ModuleSectionCard,
  ModuleResponsiveTable,
  ModuleMobileCard,
  ModulePagination,
  ModuleKpiGrid,
  ModuleEmptyState,
} from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalVehicleStatusLabel,
  rentalVehicleStatusBadgeClass,
  getRentalOrderStatusLabel,
  rentalOrderStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"
import { formatDisplayDate } from "@/lib/format-date"

function VehicleThumb({ src, name }: { src?: string; name: string }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-badge)] border border-slate-200 bg-slate-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Car className="h-5 w-5 text-slate-300" />
        </div>
      )}
    </div>
  )
}

function parseVehicleDisplayNotes(notes?: string) {
  if (!notes) return { location: "", cleanNotes: "" }
  const match = notes.match(/\[location:(.*?)\]/i)
  if (!match) return { location: "", cleanNotes: notes }
  const raw = match[1].trim()
  const cleanNotes = notes.replace(/\[location:(.*?)\]/gi, "").trim()
  const location = raw.includes("|") ? (raw.split("|")[1] || raw.split("|")[0]) : raw
  return { location, cleanNotes }
}

function MaintStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "amber" | "rose" | "emerald"
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5 min-w-0 flex flex-col justify-center">
      <p className="text-label text-slate-500">{label}</p>
      <p
        className={cn(
          "text-body font-semibold tabular-nums mt-0.5 leading-snug break-words",
          tone === "amber" && "text-amber-800",
          tone === "rose" && "text-rose-700",
          tone === "emerald" && "text-emerald-700",
          tone === "default" && "text-slate-900"
        )}
      >
        {value}
      </p>
    </div>
  )
}

export default function MaintenancePage() {
  const { user } = useAuth()
  const { vehicles: allVehicles, orders, isLoading: loading, refresh } = useRentalData()
  const [maintaining, setMaintaining] = useState<string | null>(null)
  const [viewingVehicle, setViewingVehicle] = useState<MaintenanceVehicle | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("desc")
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "urgent">("all")
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const itemsPerPage = 15
  const maintenanceBadgeClass =
    "inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-badge)] text-sm font-semibold border"

  // Derive maintenance vehicles list from shared context
  const vehicles: MaintenanceVehicle[] = useMemo(() => {
    return allVehicles
      .map(v => calculateMaintenanceStatus(v))
      .filter(v => v.km_until_maintenance <= 0)
  }, [allVehicles])

  const openDetailDialog = (vehicle: MaintenanceVehicle) => {
    setViewingVehicle(vehicle)
  }

  const formatPrice = (n: number) => `${(n || 0).toLocaleString("vi-VN")}đ`

  const handleMaintained = async (vehicleId: string, vehicleName: string, currentKm: number) => {
    try {
      setMaintaining(vehicleId)
      const targetVehicle = allVehicles.find((v) => v.id === vehicleId)
      await markVehicleAsMaintained(vehicleId, currentKm)
      if (user) {
        logger.maintainVehicle(
          user.username,
          user.displayName,
          vehicleName,
          targetVehicle?.licensePlate || "",
          currentKm
        )
      }
      toast.success(`${vehicleName} đã bảo trì xong`)
      await refresh()
    } catch (error) {
      toast.error("Lỗi cập nhật bảo trì")
      console.error(error)
    } finally {
      setMaintaining(null)
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortOrder, urgencyFilter, vehicles])

  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter(vehicle => {
        const matchQuery = 
          vehicle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          vehicle.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
        const over = vehicle.current_km - Math.floor(vehicle.current_km / 1000) * 1000
        const matchUrgency = urgencyFilter === "all" || over >= 300
        return matchQuery && matchUrgency
      })
      .sort((a, b) => {
        const aMnt = Math.floor(a.current_km / 1000) * 1000
        const aOver = a.current_km - aMnt
        const bMnt = Math.floor(b.current_km / 1000) * 1000
        const bOver = b.current_km - bMnt
        return sortOrder === "desc" ? bOver - aOver : aOver - bOver
      })
  }, [vehicles, searchQuery, sortOrder, urgencyFilter])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredVehicles.length / itemsPerPage)
  }, [filteredVehicles])

  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredVehicles, currentPage])

  const getOverdueKm = (km: number) => km - Math.floor(km / 1000) * 1000

  const maintenanceStats = useMemo(() => {
    return {
      total: vehicles.length,
      filtered: filteredVehicles.length,
      urgent: vehicles.filter((v) => getOverdueKm(v.current_km) >= 300).length,
      avgOverdue:
        vehicles.length > 0
          ? Math.round(vehicles.reduce((sum, v) => sum + getOverdueKm(v.current_km), 0) / vehicles.length)
          : 0,
    }
  }, [vehicles, filteredVehicles])

  return (
    <ModulePageShell module="rental">
      <div className="space-y-4">
        <ModuleKpiGrid columns={4}>
          <RentalKpiCard
            variant="hero"
            label="Xe cần bảo trì"
            value={maintenanceStats.total}
            sublabel={`${maintenanceStats.filtered} đang lọc`}
            onClick={() => setUrgencyFilter("all")}
            selected={urgencyFilter === "all"}
          />
          <RentalKpiCard
            variant="hero"
            label="Cần gấp"
            value={maintenanceStats.urgent}
            sublabel="Quá hạn ≥ 300 km"
            valueClassName="text-rose-700"
            onClick={() => setUrgencyFilter("urgent")}
            selected={urgencyFilter === "urgent"}
          />
          <RentalKpiCard variant="hero" label="KM quá hạn TB" value={maintenanceStats.avgOverdue} sublabel="km trung bình" valueClassName="text-amber-700" />
          <RentalKpiCard
            variant="hero"
            label="Mốc bảo trì"
            value="1.000"
            sublabel="km / lần bảo trì"
            valueClassName="text-slate-700"
          />
        </ModuleKpiGrid>

      <ModuleSectionCard
        title="Danh sách xe cần bảo trì"
        description={`Quản lý ${filteredVehicles.length} phương tiện quá hạn hoặc tới hạn bảo dưỡng`}
        filters={
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm biển số, tên xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(rentalFilterInputClass, "pl-9 h-10")}
              />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full lg:w-56 h-10 rounded-[var(--radius-control)] border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-[var(--radius-control)]">
                <SelectItem value="desc">KM quá hạn: Cao → thấp</SelectItem>
                <SelectItem value="asc">KM quá hạn: Thấp → cao</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={refresh}
              variant="outline"
              size="icon"
              disabled={loading}
              className="h-10 w-10 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 rounded-[var(--radius-control)] shadow-sm ui-transition hover:border-slate-300"
              title="Tải lại dữ liệu"
              aria-label="Tải lại dữ liệu"
            >
              <RefreshCw className={cn("w-4 h-4 text-slate-600", loading && "animate-spin")} />
            </Button>
          </div>
        }
      >
        <CardContent className="p-0">
          {filteredVehicles.length === 0 ? (
            <ModuleEmptyState
              title="Không có xe cần bảo trì"
              description={urgencyFilter === "urgent" ? "Không có xe quá hạn ≥ 300 km theo bộ lọc hiện tại." : "Không có xe phù hợp bộ lọc, hoặc tất cả xe đã được bảo trì đúng hạn."}
            />
          ) : (
            <ModuleResponsiveTable
              desktop={
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className={cn(rentalTableHeadClass, "w-12 text-center text-slate-600")}>STT</th>
                      <th className={cn(rentalTableHeadClass, "text-slate-600")}>Tên xe</th>
                      <th className={cn(rentalTableHeadClass, "text-slate-600")}>Biển số</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>KM hiện tại</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>KM cần bảo trì</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Quá hạn</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                    {paginatedVehicles.map((vehicle, index) => {
                      const mntKm = Math.floor(vehicle.current_km / 1000) * 1000
                      const overKm = vehicle.current_km - mntKm
                      return (
                        <tr key={vehicle.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-semibold">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <VehicleThumb src={vehicle.vehicleImages?.[0]} name={vehicle.name} />
                              <button
                                type="button"
                                className="font-bold text-slate-800 text-body hover:text-slate-700 hover:underline text-left truncate"
                                onClick={() => openDetailDialog(vehicle)}
                              >
                                {vehicle.name}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block bg-white text-slate-800 border border-slate-200 font-mono font-bold px-2.5 py-1 rounded-[var(--radius-badge)] text-sm shadow-sm tracking-wider uppercase">
                              {vehicle.licensePlate}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-sm font-medium text-slate-800 tabular-nums">{vehicle.current_km.toLocaleString()} km</td>
                          <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-slate-800 tabular-nums">{mntKm.toLocaleString()} km</td>
                          <td className="py-3.5 px-4 text-right">
                            <span className={cn(
                              "inline-flex items-center gap-1 font-mono text-sm font-bold",
                              overKm >= 300 ? "text-rose-600" : "text-amber-700"
                            )}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              +{overKm.toLocaleString()} km
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    className="h-9 w-9 p-0 border-emerald-200 rounded-[var(--radius-control)] text-emerald-700 hover:bg-emerald-50"
                                    disabled={maintaining === vehicle.id}
                                    title="Đã bảo trì"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white rounded-2xl border-0 card-shadow">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-800 font-bold text-lg">Xác nhận bảo trì?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm text-slate-500">
                                      Bạn chắc chắn {vehicle.name} ({vehicle.licensePlate}) đã bảo trì xong ở {vehicle.current_km.toLocaleString()} km? Mốc bảo trì tiếp theo sẽ được tính từ mốc này.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl border-slate-200">Hủy</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleMaintained(vehicle.id, vehicle.name, vehicle.current_km)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                                    >
                                      Xác nhận
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
              }
              mobile={paginatedVehicles.map((vehicle) => {
                const mntKm = Math.floor(vehicle.current_km / 1000) * 1000
                const overKm = vehicle.current_km - mntKm
                return (
                  <ModuleMobileCard key={vehicle.id}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <VehicleThumb src={vehicle.vehicleImages?.[0]} name={vehicle.name} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="font-semibold text-slate-800 hover:text-slate-700 hover:underline text-left truncate"
                            onClick={() => openDetailDialog(vehicle)}
                          >
                            {vehicle.name}
                          </button>
                          <p className="text-sm text-slate-500 font-mono">{vehicle.licensePlate}</p>
                        </div>
                      </div>
                      <span className={cn(
                        maintenanceBadgeClass,
                        "shrink-0",
                        overKm >= 300
                          ? "bg-rose-50 text-rose-700 border-rose-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      )}>
                        +{overKm.toLocaleString()} km
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-slate-500">
                      <span className="tabular-nums">{vehicle.current_km.toLocaleString()} km</span>
                      <span className="tabular-nums">Mốc: {mntKm.toLocaleString()} km</span>
                    </div>
                    
                    {/* Mobile action bar */}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/50">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-9 w-9 p-0 text-slate-500"
                        onClick={() => openDetailDialog(vehicle)}
                        title="Chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          if (window.confirm(`Bạn chắc chắn ${vehicle.name} (${vehicle.licensePlate}) đã bảo trì xong ở ${vehicle.current_km.toLocaleString()} km?`)) {
                            handleMaintained(vehicle.id, vehicle.name, vehicle.current_km)
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 !text-white rounded-[var(--radius-control)] text-meta h-9 px-3.5 font-semibold"
                      >
                        Bảo trì xong
                      </Button>
                    </div>
                  </ModuleMobileCard>
                )
              })}
            />
          )}
        </CardContent>
        {filteredVehicles.length > 0 && (
        <ModulePagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredVehicles.length}
          itemLabel="xe"
          onPageChange={setCurrentPage}
          className="rounded-b-2xl"
        />
        )}
      </ModuleSectionCard>
      </div>

      {/* Vehicle Detail Dialog */}
      <Dialog open={!!viewingVehicle} onOpenChange={(open) => !open && setViewingVehicle(null)}>
        <EntityFormDialogContent accent="amber" maxWidth="xl">
          {viewingVehicle && (() => {
            const v = viewingVehicle
            const mntKm = Math.floor(v.current_km / 1000) * 1000
            const overKm = v.current_km - mntKm
            const nextKm = mntKm + 1000
            const vOrders = orders.filter((o) => o.vehicleId === v.id)
            const recentOrders = [...vOrders]
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
              .slice(0, 4)
            const loc = parseVehicleDisplayNotes(v.notes)
            const photo = (v.vehicleImages || []).find((img) => typeof img === "string") as string | undefined
            const overduePct = Math.min(100, Math.round((overKm / 1000) * 100))

            return (
              <>
                <div className="flex items-start gap-3 sm:gap-4 mb-5">
                  <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-slate-200 bg-slate-50">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={v.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Car className="h-7 w-7 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <h2 className="text-title text-pretty">{v.name}</h2>
                    <p className="text-meta mt-0.5 font-mono tracking-wide">
                      {v.licensePlate || "Chưa biển"}
                      {v.color ? ` · ${v.color}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={cn(maintenanceBadgeClass, rentalVehicleStatusBadgeClass(v.status))}>
                        {getRentalVehicleStatusLabel(v.status)}
                      </span>
                      <span className={cn(
                        maintenanceBadgeClass,
                        "gap-1",
                        overKm >= 300
                          ? "bg-rose-50 text-rose-700 border-rose-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      )}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Quá hạn +{overKm.toLocaleString("vi-VN")} km
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-label text-slate-500">Tiến độ chu kỳ 1.000 km</p>
                        <p className="text-body font-semibold tabular-nums text-slate-900 mt-0.5">
                          {v.current_km.toLocaleString("vi-VN")} → mốc {nextKm.toLocaleString("vi-VN")} km
                        </p>
                      </div>
                      <p className={cn(
                        "text-body font-semibold tabular-nums shrink-0",
                        overKm >= 300 ? "text-rose-700" : "text-amber-800"
                      )}>
                        +{overKm.toLocaleString("vi-VN")} km
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full", overKm >= 300 ? "bg-rose-500" : "bg-amber-500")}
                        style={{ width: `${overduePct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <MaintStat label="KM hiện tại" value={`${v.current_km.toLocaleString("vi-VN")} km`} />
                    <MaintStat label="Mốc bảo trì" value={`${mntKm.toLocaleString("vi-VN")} km`} />
                    <MaintStat
                      label="Lần BT gần nhất"
                      value={`${(v.last_maintenance_km ?? 0).toLocaleString("vi-VN")} km`}
                    />
                    <MaintStat label="Tổng đơn" value={`${vOrders.length} đơn`} />
                    <MaintStat label="Giá thuê / ngày" value={formatPrice(v.pricePerDay)} />
                    <MaintStat label="Giá mua" value={formatPrice(v.purchasePrice)} tone="amber" />
                  </div>

                  {loc.location && (
                    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-slate-50/80 px-3 py-3">
                      <p className="text-label text-slate-500 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        Vị trí hiện tại
                      </p>
                      <p className="text-body text-slate-800 mt-1">{loc.location}</p>
                    </div>
                  )}

                  {loc.cleanNotes && (
                    <div className="rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-3">
                      <p className="text-label text-slate-500 mb-1">Ghi chú</p>
                      <p className="text-body text-slate-700 whitespace-pre-line">{loc.cleanNotes}</p>
                    </div>
                  )}

                  {recentOrders.length > 0 && (
                    <div>
                      <p className="text-label text-slate-500 mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-2">
                        {recentOrders.map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-body font-semibold text-slate-800 truncate">{o.customerName}</p>
                              <p className="text-meta">{formatDisplayDate(o.startDate)} → {formatDisplayDate(o.endDate)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-body money tabular-nums text-slate-900">
                                {(o.totalPrice || 0).toLocaleString("vi-VN")} đ
                              </p>
                              <span className={cn(maintenanceBadgeClass, rentalOrderStatusBadgeClass(o.status), "mt-1")}>
                                {getRentalOrderStatusLabel(o.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(v.vehicleImages?.length > 0 || v.documentImages?.length > 0) ? (
                    <div className="space-y-3">
                      {v.vehicleImages?.length > 0 && (
                        <div>
                          <p className="text-label text-slate-500 mb-2">Ảnh xe</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {v.vehicleImages.map((img, index) => (
                              <div key={index} className="aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {v.documentImages?.length > 0 && (
                        <div>
                          <p className="text-label text-slate-500 mb-2">Ảnh giấy tờ</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {v.documentImages.map((img, index) => (
                              <div key={index} className="aspect-square rounded-[var(--radius-control)] overflow-hidden border border-slate-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 rounded-[var(--radius-control)] border border-slate-200 bg-white px-3 py-2.5">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-meta">Chưa có ảnh xe / giấy tờ</span>
                    </div>
                  )}

                  <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 mt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:flex-1 rounded-[var(--radius-control)] border-slate-200"
                      onClick={() => setViewingVehicle(null)}
                    >
                      Đóng
                    </Button>
                    <Button
                      className="h-11 w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 !text-white rounded-[var(--radius-control)] [&_svg]:!text-white"
                      disabled={maintaining === v.id}
                      onClick={async () => {
                        await handleMaintained(v.id, v.name, v.current_km)
                        setViewingVehicle(null)
                      }}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Đã bảo trì
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

      {/* Collapsible Guidelines Section */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl overflow-hidden">
        <button 
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left font-semibold text-blue-900 hover:bg-blue-50/80 transition-colors"
        >
          <span className="flex items-center gap-2">Hướng dẫn bảo trì</span>
          {isGuideOpen ? <ChevronUp className="w-4 h-4 text-blue-700" /> : <ChevronDown className="w-4 h-4 text-blue-700" />}
        </button>
        {isGuideOpen && (
          <div className="px-5 pb-5 pt-1 border-t border-blue-100/50">
            <ul className="text-sm text-blue-800/90 space-y-2">
              <li>• Xe được đánh dấu cần bảo trì khi ODO đạt bội số của 1000 KM</li>
              <li>• Ví dụ: Xe mới chưa bảo trì (0 KM) → cần bảo trì lần đầu ở 1000 KM</li>
              <li>• Sau khi bảo trì 1000 KM → lần tiếp theo ở 2000 KM, 3000 KM, v.v...</li>
              <li>• Bấm "Đã bảo trì" để reset bộ đếm sau khi hoàn tất bảo trì</li>
            </ul>
          </div>
        )}
      </div>
    </ModulePageShell>
  )
}
