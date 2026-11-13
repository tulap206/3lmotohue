# Sự cố production: Telegram im + quỹ Báo cáo lệch

## Phân tích chức năng

1. **Telegram:** Mọi thao tác admin gọi `logger.log` → browser `POST /api/telegram` → Bot API.
2. **Quỹ:** Card “Tiền quỹ còn lại” = DT thuê hoàn tất + thu − chi (`calcCashOnHand`).

## Nguyên nhân gốc

### Telegram 401 (đã xác nhận runtime logs Vercel)

- Client gửi `x-internal-secret` từ `NEXT_PUBLIC_INTERNAL_API_SECRET`.
- Server so với `INTERNAL_API_SECRET` (hoặc thiếu biến public trên Vercel).
- **Sửa:** authorize bằng cookie JWT `3l_moto_session`; server login/lockout gọi `sendTelegramNotification` trực tiếp.

### Quỹ âm trên Báo cáo

- Doanh thu lấy **theo kỳ lọc**, thu/chi lấy **all-time** → quỹ = kỳ ngắn − chi lịch sử.
- **Sửa:** `allTimeRentalRevenue` + `calcCashOnHand` (single source).

### Deploy Error `rentalOnly`

- Xóa biến nhưng còn tham chiếu CSV/UI → typecheck fail.
- **Sửa:** thay bằng `allTimeRentalRevenue`.

## Trường hợp biên

| Case | Hành vi mong muốn |
|------|-------------------|
| Thiếu `TELEGRAM_*` env | Skip + 400, không crash UI |
| Session hết hạn khi log | 401 Telegram; access_logs vẫn có thể ghi |
| Logger gọi từ server (login) | Gửi thẳng Bot, không qua cookie |
| Booking landing gửi HTML thô | Phải dùng `*bold*` — HTML bị escape |  
| Message > 4096 ký tự | Cắt bớt trước send |
| Body thiếu `event` | 400 validation |
| Rate limit burst | Middleware 60 req/phút `/api/telegram` |
| Lọc Báo cáo ≠ “Tất cả” | P&L theo kỳ; quỹ vẫn all-time |

## Bản sửa production

- `app/api/telegram/route.ts` — JWT + validate + truncate path via notify
- `lib/telegram-notify.ts` — truncate
- `app/api/booking-notify/route.ts` — `*bold*` không HTML thô
- `lib/finance/cash-on-hand.ts` — quỹ thống nhất
