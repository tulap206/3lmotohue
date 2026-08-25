# 🏍️ HƯỚNG DẪN TÍNH NĂNG ĐIỀU PHỐI XE & QUẢN LÝ ĐẶT TRƯỚC THÔNG MINH (3L MOTO)

Tài liệu này mô tả chi tiết giải pháp **Điều phối xe theo dòng thời gian (Timeline Fleet Allocation)** và **Sơ đồ Gantt trực quan** được thiết kế riêng cho hệ thống vận hành của **3L Moto**.

---

## 📌 1. BÀI TOÁN THỰC TẾ & NGUYÊN NHÂN PHÁT SINH

Trước đây, hệ thống gặp xung đột giữa **khách đặt trước trong tương lai** và **khách thuê hiện tại**:
1. **Nếu không gán xe lúc khách đặt trước**: Đến ngày giao xe không biết lấy xe nào, dễ bị chồng chéo đơn hoặc nhận vượt quá số lượng xe có sẵn (*Overbooking*).
2. **Nếu gán biển số cứng ngay từ đầu**: Chiếc xe đó bị khóa trạng thái "chờ giao", khiến khách hiện tại đến thuê ngắn ngày trong khoảng trống trước đó không chọn được xe, gây lãng phí công suất xe.

---

## 🚀 2. GIẢI PHÁP ĐÃ ĐƯỢC TRIỂN KHAI VÀO HỆ THỐNG

Hệ thống đã được nâng cấp toàn diện với **4 trụ cột thông minh**:

### A. Quản lý khả dụng theo Dòng thời gian (Timeline Availability Engine)
* Hệ thống không kiểm tra trạng thái tĩnh (`available`/`rented`) mà kiểm tra **Xe có rảnh trong khoảng ngày cụ thể `[Ngày nhận -> Ngày trả]` hay không**.
* **Ví dụ:** Xe Vision `75B1-123.45` đang có khách đặt trước vào ngày `29/08 -> 02/09`:
  * Nếu khách hiện tại thuê `25/08 -> 27/08`: Hệ thống **vẫn cho phép chọn xe này** vì ngày trả trước ngày 29/08.
  * Nếu khách muốn thuê `25/08 -> 31/08`: Hệ thống sẽ **cảnh báo và chặn** không cho chọn xe này vì bị trùng với đơn ngày 29/08.

### B. Phân loại xe 3 cấp độ thông minh khi Tạo/Sửa đơn (Smart Vehicle Classifier)
Khi nhân viên chọn ngày nhận và ngày trả, danh sách xe sẽ tự động được phân thành 3 nhóm:

| Nhóm | Huy hiệu (Badge) | Ý nghĩa vận hành |
| :--- | :---: | :--- |
| **🟢 Rảnh suốt kỳ** | `Rảnh suốt kỳ` | Xe hoàn toàn trống lịch trong và sau thời gian này $\rightarrow$ **An tâm giao xe**. |
| **🟡 Rảnh có điều kiện** | `Trống đến [Ngày]` | Xe rảnh trong đợt này nhưng **sau đó có khách đặt trước** $\rightarrow$ **Ưu tiên đẩy cho khách thuê ngắn hạn**. |
| **🔴 Trùng lịch / Đang bận** | `Trùng lịch thuê` | Xe đã có đơn trùng ngày $\rightarrow$ **Bị khóa/làm mờ kèm lý do (tên khách & ngày trùng)** để tránh gán nhầm. |

### C. Sơ đồ điều phối lịch xe trực quan (Fleet Gantt Timeline)
* Tích hợp tab **"📊 Sơ đồ Timeline"** ngay tại trang Quản lý đơn thuê (`/dashboard/orders`).
* Hiển thị dạng bảng lưới liên tục theo 7 ngày, 14 ngày hoặc 30 ngày:
  * **Hàng dọc**: Toàn bộ danh sách xe (Tên xe, biển số, giá thuê).
  * **Hàng ngang**: Các ngày trong tuần/tháng (Có đánh dấu ngày hôm nay và cuối tuần).
  * **Thanh màu đơn thuê**:
    * 🟢 **Màu xanh lá**: Xe đang chạy trên đường (Active).
    * 🟡 **Màu vàng cam**: Đơn đặt trước / Chờ giao xe (Pending).
    * 🔴 **Màu đỏ có icon cờ lê**: Xe đang bảo trì/sửa chữa (Maintenance).
    * ⚪ **Ô nét đứt màu trắng**: Khoảng rảnh của xe $\rightarrow$ **Bấm trực tiếp vào ô để tạo nhanh đơn thuê cho xe đó**.

