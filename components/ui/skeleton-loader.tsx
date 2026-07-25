import React from "react"

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-[var(--radius-container)] border border-slate-100 p-4 card-animate shadow-[var(--shadow-card)]">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="skeleton skeleton-text w-28 h-3" />
            <div className="skeleton skeleton-text w-20 h-2.5" />
          </div>
        </div>
        <div className="skeleton skeleton-text w-36 h-7" />
      </div>
    </div>
  )
}

export function SkeletonMetricCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-[var(--radius-container)] border border-slate-100 overflow-hidden shadow-[var(--shadow-card)]">
      <div className="border-b border-slate-100 p-4 flex gap-4 bg-slate-50/40">
        <div className="skeleton skeleton-text w-32 h-3" />
        <div className="skeleton skeleton-text w-40 flex-1 h-3" />
        <div className="skeleton skeleton-text w-24 h-3" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4 items-center" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="skeleton skeleton-text w-32 flex-1 h-3.5" />
            <div className="skeleton skeleton-text w-40 h-3.5" />
            <div className="skeleton skeleton-text w-24 h-3.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-[var(--radius-container)] border border-slate-100 p-4 card-animate shadow-[var(--shadow-card)]"
        >
          <div className="skeleton skeleton-text w-28 h-3 mb-3" />
          <div className="h-52 skeleton rounded-[var(--radius-control)]" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="h-16 skeleton rounded-[var(--radius-container)]" />
      <SkeletonMetricCards count={5} />
      <SkeletonCharts />
      <SkeletonTable rows={5} />
    </div>
  )
}
