#!/usr/bin/env python3
"""
Đồng bộ vị trí thẻ UGreen từ Apple Find My lên Website 3lmotohue.com
Chạy tự động mỗi 10 phút trên MacBook (LaunchAgent)
"""
import os
import glob
import json
import asyncio
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone

from findmy import KeyPair
from findmy.accessory import FindMyAccessory
from findmy.plist import list_accessories, _get_beaconstore_key, decrypt_plist
from findmy.reports import AsyncAppleAccount, LocalAnisetteProvider
import findmy.reports as reports_mod

# ─── CẤU HÌNH ────────────────────────────────────────────────────────────────
API_URL         = "https://3lmotohue.com/api/vehicles/location-sync"
SYNC_SECRET     = os.environ.get("LOCATION_SYNC_SECRET", "").strip()
ACCOUNT_FILE    = Path.home() / "findmy-sync-service" / "apple_account.json"
LOG_FILE        = Path.home() / "findmy-sync-service" / "sync.log"

# Thư mục chứa keypair thật (từ extract_real_keys.py)
REAL_KEYS_DIR   = Path.home() / "findmy-sync-service" / "accessories_real"
# Thư mục backup chứa keypair cũ (fixed key)
FIXED_KEYS_DIR  = Path.home() / "findmy-sync-service" / "accessories"

# Đường dẫn OwnedBeacons trên Mac
BEACON_STORE_PATH = Path.home() / "Library/Group Containers/group.com.apple.icloud.searchpartyuseragent/Library/Storage"

# ─── ÁNH XẠ UUID THẺ UGREEN → BIỂN SỐ XE ────────────────────────────────────
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
    "9E7D79CB-A60B-4FE5-9866-E909FE3E90C5": "73G1-316.77",
    "A3A6F593-8BA0-4703-B2D0-E6E92D55C85A": "75E1-253.48",
    "A51CFE6E-C079-4335-9B59-F7B3A29BBCB9": "75E1-287.62",
    "BB90BC46-4EE2-4FC9-A992-DA911BC3610F": "75E1-374.41",
    "C97D4525-4FF2-4E3E-9C2D-2C0527B3D6C6": "75E1-412.55",
    "DB05EE33-96A1-4CB3-B6B2-5E819DE9FBF2": "75E1-189.73",
    "E5001C72-8043-4E93-866D-FC1D0C6CC8DE": "75E1-228.96",
    "E9E03E94-3756-4ABC-BE8C-31FA0E69A5DC": "75E1-345.87",
    "F274A521-82D3-4CF4-9F90-35B55FAB0A30": "75E1-463.19",
}

