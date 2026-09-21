"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Users,
  UserPlus,
  Loader2,
  Eye,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Plus,
  Pencil,
  X,
  UserCog,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOrganizations } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import {
  ORGANIZATION_STATUS_CONFIG,
  ORGANIZATION_TYPE_CONFIG,
} from "@/lib/constants";
import { CLIENT_STAGES } from "@/lib/constants/stages";
import { startOfMonthRomeISO } from "@/lib/date-utils";
import { OrganizationFormDialog } from "@/components/admin/organization-form-dialog";
import { toast } from "sonner";
import type { Organization, OrganizationType, OrganizationStatus } from "@/types";

interface StaffMember {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface OrgWithStats extends Organization {
  clientCount: number;
  leadsMonth: number;
  assignedStaff: StaffMember[];
}

const STATUS_TABS = [
  { key: "all", label: "Tutti" },
  { key: "active", label: "Attivi" },
  { key: "pending", label: "In Attesa" },
  { key: "suspended", label: "Sospesi" },
  { key: "archived", label: "Archiviati" },
] as const;

export default function GestioneStudiPage() {
  const router = useRouter();
  const {
    canImpersonate,
    startImpersonate,
    accessLevel,
    role,
    isAdmin,
    isSuperAdmin,
    userId,
    organizationId,
    loading: orgLoading,
  } = useOrganization();

  const [orgs, setOrgs] = useState<OrgWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  // Staff assignment state
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [staffDialogOrgId, setStaffDialogOrgId] = useState<string | null>(null);
  const [allStaffUsers, setAllStaffUsers] = useState<StaffMember[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);

  const fetchOrgs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    // Derive accessLevel from admin flags / role when the DB column is null
    const effectiveAccessLevel =
      accessLevel ??
      (isSuperAdmin ? "super_admin" : isAdmin ? "admin" : role === "staff" ? "staff" : null);

    const { data } = await getOrganizations({
      accessLevel: effectiveAccessLevel,
      userId,
      organizationId,
    });

    const allOrgs = (data ?? []) as Organization[];

    if (allOrgs.length === 0) {
      setOrgs([]);
      setLoading(false);
      return;
    }

    // Fetch stats for each org in parallel
    const supabase = createClient();
    const startOfMonth = startOfMonthRomeISO();

    const withStats = await Promise.all(
      allOrgs.map(async (org) => {
        const [clientsRes, leadsRes, staffOrgRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .is("archived_at", null)
            .in("sales_stage", CLIENT_STAGES),
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .is("archived_at", null)
            .gte("created_at", startOfMonth),
          supabase
            .from("staff_organizations")
            .select("user_id")
            .eq("organization_id", org.id),
        ]);

        // Fetch profiles separately (avoids embedded-select / RLS issues)
        const staffUserIds = (staffOrgRes.data ?? []).map(
          (r: { user_id: string }) => r.user_id
        );

        let assignedStaff: StaffMember[] = [];
        if (staffUserIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", staffUserIds);

          const profileMap = new Map(
            (profilesData ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p])
          );

          assignedStaff = staffUserIds.map((uid) => {
            const p = profileMap.get(uid);
            return {
              id: uid,
              full_name: p?.full_name ?? null,
              email: p?.email ?? null,
            };
          });
        }

        return {
          ...org,
          clientCount: clientsRes.count ?? 0,
          leadsMonth: leadsRes.count ?? 0,
          assignedStaff,
        };
      })
    );

    setOrgs(withStats);
    setLoading(false);
  }, [accessLevel, role, isAdmin, isSuperAdmin, userId, organizationId]);

  useEffect(() => {
    if (orgLoading) return;
    fetchOrgs();
  }, [orgLoading, fetchOrgs]);

  async function handleImpersonate(orgId: string) {
    setImpersonatingId(orgId);
    await startImpersonate(orgId);
  }

  async function openStaffDialog(orgId: string, currentStaff: StaffMember[]) {
    setStaffDialogOrgId(orgId);
    setSelectedStaffIds([]);
    setStaffDialogOpen(true);

    // Fetch all staff users not already assigned to this org
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .eq("role", "staff");

    const currentIds = new Set(currentStaff.map((s) => s.id));
    setAllStaffUsers(
      ((data ?? []) as StaffMember[]).filter((u) => !currentIds.has(u.id))
    );
  }

  async function handleAssignStaff() {
    if (!staffDialogOrgId || selectedStaffIds.length === 0) return;
    setStaffSaving(true);
    try {
      const supabase = createClient();
      const rows = selectedStaffIds.map((uid) => ({
        user_id: uid,
        organization_id: staffDialogOrgId,
      }));
      const { error } = await supabase.from("staff_organizations").upsert(rows, { onConflict: "user_id,organization_id", ignoreDuplicates: true });
      if (error) {
        toast.error("Errore nell'assegnazione: " + error.message);
        return;
      }
      toast.success("Staff assegnato con successo!");
      setStaffDialogOpen(false);
      fetchOrgs();
    } finally {
      setStaffSaving(false);
    }
  }

  async function handleRemoveStaff(orgId: string, staffUserId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("staff_organizations")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", staffUserId);

    if (error) {
      toast.error("Errore nella rimozione: " + error.message);
      return;
    }
    toast.success("Staff rimosso dallo studio.");
    fetchOrgs();
  }

  const filtered =
    activeTab === "all"
      ? orgs.filter((o) => o.status !== "archived")
      : orgs.filter((o) => o.status === activeTab);

  // Summary counts
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.status === "active").length;
  const pendingOrgs = orgs.filter((o) => o.status === "pending").length;

  if (loading || orgLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Gestione Studi
          </h1>
          <p className="text-muted-foreground">
            Visualizza e gestisci gli studi clienti della piattaforma.
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/80"
          onClick={() => {
            setEditingOrg(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Studio
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniKpi
          icon={<Building2 className="h-5 w-5 text-primary" />}
          label="Studi Totali"
          value={totalOrgs}
          bg="bg-blue-50 dark:bg-blue-950/50"
        />
        <MiniKpi
          icon={<Building2 className="h-5 w-5 text-[#10B981]" />}
          label="Studi Attivi"
          value={activeOrgs}
          bg="bg-green-50 dark:bg-green-950/50"
        />
        <MiniKpi
          icon={<Building2 className="h-5 w-5 text-[#F59E0B]" />}
          label="In Attesa"
          value={pendingOrgs}
          bg="bg-amber-50 dark:bg-amber-950/50"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Organizations list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Nessuno studio trovato
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "all"
              ? "Non ci sono studi registrati."
              : "Non ci sono studi con questo filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((org) => {
            const statusCfg =
              ORGANIZATION_STATUS_CONFIG[org.status as OrganizationStatus];
            const typeCfg =
              ORGANIZATION_TYPE_CONFIG[org.type as OrganizationType];
            const isImpersonating = impersonatingId === org.id;

            return (
              <Card
                key={org.id}
                className="overflow-hidden bg-card shadow-sm"
              >
                <CardContent className="p-0">
                  <div className="p-4 md:p-5">
                    {/* Top row: name, type, status, action */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {org.name}
                          </h3>
                          {typeCfg && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeCfg.color}`}
                            >
                              {typeCfg.label}
                            </span>
                          )}
                          {statusCfg && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}
                            >
                              {statusCfg.label}
                            </span>
                          )}
                          {!org.meta_page_id && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Page ID mancante
                            </span>
                          )}
                        </div>

                        {/* Contact details */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {org.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {org.email}
                            </span>
                          )}
                          {org.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {org.phone}
                            </span>
                          )}
                          {org.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {org.city}
                              {org.province ? ` (${org.province})` : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons — desktop: inline row */}
                      <div className="hidden shrink-0 gap-2 md:flex">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingOrg(org);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-1.5 h-4 w-4" />
                          Modifica
                        </Button>
                        {org.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/staff/studio/${org.id}`
                              )
                            }
                          >
                            <Eye className="mr-1.5 h-4 w-4" />
                            Visualizza
                          </Button>
                        )}
                        {canImpersonate && org.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary text-primary hover:bg-primary/10"
                            disabled={isImpersonating}
                            onClick={() => handleImpersonate(org.id)}
                          >
                            {isImpersonating ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="mr-1.5 h-4 w-4" />
                            )}
                            Entra come Supporto
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons — mobile: 2-col grid + full-width impersonate */}
                    <div className="mt-3 grid grid-cols-2 gap-3 md:hidden">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setEditingOrg(org);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Modifica
                      </Button>
                      {org.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            router.push(`/staff/studio/${org.id}`)
                          }
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          Visualizza
                        </Button>
                      ) : (
                        <div />
                      )}
                      {canImpersonate && org.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="col-span-2 w-full border-primary text-primary hover:bg-primary/10"
                          disabled={isImpersonating}
                          onClick={() => handleImpersonate(org.id)}
                        >
                          {isImpersonating ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="mr-1.5 h-4 w-4" />
                          )}
                          Entra come Supporto
                        </Button>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      <StatBox
                        icon={<UserPlus className="h-4 w-4 text-[#10B981]" />}
                        label="Lead Mese"
                        value={org.leadsMonth}
                      />
                      <StatBox
                        icon={<Users className="h-4 w-4 text-primary" />}
                        label="Clienti"
                        value={org.clientCount}
                      />
                      {org.monthly_budget != null && (
                        <StatBox
                          icon={
                            <span className="text-sm font-bold text-[#8B5CF6]">
                              &euro;
                            </span>
                          }
                          label="Budget"
                          value={`€${Number(org.monthly_budget).toLocaleString("it-IT", { minimumFractionDigits: 0 })}/mese`}
                          isText
                        />
                      )}
                      {org.contract_end_date && (
                        <StatBox
                          icon={
                            <CalendarDays className="h-4 w-4 text-[#EF4444]" />
                          }
                          label="Scadenza Contratto"
                          value={new Date(
                            org.contract_end_date
                          ).toLocaleDateString("it-IT")}
                          isText
                        />
                      )}
                    </div>

                    {/* Staff Assegnato */}
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                          <UserCog className="h-4 w-4" />
                          Staff Assegnato ({org.assignedStaff.length})
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStaffDialog(org.id, org.assignedStaff)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Assegna Staff
                        </Button>
                      </div>
                      {org.assignedStaff.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          Nessuno staff assegnato a questo studio.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {org.assignedStaff.map((staff) => (
                            <span
                              key={staff.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                            >
                              {staff.full_name || staff.email || "Utente"}
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => handleRemoveStaff(org.id, staff.id)}
                                title="Rimuovi staff"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <OrganizationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchOrgs}
        editingOrg={editingOrg}
      />

      {/* Staff assignment dialog */}
      <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assegna Staff</DialogTitle>
          </DialogHeader>
          {allStaffUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nessun utente staff disponibile da assegnare.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {allStaffUsers.map((staff) => (
                <div key={staff.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`assign-staff-${staff.id}`}
                    checked={selectedStaffIds.includes(staff.id)}
                    onCheckedChange={() =>
                      setSelectedStaffIds((prev) =>
                        prev.includes(staff.id)
                          ? prev.filter((id) => id !== staff.id)
                          : [...prev, staff.id]
                      )
                    }
                  />
                  <Label
                    htmlFor={`assign-staff-${staff.id}`}
                    className="text-sm font-normal"
                  >
                    {staff.full_name || "Nome non fornito"}
                    {staff.email ? ` (${staff.email})` : ""}
                  </Label>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setStaffDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              disabled={selectedStaffIds.length === 0 || staffSaving}
              onClick={handleAssignStaff}
            >
              {staffSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assegna ({selectedStaffIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function MiniKpi({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <Card className="bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className={`rounded-lg p-2 ${bg}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-[28px] font-bold leading-tight text-foreground">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon,
  label,
  value,
  isText = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`font-semibold text-foreground ${isText ? "text-xs" : "text-sm"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
