import json
import glob
import sys
from pathlib import Path

search_dirs = [
    Path.home() / "findmy_temp_keys",
    Path.cwd() / "findmy_temp_keys",
    Path.cwd() / "accessories",
    Path.cwd(),
]

json_files = []
for d in search_dirs:
    found = sorted(glob.glob(str(d / "*.json")))
    valid = [f for f in found if not Path(f).name.startswith("package") and not Path(f).name.startswith("tsconfig") and not Path(f).name.startswith("components") and not Path(f).name.startswith("next")]
    if valid:
        json_files = valid
        break

if not json_files:
    print("❌ Chưa tìm thấy tệp JSON chìa khóa thẻ nào.")
    sys.exit(1)

print(f"✅ Đã tìm thấy {len(json_files)} tệp chìa khóa UGreen:")
for f in json_files:
    print(f" - {Path(f).name}")

script_lines = []
script_lines.append("#!/bin/bash")
script_lines.append("# Script tự động tạo tệp chìa khóa UGreen trên máy Linux (Ubuntu)")
script_lines.append("mkdir -p ~/findmy-sync-service/accessories")
script_lines.append("echo 'Đang khởi tạo các tệp chìa khóa UGreen trên máy Linux...'")

for filepath in json_files:
    filename = Path(filepath).name
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().strip()
    
    script_lines.append(f"\ncat <<'EOF' > ~/findmy-sync-service/accessories/{filename}")
    script_lines.append(content)
    script_lines.append("EOF")
    script_lines.append(f"echo ' -> Đã tạo {filename}'")

script_lines.append('\necho "🎉 TẤT CẢ TỆP CẤU HÌNH ĐÃ ĐƯỢC TẠO THÀNH CÔNG TRONG ~/findmy-sync-service/accessories/"')

final_script = "\n".join(script_lines)

output_path = Path("/Users/tulap/Desktop/Code/3lmotohue/setup_ubuntu_keys.sh")
with open(output_path, "w", encoding="utf-8") as f:
    f.write(final_script)

print(f"\n✅ Đã xuất đoạn mã Bash script vào tệp: {output_path}\n")
print(final_script)
