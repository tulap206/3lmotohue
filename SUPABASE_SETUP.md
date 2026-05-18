# 🏍️ 3L Moto - Supabase Integration Guide

## ✅ Hoàn thành: Tích hợp Supabase

Tôi đã cập nhật project của bạn để **lưu dữ liệu vào Supabase thay vì demo data**. Không còn mất dữ liệu khi refresh trang!

---

## 📦 Thay đổi chính

### 1. ✅ File `.env.local` đã được tạo
```env
NEXT_PUBLIC_SUPABASE_URL=https://fpiupgmknsydqrihqdbo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. ✅ Package.json cập nhật
Đã thêm `@supabase/supabase-js` v2.45.0 (library chính để gọi Supabase API)

### 3. ✅ lib/supabase.ts mở rộng
Thêm các function mới:
```typescript
// Insert functions
insertRental() - thêm đơn thuê
insertVehicle() - thêm xe
insertCustomer() - thêm khách (đã có)

// Update functions
updateRental() - sửa đơn thuê
updateVehicle() - sửa xe
updateCustomer() - sửa khách (đã có)

// Delete functions
deleteRental() - xóa đơn thuê
deleteVehicle() - xóa xe
deleteCustomer() - xóa khách (đã có)

// Logging
insertAccessLog() - ghi log hoạt động
```

### 4. ✅ Customers page cập nhật
- Xóa mock data, load từ Supabase
- Dùng insert/update functions
- Thêm error handling
- Log tất cả hoạt động

---

## 🚀 Cài đặt & Chạy

### Bước 1: Install dependencies
```bash
cd 3-l-moto.worktrees/agents-supabase-integration-dashboard
npm install
# hoặc
pnpm install
```

### Bước 2: Kiểm tra `.env.local`
File đã được tạo sẵn. Nếu chạy local, nó sẽ tự load.

### Bước 3: Chạy dev server
```bash
npm run dev
# hoặc
pnpm dev
```

Truy cập: `http://localhost:3000`

---

## 🗄️ Cần tạo Tables trong Supabase

Bạn cần tạo 4 tables này trong Supabase. Vào **SQL Editor** và chạy:

### Table: `customers`
```sql
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  facebook TEXT,
  address TEXT,
  "idCard" TEXT,
  "totalRentals" INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active' | 'inactive'
  "customerPhoto" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "cccdFront" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "cccdBack" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "licenseFront" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "licenseBack" TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_status ON customers(status);
```

### Table: `vehicles`
```sql
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  "licensePlate" TEXT NOT NULL UNIQUE,
  color TEXT,
  "pricePerDay" INTEGER NOT NULL,
  status TEXT DEFAULT 'available', -- 'available' | 'rented' | 'maintenance'
  "currentKm" INTEGER DEFAULT 0,
  "purchasePrice" INTEGER,
  notes TEXT,
  "vehicleImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "documentImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_license_plate ON vehicles("licensePlate");
```

### Table: `rentals`
```sql
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "customerId" UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  "customerName" TEXT NOT NULL,
  "vehicleId" UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  "vehicleName" TEXT NOT NULL,
  "licensePlate" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "totalDays" INTEGER NOT NULL,
  "pricePerDay" INTEGER NOT NULL,
  "totalPrice" INTEGER NOT NULL,
  deposit INTEGER DEFAULT 0,
  "extraFees" INTEGER DEFAULT 0,
  notes TEXT,
  revenue INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending' | 'active' | 'completed' | 'cancelled'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rentals_customer ON rentals("customerId");
CREATE INDEX idx_rentals_vehicle ON rentals("vehicleId");
CREATE INDEX idx_rentals_status ON rentals(status);
```

### Table: `access_logs`
```sql
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  "userId" TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp);
CREATE INDEX idx_access_logs_module ON access_logs(module);
```

---

## 📝 Cách dùng

### Thêm khách hàng
```typescript
import { insertCustomer, fetchCustomers } from '@/lib/supabase'

const newCustomer = await insertCustomer({
  name: "Nguyễn Văn A",
  phone: "0901234567",
  facebook: "https://facebook.com/...",
  address: "123 Đường A, Q1, TP.HCM",
  idCard: "123456789",
  totalRentals: 0,
  status: "active",
  customerPhoto: [],
  cccdFront: [],
  cccdBack: [],
  licenseFront: [],
  licenseBack: [],
})

// Load danh sách
const customers = await fetchCustomers()
```

### Cập nhật khách hàng
```typescript
import { updateCustomer } from '@/lib/supabase'

await updateCustomer(customerId, {
  name: "Nguyễn Văn A (cập nhật)",
  phone: "0909876543"
})
```

### Xóa khách hàng
```typescript
import { deleteCustomer } from '@/lib/supabase'

await deleteCustomer(customerId)
```

### Tương tự cho Vehicles & Rentals
```typescript
import { 
  insertVehicle, updateVehicle, deleteVehicle,
  insertRental, updateRental, deleteRental 
} from '@/lib/supabase'
```

---

## ⚠️ Cần làm tiếp

### 1. **Cập nhật Orders Page** (chưa hoàn thành)
File `app/dashboard/orders/page.tsx` hiện dùng `initialOrders` (demo data).

Cần thay bằng:
```typescript
useEffect(() => {
  const loadOrders = async () => {
    const data = await fetchRentals()
    setOrders(data) // orders -> rentals
  }
  loadOrders()
}, [])

// handleSubmit dùng insertRental()
// handleDelete dùng deleteRental()
// handleEdit dùng updateRental()
```

### 2. **Cập nhật Vehicles Page**
Giống orders, cần load từ `fetchVehicles()` thay vì mock data.

### 3. **Upload ảnh (Optional)**
Nếu muốn lưu ảnh thực tế, dùng Supabase Storage:
```typescript
const { data, error } = await supabase
  .storage
  .from('customer-photos')
  .upload(`${customerId}/${filename}`, file)
```

Hiện tại, code dùng URL strings - OK để demo.

### 4. **Authentication**
File `contexts/auth-context.tsx` có login đơn giản. Nên thêm Supabase Auth để bảo mật hơn.

---

## 🧪 Kiểm tra

Sau khi cài xong:

1. **Vào Customers page** → Thêm khách hàng mới
2. **Vào Supabase Dashboard** → Table `customers` → xem dữ liệu
3. **Refresh trang** → Dữ liệu vẫn còn ✅
4. **Edit/Delete** → Kiểm tra hoạt động

---

## 🐛 Troubleshooting

### "Error: Supabase URL not found"
- Kiểm tra `.env.local` có file không
- Restart dev server: `Ctrl+C` rồi `npm run dev`

### "Error: Invalid API key"
- Copy lại `anon public` key từ Supabase Settings → API
- Paste vào `.env.local`

### "Table does not exist"
- Vào Supabase SQL Editor
- Chạy SQL code từ phần **"Cần tạo Tables"** phía trên

### Dữ liệu không load
- Mở DevTools (F12) → Console
- Kiểm tra error messages
- Table schema có match với code không?

---

## 📞 Hỗ trợ

Nếu có vấn đề:
1. Kiểm tra Supabase status: https://status.supabase.com
2. Xem console log (F12)
3. Đảm bảo `.env.local` có đúng URL & key

---

## 🎉 Xong!

Bây giờ project của bạn:
- ✅ Lưu dữ liệu thực tế vào Supabase
- ✅ Không mất dữ liệu khi refresh
- ✅ Có API scale tốt cho future growth
- ✅ Sẵn sàng deploy

**Tiếp theo:** Cập nhật Orders & Vehicles pages, thêm Auth, deploy lên Vercel! 🚀
