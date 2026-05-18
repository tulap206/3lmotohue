import { createClient } from '@supabase/supabase-js'

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
  status: "available" | "rented" | "maintenance"
  current_km: number
  purchasePrice: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
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
    .select('id,name,licensePlate,color,pricePerDay,status,current_km,purchasePrice,notes,vehicleImages,documentImages,totalRentalDays,totalRevenue,profit,created_at')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching vehicles:', error)
    return []
  }
  
  // Ensure all vehicles have the required fields with defaults
  return (data || []).map(vehicle => ({
    ...vehicle,
    totalRentalDays: vehicle.totalRentalDays ?? 0,
    totalRevenue: vehicle.totalRevenue ?? 0,
    profit: vehicle.profit ?? 0,
  }))
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

// Insert/Update Rentals
export const insertRental = async (rental: Omit<Rental, 'id' | 'created_at' | 'createdAt'>) => {
  const { data, error } = await supabase
    .from('rentals')
    .insert([rental])
    .select()
  
  if (error) {
    console.error('Error inserting rental:', error)
    throw error
  }
  return data?.[0]
}

export const updateRental = async (id: string, rental: Partial<Rental>) => {
  const { data, error } = await supabase
    .from('rentals')
    .update(rental)
    .eq('id', id)
    .select()
  
  if (error) {
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