# 3L Moto - Công Cụ Đồng Bộ Vị Trí Xe (FindMy / AirTag GPS Sync)

Thư mục này chứa toàn bộ các script trích xuất toạ độ và đồng bộ vị trí xe từ macOS / Ubuntu lên hệ thống quản lý 3L Moto (`/api/vehicles/location-sync`).

## 📁 Danh Sách Script

### 1. Đồng bộ vị trí (Sync Location)
- `sync_auto_findmy.py`: Script tự động đọc toạ độ FindMy từ cache macOS và gửi toạ độ lên API server.
- `sync_mac_findmy.py`: Script đồng bộ vị trí trực tiếp trên máy Mac.
- `sync_from_findmy_ui.py`: Đồng bộ vị trí từ giao diện Apple FindMy.
- `sync_findmy_live.swift`: Swift utility đọc toạ độ trực tiếp từ macOS system APIs.
- `sync_location_ubuntu_template.py`: Template đồng bộ vị trí chạy trên máy chủ Ubuntu.
- `update_tag_locations.py`: Cập nhật vị trí thủ công cho từng AirTag/xe.

### 2. Trích xuất & Giải mã khóa (Keys & Decryption)
- `capture_findmy_keys.py`: Bắt gói tin và trích xuất khóa định vị FindMy.
- `decrypt_mac_keys.py` / `decrypt_mac_keys_v2.py`: Giải mã khóa mã hóa FindMy trên macOS.
- `extract_real_keys.py`: Trích xuất cặp khóa thật để dùng cho server độc lập.
- `fetch_mac_keys_icloud.py`: Lấy khóa định vị từ tài khoản iCloud.
- `export_and_generate_ubuntu_script.py`: Xuất cấu hình và tạo script chạy trên Ubuntu.

### 3. Cài đặt tự động chạy (Setup & Automation)
- `setup_auto_sync_mac.sh`: Cài đặt daemon tự động chạy ngầm trên macOS (`launchd`).
- `stop_auto_sync_mac.sh`: Dừng service đồng bộ ngầm trên macOS.
- `setup_ubuntu_keys.sh`: Cài đặt môi trường và khóa trên máy chủ Ubuntu.
- `run_capture.sh`: Chạy nhanh quá trình thu thập toạ độ.
- `local_mac_bridge.py`: Cầu nối API cục bộ trên macOS.
