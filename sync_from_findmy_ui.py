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
from datetime import datetime

# ─── CẤU HÌNH ────────────────────────────────────────────────────────────────
API_URL     = "https://3lmotohue.com/api/vehicles/location-sync"
SYNC_SECRET = "3lmotohue-sync-secret-2026"

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

def parse_items(texts: list[str]) -> list[dict]:
    """Phân tích danh sách text → list items với name và address."""
    items = []
    # Pattern biển số xe trong tên thẻ
    plate_pattern = re.compile(r'(\d{2}[A-Za-z]\d{1,2}-\d{3}\.\d{2})')
    
    i = 0
    while i < len(texts):
        text = texts[i]
        m = plate_pattern.search(text)
        if m:
            plate = m.group(1).upper()
            # Tìm địa chỉ ở dòng tiếp theo (thường là street, ward)
            address = ""
            if i + 1 < len(texts):
                next_text = texts[i + 1]
                # Địa chỉ không chứa biển số
                if not plate_pattern.search(next_text) and len(next_text) > 5:
                    address = next_text
                    i += 1  # skip address line
            items.append({"plate": plate, "address": address, "name": text})
        i += 1
    
    return items

def geocode_address(address: str) -> tuple[float, float] | None:
    """Geocode địa chỉ sang tọa độ GPS dùng Nominatim."""
    if not address:
        return None
    
    # Thêm context "Huế, Việt Nam" để tăng độ chính xác
    full_address = f"{address}, Thừa Thiên Huế, Việt Nam"
    
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": full_address,
        "format": "json",
        "limit": 1,
        "countrycodes": "vn",
    })
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "3lmotohue-sync/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  ⚠️ Geocode lỗi cho '{address}': {e}")
    return None

def push_to_api(items: list[dict]) -> bool:
    body = json.dumps(items).encode("utf-8")
    req  = urllib.request.Request(
        API_URL, data=body,
        headers={"Content-Type": "application/json", "x-sync-secret": SYNC_SECRET},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            print(f"✅ API: {res.read().decode()[:200]}")
            return True
    except Exception as e:
        print(f"❌ Lỗi API: {e}")
        return False

def main():
    print("=" * 60)
    print("🔍 ĐỌC VỊ TRÍ TỪ FINDMY APP")
    print("=" * 60)
    
    # Bước 1: Đọc từ FindMy UI
    print("\n📱 Đang đọc FindMy app...")
    try:
        items = read_findmy_via_applescript()
    except PermissionError as e:
        print(f"\n⚠️ {e}")
        print("\n👉 Làm theo hướng dẫn:")
        print("   1. Mở System Settings → Privacy & Security → Accessibility")
        print("   2. Bật Terminal vào danh sách")
        print("   3. Chạy lại script này")
        sys.exit(1)
    
    if not items:
        print("⚠️ Không đọc được dữ liệu từ FindMy. Thử approach PyObjC...")
        try:
            items = read_findmy_via_pyobjc()
        except Exception as e:
            print(f"❌ PyObjC cũng thất bại: {e}")
            sys.exit(1)
    
    print(f"✅ Đọc được {len(items)} thẻ từ FindMy:")
    for item in items:
        print(f"  • {item['plate']}: {item['address']}")
    
    if not items:
        print("❌ Không có dữ liệu!")
        sys.exit(1)
    
    # Bước 2: Geocode địa chỉ → GPS
    print("\n🗺️  Geocoding địa chỉ...")
    payload = []
    for item in items:
        plate   = item["plate"]
        address = item["address"]
        
        coords = geocode_address(address)
        if coords:
            lat, lng = coords
            print(f"  ✅ {plate}: {lat:.6f}, {lng:.6f} ({address})")
            payload.append({
                "licensePlate": plate,
                "lat": lat,
                "lng": lng,
                "address": address,
                "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            })
        else:
            print(f"  ⚠️ {plate}: không geocode được '{address}'")
        
        time.sleep(1)  # Rate limit Nominatim (1 req/sec)
    
    if not payload:
        print("❌ Không có tọa độ nào để gửi!")
        sys.exit(1)
    
    # Bước 3: Gửi lên API
    print(f"\n🚀 Gửi {len(payload)} vị trí lên website...")
    push_to_api(payload)

if __name__ == "__main__":
    main()
