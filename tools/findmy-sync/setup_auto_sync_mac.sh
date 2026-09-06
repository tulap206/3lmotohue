#!/bin/bash
# Thiết lập Mac Bridge cho 3LMoto (CHỈ đồng bộ khi người dùng bấm nút "Cập nhật vị trí" trên Web)
# KHÔNG tự động mở Find My định kỳ, không làm gián đoạn công việc trên Mac.

PLIST_PATH="$HOME/Library/LaunchAgents/com.3lmotohue.local-bridge.plist"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$DIR/local_mac_bridge.py"
PYTHON_PATH=$(which python3)

echo "⚙️ Đang thiết lập dịch vụ Mac Find My Bridge cho 3LMoto..."

# Xóa các dịch vụ tự động định kỳ cũ nếu có
launchctl unload "$HOME/Library/LaunchAgents/com.3lmotohue.findmysync.plist" 2>/dev/null
launchctl unload "$HOME/Library/LaunchAgents/com.3lmotohue.findmy-sync.plist" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.3lmotohue.findmysync.plist"
rm -f "$HOME/Library/LaunchAgents/com.3lmotohue.findmy-sync.plist"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/findmy-sync-service"

cat <<PLIST_EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.3lmotohue.local-bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_PATH</string>
        <string>$SCRIPT_PATH</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/findmy-sync-service/bridge.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/findmy-sync-service/bridge_error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>$HOME</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
PLIST_EOF

chmod +x "$SCRIPT_PATH"
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "✅ ĐÃ THIẾT LẬP THÀNH CÔNG!"
echo "📌 Mac Bridge đang chạy nền ở cổng 3333."
echo "💡 Hệ thống sẽ KHÔNG tự động mở Tìm (Find My). Chỉ khi bạn bấm nút 'Cập nhật vị trí' ở Quản lý xe, Mac mới mở Tìm để cập nhật!"
