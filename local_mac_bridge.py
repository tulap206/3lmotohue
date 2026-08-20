import os
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3333
SYNC_BINARY_PATH = os.path.expanduser("~/findmy-sync-service/sync_findmy_live")

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
        self.send_header("Content-Type", "application/json")
        self._set_cors_headers()
        self.end_headers()
        response = {"status": "online", "message": "Mac FindMy Sync Bridge is running"}
        self.wfile.write(json.dumps(response).encode("utf-8"))

    def do_POST(self):
        print("⚡ Nhận yêu cầu kích hoạt đồng bộ từ Web Button...")
        try:
            # Run native sync_findmy_live binary
            result = subprocess.run([SYNC_BINARY_PATH], capture_output=True, text=True, timeout=25)
            output = result.stdout + "\n" + result.stderr
            print(" Output:", output)
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            response = {"success": True, "message": "Đã chạy đồng bộ từ Mac thành công", "output": output}
            self.wfile.write(json.dumps(response).encode("utf-8"))
        except Exception as e:
            print("❌ Lỗi kích hoạt đồng bộ Mac:", e)
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            response = {"success": False, "error": str(e)}
            self.wfile.write(json.dumps(response).encode("utf-8"))

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, MacSyncBridgeHandler)
    print(f"🚀 Mac FindMy Sync Bridge đang chạy tại http://localhost:{PORT}")
    print("📌 Khi bấm nút 'Cập nhật vị trí' trên Web, máy Mac sẽ tự động chạy đồng bộ Find My!")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Đã dừng Mac Sync Bridge.")

if __name__ == "__main__":
    run_server()
