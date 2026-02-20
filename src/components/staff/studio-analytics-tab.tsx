"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  MessageSquare,
  CalendarCheck,
  UserCheck,
  Loader2,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { getClients } from "@/lib/supabase/queries";
import { toRomeDateStr } from "@/lib/date-utils";
import type { Client, SalesStage } from "@/types";

const FULL_MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const IN_LAVORAZIONE_STAGES: SalesStage[] = [
  "contacted",
  "responded",
  "appointment_scheduled",
];

export function StudioAnalyticsTab({ organizationId }: { organizationId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [contractStartDate, setContractStartDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFunnelIndex, setActiveFunnelIndex] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const supabase = createClient();
    const { data: orgData } = await supabase
      .from("organizations")
      .select("contract_start_date")
      .eq("id", organizationId)
      .single();
    setContractStartDate(orgData?.contract_start_date ?? null);

    const { data } = await getClients(organizationId, false);
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === KPI calculations ===
  const kpis = useMemo(() => {
    const total = clients.length;
    if (total === 0) {
      return {
        conversionRate: 0,
        responseRate: 0,
        appointmentRate: 0,
        retentionRate: 0,
      };
    }

    const stageCounts: Record<string, number> = {};
    for (const c of clients) {
      const stage = c.sales_stage ?? "new";
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }

    const converted = stageCounts["converted"] ?? 0;
    const responded = stageCounts["responded"] ?? 0;
    const appScheduled = stageCounts["appointment_scheduled"] ?? 0;
    const appCompleted = stageCounts["appointment_completed"] ?? 0;
    const lost = stageCounts["lost"] ?? 0;

    const conversionRate = (converted / total) * 100;
    const respondedTotal = responded + appScheduled + appCompleted + converted + lost;
    const responseRate = (respondedTotal / total) * 100;
    const appointmentRate = ((appScheduled + appCompleted + converted) / total) * 100;
    const retentionRate = (converted / total) * 100;

    return { conversionRate, responseRate, appointmentRate, retentionRate };
  }, [clients]);

  // === Pipeline Funnel data ===
  const funnelData = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    for (const c of clients) {
      const stage = c.sales_stage ?? "new";
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }

    const newLeads = stageCounts["new"] ?? 0;
    const inLavorazione = IN_LAVORAZIONE_STAGES.reduce(
      (sum, s) => sum + (stageCounts[s] ?? 0), 0
    );
    const daFidelizzare = stageCounts["appointment_completed"] ?? 0;
    const acquisiti = stageCounts["converted"] ?? 0;
    const persi = stageCounts["lost"] ?? 0;

    return [
      { name: "Nuovi Lead", value: newLeads },
      { name: "Appuntamento Fissato", value: inLavorazione },
      { name: "Da Fidelizzare", value: daFidelizzare },
      { name: "Percorsi", value: acquisiti },
      { name: "Persi", value: persi },
    ];
  }, [clients]);

  // === Trend Lead (30-day intervals from contract start) ===
  const trendData = useMemo(() => {
    const now = new Date();
    const start = contractStartDate ? new Date(contractStartDate) : null;
    if (!start) return [];

    const startMs = start.getTime();
    const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

    const intervals: { from: Date; to: Date; label: string; count: number }[] = [];
    let periodStart = startMs;
    let idx = 0;
    while (periodStart < now.getTime()) {
      const periodEnd = Math.min(periodStart + MS_30_DAYS, now.getTime());
      const fromDate = new Date(periodStart);
      const toDate = new Date(periodEnd);
      const fromLabel = `${fromDate.getDate()}/${fromDate.getMonth() + 1}`;
      const toLabel = `${toDate.getDate()}/${toDate.getMonth() + 1}`;
      intervals.push({
        from: fromDate,
        to: toDate,
        label: `Giorni ${idx * 30 + 1}-${(idx + 1) * 30} (${fromLabel}–${toLabel})`,
        count: 0,
      });
      periodStart += MS_30_DAYS;
      idx++;
    }

    for (const c of clients) {
      const createdMs = new Date(c.created_at).getTime();
      for (const interval of intervals) {
        if (createdMs >= interval.from.getTime() && createdMs < interval.to.getTime()) {
          interval.count++;
          break;
        }
      }
    }

    return intervals.map((i) => ({ mese: i.label, lead: i.count }));
  }, [clients, contractStartDate]);

  // === Revenue data ===
  const revenueData = useMemo(() => {
    const withRevenue = clients.filter((c) => c.revenue != null && c.revenue > 0);
    if (withRevenue.length === 0) return null;

    const totalRevenue = withRevenue.reduce((sum, c) => sum + (c.revenue ?? 0), 0);
    const avgRevenue = totalRevenue / withRevenue.length;

    return {
      total: totalRevenue,
      avg: avgRevenue,
      count: withRevenue.length,
    };
  }, [clients]);

  // === Monthly conversion table ===
  const CLIENT_STAGES: SalesStage[] = ["appointment_completed", "converted"];

  const monthlyTable = useMemo(() => {
    const now = new Date();
    const start = contractStartDate ? new Date(contractStartDate) : null;
    if (!start) return [];

    const rows: {
      label: string;
      leads: number;
      clienti: number;
      convRate: number;
      revenue: number;
    }[] = [];

    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let i = 0; i < 3; i++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      if (d > now) break;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${FULL_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

      const monthClients = clients.filter((c) => toRomeDateStr(c.created_at).slice(0, 7) === key);
      const leads = monthClients.length;
      const clienti = monthClients.filter((c) =>
        CLIENT_STAGES.includes(c.sales_stage as SalesStage)
      ).length;
      const convRate = leads > 0 ? (clienti / leads) * 100 : 0;
      const revenue = monthClients.reduce((sum, c) => sum + (c.revenue ?? 0), 0);

      rows.push({ label, leads, clienti, convRate, revenue });
    }

    return rows;
  }, [clients, contractStartDate]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Nessun dato disponibile</h3>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
          Aggiungi dei lead per visualizzare le analisi di conversione e performance.
        </p>
      </div>
    );
  }

  const funnelTotal = funnelData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lead Totali</CardTitle>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-950/50 p-2">
              <Users className="h-5 w-5 text-[#6B7280]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">{clients.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasso Risposta</CardTitle>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 p-2">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">{kpis.responseRate.toFixed(1)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Lead che hanno risposto</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasso Appuntamenti</CardTitle>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/50 p-2">
              <CalendarCheck className="h-5 w-5 text-[#F89627]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">{kpis.appointmentRate.toFixed(1)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Risposte convertite in appuntamento</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasso Conversione</CardTitle>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/50 p-2">
              <TrendingUp className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">{kpis.conversionRate.toFixed(1)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Lead convertiti in clienti</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasso Fidelizzazione</CardTitle>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/50 p-2">
              <UserCheck className="h-5 w-5 text-[#8B5CF6]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">{kpis.retentionRate.toFixed(1)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Clienti che hanno acquistato percorsi</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Stato dei Lead</CardTitle>
            <p className="text-sm text-muted-foreground">Distribuzione lead per fase</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    width={110}
                  />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length || payload[0].value === 0) return null;
                      const val = Number(payload[0].value);
                      const pct = funnelTotal > 0 ? ((val / funnelTotal) * 100).toFixed(1) : "0";
                      return (
                        <div style={{
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          backgroundColor: "var(--card)",
                          color: "var(--foreground)",
                          padding: "8px 12px",
                          fontSize: "13px",
                        }}>
                          <span style={{ fontWeight: 600 }}>{payload[0].payload.name}</span>: {val} ({pct}%)
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    onMouseLeave={() => setActiveFunnelIndex(null)}
                  >
                    {funnelData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={activeFunnelIndex === index ? "#F89627" : "#2563eb"}
                        opacity={activeFunnelIndex !== null && activeFunnelIndex !== index ? 0.5 : 1}
                        onMouseEnter={() => setActiveFunnelIndex(index)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Trend Lead</CardTitle>
            <p className="text-sm text-muted-foreground">
              {contractStartDate
                ? `Periodi di 30 giorni dal ${new Date(contractStartDate).toLocaleDateString("it-IT")}`
                : "Nessuna data di inizio contratto"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="mese"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
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
                    stroke="#F89627"
                    strokeWidth={2}
                    dot={{ fill: "#F89627", r: 4 }}
                    activeDot={{ r: 6, fill: "#F89627" }}
                    name="Lead"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue */}
      {revenueData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Incasso Totale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] font-bold leading-tight text-foreground">
                {revenueData.total.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Incasso Medio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] font-bold leading-tight text-foreground">
                {revenueData.avg.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clienti con Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] font-bold leading-tight text-foreground">
                {revenueData.count}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Table */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Conversioni per Mese</CardTitle>
          <p className="text-sm text-muted-foreground">Rendimento mensile dei lead</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mese</TableHead>
                <TableHead className="text-right">Lead</TableHead>
                <TableHead className="text-right">Clienti</TableHead>
                <TableHead className="text-right">Tasso Conv.</TableHead>
                <TableHead className="text-right">Incasso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyTable.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">{row.leads}</TableCell>
                  <TableCell className="text-right">{row.clienti}</TableCell>
                  <TableCell className="text-right">{row.convRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">
                    {row.revenue > 0
                      ? row.revenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })
                      : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
