-- Fix is_admin_user() function: use "role" column instead of non-existent "is_admin" column.
-- The original migration (20260217141846) referenced "is_admin" which does not exist
-- in user_profiles. The correct check uses role IN ('admin', 'super_admin').

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'super_admin') FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
