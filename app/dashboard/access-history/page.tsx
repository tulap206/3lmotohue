"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import {
  AccessHistoryModuleSection,
  type AccessLogRecord,
} from "@/components/dashboard/access-history-panel"
import { ModulePageShell } from "@/components/dashboard/module-shell"

export default function AccessHistoryPage() {
  const { user } = useAuth()
  const [accessLogs, setAccessLogs] = useState<AccessLogRecord[]>([])
  const [dbUsers, setDbUsers] = useState<{ username: string; displayname?: string; displayName?: string }[]>([])
  const [loading, setLoading] = useState(true)

  const loadProjectUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users")
      if (!res.ok) {
        setDbUsers([])
        return
      }
      const data = await res.json()
      setDbUsers(Array.isArray(data.users) ? data.users : [])
    } catch (error) {
      console.error("Failed to load project users:", error)
      setDbUsers([])
    }
  }, [])

  const loadAccessLogs = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)

      const [{ data, error }] = await Promise.all([
        supabase
          .from("access_logs")
          .select("*")
          .order("timestamp", { ascending: false }),
        showLoading ? loadProjectUsers() : Promise.resolve(),
      ])

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
  }, [loadProjectUsers])

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
      <AccessHistoryModuleSection
        module="rental"
        logs={accessLogs}
        loading={loading}
        onRefresh={() => loadAccessLogs(true)}
        allowed={user?.role === "admin" || user?.permissions?.canViewAccessHistory || false}
        dbUsers={dbUsers}
      />
    </ModulePageShell>
  )
}
