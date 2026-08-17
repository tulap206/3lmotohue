import glob
import json
import os
from pathlib import Path

ACCESSORIES_DIR = Path.home() / "findmy-sync-service" / "accessories"

def show_and_update_tag_locations():
    json_files = sorted(glob.glob(str(ACCESSORIES_DIR / "*.json")))
    print(f"📦 Tìm thấy {len(json_files)} tệp chìa khóa UGreen:")
    
    for filepath in json_files:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        name = data.get("name", "Unknown")
        identifier = data.get("identifier", "Unknown")
        last_loc = data.get("last_location", {})
        print(f"  • [{name}] ID: {identifier} | Vị trí: {last_loc.get('address', 'Mặc định mẫu')} | Thời gian: {last_loc.get('timestamp', 'Chưa có')}")

if __name__ == "__main__":
    show_and_update_tag_locations()
