#!/bin/bash
# Hủy toàn bộ dịch vụ tự động đồng bộ vị trí và bridge trên macOS

echo "🛑 Đang gỡ bỏ các tiến trình đồng bộ vị trí và bridge trên Mac..."

launchctl unload "$HOME/Library/LaunchAgents/com.3lmotohue.findmysync.plist" 2>/dev/null
launchctl unload "$HOME/Library/LaunchAgents/com.3lmotohue.findmy-sync.plist" 2>/dev/null
launchctl unload "$HOME/Library/LaunchAgents/com.3lmotohue.local-bridge.plist" 2>/dev/null

rm -f "$HOME/Library/LaunchAgents/com.3lmotohue.findmysync.plist"
rm -f "$HOME/Library/LaunchAgents/com.3lmotohue.findmy-sync.plist"
rm -f "$HOME/Library/LaunchAgents/com.3lmotohue.local-bridge.plist"

pkill -f "local_mac_bridge.py" 2>/dev/null
pkill -f "sync_findmy_live" 2>/dev/null
pkill -f "sync_from_findmy_ui.py" 2>/dev/null

echo "✅ Đã tắt và dỡ bỏ toàn bộ dịch vụ tự động đồng bộ trên Mac!"
