"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  UserPlus,
  Target,
  DollarSign,
  Loader2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { ORGANIZATION_TYPE_CONFIG } from "@/lib/constants";
import { toast } from "sonner";
import type { Organization, OrganizationType } from "@/types";

// ── Types ──

interface StudioRow {
  id: string;
  name: string;
  type: OrganizationType;
  status: string;
  totalClients: number;
  leadsMonth: number;
  activeCampaigns: number;
  spendMonth: number;
  leadsFromCampaigns: number;
  cpa: number | null;
}

interface ChartPoint {
  giorno: string;
  lead: number;
}

interface AlertItem {
  orgId: string;
  orgName: string;
  message: string;
}

const MONTH_NAMES = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

// ── Page ──

export default function AdminDashboardPage() {
  const {
    isAdmin,
    isSuperAdmin,
    canImpersonate,
    startImpersonate,
    loading: orgLoading,
  } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);
  const [leadsMonth, setLeadsMonth] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [spendMonth, setSpendMonth] = useState(0);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const now = new Date();

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    // ── KPI queries (all orgs, parallel) ──
    const [
      clientsRes,
      leadsRes,
      campaignsRes,
      orgsRes,
      chartClientsRes,
    ] = await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "attiva"),
      supabase
        .from("organizations")
        .select("*")
        .neq("type", "agency")
        .order("name"),
      supabase
        .from("clients")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    setTotalClients(clientsRes.count ?? 0);
    setLeadsMonth(leadsRes.count ?? 0);
    setActiveCampaigns(campaignsRes.count ?? 0);

    // ── Chart data (last 30 days) ──
    const chartMap = new Map<string, number>();
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      chartMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of chartClientsRes.data ?? []) {
      const key = (row as { created_at: string }).created_at.slice(0, 10);
      chartMap.set(key, (chartMap.get(key) ?? 0) + 1);
    }
    const points: ChartPoint[] = [];
    for (const [dateStr, count] of chartMap) {
      const d = new Date(dateStr);
      points.push({
        giorno: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
        lead: count,
      });
    }
    setChartData(points);

    // ── Per-studio stats ──
    const allOrgs = (orgsRes.data ?? []) as Organization[];
    let totalSpend = 0;
    const alertList: AlertItem[] = [];

    const studioRows = await Promise.all(
      allOrgs.map(async (org) => {
        const [orgClientsRes, orgLeadsRes, orgCampaignsRes] =
          await Promise.all([
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
              .select("id")
              .eq("organization_id", org.id)
              .eq("status", "attiva"),
          ]);

        // Campaign metrics for this org's active campaigns
        const campaignIds = (orgCampaignsRes.data ?? []).map(
          (c: { id: string }) => c.id
        );

        let orgSpend = 0;
        let orgCampaignLeads = 0;

        if (campaignIds.length > 0) {
          const { data: metricsData } = await supabase
            .from("campaign_metrics")
            .select("spend, leads")
            .in("campaign_id", campaignIds)
            .gte("date", startOfMonth);

          for (const m of metricsData ?? []) {
            orgSpend += Number(m.spend) || 0;
            orgCampaignLeads += Number(m.leads) || 0;
          }
        }

        totalSpend += orgSpend;

        const cpa =
          orgCampaignLeads > 0
            ? Math.round((orgSpend / orgCampaignLeads) * 100) / 100
            : null;

        // Alerts
        if (cpa !== null && cpa > 15) {
          alertList.push({
            orgId: org.id,
            orgName: org.name,
            message: `CPA alto: €${cpa.toFixed(2)}`,
          });
        }

        // Check for no leads in 7 days
        const { count: recentLeadCount } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("created_at", sevenDaysAgo.toISOString());

        if ((recentLeadCount ?? 0) === 0 && (orgClientsRes.count ?? 0) > 0) {
          alertList.push({
            orgId: org.id,
            orgName: org.name,
            message: "Nessun lead da 7+ giorni",
          });
        }

        return {
          id: org.id,
          name: org.name,
          type: org.type as OrganizationType,
          status: org.status,
          totalClients: orgClientsRes.count ?? 0,
          leadsMonth: orgLeadsRes.count ?? 0,
          activeCampaigns: campaignIds.length,
          spendMonth: orgSpend,
          leadsFromCampaigns: orgCampaignLeads,
          cpa,
        } satisfies StudioRow;
      })
    );

    // Sort by leads this month descending
    studioRows.sort((a, b) => b.leadsMonth - a.leadsMonth);

    setStudios(studioRows);
    setSpendMonth(totalSpend);
    setAlerts(alertList);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (orgLoading) return;
    fetchAll();
  }, [orgLoading, fetchAll]);

  async function handleImpersonate(orgId: string, orgName: string) {
    setImpersonatingId(orgId);
    toast.success(`Visualizzando come ${orgName}`);
    await startImpersonate(orgId);
  }

  // ── Guards ──
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        Accesso non autorizzato.
      </div>
    );
  }

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
          Dashboard Aggregata
        </h1>
        <p className="text-muted-foreground">
          Vista globale di tutti gli studi.
        </p>
      </div>

      {/* ══ SEZIONE 1 — KPI Cards ══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Clienti Totali"
          value={totalClients}
          icon={<Users className="h-5 w-5 text-primary" />}
          bg="bg-blue-50 dark:bg-blue-950/50"
        />
        <KpiCard
          label="Lead Questo Mese"
          value={leadsMonth}
          icon={<UserPlus className="h-5 w-5 text-[#10B981]" />}
          bg="bg-green-50 dark:bg-green-950/50"
        />
        <KpiCard
          label="Campagne Attive"
          value={activeCampaigns}
          icon={<Target className="h-5 w-5 text-[#F59E0B]" />}
          bg="bg-amber-50 dark:bg-amber-950/50"
        />
        <KpiCard
          label="Spesa Mese"
          value={`€${spendMonth.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5 text-[#8B5CF6]" />}
          bg="bg-purple-50 dark:bg-purple-950/50"
          isText
        />
      </div>

      {/* ══ SEZIONE 2 — Performance per Studio ══ */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Performance per Studio
          </CardTitle>
        </CardHeader>
        <CardContent>
          {studios.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nessuno studio registrato.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Studio
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Clienti
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Lead Mese
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-muted-foreground md:table-cell">
                      Campagne
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-muted-foreground md:table-cell">
                      Spesa Mese
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium text-muted-foreground lg:table-cell">
                      CPA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studios.map((s) => {
                    const typeCfg =
                      ORGANIZATION_TYPE_CONFIG[s.type];

                    return (
                      <tr
                        key={s.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {canImpersonate && s.status === "active" ? (
                              <button
                                className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                                disabled={impersonatingId === s.id}
                                onClick={() =>
                                  handleImpersonate(s.id, s.name)
                                }
                              >
                                <Eye className="h-3.5 w-3.5 shrink-0" />
                                {s.name}
                              </button>
                            ) : (
                              <span className="font-medium text-foreground">
                                {s.name}
                              </span>
                            )}
                            {typeCfg && (
                              <span
                                className={`hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${typeCfg.color}`}
                              >
                                {typeCfg.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                          {s.totalClients}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                          {s.leadsMonth}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground md:table-cell">
                          {s.activeCampaigns}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground md:table-cell">
                          €{s.spendMonth.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right lg:table-cell">
                          <CpaBadge cpa={s.cpa} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ SEZIONE 3 — Grafico Lead ultimi 30 giorni ══ */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Lead Generati
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ultimi 30 giorni — tutti gli studi
          </p>
        </CardHeader>
        <CardContent>
          {chartData.every((d) => d.lead === 0) ? (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <UserPlus className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2">Nessun lead negli ultimi 30 giorni</p>
              </div>
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="giorno"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      backgroundColor: "var(--card)",
                      color: "var(--foreground)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="lead"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: "var(--primary)", r: 3 }}
                    activeDot={{ r: 5, fill: "var(--primary)" }}
                    name="Lead"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ SEZIONE 4 — Alert ══ */}
      {alerts.length > 0 && (
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Studi che Richiedono Attenzione ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={`${alert.orgId}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {alert.orgName}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {alert.message}
                    </p>
                  </div>
                  {canImpersonate && (
                    <button
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        handleImpersonate(alert.orgId, alert.orgName)
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Visualizza
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ──

function KpiCard({
  label,
  value,
  icon,
  bg,
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  bg: string;
  isText?: boolean;
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
        <div
          className={`font-bold leading-tight text-foreground ${isText ? "text-2xl" : "text-[32px]"}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function CpaBadge({ cpa }: { cpa: number | null }) {
  if (cpa === null) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  let color: string;
  let label: string;

  if (cpa < 10) {
    color =
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    label = "Ottimo";
  } else if (cpa <= 15) {
    color =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    label = "Buono";
  } else {
    color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    label = "Alto";
  }

  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="tabular-nums text-foreground">
        €{cpa.toFixed(2)}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}
      >
        {label}
      </span>
    </span>
  );
}
