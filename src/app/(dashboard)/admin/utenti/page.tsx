"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

interface UserRowRaw {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  organization_id: string | null;
  organizations: { name: string }[] | { name: string } | null;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  organization_id: string | null;
  org_name: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  owner: "Titolare",
};

export default function GestioneUtentiPage() {
  const { isAdmin, isSuperAdmin, userId: currentUserId } = useOrganization();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role, organization_id, organizations(name)")
      .order("created_at", { ascending: false });

    const rows: UserRow[] = ((data ?? []) as UserRowRaw[]).map((u) => {
      const org = u.organizations;
      const orgName = Array.isArray(org) ? (org[0]?.name ?? null) : (org?.name ?? null);
      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        organization_id: u.organization_id,
        org_name: orgName,
      };
    });
    setUsers(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(body.error || "Errore durante l'aggiornamento del ruolo");
        return;
      }

      toast.success("Ruolo aggiornato con successo");
      loadUsers();
    } finally {
      setUpdatingId(null);
    }
  }

  function getStatusBadge(user: UserRow) {
    const isPrivileged = user.role === "admin" || user.role === "super_admin" || user.role === "staff";
    const isApproved = isPrivileged || !!user.organization_id;

    if (isApproved) {
      return (
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          Approvato
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        In attesa
      </Badge>
    );
  }

  function getRoleOptions(): string[] {
    if (isSuperAdmin) return ["admin", "staff", "owner"];
    return ["staff", "owner"];
  }

  function isDropdownDisabled(user: UserRow): boolean {
    if (user.id === currentUserId) return true;
    if (user.role === "super_admin") return true;
    if (updatingId === user.id) return true;
    return false;
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        Accesso non autorizzato.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Gestione Utenti
        </h1>
        <p className="text-muted-foreground">
          Visualizza e modifica i ruoli degli utenti ({users.length})
        </p>
      </div>

      {users.length === 0 ? (
        <Card className="bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <UserCog className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Nessun utente trovato
            </h3>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ruolo attuale</TableHead>
                  <TableHead>Organizzazione</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell>{user.full_name ?? "—"}</TableCell>
                    <TableCell>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </TableCell>
                    <TableCell>
                      {user.org_name ?? "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>
                      {isDropdownDisabled(user) && user.role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="relative">
                          <Select
                            value={user.role}
                            onValueChange={(v) => handleRoleChange(user.id, v)}
                            disabled={isDropdownDisabled(user)}
                          >
                            <SelectTrigger className="w-[140px]">
                              {updatingId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {getRoleOptions().map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
