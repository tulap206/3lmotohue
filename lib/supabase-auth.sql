-- SQL Migration: Setup login_attempts and user profiles config
-- Run these in Supabase SQL Editor

-- 1. Create Login Attempts table for Brute-force protection & Lockout
CREATE TABLE IF NOT EXISTS login_attempts (
  username TEXT PRIMARY KEY,
  ip_address TEXT,
  attempt_count INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  last_attempt TIMESTAMP WITH TIME ZONE
);

-- Allow select and upsert for anonymous/authenticated roles on login_attempts (or disable RLS for this specific table to let auth API work)
ALTER TABLE login_attempts DISABLE ROW LEVEL SECURITY;

-- 2. Ensure password hashing support in auth_users table
-- We add a column to store salt and check if we need to migrate passwords
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3. Verify auth_users
SELECT id, username, displayname, role FROM auth_users;
