"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  BarChart3,
  Settings,
  Menu,
  Building2,
  ClipboardCheck,
  Receipt,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS, STAFF_NAV_ITEMS } from "@/lib/constants";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

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
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { isAdmin, role } = useOrganization();
  const isStaff = role === "staff";

  const logoHref = isStaff
    ? "/staff/studi"
    : role === "admin"
      ? "/admin/dashboard-aggregata"
      : "/dashboard";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-65 p-0 flex flex-col">
        {/* Logo */}
        <div className="flex items-center justify-center border-b border-border py-2 px-4">
          <Link href={logoHref} onClick={() => setOpen(false)}>
            <img
              src="/logo_horizon.png"
              alt="Horizon One"
              className="h-14 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Scrollable nav area */}
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-1 p-4">
            {/* Staff: show only staff nav items */}
            {isStaff ? (
              STAFF_NAV_ITEMS.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive = pathname.startsWith("/staff");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
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
              })
            ) : (
              <>
                {NAV_ITEMS.map((item) => {
                  const Icon = iconMap[item.icon];
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
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

                {isAdmin && (
                  <>
                    <div className="my-4">
                      <div className="h-px bg-border" />
                    </div>

                    <span className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Amministrazione
                    </span>

                    {ADMIN_NAV_ITEMS.map((item) => {
                      const Icon = iconMap[item.icon];
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/admin/dashboard-aggregata" && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
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
                  </>
                )}
              </>
            )}
          </nav>
        </ScrollArea>

        {/* Settings — pinned to bottom */}
        <div className="border-t border-border p-4">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
