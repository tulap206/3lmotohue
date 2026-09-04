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

# 🚗 BẢNG ÁNH XÁ TỰ ĐỘNG KHỚP THẺ UGREEN VỚI CÁC BIỂN SỐ XE TRÊN WEB
VEHICLE_MAP = {
    "1C7F3F19-088A-4820-A6B1-03A0DAD6FB5E": "75E1-306.58",
    "30A7D033-6098-4685-ADD6-5D52AD843947": "74D1-283.78",
    "4A02641D-6C15-4463-9567-B8A814E97079": "75E1-336.33",
    "4FF8021C-033E-4473-821B-04C1AD6E0477": "75AA-631.70",
    "58A8454B-0A0D-4078-A1C0-30C87DFF9419": "75k1-258.77",
    "5CA5465A-96D8-4654-9BCF-EC7B35557587": "75E1-291.84",
    "5CA86B18-73BF-4F5C-A17F-E3B9490DAE62": "75AA-444.39",
    "6BB05E9C-9551-4173-A86A-F5521ECD825A": "92B1-359.21",
    "71EF2BBB-BC36-44B5-B49E-02719BF75131": "75F1-915.31",
    "9E7D79CB-A60B-4FE5-9866-E909FE3E90C5": "73G1-316.77"
}

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
