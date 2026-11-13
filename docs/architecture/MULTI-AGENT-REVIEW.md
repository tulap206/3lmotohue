# 4 agents: Architect → Engineer → Reviewer → Optimizer

## Architect
- Mục tiêu: rental admin + landing, scale theo cửa hàng (không phải viral consumer).
- Lớp: UI → domain finance → Supabase → Telegram/Vercel.
- Tài liệu: `SYSTEM-MVP.md`, `INFRASTRUCTURE.md`.

## Engineer — kế hoạch đã triển khai
1. Unified quỹ + KPI domain.  
2. Telegram JWT auth + edge cases.  
3. Debounce Realtime.  
4. Region `sin1`, API `no-store`.  
5. `getAuthSecret()` tập trung.

## Reviewer — điểm yếu còn lại
| # | Phát hiện | Mức | Trạng thái |
|---|-----------|-----|------------|
| R1 | JWT fallback cứng | High | Cảnh báo prod + single source |
| R2 | `/api/booking-notify` public | Med | Thêm rate limit |
| R3 | Client CRUD anon | High | Backlog Wave C |
| R4 | God pages | Med | Backlog Wave D |
| R5 | `NEXT_PUBLIC_INTERNAL_API_SECRET` | Med | Ưu tiên secret server |

## Optimizer — bản production hiện tại
- Debounce 400ms Realtime.  
- `calcReportFinanceKpis` / `calcCashOnHand`.  
- Telegram truncate + validate.  
- sin1 + Cache-Control API.