# ─── LOGGING ──────────────────────────────────────────────────────────────────
def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# ─── TẢI KEYPAIRS TỰ ĐỘNG ────────────────────────────────────────────────────
def load_accessories() -> tuple[list, dict]:
    """
    Ưu tiên 1: Đọc thẳng từ OwnedBeacon .record của Mac (dùng BeaconStore key)
    Ưu tiên 2: Đọc từ accessories_real/ (đã extract trước)
    Ưu tiên 3: Đọc từ accessories/ (fixed keypair - fallback)
    """
    accessories = []
    identifier_map: dict[str, str] = {}  # hashed_adv_key_b64 -> license_plate

    # ── Ưu tiên 1: Đọc trực tiếp từ OwnedBeacon trên Mac ──
    try:
        log("🔑 Đang đọc keypair thật từ OwnedBeacon records (Mac Keychain)...")
        key = _get_beaconstore_key()
        mac_accessories = list_accessories(key=key, search_path=BEACON_STORE_PATH)
        if mac_accessories:
            for acc in mac_accessories:
                uid = acc.identifier or ""
                plate = VEHICLE_MAP.get(uid)
                if plate:
                    # Lấy tất cả keypairs từ rolling schedule (7 ngày gần nhất)
                    for kp in acc.keys_between(acc.paired_at, datetime.now(timezone.utc)):
                        identifier_map[kp.hashed_adv_key_b64] = plate
                    accessories.append((acc, plate))
            if accessories:
                total_keys = sum(len(list(a.keys_between(a.paired_at, datetime.now(timezone.utc)))) for a, _ in accessories)
                log(f"✅ Đọc được {len(accessories)} accessories từ Mac ({total_keys} rolling keys)")
                return accessories, identifier_map
    except Exception as e:
        log(f"⚠️ Không đọc được OwnedBeacon trực tiếp: {e}")

    # ── Ưu tiên 2: Đọc từ accessories_real/ ──
    real_files = sorted(glob.glob(str(REAL_KEYS_DIR / "*.json"))) if REAL_KEYS_DIR.exists() else []
    if real_files:
        log(f"📂 Đọc {len(real_files)} keypair thật từ {REAL_KEYS_DIR}...")
        for fpath in real_files:
            try:
                d = json.load(open(fpath))
                uid   = d.get("identifier", "")
                plate = VEHICLE_MAP.get(uid)
                if not plate:
                    continue
                import base64
                from datetime import timezone
                master_key = base64.b64decode(d["master_key_b64"])
                skn        = base64.b64decode(d.get("skn_b64") or "")
                sks        = base64.b64decode(d.get("sks_b64") or "")
                paired_str = d.get("paired_at", "")
                paired_at  = datetime.fromisoformat(paired_str) if paired_str else datetime(2024, 1, 1, tzinfo=timezone.utc)
                
                acc = FindMyAccessory(
                    master_key=master_key, skn=skn, sks=sks,
                    paired_at=paired_at, name=d.get("name"), 
                    model=d.get("model"), identifier=uid,
                )
                for kp in acc.keys_between(paired_at, datetime.now(timezone.utc)):
                    identifier_map[kp.hashed_adv_key_b64] = plate
                accessories.append((acc, plate))
            except Exception as e:
                log(f"  ⚠️ Lỗi đọc {os.path.basename(fpath)}: {e}")
        if accessories:
            log(f"✅ Đọc được {len(accessories)} accessories thật")
            return accessories, identifier_map

    # ── Ưu tiên 3: Fallback dùng fixed KeyPair ──
    fixed_files = sorted(glob.glob(str(FIXED_KEYS_DIR / "*.json"))) if FIXED_KEYS_DIR.exists() else []
    log(f"⚠️ Fallback: dùng {len(fixed_files)} fixed keypair (có thể không có báo cáo)")
    fixed_accessories = []
    fixed_map = {}
    for fpath in fixed_files:
        try:
            d = json.load(open(fpath))
            uid   = d.get("identifier", "")
            plate = VEHICLE_MAP.get(uid)
            pk    = d.get("private_key_b64", "")
            if plate and pk:
                kp = KeyPair.from_b64(pk)
                fixed_map[kp.hashed_adv_key_b64] = plate
                fixed_accessories.append((kp, plate))
        except Exception:
            pass
    return fixed_accessories, fixed_map

# ─── LƯU / ĐỌC PHIÊN ĐĂNG NHẬP ──────────────────────────────────────────────
def save_session(acc: AsyncAppleAccount):
    try:
        ACCOUNT_FILE.parent.mkdir(parents=True, exist_ok=True)
        acc.to_json(ACCOUNT_FILE)
        log("✅ Đã lưu phiên đăng nhập Apple ID.")
    except Exception:
        try:
            raw = acc.to_json()
            with open(ACCOUNT_FILE, "w") as f:
                json.dump(raw, f, indent=2)
            log("✅ Đã lưu phiên (fallback).")
        except Exception as e:
            log(f"⚠️ Không lưu được phiên: {e}")

# ─── ĐĂNG NHẬP APPLE ID ──────────────────────────────────────────────────────
async def do_login(account: AsyncAppleAccount):
    print("\n🔐 ĐĂNG NHẬP APPLE ID LẦN ĐẦU:")
    apple_id = input("  👉 Apple ID (Email): ").strip()
    password = input("  👉 Mật khẩu: ").strip()
    state    = await account.login(apple_id, password)

    if state == reports_mod.LoginState.REQUIRE_2FA:
        methods = await account.get_2fa_methods()
        method  = methods[0]
        if isinstance(method, reports_mod.TrustedDeviceSecondFactorMethod):
            await account.td_2fa_request()
            code = input("  📱 Nhập mã 6 số từ thiết bị Apple: ").strip()
            await account.td_2fa_submit(code)
        elif isinstance(method, reports_mod.SmsSecondFactorMethod):
            await account.sms_2fa_request(getattr(method, "id", 0))
            code = input("  📱 Nhập mã 6 số từ SMS: ").strip()
            await account.sms_2fa_submit(getattr(method, "id", 0), code)
        else:
            code = input("  📱 Nhập mã 6 số: ").strip()
            try:
                await account.td_2fa_submit(code)
            except Exception:
                await account.sms_2fa_submit(0, code)
    save_session(account)

