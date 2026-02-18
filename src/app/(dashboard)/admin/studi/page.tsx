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
  Building2,
  Users,
  UserPlus,
  Target,
  Loader2,
  Eye,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Plus,
  Pencil,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOrganizations } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import {
  ORGANIZATION_STATUS_CONFIG,
  ORGANIZATION_TYPE_CONFIG,
} from "@/lib/constants";
import { OrganizationFormDialog } from "@/components/admin/organization-form-dialog";
import type { Organization, OrganizationType, OrganizationStatus } from "@/types";

interface OrgWithStats extends Organization {
  clientCount: number;
  leadsMonth: number;
  activeCampaigns: number;
}

const STATUS_TABS = [
  { key: "all", label: "Tutti" },
  { key: "active", label: "Attivi" },
  { key: "pending", label: "In Attesa" },
  { key: "suspended", label: "Sospesi" },
] as const;

export default function GestioneStudiPage() {
  const {
    canImpersonate,
    startImpersonate,
    accessLevel,
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

  const fetchOrgs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    // Derive accessLevel from admin flags when the DB column is null
    const effectiveAccessLevel =
      accessLevel ??
      (isSuperAdmin ? "super_admin" : isAdmin ? "admin" : null);

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
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString();

    const withStats = await Promise.all(
      allOrgs.map(async (org) => {
        const [clientsRes, leadsRes, campaignsRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id),
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .gte("created_at", startOfMonth),
          supabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("status", "attiva"),
        ]);

        return {
          ...org,
          clientCount: clientsRes.count ?? 0,
          leadsMonth: leadsRes.count ?? 0,
          activeCampaigns: campaignsRes.count ?? 0,
        };
      })
    );

    setOrgs(withStats);
    setLoading(false);
  }, [accessLevel, isAdmin, isSuperAdmin, userId, organizationId]);

  useEffect(() => {
    if (orgLoading) return;
    fetchOrgs();
  }, [orgLoading, fetchOrgs]);

  async function handleImpersonate(orgId: string) {
    setImpersonatingId(orgId);
    await startImpersonate(orgId);
  }

  const filtered =
    activeTab === "all"
      ? orgs
      : orgs.filter((o) => o.status === activeTab);

  // Summary counts
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.status === "active").length;
  const pendingOrgs = orgs.filter((o) => o.status === "pending").length;
  const totalClients = orgs.reduce((s, o) => s + o.clientCount, 0);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <MiniKpi
          icon={<Users className="h-5 w-5 text-[#8B5CF6]" />}
          label="Clienti Totali"
          value={totalClients}
          bg="bg-purple-50 dark:bg-purple-950/50"
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
                          {!org.meta_ad_account_id && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Ad Account mancante
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

                      {/* Action buttons */}
                      <div className="flex shrink-0 gap-2">
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

                    {/* Stats row */}
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                      <StatBox
                        icon={<Users className="h-4 w-4 text-primary" />}
                        label="Clienti"
                        value={org.clientCount}
                      />
                      <StatBox
                        icon={<UserPlus className="h-4 w-4 text-[#10B981]" />}
                        label="Lead Mese"
                        value={org.leadsMonth}
                      />
                      <StatBox
                        icon={<Target className="h-4 w-4 text-[#F59E0B]" />}
                        label="Campagne"
                        value={org.activeCampaigns}
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
                          label="Scadenza"
                          value={new Date(
                            org.contract_end_date
                          ).toLocaleDateString("it-IT")}
                          isText
                        />
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
