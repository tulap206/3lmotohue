import sys
import json
import subprocess
from pathlib import Path
from findmy.plist import decrypt_plist, _get_accessory_name, _get_alignment_plist
from findmy.accessory import FindMyAccessory

def get_key_from_user():
    print("============================================================")
    print("🔑 GIẢI MÃ CHÌA KHÓA THẺ UGREEN FIND MY")
    print("============================================================")
    
    # 1. Thử tự động lấy bằng security
    cmds = [
        ["/usr/bin/security", "find-generic-password", "-l", "BeaconStore", "-w"],
        ["/usr/bin/security", "find-generic-password", "-l", "BeaconStoreKey", "-w"],
        ["/usr/bin/security", "find-generic-password", "-s", "BeaconStore", "-w"],
        ["/usr/bin/security", "find-generic-password", "-s", "BeaconStoreKey", "-w"],
    ]
    for cmd in cmds:
        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
            hex_str = res.stdout.strip()
            if hex_str and len(hex_str) >= 32:
                try:
                    return bytes.fromhex(hex_str)
                except ValueError:
                    pass
        except Exception:
            pass

    # 2. Nếu chưa tự lấy được, yêu cầu nhập chìa khóa Keychain
    print("\n⚠️ macOS bảo mật chặn tự động đọc Keychain.")
    print("👉 Bạn hãy mở ứng dụng 'Keychain Access' (Truy cập Móc khóa) trên Mac:")
    print(" 1. Tìm kiếm từ khóa 'BeaconStore'")
    print(" 2. Nhấp đôi vào 'BeaconStore' -> đánh dấu chọn 'Hiển thị mật khẩu' (Show Password)")
    print(" 3. Mở khóa mật khẩu Mac, sao chép chuỗi mã Hex thu được và dán vào bên dưới:\n")
    
    user_hex = input("👉 Dán mã Hex BeaconStore (64 ký tự): ").strip()
    if user_hex:
        try:
            return bytes.fromhex(user_hex)
        except ValueError:
            print("❌ Mã Hex không hợp lệ.")
    return None

def main():
    key = get_key_from_user()
    if not key:
        print("❌ Không có chìa khóa giải mã BeaconStore. Không thể tiếp tục.")
        return

    storage_path = Path.home() / "Library/Group Containers/group.com.apple.icloud.searchpartyuseragent/Library/Storage"
    if not storage_path.exists():
        storage_path = Path.home() / "Library/com.apple.icloud.searchpartyd"

    records = list((storage_path / "OwnedBeacons").glob("*.record"))
    print(f"\n📦 Tìm thấy {len(records)} tệp chìa khóa thẻ trong OwnedBeacons.")

    out_dir = Path.home() / "findmy_temp_keys"
    out_dir.mkdir(exist_ok=True)

    success_count = 0
    for path in records:
        try:
            plist = decrypt_plist(path, key)
            name = _get_accessory_name(path.stem, key, search_path=storage_path, group_id=plist.get("groupIdentifier"))
            alignment_plist = _get_alignment_plist(path.stem, key, search_path=storage_path)
            
            acc = FindMyAccessory.from_plist(plist, alignment_plist, name=name)
            data = acc.to_dict()
            
            out_file = out_dir / f"{acc.identifier}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f" -> ✅ Giải mã thành công: {out_file.name} ({acc.name})")
            success_count += 1
        except Exception as e:
            print(f" -> ❌ Lỗi giải mã file {path.name}: {e}")

    print(f"\n🎉 HOÀN THÀNH! Đã giải mã thành công {success_count}/{len(records)} tệp chìa khóa UGreen vào ~/findmy_temp_keys.")

if __name__ == "__main__":
    main()
