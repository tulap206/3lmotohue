-- Phân loại đơn thuê: ngắn hạn / dài hạn
-- Chạy trên Supabase SQL Editor nếu chưa có cột rentalTerm

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS "rentalTerm" TEXT DEFAULT 'short';

UPDATE rentals
SET "rentalTerm" = 'short'
WHERE "rentalTerm" IS NULL OR "rentalTerm" = '';

-- Đồng bộ từ tag notes cũ (nếu có)
UPDATE rentals
SET "rentalTerm" = 'long'
WHERE notes ~* '^\[rentalTerm:long\]';

UPDATE rentals
SET notes = regexp_replace(notes, '^\[rentalTerm:(short|long)\]\s*', '', 'i')
WHERE notes ~* '^\[rentalTerm:(short|long)\]';

CREATE INDEX IF NOT EXISTS idx_rentals_rental_term ON rentals("rentalTerm");
