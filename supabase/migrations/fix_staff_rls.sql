-- ============================================
-- Migration: Allow staff users to access data from their assigned organizations
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Create helper function: is the current user assigned to this org as staff?
CREATE OR REPLACE FUNCTION public.is_staff_of_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.staff_organizations
    WHERE staff_organizations.user_id = auth.uid()
      AND staff_organizations.organization_id = check_org_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 2. user_profiles: allow staff to see co-staff profiles (shared org)
DROP POLICY IF EXISTS "Users can read own profile or admin" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile or admin or co-staff" ON user_profiles;
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


-- 3. organizations: staff can read assigned orgs
DROP POLICY IF EXISTS "Users can read own org or admin" ON organizations;
DROP POLICY IF EXISTS "Users can read own org or admin or staff" ON organizations;
CREATE POLICY "Users can read own org or admin or staff"
  ON organizations FOR SELECT TO authenticated
  USING (
    organizations.id = get_user_org_id()
    OR is_admin_user()
    OR is_staff_of_org(organizations.id)
  );


-- 4. Org-scoped tables: staff can SELECT, INSERT, UPDATE on assigned orgs
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients', 'campaigns', 'communications',
    'notifications', 'events', 'appointments'
  ])
  LOOP
    -- DROP old policies
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);

    -- Re-create with staff access
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (
        organization_id = get_user_org_id() OR is_admin_user() OR is_staff_of_org(organization_id)
      )',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (
        organization_id = get_user_org_id() OR is_admin_user() OR is_staff_of_org(organization_id)
      )',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (
        organization_id = get_user_org_id() OR is_admin_user() OR is_staff_of_org(organization_id)
      )',
      tbl, tbl
    );
    -- DELETE policies stay admin-only (no change needed)
  END LOOP;
END;
$$;


-- 5. campaign_metrics: staff can read metrics for campaigns in their assigned orgs
DROP POLICY IF EXISTS "campaign_metrics_select" ON campaign_metrics;
CREATE POLICY "campaign_metrics_select" ON campaign_metrics FOR SELECT TO authenticated
  USING (
    campaign_metrics.campaign_id IN (
      SELECT campaigns.id FROM campaigns
      WHERE campaigns.organization_id = get_user_org_id()
        OR is_staff_of_org(campaigns.organization_id)
    )
    OR is_admin_user()
  );


-- 6. invoices: staff can read invoices for assigned orgs
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated
  USING (
    invoices.organization_id = get_user_org_id()
    OR is_admin_user()
    OR is_staff_of_org(invoices.organization_id)
  );
