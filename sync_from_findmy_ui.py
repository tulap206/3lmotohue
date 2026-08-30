#!/usr/bin/env python3
"""
Đọc vị trí từ FindMy app qua Accessibility API (PyObjC) và đồng bộ lên website.
Yêu cầu: cấp quyền Accessibility cho Terminal trong System Settings.
"""
import re
import json
import time
import urllib.request
import urllib.parse
import sys
import os
from datetime import datetime, timezone, timedelta

# ─── CẤU HÌNH ────────────────────────────────────────────────────────────────
API_URL     = "https://3lmotohue.com/api/vehicles/location-sync"
SYNC_SECRET = os.environ.get("LOCATION_SYNC_SECRET", "").strip()

# Ánh xạ tên thẻ → biển số (tên trong FindMy app)
NAME_TO_PLATE = {
    "75AA-444.39": "75AA-444.39",
    "75E1-336.33": "75E1-336.33",
    "75E1-306.58": "75E1-306.58",
    "74D1-283.78": "74D1-283.78",
    "75E1-336.33": "75E1-336.33",
    "75AA-631.70": "75AA-631.70",
    "75k1-258.77": "75k1-258.77",
    "75E1-291.84": "75E1-291.84",
    "92B1-359.21": "92B1-359.21",
    "75F1-915.31": "75F1-915.31",
    "73G1-316.77": "73G1-316.77",
    "75E1-253.48": "75E1-253.48",
    "75E1-287.62": "75E1-287.62",
    "75E1-374.41": "75E1-374.41",
    "75E1-412.55": "75E1-412.55",
    "75E1-189.73": "75E1-189.73",
    "75E1-228.96": "75E1-228.96",
    "75E1-345.87": "75E1-345.87",
    "75E1-463.19": "75E1-463.19",
}

def read_findmy_via_applescript() -> list[dict]:
    """Đọc danh sách items từ FindMy app qua osascript."""
    import subprocess
    
    script = '''
tell application "FindMy"
    activate
end tell
delay 1
tell application "System Events"
    tell process "FindMy"
        set output to {}
        try
            tell window 1
                set sidebarTexts to {}
                -- Duyệt qua tất cả text elements trong sidebar
                set allTexts to every static text of scroll area 1 of splitter group 1 of group 1
                repeat with t in allTexts
                    set tv to value of t
                    if tv is not "" and tv is not missing value then
                        set end of sidebarTexts to tv
                    end if
                end repeat
                return sidebarTexts
            end tell
        on error e
            return e
        end try
    end tell
end tell
'''
    result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise PermissionError(
            f"Accessibility bị từ chối. Hãy vào System Settings → Privacy & Security "
            f"→ Accessibility và bật Terminal.\nError: {result.stderr.strip()}"
        )
    
    raw = result.stdout.strip()
    if not raw:
        return []
    
    items_text = [t.strip() for t in raw.split(',') if t.strip()]
    return parse_items(items_text)

def read_findmy_via_pyobjc() -> list[dict]:
    """Đọc FindMy qua PyObjC AX API - chính xác hơn AppleScript."""
    try:
        from ApplicationServices import (
            AXUIElementCreateApplication,
            AXUIElementCopyAttributeValue,
            kAXChildrenAttribute,
            kAXValueAttribute,
            kAXTitleAttribute,
            kAXSubroleAttribute,
        )
        from AppKit import NSWorkspace, NSRunningApplication
    except ImportError:
        raise ImportError("PyObjC chưa cài. Chạy: pip3 install pyobjc-framework-ApplicationServices")
    
    # Tìm FindMy process
    running_apps = NSWorkspace.sharedWorkspace().runningApplications()
    findmy_app = None
    for app in running_apps:
        if app.bundleIdentifier() == 'com.apple.findmy':
            findmy_app = app
            break
    
    if not findmy_app:
        raise RuntimeError("FindMy app chưa mở!")
    
    pid = findmy_app.processIdentifier()
    ax_app = AXUIElementCreateApplication(pid)
    
    texts = []
    _collect_texts(ax_app, texts, kAXChildrenAttribute, kAXValueAttribute)
    return parse_items(texts)

def _collect_texts(elem, texts, child_attr, val_attr, depth=0):
    """Đệ quy lấy tất cả text values từ AX tree."""
    if depth > 15:
        return
    try:
        from ApplicationServices import AXUIElementCopyAttributeValue, kAXValueAttribute, kAXChildrenAttribute
        err, val = AXUIElementCopyAttributeValue(elem, val_attr, None)
        if err == 0 and val and isinstance(val, str) and val.strip():
            texts.append(val.strip())
        err, children = AXUIElementCopyAttributeValue(elem, child_attr, None)
        if err == 0 and children:
            for child in children:
                _collect_texts(child, texts, child_attr, val_attr, depth + 1)
    except Exception:
        pass

