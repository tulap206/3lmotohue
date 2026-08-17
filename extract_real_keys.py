#!/usr/bin/env python3
"""
Script trích xuất keypair thật từ OwnedBeacon records trên Mac.
Chạy bằng Terminal (không phải agent) để có quyền truy cập Keychain.
"""
import subprocess, sys, os, json, glob, plistlib
from pathlib import Path
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

BEACON_DIR = Path.home() / "Library/Group Containers/group.com.apple.icloud.searchpartyuseragent/Library/Storage/OwnedBeacons"
OUTPUT_DIR = Path.home() / "findmy-sync-service" / "accessories_real"

def get_beacon_store_key() -> bytes:
    """Lấy BeaconStore key từ macOS Keychain (sẽ hiện hộp thoại xác nhận)."""
    print("📱 Đang lấy BeaconStore key từ Keychain macOS...")
    print("   → Nếu xuất hiện hộp thoại yêu cầu mật khẩu, hãy nhập mật khẩu Mac của bạn.\n")
    
    # Thử -w trước (trả về hex string)
    result = subprocess.run(
        ["/usr/bin/security", "find-generic-password", "-l", "BeaconStore", "-w"],
        capture_output=True, text=True
    )
    if result.returncode == 0 and result.stdout.strip():
        try:
            return bytes.fromhex(result.stdout.strip())
        except ValueError:
            pass
    
    # Thử -g (in ra dạng hex với prefix)
    result = subprocess.run(
        ["/usr/bin/security", "find-generic-password", "-l", "BeaconStore", "-g"],
        capture_output=True, text=True
    )
    output = result.stdout + result.stderr
    if result.returncode == 0:
        import re
        m = re.search(r'"gena"<blob>=0x([0-9A-Fa-f]+)', output)
        if m:
            return bytes.fromhex(m.group(1))
        m = re.search(r'password: 0x([0-9A-Fa-f]+)', output)
        if m:
            return bytes.fromhex(m.group(1))
    
    raise RuntimeError("❌ Không tìm thấy BeaconStore key trong Keychain.\n"
                       "   Hãy mở System Settings → Privacy & Security → Full Disk Access\n"
                       "   và thêm Terminal vào danh sách.")

def decrypt_record(record_path: Path, key: bytes) -> dict:
    """Giải mã một file .record thành dict plist."""
    with open(record_path, "rb") as f:
        outer = plistlib.load(f)
    
    if not isinstance(outer, list) or len(outer) < 3:
        raise ValueError("Record format không đúng")
    
    nonce, tag, ciphertext = outer[0], outer[1], outer[2]
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce, tag))
    decryptor = cipher.decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    return plistlib.loads(plaintext)

def export_accessories(key: bytes):
    """Giải mã và xuất tất cả OwnedBeacon records ra JSON."""
    records = list(BEACON_DIR.glob("*.record"))
    print(f"📦 Tìm thấy {len(records)} OwnedBeacon records")
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    success = 0
    
    for record_path in sorted(records):
        uuid = record_path.stem
        try:
            plist_data = decrypt_record(record_path, key)
            
            # Lấy master_key (28 bytes cuối của privateKey)
            pk_data = plist_data.get("privateKey", {}).get("key", {}).get("data", b"")
            master_key = pk_data[-28:] if pk_data else b""
            
            # SKN (primary shared secret)
            skn = plist_data.get("sharedSecret", {}).get("key", {}).get("data", b"")
            
            # SKS (secondary shared secret)
            sks = plist_data.get("secondarySharedSecret", {}).get("key", {}).get("data", b"") or \
                  plist_data.get("secureLocationsSharedSecret", {}).get("key", {}).get("data", b"")
            
            paired_at = plist_data.get("pairingDate")
            model     = plist_data.get("model", "Unknown")
            name      = plist_data.get("name", f"UGreen {uuid[:8]}")
            
            if not master_key:
                print(f"  ⚠️  {uuid}: Không có master_key")
                continue
            
            import base64
            output = {
                "identifier":     uuid,
                "name":           name,
                "model":          model,
                "master_key_b64": base64.b64encode(master_key).decode(),
                "skn_b64":        base64.b64encode(skn).decode() if skn else "",
                "sks_b64":        base64.b64encode(sks).decode() if sks else "",
                "paired_at":      paired_at.isoformat() if paired_at else "",
            }
            
            out_path = OUTPUT_DIR / f"{uuid}.json"
            with open(out_path, "w") as f:
                json.dump(output, f, indent=2)
            
            print(f"  ✅ {uuid}: {name} ({model})")
            success += 1
            
        except Exception as e:
            print(f"  ❌ {uuid}: {e}")
    
    print(f"\n✅ Đã xuất {success}/{len(records)} keypair thật vào: {OUTPUT_DIR}")
    return success

if __name__ == "__main__":
    print("=" * 60)
    print("🔑 TRÍCH XUẤT KEYPAIR THẬT TỪ FINDMY MAC")
    print("=" * 60 + "\n")
    
    # Kiểm tra thư mục OwnedBeacons
    if not BEACON_DIR.exists():
        print(f"❌ Không tìm thấy thư mục: {BEACON_DIR}")
        sys.exit(1)
    
    try:
        key = get_beacon_store_key()
        print(f"✅ Đã lấy được BeaconStore key ({len(key)} bytes)\n")
        count = export_accessories(key)
        if count > 0:
            print(f"\n📌 Bước tiếp theo: Copy keypair vào thư mục accessories:")
            print(f"   cp {OUTPUT_DIR}/*.json ~/findmy-sync-service/accessories/")
    except RuntimeError as e:
        print(str(e))
        sys.exit(1)
