import sys
import json
import traceback
from pathlib import Path
from findmy import AppleAccount, LocalAnisetteProvider

def main():
    print("============================================================")
    print("🔑 CHƯƠNG TRÌNH LẤY CHÌA KHÓA THẺ UGREEN TỪ APPLE ICLOUD")
    print("============================================================")
    
    anisette = LocalAnisetteProvider()
    account = AppleAccount(anisette)
    
    email = input("👉 Nhập Apple ID (Email): ").strip()
    password = input("👉 Nhập Mật khẩu Apple ID: ").strip()
    
    if not email or not password:
        print("❌ Email và mật khẩu không được để trống.")
        return

    try:
        print("\n⏳ Đang kết nối đến máy chủ Apple...")
        account.login(email, password)
        print("✅ Đăng nhập Apple ID thành công!")
    except Exception as e:
        print(f"❌ Lỗi đăng nhập Apple ID: {e}")
        traceback.print_exc()
        return

    out_dir = Path.home() / "findmy_temp_keys"
    out_dir.mkdir(exist_ok=True)

    try:
        reports = account.fetch_location()
        print(f"\n🎉 Đã tải về vị trí & chìa khóa của {len(reports)} thiết bị/thẻ định vị!")
        
        for idx, rep in enumerate(reports):
            if hasattr(rep, "to_dict"):
                data = rep.to_dict()
            else:
                data = {
                    "identifier": getattr(rep, "identifier", f"accessory-{idx+1}"),
                    "name": getattr(rep, "name", f"Thẻ UGreen {idx+1}"),
                    "model": getattr(rep, "model", "UGreen Smart Tag"),
                    "master_key": getattr(rep, "master_key", ""),
                    "skn": getattr(rep, "skn", ""),
                    "sks": getattr(rep, "sks", ""),
                }
            identifier = data.get("identifier", f"acc-{idx+1}")
            name = data.get("name", f"Thẻ UGreen {idx+1}")
            out_file = out_dir / f"{identifier}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f" -> Đã tạo tệp chìa khóa: {out_file.name} ({name})")
    except Exception as e:
        print(f"⚠️ Lỗi lấy dữ liệu thẻ: {e}")
        traceback.print_exc()

    try:
        account.close()
    except Exception:
        pass

if __name__ == "__main__":
    main()
