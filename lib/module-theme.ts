export type ModuleId = "rental" | "sales" | "pawnshop" | "loan"
export type ModuleAccent = "red" | "blue" | "amber" | "emerald"

export type ModuleTheme = {
  id: ModuleId
  accent: ModuleAccent
  /** Short brand line for page headers (sentence case). */
  titleSuffix: string
  adminClass: string
  label: string
}

export const MODULE_THEME: Record<ModuleId, ModuleTheme> = {
  rental: {
    id: "rental",
    accent: "blue",
    titleSuffix: "Cho thuê xe · 3L Moto",
    adminClass: "rental-admin",
    label: "Cho thuê xe",
  },
  sales: {
    id: "sales",
    accent: "blue",
    titleSuffix: "Mua bán xe · 79",
    adminClass: "sales-admin",
    label: "Mua bán xe",
  },
  pawnshop: {
    id: "pawnshop",
    accent: "amber",
    titleSuffix: "Cầm đồ · 79",
    adminClass: "pawnshop-admin",
    label: "Cầm đồ",
  },
  loan: {
    id: "loan",
    accent: "emerald",
    titleSuffix: "Hỗ trợ tài chính · 79",
    adminClass: "loan-admin",
    label: "Hỗ trợ tài chính",
  },
}

export const ACCENT_TITLE_CLASS: Record<ModuleAccent, string> = {
  red: "text-rose-600",
  blue: "text-blue-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
}

export const ACCENT_BTN_CLASS: Record<ModuleAccent, string> = {
  red: "bg-rose-600 hover:bg-rose-700 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  amber: "bg-amber-600 hover:bg-amber-700 text-white",
  emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
}

export const ACCENT_BTN_OUTLINE_CLASS: Record<ModuleAccent, string> = {
  red: "border-rose-200 text-rose-700 hover:bg-rose-50",
  blue: "border-blue-200 text-blue-700 hover:bg-blue-50",
  amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
  emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
}

export const ACCENT_KPI_HOVER_CLASS: Record<ModuleAccent, string> = {
  red: "hover:border-rose-400 hover:shadow-[0_4px_20px_rgba(225,29,72,0.12)]",
  blue: "hover:border-blue-400 hover:shadow-[0_4px_20px_rgba(37,99,235,0.12)]",
  amber: "hover:border-amber-300 hover:shadow-[0_4px_20px_rgba(217,119,6,0.12)]",
  emerald: "hover:border-emerald-400 hover:shadow-[0_4px_20px_rgba(5,150,105,0.12)]",
}

export const ACCENT_BADGE_CLASS: Record<ModuleAccent, string> = {
  red: "bg-rose-50 text-rose-700 border-rose-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  amber: "bg-amber-50 text-amber-800 border-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
}

export const ACCENT_ICON_CLASS: Record<ModuleAccent, string> = {
  red: "text-rose-600",
  blue: "text-blue-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
}

/** Chart colors aligned with design tokens (cobalt / emerald / amber / slate). */
export const MODULE_CHART_PALETTE: Record<ModuleId, string[]> = {
  rental: ["#2563EB", "#059669", "#D97706", "#E11D48", "#64748B"],
  sales: ["#2563EB", "#059669", "#D97706", "#64748B", "#0369A1"],
  pawnshop: ["#D97706", "#059669", "#2563EB", "#64748B", "#C2410C"],
  loan: ["#059669", "#2563EB", "#D97706", "#64748B", "#E11D48"],
}

export function getModuleTheme(module: ModuleId): ModuleTheme {
  return MODULE_THEME[module]
}
