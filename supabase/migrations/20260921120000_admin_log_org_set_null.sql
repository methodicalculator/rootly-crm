-- Allow deleting organizations without being blocked by admin_activity_log.
-- Changes ON DELETE from NO ACTION (default) to SET NULL so that
-- historical admin actions (approve, suspend, reject, impersonate)
-- are preserved with target_organization_id = NULL.

ALTER TABLE admin_activity_log
  DROP CONSTRAINT admin_activity_log_target_organization_id_fkey,
  ADD CONSTRAINT admin_activity_log_target_organization_id_fkey
    FOREIGN KEY (target_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
