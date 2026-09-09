-- Fix RLS Policies: Eliminare il loop circolare
-- Le policy precedenti facevano subquery su user_profiles (che ha RLS) → loop infinito.
-- Soluzione: funzioni SECURITY DEFINER che bypassano RLS internamente.

-- ============================================
-- STEP 1: Creare funzioni helper SECURITY DEFINER
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 2: Drop TUTTE le policy esistenti
-- ============================================

-- user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "User profile auto-insert" ON user_profiles;

-- organizations
DROP POLICY IF EXISTS "Users can read own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;

-- Generic org-scoped tables (created via DO block with pattern "{table}_select" etc.)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients', 'campaigns', 'communications',
    'notifications', 'events', 'appointments'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);
  END LOOP;
END;
$$;

-- campaign_metrics
DROP POLICY IF EXISTS "campaign_metrics_select" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_insert" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_update" ON campaign_metrics;

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;

-- admin_activity_log
DROP POLICY IF EXISTS "admin_log_select" ON admin_activity_log;
DROP POLICY IF EXISTS "admin_log_insert" ON admin_activity_log;

-- ============================================
-- STEP 3: Ricreare policy corrette
-- ============================================

-- ---- user_profiles ----
CREATE POLICY "Users can read own profile or admin"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin_user());

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ---- organizations ----
CREATE POLICY "Users can read own org or admin"
  ON organizations FOR SELECT TO authenticated
  USING (id = get_user_org_id() OR is_admin_user());

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE TO authenticated
  USING (is_admin_user());

-- ---- Org-scoped tables ----
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients', 'campaigns', 'communications',
    'notifications', 'events', 'appointments'
  ])
  LOOP
    -- SELECT: own org or admin
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (
        organization_id = get_user_org_id() OR is_admin_user()
      )',
      tbl, tbl
    );
    -- INSERT: own org or admin
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (
        organization_id = get_user_org_id() OR is_admin_user()
      )',
      tbl, tbl
    );
    -- UPDATE: own org or admin
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (
        organization_id = get_user_org_id() OR is_admin_user()
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
    campaign_id IN (
      SELECT id FROM campaigns WHERE organization_id = get_user_org_id()
    )
    OR is_admin_user()
  );

CREATE POLICY "campaign_metrics_insert" ON campaign_metrics FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "campaign_metrics_update" ON campaign_metrics FOR UPDATE TO authenticated
  USING (is_admin_user());

-- ---- invoices ----
CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() OR is_admin_user());

CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated
  USING (is_admin_user());

-- ---- admin_activity_log ----
CREATE POLICY "admin_log_select" ON admin_activity_log FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_log_insert" ON admin_activity_log FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());
