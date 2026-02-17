"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User, Search } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { UserProfile } from "@/types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header({ profile }: { profile: UserProfile | null }) {
  const router = useRouter();
  const { isAdmin, isSuperAdmin, accessLevel } =
    useOrganization();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Badge livello accesso
  const accessBadge = isSuperAdmin
    ? { label: "Super Admin", color: "bg-red-100 text-red-800 border border-amber-300 dark:bg-red-900/30 dark:text-red-300 dark:border-amber-700" }
    : isAdmin
      ? { label: "Admin", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" }
      : accessLevel === "manager"
        ? { label: "Manager", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" }
        : accessLevel === "owner"
          ? { label: "Titolare", color: "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300" }
          : null;

  return (
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-sm lg:px-6">
        <div className="flex items-center gap-4">
          <MobileNav />
          <h2 className="text-lg font-semibold lg:hidden">Horizon One</h2>
        </div>

        <div className="hidden max-w-md flex-1 px-8 md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cerca clienti, campagne..."
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-muted">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {profile?.full_name ? getInitials(profile.full_name) : "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>{profile?.full_name}</span>
                    {accessBadge && (
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${accessBadge.color}`}
                      >
                        {accessBadge.label}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    {profile?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Impostazioni
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="mr-2 h-4 w-4" />
                Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
  );
}