def parse_relative_time_to_iso(time_text: str) -> str:
    now = datetime.now(timezone.utc)
    lower = time_text.lower()
    
    m = re.search(r'(\d+)', lower)
    num = int(m.group(1)) if m else 1
    
    if "phút" in lower or "min" in lower:
        dt = now - timedelta(minutes=num)
    elif "giờ" in lower or "hour" in lower or "hr" in lower:
        dt = now - timedelta(hours=num)
    elif "hôm qua" in lower or "yesterday" in lower:
        dt = now - timedelta(days=1)
    elif "hôm kia" in lower:
        dt = now - timedelta(days=2)
    elif "ngày" in lower or "day" in lower:
        dt = now - timedelta(days=num)
    elif "tuần" in lower or "week" in lower:
        dt = now - timedelta(weeks=num)
    else:
        dt = now
        
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def parse_items(texts: list[str]) -> list[dict]:
    """Phân tích danh sách text → list items với name, address và timestamp."""
    items = []
    plate_pattern = re.compile(r'(\d{2}[A-Za-z]\d{1,2}[-.\s]*\d{3}[.]\d{2}|\d{2}[-][A-Za-z]\d{1,2}[-.\s]*\d{3}[.]\d{2})')
    time_keywords = ["phút", "giờ", "ngày", "tuần", "hôm", "bây giờ", "vừa xong", "gần đây", "min", "hour", "ago", "now", "yesterday"]
    
    i = 0
    while i < len(texts):
        text = texts[i]
        m = plate_pattern.search(text)
        if m:
            raw_plate = m.group(1).upper().replace(" ", "-").replace(".", ".").replace("--", "-")
            if "-" not in raw_plate and len(raw_plate) >= 4:
                raw_plate = raw_plate[:4] + "-" + raw_plate[4:]
            
            address = ""
            timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            
            # Quét tối đa 4 dòng kế tiếp để tìm address & time
            j = i + 1
            while j < min(len(texts), i + 5):
                next_text = texts[j].strip()
                if plate_pattern.search(next_text):
                    break # Gặp xe tiếp theo
                
                lower_next = next_text.lower()
                if any(kw in lower_next for kw in time_keywords):
                    timestamp_str = parse_relative_time_to_iso(next_text)
                elif len(next_text) >= 3 and not any(kw in lower_next for kw in ["đang tìm", "pin", "lỗi", "chia sẻ", "vật dụng"]):
                    if not address:
                        address = next_text
                    elif next_text not in address:
                        address = f"{address}, {next_text}"
                j += 1
            
            items.append({
                "plate": raw_plate,
                "address": address or "TP. Huế",
                "timestamp": timestamp_str,
                "name": text
            })
            i = j - 1
        i += 1
    
    return items

def geocode_address(address: str) -> tuple[float, float] | None:
    """Geocode địa chỉ sang tọa độ GPS dùng Nominatim hoặc từ điển Huế."""
    if not address or address == "TP. Huế":
        return None
    
    # Context Thừa Thiên Huế
    clean_addr = address.replace("Thành Phố Huế", "TP Huế").replace("Thừa Thiên Huế", "")
    full_address = f"{clean_addr}, TP Huế, Thừa Thiên Huế, Việt Nam"
    
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": full_address,
        "format": "json",
        "limit": 1,
        "countrycodes": "vn",
    })
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "3lmotohue-sync/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  ⚠️ Geocode lỗi cho '{address}': {e}")
    
    return None

def push_to_api(items: list[dict]) -> bool:
    if not SYNC_SECRET:
        print("❌ Thiếu LOCATION_SYNC_SECRET. Không gửi dữ liệu vị trí khi chưa cấu hình mật mã riêng.")
        return False

    body = json.dumps(items).encode("utf-8")
    req  = urllib.request.Request(
        API_URL, data=body,
        headers={"Content-Type": "application/json", "x-sync-secret": SYNC_SECRET},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            res_text = res.read().decode()
            print(f"✅ API Response: {res_text}")
            return True
    except Exception as e:
        print(f"❌ Lỗi API: {e}")
        return False

def main():
    print("=" * 60)
    print("🔍 ĐỌC VỊ TRÍ TỪ FINDMY APP (APPLE)")
    print("=" * 60)
    
    # Bước 1: Đọc từ FindMy UI
    print("\n📱 Đang kết nối và đọc FindMy app...")
    items = []
    try:
        items = read_findmy_via_applescript()
    except Exception as e:
        print(f"⚠️ AppleScript: {e}")
    
    if not items:
        print("⚠️ Đang thử phương thức PyObjC AX API...")
        try:
            items = read_findmy_via_pyobjc()
        except Exception as e:
            print(f"❌ PyObjC thất bại: {e}")
    
    if not items:
        print("❌ Không tìm thấy thẻ xe nào trong Find My app!")
        sys.exit(1)
        
    print(f"✅ Đọc được {len(items)} thẻ xe từ Find My:")
    for item in items:
        print(f"  • Biển số: {item['plate']} | Vị trí: {item['address']} | Thời gian: {item['timestamp']}")
    
    # Bước 2: Geocode địa chỉ → GPS
    print("\n🗺️  Đang xử lý tọa độ vị trí...")
    payload = []
    for item in items:
        plate   = item["plate"]
        address = item["address"]
        timestamp = item["timestamp"]
        
        coords = geocode_address(address)
        if coords:
            lat, lng = coords
            print(f"  ✅ {plate}: ({lat:.6f}, {lng:.6f}) - {address}")
            payload.append({
                "licensePlate": plate,
                "lat": lat,
                "lng": lng,
                "address": address,
                "timestamp": timestamp,
                "force": True
            })
        
        time.sleep(0.3)
    
    if not payload:
        print("❌ Không có dữ liệu để gửi!")
        sys.exit(1)
    
    # Bước 3: Gửi lên API
    print(f"\n🚀 Đang gửi {len(payload)} vị trí lên website...")
    success = push_to_api(payload)
    if success:
        print(f"🎉 Hoàn tất đồng bộ {len(payload)} xe!")
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
