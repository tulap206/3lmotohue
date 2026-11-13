# Security audit — 3L Moto production

## Báo cáo lỗ hổng (mức nghiêm trọng)

| ID | Mức | Phát hiện | Kịch bản tấn công | Trạng thái |
|----|-----|-----------|---------------------|------------|
| S1 | **Critical** | Hardcode anon key trong `sync-trigger` / `health-check` | Clone repo → gọi API bằng key lộ (phụ thuộc RLS) | **Đã gỡ hardcode → env** |
| S2 | **High** | `LOCATION_SYNC_SECRET` default công khai trong repo | Giả mạo sync vị trí xe nếu API còn default | **API bắt buộc env; từ chối nếu thiếu** |
| S3 | **High** | CRUD client + anon key | Nếu RLS thiếu: đọc/sửa đơn/xe | Backlog: audit RLS Dashboard Supabase |
| S4 | **High** | JWT fallback `fallback-secret-key-3lmoto` | Forge cookie nếu prod thiếu secret | Warn + `getAuthSecret()` |
| S5 | **Medium** | `/api/booking-notify` public | Spam Telegram / log | Rate limit 10/phút |
| S6 | **Medium** | `NEXT_PUBLIC_INTERNAL_API_SECRET` | Lộ secret build client | Ưu tiên `INTERNAL_API_SECRET` |
| S7 | **Low** | Tools Find My còn secret cũ trong script | Attacker biết secret cũ nếu chưa rotate | Cập nhật agent + rotate Vercel |
| S8 | Info | MCP advisors | Không gọi được (permission) | Kiểm tra tay trên Supabase Advisors |

## Bản sửa đã ship

1. `scripts/health-check.ts` — chỉ env.  
2. `location-sync` / `sync-trigger` — không default secret; 503 nếu thiếu.  
3. Gỡ anon JWT hardcode khỏi `sync-trigger`.  
4. Rate limit booking-notify; Telegram JWT; truncate message.

## Việc bạn cần làm trên Vercel (1 phút)

1. Đặt `LOCATION_SYNC_SECRET` = chuỗi mạnh mới.  
2. Cập nhật script Find My (`tools/findmy-sync/*`) cùng giá trị.  
3. Xác nhận `INTERNAL_API_SECRET` đã set (không trống).  
4. Mở Supabase → Advisors → Security: bật RLS mọi bảng public.

## Khuyến nghị production

- Không commit `.env`; rotate anon không bắt buộc nếu RLS đúng (anon vốn public) nhưng **đừng hardcode**.  
- Service role chỉ trên server (backup/sync).  
- Wave C: mutation rental/transaction qua RPC có auth.
