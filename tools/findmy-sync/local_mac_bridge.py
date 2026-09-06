from __future__ import annotations
import os
import sys
import json
import time
import threading
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3333
WORKSPACE_DIR = Path(__file__).resolve().parent
SYNC_BINARY_PATH = Path.home() / "findmy-sync-service" / "sync_findmy_live"
SYNC_SWIFT_SCRIPT = WORKSPACE_DIR / "sync_findmy_live.swift"
SYNC_UI_SCRIPT = WORKSPACE_DIR / "sync_from_findmy_ui.py"
SYNC_AUTO_SCRIPT = WORKSPACE_DIR / "sync_auto_findmy.py"
SYNC_MAC_SCRIPT = WORKSPACE_DIR / "sync_mac_findmy.py"

API_BASE_URL = "https://3lmotohue.com/api/vehicles/sync-trigger"
SYNC_SECRET = "3lmotohue-sync-secret-2026"

def execute_mac_sync() -> tuple[bool, str, str]:
    """Kích hoạt mở Find My trên Mac và cào dữ liệu vị trí đẩy lên Cloud"""
    candidates = []

    # 1. Mac direct sync (Nhanh nhất, trực tiếp từ keychain/accessories)
    if SYNC_MAC_SCRIPT.exists():
        candidates.append(("sync_mac_findmy.py", [sys.executable, str(SYNC_MAC_SCRIPT)]))

    # 2. Native binary
    if SYNC_BINARY_PATH.exists() and os.access(SYNC_BINARY_PATH, os.X_OK):
        candidates.append(("sync_findmy_live", [str(SYNC_BINARY_PATH)]))

    # 3. Python UI Script (AppleScript / PyObjC)
    if SYNC_UI_SCRIPT.exists():
        candidates.append(("sync_from_findmy_ui.py", [sys.executable, str(SYNC_UI_SCRIPT)]))

    # 4. Swift Runner Script
    if SYNC_SWIFT_SCRIPT.exists():
        candidates.append(("sync_findmy_live.swift", ["swift", str(SYNC_SWIFT_SCRIPT)]))

    # 5. Auto FindMy Script
    if SYNC_AUTO_SCRIPT.exists():
        candidates.append(("sync_auto_findmy.py", [sys.executable, str(SYNC_AUTO_SCRIPT)]))

    if not candidates:
        return False, "none", "Không tìm thấy script đồng bộ nào."

    last_output = ""
    last_method = ""

    for method_name, cmd in candidates:
        try:
            print(f"🚀 [Mac Bridge] Đang thử phương thức ({method_name}): {' '.join(cmd)} ...")
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            output = ((res.stdout or "") + "\n" + (res.stderr or "")).strip()
            last_output = output
            last_method = method_name

            if res.returncode == 0:
                print(f"✅ [Mac Bridge] Phương thức {method_name} thành công!\n{output}")
                return True, method_name, output
            else:
                print(f"⚠️ [Mac Bridge] Phương thức {method_name} thất bại (exit code {res.returncode}):\n{output}")
        except Exception as err:
            print(f"⚠️ [Mac Bridge] Lỗi khi chạy {method_name}: {err}")
            last_output = str(err)
            last_method = method_name

    return False, last_method, last_output

class MacSyncBridgeHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-sync-secret")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_cors_headers()
        self.end_headers()
        response = {
            "status": "online",
            "message": "Mac FindMy Sync Bridge đang hoạt động",
            "port": PORT,
            "has_binary": SYNC_BINARY_PATH.exists(),
            "has_ui_script": SYNC_UI_SCRIPT.exists(),
            "has_auto_script": SYNC_AUTO_SCRIPT.exists()
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

    def do_POST(self):
        print("\n⚡ [Mac Bridge Local] Nhận yêu cầu kích hoạt đồng bộ từ Local Web...")
        success, method_used, output = execute_mac_sync()
        
        self.send_response(200 if success else 500)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_cors_headers()
        self.end_headers()
        response = {
            "success": success,
            "method": method_used,
            "message": "Đã chạy đồng bộ từ Mac thành công" if success else "Chạy script đồng bộ nhưng có lỗi",
            "output": output
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

def cloud_poller_worker():
    """Lắng nghe yêu cầu từ Website Cloud (https://3lmotohue.com) qua cơ chế Long-polling"""
    print("🌐 [Cloud Poller] Bắt đầu lắng nghe tín hiệu 'Cập nhật vị trí' từ 3lmotohue.com...")
    
    poll_url = f"{API_BASE_URL}?action=poll"
    complete_url = API_BASE_URL
    
    while True:
        try:
            req = urllib.request.Request(
                poll_url,
                headers={
                    "User-Agent": "3lmotohue-mac-bridge/1.0",
                    "x-sync-secret": SYNC_SECRET
                }
            )
            
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    
                    if data.get("trigger"):
                        req_id = data.get("requestId", "")
                        print(f"\n🔔 [Cloud Poller] Nhận yêu cầu bấm nút 'Cập nhật vị trí' từ Web! (Request ID: {req_id})")
                        
                        # Kích hoạt mở Find My và đồng bộ
                        success, method_used, output = execute_mac_sync()
                        
                        # Báo cáo kết quả lại cho Cloud API
                        complete_payload = json.dumps({
                            "action": "complete" if success else "fail",
                            "requestId": req_id,
                            "result": {
                                "success": success,
                                "method": method_used,
                                "output": output
                            }
                        }).encode("utf-8")
                        
                        comp_req = urllib.request.Request(
                            complete_url,
                            data=complete_payload,
                            headers={
                                "Content-Type": "application/json",
                                "x-sync-secret": SYNC_SECRET
                            }
                        )
                        try:
                            with urllib.request.urlopen(comp_req, timeout=10) as comp_resp:
                                print(f"✅ [Cloud Poller] Đã phản hồi kết quả về Web thành công.")
                        except Exception as e:
                            print(f"⚠️ [Cloud Poller] Lỗi gửi kết quả hoàn tất: {e}")

        except urllib.error.HTTPError as e:
            if e.code == 401:
                print("❌ [Cloud Poller] Sai mật mã x-sync-secret!")
                time.sleep(10)
            else:
                time.sleep(2)
        except Exception as e:
            # Network issue hoặc timeout bình thường của long-poll
            time.sleep(1)

def run_server():
    # Khởi chạy luồng Cloud Poller
    poller_thread = threading.Thread(target=cloud_poller_worker, daemon=True)
    poller_thread.start()

    server_address = ("", PORT)
    HTTPServer.allow_reuse_address = True
    httpd = HTTPServer(server_address, MacSyncBridgeHandler)
    print(f"================================================================")
    print(f"🚀 Mac FindMy Sync Bridge đang chạy tại http://localhost:{PORT}")
    print(f"🌐 Đang kết nối lắng nghe tín hiệu từ https://3lmotohue.com")
    print(f"📌 Khi bấm nút 'Cập nhật vị trí' trên Web, máy Mac sẽ mở Tìm và cập nhật!")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Đã dừng Mac Sync Bridge.")

if __name__ == "__main__":
    run_server()
