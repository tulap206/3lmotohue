/**
 * Format number to Vietnamese currency format with thousand separators
 * Example: 1000000 → "1.000.000"
 */
export const formatMoneyInput = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // Add dots as thousand separators
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Parse formatted money string back to number
 * Example: "1.000.000" → 1000000
 */
export const parseMoneyInput = (value: string): number => {
  return parseInt(value.replace(/\./g, ''), 10) || 0
}

/**
 * Display money with formatting
 * Example: 1000000 → "1.000.000 VND"
 */
export const displayMoney = (value: number): string => {
  return value.toLocaleString('vi-VN') + ' đ'
}
