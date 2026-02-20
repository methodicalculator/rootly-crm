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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, UserCheck, Clock, Mail, Phone, Briefcase, Plus, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { OrganizationFormDialog } from "@/components/admin/organization-form-dialog";
import type { OrganizationFormValues } from "@/lib/validations";
import type { UserProfile, Organization } from "@/types";

type OrgOption = Pick<Organization, "id" | "name" | "owner_name">;

/** Map registration professional_type → organization type */
const PROF_TYPE_TO_ORG_TYPE: Record<string, OrganizationFormValues["type"]> = {
  fisioterapista: "fisioterapia",
  osteopata: "osteopatia",
  olistico: "olistico",
  estetica: "estetica",
  altro: "altro",
};

export default function ApprovazioniPage() {
  const { isSuperAdmin, isAdmin } = useOrganization();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state for "Approva e Crea Studio"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPrefill, setDialogPrefill] = useState<Partial<OrganizationFormValues> | null>(null);
  const [creatingForUserId, setCreatingForUserId] = useState<string | null>(null);

  const loadPendingUsers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .is("organization_id", null)
      .not("role", "in", "(admin,super_admin,staff)")
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

  async function approveUser(
    userId: string,
    opts: { role: "owner" | "staff"; organizationId?: string; staffOrgIds?: string[] }
  ) {
    console.log("[APPROVAZIONI] approveUser called:", { userId, ...opts });

    const res = await fetch("/api/admin/approve-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        role: opts.role,
        organizationId: opts.organizationId,
        staffOrgIds: opts.staffOrgIds,
      }),
    });

    const resBody = await res.json().catch(() => ({}));
    console.log("[APPROVAZIONI] API response:", res.status, resBody);

    if (!res.ok) {
      toast.error(resBody.error || "Errore durante l'approvazione");
      return;
    }

    toast.success(
      opts.role === "staff"
        ? `Utente approvato come staff! (${resBody.staffOrgsInserted ?? 0} studi assegnati)`
        : "Utente approvato e assegnato allo studio!"
    );
    loadPendingUsers();
  }

  async function rejectUser(userId: string) {
    const res = await fetch("/api/admin/reject-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Errore durante il rifiuto");
      return;
    }

    toast.error("Utente rifiutato ed eliminato");
    loadPendingUsers();
  }

  function openCreateStudioDialog(user: UserProfile) {
    setCreatingForUserId(user.id);
    setDialogPrefill({
      name: user.full_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      type: PROF_TYPE_TO_ORG_TYPE[user.professional_type ?? ""] ?? "altro",
    });
    setDialogOpen(true);
  }

  async function handleOrgCreated(createdOrgId?: string) {
    if (createdOrgId && creatingForUserId) {
      await approveUser(creatingForUserId, {
        role: "owner",
        organizationId: createdOrgId,
      });
      toast.success("Studio creato e utente approvato!");
      loadOrganizations();
    }
    setCreatingForUserId(null);
    setDialogPrefill(null);
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
              onApprove={(userId, opts) => approveUser(userId, opts)}
              onCreateStudio={() => openCreateStudioDialog(user)}
              onReject={rejectUser}
            />
          ))}
        </div>
      )}

      <OrganizationFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) {
            setCreatingForUserId(null);
            setDialogPrefill(null);
          }
        }}
        onSuccess={handleOrgCreated}
        prefillData={dialogPrefill}
      />
    </div>
  );
}

function PendingUserCard({
  user,
  organizations,
  onApprove,
  onCreateStudio,
  onReject,
}: {
  user: UserProfile;
  organizations: OrgOption[];
  onApprove: (
    userId: string,
    opts: { role: "owner" | "staff"; organizationId?: string; staffOrgIds?: string[] }
  ) => Promise<void>;
  onCreateStudio: () => void;
  onReject: (userId: string) => Promise<void>;
}) {
  const [selectedRole, setSelectedRole] = useState<"owner" | "staff">("owner");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedStaffOrgs, setSelectedStaffOrgs] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  function toggleStaffOrg(orgId: string) {
    setSelectedStaffOrgs((prev) =>
      prev.includes(orgId)
        ? prev.filter((id) => id !== orgId)
        : [...prev, orgId]
    );
  }

  const canApprove =
    selectedRole === "owner"
      ? !!selectedOrg
      : selectedStaffOrgs.length > 0;

  async function handleApprove() {
    if (!canApprove) return;
    setApproving(true);
    try {
      if (selectedRole === "owner") {
        await onApprove(user.id, { role: "owner", organizationId: selectedOrg });
      } else {
        await onApprove(user.id, { role: "staff", staffOrgIds: selectedStaffOrgs });
      }
    } finally {
      setApproving(false);
    }
  }

  async function handleConfirmReject() {
    setRejecting(true);
    try {
      await onReject(user.id);
      setRejectDialogOpen(false);
    } finally {
      setRejecting(false);
    }
  }

  return (
    <>
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {user.full_name || "Nome non fornito"}
              </CardTitle>
              {user.email && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {user.email}
                </p>
              )}
              {user.phone && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {user.phone}
                </p>
              )}
              {user.professional_type && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="capitalize">{user.professional_type}</span>
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
          {/* Role selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">Ruolo:</label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as "owner" | "staff")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Titolare</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Org assignment — single select for owner, checkboxes for staff */}
          {selectedRole === "owner" ? (
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
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium">
                Assegna agli studi:
              </label>
              {organizations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nessuno studio disponibile.
                </p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {organizations.map((org) => (
                    <div key={org.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`staff-org-${user.id}-${org.id}`}
                        checked={selectedStaffOrgs.includes(org.id)}
                        onCheckedChange={() => toggleStaffOrg(org.id)}
                      />
                      <Label
                        htmlFor={`staff-org-${user.id}-${org.id}`}
                        className="text-sm font-normal"
                      >
                        {org.name}
                        {org.owner_name ? ` — ${org.owner_name}` : ""}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleApprove}
              disabled={!canApprove || approving}
              className="flex-1"
            >
              {approving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="mr-2 h-4 w-4" />
              )}
              {selectedRole === "staff" ? "Approva come Staff" : "Approva e Assegna"}
            </Button>
            {selectedRole === "owner" && (
              <Button
                onClick={onCreateStudio}
                className="flex-1 bg-[#97BC0D] text-white hover:bg-[#87ab00]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Approva e Crea Studio
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              className="flex-1"
            >
              <UserX className="mr-2 h-4 w-4" />
              Rifiuta
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conferma rifiuto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler rifiutare la richiesta di{" "}
            <strong className="text-foreground">
              {user.full_name || user.email}
            </strong>
            ? L&apos;account verrà eliminato definitivamente.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={rejecting}
              onClick={handleConfirmReject}
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma Rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
