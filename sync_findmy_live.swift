import Cocoa
import ApplicationServices
import Foundation

// ─── CẤU HÌNH API & SECRET ───────────────────────────────────────────────────
let API_URL = "https://3lmotohue.com/api/vehicles/location-sync"
let SYNC_SECRET = ProcessInfo.processInfo.environment["LOCATION_SYNC_SECRET"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
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
    "75G1-160.66": "Nguyễn Trãi, P. Phú Xuân, TP. Huế",
    "75AA-444.39": "P. Vỹ Dạ, Thành Phố Huế",
    "75E1-291.84": "1 Nguyễn Thái Học, P. Thuận Hóa, TP. Huế",
    "75AA-631.70": "48 Tố Hữu, P. Vỹ Dạ, TP. Huế",
    "75F1-915.31": "37 Kiệt 29 Trần Thanh Mại, P. An Cựu, TP. Huế",
    "75E1-336.33": "P. Vỹ Dạ, Thành Phố Huế",
    "75E1-306.58": "102 Nguyễn Chí Thanh, P. Phú Xuân, TP. Huế",
    "75K1-258.77": "P. Vỹ Dạ, TP. Huế",
    "73G1-316.77": "P. Vỹ Dạ, TP. Huế",
    "92B1-359.21": "P. Vỹ Dạ, Thành Phố Huế",
    "74D1-283.78": "P. Vỹ Dạ, Thành Phố Huế",
    "75F1-778.28": "P. Phú Xuân, Thành Phố Huế",
    "59A3-012.37": "Nguyễn Trãi, P. Phú Xuân"
]

func geocodeAddress(_ address: String) -> (lat: Double, lng: Double)? {
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
    
    return nil
}

