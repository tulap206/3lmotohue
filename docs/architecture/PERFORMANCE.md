# Performance — bottleneck & tối ưu

## Vấn đề đã xác định

| Vấn đề | Ảnh hưởng | Hướng xử lý |
|--------|-----------|-------------|
| Realtime `*` → full refetch 3 bảng | Burst mạng/CPU khi sửa nhiều dòng | Debounce 400ms |
| God pages re-render lớn | Jank khi setState lớn | Tách hooks/memo (wave sau) |
| Dashboard + RentalData + Reports mỗi bên 1 channel rentals/vehicles | Trùng subscription khi mở nhiều tab module | Gộp provider (wave B) |
| `logger` await `/api/client-ip` mỗi log | Chậm nhẹ trước insert | Acceptable; có thể song song sau |
| Fetch toàn bộ rentals không pagination | OK ~vài trăm đơn; rủi khi >5k | RPC + range sau |
| Charts tính lại trên mọi tx | Đã có `useMemo` một phần | Giữ |

## Chiến lược ưu tiên

1. **Speed:** Debounce Realtime reload (đã ship).  
2. **Memory:** Không giữ bản copy trùng 3 context khi có thể.  
3. **Render:** Tránh setState full list nếu payload Realtime cho phép patch (tương lai).  
4. **Scale:** Index DB + RPC báo cáo khi volume tăng.

## Code đã tối ưu

- `lib/debounce.ts`
- Dashboard / Reports / `RentalDataProvider`: refresh Realtime debounce 400ms
