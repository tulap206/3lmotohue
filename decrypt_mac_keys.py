import os
import sys
import json
import glob
import subprocess
from pathlib import Path

def get_beaconstore_key():
    candidates = [
        ["/usr/bin/security", "find-generic-password", "-l", "BeaconStore", "-w"],
        ["/usr/bin/security", "find-generic-password", "-l", "BeaconStoreKey", "-w"],
        ["/usr/bin/security", "find-generic-password", "-s", "BeaconStore", "-w"],
        ["/usr/bin/security", "find-generic-password", "-s", "BeaconStoreKey", "-w"],
        ["/usr/bin/security", "find-generic-password", "-a", "BeaconStoreKey", "-w"],
    ]
    for cmd in candidates:
        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
            out = res.stdout.strip()
            if out and len(out) >= 32:
                try:
                    return bytes.fromhex(out)
                except ValueError:
                    pass
        except Exception:
            pass
    return None

def find_storage_path():
    paths = [
        Path.home() / "Library/Group Containers/group.com.apple.icloud.searchpartyuseragent/Library/Storage",
        Path.home() / "Library/com.apple.icloud.searchpartyd",
        Path.home() / "Library/Caches/com.apple.findmy.fmipcore",
    ]
    for p in paths:
        if (p / "OwnedBeacons").exists():
            return p
    return paths[0]

def main():
    print("🔎 Đang quét hệ thống macOS để lấy chìa khóa thẻ UGreen...")
    
    storage_path = find_storage_path()
    print(f"📁 Thư mục lưu trữ Find My: {storage_path}")

    records = list((storage_path / "OwnedBeacons").glob("*.record"))
    print(f"📦 Số lượng tệp thẻ Find My tìm thấy: {len(records)}")

    if not records:
        print("❌ Không tìm thấy tệp thẻ nào trong OwnedBeacons.")
        return

    key = get_beaconstore_key()
    if not key:
        print("⚠️ Chưa tự động lấy được chìa khóa BeaconStore từ Keychain.")
        print("Đang thử giải mã mặc định...")
    else:
        print(f"🔑 Lấy chìa khóa BeaconStore từ Keychain thành công: {key.hex()[:8]}...")

    from findmy.plist import list_accessories

    out_dir = Path.home() / "findmy_temp_keys"
    out_dir.mkdir(exist_ok=True)

    try:
        accs = list_accessories(key=key, search_path=storage_path)
        print(f"✅ Giải mã thành công {len(accs)} thẻ UGreen!")
        for acc in accs:
            data = acc.to_dict()
            out_file = out_dir / f"{acc.identifier}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f" -> Đã lưu: {out_file.name} ({acc.name})")
    except Exception as e:
        import traceback
        print(f"❌ Lỗi khi giải mã: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
