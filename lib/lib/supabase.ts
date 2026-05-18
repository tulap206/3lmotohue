import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: "available" | "rented" | "maintenance"
  currentKm: number
  purchasePrice: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
  totalRentalDays?: number
  totalRevenue?: number
  profit?: number
  maintenanceCost?: number
  created_at?: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  facebook: string
  address: string
  idCard: string
  totalRentals: number
  status: "active" | "inactive"
  customerPhoto: string[]
  cccdFront: string[]
  cccdBack: string[]
  licenseFront: string[]
  licenseBack: string[]
  createdAt?: string
  created_at?: string
}

export interface Rental {
  id: string
  customerId: string
  customerName: string
  vehicleId: string
  vehicleName: string
  licensePlate: string
  startDate: string
  endDate: string
  totalDays: number
  pricePerDay: number
  totalPrice: number
  deposit: number
  extraFees: number
  notes: string
  revenue: number
  status: "pending" | "active" | "completed" | "cancelled"
  createdAt: string
  created_at?: string
}

// Helper functions
export const fetchVehicles = async () => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching vehicles:', error)
    return []
  }
  return data || []
}

export const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching customers:', error)
    return []
  }
  return data || []
}

export const fetchRentals = async () => {
  const { data, error } = await supabase
    .from('rentals')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching rentals:', error)
    return []
  }
  return data || []
}

export const fetchAccessLogs = async () => {
  const { data, error } = await supabase
    .from('access_logs')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching access logs:', error)
    return []
  }
  return data || []
}