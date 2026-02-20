"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
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
import { createClient } from "@/lib/supabase/client";
import { getCampaigns } from "@/lib/supabase/queries";
import { CAMPAIGN_STATUS_CONFIG } from "@/lib/constants";
import { toRomeDateStr } from "@/lib/date-utils";
import type { Campaign, CampaignMetrics } from "@/types";

const tabs = [
  { key: "tutte", label: "Tutte" },
  { key: "attiva", label: "Attive" },
  { key: "completata", label: "Completate" },
  { key: "in_pausa", label: "In Pausa" },
] as const;

interface AggregateMetrics {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalLeads: number;
  avgCpa: number;
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

export function StudioCampaignsTab({ organizationId }: { organizationId: string }) {
  const [activeTab, setActiveTab] = useState<string>("tutte");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metricsMap, setMetricsMap] = useState<Map<string, CampaignMetrics[]>>(new Map());
  const [aggregateMap, setAggregateMap] = useState<Map<string, AggregateMetrics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: campaignsData } = await getCampaigns(organizationId, false);
    const allCampaigns = (campaignsData ?? []) as Campaign[];
    setCampaigns(allCampaigns);

    if (allCampaigns.length === 0) {
      setMetricsMap(new Map());
      setAggregateMap(new Map());
      setLoading(false);
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const campaignIds = allCampaigns.map((c) => c.id);

    const { data: metricsData } = await supabase
      .from("campaign_metrics")
      .select("*")
      .in("campaign_id", campaignIds)
      .gte("date", toRomeDateStr(thirtyDaysAgo))
      .order("date", { ascending: false });

    const allMetrics = (metricsData ?? []) as CampaignMetrics[];

    const grouped = new Map<string, CampaignMetrics[]>();
    for (const m of allMetrics) {
      const list = grouped.get(m.campaign_id) ?? [];
      list.push(m);
      grouped.set(m.campaign_id, list);
    }
    setMetricsMap(grouped);

    const aggs = new Map<string, AggregateMetrics>();
    for (const [cid, list] of grouped) {
      const totalImpressions = list.reduce((s, m) => s + (m.impressions ?? 0), 0);
      const totalClicks = list.reduce((s, m) => s + (m.clicks ?? 0), 0);
      const totalSpend = list.reduce((s, m) => s + (m.spend ?? 0), 0);
      const totalLeads = list.reduce((s, m) => s + (m.leads ?? 0), 0);
      aggs.set(cid, {
        totalImpressions,
        totalClicks,
        totalSpend,
        totalLeads,
        avgCpa: totalLeads > 0 ? totalSpend / totalLeads : 0,
        avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      });
    }
    setAggregateMap(aggs);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCampaigns = useMemo(() => {
    if (activeTab === "tutte") return campaigns;
    return campaigns.filter((c) => c.status === activeTab);
  }, [campaigns, activeTab]);

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
        Lead: m.leads,
      }));
  }, [expandedId, metricsMap]);

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
          va = a.leads;
          vb = b.leads;
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
  }, [expandedId, metricsMap, sortCol, sortDir]);

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

  return (
    <div className="space-y-6">
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
          <p className="mt-4 text-sm text-muted-foreground">Caricamento campagne...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
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
              ? "Le campagne Meta Ads verranno sincronizzate automaticamente."
              : "Non ci sono campagne che corrispondono al filtro selezionato."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => {
            const statusCfg = CAMPAIGN_STATUS_CONFIG[campaign.status];
            const agg = aggregateMap.get(campaign.id);
            const isExpanded = expandedId === campaign.id;
            const hasMetrics = !!agg;

            return (
              <Card key={campaign.id} className="overflow-hidden bg-card shadow-sm">
                <CardContent className="p-0">
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
                              {new Date(campaign.data_inizio).toLocaleDateString("it-IT")}
                            </span>
                          )}
                          {campaign.data_fine && (
                            <span>
                              Fine:{" "}
                              {new Date(campaign.data_fine).toLocaleDateString("it-IT")}
                            </span>
                          )}
                          {campaign.budget_mensile != null && (
                            <span>
                              Budget: {fmtEur(Number(campaign.budget_mensile))}/mese
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {hasMetrics ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                        <MetricBox label="Lead" value={fmtNum(agg.totalLeads)} />
                        <MetricBox label="Spesa" value={fmtEur(agg.totalSpend)} />
                        <MetricBox
                          label="CPA"
                          value={agg.avgCpa > 0 ? `€${agg.avgCpa.toFixed(2)}` : "—"}
                        />
                        <MetricBox
                          label="CTR"
                          value={agg.avgCtr > 0 ? `${agg.avgCtr.toFixed(2)}%` : "—"}
                        />
                        <MetricBox label="Impressions" value={fmtNum(agg.totalImpressions)} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm italic text-muted-foreground">
                        Nessuna metrica negli ultimi 30 giorni
                      </p>
                    )}

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

                  {isExpanded && (
                    <div className="space-y-5 border-t border-border bg-muted p-4 md:p-5">
                      {chartData.length > 0 && (
                        <div>
                          <h4 className="mb-3 text-sm font-semibold text-foreground">
                            Andamento ultimi 30 giorni
                          </h4>
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
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

                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-foreground">
                          Metriche Giornaliere
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted">
                                <SortableHeader label="Data" column="date" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="Impressions" column="impressions" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="Click" column="clicks" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="Spend" column="spend" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="Lead" column="leads" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="CPA" column="cpa" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="CTR" column="ctr" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                                <SortableHeader label="CPM" column="cpm" currentCol={sortCol} dir={sortDir} onSort={toggleSort} />
                              </tr>
                            </thead>
                            <tbody>
                              {sortedDailyMetrics.map((m) => (
                                <tr
                                  key={m.id}
                                  className="border-b border-border transition-colors last:border-b-0 hover:bg-muted"
                                >
                                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                                    {new Date(m.date).toLocaleDateString("it-IT")}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.impressions.toLocaleString("it-IT")}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.clicks.toLocaleString("it-IT")}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {fmtEur(m.spend)}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-foreground">
                                    {m.leads}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.cpa != null ? `€${m.cpa.toFixed(2)}` : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.ctr != null ? `${m.ctr.toFixed(2)}%` : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {m.cpm != null ? `€${m.cpm.toFixed(2)}` : "—"}
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
    </div>
  );
}

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
