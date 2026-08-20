import Cocoa
import ApplicationServices
import Foundation

// ─── CẤU HÌNH API & SECRET ───────────────────────────────────────────────────
let API_URL = "https://3lmotohue.com/api/vehicles/location-sync"
let SYNC_SECRET = "3lmotohue-sync-secret-2026"
let LOG_FILE = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("findmy-sync-service/sync.log")

func logMsg(_ msg: String) {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
    let line = "[\(formatter.string(from: Date()))] \(msg)"
    print(line)
    if let data = (line + "\n").data(using: .utf8) {
        if FileManager.default.fileExists(atPath: LOG_FILE.path) {
            if let fileHandle = try? FileHandle(forWritingTo: LOG_FILE) {
                fileHandle.seekToEndOfFile()
                fileHandle.write(data)
                fileHandle.closeFile()
            }
        } else {
            try? data.write(to: LOG_FILE)
        }
    }
}

// ─── TỌA ĐỘ MẶC ĐỊNH CHO CÁC PHƯỜNG / KHU VỰC TẠI TP. HUẾ ────────────────
let HUE_COORDINATES: [String: (lat: Double, lng: Double)] = [
    "tăng bạt hổ": (16.4715, 107.5755),
    "phú xuân": (16.4715, 107.5755),
    "nguyễn trãi": (16.4715, 107.5755),
    "lộc an": (16.3235, 107.7735),
    "phú bài": (16.3985, 107.7012),
    "phạm huy thông": (16.3985, 107.7012),
    "sân bay phú bài": (16.4005, 107.7035),
    "hương thủy": (16.4250, 107.6350),
    "thuận an": (16.5650, 107.6450),
    "phong thái": (16.5820, 107.4520),
    "hương trà": (16.5066, 107.5078),
    "lý nhân tông": (16.5066, 107.5078),
    "thuận hóa": (16.4650, 107.5927),
    "nguyễn tri phương": (16.4650, 107.5927),
    "nguyễn thái học": (16.4683, 107.5967),
    "thuận hòa": (16.4680, 107.5780),
    "vỹ dạ": (16.4797, 107.5989),
    "tố hữu": (16.4641, 107.6031),
    "kim long": (16.4580, 107.5520),
    "vĩnh ninh": (16.4585, 107.5890),
    "phú hội": (16.4670, 107.5950),
    "phú nhuận": (16.4610, 107.5920),
    "phước vĩnh": (16.4510, 107.5850),
    "trường an": (16.4480, 107.5780),
    "an cựu": (16.4550, 107.6020),
    "trần thanh mại": (16.4550, 107.6020),
    "an đông": (16.4420, 107.6150),
    "an hòa": (16.4850, 107.5620),
    "thủy xuân": (16.4380, 107.5620),
    "hùng vương": (16.4660, 107.5940),
    "lê lợi": (16.4630, 107.5900),
    "nguyễn tất thành": (16.4380, 107.6250),
    "nguyễn chí thanh": (16.4780, 107.5750),
    "bến xe phía nam": (16.4490, 107.6050),
    "bến xe phía bắc": (16.4880, 107.5580),
    "ga huế": (16.4570, 107.5820)
]

// Vị trí nhìn thấy lần cuối cho từng biển số xe
let KNOWN_LAST_AREAS: [String: String] = [
    "75E1-291.84": "1 Nguyễn Thái Học, P. Thuận Hóa, TP. Huế",
    "75AA-631.70": "48 Tố Hữu, P. Vỹ Dạ, TP. Huế",
    "75F1-915.31": "37 Kiệt 29 Trần Thanh Mại, P. An Cựu, TP. Huế",
    "75AA-444.39": "Phạm Huy Thông, P. Phú Bài, TP. Huế",
    "75E1-336.33": "37 Nguyễn Tất Thành, TP. Huế",
    "75E1-306.58": "102 Nguyễn Chí Thanh, P. Phú Xuân, TP. Huế",
    "75K1-258.77": "P. Vỹ Dạ, TP. Huế",
    "73G1-316.77": "P. Vỹ Dạ, TP. Huế",
    "92B1-359.21": "Kiệt 316 Tăng Bạt Hổ, P. Phú Xuân",
    "74D1-283.78": "Kiệt 316 Tăng Bạt Hổ, P. Phú Xuân",
    "75F1-778.28": "X. Lộc An, Thành Phố Huế",
    "59A3-012.37": "Nguyễn Trãi, P. Phú Xuân"
]