### D. Nâng cấp bộ tìm xe trên Landing Page Khách hàng
* Khách hàng tìm xe trên website cho các ngày tương lai sẽ nhìn thấy cả những xe **hiện đang chạy nhưng sẽ trả trước ngày khách nhận**.
* Đảm bảo tối đa hóa tỉ lệ chốt đơn và doanh thu cho cửa hàng.

### E. Quản lý trạng thái xe linh hoạt theo ngày (Dynamic Fleet Status by Date)
* Tại trang **Quản lý xe (`/dashboard/vehicles`)**, hệ thống đã bổ sung thanh công cụ **"Trạng thái xe theo ngày"**:
  * Cho phép chọn xem nhanh trạng thái đội xe tại các mốc: **Hôm nay**, **Ngày mai**, **Ngày kia** hoặc **Chọn một ngày bất kỳ trong tương lai**.
  * **5 Thẻ KPI tự động tính toán lại theo ngày được chọn**:
    * 🟢 **Sẵn sàng**: Số xe rảnh trong ngày đó (kèm chú thích *Trống đến ngày nào / Còn bao nhiêu ngày*).
    * 🟡 **Chờ giao**: Số xe có lịch hẹn giao cho khách trong ngày đó.
    * 🔵 **Đang thuê**: Số xe đang chạy trên đường trong ngày đó (kèm thông tin khách thuê và ngày trả).
    * 🔴 **Bảo trì**: Số xe tạm dừng hoạt động do sửa chữa.
  * Bấm vào bất kỳ thẻ KPI nào để lọc danh sách xe tương ứng của ngày đó.

---

## 📖 3. HƯỚNG DẪN SỬ DỤNG DÀNH CHO NHÂN VIÊN VẬN HÀNH

### 1. Xem và bao quát toàn bộ lịch xe trên Sơ đồ Timeline:
1. Vào **Admin Dashboard** $\rightarrow$ Chọn mục **Đơn thuê** (`/dashboard/orders`).
2. Ở thanh công cụ trên cùng, nhấn nút **"📊 Sơ đồ Timeline"**.
3. Xem các thanh màu để biết xe nào đang trống ngày nào:
   * Nhấn **"7 ngày" / "14 ngày" / "30 ngày"** để thay đổi phạm vi hiển thị.
   * Dùng nút **◀ / ▶** hoặc **"Hôm nay"** để chuyển dòng thời gian.
4. **Xem chi tiết / Đổi xe**: Bấm vào bất kỳ thanh đơn nào để xem tên khách, SĐT, giá tiền và bấm *Chỉnh sửa / Đổi xe*.
5. **Tạo nhanh đơn**: Bấm vào ô trống của một chiếc xe bất kỳ để mở form tạo đơn với xe và ngày đã được điền sẵn.

### 2. Tạo đơn thuê mới không sợ trùng lịch:
1. Nhấn nút **"Tạo đơn thuê mới"**.
2. Chọn/Nhập thông tin khách hàng và **Ngày bắt đầu $\rightarrow$ Ngày kết thúc**.
3. Mở ô **"Tìm xe"**:
   * Hệ thống sẽ tự động xếp các xe **🟢 Rảnh suốt kỳ** và **🟡 Trống đến ngày X** lên đầu.
   * Các xe bị trùng lịch **🔴** sẽ hiển thị rõ thông tin khách đang trùng để nhân viên không chọn nhầm.

### 3. Gán xe cho đơn đặt trước (Chờ gán xe):
1. Khi có đơn đặt trước từ Web hoặc khách chưa gán xe, bấm nút **"Giao xe / Gán xe"** trên bảng đơn.
2. Modal sẽ tự động quét danh sách xe khả dụng trong khoảng ngày của đơn đó:
   * Ưu tiên các xe rảnh thực tế.
   * Hiển thị rõ xe nào có lịch nối tiếp phía sau.
3. Chọn xe phù hợp và bấm **"Xác nhận gán xe & Bàn giao"**.

---

## 🛠️ 4. TỔNG KẾT CÁC FILE MÃ NGUỒN ĐÃ TRIỂN KHAI

1. **`lib/vehicle-timeline.ts`**: Bộ não thuật toán tính toán lịch, kiểm tra trùng lặp ngày, phân loại xe và xuất ma trận Gantt.
2. **`components/dashboard/fleet-timeline-view.tsx`**: Component giao diện Sơ đồ Timeline Gantt trực quan, tương tác cao.
3. **`app/dashboard/orders/page.tsx`**: Tích hợp nút chuyển đổi chế độ xem Timeline, nâng cấp dropdown chọn xe thông minh và modal gán xe.
4. **`app/page-client.tsx`**: Tối ưu bộ lọc tìm xe trên Landing Page cho các đơn đặt trước tương lai.

---
*Tài liệu được khởi tạo tự động bởi Antigravity Assistant - Bản quyền thuộc 3L Moto Huế.*
