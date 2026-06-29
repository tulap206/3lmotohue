import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  icon?: React.ReactNode
  label: string
  value: string | number | React.ReactNode
  sublabel?: string | React.ReactNode
  trend?: {
    direction: "up" | "down" | "neutral"
    value?: string
  }
  backgroundColor?: string
  iconColor?: string
  delay?: number
  onClick?: () => void
  valueClassName?: string
}

export function MetricCard({
  icon,
  label,
  value,
  sublabel,
  trend,
  backgroundColor = "bg-white",
  iconColor = "text-blue-500",
  delay = 0,
  onClick,
  valueClassName,
}: MetricCardProps) {
  // Compute text length safely if value is a React node
  const textLength = React.isValidElement(value) ? 2 : String(value).length;

  return (
    <Card
      className={cn(
        backgroundColor === "bg-white" ? "bg-white border-slate-200" : "glass-card border-slate-100/50",
        "hover-lift transition-smooth cursor-pointer shadow-xs relative overflow-hidden rounded-2xl"
      )}
      style={{ animationDelay: `${delay * 60}ms` }}
      onClick={onClick}
    >
      {/* Premium ambient light spot */}
      <div className="absolute -top-6 -right-6 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          {sublabel && (
            <p className="text-xs text-slate-500">{sublabel}</p>
          )}
        </div>
        {icon && (
          <div className={`${iconColor} flex-shrink-0 w-9 h-9 rounded-xl bg-slate-50/50 backdrop-blur-xs flex items-center justify-center border border-slate-100/80 shadow-2xs`}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1 space-y-2">
        <div className="flex items-baseline gap-3">
          <div className={cn(
            "font-black tracking-tight truncate",
            valueClassName || "text-slate-800",
            textLength > 12 
              ? "text-base xl:text-lg" 
              : textLength > 8 
                ? "text-lg xl:text-xl" 
                : "text-xl xl:text-2xl"
          )} title={String(value)}>
            {value}
          </div>
          {trend && (
            <div
              className={`text-xs font-semibold flex items-center gap-1 ${
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                    ? "text-blue-600"
                    : "text-slate-500"
              }`}
            >
              {trend.direction === "up" && "↑"}
              {trend.direction === "down" && "↓"}
              {trend.value && trend.value}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

