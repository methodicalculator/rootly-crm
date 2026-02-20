"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { getCampaigns, getClients } from "@/lib/supabase/queries";
import { CAMPAIGN_STATUS_CONFIG } from "@/lib/constants";
import { CampaignFormDialog } from "@/components/campaigns/campaign-form-dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { toRomeDateStr } from "@/lib/date-utils";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { Campaign, CampaignMetrics, Client } from "@/types";

// ── Tabs ──────────────────────────────────────────────────────────
const tabs = [
  { key: "tutte", label: "Tutte" },
  { key: "attiva", label: "Attive" },
  { key: "completata", label: "Completate" },
  { key: "in_pausa", label: "In Pausa" },
] as const;

// ── Types ─────────────────────────────────────────────────────────
interface AggregateMetrics {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  avgCtr: number;
}

type SortColumn =
  | "date"
  | "impressions"
  | "clicks"
  | "spend"
  | "leads"
  | "cpa"
  | "ctr"
  | "cpm";

// ── Helpers ───────────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("it-IT");
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Page Component ────────────────────────────────────────────────
export default function CampaignsPage() {
  const { effectiveOrgId, isAdmin, staffOrgIds, loading: orgLoading } = useOrganization();

  const [activeTab, setActiveTab] = useState<string>("tutte");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [metricsMap, setMetricsMap] = useState<Map<string, CampaignMetrics[]>>(
    new Map()
  );
  const [aggregateMap, setAggregateMap] = useState<
    Map<string, AggregateMetrics>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 29), to: new Date() });

  // ── Data fetching ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Campaigns
    const { data: campaignsData } = await getCampaigns(
      effectiveOrgId,
      isAdmin,
      undefined,
      staffOrgIds
    );
    const allCampaigns = (campaignsData ?? []) as Campaign[];
    setCampaigns(allCampaigns);

    // Fetch clients for lead counting
    const { data: clientsData } = await getClients(effectiveOrgId, isAdmin, undefined, staffOrgIds);
    setClients((clientsData ?? []) as Client[]);

    if (allCampaigns.length === 0) {
      setMetricsMap(new Map());
      setAggregateMap(new Map());
      setLoading(false);
      return;
    }

    // 2. Metrics for selected date range
    const campaignIds = allCampaigns.map((c) => c.id);

    const { data: metricsData } = await supabase
      .from("campaign_metrics")
      .select("*")
      .in("campaign_id", campaignIds)
      .gte("date", toRomeDateStr(dateRange.from))
      .lte("date", toRomeDateStr(dateRange.to))
      .order("date", { ascending: false });

    const allMetrics = (metricsData ?? []) as CampaignMetrics[];

    // Group by campaign_id
    const grouped = new Map<string, CampaignMetrics[]>();
    for (const m of allMetrics) {
      const list = grouped.get(m.campaign_id) ?? [];
      list.push(m);
      grouped.set(m.campaign_id, list);
    }
    setMetricsMap(grouped);

    // Compute aggregates
    const aggs = new Map<string, AggregateMetrics>();
    for (const [cid, list] of grouped) {
      const totalImpressions = list.reduce(
        (s, m) => s + (m.impressions ?? 0),
        0
      );
      const totalClicks = list.reduce((s, m) => s + (m.clicks ?? 0), 0);
      const totalSpend = list.reduce((s, m) => s + (m.spend ?? 0), 0);
      aggs.set(cid, {
        totalImpressions,
        totalClicks,
        totalSpend,
        avgCtr:
          totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      });
    }
    setAggregateMap(aggs);
    setLoading(false);
  }, [effectiveOrgId, isAdmin, staffOrgIds, dateRange]);

  useEffect(() => {
    if (orgLoading) return;
    fetchData();
  }, [orgLoading, fetchData]);

  // ── Lead count from clients (filtered by dateRange) ──────────
  const leadCount = useMemo(() =>
    clients.filter((c) => {
      const d = new Date(c.created_at);
      return d >= startOfDay(dateRange.from) && d <= endOfDay(dateRange.to);
    }).length,
    [clients, dateRange]
  );

  // ── Filtered campaigns by tab ─────────────────────────────────
  const filteredCampaigns = useMemo(() => {
    if (activeTab === "tutte") return campaigns;
    return campaigns.filter((c) => c.status === activeTab);
  }, [campaigns, activeTab]);

  // ── Chart data for expanded campaign ──────────────────────────
  const chartData = useMemo(() => {
    if (!expandedId) return [];
    const daily = metricsMap.get(expandedId) ?? [];
    return [...daily]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((m) => ({
        giorno: new Date(m.date).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
        }),
        Impressions: m.impressions,
        Click: m.clicks,
        Lead: clients.filter((c) => toRomeDateStr(c.created_at) === m.date).length,
      }));
  }, [expandedId, metricsMap, clients]);

  // ── Sorted daily metrics for expanded table ───────────────────
  const sortedDailyMetrics = useMemo(() => {
    if (!expandedId) return [];
    const daily = metricsMap.get(expandedId) ?? [];
    return [...daily].sort((a, b) => {
      let va: number;
      let vb: number;
      switch (sortCol) {
        case "date":
          va = new Date(a.date).getTime();
          vb = new Date(b.date).getTime();
          break;
        case "impressions":
          va = a.impressions;
          vb = b.impressions;
          break;
        case "clicks":
          va = a.clicks;
          vb = b.clicks;
          break;
        case "spend":
          va = a.spend;
          vb = b.spend;
          break;
        case "leads":
          va = clients.filter((c) => toRomeDateStr(c.created_at) === a.date).length;
          vb = clients.filter((c) => toRomeDateStr(c.created_at) === b.date).length;
          break;
        case "cpa":
          va = a.cpa ?? 0;
          vb = b.cpa ?? 0;
          break;
        case "ctr":
          va = a.ctr ?? 0;
          vb = b.ctr ?? 0;
          break;
        case "cpm":
          va = a.cpm ?? 0;
          vb = b.cpm ?? 0;
          break;
        default:
          va = 0;
          vb = 0;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [expandedId, metricsMap, sortCol, sortDir, clients]);

  // ── Interactions ──────────────────────────────────────────────
  function toggleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setSortCol("date");
    setSortDir("desc");
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Campagne Marketing
          </h1>
          <p className="text-muted-foreground">
            Monitora e gestisci le campagne Meta Ads dei tuoi clienti.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          <Button
            className="bg-primary hover:bg-primary/80"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuova Campagna
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        {tabs.map((tab) => (
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

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Caricamento campagne...
          </p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        /* ── Empty State ──────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Megaphone className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            {activeTab === "tutte"
              ? "Nessuna campagna ancora"
              : "Nessuna campagna con questo filtro"}
          </h3>
          <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
            {activeTab === "tutte"
              ? "Le tue campagne Meta Ads verranno sincronizzate automaticamente da Make. Oppure crea manualmente una campagna."
              : "Non ci sono campagne che corrispondono al filtro selezionato."}
          </p>
          {activeTab === "tutte" && (
            <Button
              className="mt-6 bg-primary hover:bg-primary/80"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crea la prima campagna
            </Button>
          )}
        </div>
      ) : (
        /* ── Campaign Cards ───────────────────────────────────── */
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => {
            const statusCfg = CAMPAIGN_STATUS_CONFIG[campaign.status];
            const agg = aggregateMap.get(campaign.id);
            const isExpanded = expandedId === campaign.id;
            const hasMetrics = !!agg;

            return (
              <Card
                key={campaign.id}
                className="overflow-hidden bg-card shadow-sm"
              >
                <CardContent className="p-0">
                  {/* ── Campaign summary ────────────────────── */}
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {/^Campaign \d+$/.test(campaign.nome_campagna) ? "Campagna Meta" : campaign.nome_campagna}
                          </h3>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {campaign.data_inizio && (
                            <span>
                              Inizio:{" "}
                              {new Date(
                                campaign.data_inizio
                              ).toLocaleDateString("it-IT")}
                            </span>
                          )}
                          {campaign.data_fine && (
                            <span>
                              Fine:{" "}
                              {new Date(
                                campaign.data_fine
                              ).toLocaleDateString("it-IT")}
                            </span>
                          )}
                          {campaign.budget_mensile != null && (
                            <span>
                              Budget:{" "}
                              {fmtEur(Number(campaign.budget_mensile))}/mese
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Aggregate KPIs (last 30 days) ──── */}
                    {hasMetrics ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                        <MetricBox
                          label="Lead"
                          value={fmtNum(leadCount)}
                        />
                        <MetricBox
                          label="Spesa"
                          value={fmtEur(agg.totalSpend)}
                        />
                        <MetricBox
                          label="CPA"
                          value={
                            leadCount > 0
                              ? `€${(agg.totalSpend / leadCount).toFixed(2)}`
                              : "—"
                          }
                        />
                        <MetricBox
                          label="CTR"
                          value={
                            agg.avgCtr > 0
                              ? `${agg.avgCtr.toFixed(2)}%`
                              : "—"
                          }
                        />
                        <MetricBox
                          label="Impressions"
                          value={fmtNum(agg.totalImpressions)}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm italic text-muted-foreground">
                        Nessuna metrica nel periodo selezionato
                      </p>
                    )}

                    {/* ── Expand toggle ─────────────────── */}
                    {hasMetrics && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 text-primary hover:bg-primary/10 hover:text-primary/80"
                        onClick={() => toggleExpand(campaign.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="mr-1 h-4 w-4" />
                            Chiudi Dettaglio
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-1 h-4 w-4" />
                            Vedi Dettaglio
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* ── Expanded detail ─────────────────────── */}
                  {isExpanded && (
                    <div className="space-y-5 border-t border-border bg-muted p-4 md:p-5">
                      {/* Chart */}
                      {chartData.length > 0 && (
                        <div>
                          <h4 className="mb-3 text-sm font-semibold text-foreground">
                            Andamento periodo selezionato
                          </h4>
                          <div className="h-[300px]">
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
                                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                  axisLine={{ stroke: "var(--border)" }}
                                  allowDecimals={false}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                    boxShadow:
                                      "0 1px 3px rgba(0,0,0,0.1)",
                                    backgroundColor: "var(--card)",
                                    color: "var(--foreground)",
                                  }}
                                  formatter={(value) => [
                                    Number(value).toLocaleString("it-IT"),
                                    "",
                                  ]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="Lead"
                                  stroke="#10B981"
                                  strokeWidth={2}
                                  dot={{ r: 2 }}
                                  activeDot={{ r: 4 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Daily metrics table */}
                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-foreground">
                          Metriche Giornaliere
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted">
                                <SortableHeader
                                  label="Data"
                                  column="date"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="Spesa"
                                  column="spend"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="Lead"
                                  column="leads"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="CPA"
                                  column="cpa"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="CTR"
                                  column="ctr"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="CPM"
                                  column="cpm"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="Click"
                                  column="clicks"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                                <SortableHeader
                                  label="Impressions"
                                  column="impressions"
                                  currentCol={sortCol}
                                  dir={sortDir}
                                  onSort={toggleSort}
                                />
                              </tr>
                            </thead>
                            <tbody>
                              {sortedDailyMetrics.map((m) => (
                                <tr
                                  key={m.id}
                                  className="border-b border-border transition-colors last:border-b-0 hover:bg-muted"
                                >
                                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                                    {new Date(m.date).toLocaleDateString(
                                      "it-IT"
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {fmtEur(m.spend)}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-foreground">
                                    {clients.filter((c) => toRomeDateStr(c.created_at) === m.date).length}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {(() => {
                                      const dayLeads = clients.filter((c) => toRomeDateStr(c.created_at) === m.date).length;
                                      return dayLeads > 0 ? `€${(m.spend / dayLeads).toFixed(2)}` : "—";
                                    })()}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.ctr != null
                                      ? `${m.ctr.toFixed(2)}%`
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.cpm != null
                                      ? `€${m.cpm.toFixed(2)}`
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.clicks.toLocaleString("it-IT")}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.impressions.toLocaleString("it-IT")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campaign form dialog */}
      {effectiveOrgId && (
        <CampaignFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          organizationId={effectiveOrgId}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  currentCol,
  dir,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentCol: SortColumn;
  dir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
}) {
  const isActive = currentCol === column;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );
}