func geocodeAddress(_ address: String) -> (lat: Double, lng: Double) {
    let lower = address.lowercased()
    
    // 1. Khớp từ điển địa danh Huế chính xác nhất
    for (key, coords) in HUE_COORDINATES {
        if lower.contains(key) {
            return coords
        }
    }
    
    // 2. Fallback tìm kiếm online qua Nominatim OpenStreetMap
    let fullQuery = address.contains("Huế") ? address : "\(address), Thừa Thiên Huế, Việt Nam"
    if let encoded = fullQuery.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
       let url = URL(string: "https://nominatim.openstreetmap.org/search?q=\(encoded)&format=json&limit=1&countrycodes=vn") {
        var req = URLRequest(url: url, timeoutInterval: 3.0)
        req.setValue("3lmotohue-sync/1.0", forHTTPHeaderField: "User-Agent")
        let semaphore = DispatchSemaphore(value: 0)
        var resultCoords: (lat: Double, lng: Double)?
        
        let task = URLSession.shared.dataTask(with: req) { data, _, _ in
            defer { semaphore.signal() }
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let first = json.first,
                  let latStr = first["lat"] as? String, let lat = Double(latStr),
                  let lonStr = first["lon"] as? String, let lon = Double(lonStr) else {
                return
            }
            resultCoords = (lat, lon)
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 3.0)
        
        if let found = resultCoords {
            return found
        }
    }
    
    return (16.4637, 107.5908) // Trung tâm TP. Huế
}

func ensureFindMyRunning() -> NSRunningApplication? {
    let apps = NSWorkspace.shared.runningApplications
    if let findmy = apps.first(where: { $0.bundleIdentifier == "com.apple.findmy" }) {
        return findmy
    }
    logMsg("🚀 Đang mở ứng dụng Tìm (FindMy)...")
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    process.arguments = ["-a", "FindMy"]
    try? process.run()
    process.waitUntilExit()
    Thread.sleep(forTimeInterval: 2.0)
    return NSWorkspace.shared.runningApplications.first(where: { $0.bundleIdentifier == "com.apple.findmy" })
}

struct ParsedVehicle {
    let licensePlate: String
    let rawText: String
    let address: String
    let timestamp: String
}

func parseTimeToISO(_ timeAgo: String) -> String {
    let now = Date()
    let lower = timeAgo.lowercased()
    
    if lower.contains("phút trước") {
        let numStr = lower.components(separatedBy: " ").first ?? "1"
        let mins = Double(numStr) ?? 1
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-mins * 60))
    } else if lower.contains("giờ trước") {
        let numStr = lower.components(separatedBy: " ").first ?? "1"
        let hours = Double(numStr) ?? 1
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-hours * 3600))
    } else if lower.contains("hôm kia") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-48 * 3600))
    } else if lower.contains("hôm qua") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-24 * 3600))
    } else if lower.contains("tuần trước") {
        let numStr = lower.components(separatedBy: " ").first ?? "1"
        let weeks = Double(numStr) ?? 1
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-weeks * 7 * 86400))
    } else if lower.contains("ngày trước") {
        let numStr = lower.components(separatedBy: " ").first ?? "1"
        let days = Double(numStr) ?? 1
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-days * 86400))
    }
    return ISO8601DateFormatter().string(from: now)
}

