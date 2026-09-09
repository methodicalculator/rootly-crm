ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS meta_page_access_token TEXT;
