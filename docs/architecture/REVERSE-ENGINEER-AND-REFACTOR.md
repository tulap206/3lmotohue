# Reverse-engineer & chiến lược refactor

## Phân tích kiến trúc (as-is)

Luồng end-to-end:

1. **Landing** ghi đơn/visitor → API public → Telegram + `access_logs` + Realtime broadcast.
2. **Admin** vào `/dashboard` qua JWT cookie; hầu hết CRUD **trực tiếp Supabase anon** từ browser.
3. **Tài chính** tính trên client từ `rentals.revenue` + `transactions` (`transaction-finance` + `finance/cash-on-hand`).
4. **Audit** `logger` → DB + Telegram (cookie auth).

Chi tiết route/module: xem `SYSTEM-MVP.md` và codebase map.

## Vùng vấn đề nghiêm trọng

| Mức | Vấn đề | Ảnh hưởng |
|-----|--------|-----------|
| P0 | Data plane client + anon key phụ thuộc RLS | Rủi ro đọc/ghi nếu policy lỏng |
| P0 | JWT fallback / `NEXT_PUBLIC_INTERNAL_API_SECRET` | Lộ secret / auth lệch (đã gặp Telegram 401) |
| P1 | God pages 2–3.7k LOC | Khó bảo trì, dễ lệch số liệu (đã gặp quỹ Báo cáo) |
| P1 | 3 logger song song (`logger`, `activity-logger`, `addAccessLog`) | Audit thiếu Telegram / cột sai |
| P1 | `parseVietnamDate` copy ≥6 chỗ | Lệch ngày KPI |
| P2 | `RentalDataProvider` không bọc Tổng quan/Báo cáo | Fetch + Realtime trùng |
| P2 | `lib/types.ts` legacy 79moto | Permission/naming lệch |
| P3 | Docs `SUPABASE_SETUP.md` lỗi thời | Onboard sai |

## Chiến lược refactor (giữ chức năng)

**Wave A — đúng số & đúng audit (đang làm)**  
- Single source quỹ/P&L (`lib/finance/*`).  
- Gộp logging về `logger`.  
- `parseVietnamDate` → `lib/format-date`.

**Wave B — thu gọn surface**  
- Bọc dashboard/reports bằng `RentalDataProvider` hoặc shared hooks.  
- Tách hooks `useFleetKpis`, `useReportPeriod` khỏi page.

**Wave C — server boundary**  
- Mutation rental/transaction qua API/RPC.  
- Audit RLS; bỏ secret public.

**Wave D — UI modules**  
- Cắt `orders/page.tsx` theo dialog/list/stats; không đổi UX.

Mỗi wave: 1 PR nhỏ, push production, health-check.

## Code cải thiện trong wave A (repo)

- `lib/finance/cash-on-hand.ts` (ảnh 1)
- `activity-logger` ủy quyền `logger` (ảnh 2)
- `parseVietnamDate` export từ `format-date`; dùng ở context + commission