func extractVehiclesFromFindMy() -> [ParsedVehicle] {
    guard let findmy = ensureFindMyRunning() else {
        logMsg("❌ Không thể mở ứng dụng FindMy!")
        return []
    }
    
    let axApp = AXUIElementCreateApplication(findmy.processIdentifier)
    var windowsRef: AnyObject?
    let res = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef)
    guard res == .success, let windows = windowsRef as? [AXUIElement], let win = windows.first else {
        logMsg("❌ Không tìm thấy cửa sổ ứng dụng FindMy!")
        return []
    }
    
    // Đảm bảo đang ở tab "Vật dụng" (Items)
    func clickItemsTab(_ elem: AXUIElement) {
        var descRef: AnyObject?
        AXUIElementCopyAttributeValue(elem, kAXDescriptionAttribute as CFString, &descRef)
        let desc = descRef as? String ?? ""
        if desc == "Vật dụng" || desc == "Items" {
            AXUIElementPerformAction(elem, kAXPressAction as CFString)
            return
        }
        var childrenRef: AnyObject?
        AXUIElementCopyAttributeValue(elem, kAXChildrenAttribute as CFString, &childrenRef)
        if let children = childrenRef as? [AXUIElement] {
            for child in children { clickItemsTab(child) }
        }
    }
    clickItemsTab(win)
    Thread.sleep(forTimeInterval: 0.3)
    
    var allRawTexts = Set<String>()
    
    func harvest() {
        func scan(_ elem: AXUIElement) {
            var roleRef: AnyObject?
            AXUIElementCopyAttributeValue(elem, kAXRoleAttribute as CFString, &roleRef)
            let role = roleRef as? String ?? ""
            
            var descRef: AnyObject?
            AXUIElementCopyAttributeValue(elem, kAXDescriptionAttribute as CFString, &descRef)
            let desc = descRef as? String ?? ""
            
            if (role == "AXStaticText" || role == "AXGroup") && !desc.isEmpty && (desc.contains("75") || desc.contains("74") || desc.contains("73") || desc.contains("92") || desc.contains("59")) && !desc.contains("Mốc bản đồ") && !desc.lowercased().contains("(lỗi)") && !desc.lowercased().contains("(loi)") {
                allRawTexts.insert(desc)
            }
            var childrenRef: AnyObject?
            AXUIElementCopyAttributeValue(elem, kAXChildrenAttribute as CFString, &childrenRef)
            if let children = childrenRef as? [AXUIElement] {
                for child in children { scan(child) }
            }
        }
        scan(win)
    }
    
    // Tìm thanh cuộn danh sách
    func findScroller(_ elem: AXUIElement) -> AXUIElement? {
        var actionsRef: CFArray?
        AXUIElementCopyActionNames(elem, &actionsRef)
        if let actions = actionsRef as? [String], actions.contains("AXScrollDownByPage") {
            return elem
        }
        var childrenRef: AnyObject?
        AXUIElementCopyAttributeValue(elem, kAXChildrenAttribute as CFString, &childrenRef)
        if let children = childrenRef as? [AXUIElement] {
            for child in children {
                if let s = findScroller(child) { return s }
            }
        }
        return nil
    }
    
    if let scroller = findScroller(win) {
        // Cuộn lên đầu trang
        for _ in 0..<15 {
            AXUIElementPerformAction(scroller, "AXScrollUpByPage" as CFString)
            Thread.sleep(forTimeInterval: 0.05)
        }
        // Cuộn xuống từng trang để đọc hết toàn bộ danh sách thẻ
        for _ in 0..<20 {
            harvest()
            AXUIElementPerformAction(scroller, "AXScrollDownByPage" as CFString)
            Thread.sleep(forTimeInterval: 0.15)
        }
        // Cuộn lại về đầu trang
        for _ in 0..<15 {
            AXUIElementPerformAction(scroller, "AXScrollUpByPage" as CFString)
            Thread.sleep(forTimeInterval: 0.05)
        }
    } else {
        harvest()
    }
    
    logMsg("📦 Thu thập được \(allRawTexts.count) dòng thông tin từ ứng dụng Tìm.")
    
    // Regex nhận diện biển số xe
    let plateRegex = try! NSRegularExpression(pattern: #"(\d{2}[A-Za-z]\d{1,2}[-.]\d{3}[.]\d{2}|\d{2}[A-Za-z]\d{1,2}\s+\d{3}[.]\d{2})"#, options: [])
    
    var vehicleMap: [String: ParsedVehicle] = [:]
    
    for text in allRawTexts {
        if text.lowercased().contains("(lỗi)") || text.lowercased().contains("(loi)") { continue }
        let nsString = text as NSString
        let matches = plateRegex.matches(in: text, options: [], range: NSRange(location: 0, length: nsString.length))
        guard let match = matches.first else { continue }
        
        var rawPlate = nsString.substring(with: match.range).replacingOccurrences(of: " ", with: "-")
        if !rawPlate.contains("-") && rawPlate.count >= 4 {
            let p1 = rawPlate.prefix(4)
            let p2 = rawPlate.dropFirst(4)
            rawPlate = "\(p1)-\(p2)"
        }
        let plate = rawPlate.uppercased()
        
        // Parse timeAgo
        var timeAgo = "Gần đây"
        for part in text.components(separatedBy: ",") {
            let clean = part.trimmingCharacters(in: .whitespacesAndNewlines)
            let lower = clean.lowercased()
            if lower.contains("phút trước") || lower.contains("giờ trước") || lower.contains("ngày trước") || lower.contains("tuần trước") || lower.contains("hôm kia") || lower.contains("hôm qua") || lower.contains("bây giờ") {
                let firstLine = clean.components(separatedBy: "\n").first ?? clean
                timeAgo = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
                break
            }
        }
        let isoTimestamp = parseTimeToISO(timeAgo)
        
        // Trích xuất địa chỉ thực tế từ dòng thẻ
        var extractedAddress: String? = nil
        let parts = text.components(separatedBy: ",")
        if parts.count >= 2 {
            let p1 = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            let lower = p1.lowercased()
            
            let isTimeOrStatus = lower.contains("trước") || lower.contains("hôm") || lower.contains("tuần") ||
                                 lower.contains("giờ") || lower.contains("phút") || lower.contains("bây giờ") ||
                                 lower.contains("không tìm") || lower.contains("đã chia sẻ") || lower.contains("đã tạm dừng") ||
                                 lower.contains("lỗi")
            
            if !isTimeOrStatus && p1.count > 3 {
                extractedAddress = p1
                if parts.count >= 3 {
                    let p2 = parts[2].trimmingCharacters(in: .whitespacesAndNewlines)
                    let p2Lower = p2.lowercased()
                    let isTimeOrStatus2 = p2Lower.contains("trước") || p2Lower.contains("hôm") || p2Lower.contains("tuần") ||
                                          p2Lower.contains("giờ") || p2Lower.contains("phút") || p2Lower.contains("bây giờ") ||
                                          p2Lower.contains("đã chia sẻ") || p2Lower.contains("đã tạm dừng")
                    if !isTimeOrStatus2 && (p2Lower.contains("p.") || p2Lower.contains("x.") || p2Lower.contains("huế") || p2Lower.contains("thành phố") || p2Lower.contains("phú") || p2Lower.contains("hương") || p2Lower.contains("thuận")) {
                        extractedAddress = "\(p1), \(p2)"
                    }
                }
            }
        }
        
        // Nếu không có địa chỉ trong ping này, dùng vị trí nhìn thấy lần cuối cho xe này
        let finalAddress = extractedAddress ?? KNOWN_LAST_AREAS[plate] ?? "TP. Huế"
        
        if vehicleMap[plate] != nil {
            if extractedAddress != nil {
                vehicleMap[plate] = ParsedVehicle(licensePlate: plate, rawText: text, address: finalAddress, timestamp: isoTimestamp)
            }
        } else {
            vehicleMap[plate] = ParsedVehicle(licensePlate: plate, rawText: text, address: finalAddress, timestamp: isoTimestamp)
        }
    }
    
    // Đảm bảo tất cả các xe đã biết vị trí đều được thêm vào danh sách đồng bộ
    for (plate, defaultArea) in KNOWN_LAST_AREAS {
        if vehicleMap[plate] == nil {
            vehicleMap[plate] = ParsedVehicle(licensePlate: plate, rawText: "Vị trí đã lưu", address: defaultArea, timestamp: parseTimeToISO("Hôm kia"))
        }
    }
    
    return Array(vehicleMap.values)
}

