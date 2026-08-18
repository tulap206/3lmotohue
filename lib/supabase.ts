import { createClient } from '@supabase/supabase-js'
import { getRentalTerm, buildRentalTermPayload, embedRentalTermInNotes } from '@/lib/rental-term'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create client with schema validation disabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
  // Disable schema caching
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types
export interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  pricePerDay: number
  status: "available" | "rented" | "maintenance" | "pending"
  current_km: number
  last_maintenance_km?: number
  purchasePrice: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
  category?: "car" | "bike"
  totalRentalDays?: number
  totalRevenue?: number
  profit?: number
  created_at?: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  facebook: string
  address: string
  idcard: string
  totalrentals: number
  status: "active" | "inactive" | "renting" | "pending"
  customerphoto: string[]
  cccdfront: string[]
  cccdback: string[]
  licensefront: string[]
  licenseback: string[]
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
  createdAt?: string
  created_at?: string
  rentalCode?: string // Optional: generated in-memory
  commissionHome?: number
  homeName?: string
  rentalTerm?: "short" | "long"
  received_at?: string
  completed_at?: string
}

export interface Transaction {
  id: string
  type: "income" | "expense"
  description: string
  amount: number
  user: string // username of person who recorded it
  timestamp: string
  created_at?: string
  created_by?: string // Track who created it for permission check
}

// Helper functions
export const fetchVehicles = async () => {
  const [vehiclesResult, rentalsResult] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id,name,licensePlate,color,pricePerDay,status,current_km,purchasePrice,notes,vehicleImages,documentImages,totalRentalDays,totalRevenue,profit,created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('rentals')
      .select('vehicleId,status')
      .in('status', ['active', 'pending'])
  ])
  
  if (vehiclesResult.error) {
    console.error('Error fetching vehicles:', vehiclesResult.error)
    return []
  }
  
  const activeVehicleIds = new Set<string>()
  const pendingVehicleIds = new Set<string>()
  
  if (rentalsResult.data) {
    rentalsResult.data.forEach((r: any) => {
      if (r.status === 'active' && r.vehicleId) {
        activeVehicleIds.add(r.vehicleId)
      } else if (r.status === 'pending' && r.vehicleId) {
        pendingVehicleIds.add(r.vehicleId)
      }
    })
  }
  
  // Ensure all vehicles have the required fields with defaults and correct dynamic status
  return (vehiclesResult.data || []).map(vehicle => {
    let status = vehicle.status
    if (status !== 'maintenance') {
      if (activeVehicleIds.has(vehicle.id)) {
        status = 'rented'
      } else if (pendingVehicleIds.has(vehicle.id)) {
        status = 'pending'
      } else {
        if (status !== 'pending') {
          status = 'available'
        }
      }
    }
      return {
      ...vehicle,
      status: status as any,
      vehicleImages: Array.isArray(vehicle.vehicleImages) ? vehicle.vehicleImages : [],
      documentImages: Array.isArray(vehicle.documentImages) ? vehicle.documentImages : [],
      totalRentalDays: vehicle.totalRentalDays ?? 0,
      totalRevenue: vehicle.totalRevenue ?? 0,
      profit: vehicle.profit ?? 0,
    }
  })
}

export const fetchCustomers = async () => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select()
      .order('created_at', { ascending: false })
    
    if (error) {
      console.warn('Error with created_at sort, trying createdat:', error)
      // Fallback: try createdat
      const { data: data2, error: error2 } = await supabase
        .from('customers')
        .select()
        .order('createdat', { ascending: false })
      
      if (error2) {
        console.error('Error fetching customers:', error2)
        return []
      }
      return data2 || []
    }
    return data || []
  } catch (e) {
    console.error('Exception fetching customers:', e)
    return []
  }
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

// Insert/Update Rentals
export const insertRental = async (rental: Omit<Rental, 'id' | 'created_at' | 'createdAt'>) => {
  const term = getRentalTerm(rental)
  const termPayload = buildRentalTermPayload(term, rental.notes)
  const rentalWithTerm = { ...rental, ...termPayload }

  const { data, error } = await supabase
    .from('rentals')
    .insert([rentalWithTerm])
    .select()

  if (error) {
    if (/rentalTerm/i.test(error.message || "")) {
      const { rentalTerm: _omit, ...withoutCol } = rentalWithTerm
      const { data: data2, error: error2 } = await supabase
        .from('rentals')
        .insert([{ ...withoutCol, notes: embedRentalTermInNotes(rental.notes, term) }])
        .select()
      if (error2) {
        console.error('Error inserting rental:', error2)
        throw error2
      }
      return data2?.[0]
    }
    console.error('Error inserting rental:', error)
    throw error
  }
  return data?.[0]
}

export const updateRental = async (id: string, rental: Partial<Rental>) => {
  let payload = { ...rental }
  if (rental.rentalTerm || rental.notes !== undefined) {
    const term = getRentalTerm({ rentalTerm: rental.rentalTerm, notes: rental.notes })
    const termPayload = buildRentalTermPayload(term, rental.notes ?? "")
    payload = { ...payload, ...termPayload }
  }

  const { data, error } = await supabase
    .from('rentals')
    .update(payload)
    .eq('id', id)
    .select()

  if (error) {
    if (/rentalTerm/i.test(error.message || "") && payload.rentalTerm) {
      const { rentalTerm: _omit, ...withoutCol } = payload
      const term = getRentalTerm({ rentalTerm: rental.rentalTerm, notes: rental.notes })
      const { data: data2, error: error2 } = await supabase
        .from('rentals')
        .update({ ...withoutCol, notes: embedRentalTermInNotes(rental.notes, term) })
        .eq('id', id)
        .select()
      if (error2) {
        console.error('Error updating rental:', error2)
        throw error2
      }
      return data2?.[0]
    }
    console.error('Error updating rental:', error)
    throw error
  }
  return data?.[0]
}

