import { NextResponse } from "next/server"

// Endpoint secret token for security
const SYNC_SECRET = process.env.LOCATION_SYNC_SECRET?.trim() || ""

function validateSyncSecret(req: Request) {
  if (!SYNC_SECRET) {
    return NextResponse.json({ error: "Location sync secret is not configured" }, { status: 503 })
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("x-sync-secret")
  if (authHeader !== `Bearer ${SYNC_SECRET}` && authHeader !== SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

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
    list.forEach(resolve => {
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
    const current = globalThis.__globalSyncRequest
    if (!current || (requestId && current.id !== requestId)) {
      return NextResponse.json({ status: "not_found" })
    }
    return NextResponse.json({
      status: current.status,
      requestId: current.id,
      result: current.result,
      age: Date.now() - current.requestedAt,
    })
  }

  // 2. Long-polling từ Mac Bridge
  if (action === "poll") {
    const denied = validateSyncSecret(req)
    if (denied) return denied

    const current = globalThis.__globalSyncRequest
    const isRecent = current && current.status === "pending" && (Date.now() - current.requestedAt < 60000)

    if (isRecent && current) {
      current.status = "processing"
      return NextResponse.json({
        trigger: true,
        requestId: current.id,
      })
    }

    // Long-poll wait up to 20 seconds
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
      }, 20000)
    })

    const pendingNow = globalThis.__globalSyncRequest
    if (triggered && pendingNow && pendingNow.status === "pending" && (Date.now() - pendingNow.requestedAt < 60000)) {
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

      // Đánh thức tất cả Mac bridge đang long-poll
      notifyWaiters()

      return NextResponse.json({
        success: true,
        requestId: newId,
        status: "pending",
      })
    }

    // 2. Mac bridge báo cáo hoàn tất
    if (action === "complete" || action === "fail") {
      const denied = validateSyncSecret(req)
      if (denied) return denied

      const { requestId, result } = body
      if (globalThis.__globalSyncRequest && (!requestId || globalThis.__globalSyncRequest.id === requestId)) {
        globalThis.__globalSyncRequest.status = action === "complete" ? "completed" : "failed"
        globalThis.__globalSyncRequest.result = result || {}
      }

      return NextResponse.json({
        success: true,
        status: globalThis.__globalSyncRequest?.status || "unknown",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
