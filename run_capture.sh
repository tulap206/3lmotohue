#!/bin/bash
# Script tự động capture hashed_adv_keys từ searchpartyuseragent
# Chạy trong Terminal: bash ~/Desktop/Code/3lmotohue/run_capture.sh

set -e

MITM_PORT=8888
OUTPUT="$HOME/findmy-sync-service/captured_adv_keys.json"
ADDON="/tmp/findmy_addon.py"

echo "=============================="
echo "🕵️  FindMy Key Capture Setup"
echo "=============================="

# Bước 1: Tạo cert nếu chưa có
if [ ! -f ~/.mitmproxy/mitmproxy-ca-cert.pem ]; then
    echo "⏳ Tạo mitmproxy certificate..."
    timeout 5 mitmdump -p $MITM_PORT --quiet 2>/dev/null || true
fi

# Bước 2: Trust cert vào System keychain
echo "🔐 Cài certificate (cần nhập mật khẩu Mac)..."
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    ~/.mitmproxy/mitmproxy-ca-cert.pem
echo "✅ Certificate đã được trust!"

# Bước 3: Lấy network service đang dùng
NETWORK_SERVICE=$(networksetup -listallnetworkservices | grep -v "*" | head -2 | tail -1)
echo "🌐 Network service: $NETWORK_SERVICE"

# Bước 4: Bật proxy
networksetup -setwebproxy "$NETWORK_SERVICE" 127.0.0.1 $MITM_PORT
networksetup -setsecurewebproxy "$NETWORK_SERVICE" 127.0.0.1 $MITM_PORT
networksetup -setwebproxystate "$NETWORK_SERVICE" on
networksetup -setsecurewebproxystate "$NETWORK_SERVICE" on
echo "✅ Proxy đã bật trên port $MITM_PORT"

# Bước 5: Viết addon script
cat > $ADDON << 'ADDON_EOF'
import json, re
from pathlib import Path
from mitmproxy import http

OUTPUT_FILE = Path.home() / "findmy-sync-service" / "captured_adv_keys.json"
captured = {}

class FindMyCapture:
    def request(self, flow: http.HTTPFlow):
        host = flow.request.pretty_host
        if "fmip" in host or "searchparty" in host or "icloud.com" in host:
            try:
                body = flow.request.json()
                if "fetch" in body:
                    found = []
                    for item in body["fetch"]:
                        for k in ["primaryIds", "secondaryIds"]:
                            for hk in item.get(k, []):
                                captured[hk] = True
                                found.append(hk[:16] + "...")
                    if found:
                        print(f"\n🎯 {host}: {len(found)} hashed_adv_keys found!")
                        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
                        with open(OUTPUT_FILE, "w") as f:
                            json.dump(list(captured.keys()), f, indent=2)
                        print(f"✅ Saved {len(captured)} total keys")
            except Exception:
                pass
                
addons = [FindMyCapture()]
ADDON_EOF

echo ""
echo "▶️  Chạy mitmproxy... (đợi 60 giây để capture)"
echo "   Đang buộc searchpartyuseragent refresh..."
echo ""

# Buộc refresh
pkill -HUP searchpartyuseragent 2>/dev/null || true

# Chạy mitmdump 60 giây
timeout 60 mitmdump -s $ADDON -p $MITM_PORT 2>&1 || true

# Bước 6: Gỡ proxy
networksetup -setwebproxystate "$NETWORK_SERVICE" off
networksetup -setsecurewebproxystate "$NETWORK_SERVICE" off
echo ""
echo "🌐 Đã gỡ proxy."

# Kết quả
if [ -f "$OUTPUT" ]; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('$OUTPUT'))))")
    echo "✅ Đã capture $COUNT hashed_adv_keys!"
    echo "📍 File: $OUTPUT"
    echo ""
    echo "🚀 Bước tiếp theo - chạy sync:"
    echo "   python3 ~/Desktop/Code/3lmotohue/sync_auto_findmy.py"
else
    echo "⚠️ Chưa capture được key nào."
    echo "   Thử mở ứng dụng FindMy và đợi nó refresh."
fi