func ensureFindMyRunning() -> NSRunningApplication? {
    let openProc = Process()
    openProc.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    openProc.arguments = ["-b", "com.apple.findmy"]
    try? openProc.run()
    openProc.waitUntilExit()

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    process.arguments = [
        "-e", "tell application id \"com.apple.findmy\" to activate",
        "-e", "tell application id \"com.apple.findmy\" to reopen"
    ]
    try? process.run()
    process.waitUntilExit()
    Thread.sleep(forTimeInterval: 2.0)

    let apps = NSWorkspace.shared.runningApplications
    return apps.first(where: { $0.bundleIdentifier == "com.apple.findmy" })
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
    
    // Tìm con số trong chuỗi thời gian nếu có (vd: "14 phút trước" -> 14)
    var num: Double = 1
    if let numRegex = try? NSRegularExpression(pattern: #"(\d+)"#),
       let match = numRegex.firstMatch(in: lower, options: [], range: NSRange(location: 0, length: (lower as NSString).length)) {
        let numStr = (lower as NSString).substring(with: match.range)
        num = Double(numStr) ?? 1
    }
    
    if lower.contains("phút") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-num * 60))
    } else if lower.contains("giờ") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-num * 3600))
    } else if lower.contains("hôm kia") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-48 * 3600))
    } else if lower.contains("hôm qua") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-24 * 3600))
    } else if lower.contains("tuần") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-num * 7 * 86400))
    } else if lower.contains("ngày") {
        return ISO8601DateFormatter().string(from: now.addingTimeInterval(-num * 86400))
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
    var res = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef)
    var windows = windowsRef as? [AXUIElement]
    
    if res != .success || windows == nil || windows!.isEmpty {
        logMsg("⚠️ Cửa sổ FindMy chưa sẵn sàng, đang mở lại cửa sổ...")
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        p.arguments = ["-e", "tell application id \"com.apple.findmy\" to activate", "-e", "tell application id \"com.apple.findmy\" to reopen"]
        try? p.run()
        p.waitUntilExit()
        Thread.sleep(forTimeInterval: 2.0)
        
        windowsRef = nil
        res = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef)
        windows = windowsRef as? [AXUIElement]
    }
    
    guard res == .success, let validWindows = windows, let win = validWindows.first else {
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
            
            if (role == "AXStaticText" || role == "AXGroup") && !desc.isEmpty && !desc.contains("Mốc bản đồ") && !desc.lowercased().contains("(lỗi)") && !desc.lowercased().contains("(loi)") {
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
    
    // Regex nhận diện biển số xe: hỗ trợ định dạng 75G1-160.66, 75G1 160.66, 75-G1 160.66, etc.
    let plateRegex = try! NSRegularExpression(pattern: #"(\d{2}[A-Za-z]\d{1,2}[-.\s]+\d{3}[.]\d{2}|\d{2}[-][A-Za-z]\d{1,2}[-.\s]+\d{3}[.]\d{2})"#, options: [])
    
    var vehicleMap: [String: ParsedVehicle] = [:]
    
    for text in allRawTexts {
        if text.lowercased().contains("(lỗi)") || text.lowercased().contains("(loi)") { continue }
        let nsString = text as NSString
        let matches = plateRegex.matches(in: text, options: [], range: NSRange(location: 0, length: nsString.length))
        guard let match = matches.first else { continue }
        
        var rawPlate = nsString.substring(with: match.range)
            .replacingOccurrences(of: " ", with: "-")
            .replacingOccurrences(of: "--", with: "-")
        if !rawPlate.contains("-") && rawPlate.count >= 4 {
            let p1 = rawPlate.prefix(4)
            let p2 = rawPlate.dropFirst(4)
            rawPlate = "\(p1)-\(p2)"
        }
        let plate = rawPlate.uppercased()
        
        // Tách chuỗi theo dấu xuống dòng \n, dấu chấm tròn •, hoặc dấu phẩy ,
        var cleanedText = text
        cleanedText = cleanedText.replacingOccurrences(of: "•", with: "\n")
        cleanedText = cleanedText.replacingOccurrences(of: "·", with: "\n")
        
        let rawSegments = cleanedText.components(separatedBy: "\n")
            .flatMap { $0.components(separatedBy: ",") }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        
        var timeAgo = "Gần đây"
        var addressSegments: [String] = []
        
        for segment in rawSegments {
            let lower = segment.lowercased()
            
            // 1. Kiểm tra nếu segment chứa thông tin thời gian
            if lower.contains("phút") || lower.contains("giờ") || lower.contains("ngày") ||
               lower.contains("tuần") || lower.contains("hôm") || lower.contains("bây giờ") || lower.contains("vừa xong") {
                if timeAgo == "Gần đây" {
                    timeAgo = segment
                }
                continue
            }
            
            // 2. Kiểm tra nếu segment là tiêu đề tên xe / biển số
            if segment.contains(plate) || lower.contains("ab ") || lower.contains("vision") || lower.contains("wave") || lower.contains("sh ") {
                continue
            }
            
            // 3. Kiểm tra nếu segment là trạng thái lỗi / chia sẻ
            if lower.contains("không tìm") || lower.contains("đã chia sẻ") || lower.contains("đã tạm dừng") || lower.contains("pin yếu") {
                continue
            }
            
            // 4. Các đoạn còn lại chính là thành phần địa chỉ
            if segment.count >= 2 {
                addressSegments.append(segment)
            }
        }
        
        let isoTimestamp = parseTimeToISO(timeAgo)
        
        var extractedAddress: String? = nil
        if !addressSegments.isEmpty {
            extractedAddress = addressSegments.joined(separator: ", ")
        }
        
        // Chỉ ghi nhận xe có địa chỉ hoặc được tìm thấy từ Find My
        if let extractedAddress = extractedAddress {
            vehicleMap[plate] = ParsedVehicle(licensePlate: plate, rawText: text, address: extractedAddress, timestamp: isoTimestamp)
        } else if vehicleMap[plate] == nil {
            let fallbackAddr = KNOWN_LAST_AREAS[plate] ?? "TP. Huế"
            vehicleMap[plate] = ParsedVehicle(licensePlate: plate, rawText: text, address: fallbackAddr, timestamp: isoTimestamp)
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

    guard !SYNC_SECRET.isEmpty else {
        logMsg("❌ Thiếu LOCATION_SYNC_SECRET. Không gửi dữ liệu vị trí khi chưa cấu hình mật mã riêng.")
        return
    }
    
    var payload: [[String: Any]] = []
    
    for r in reports {
        guard let coords = geocodeAddress(r.address) else {
            logMsg("⚠️ Bỏ qua [\(r.licensePlate)] vì không xác định được tọa độ thật cho '\(r.address)'")
            continue
        }
        logMsg("🚗 Khớp biển số [\(r.licensePlate)] ➜ '\(r.address)' (Tọa độ: \(coords.lat), \(coords.lng)) • Lần cuối: \(r.timestamp)")
        
        payload.append([
            "licensePlate": r.licensePlate,
            "lat": coords.lat,
            "lng": coords.lng,
            "address": r.address,
            "timestamp": r.timestamp
        ])
    }

    guard !payload.isEmpty else {
        logMsg("⚠️ Không có tọa độ hợp lệ để gửi lên Website.")
        return
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
