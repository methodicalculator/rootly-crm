"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Notification } from "@/types";

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  nuovo_cliente: "Nuovo Lead",
  scadenza_contratto: "Scadenza Contratto",
  budget_alert: "Budget Alert",
  performance_alert: "Performance",
  nuovo_studio: "Nuovo Studio",
  approvazione: "Approvazione",
  incasso_non_aggiornato: "Incasso da Aggiornare",
  lead_non_contattato: "Lead Non Contattato",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

export function NotificationBell() {
  const router = useRouter();
  const { userId, effectiveOrgId, isAdmin, loading: orgLoading } = useOrganization();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (effectiveOrgId) {
      query = query.eq("organization_id", effectiveOrgId);
    }

    const { data } = await query;
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [userId, effectiveOrgId]);

  // Initial fetch
  useEffect(() => {
    if (orgLoading) return;
    fetchNotifications();
  }, [orgLoading, fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!userId || orgLoading) return;

    const supabase = createClient();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          // Only add if matching effective org (or no org filter)
          if (
            !effectiveOrgId ||
            newNotification.organization_id === effectiveOrgId
          ) {
            setNotifications((prev) => [newNotification, ...prev].slice(0, 30));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, effectiveOrgId, orgLoading]);

  async function markAsRead(notificationId: string) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }

  async function markAllAsRead() {
    if (!userId) return;
    const supabase = createClient();

    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifiche</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-primary hover:text-primary/80"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Segna tutte lette
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Caricamento...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              Nessuna notifica
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => {
                const title = NOTIFICATION_TYPE_LABELS[n.type] ?? n.type;
                return (
                  <button
                    key={n.id}
                    onClick={async () => {
                      if (!n.read) await markAsRead(n.id);
                      if (n.client_id) {
                        setOpen(false);
                        router.push(`/clients?highlight=${n.client_id}`);
                      }
                    }}
                    className={`flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted ${
                      !n.read ? "bg-primary/5" : ""
                    } ${n.client_id ? "cursor-pointer" : ""}`}
                  >
                    <div className="mt-1 shrink-0">
                      {!n.read ? (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-primary" />
                      ) : (
                        <Check className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-snug ${
                          !n.read
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground"
                        }`}
                      >
                        {title}
                      </p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
