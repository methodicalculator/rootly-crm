"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserCheck, Clock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { UserProfile, Organization } from "@/types";

type OrgOption = Pick<Organization, "id" | "name" | "owner_name">;

export default function ApprovazioniPage() {
  const { isSuperAdmin, isAdmin } = useOrganization();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPendingUsers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .is("organization_id", null)
      .eq("is_admin", false)
      .eq("is_super_admin", false)
      .order("created_at", { ascending: false });

    setPendingUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }, []);

  const loadOrganizations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("organizations")
      .select("id, name, owner_name")
      .eq("status", "active")
      .order("name");

    setOrganizations((data ?? []) as OrgOption[]);
  }, []);

  useEffect(() => {
    loadPendingUsers();
    loadOrganizations();
  }, [loadPendingUsers, loadOrganizations]);

  async function approveUser(userId: string, organizationId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ organization_id: organizationId })
      .eq("id", userId);

    if (error) {
      toast.error("Errore durante l'approvazione");
      return;
    }

    toast.success("Utente approvato e assegnato allo studio!");
    loadPendingUsers();
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
          Approvazioni Utenti
        </h1>
        <p className="text-muted-foreground">
          Gestisci le richieste di accesso in attesa ({pendingUsers.length})
        </p>
      </div>

      {pendingUsers.length === 0 ? (
        <Card className="bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/30">
              <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Nessuna richiesta in attesa
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tutte le richieste di accesso sono state processate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <PendingUserCard
              key={user.id}
              user={user}
              organizations={organizations}
              onApprove={approveUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingUserCard({
  user,
  organizations,
  onApprove,
}: {
  user: UserProfile;
  organizations: OrgOption[];
  onApprove: (userId: string, organizationId: string) => Promise<void>;
}) {
  const [selectedOrg, setSelectedOrg] = useState("");
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    if (!selectedOrg) return;
    setApproving(true);
    try {
      await onApprove(user.id, selectedOrg);
    } finally {
      setApproving(false);
    }
  }

  return (
    <Card className="bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {user.full_name || "Nome non fornito"}
            </CardTitle>
            {user.email && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </p>
            )}
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(user.created_at), {
              addSuffix: true,
              locale: it,
            })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Assegna a studio:
          </label>
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona studio..." />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                  {org.owner_name ? ` — ${org.owner_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleApprove}
          disabled={!selectedOrg || approving}
          className="w-full"
        >
          {approving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="mr-2 h-4 w-4" />
          )}
          Approva e Assegna
        </Button>
      </CardContent>
    </Card>
  );
}
