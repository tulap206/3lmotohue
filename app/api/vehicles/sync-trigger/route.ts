import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fpiupgmknsydqrihqdbo.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaXVwZ21rbnN5ZHFyaWhxZGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTYzNzAsImV4cCI6MjA5NDYzMjM3MH0.0YK7DmgpA8YuWEaIt1wh07dOQXW5GFlQzo3JydfFaL8"
const supabase = createClient(supabaseUrl, supabaseKey)

// Endpoint secret token for security
const SYNC_SECRET = process.env.LOCATION_SYNC_SECRET || "3lmotohue-sync-secret-2026"

interface SyncRequest {
  id: string
  requestedAt: number
  status: "pending" | "processing" | "completed" | "failed"
  result?: any
}

// Global in-memory storage for sync state across requests in the same server instance
declare global {
  var __globalSyncRequest: SyncRequest | null
  var __globalSyncResolvers: Array<() => void> | undefined
}

if (!globalThis.__globalSyncResolvers) {
  globalThis.__globalSyncResolvers = []
}

function notifyWaiters() {
  if (globalThis.__globalSyncResolvers) {
    const list = [...globalThis.__globalSyncResolvers]
    globalThis.__globalSyncResolvers = []
    list.forEach((resolve) => {
      try {
        resolve()
      } catch (_) {}
    })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const requestId = searchParams.get("requestId")

  // 1. Kiểm tra trạng thái yêu cầu từ Frontend
  if (action === "status") {
    // Ưu tiên kiểm tra in-memory
    const current = globalThis.__globalSyncRequest
    if (current && (!requestId || current.id === requestId)) {
      return NextResponse.json({
        status: current.status,
        requestId: current.id,
        result: current.result,
        age: Date.now() - current.requestedAt,
      })
    }

    // Fallback: Kiểm tra qua Supabase access_logs (Hỗ trợ Vercel Serverless multi-instance)
    if (requestId) {
      try {
        const { data: logs } = await supabase
          .from("access_logs")
          .select("*")
          .eq("module", "location_sync_trigger")
          .order("timestamp", { ascending: false })
          .limit(10)

        if (logs && logs.length > 0) {
          for (const log of logs) {
            try {
              const parsed = JSON.parse(log.details || "{}")
              if (parsed.requestId === requestId) {
                if (log.action === "SYNC_COMPLETED") {
                  return NextResponse.json({
                    status: "completed",
                    requestId,
                    result: parsed.result,
                    age: Date.now() - (parsed.requestedAt || 0),
                  })
                }
                if (log.action === "SYNC_FAILED") {
                  return NextResponse.json({
                    status: "failed",
                    requestId,
                    result: parsed.result,
                    age: Date.now() - (parsed.requestedAt || 0),
                  })
                }
                if (log.action === "SYNC_PROCESSING") {
                  return NextResponse.json({
                    status: "processing",
                    requestId,
                    age: Date.now() - (parsed.requestedAt || 0),
                  })
                }
                if (log.action === "SYNC_REQUEST") {
                  return NextResponse.json({
                    status: parsed.status || "pending",
                    requestId,
                    age: Date.now() - (parsed.requestedAt || 0),
                  })
                }
              }
            } catch (_) {}
          }
        }
      } catch (dbErr) {
        console.warn("Error querying sync status from DB:", dbErr)
      }
    }

    return NextResponse.json({ status: "not_found" })
  }

  // 2. Long-polling từ Mac Bridge
  if (action === "poll") {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-sync-secret")
    if (authHeader !== `Bearer ${SYNC_SECRET}` && authHeader !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2.1 Kiểm tra in-memory request trước
    const current = globalThis.__globalSyncRequest
    const isRecent = current && current.status === "pending" && Date.now() - current.requestedAt < 60000

    if (isRecent && current) {
      current.status = "processing"
      return NextResponse.json({
        trigger: true,
        requestId: current.id,
      })
    }

    // 2.2 Kiểm tra Supabase access_logs
    try {
      const { data: logs } = await supabase
        .from("access_logs")
        .select("*")
        .eq("module", "location_sync_trigger")
        .eq("action", "SYNC_REQUEST")
        .order("timestamp", { ascending: false })
        .limit(1)

      if (logs && logs.length > 0) {
        const latestLog = logs[0]
        try {
          const parsed = JSON.parse(latestLog.details || "{}")
          const logAge = Date.now() - (parsed.requestedAt || new Date(latestLog.timestamp).getTime())
          if (parsed.status === "pending" && logAge < 60000) {
            // Đánh dấu processing trong DB
            await supabase.from("access_logs").insert([
              {
                action: "SYNC_PROCESSING",
                module: "location_sync_trigger",
                userId: "mac_bridge",
                details: JSON.stringify({ ...parsed, status: "processing", processingAt: Date.now() }),
                timestamp: new Date().toISOString(),
              },
            ])

            return NextResponse.json({
              trigger: true,
              requestId: parsed.requestId,
            })
          }
        } catch (_) {}
      }
    } catch (dbErr) {
      console.warn("DB poll check error:", dbErr)
    }

    // 2.3 Long-poll wait up to 10 seconds
    const triggered = await new Promise<boolean>((resolve) => {
      let settled = false
      const onTrigger = () => {
        if (!settled) {
          settled = true
          resolve(true)
        }
      }

      globalThis.__globalSyncResolvers?.push(onTrigger)

      setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(false)
        }
      }, 10000)
    })

    const pendingNow = globalThis.__globalSyncRequest
    if (triggered && pendingNow && pendingNow.status === "pending" && Date.now() - pendingNow.requestedAt < 60000) {
      pendingNow.status = "processing"
      return NextResponse.json({
        trigger: true,
        requestId: pendingNow.id,
      })
    }

    return NextResponse.json({
      trigger: false,
    })
  }

  return NextResponse.json({
    status: "online",
    activeRequest: globalThis.__globalSyncRequest,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || "request"

    // 1. Web client gửi yêu cầu kích hoạt đồng bộ
    if (action === "request") {
      const newId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7)
      globalThis.__globalSyncRequest = {
        id: newId,
        requestedAt: Date.now(),
        status: "pending",
      }

      // Đánh thức tất cả Mac bridge đang long-poll in-memory
      notifyWaiters()

      // Lưu vào Supabase access_logs để mọi serverless instance & bridge đều nhận được
      try {
        await supabase.from("access_logs").insert([
          {
            action: "SYNC_REQUEST",
            module: "location_sync_trigger",
            userId: "web_client",
            details: JSON.stringify({
              requestId: newId,
              status: "pending",
              requestedAt: Date.now(),
            }),
            timestamp: new Date().toISOString(),
          },
        ])
      } catch (dbErr) {
        console.warn("Error persisting sync request to DB:", dbErr)
      }

      return NextResponse.json({
        success: true,
        requestId: newId,
        status: "pending",
      })
    }

    // 2. Mac bridge báo cáo hoàn tất hoặc thất bại
    if (action === "complete" || action === "fail") {
      const authHeader = req.headers.get("authorization") || req.headers.get("x-sync-secret")
      if (authHeader !== `Bearer ${SYNC_SECRET}` && authHeader !== SYNC_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { requestId, result } = body
      if (globalThis.__globalSyncRequest && (!requestId || globalThis.__globalSyncRequest.id === requestId)) {
        globalThis.__globalSyncRequest.status = action === "complete" ? "completed" : "failed"
        globalThis.__globalSyncRequest.result = result || {}
      }

      // Lưu kết quả vào Supabase access_logs
      try {
        await supabase.from("access_logs").insert([
          {
            action: action === "complete" ? "SYNC_COMPLETED" : "SYNC_FAILED",
            module: "location_sync_trigger",
            userId: "mac_bridge",
            details: JSON.stringify({
              requestId,
              status: action === "complete" ? "completed" : "failed",
              result: result || {},
              completedAt: Date.now(),
            }),
            timestamp: new Date().toISOString(),
          },
        ])
      } catch (dbErr) {
        console.warn("Error logging sync result to DB:", dbErr)
      }

      return NextResponse.json({
        success: true,
        status: action === "complete" ? "completed" : "failed",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
