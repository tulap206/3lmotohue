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
import { formatDisplayDate } from "@/lib/format-date"
import { useAuth } from "@/contexts/auth-context"

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
  return customers
    .map((customer) => {
      const activeRental = rentals.find(
        (r) => r.customerId === customer.id && r.status === "active"
      )
      const pendingRental = rentals.find(
        (r) => r.customerId === customer.id && r.status === "pending"
      )

      let status: Customer["status"] | "renting" | "pending" = "active"
      if (activeRental) status = "renting" as Customer["status"]
      else if (pendingRental) status = "pending" as Customer["status"]
      else if (customer.status === "inactive") status = "inactive"

      const totalrentals = rentals.filter((r) => r.customerId === customer.id).length

      return { ...customer, status, totalrentals }
    })
    .sort((a, b) => {
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

  return (
    <RentalDataContext.Provider
      value={{
        vehicles,
        customers,
        orders,
        isLoading,
        refresh: () => loadAll(false),
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
