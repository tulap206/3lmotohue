---
name: cam-do-interest-cycle
description: >-
  Logic chu kỳ đóng lãi, trạng thái đến hạn/quá hạn, và an toàn dữ liệu đa thương hiệu
  cho các app cầm đồ/tài chính (3lmotohue, 79moto, lap68, laviecar, quangvinh, thuchi).
  Use when implementing or fixing interestPaymentCycle, nextPaymentDate, đóng lãi,
  chuộc đồ, tất toán, quỹ, hoặc khi đụng Supabase/MCP trên các repo cầm đồ.
---

# Cầm đồ — Chu kỳ lãi & an toàn dữ liệu

## Phạm vi repo

Áp dụng: `3lmotohue`, `79moto`, `lap68`, `laviecar`, `quangvinh`, `thuchi`.

Không áp dụng logic này cho `PC02app` / `DTV360` / `ptthue` (nghiệp vụ khác).

## An toàn production (bắt buộc)

- Mọi app đang chạy **dữ liệu thật**. Mặc định **chỉ đọc**.
- Supabase MCP phải `read_only=true` và đúng `project_ref` của **repo đang mở**.
- **Không** `apply_migration` / SQL ghi / xóa / cập nhật qua MCP trừ khi user yêu cầu rõ từng bước.
- Đóng lãi, chuộc, xuất/nhập quỹ, tất toán: **Transaction/RPC trong code app** — không sửa số dư bằng SQL tay.
- **Không ghi chéo thương hiệu**. Mỗi brand độc lập về nghiệp vụ; không copy hợp đồng/số dư sang DB brand khác.
- Lưu ý vận hành: `3lmotohue` và `lap68` hiện trỏ cùng một Supabase `project_ref` trên máy này — khi làm việc phải xác nhận đang sửa đúng app/brand, không giả định hai DB tách hoàn toàn.

## Chu kỳ đóng lãi (`interestPaymentCycle`)

Field chuẩn: `interestPaymentCycle` (ngày/kỳ). Không dùng `interestPeriod` cũ.

### Ngày thanh toán đầu (tạo HĐ)

```js
const nextPayDate = new Date(startDate)
nextPayDate.setDate(nextPayDate.getDate() + paymentCycle)
```

Ví dụ: cầm 1/1, chu kỳ 10 → kỳ 1 đến hạn **11/1**.

### Sau khi đóng lãi

```js
const next = new Date(selectedContract.nextPaymentDate)
next.setDate(next.getDate() + selectedContract.interestPaymentCycle)
```

### Lãi dự kiến mỗi kỳ

- Fixed daily (`đ/triệu/ngày`): `(gốc / 1_000_000) * rate * paymentCycle`
- % tháng: `gốc * (pct/100) * (paymentCycle / 30)`

### Trạng thái UI

- **Đến hạn hôm nay**: `toDateString(nextPaymentDate) === toDateString(today)`
- **Quá hạn / xấu**: `endDate < today` và `status !== "completed"`

### Thu lãi trước

Nếu bật: `nextPaymentDate = endDate` (kỳ đầu = kỳ cuối).

### Description tự sinh

`CAMDO HĐ{so} KI {n}` theo số kỳ.

## Checklist trước khi sửa tiền tệ

1. Đọc skill này + `INTEREST_PAYMENT_CYCLE_LOGIC.md` trong repo (nếu có).
2. Xác nhận đúng repo/brand và `.cursor/mcp.json` `project_ref`.
3. Mọi cập nhật số tiền/ngày kỳ qua luồng app hiện có (RPC/transaction), không bypass.
4. Không mock dữ liệu; persist thật theo pattern repo.
5. Sau thay đổi: kiểm tra đến hạn / quá hạn / kỳ tiếp theo với case mẫu trong doc.
