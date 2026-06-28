import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface MetricCardProps {
  icon?: React.ReactNode
  label: string
  value: string | number | React.ReactNode
  sublabel?: string
  trend?: {
    direction: "up" | "down" | "neutral"
    value?: string
  }
  backgroundColor?: string
  iconColor?: string
  delay?: number
  onClick?: () => void
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
}: MetricCardProps) {
  return (
    <Card
      className={`metric-card card-animate ${backgroundColor} cursor-pointer`}
      style={{ animationDelay: `${delay * 60}ms` }}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          {sublabel && (
            <p className="text-xs text-slate-500">{sublabel}</p>
          )}
        </div>
        {icon && (
          <div className={`${iconColor} text-xl flex-shrink-0`}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-3">
          <div className={`font-bold text-slate-900 truncate ${
            String(value).length > 12 
              ? "text-lg xl:text-xl" 
              : String(value).length > 8 
                ? "text-xl xl:text-2xl" 
                : "text-2xl xl:text-3xl"
          }`} title={String(value)}>
            {value}
          </div>
          {trend && (
            <div
              className={`text-sm font-medium flex items-center gap-1 ${
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