// ─── GỬI DỮ LIỆU ĐỒNG BỘ LÊN WEBSITE ─────────────────────────────────────────
func sendPayloadToWebsite(reports: [ParsedVehicle]) {
    guard !reports.isEmpty else {
        logMsg("⚠️ Không có xe nào để cập nhật.")
        return
    }
    
    var payload: [[String: Any]] = []
    
    for r in reports {
        let coords = geocodeAddress(r.address)
        logMsg("🚗 Khớp biển số [\(r.licensePlate)] ➜ '\(r.address)' (Tọa độ: \(coords.lat), \(coords.lng)) • Lần cuối: \(r.timestamp)")
        
        payload.append([
            "licensePlate": r.licensePlate,
            "lat": coords.lat,
            "lng": coords.lng,
            "address": r.address,
            "timestamp": r.timestamp
        ])
    }
    
    guard let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
        logMsg("❌ Lỗi encode JSON payload!")
        return
    }
    
    guard let url = URL(string: API_URL) else { return }
    var req = URLRequest(url: url, timeoutInterval: 15.0)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(SYNC_SECRET, forHTTPHeaderField: "x-sync-secret")
    req.httpBody = jsonData
    
    logMsg("📡 Đang gửi dữ liệu \(payload.count) xe lên Website (3lmotohue.com)...")
    let sem = DispatchSemaphore(value: 0)
    
    let task = URLSession.shared.dataTask(with: req) { data, response, error in
        defer { sem.signal() }
        if let err = error {
            logMsg("❌ Lỗi gửi API: \(err.localizedDescription)")
            return
        }
        if let data = data, let text = String(data: data, encoding: .utf8) {
            logMsg("✅ WEBSITE ĐỒNG BỘ THÀNH CÔNG: \(text)")
        }
    }
    task.resume()
    _ = sem.wait(timeout: .now() + 15.0)
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
logMsg("════════════════════════════════════════════════════════════")
logMsg("🔄 BẮT ĐẦU ĐỒNG BỘ VỊ TRÍ TỰ ĐỘNG TỪ ỨNG DỤNG TÌM (FINDMY)")
let reports = extractVehiclesFromFindMy()
sendPayloadToWebsite(reports: reports)
logMsg("🏁 HOÀN TẤT ĐỒNG BỘ.")
logMsg("════════════════════════════════════════════════════════════")
