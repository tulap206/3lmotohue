-- Fix RLS Policies for Reports & Public Access
-- Run these in Supabase SQL Editor

-- 1. Customers table - Allow SELECT for everyone
DROP POLICY IF EXISTS "Allow all on customers" ON customers;
CREATE POLICY "Allow SELECT on customers" ON customers
  FOR SELECT USING (true);

-- 2. Vehicles table - Allow SELECT for everyone  
DROP POLICY IF EXISTS "Allow all on vehicles" ON vehicles;
CREATE POLICY "Allow SELECT on vehicles" ON vehicles
  FOR SELECT USING (true);

-- 3. Rentals table - Allow SELECT for everyone
DROP POLICY IF EXISTS "Allow all on rentals" ON rentals;
CREATE POLICY "Allow SELECT on rentals" ON rentals
  FOR SELECT USING (true);

-- 4. Access Logs table - Allow SELECT for everyone
DROP POLICY IF EXISTS "Allow all on access_logs" ON access_logs;
CREATE POLICY "Allow SELECT on access_logs" ON access_logs
  FOR SELECT USING (true);

-- Verify policies
SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('customers', 'vehicles', 'rentals', 'access_logs');
