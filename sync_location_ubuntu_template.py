import os
import glob
import json
import time
import requests
from pathlib import Path

# API Endpoint & Secret
API_URL = "https://3lmotohue.com/api/vehicles/location-sync"
SYNC_SECRET = "3lmotohue-sync-secret-2026"

ACCESSORIES_DIR = Path.home() / "findmy-sync-service" / "accessories"

def sync_locations():
    json_files = sorted(glob.glob(str(ACCESSORIES_DIR / "*.json")))
    if not json_files:
        print("❌ Chưa tìm thấy tệp chìa khóa nào trong ~/findmy-sync-service/accessories/")
        return

    print(f"📦 Tìm thấy {len(json_files)} chìa khóa thẻ UGreen.")
    
    # Try importing findmy scanner or reports
    try:
        from findmy.keys import KeyPair
    except ImportError:
        print("⚠️ Chưa cài đặt thư viện findmy / requests. Đang tự động cài đặt...")
        os.system("pip3 install findmy requests")

    payload_by_plate = {}
    for filepath in json_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            identifier = data.get("identifier", "")
            license_plate = VEHICLE_MAP.get(identifier, data.get("name"))
            
            # Read last location timestamp from JSON or current time
            loc_time = data.get("last_location", {}).get("timestamp") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            if license_plate:
                candidate = {
                    "licensePlate": license_plate,
                    "lat": data.get("last_location", {}).get("latitude", 16.463713),
                    "lng": data.get("last_location", {}).get("longitude", 107.590866),
                    "address": data.get("last_location", {}).get("address", "TP. Huế"),
                    "timestamp": loc_time
                }
                
                # 📌 Nếu 1 xe lắp 2 thẻ định vị: ưu tiên lấy thẻ có thời gian mới nhất (còn sống)
                existing = payload_by_plate.get(license_plate)
                if not existing or str(candidate["timestamp"]) > str(existing["timestamp"]):
                    payload_by_plate[license_plate] = candidate
        except Exception as e:
            print(f"⚠️ Lỗi đọc tệp {filepath}: {e}")

    payload_items = list(payload_by_plate.values())
    if not payload_items:
        return

    print(f"📡 Đang gửi dữ liệu đồng bộ {len(payload_items)} vị trí lên {API_URL}...")
    headers = {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET
    }
    
    try:
        res = requests.post(API_URL, json=payload_items, headers=headers, timeout=10)
        if res.status_code == 200:
            print("✅ ĐỒNG BỘ THÀNH CÔNG!", res.json())
        else:
            print(f"❌ Lỗi API HTTP {res.status_code}:", res.text)
    except Exception as e:
        print("❌ Lỗi kết nối API:", e)

if __name__ == "__main__":
    sync_locations()
