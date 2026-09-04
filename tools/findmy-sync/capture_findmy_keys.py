#!/usr/bin/env python3
"""
Script chặn network request từ searchpartyuseragent đến Apple server
để lấy hashed_adv_key thật của 18 thẻ UGreen.

Cách dùng:
1. Chạy script này trước: python3 capture_findmy_keys.py
2. Nó sẽ tự cấu hình proxy + trust cert
3. Buộc searchpartyuseragent gửi request bằng cách restart FindMy
4. Script tự tắt khi đã capture được keys
"""
import subprocess, sys, os, json, threading, time, signal
from pathlib import Path

MITM_PORT    = 8888
OUTPUT_FILE  = Path.home() / "findmy-sync-service" / "captured_adv_keys.json"
SCRIPT_FILE  = Path("/tmp/findmy_capture_addon.py")

# mitmproxy addon script để lọc request đến Apple
ADDON_SCRIPT = '''
import json, base64, re
from pathlib import Path
from mitmproxy import http

OUTPUT_FILE = Path.home() / "findmy-sync-service" / "captured_adv_keys.json"
captured = {}

class FindMyCapture:
    def request(self, flow: http.HTTPFlow):
        if "fmip" in flow.request.pretty_host or "searchparty" in flow.request.pretty_host:
            print(f"\\n🎯 FindMy request to: {flow.request.pretty_host}{flow.request.path}")
            try:
                body = flow.request.json()
                if "fetch" in body:
                    for fetch_item in body["fetch"]:
                        for key_type in ["primaryIds", "secondaryIds"]:
                            for hashed_key in fetch_item.get(key_type, []):
                                print(f"  Found hashed_adv_key: {hashed_key[:20]}...")
                                captured[hashed_key] = True
                    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
                    with open(OUTPUT_FILE, "w") as f:
                        json.dump(list(captured.keys()), f, indent=2)
                    print(f"✅ Saved {len(captured)} keys to {OUTPUT_FILE}")
            except Exception as e:
                pass
    
    def response(self, flow: http.HTTPFlow):
        if "fmip" in flow.request.pretty_host or "searchparty" in flow.request.pretty_host:
            print(f"  Response: {flow.response.status_code} ({len(flow.response.content)} bytes)")

addons = [FindMyCapture()]
'''

def setup_proxy():
    """Cấu hình system proxy."""
    # Lấy active network interface
    result = subprocess.run(['networksetup', '-listallnetworkservices'], 
                          capture_output=True, text=True)
    services = [l.strip() for l in result.stdout.split('\n') 
                if l.strip() and not l.startswith('*') and l.strip() != 'An asterisk (*)']
    
    active = None
    for svc in services:
        r = subprocess.run(['networksetup', '-getinfo', svc], capture_output=True, text=True)
        if 'IP address:' in r.stdout and '0.0.0.0' not in r.stdout:
            active = svc
            break
    
    if not active:
        active = 'Wi-Fi'  # default
    
    print(f"🌐 Cấu hình proxy cho: {active}")
    subprocess.run(['networksetup', '-setwebproxy', active, '127.0.0.1', str(MITM_PORT)])
    subprocess.run(['networksetup', '-setsecurewebproxy', active, '127.0.0.1', str(MITM_PORT)])
    subprocess.run(['networksetup', '-setwebproxystate', active, 'on'])
    subprocess.run(['networksetup', '-setsecurewebproxystate', active, 'on'])
    return active

def teardown_proxy(service):
    """Gỡ proxy sau khi xong."""
    subprocess.run(['networksetup', '-setwebproxystate', service, 'off'])
    subprocess.run(['networksetup', '-setsecurewebproxystate', service, 'off'])
    print("🌐 Đã gỡ proxy.")

def install_cert():
    """Cài cert của mitmproxy vào System keychain."""
    cert_path = Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.pem"
    if not cert_path.exists():
        print("⏳ Chạy mitmdump một lần để tạo cert...")
        subprocess.run(['mitmdump', '--quiet', '-p', str(MITM_PORT)], 
                      timeout=3, capture_output=True)
    
    if cert_path.exists():
        print("🔐 Cài certificate mitmproxy vào System Keychain...")
        subprocess.run([
            'security', 'add-trusted-cert', '-d', '-r', 'trustRoot',
            '-k', '/Library/Keychains/System.keychain', str(cert_path)
        ])
        print("✅ Cert đã được trust.")
    else:
        print("⚠️ Không tìm thấy cert file. Chạy 'mitmdump' một lần trước.")

def main():
    print("=" * 60)
    print("🕵️  CAPTURE FINDMY NETWORK KEYS")
    print("=" * 60)
    
    # Kiểm tra mitmdump
    if not subprocess.run(['which', 'mitmdump'], capture_output=True).returncode == 0:
        print("❌ mitmdump chưa được cài. Chạy: brew install mitmproxy")
        sys.exit(1)
    
    # Viết addon script
    SCRIPT_FILE.write_text(ADDON_SCRIPT)
    
    # Cài cert
    install_cert()
    
    # Setup proxy
    active_service = setup_proxy()
    
    print(f"\n▶️  Đang chạy mitmproxy trên port {MITM_PORT}...")
    print("   Đang chờ request từ searchpartyuseragent...")
    print("   (Sẽ tự tắt sau 60 giây)\n")
    
    # Khởi động mitmdump
    proc = subprocess.Popen(
        ['mitmdump', '-s', str(SCRIPT_FILE), '-p', str(MITM_PORT), '--ssl-insecure'],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True
    )
    
    # Buộc searchpartyuseragent refresh bằng cách kill -HUP nó
    time.sleep(2)
    r = subprocess.run(['pgrep', 'searchpartyuseragent'], capture_output=True, text=True)
    if r.stdout.strip():
        pid = r.stdout.strip().split('\n')[0]
        print(f"🔄 Buộc searchpartyuseragent (PID {pid}) refresh...")
        subprocess.run(['kill', '-HUP', pid])
    
    # Đọc output trong 60 giây
    def read_output():
        for line in proc.stdout:
            print(line, end='')
            if OUTPUT_FILE.exists():
                with open(OUTPUT_FILE) as f:
                    keys = json.load(f)
                if len(keys) > 5:
                    proc.terminate()
                    break
    
    t = threading.Thread(target=read_output, daemon=True)
    t.start()
    t.join(timeout=60)
    proc.terminate()
    
    # Gỡ proxy
    teardown_proxy(active_service)
    
    # Hiển thị kết quả
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            keys = json.load(f)
        print(f"\n✅ Đã capture {len(keys)} hashed_adv_keys!")
        print("📌 Bước tiếp theo: chạy sync_auto_findmy.py - nó sẽ dùng keys này.")
    else:
        print("\n⚠️ Chưa capture được key nào. Thử mở FindMy app và đợi refresh.")

if __name__ == "__main__":
    main()
