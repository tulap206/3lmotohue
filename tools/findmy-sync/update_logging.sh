#!/bin/bash

# Add logging import to vehicles page
sed -i "1s|\"use client\"|\"use client\"\n\nimport { logVehicleAction } from \"@/lib/logging\"|" app/dashboard/vehicles/page.tsx

# Update vehicles logging calls
sed -i 's|addAccessLog("Thêm mới", "Quản lý xe", |logVehicleAction(addAccessLog, "Thêm mới", |g' app/dashboard/vehicles/page.tsx
sed -i 's|addAccessLog("Chỉnh sửa", "Quản lý xe", |logVehicleAction(addAccessLog, "Chỉnh sửa", |g' app/dashboard/vehicles/page.tsx
sed -i 's|addAccessLog("Xóa", "Quản lý xe", |logVehicleAction(addAccessLog, "Xóa", |g' app/dashboard/vehicles/page.tsx

# Add logging import to orders page  
sed -i "1s|\"use client\"|\"use client\"\n\nimport { logRentalAction } from \"@/lib/logging\"|" app/dashboard/orders/page.tsx

# Update orders logging calls
sed -i 's|addAccessLog("Thêm mới", "Đơn Thuê", |logRentalAction(addAccessLog, "Thêm mới", |g' app/dashboard/orders/page.tsx
sed -i 's|addAccessLog("Chỉnh sửa", "Đơn Thuê", |logRentalAction(addAccessLog, "Chỉnh sửa", |g' app/dashboard/orders/page.tsx
sed -i 's|addAccessLog("Xóa", "Đơn Thuê", |logRentalAction(addAccessLog, "Xóa", |g' app/dashboard/orders/page.tsx

echo "✅ Updated logging across all pages"
