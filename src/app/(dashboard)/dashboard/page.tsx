"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  UserCheck,
  Wallet,
  Calendar,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  Clock,
  Check,
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
import { CLIENT_SOURCE_CONFIG } from "@/lib/constants";
import { LEAD_STAGES, CLIENT_STAGES } from "@/lib/constants/stages";
import { toRomeDateStr, startOfMonthRomeISO } from "@/lib/date-utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { Client } from "@/types";

interface LeadChartPoint {
  giorno: string;
  lead: number;
}

const MONTH_NAMES_FULL = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveOrgId, isAdmin, loading: orgLoading } = useOrganization();

  const viewOnly = searchParams.get("viewOnly") === "true";
  const viewOrgId = searchParams.get("orgId");
  const isViewMode = viewOnly && !!viewOrgId;

  // The org ID to use for queries: viewOrgId in view mode, otherwise effectiveOrgId
  const queryOrgId = isViewMode ? viewOrgId : effectiveOrgId;

  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [totalClientCount, setTotalClientCount] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  const [spendMonth, setSpendMonth] = useState(0);
  const [weekAppointments, setWeekAppointments] = useState(0);
  const [leadChartData, setLeadChartData] = useState<LeadChartPoint[]>([]);
  const [chartMonthName, setChartMonthName] = useState("");
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [leadsToContact, setLeadsToContact] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [viewOrgName, setViewOrgName] = useState<string | null>(null);

  const fetchLeadsToContact = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("clients")
      .select("*")
      .in("sales_stage", ["new", "contacted"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (queryOrgId) {
      query = query.eq("organization_id", queryOrgId);
    }

    const { data } = await query;
    setLeadsToContact((data ?? []) as Client[]);
  }, [queryOrgId]);

  useEffect(() => {
    if (orgLoading) return;

    async function fetchAll() {
      setLoading(true);
      const supabase = createClient();

      // Fetch org name for view mode banner
      if (isViewMode && viewOrgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", viewOrgId)
          .single();
        setViewOrgName(orgData?.name ?? null);
      }

      // --- Date helpers (Europe/Rome timezone) ---
      const now = new Date();
      const romeToday = toRomeDateStr(now);
      const startOfMonth = startOfMonthRomeISO(now);
      const romeMonthIdx = parseInt(romeToday.slice(5, 7)) - 1;

      setChartMonthName(MONTH_NAMES_FULL[romeMonthIdx]);

      // Monday of current week
      const startOfWeek = new Date(now);
      const dow = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - (dow === 0 ? 6 : dow - 1));
      startOfWeek.setHours(0, 0, 0, 0);

      // Sunday of current week
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Helper: add organization_id filter when needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orgFilter = (q: any) => {
        if (queryOrgId) return q.eq("organization_id", queryOrgId);
        return q;
      };

      // --- All queries in parallel ---
      const [
        leadStagesRes,
        clientStagesRes,
        leadsRes,
        appointmentsRes,
        chartClientsRes,
        recentClientsRes,
        orgCampaignsRes,
      ] = await Promise.all([
        // 1) Lead (solo LEAD_STAGES)
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .in("sales_stage", LEAD_STAGES)
        ),
        // 2) Clienti (solo CLIENT_STAGES)
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .in("sales_stage", [...CLIENT_STAGES])
        ),
        // 3) Nuovi Lead Questo Mese
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startOfMonth)
        ),
        // 3) Appuntamenti Questa Settimana
        orgFilter(
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .gte("start_time", startOfWeek.toISOString())
            .lte("start_time", endOfWeek.toISOString())
        ),
        // 4) Chart: clients created from start of current month
        orgFilter(
          supabase
            .from("clients")
            .select("created_at")
            .gte("created_at", startOfMonth)
            .order("created_at", { ascending: true })
        ),
        // 5) Clienti Recenti (ultimi 5)
        orgFilter(
          supabase
            .from("clients")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5)
        ),
        // 6) Campaign IDs for this org (needed for spend calc)
        orgFilter(
          supabase
            .from("campaigns")
            .select("id")
        ),
      ]);

      // --- KPIs ---
      setTotalLeadCount(leadStagesRes.count ?? 0);
      setTotalClientCount(clientStagesRes.count ?? 0);
      setNewLeads(leadsRes.count ?? 0);
      setWeekAppointments(appointmentsRes.count ?? 0);

      // --- Spesa Mese: sum spend from campaign_metrics ---
      const campaignIds = (orgCampaignsRes.data ?? []).map(
        (c: { id: string }) => c.id
      );
      let totalSpend = 0;
      if (campaignIds.length > 0) {
        const { data: metricsData } = await supabase
          .from("campaign_metrics")
          .select("spend")
          .in("campaign_id", campaignIds)
          .gte("date", startOfMonth);

        for (const m of metricsData ?? []) {
          totalSpend += Number(m.spend) || 0;
        }
      }
      setSpendMonth(totalSpend);

      // --- Lead chart (current month, day 1 to today — Rome TZ) ---
      const todayDate = parseInt(romeToday.slice(8, 10));
      const monthPrefix = romeToday.slice(0, 8); // "YYYY-MM-"
      const chartMap = new Map<string, number>();
      for (let day = 1; day <= todayDate; day++) {
        chartMap.set(`${monthPrefix}${String(day).padStart(2, "0")}`, 0);
      }
      for (const row of chartClientsRes.data ?? []) {
        const key = toRomeDateStr((row as { created_at: string }).created_at);
        if (chartMap.has(key)) {
          chartMap.set(key, (chartMap.get(key) ?? 0) + 1);
        }
      }
      const points: LeadChartPoint[] = [];
      for (const [, count] of chartMap) {
        points.push({
          giorno: String(points.length + 1),
          lead: count,
        });
      }
      setLeadChartData(points);

      // --- Clienti Recenti ---
      setRecentClients((recentClientsRes.data ?? []) as Client[]);

      setLoading(false);
    }

    fetchAll();
    fetchLeadsToContact();
  }, [queryOrgId, isAdmin, orgLoading, fetchLeadsToContact, isViewMode, viewOrgId]);

  async function markAsContacted(clientId: string) {
    setContactingId(clientId);
    try {
      const supabase = createClient();

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("clients")
        .update({
          sales_stage: "contacted",
          contacted_at: now,
          stage_changed_at: now,
        })
        .eq("id", clientId);

      if (error) {
        toast.error("Errore durante l'aggiornamento");
        return;
      }

      toast.success("Lead segnato come contattato!");
      await fetchLeadsToContact();
    } finally {
      setContactingId(null);
    }
  }

  // --- Full-page loading spinner ---
  if (loading || orgLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View-only banner */}
      {isViewMode && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 dark:bg-blue-950/30 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Stai visualizzando: <span className="font-semibold">{viewOrgName ?? "Studio"}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
            onClick={() => router.push("/admin/studi")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Torna a Gestione Studi
          </Button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Panoramica delle campagne e performance dei lead.
        </p>
      </div>

      {/* ====== SEZIONE 1 – KPI Cards ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Nuovi Lead Mese */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nuovi Lead Mese
            </CardTitle>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/50 p-2">
              <UserPlus className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {newLeads}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Aggiunti questo mese
            </p>
          </CardContent>
        </Card>

        {/* Lead Totali */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lead
            </CardTitle>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {totalLeadCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              In fase di acquisizione
            </p>
          </CardContent>
        </Card>

        {/* Clienti */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clienti
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-2">
              <UserCheck className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {totalClientCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Seduta o percorso
            </p>
          </CardContent>
        </Card>

        {/* Spesa Mese */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spesa Mese
            </CardTitle>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/50 p-2">
              <Wallet className="h-5 w-5 text-[#F59E0B]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold leading-tight text-foreground">
              {`\u20AC${spendMonth.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Budget utilizzato questo mese</p>
          </CardContent>
        </Card>

        {/* Appuntamenti Settimana */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Appuntamenti Settimana
            </CardTitle>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/50 p-2">
              <Calendar className="h-5 w-5 text-[#8B5CF6]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {weekAppointments}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Questa settimana</p>
          </CardContent>
        </Card>
      </div>

      {/* ====== SEZIONE 2 – Grafico Lead mese corrente ====== */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Lead Generati &mdash; {chartMonthName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Mese corrente</p>
        </CardHeader>
        <CardContent>
          {leadChartData.every((d) => d.lead === 0) ? (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <UserPlus className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2">Nessun lead questo mese</p>
              </div>
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={leadChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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

      {/* ====== SEZIONE 3 + 4 – Clienti Recenti + Lead da Contattare ====== */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clienti Recenti */}
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">
                Lead Recenti
              </CardTitle>
              {!isViewMode && (
                <Link
                  href="/clients"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
                >
                  Vedi tutti
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 font-medium">
                  Nessun cliente ancora.
                </p>
                <p className="text-sm">Aggiungi il primo!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">
                          {client.nome} {client.cognome}
                        </p>
                        {client.source &&
                          CLIENT_SOURCE_CONFIG[client.source] && (
                            <span
                              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${CLIENT_SOURCE_CONFIG[client.source].color}`}
                            >
                              {CLIENT_SOURCE_CONFIG[client.source].label}
                            </span>
                          )}
                      </div>
                      {client.email && (
                        <p className="truncate text-sm text-muted-foreground">
                          {client.email}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {client.first_contact_date && (
                          <span>
                            Contatto:{" "}
                            {new Date(
                              client.first_contact_date
                            ).toLocaleDateString("it-IT")}
                          </span>
                        )}
                        {client.service_interest && (
                          <span>{client.service_interest}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead da Contattare */}
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">
                Lead da Contattare ({leadsToContact.length})
              </CardTitle>
              {!isViewMode && (
                <Link
                  href="/clients?filter=da_contattare"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
                >
                  Vedi tutti
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {leadsToContact.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">&#x2705;</div>
                <h3 className="text-lg font-semibold text-foreground">Ottimo lavoro!</h3>
                <p className="text-muted-foreground">
                  Nessun lead in attesa di contatto al momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leadsToContact.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="font-medium text-foreground">
                          {lead.nome} {lead.cognome}
                        </p>
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </a>
                        )}
                        {lead.telefono && (
                          <a
                            href={`tel:${lead.telefono}`}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{lead.telefono}</span>
                          </a>
                        )}
                        {lead.service_interest && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            <span>{lead.service_interest}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>
                            Ricevuto{" "}
                            {formatDistanceToNow(new Date(lead.created_at), {
                              addSuffix: true,
                              locale: it,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!isViewMode && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-950/30 dark:hover:text-green-400 dark:hover:border-green-800"
                          disabled={contactingId === lead.id}
                          onClick={() => markAsContacted(lead.id)}
                        >
                          {contactingId === lead.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Segna come Contattato
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
