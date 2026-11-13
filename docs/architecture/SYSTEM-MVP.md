# 3L Moto — Kiến trúc MVP sẵn sàng scale

> Sản phẩm: quản lý cho thuê xe + landing đặt xe (`3lmotohue.com`).  
> Stack hiện tại: Next.js 16 App Router · React 19 · Supabase Postgres · Vercel.  
> Nguyên tắc: **không đập production** — kiến trúc mục tiêu chồng lên hệ đang chạy, migrate từng lớp.

---

## 1. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│  Clients                                                     │
│  Landing (SSR/SEO) · Dashboard Admin · Find My sync agent   │
└───────────────┬───────────────────────────┬─────────────────┘
                │ HTTPS                     │ secret header
┌───────────────▼───────────────┐   ┌───────▼────────────────┐
│  Next.js (Vercel Edge/Node)   │   │  /api/vehicles/* sync  │
│  middleware: JWT + rate limit │   └───────────┬────────────┘
│  API: auth, telegram, backup  │               │
│  (mục tiêu) Domain API layer  │               │
└───────────────┬───────────────┘               │
                │                               │
        ┌───────▼───────────────────────────────▼──────┐
        │  Application services (lib/finance, …)        │
        │  P&L · quỹ · commission · booking notify      │
        └───────────────────┬───────────────────────────┘
                            │
        ┌───────────────────▼───────────────────────────┐
        │  Supabase                                      │
        │  Postgres + RLS · Storage · Realtime · Cron    │
        └────────────────────────────────────────────────┘
                            │
                    Telegram Bot API
```

### Thành phần

| Lớp | Hiện tại | Mục tiêu scale |
|-----|----------|----------------|
| Presentation | God pages client 2–3k LOC | Module shell + feature folders |
| Application | Logic rải trong page | `lib/finance`, `lib/domain/*` |
| Data access | `lib/supabase.ts` anon từ browser | Server Actions / API + RLS chặt |
| Auth | JWT cookie `3l_moto_session` | Giữ; bỏ `NEXT_PUBLIC` secret |
| Money | Client write transactions | RPC/transaction Postgres |
| Notify | `/api/telegram` + booking-notify | Queue (sau này) nếu volume lớn |

### Scale path (triệu user — thực tế cho thuê là **hàng nghìn–chục nghìn đơn**, không phải consumer viral)

1. **Đúng RLS + server-side mutations** (an toàn trước khi scale).
2. Index Postgres trên `rentals(status, endDate)`, `transactions(timestamp)`, `access_logs(timestamp)`.
3. Tách read model báo cáo (materialized view / RPC) khỏi UI god-page.
4. Realtime chỉ channel cần thiết; tránh N subscription trùng.
5. CDN/Vercel cho static; Edge chỉ middleware auth.

---

## 2. Cấu trúc thư mục (mục tiêu)

```
app/
  (public)/          # landing, login
  dashboard/         # feature routes (mỏng)
  api/               # auth, notify, cron, sync
components/
  ui/                # shadcn primitives
  dashboard/         # module-shell, rental-ui, charts
contexts/            # auth, rental-data (dần thu hẹp)
lib/
  finance/           # ★ P&L + quỹ (single source)
  domain/            # rental, vehicle, customer (migrate dần)
  infra/             # supabase clients (anon / service)
  auth-*.ts          # JWT, crypto, guard
docs/architecture/   # tài liệu này
scripts/             # bump, health-check, cleanup
```

Giữ `components/ui` + `module-shell` — không đổi design system đang vận hành.

---

## 3. Database schema (lõi nghiệp vụ)

| Bảng | Vai trò |
|------|---------|
| `auth_users` | User nội bộ + permissions |
| `login_attempts` | Lockout |
| `customers` | Khách thuê + giấy tờ (Storage) |
| `vehicles` | Đội xe + KM + location tag trong notes |
| `rentals` | Đơn thuê; `revenue` đã net HH Home |
| `transactions` | Thu/chi quỹ (vốn nhận diện bằng tag/regex) |
| `access_logs` | Audit + visitor + booking lock |

**Quy tắc tiền:** mọi đóng lãi/chuộc/quỹ (nếu mở rộng cầm đồ) phải qua RPC; hiện tại thuê xe: ghi `rentals` + `transactions` atomic khi có thể.

Storage: `customer-documents`, `backups`.

---

## 4. API endpoints

| Endpoint | Auth | Mục đích |
|----------|------|----------|
| `POST /api/auth/login` | Public + rate limit | JWT cookie |
| `POST /api/auth/logout` | Session | Xóa cookie |
| `GET /api/auth/me` | Cookie | Session |
| `POST /api/auth/change-password` | Session | Đổi MK |
| `GET\|POST /api/auth/users` | Admin | Quản lý user |
| `PATCH\|DELETE /api/auth/users/[id]` | Admin | |
| `POST /api/telegram` | JWT hoặc internal secret | Notify |
| `POST /api/booking-notify` | Public + RL | Đặt xe web → TG |
| `POST /api/visitor-log` | Public + RL | Analytics landing |
| `GET /api/backup` | Cron secret | Backup Storage |
| `GET /api/client-ip` | — | IP cho access_logs |
| `POST /api/vehicles/location-sync` | Sync secret | Find My |

**Mục tiêu thêm (chưa bắt buộc ngay):**  
`POST /api/rentals/*`, `POST /api/transactions` — mutation server-side.

---

## 5. UI/UX architecture

- **Shell:** `ModulePageShell`, `ModuleKpiGrid`, `ModuleSectionCard`, sidebar theo quyền.
- **Tokens:** Be Vietnam Pro, slate + cobalt accent (`globals.css` / rental-ui).
- **Patterns:** desktop table + mobile cards; KPI label → value → sublabel.
- **Realtime UX:** `NewOrderRealtimeNotifier` cho đơn landing.
- **Báo cáo:** lọc kỳ cho P&L; **quỹ luôn all-time** (`calcCashOnHand`).

Design Read: *operational rental admin, Linear/Notion-clean, density medium, cobalt accent — không marketing landing.*

---

## 6. Code production (nền tảng tài chính)

Single source quỹ:

- `lib/finance/cash-on-hand.ts` → `sumCompletedRentalRevenue`, `calcCashOnHand`
- Dashboard + Báo cáo + A4/export dùng chung — tránh lệch số như kỳ lọc × all-time tx.

P&L vận hành vẫn từ `lib/transaction-finance.ts` (`calcOperatingRevenue` / `calcOperatingProfit`).

---

## 7. Roadmap ngắn (sau ảnh kiến trúc này)

1. Reverse-engineer + debt map (ảnh 2)  
2. Đóng edge-case Telegram/auth (ảnh 3)  
3. Performance god-pages (ảnh 4)  
4. Tách clean architecture dần (ảnh 5–6)  
5. Security: RLS audit, bỏ secret public (ảnh 10)
