import os
import glob
import json
import time
import asyncio
import urllib.request
from pathlib import Path

import findmy
from findmy import KeyPair
from findmy.reports import AsyncAppleAccount, LocalAnisetteProvider

API_URL = "https://3lmotohue.com/api/vehicles/location-sync"
SYNC_SECRET = "3lmotohue-sync-secret-2026"
ACCESSORIES_DIR = Path.home() / "findmy-sync-service" / "accessories"
ACCOUNT_FILE = Path.home() / "findmy-sync-service" / "apple_account.json"

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

def save_account_session(acc):
    d = acc.to_json()
    if isinstance(d, dict) and "login" in d and "data" in d["login"]:
        login_data = d["login"]["data"]
        clean_data = {}
        for k, v in login_data.items():
            if isinstance(v, (str, int, float, bool, dict, list)) or v is None:
                clean_data[k] = v
            else:
                clean_data[k] = str(v)
        d["login"]["data"] = clean_data
    ACCOUNT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ACCOUNT_FILE, "w", encoding="utf-8") as f:
        f.write(json.dumps(d, indent=2))

async def auto_sync_findmy_locations():
    anisette = LocalAnisetteProvider()
    account = AsyncAppleAccount(anisette)

    # Check if logged in account session exists
    if ACCOUNT_FILE.exists():
        try:
            with open(ACCOUNT_FILE, "r", encoding="utf-8") as f:
                account = AsyncAppleAccount.from_json(f.read(), anisette)
            print("🔑 Đã khôi phục phiên đăng nhập Apple ID thành công!")
        except Exception as e:
            print("⚠️ Phiên đăng nhập cũ đã hết hạn, cần đăng nhập lại:", e)

    if account.login_state != findmy.reports.LoginState.LOGGED_IN:
        print("\n🔐 CẦN ĐĂNG NHẬP APPLE ID ĐỂ TẢI VỊ TRÍ TỰ ĐỘNG TỪ APPLE SERVER:")
        apple_id = input("👉 Nhập Apple ID (Email): ").strip()
        password = input("👉 Nhập Mật khẩu Apple ID: ").strip()
        
        state = await account.login(apple_id, password)
        if state == findmy.reports.LoginState.REQUIRE_2FA:
            methods = await account.get_2fa_methods()
            print(f"📱 Cần xác thực 2FA. Đang xử lý mã xác thực...")
            method = methods[0]
            
            if isinstance(method, findmy.reports.TrustedDeviceSecondFactorMethod):
                print("📩 Mã xác thực 6 số đã được gửi tới thiết bị Apple (iPhone/iPad/Mac).")
                await account.td_2fa_request()
                code = input("👉 Nhập mã xác thực 6 số hiển thị trên màn hình: ").strip()
                await account.td_2fa_submit(code)
            elif isinstance(method, findmy.reports.SmsSecondFactorMethod):
                print("📱 Mã xác thực SMS đang được gửi tới số điện thoại của bạn.")
                phone_id = getattr(method, 'id', 0)
                await account.sms_2fa_request(phone_id)
                code = input("👉 Nhập mã xác thực 6 số từ SMS: ").strip()
                await account.sms_2fa_submit(phone_id, code)
            else:
                code = input("👉 Nhập mã xác thực 6 số: ").strip()
                try:
                    await account.td_2fa_submit(code)
                except Exception:
                    await account.sms_2fa_submit(0, code)

        try:
            save_account_session(account)
            print("✅ Đã lưu phiên đăng nhập Apple ID! Lần sau sẽ tự động 100% không cần nhập lại.")
        except Exception as save_err:
            print("⚠️ Không thể lưu file phiên đăng nhập:", save_err)

    # Load 18 UGreen tag keypairs
    json_files = sorted(glob.glob(str(ACCESSORIES_DIR / "*.json")))
    keypairs = []
    key_info_map = {}

    for filepath in json_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            identifier = data.get("identifier", "")
            private_key = data.get("private_key_b64", "")
            if private_key:
                kp = KeyPair.from_b64(private_key)
                keypairs.append(kp)
                key_info_map[kp.hashed_adv_key_b64] = {
                    "identifier": identifier,
                    "licensePlate": VEHICLE_MAP.get(identifier, data.get("name"))
                }
        except Exception as e:
            print(f"⚠️ Lỗi đọc tệp chìa khóa {filepath}: {e}")

    if not keypairs:
        print("❌ Không tìm thấy chìa khóa UGreen hợp lệ!")
        return

    print(f"📡 Đang tải vị trí tự động từ Apple Server cho {len(keypairs)} thẻ UGreen...")
    reports = await account.fetch_location_history(keypairs)

    payload_by_plate = {}
    for kp, report_list in reports.items():
        info = key_info_map.get(kp.hashed_adv_key_b64, {})
        plate = info.get("licensePlate")
        if not plate or not report_list:
            continue
        
        latest_report = max(report_list, key=lambda r: r.timestamp)
        candidate = {
            "licensePlate": plate,
            "lat": latest_report.latitude,
            "lng": latest_report.longitude,
            "address": "", # Server API sẽ tự động dịch ra Số nhà, Tên đường, Phường
            "timestamp": latest_report.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        existing = payload_by_plate.get(plate)
        if not existing or candidate["timestamp"] > existing["timestamp"]:
            payload_by_plate[plate] = candidate

    payload_items = list(payload_by_plate.values())
    if not payload_items:
        print("⚠️ Chưa có báo cáo vị trí mới từ Apple Server.")
        return

    print(f"🚀 Đang gửi dữ liệu vị trí tự động của {len(payload_items)} xe lên Website...")
    req = urllib.request.Request(
        API_URL,
        headers={
            "Content-Type": "application/json",
            "x-sync-secret": SYNC_SECRET
        },
        data=json.dumps(payload_items).encode("utf-8")
    )
    try:
        with urllib.request.urlopen(req) as res:
            print("✅ ĐỒNG BỘ TỰ ĐỘNG THÀNH CÔNG:", res.read().decode())
    except Exception as e:
        print("❌ Lỗi gửi dữ liệu:", e)

if __name__ == "__main__":
    asyncio.run(auto_sync_findmy_locations())
