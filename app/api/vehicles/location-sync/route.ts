import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// Endpoint secret token for security
const SYNC_SECRET = process.env.LOCATION_SYNC_SECRET || "3lmotohue-sync-secret-2026"

function extractVehicleLocation(notes?: string) {
  if (!notes) return { location: "", cleanNotes: "", updatedAt: "", lat: undefined as number | undefined, lng: undefined as number | undefined }
  const match = notes.match(/\[location:(.*?)\]/i)
  if (match) {
    const raw = match[1].trim()
    const cleanNotes = notes.replace(/\[location:(.*?)\]/gi, "").trim()
    let updatedAt = ""
    let lat: number | undefined
    let lng: number | undefined
    let address = raw
    if (raw.includes("|")) {
      const parts = raw.split("|")
      const coords = parts[0].split(",")
      const parsedLat = parseFloat(coords[0])
      const parsedLng = parseFloat(coords[1])
      if (!isNaN(parsedLat)) lat = parsedLat
      if (!isNaN(parsedLng)) lng = parsedLng
      address = parts[1] || ""
      updatedAt = parts[2] || ""
    }
    return { location: address, cleanNotes, updatedAt, lat, lng }
  }
  return { location: "", cleanNotes: notes, updatedAt: "", lat: undefined, lng: undefined }
}

function isNewerTimestamp(incomingTs?: string, existingTs?: string): boolean {
  if (!existingTs) return true
  if (!incomingTs) return true
  const incomingDate = new Date(incomingTs)
  const existingDate = new Date(existingTs)
  if (isNaN(incomingDate.getTime())) return true
  if (isNaN(existingDate.getTime())) return true
  return incomingDate.getTime() > existingDate.getTime()
}

async function getDetailedReverseGeocode(lat: number, lng: number, inputAddress?: string): Promise<string> {
  const cleanInput = (inputAddress || "").trim()
  const lower = cleanInput.toLowerCase()
  if (cleanInput && cleanInput.length > 15 && !["tp. huế", "thừa thiên huế", "tp huế", "huế", "tp. huế, thừa thiên huế"].includes(lower)) {
    return cleanInput
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`, {
      headers: { "User-Agent": "3lmotohue-location-service/1.0" }
    })
    if (res.ok) {
      const data = await res.json()
      const display = data.display_name || ""
      if (display) {
        const parts = display.split(",").map((s: string) => s.trim())
        const cleanParts = parts.filter((p: string) => !/^\d{5,6}$/.test(p) && p !== "Việt Nam")
        if (cleanParts.length > 0) {
          return cleanParts.slice(0, 3).join(", ")
        }
      }
    }
  } catch (err) {
    console.error("Reverse geocode error:", err)
  }

  return cleanInput || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "3lmotohue-location-sync",
    timestamp: new Date().toISOString(),
    message: "Endpoint đồng bộ vị trí xe hoạt động bình thường"
  })
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-sync-secret")
    if (authHeader !== `Bearer ${SYNC_SECRET}` && authHeader !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized invalid sync secret token" }, { status: 401 })
    }

    const body = await req.json()
    const items = Array.isArray(body) ? body : [body]

    const { data: vehicles, error: fetchErr } = await supabase.from("vehicles").select("id, licensePlate, name, notes")
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const results: any[] = []
    const latestItemsByVehicleId = new Map<string, any>()

    for (const item of items) {
      const { vehicleId, licensePlate, lat, lng, timestamp = new Date().toISOString(), force = false } = item
      if (!lat && !lng && !item.address) continue

      const targetPlate = licensePlate ? String(licensePlate).toLowerCase().replace(/[^a-z0-9]/g, '') : ""
      
      const vehicle = vehicles.find((v) => {
        if (vehicleId && v.id === vehicleId) return true
        if (targetPlate) {
          const vPlate = String(v.licensePlate || "").toLowerCase().replace(/[^a-z0-9]/g, '')
          return vPlate === targetPlate || vPlate.includes(targetPlate) || targetPlate.includes(vPlate)
        }
        return false
      })

      if (!vehicle) {
        results.push({ item, status: "not_found" })
        continue
      }

      const existingCandidate = latestItemsByVehicleId.get(vehicle.id)
      if (force || !existingCandidate || isNewerTimestamp(timestamp, existingCandidate.timestamp)) {
        latestItemsByVehicleId.set(vehicle.id, { ...item, timestamp, force, vehicle })
      }
    }

    for (const [vId, candidate] of latestItemsByVehicleId.entries()) {
      const vehicle = candidate.vehicle
      const { lat, lng, address = "", timestamp, force = false } = candidate
      const existingLoc = extractVehicleLocation(vehicle.notes)

      // Skip update if DB already has a newer location timestamp (unless forced)
      if (!force && existingLoc.updatedAt && !isNewerTimestamp(timestamp, existingLoc.updatedAt)) {
        results.push({ vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, status: "skipped_older", reason: "Existing location is newer" })
        continue
      }

      const cleanNotes = existingLoc.cleanNotes
      const safeLat = typeof lat === 'number' ? lat : (existingLoc.lat || 16.4637)
      const safeLng = typeof lng === 'number' ? lng : (existingLoc.lng || 107.5908)
      const locAddress = await getDetailedReverseGeocode(safeLat, safeLng, address)
      const formattedLoc = `${safeLat},${safeLng}|${locAddress}|${timestamp}`
      const newNotes = cleanNotes ? `${cleanNotes}\n[location:${formattedLoc}]` : `[location:${formattedLoc}]`

      const { error: updateErr } = await supabase
        .from("vehicles")
        .update({ notes: newNotes })
        .eq("id", vehicle.id)

      if (updateErr) {
        results.push({ vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, status: "error", error: updateErr.message })
      } else {
        results.push({ vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, status: "success", address: locAddress, timestamp })
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: results.filter(r => r.status === 'success').length,
      skippedCount: results.filter(r => r.status === 'skipped_older').length,
      results
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
