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
import { useOrganization } from "@/contexts/OrganizationContext";
import { getClients } from "@/lib/supabase/queries";
import type { Client, SalesStage } from "@/types";

const MONTH_NAMES = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

const FULL_MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const IN_LAVORAZIONE_STAGES: SalesStage[] = [
  "contacted",
  "responded",
  "appointment_scheduled",
];

const FUNNEL_COLORS = ["#6B7280", "#3B82F6", "#F89627", "#97BC0D", "#EF4444"];

export default function AnalyticsPage() {
  const { effectiveOrgId, isAdmin, loading: orgLoading } = useOrganization();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await getClients(effectiveOrgId, isAdmin);
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }, [effectiveOrgId, isAdmin]);

  useEffect(() => {
    if (orgLoading) return;
    fetchData();
  }, [orgLoading, fetchData]);

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

    // Tasso Conversione: converted / totale * 100
    const conversionRate = (converted / total) * 100;

    // Tasso Risposta: (responded + app_scheduled + app_completed + converted + lost) / totale * 100
    const respondedTotal = responded + appScheduled + appCompleted + converted + lost;
    const responseRate = (respondedTotal / total) * 100;

    // Tasso Appuntamenti: (app_scheduled + app_completed + converted) / chi ha risposto * 100
    const appointmentRate = respondedTotal > 0
      ? ((appScheduled + appCompleted + converted) / respondedTotal) * 100
      : 0;

    // Tasso Fidelizzazione: converted / appointment_completed * 100
    const retentionRate = appCompleted > 0
      ? (converted / appCompleted) * 100
      : 0;

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
      { name: "In Lavorazione", value: inLavorazione },
      { name: "Da Fidelizzare", value: daFidelizzare },
      { name: "Acquisiti", value: acquisiti },
      { name: "Persi", value: persi },
    ];
  }, [clients]);

  // === Trend Lead (last 6 months) ===
  const trendData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; count: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        count: 0,
      });
    }

    for (const c of clients) {
      const created = c.created_at.slice(0, 7); // "YYYY-MM"
      const month = months.find((m) => m.key === created);
      if (month) month.count++;
    }

    return months.map((m) => ({ mese: m.label, lead: m.count }));
  }, [clients]);

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

  // === Monthly conversion table (last 6 months) ===
  const monthlyTable = useMemo(() => {
    const now = new Date();
    const rows: {
      label: string;
      leads: number;
      converted: number;
      convRate: number;
      revenue: number;
    }[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${FULL_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

      const monthClients = clients.filter((c) => c.created_at.slice(0, 7) === key);
      const leads = monthClients.length;
      const converted = monthClients.filter((c) => c.sales_stage === "converted").length;
      const convRate = leads > 0 ? (converted / leads) * 100 : 0;
      const revenue = monthClients.reduce((sum, c) => sum + (c.revenue ?? 0), 0);

      rows.push({ label, leads, converted, convRate, revenue });
    }

    return rows;
  }, [clients]);

  // === Loading state ===
  if (loading || orgLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // === Empty state ===
  if (clients.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analisi Lead</h1>
          <p className="text-muted-foreground">Analisi conversioni e performance dei lead.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Nessun dato disponibile</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Aggiungi dei lead per visualizzare le analisi di conversione e performance.
          </p>
        </div>
      </div>
    );
  }

  const funnelTotal = funnelData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analisi Lead</h1>
        <p className="text-muted-foreground">Analisi conversioni e performance dei lead.</p>
      </div>

      {/* ====== SEZIONE 1 - KPI Cards ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tasso Conversione */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasso Conversione
            </CardTitle>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/50 p-2">
              <TrendingUp className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {kpis.conversionRate.toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Lead convertiti in clienti</p>
          </CardContent>
        </Card>

        {/* Tasso Risposta */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasso Risposta
            </CardTitle>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 p-2">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {kpis.responseRate.toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Lead che hanno risposto</p>
          </CardContent>
        </Card>

        {/* Tasso Appuntamenti */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasso Appuntamenti
            </CardTitle>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/50 p-2">
              <CalendarCheck className="h-5 w-5 text-[#F89627]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {kpis.appointmentRate.toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Risposte sfociate in appuntamento</p>
          </CardContent>
        </Card>

        {/* Tasso Fidelizzazione */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasso Fidelizzazione
            </CardTitle>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/50 p-2">
              <UserCheck className="h-5 w-5 text-[#8B5CF6]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {kpis.retentionRate.toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Appuntamenti convertiti in clienti</p>
          </CardContent>
        </Card>
      </div>

      {/* ====== SEZIONE 2+3 - Grafici affiancati ====== */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Funnel */}
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Pipeline Funnel
            </CardTitle>
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
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      backgroundColor: "var(--card)",
                      color: "var(--foreground)",
                    }}
                    formatter={(value) => {
                      const pct = funnelTotal > 0 ? ((Number(value) / funnelTotal) * 100).toFixed(1) : "0";
                      return [`${value} (${pct}%)`, "Lead"];
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Trend Lead */}
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Trend Lead
            </CardTitle>
            <p className="text-sm text-muted-foreground">Ultimi 6 mesi</p>
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

      {/* ====== SEZIONE 4 - Dati Economici (condizionale) ====== */}
      {revenueData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Incasso Totale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] font-bold leading-tight text-foreground">
                {revenueData.total.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Incasso Medio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] font-bold leading-tight text-foreground">
                {revenueData.avg.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clienti con Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] font-bold leading-tight text-foreground">
                {revenueData.count}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ====== SEZIONE 5 - Tabella Conversioni per Mese ====== */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Conversioni per Mese
          </CardTitle>
          <p className="text-sm text-muted-foreground">Ultimi 6 mesi</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mese</TableHead>
                <TableHead className="text-right">Lead</TableHead>
                <TableHead className="text-right">Acquisiti</TableHead>
                <TableHead className="text-right">Tasso Conv.</TableHead>
                <TableHead className="text-right">Incasso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyTable.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">{row.leads}</TableCell>
                  <TableCell className="text-right">{row.converted}</TableCell>
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
