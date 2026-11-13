# Domain layer (migrate dần)

Thư mục đích cho clean architecture. Chưa chuyển hết logic từ god-pages.

| Module dự kiến | Nguồn hiện tại |
|----------------|----------------|
| `rental/` | `orders/page.tsx`, `rental-data-context.tsx` |
| `vehicle/` | `vehicles/page.tsx`, `lib/supabase.ts` |
| `customer/` | `customers/page.tsx` |
| `finance/` | đã có `lib/finance/`, `lib/transaction-finance.ts` |

Quy tắc: mỗi PR chỉ chuyển **một** use-case; giữ hành vi cũ; có health-check / smoke.
