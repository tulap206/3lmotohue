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

// ─── TỌA ĐỘ ĐỊNH NGHĨA CHO TỪNG PHƯỜNG / KHU VỰC TẠI TP. HUẾ ────────────────
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
    "bến xe phía nam": (16.4490, 107.6050),
    "bến xe phía bắc": (16.4880, 107.5580),
    "ga huế": (16.4570, 107.5820)
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
    if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.findmy") {
        let config = NSWorkspace.OpenConfiguration()
        config.activates = false
        config.hides = true
        let sem = DispatchSemaphore(value: 0)
        var runningApp: NSRunningApplication?
        NSWorkspace.shared.openApplication(at: url, configuration: config) { app, _ in
            runningApp = app
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 5.0)
        Thread.sleep(forTimeInterval: 2.0)
        return runningApp ?? NSWorkspace.shared.runningApplications.first(where: { $0.bundleIdentifier == "com.apple.findmy" })
    }
    return nil
}

struct ParsedVehicle {
    let licensePlate: String
    let rawText: String
    let address: String
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
    
    guard let scroller = findScroller(win) else {
        logMsg("⚠️ Không tìm thấy thanh cuộn danh sách.")
        return []
    }
    
    // Cuộn lên đầu trang
    for _ in 0..<15 {
        AXUIElementPerformAction(scroller, "AXScrollUpByPage" as CFString)
        Thread.sleep(forTimeInterval: 0.05)
    }
    
    var allRawTexts = Set<String>()
    
    func harvest() {
        func scan(_ elem: AXUIElement) {
            var roleRef: AnyObject?
            AXUIElementCopyAttributeValue(elem, kAXRoleAttribute as CFString, &roleRef)
            let role = roleRef as? String ?? ""
            
            var descRef: AnyObject?
            AXUIElementCopyAttributeValue(elem, kAXDescriptionAttribute as CFString, &descRef)
            let desc = descRef as? String ?? ""
            
            if (role == "AXStaticText" || role == "AXGroup") && !desc.isEmpty && (desc.contains("75") || desc.contains("74") || desc.contains("73") || desc.contains("92") || desc.contains("59")) && !desc.contains("Mốc bản đồ") {
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
    
    // Cuộn xuống từng trang để đọc hết toàn bộ danh sách thẻ
    for _ in 0..<20 {
        harvest()
        AXUIElementPerformAction(scroller, "AXScrollDownByPage" as CFString)
        Thread.sleep(forTimeInterval: 0.2)
    }
    
    // Cuộn lại về đầu trang
    for _ in 0..<15 {
        AXUIElementPerformAction(scroller, "AXScrollUpByPage" as CFString)
        Thread.sleep(forTimeInterval: 0.05)
    }
    
    logMsg("📦 Thu thập được \(allRawTexts.count) dòng thông tin từ ứng dụng Tìm.")
    
    // Regex nhận diện biển số xe (VD: 75E1-336.33, 75E1 336.33, 75K1-258.77...)
    let plateRegex = try! NSRegularExpression(pattern: #"(\d{2}[A-Za-z]\d{1,2}[-.]\d{3}[.]\d{2}|\d{2}[A-Za-z]\d{1,2}\s+\d{3}[.]\d{2})"#, options: [])
    
    var vehicleMap: [String: ParsedVehicle] = [:]
    
    for text in allRawTexts {
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
        
        // CHỈ LƯU NẾU CÓ ĐỊA CHỈ THỰC TẾ HỢP LỆ
        if let validAddress = extractedAddress {
            vehicleMap[plate] = ParsedVehicle(licensePlate: plate, rawText: text, address: validAddress)
        }
    }
    
    return Array(vehicleMap.values)
}

// ─── GỬI DỮ LIỆU ĐỒNG BỘ LÊN WEBSITE ─────────────────────────────────────────
func sendPayloadToWebsite(reports: [ParsedVehicle]) {
    guard !reports.isEmpty else {
        logMsg("⚠️ Không có xe nào có địa chỉ mới hợp lệ để cập nhật.")
        return
    }
    
    var payload: [[String: Any]] = []
    let isoFormatter = ISO8601DateFormatter()
    let nowStr = isoFormatter.string(from: Date())
    
    for r in reports {
        let coords = geocodeAddress(r.address)
        logMsg("🚗 Khớp biển số [\(r.licensePlate)] ➜ Địa chỉ: '\(r.address)' (Tọa độ: \(coords.lat), \(coords.lng))")
        
        payload.append([
            "licensePlate": r.licensePlate,
            "lat": coords.lat,
            "lng": coords.lng,
            "address": r.address,
            "timestamp": nowStr
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