export const deleteRental = async (id: string) => {
  const { error } = await supabase
    .from('rentals')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting rental:', error)
    throw error
  }
}

// Insert/Update Vehicles
export const insertVehicle = async (vehicle: Omit<Vehicle, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('vehicles')
    .insert([vehicle])
    .select()
  
  if (error) {
    console.error('Error inserting vehicle:', error)
    throw error
  }
  return data?.[0]
}

export const updateVehicle = async (id: string, vehicle: Partial<Vehicle>) => {
  const { data, error } = await supabase
    .from('vehicles')
    .update(vehicle)
    .eq('id', id)
    .select()
  
  if (error) {
    console.error('Error updating vehicle:', error)
    throw error
  }
  return data?.[0]
}

export const deleteVehicle = async (id: string) => {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting vehicle:', error)
    throw error
  }
}

// Insert/Update Customers
export const insertCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'createdAt'>) => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
  
  if (error) {
    console.error('Error inserting customer:', error)
    throw error
  }
  return data?.[0]
}

export const updateCustomer = async (id: string, customer: Partial<Customer>) => {
  const { data, error } = await supabase
    .from('customers')
    .update(customer)
    .eq('id', id)
    .select()
  
  if (error) {
    console.error('Error updating customer:', error)
    throw error
  }
  return data?.[0]
}

export const deleteCustomer = async (id: string) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting customer:', error)
    throw error
  }
}

// Insert Access Log
export const insertAccessLog = async (action: string, module: string, details: string, userId?: string) => {
  const { error } = await supabase
    .from('access_logs')
    .insert([{
      action,
      module,
      details,
      userId,
      timestamp: new Date().toISOString()
    }])
  
  if (error) {
    console.error('Error inserting access log:', error)
    // Don't throw - logging failures shouldn't break the app
  }
}

// Transaction Functions
export const fetchTransactions = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
  return data || []
}

export const fetchUserDisplayNames = async (): Promise<Record<string, string>> => {
  const { data, error } = await supabase
    .from('auth_users')
    .select('username, displayname')

  if (error) {
    console.error('Error fetching user display names:', error)
    return {}
  }

  const map: Record<string, string> = {}
  for (const row of data || []) {
    const username = String(row.username || "").trim()
    if (!username) continue
    const displayName = String(row.displayname || "").trim()
    map[username.toLowerCase()] = displayName || username
  }
  return map
}

export function getUserDisplayName(
  username: string | null | undefined,
  displayNames: Record<string, string>
) {
  const key = String(username || "").trim()
  if (!key) return "—"
  return displayNames[key.toLowerCase()] || key
}

export const insertTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at'>) => {
  console.log("📝 [insertTransaction] Attempting to insert:", transaction)
  
  const { data, error } = await supabase
    .from('transactions')
    .insert([{
      type: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      user: transaction.user,
      timestamp: transaction.timestamp,
      created_by: transaction.user,
    }])
    .select()
  
  if (error) {
    console.error('❌ [insertTransaction] Error details:', {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details,
      fullError: error
    })
    throw error
  }
  
  console.log("✅ [insertTransaction] Success:", data)
  return data?.[0]
}

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting transaction:', error)
    throw error
  }
}

export const updateTransaction = async (id: string, updates: Partial<Omit<Transaction, 'id'>>) => {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
  
  if (error) {
    console.error('Error updating transaction:', error)
    throw error
  }
  return data?.[0]
}
// =========================================================================
// MAINTENANCE MANAGEMENT
// =========================================================================

export interface MaintenanceVehicle extends Vehicle {
  next_maintenance_km: number
  km_until_maintenance: number
}

export const calculateMaintenanceStatus = (vehicle: Vehicle): MaintenanceVehicle => {
  const lastMaintenanceKm = vehicle.last_maintenance_km ?? 0
  const nextMaintenanceKm = Math.floor(lastMaintenanceKm / 1000) * 1000 + 1000
  const kmUntilMaintenance = nextMaintenanceKm - vehicle.current_km

  return {
    ...vehicle,
    next_maintenance_km: nextMaintenanceKm,
    km_until_maintenance: kmUntilMaintenance
  }
}

export const getVehiclesDueMaintenance = async (): Promise<MaintenanceVehicle[]> => {
  try {
    const vehicles = await fetchVehicles()
    return vehicles
      .map(v => calculateMaintenanceStatus(v))
      .filter(v => v.km_until_maintenance <= 0)
      .sort((a, b) => a.km_until_maintenance - b.km_until_maintenance)
  } catch (error) {
    console.error("Error getting vehicles due for maintenance:", error)
    return []
  }
}

export const markVehicleAsMaintained = async (vehicleId: string, currentKm: number) => {
  try {
    await updateVehicle(vehicleId, {
      last_maintenance_km: currentKm
    })
    await insertAccessLog(
      'VEHICLE_MAINTAINED',
      'maintenance',
      `Xe được đánh dấu bảo trì xong tại ${currentKm}km`
    )
    return true
  } catch (error) {
    console.error("Error marking vehicle as maintained:", error)
    throw error
  }
}
