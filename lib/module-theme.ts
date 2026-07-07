export type ModuleId = "rental" | "sales" | "pawnshop" | "loan"
export type ModuleAccent = "red" | "blue" | "amber" | "emerald"

export type ModuleTheme = {
  id: ModuleId
  accent: ModuleAccent
  titleSuffix: string
  adminClass: string
  label: string
}

export const MODULE_THEME: Record<ModuleId, ModuleTheme> = {
  rental: {
    id: "rental",
    accent: "red",
    titleSuffix: "CHO THUÊ XE 79",
    adminClass: "rental-admin",
    label: "Cho thuê xe",
  },
  sales: {
    id: "sales",
    accent: "blue",
    titleSuffix: "MUA BÁN XE 79",
    adminClass: "sales-admin",
    label: "Mua bán xe",
  },
  pawnshop: {
    id: "pawnshop",
    accent: "amber",
    titleSuffix: "CẦM ĐỒ 79",
    adminClass: "pawnshop-admin",
    label: "Cầm đồ",
  },
  loan: {
    id: "loan",
    accent: "emerald",
    titleSuffix: "HỖ TRỢ TÀI CHÍNH 79",
    adminClass: "loan-admin",
    label: "Hỗ trợ tài chính",
  },
}

export const ACCENT_TITLE_CLASS: Record<ModuleAccent, string> = {
  red: "text-blue-600",
  blue: "text-blue-600",
  amber: "text-amber-500",
  emerald: "text-emerald-600",
}

export const ACCENT_BTN_CLASS: Record<ModuleAccent, string> = {
  red: "bg-blue-600 hover:bg-blue-700 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  amber: "bg-amber-500 hover:bg-amber-600 text-slate-950",
  emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
}

export const ACCENT_BTN_OUTLINE_CLASS: Record<ModuleAccent, string> = {
  red: "border-red-200 text-blue-700 hover:bg-blue-50",
  blue: "border-blue-200 text-blue-700 hover:bg-blue-50",
  amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
  emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
}

export const ACCENT_KPI_HOVER_CLASS: Record<ModuleAccent, string> = {
  red: "hover:border-red-100",
  blue: "hover:border-blue-100",
  amber: "hover:border-amber-100",
  emerald: "hover:border-emerald-100",
}

export const ACCENT_BADGE_CLASS: Record<ModuleAccent, string> = {
  red: "bg-blue-50 text-blue-700 border-red-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  amber: "bg-amber-50 text-amber-800 border-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
}

export const ACCENT_ICON_CLASS: Record<ModuleAccent, string> = {
  red: "text-blue-600",
  blue: "text-blue-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
}

export const MODULE_CHART_PALETTE: Record<ModuleId, string[]> = {
  rental: ["#DC2626", "#059669", "#0369A1", "#7C6BA8", "#64748B"],
  sales: ["#2563EB", "#059669", "#D97706", "#7C6BA8", "#64748B"],
  pawnshop: ["#D97706", "#059669", "#0369A1", "#7C6BA8", "#C2410C", "#64748B"],
  loan: ["#059669", "#DC2626", "#2563EB", "#94A3B8", "#D97706"],
}

export function getModuleTheme(module: ModuleId): ModuleTheme {
  return MODULE_THEME[module]
}