# ─── GỬI DỮ LIỆU LÊN API ─────────────────────────────────────────────────────
def push_to_api(items: list[dict]) -> bool:
    if not SYNC_SECRET:
        log("❌ Thiếu LOCATION_SYNC_SECRET. Không gửi dữ liệu vị trí khi chưa cấu hình mật mã riêng.")
        return False

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(items).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-sync-secret": SYNC_SECRET},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            log(f"✅ API: {res.read().decode()[:200]}")
            return True
    except Exception as e:
        log(f"❌ Lỗi gửi API: {e}")
        return False

# ─── HÀM ĐỒNG BỘ CHÍNH ───────────────────────────────────────────────────────
async def sync_once():
    log("=" * 60)
    log("🚗 Bắt đầu đồng bộ vị trí từ Apple Find My Server...")

    # ── Khôi phục / đăng nhập Apple ID ──
    if ACCOUNT_FILE.exists():
        try:
            account = AsyncAppleAccount.from_json(str(ACCOUNT_FILE))
            log("🔑 Đã khôi phục phiên đăng nhập tự động.")
        except Exception as e:
            log(f"⚠️ Phiên hết hạn ({e})")
            anisette = LocalAnisetteProvider()
            account  = AsyncAppleAccount(anisette)
            await do_login(account)
    else:
        anisette = LocalAnisetteProvider()
        account  = AsyncAppleAccount(anisette)
        await do_login(account)

    if account.login_state != reports_mod.LoginState.LOGGED_IN:
        log("❌ Chưa đăng nhập được. Bỏ qua.")
        return

    # ── Tải accessories ──
    accessories, identifier_map = load_accessories()
    if not accessories:
        log("❌ Không có keypair nào!")
        return

    # ── Tạo danh sách keypairs để query Apple ──
    from datetime import timezone as tz
    now = datetime.now(tz.utc)
    keypairs_to_fetch = []
    kp_to_plate: dict[str, str] = {}

    for item, plate in accessories:
        if isinstance(item, FindMyAccessory):
            # Rolling keys: lấy tất cả key trong 7 ngày
            for kp in item.keys_between(item.paired_at, now):
                keypairs_to_fetch.append(kp)
                kp_to_plate[kp.hashed_adv_key_b64] = plate
        else:
            # Fixed keypair
            keypairs_to_fetch.append(item)
            kp_to_plate[item.hashed_adv_key_b64] = plate

    log(f"📦 Tổng {len(keypairs_to_fetch)} keypairs để truy vấn Apple Server.")

    # ── Fetch từ Apple Server ──
    log("📡 Đang truy vấn Apple Server...")
    try:
        reports = await account.fetch_location_history(keypairs_to_fetch)
    except Exception as e:
        if "401" in str(e) or "Unauthorized" in type(e).__name__:
            log("🔐 Phiên hết hạn, đăng nhập lại...")
            ACCOUNT_FILE.unlink(missing_ok=True)
            anisette = LocalAnisetteProvider()
            account  = AsyncAppleAccount(anisette)
            await do_login(account)
            reports  = await account.fetch_location_history(keypairs_to_fetch)
        else:
            log(f"❌ Lỗi fetch: {e}")
            await account.close()
            return

    # ── Xử lý kết quả ──
    payload_by_plate: dict[str, dict] = {}
    total_reports = 0

    for kp, report_list in reports.items():
        if not report_list:
            continue
        plate = kp_to_plate.get(kp.hashed_adv_key_b64)
        if not plate:
            continue
        total_reports += len(report_list)
        latest = max(report_list, key=lambda r: r.timestamp)
        candidate = {
            "licensePlate": plate,
            "lat":          latest.latitude,
            "lng":          latest.longitude,
            "address":      "",
            "timestamp":    latest.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        existing = payload_by_plate.get(plate)
        if not existing or candidate["timestamp"] > existing["timestamp"]:
            payload_by_plate[plate] = candidate

    log(f"📍 Nhận {total_reports} báo cáo → {len(payload_by_plate)} xe có vị trí mới.")

    if not payload_by_plate:
        log("⚠️ Chưa có báo cáo vị trí từ Apple Server.")
    else:
        push_to_api(list(payload_by_plate.values()))

    await account.close()

# ─── ENTRY POINT ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    asyncio.run(sync_once())
