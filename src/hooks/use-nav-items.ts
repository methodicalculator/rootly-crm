import { useOrganization } from "@/contexts/OrganizationContext";
import { NAV_ITEMS, ADMIN_NAV_ITEMS, STAFF_NAV_ITEMS } from "@/lib/constants";

export function useNavItems() {
  const { role, impersonatingOrgId } = useOrganization();

  const isImpersonating = !!impersonatingOrgId;
  const isStaff = role === "staff" && !isImpersonating;
  const showOwnerNav = role === "owner" || isImpersonating;

  const adminItems =
    (role === "admin" || role === "super_admin") && !isImpersonating
      ? ADMIN_NAV_ITEMS
      : [];

  const staffItems = isStaff ? STAFF_NAV_ITEMS : [];
  const ownerItems = showOwnerNav ? NAV_ITEMS : [];

  const logoHref = isImpersonating
    ? "/dashboard"
    : isStaff
      ? "/staff/studi"
      : role === "admin" || role === "super_admin"
        ? "/admin/dashboard-aggregata"
        : "/dashboard";

  return { isStaff, showOwnerNav, adminItems, staffItems, ownerItems, logoHref };
}
