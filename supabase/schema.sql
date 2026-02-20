-- CRM Horizon One - Multi-Tenant Database Schema
-- Run this in the Supabase SQL Editor
-- This replaces the previous single-tenant schema

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HELPER FUNCTION: auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ORGANIZATIONS (multi-tenant root)
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'agency', 'fisioterapia', 'osteopatia', 'massoterapia', 'estetica', 'mindfulness', 'altro'
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  partita_iva TEXT,

  -- Status e approvazione
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'cancelled'
  approved_at TIMESTAMPTZ,
  approved_by UUID, -- user_id admin che ha approvato

  -- Contratto Horizon One
  monthly_budget DECIMAL(10,2),
  contract_start_date DATE,
  contract_end_date DATE,

  -- Meta Ads Integration
  meta_business_id TEXT UNIQUE,
  meta_page_id TEXT UNIQUE,
  meta_ad_account_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Horizon One come organizzazione admin
INSERT INTO organizations (
  id, name, type, owner_name, email, status, approved_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Horizon One',
  'agency',
  'Jacopo Massaretti',
  'jacopo.massaretti@gmail.com',
  'active',
  now()
);

-- ============================================
-- USER PROFILES (linked to auth.users)
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'owner', -- 'super_admin', 'admin', 'manager', 'owner'
  role TEXT NOT NULL DEFAULT 'owner', -- 'super_admin', 'admin', 'staff', 'owner'
  full_name TEXT,
  email TEXT,
  phone TEXT,
  professional_type TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user_profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- USER ORGANIZATION ACCESS (manager → assigned orgs)
-- ============================================

CREATE TABLE user_organization_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_user_org_access_user ON user_organization_access(user_id);
CREATE INDEX idx_user_org_access_org ON user_organization_access(organization_id);

-- ============================================
-- STAFF ORGANIZATIONS (staff multi-org assignments)
-- ============================================

CREATE TABLE staff_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_staff_org_user ON staff_organizations(user_id);
CREATE INDEX idx_staff_org_org ON staff_organizations(organization_id);

-- ============================================
-- CLIENTS (customers of each organization)
-- ============================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  indirizzo TEXT,
  citta TEXT,
  cap TEXT,
  birth_date DATE,
  service_interest TEXT, -- generico: 'lombalgia', 'massaggio rilassante', etc.
  source TEXT, -- 'meta_ads', 'google_ads', 'referral', 'organic', 'other'
  first_contact_date DATE,
  last_contact_date DATE,
  status TEXT NOT NULL DEFAULT 'attivo', -- 'attivo', 'inattivo', 'da_ricontattare'
  tags TEXT[], -- tag personalizzati
  note TEXT,
  contacted_at TIMESTAMPTZ, -- NULL = lead non ancora contattato
  sales_stage TEXT NOT NULL DEFAULT 'new', -- 'new','contacted','responded','appointment_scheduled','appointment_completed','converted','lost'
  appointment_date TIMESTAMPTZ,
  appointment_completed_at TIMESTAMPTZ,
  conversion_amount DECIMAL(12,2),
  lost_reason TEXT, -- 'disdetta','non_presentato','non_interessato','contatto_falso'
  sessions_count INTEGER, -- numero sedute per percorso acquistato
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- CAMPAIGNS (Meta Ads campaigns per organization)
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  nome_campagna TEXT NOT NULL,
  meta_campaign_id TEXT,
  budget_mensile DECIMAL(12,2),
  data_inizio DATE,
  data_fine DATE,
  status TEXT NOT NULL DEFAULT 'attiva', -- 'attiva', 'in_pausa', 'completata'
  target_audience JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- CAMPAIGN METRICS (daily performance data)
-- ============================================

CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  spend DECIMAL(12,2) NOT NULL DEFAULT 0,
  cpc DECIMAL(12,4),
  cpa DECIMAL(12,4),
  ctr DECIMAL(8,4),
  cpm DECIMAL(12,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- COMMUNICATIONS (interaction log)
-- ============================================

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'call', 'email', 'meeting', 'nota'
  contenuto TEXT NOT NULL,
  data_comunicazione TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'scadenza_contratto', 'budget_alert', 'performance_alert', 'nuovo_studio', 'approvazione', 'nuovo_cliente'
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGER: auto-notification on new client
-- ============================================

CREATE OR REPLACE FUNCTION notify_new_client()
RETURNS TRIGGER AS $$
DECLARE
  _source TEXT;
BEGIN
  _source := COALESCE(NEW.source, 'altro');
  INSERT INTO notifications (organization_id, user_id, type, message)
  SELECT
    NEW.organization_id,
    up.id,
    'nuovo_cliente',
    'Nuovo cliente: ' || NEW.nome || ' ' || NEW.cognome || ' (fonte: ' || _source || ')'
  FROM user_profiles up
  WHERE up.organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_client
  AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION notify_new_client();

-- ============================================
-- EVENTS (calendar)
-- ============================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- APPOINTMENTS (per organization)
-- ============================================

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no_show'
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INVOICES (fatture Horizon One ai clienti)
-- ============================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
  payment_date DATE,
  payment_method TEXT, -- 'bonifico', 'carta', 'paypal'
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ADMIN ACTIVITY LOG (impersonate, approvals)
-- ============================================

CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'impersonate', 'approve_org', 'suspend_org', 'reject_org'
  target_organization_id UUID REFERENCES organizations(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- API KEYS (webhook authentication)
-- ============================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE, -- raw API key
  key_prefix TEXT NOT NULL, -- first 8 chars for identification
  label TEXT NOT NULL, -- human-readable name, e.g. "Zapier Production"
  scopes TEXT[] NOT NULL DEFAULT '{}', -- e.g. '{webhooks:write}'
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- WEBHOOK LOGS (audit trail)
-- ============================================

CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  ip_address TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Organizations
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_type ON organizations(type);

-- User profiles
CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Clients
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_clients_nome ON clients(nome, cognome);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_source ON clients(source);

-- Campaigns
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Campaign metrics
CREATE INDEX idx_campaign_metrics_campaign_id ON campaign_metrics(campaign_id);
CREATE INDEX idx_campaign_metrics_date ON campaign_metrics(date);
CREATE UNIQUE INDEX idx_campaign_metrics_campaign_date ON campaign_metrics(campaign_id, date);

-- Communications
CREATE INDEX idx_communications_org ON communications(organization_id);
CREATE INDEX idx_communications_client_id ON communications(client_id);

-- Notifications
CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Events
CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_start_at ON events(start_at);

-- Appointments
CREATE INDEX idx_appointments_org ON appointments(organization_id);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_start ON appointments(start_time);

-- Invoices
CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Admin activity log
CREATE INDEX idx_admin_log_admin ON admin_activity_log(admin_user_id);
CREATE INDEX idx_admin_log_org ON admin_activity_log(target_organization_id);

-- API keys
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key ON api_keys(key);

-- Webhook logs
CREATE INDEX idx_webhook_logs_api_key ON webhook_logs(api_key_id);
CREATE INDEX idx_webhook_logs_endpoint ON webhook_logs(endpoint);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at);

-- ============================================
-- RLS HELPER FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS internally to avoid circular
-- dependency when policies query user_profiles.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'super_admin') FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Staff: check if the current user is assigned to a given organization
CREATE OR REPLACE FUNCTION public.is_staff_of_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.staff_organizations
    WHERE staff_organizations.user_id = auth.uid()
      AND staff_organizations.organization_id = check_org_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- ---- user_profiles ----
CREATE POLICY "Users can read own profile or admin or co-staff"
  ON user_profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_profiles.id
    OR is_admin_user()
    OR EXISTS(
      SELECT 1 FROM staff_organizations s1
      JOIN staff_organizations s2 ON s1.organization_id = s2.organization_id
      WHERE s1.user_id = auth.uid() AND s2.user_id = user_profiles.id
    )
  );

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ---- organizations ----
CREATE POLICY "Users can read own org or admin or staff"
  ON organizations FOR SELECT TO authenticated
  USING (
    organizations.id = get_user_org_id()
    OR is_admin_user()
    OR is_staff_of_org(organizations.id)
  );

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE TO authenticated
  USING (is_admin_user());

-- ---- Org-scoped tables ----
-- Users see data from their own org; admins see all
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients', 'campaigns', 'communications',
    'notifications', 'events', 'appointments'
  ])
  LOOP
    -- SELECT: own org, admin, or assigned staff
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (
        organization_id = get_user_org_id() OR is_admin_user() OR is_staff_of_org(organization_id)
      )',
      tbl, tbl
    );
    -- INSERT: own org, admin, or assigned staff
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (
        organization_id = get_user_org_id() OR is_admin_user() OR is_staff_of_org(organization_id)
      )',
      tbl, tbl
    );
    -- UPDATE: own org, admin, or assigned staff
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (
        organization_id = get_user_org_id() OR is_admin_user() OR is_staff_of_org(organization_id)
      )',
      tbl, tbl
    );
    -- DELETE: admin only
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING (
        is_admin_user()
      )',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ---- campaign_metrics ----
CREATE POLICY "campaign_metrics_select" ON campaign_metrics FOR SELECT TO authenticated
  USING (
    campaign_metrics.campaign_id IN (
      SELECT campaigns.id FROM campaigns
      WHERE campaigns.organization_id = get_user_org_id()
        OR is_staff_of_org(campaigns.organization_id)
    )
    OR is_admin_user()
  );

CREATE POLICY "campaign_metrics_insert" ON campaign_metrics FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "campaign_metrics_update" ON campaign_metrics FOR UPDATE TO authenticated
  USING (is_admin_user());

-- ---- invoices ----
CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated
  USING (
    invoices.organization_id = get_user_org_id()
    OR is_admin_user()
    OR is_staff_of_org(invoices.organization_id)
  );

CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated
  USING (is_admin_user());

-- ---- admin_activity_log ----
CREATE POLICY "admin_log_select" ON admin_activity_log FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_log_insert" ON admin_activity_log FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

-- ---- api_keys (admin only) ----
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE TO authenticated
  USING (is_admin_user());

CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE TO authenticated
  USING (is_admin_user());

-- ---- user_organization_access ----
ALTER TABLE user_organization_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_org_access_select" ON user_organization_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin_user());

CREATE POLICY "user_org_access_insert" ON user_organization_access FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "user_org_access_delete" ON user_organization_access FOR DELETE TO authenticated
  USING (is_admin_user());

-- ---- webhook_logs (admin only) ----
CREATE POLICY "webhook_logs_select" ON webhook_logs FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "webhook_logs_insert" ON webhook_logs FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());
