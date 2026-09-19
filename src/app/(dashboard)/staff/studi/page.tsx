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
  Building2,
  Users,
  UserPlus,
  Loader2,
  Eye,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
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
import type { Organization, OrganizationType, OrganizationStatus } from "@/types";

interface OrgWithStats extends Organization {
  clientCount: number;
  leadsMonth: number;
}

export default function StaffStudiPage() {
  const router = useRouter();
  const {
    userId,
    organizationId,
    loading: orgLoading,
  } = useOrganization();

  const [orgs, setOrgs] = useState<OrgWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await getOrganizations({
      accessLevel: "staff",
      userId,
      organizationId,
    });

    const allOrgs = (data ?? []) as Organization[];

    if (allOrgs.length === 0) {
      setOrgs([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const startOfMonth = startOfMonthRomeISO();

    const withStats = await Promise.all(
      allOrgs.map(async (org) => {
        const [clientsRes, leadsRes] = await Promise.all([
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
        ]);

        return {
          ...org,
          clientCount: clientsRes.count ?? 0,
          leadsMonth: leadsRes.count ?? 0,
        };
      })
    );

    setOrgs(withStats);
    setLoading(false);
  }, [userId, organizationId]);

  useEffect(() => {
    if (orgLoading) return;
    fetchOrgs();
  }, [orgLoading, fetchOrgs]);

  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.status === "active").length;

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          I Tuoi Studi
        </h1>
        <p className="text-muted-foreground">
          Studi a te assegnati.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniKpi
          icon={<Building2 className="h-5 w-5 text-primary" />}
          label="Studi Assegnati"
          value={totalOrgs}
          bg="bg-blue-50 dark:bg-blue-950/50"
        />
        <MiniKpi
          icon={<Building2 className="h-5 w-5 text-[#10B981]" />}
          label="Studi Attivi"
          value={activeOrgs}
          bg="bg-green-50 dark:bg-green-950/50"
        />
      </div>

      {/* Organizations list */}
      {orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Nessuno studio assegnato
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Non hai ancora studi assegnati. Contatta un amministratore.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => {
            const statusCfg =
              ORGANIZATION_STATUS_CONFIG[org.status as OrganizationStatus];
            const typeCfg =
              ORGANIZATION_TYPE_CONFIG[org.type as OrganizationType];

            return (
              <Card
                key={org.id}
                className="overflow-hidden bg-card shadow-sm"
              >
                <CardContent className="p-0">
                  <div className="p-4 md:p-5">
                    {/* Top row */}
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
                        </div>

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

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/staff/studio/${org.id}`)
                        }
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        Visualizza
                      </Button>
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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
