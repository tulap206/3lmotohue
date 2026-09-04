/**
 * Centralized TypeScript type definitions for 79moto application
 * This is the single source of truth for all data types across the app
 */

// ============ USER & AUTH TYPES ============

export type UserRole = 'admin' | 'mod' | 'staff'

export interface UserPermissions {
  canAccessRental: boolean
  canAccessPawnshop: boolean
  canAccessLoan: boolean
  canAccessSales: boolean
  canDelete: boolean
  canBackup: boolean
  canViewAccessHistory: boolean
  canManageUsers: boolean
  canDeleteRental: boolean
  canDeletePawnshop: boolean
  canDeleteLoan: boolean
  canDeleteSales: boolean
  canBackupRental: boolean
  canBackupPawnshop: boolean
  canBackupLoan: boolean
  canBackupSales: boolean
  canViewHistoryRental: boolean
  canViewHistoryPawnshop: boolean
  canViewHistoryLoan: boolean
  canViewHistorySales: boolean
}

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  permissions: UserPermissions
}

// ============ VEHICLE TYPES ============

export type VehicleCategory = 'car' | 'bike' | 'electric'
export type VehicleStatus = 'available' | 'rented' | 'maintenance'

export interface Vehicle {
  id: string
  name: string
  licensePlate: string
  color: string
  category: VehicleCategory
  pricePerDay: number
  status: VehicleStatus
  current_km: number
  last_maintenance_km?: number
  purchasePrice: number
  notes: string
  vehicleImages: string[]
  documentImages: string[]
  totalRentalDays?: number
  totalRevenue?: number
  profit?: number
  created_at?: string
  updated_at?: string
}

// ============ CUSTOMER TYPES ============

export type CustomerStatus = 'active' | 'inactive' | 'renting' | 'pending' | 'blocked'

export interface Customer {
  id: string
  name: string
  phone: string
  facebook?: string
  address?: string
  idcard: string
  totalrentals: number
  status: CustomerStatus
  customerphoto?: string[]
  cccdfront?: string[]
  cccdback?: string[]
  licensefront?: string[]
  licenseback?: string[]
  birthday?: string
  created_at?: string
  updated_at?: string
}

// ============ RENTAL TYPES ============

export type RentalStatus = 'pending' | 'active' | 'completed' | 'cancelled'

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
  notes?: string
  revenue: number
  status: RentalStatus
  created_at: string
  updated_at?: string
  rentalCode?: string
  commissionHome?: number
  homeName?: string
}

// ============ PAWNSHOP TYPES ============

export type ContractStatus = 'active' | 'expired' | 'redeemed' | 'forfeited'
export type ItemCategory = 'vehicle' | 'jewelry' | 'electronics' | 'other'

export interface PawnshopItem {
  id: string
  name: string
  category: ItemCategory
  estimatedValue: number
  condition: string
  images?: string[]
  description?: string
}

export interface PawnshopContract {
  id: string
  customerId: string
  customerName: string
  itemId: string
  itemName: string
  loanAmount: number
  interestRate: number
  durationDays: number
  startDate: string
  dueDate: string
  status: ContractStatus
  notes?: string
  created_at: string
  updated_at?: string
  isOverdue?: boolean
  daysOverdue?: number
}

// ============ LOAN TYPES ============

export type LoanStatus = 'pending' | 'active' | 'completed' | 'overdue' | 'default'
export type PaymentTerms = 'monthly' | 'quarterly' | 'yearly' | 'one-time'

export interface LoanAgreement {
  id: string
  customerId: string
  customerName: string
  principal: number
  interestRate: number
  startDate: string
  dueDate: string
  paymentTerms: PaymentTerms
  status: LoanStatus
  amountPaid: number
  interestPaid: number
  notes?: string
  created_at: string
  updated_at?: string
  isOverdue?: boolean
  daysOverdue?: number
}

// ============ TRANSACTION TYPES ============

export type TransactionType = 'income' | 'expense'
export type TransactionCategory =
  | 'rental_income'
  | 'pawnshop_income'
  | 'loan_income'
  | 'vehicle_maintenance'
  | 'operational'
  | 'other'

export interface Transaction {
  id: string
  type: TransactionType
  category?: TransactionCategory
  description: string
  amount: number
  relatedEntityId?: string
  relatedEntityType?: 'rental' | 'pawnshop' | 'loan' | 'vehicle'
  user?: string
  created_by?: string
  timestamp: string
  created_at?: string
  updated_at?: string
}

// ============ ACCESS LOG TYPES ============

export interface AccessLog {
  id: string
  userId?: string
  username: string
  displayName: string
  action: string
  module: string
  details: string
  ipAddress: string
  device_info?: string
  user_agent?: string
  timestamp: Date | string
  created_at?: string
}

// ============ DASHBOARD METRICS TYPES ============

export interface DashboardMetrics {
  totalVehicles: number
  activeVehicles: number
  totalCustomers: number
  activeRentals: number
  totalRevenue: number
  totalExpense: number
  profit: number
}

export interface RentalMetrics extends DashboardMetrics {
  activeRentals: number
  completedRentals: number
  pendingRentals: number
}

export interface PawnshopMetrics {
  totalContracts: number
  activeContracts: number
  overdueContracts: number
  totalCapital: number
  availableCapital: number
  expectedInterest: number
}

export interface LoanMetrics {
  totalAgreements: number
  activeAgreements: number
  overdueAgreements: number
  availableCapital: number
  totalCapitalIssued: number
  totalInterestEarned: number
}

// ============ FORM DATA TYPES ============

export interface RentalFormData {
  customerId: string
  vehicleId: string
  startDate: string
  endDate: string
  deposit: number
  commissionHome?: number
  homeName?: string
}

export interface CustomerFormData {
  name: string
  phone: string
  facebook?: string
  address?: string
  idcard: string
  customerphoto?: string[]
  cccdfront?: string[]
  cccdback?: string[]
  licensefront?: string[]
  licenseback?: string[]
  birthday?: string
}

export interface VehicleFormData {
  name: string
  licensePlate: string
  color: string
  category: VehicleCategory
  pricePerDay: number
  purchasePrice: number
  current_km: number
  notes?: string
  vehicleImages?: string[]
  documentImages?: string[]
}

export interface PawnshopContractFormData {
  customerId: string
  itemName: string
  loanAmount: number
  interestRate: number
  durationDays: number
  notes?: string
}

export interface LoanAgreementFormData {
  customerId: string
  principal: number
  interestRate: number
  durationDays: number
  paymentTerms: PaymentTerms
  notes?: string
}

// ============ API RESPONSE TYPES ============

export interface ApiResponse<T> {
  data?: T
  error?: {
    message: string
    code?: string
  }
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ============ FILTER & SEARCH TYPES ============

export interface RentalFilters {
  status?: RentalStatus
  customerId?: string
  vehicleId?: string
  startDate?: string
  endDate?: string
}

export interface ContractFilters {
  status?: ContractStatus
  customerId?: string
  isOverdue?: boolean
}

export interface AgreementFilters {
  status?: LoanStatus
  customerId?: string
  isOverdue?: boolean
}

// ============ UTILITY TYPES ============

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type AsyncFunction<T> = () => Promise<T>

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}
