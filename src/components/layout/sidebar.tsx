"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  BarChart3,
  Settings,
  Building2,
  ClipboardCheck,
  Receipt,
  ScrollText,
  TrendingUp,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS, STAFF_NAV_ITEMS } from "@/lib/constants";
import { useOrganization } from "@/contexts/OrganizationContext";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  BarChart3,
  Building2,
  ClipboardCheck,
  Receipt,
  ScrollText,
  TrendingUp,
  UserCog,
};

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, isSuperAdmin, role } = useOrganization();

  const isStaff = role === "staff";

  // Determine which nav items to show based on role
  const showOwnerNav = role === "owner" || role === "super_admin";
  const showAdminSeparator = role === "super_admin";

  // Staff sees only STAFF_NAV_ITEMS, no owner items
  const ownerItems = NAV_ITEMS;

  const adminItems =
    role === "admin"
      ? ADMIN_NAV_ITEMS
      : role === "super_admin"
        ? ADMIN_NAV_ITEMS
        : [];

  const logoHref = isStaff
    ? "/staff/studi"
    : role === "admin"
      ? "/admin/dashboard-aggregata"
      : "/dashboard";

  return (
    <aside className="hidden w-65 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-border py-2 px-4">
        <Link href={logoHref}>
          <img
            src="/logo_horizon.png"
            alt="Horizon One"
            className="h-20 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Scrollable nav area */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-1">
          {/* Staff: show only staff nav items with blue style */}
          {isStaff &&
            STAFF_NAV_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname.startsWith("/staff");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-l-3 border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              );
            })}

          {/* Owner / super_admin: standard nav items */}
          {showOwnerNav &&
            ownerItems.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-l-3 border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              );
            })}

          {/* Admin section */}
          {adminItems.length > 0 && (
            <>
              {showAdminSeparator && (
                <>
                  <div className="my-4">
                    <div className="h-px bg-border" />
                  </div>
                  <span className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Amministrazione
                  </span>
                </>
              )}

              {adminItems.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin/dashboard-aggregata" &&
                    pathname.startsWith(item.href));

                // admin uses orange style as primary; super_admin uses orange as admin accent
                const useOrangeStyle = role === "admin" || role === "super_admin";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? useOrangeStyle
                          ? "border-l-3 border-[#F89627] bg-[#FFF7ED] text-[#F89627]"
                          : "border-l-3 border-primary bg-primary/10 text-primary"
                        : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </nav>

      {/* Settings — pinned to bottom */}
      <div className="border-t border-border p-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "border-l-3 border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Impostazioni
        </Link>
      </div>
    </aside>
  );
}
