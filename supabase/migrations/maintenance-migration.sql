-- =========================================================================
-- MIGRATION: Add Maintenance Tracking to Vehicles
-- =========================================================================
-- Chạy script này trong Supabase SQL Editor để thêm tính năng bảo trì xe

-- Thêm cột last_maintenance_km vào vehicles table
-- Default = 0 (xe mới chưa bảo trì lần nào)
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS last_maintenance_km INTEGER DEFAULT 0;

-- Tạo index để query nhanh hơn khi tìm xe cần bảo trì
CREATE INDEX IF NOT EXISTS idx_vehicles_maintenance
ON vehicles(current_km, last_maintenance_km);

-- Tạo view để query dễ dàng các xe cần bảo trì
CREATE OR REPLACE VIEW vehicles_due_for_maintenance AS
SELECT
  id,
  name,
  "licensePlate",
  current_km,
  last_maintenance_km,
  -- Tính km tiếp theo cần bảo trì (bội số 1000 tiếp theo)
  (FLOOR(last_maintenance_km / 1000.0) + 1) * 1000 AS next_maintenance_km,
  status,
  created_at
FROM vehicles
WHERE
  -- Xe cần bảo trì khi current_km >= next_maintenance_km
  current_km >= (FLOOR(last_maintenance_km / 1000.0) + 1) * 1000
ORDER BY next_maintenance_km DESC;

-- Tạo function để mark xe là đã bảo trì
CREATE OR REPLACE FUNCTION mark_vehicle_as_maintained(vehicle_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE vehicles
  SET
    last_maintenance_km = current_km,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = vehicle_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert access log khi bảo trì
CREATE OR REPLACE FUNCTION log_maintenance(vehicle_id UUID, vehicle_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO access_logs (action, module, details, timestamp)
  VALUES ('MARKED_MAINTAINED', 'maintenance', vehicle_name, CURRENT_TIMESTAMP);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
