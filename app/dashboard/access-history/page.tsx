"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import {
  AccessHistoryModuleSection,
  type AccessLogRecord,
} from "@/components/dashboard/access-history-panel"
import { ModulePageShell, ModuleSubpageHeader } from "@/components/dashboard/module-shell"

export default function AccessHistoryPage() {
  const { user } = useAuth()
  const [accessLogs, setAccessLogs] = useState<AccessLogRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadAccessLogs = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)

      const { data, error } = await supabase
        .from("access_logs")
        .select("*")
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("Error fetching logs:", error)
        setAccessLogs([])
      } else {
        setAccessLogs(data || [])
      }
    } catch (error) {
      console.error("Failed to load access logs:", error)
      setAccessLogs([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccessLogs(true)

    const channel = supabase
      .channel("access-logs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "access_logs" }, () => {
        loadAccessLogs(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAccessLogs])

  return (
    <ModulePageShell module="rental">
      <ModuleSubpageHeader
        module="rental"
        title="Lịch sử truy cập"
        subtitle="Theo dõi hoạt động người dùng trên phân hệ cho thuê xe"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Lịch sử truy cập" },
        ]}
      />
      <AccessHistoryModuleSection
        module="rental"
        logs={accessLogs}
        loading={loading}
        onRefresh={() => loadAccessLogs(true)}
        allowed={user?.role === "admin" || user?.permissions?.canViewAccessHistory || false}
      />
    </ModulePageShell>
  )
}
