#!/bin/bash
# Thiết lập chạy ngầm tự động đồng bộ Find My mỗi 5 phút trên macOS

PLIST_PATH="$HOME/Library/LaunchAgents/com.3lmotohue.findmysync.plist"
SCRIPT_PATH="$HOME/Desktop/Code/3lmotohue/sync_from_findmy_ui.py"
PYTHON_PATH=$(which python3)

echo "⚙️ Đang thiết lập dịch vụ tự động đồng bộ Find My cho 3LMoto..."

mkdir -p "$HOME/Library/LaunchAgents"

cat <<PLIST_EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.3lmotohue.findmysync</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_PATH</string>
        <string>$SCRIPT_PATH</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/3lmotohue_sync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/3lmotohue_sync_err.log</string>
</dict>
</plist>
PLIST_EOF

chmod +x "$SCRIPT_PATH"
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "✅ ĐÃ THIẾT LẬP THÀNH CÔNG!"
echo "📌 Kể từ bây giờ, máy Mac sẽ tự động cào vị trí từ Find My và cập nhật lên 3lmotohue.com mỗi 5 phút một lần."
