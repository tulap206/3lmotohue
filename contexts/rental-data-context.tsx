"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import {
  supabase,
  fetchVehicles,
  fetchCustomers,
  fetchRentals,
  Vehicle,
  Customer,
  Rental,
} from "@/lib/supabase"
import { formatDisplayDate, parseDisplayDate } from "@/lib/format-date"
import { useAuth } from "@/contexts/auth-context"
import { showSuccess } from "@/lib/toast-utils"

export interface RentalOrder extends Rental {
  rentalCode?: string
}

interface RentalDataContextValue {
  vehicles: Vehicle[]
  customers: Customer[]
  orders: RentalOrder[]
  isLoading: boolean
  refresh: () => Promise<void>
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  setOrders: React.Dispatch<React.SetStateAction<RentalOrder[]>>
}

const RentalDataContext = createContext<RentalDataContextValue | null>(null)

function parseVietnamDate(dateStr: string): Date {
  if (!dateStr) return new Date(0)
  const parts = dateStr.split("/")
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
  }
  return new Date(dateStr)
}

function generateRentalCode(customerName: string, licensePlate: string, startDate: string, uuid: string): string {
  try {
    const lastName = customerName.split(/\s+/).pop() || ""
    const cleanPlate = licensePlate.replace(/[\s-]/g, "").toUpperCase()
    const parsedDate = parseVietnamDate(startDate)
    const dateFormatted = formatDisplayDate(parsedDate).replace(/\//g, "")
    return `${lastName}-${cleanPlate}-${dateFormatted}`
  } catch {
    return uuid.slice(0, 8)
  }
}

function enrichCustomersWithStatus(customers: Customer[], rentals: Rental[]): Customer[] {
  const latestRentalTimeMap = new Map<string, number>()
  for (const r of rentals) {
    const cId = r.customerId || (r as any).customer_id
    if (!cId) continue
    const dStart = parseDisplayDate(r.startDate || (r as any).start_date)?.getTime() || 0
    const dEnd = parseDisplayDate(r.endDate || (r as any).end_date)?.getTime() || 0
    const dCreated = new Date(r.created_at || (r as any).createdAt || 0).getTime() || 0
    const maxTime = Math.max(dStart, dEnd, dCreated)
    const current = latestRentalTimeMap.get(cId) || 0
    if (maxTime > current) {
      latestRentalTimeMap.set(cId, maxTime)
    }
  }

  return customers
    .map((customer) => {
      const activeRental = rentals.find(
        (r) => (r.customerId === customer.id || (r as any).customer_id === customer.id) && r.status === "active"
      )
      const pendingRental = rentals.find(
        (r) => (r.customerId === customer.id || (r as any).customer_id === customer.id) && r.status === "pending"
      )

      let status: Customer["status"] | "renting" | "pending" | "blocked" = "active"
      if (customer.status === "blocked" || (customer.status as string) === "blacklist") {
        status = "blocked"
      } else if (activeRental) {
        status = "renting" as Customer["status"]
      } else if (pendingRental) {
        status = "pending" as Customer["status"]
      } else if (customer.status === "inactive") {
        status = "inactive"
      }

      const totalrentals = rentals.filter((r) => r.customerId === customer.id || (r as any).customer_id === customer.id).length

      return { ...customer, status, totalrentals }
    })
    .sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === "renting") return 1
        if (status === "pending") return 2
        if (status === "active") return 3
        if (status === "inactive") return 4
        if (status === "blocked" || status === "blacklist") return 5
        return 6
      }
      const pA = getPriority(a.status)
      const pB = getPriority(b.status)
      if (pA !== pB) return pA - pB

      const timeA = latestRentalTimeMap.get(a.id) || new Date((a as { createdAt?: string }).createdAt || a.created_at || 0).getTime()
      const timeB = latestRentalTimeMap.get(b.id) || new Date((b as { createdAt?: string }).createdAt || b.created_at || 0).getTime()
      if (timeA !== timeB) return timeB - timeA

      const dateA = new Date((a as { createdAt?: string }).createdAt || a.created_at || 0).getTime()
      const dateB = new Date((b as { createdAt?: string }).createdAt || b.created_at || 0).getTime()
      return dateB - dateA
    })
}

function enrichRentalsWithCodes(rentals: Rental[]): RentalOrder[] {
  return rentals
    .sort((a, b) => {
      return new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime()
    })
    .map((rental) => {
      if (!rental.rentalCode) {
        const code = generateRentalCode(
          rental.customerName,
          rental.licensePlate,
          rental.startDate,
          rental.id
        )
        return { ...rental, rentalCode: code }
      }
      return rental as RentalOrder
    })
}

export function RentalDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<RentalOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const initialFetchDone = useRef(false)

  const loadAll = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true)

      const [vehiclesData, customersData, rentalsData] = await Promise.all([
        fetchVehicles(),
        fetchCustomers(),
        fetchRentals(),
      ])

      const sortedVehicles = (vehiclesData || []).sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      })

      setVehicles(sortedVehicles)
      setCustomers(enrichCustomersWithStatus(customersData || [], rentalsData || []))
      setOrders(enrichRentalsWithCodes(rentalsData || []))
    } catch (error) {
      console.error("[RentalDataContext] Failed to load data:", error)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialFetchDone.current && user !== undefined) {
      initialFetchDone.current = true
      loadAll(true)
    }
  }, [user, loadAll])

  useEffect(() => {
    const channel = supabase
      .channel("rental-data-shared")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => {
        loadAll(false)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        loadAll(false)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, () => {
        loadAll(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAll])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const startTime = Date.now()
    try {
      await loadAll(false)
      const elapsed = Date.now() - startTime
      if (elapsed < 400) {
        await new Promise((r) => setTimeout(r, 400 - elapsed))
      }
      showSuccess("Đã làm mới dữ liệu")
    } catch (error) {
      console.error("[RentalDataContext] Refresh error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [loadAll])

  return (
    <RentalDataContext.Provider
      value={{
        vehicles,
        customers,
        orders,
        isLoading,
        refresh,
        setVehicles,
        setCustomers,
        setOrders,
      }}
    >
      {children}
    </RentalDataContext.Provider>
  )
}

export function useRentalData() {
  const ctx = useContext(RentalDataContext)
  if (!ctx) throw new Error("useRentalData must be used inside <RentalDataProvider>")
  return ctx
}
