-- Add soft-delete support for clients via archived_at timestamp
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
