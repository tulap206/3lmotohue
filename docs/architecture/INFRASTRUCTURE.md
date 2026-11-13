# Hạ tầng & triển khai scale

## Kiến trúc thành phần

```
Người dùng (VN) → CDN Vercel (sin1)
                 → Next.js Functions / Edge middleware
                 → Supabase Postgres + Storage + Realtime (AP)
                 → Telegram Bot API
Cron Vercel 10:00 UTC → GET /api/backup (CRON_SECRET)
Find My agent → POST /api/vehicles/location-sync
```

## Luồng dữ liệu & API

- **Đọc/ghi nghiệp vụ:** client → Supabase anon (+ RLS).
- **Auth:** `/api/auth/*` → JWT cookie.
- **Notify:** `/api/telegram`, `/api/booking-notify`.
- **Backup:** cron → Storage bucket `backups`.

## Schema (tóm tắt)

`auth_users`, `login_attempts`, `customers`, `vehicles`, `rentals`, `transactions`, `access_logs` — chi tiết `SYSTEM-MVP.md`.

## Caching strategy

| Lớp | Chiến lược |
|-----|------------|
| Static `/_next/static` | CDN immutable (Vercel mặc định) |
| HTML dashboard | `no-store` / dynamic (client) |
| `/api/*` | `Cache-Control: no-store` (đã cấu hình) |
| Supabase Realtime | Live; refetch debounce 400ms |
| Báo cáo | Tính client; sau này RPC + short TTL |

Không cache số tiền trên CDN.

## Deploy production-ready

1. Push `main` → Vercel Production.  
2. Env bắt buộc: `NEXT_PUBLIC_SUPABASE_*`, `INTERNAL_API_SECRET`, `TELEGRAM_*`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (backup).  
3. Region function: `sin1` (gần VN).  
4. Sau deploy: smoke login + 1 thao tác → Telegram; so quỹ Tổng quan/Báo cáo.  
5. `npm run cleanup-deployments` định kỳ giữ storage.

## Mở rộng sau

- Read replica / materialized view báo cáo.
- Queue notify (Inngest/QStash) nếu Telegram rate limit.
- Service role chỉ trên server mutations.
