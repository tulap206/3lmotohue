import os
import sys
import json
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3333
WORKSPACE_DIR = Path(__file__).resolve().parent
SYNC_BINARY_PATH = Path.home() / "findmy-sync-service" / "sync_findmy_live"
SYNC_UI_SCRIPT = WORKSPACE_DIR / "sync_from_findmy_ui.py"
SYNC_AUTO_SCRIPT = WORKSPACE_DIR / "sync_auto_findmy.py"

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
        print("\n⚡ [Mac Bridge] Nhận yêu cầu kích hoạt đồng bộ từ Web Button...")
        output = ""
        success = False
        method_used = ""
        
        try:
            # Ưu tiên 1: Chạy sync_from_findmy_ui.py nếu có (đọc UI FindMy trực tiếp trên Mac)
            if SYNC_UI_SCRIPT.exists():
                method_used = "sync_from_findmy_ui.py"
                print(f"🚀 Đang chạy: python3 {SYNC_UI_SCRIPT} ...")
                res = subprocess.run([sys.executable, str(SYNC_UI_SCRIPT)], capture_output=True, text=True, timeout=40)
                output = (res.stdout or "") + "\n" + (res.stderr or "")
                success = (res.returncode == 0)
            
            # Ưu tiên 2: Chạy native binary nếu có
            elif SYNC_BINARY_PATH.exists() and os.access(SYNC_BINARY_PATH, os.X_OK):
                method_used = "sync_findmy_live"
                print(f"🚀 Đang chạy binary: {SYNC_BINARY_PATH} ...")
                res = subprocess.run([str(SYNC_BINARY_PATH)], capture_output=True, text=True, timeout=30)
                output = (res.stdout or "") + "\n" + (res.stderr or "")
                success = (res.returncode == 0)

            # Ưu tiên 3: Chạy sync_auto_findmy.py
            elif SYNC_AUTO_SCRIPT.exists():
                method_used = "sync_auto_findmy.py"
                print(f"🚀 Đang chạy: python3 {SYNC_AUTO_SCRIPT} ...")
                res = subprocess.run([sys.executable, str(SYNC_AUTO_SCRIPT)], capture_output=True, text=True, timeout=40)
                output = (res.stdout or "") + "\n" + (res.stderr or "")
                success = (res.returncode == 0)
            else:
                raise FileNotFoundError("Không tìm thấy script đồng bộ nào (sync_from_findmy_ui.py / sync_findmy_live / sync_auto_findmy.py)")

            print("📝 Kết quả:\n", output.strip())
            
            self.send_response(200 if success else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._set_cors_headers()
            self.end_headers()
            response = {
                "success": success,
                "method": method_used,
                "message": "Đã chạy đồng bộ từ Mac thành công" if success else "Chạy script đồng bộ nhưng có lỗi",
                "output": output.strip()
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            print("❌ Lỗi kích hoạt đồng bộ Mac:", e)
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._set_cors_headers()
            self.end_headers()
            response = {"success": False, "error": str(e), "output": output}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

def run_server():
    server_address = ("", PORT)
    HTTPServer.allow_reuse_address = True
    httpd = HTTPServer(server_address, MacSyncBridgeHandler)
    print(f"================================================================")
    print(f"🚀 Mac FindMy Sync Bridge đang chạy tại http://localhost:{PORT}")
    print(f"📌 Khi bấm nút 'Cập nhật vị trí' trên Web, máy Mac sẽ tự động chạy đồng bộ Find My!")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Đã dừng Mac Sync Bridge.")

if __name__ == "__main__":
    run_server()

