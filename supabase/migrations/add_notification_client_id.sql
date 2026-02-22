-- Migration: Add client_id to notifications + update trigger
-- This enables linking notifications to specific clients (leads)

-- 1. Add client_id column
ALTER TABLE notifications
  ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 2. Composite index for dedup in cron checks
CREATE INDEX idx_notifications_client_type ON notifications(client_id, type);

-- 3. Update trigger function to include client_id
-- Also supports 2 new types: 'incasso_non_aggiornato', 'lead_non_contattato'
CREATE OR REPLACE FUNCTION notify_new_client()
RETURNS TRIGGER AS $$
DECLARE
  _source TEXT;
BEGIN
  _source := COALESCE(NEW.source, 'altro');
  INSERT INTO notifications (organization_id, user_id, type, message, client_id)
  SELECT
    NEW.organization_id,
    up.id,
    'nuovo_cliente',
    'Nuovo cliente: ' || NEW.nome || ' ' || NEW.cognome || ' (fonte: ' || _source || ')',
    NEW.id
  FROM user_profiles up
  WHERE up.organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
