# Tech Lead — quyết định dài hạn (5+ năm)

## Làm rõ yêu cầu (không đoán)

Sản phẩm thật: **1–n cửa hàng thuê xe**, admin nội bộ + landing đặt xe.  
“Scale triệu user” ở prompt ảnh 1 **không khớp** traffic thực tế → tối ưu cho **đúng số liệu tiền, an toàn RLS, bảo trì god-pages**, không rewrite greenfield.

Câu hỏi còn mở (không chặn ship hiện tại):  
**Ưu tiên Wave C (mutation server/RPC) trong 30 ngày tới, hay giữ client CRUD + siết RLS trước?**

## Quyết định kỹ thuật chính

| Quyết định | Lý do |
|------------|--------|
| Giữ Next.js + Supabase + Vercel | Đang chạy production; đổi stack rủi ro cao |
| Domain finance trước UI rewrite | Bug quỹ/Telegram đã chứng minh đúng chỗ đau |
| JWT cookie custom, chưa Supabase Auth | User nội bộ `auth_users`; migrate Auth = breaking |
| Quỹ ≠ P&L vận hành | Nghiệp vụ: vốn/mua xe vào quỹ, không vào LN |
| Region `sin1` | Gần VN; latency admin |
| Debounce Realtime, không tắt live | UX cửa hàng cần đồng bộ đa tab |

## Trade-offs

| Chọn | Đánh đổi |
|------|----------|
| Client Supabase nhanh ship | Phụ thuộc RLS; khó audit server |
| God pages | Ít file lúc đầu; nợ bảo trì |
| Regex phân loại vốn | Linh hoạt mô tả; dễ sai nếu ghi chú lệch |
| Telegram sync HTTP | Đơn giản; không retry queue bền |
| Fallback JWT secret | Dev tiện; **cấm dựa vào prod** (đã warn) |

## Kiến trúc đề xuất (ổn định)

Giữ as-is + lớp `lib/domain/*` + `lib/finance/*` + API auth/notify.  
Đọc: `SYSTEM-MVP.md` → `CLEAN-ARCHITECTURE.md` → `INFRASTRUCTURE.md`.

## Kế hoạch triển khai (đã / sắp)

1. ✅ Đúng quỹ & Telegram & typecheck deploy  
2. ✅ Debounce, sin1, auth secret, UI async boundary  
3. ⬜ Audit RLS Supabase (ảnh 10)  
4. ⬜ Tách `orders/page` theo feature folder (không đổi UX)  
5. ⬜ RPC ghi `transactions`/`rentals` khi chốt đơn  

## Production-ready hiện tại

Nhánh `main` đã chứa các fix trên; vận hành tiếp tục trên Vercel.  
Không greenfield rewrite — Tech Lead bác bỏ đập xây lại khi đang có doanh thu thật.
