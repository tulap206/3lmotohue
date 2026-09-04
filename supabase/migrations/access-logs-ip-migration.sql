-- Add IP address field to access activity logs
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS ip_address text;

-- Backfill IP from legacy details text (e.g. "IP: 1.2.3.4 | ...")
UPDATE public.access_logs
SET ip_address = substring(details from 'IP:\s*([0-9a-fA-F:\.]+)')
WHERE ip_address IS NULL
  AND details ~ 'IP:\s*[0-9a-fA-F:\.]';
