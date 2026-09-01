# Rules for Antigravity Agent

## Auto Push on Task Completion
- **Rule**: Luôn tự động commit và push các thay đổi lên kho lưu trữ git (remote repository) sau khi hoàn thành xong yêu cầu/task của người dùng.
- **Workflow**:
  1. Tự động tăng phiên bản: `node scripts/bump-version.js`
  2. Kiểm tra trạng thái git: `git status`
  3. Thêm thay đổi: `git add .`
  4. Commit với thông điệp rõ ràng: `git commit -m "feat/fix: <mô tả ngắn gọn bằng tiếng Việt hoặc tiếng Anh>"`
  5. Push lên nhánh hiện tại: `git push`
