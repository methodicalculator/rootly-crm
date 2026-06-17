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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  UserCheck,
  Wallet,
  Banknote,
  Calendar,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  Clock,
  PhoneOff,
  CalendarPlus,
  XCircle,
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
import { CLIENT_STAGES } from "@/lib/constants/stages";
import { LOST_REASON_CONFIG } from "@/lib/constants";
import { toRomeDateStr, startOfMonthRomeISO } from "@/lib/date-utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { AppointmentFormDialog } from "@/components/clients/appointment-form-dialog";
import type { Client, AppointmentWithClient, LostReason } from "@/types";

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
  const { effectiveOrgId, isAdmin, role, loading: orgLoading } = useOrganization();

  const viewOnly = searchParams.get("viewOnly") === "true";
  const viewOrgId = searchParams.get("orgId");
  const isViewMode = viewOnly && !!viewOrgId;

  // The org ID to use for queries: viewOrgId in view mode, otherwise effectiveOrgId
  const queryOrgId = isViewMode ? viewOrgId : effectiveOrgId;

  const [newLeads, setNewLeads] = useState(0);
  const [clientsMonth, setClientsMonth] = useState(0);
  const [spendMonth, setSpendMonth] = useState(0);
  const [incassatoMonth, setIncassatoMonth] = useState(0);
  const [leadChartData, setLeadChartData] = useState<LeadChartPoint[]>([]);
  const [chartMonthName, setChartMonthName] = useState("");
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentWithClient[]>([]);
  const [leadsToContact, setLeadsToContact] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOrgName, setViewOrgName] = useState<string | null>(null);

  // Lead action modal state
  const [actionLead, setActionLead] = useState<Client | null>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);

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

      // Helper: add organization_id filter when needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orgFilter = (q: any) => {
        if (queryOrgId) return q.eq("organization_id", queryOrgId);
        return q;
      };

      // --- All queries in parallel ---
      const [
        leadsRes,
        clientsMonthRes,
        incassatoRes,
        chartClientsRes,
        upcomingApptsRes,
        orgCampaignsRes,
      ] = await Promise.all([
        // 1) Nuovi Lead Questo Mese
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startOfMonth)
        ),
        // 2) Clienti Mese: CLIENT_STAGES con created_at nel mese corrente
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .in("sales_stage", [...CLIENT_STAGES])
            .gte("created_at", startOfMonth)
        ),
        // 3) Incassato Mese: somma revenue dei clienti aggiornati questo mese
        orgFilter(
          supabase
            .from("clients")
            .select("revenue")
            .not("revenue", "is", null)
            .in("sales_stage", [...CLIENT_STAGES])
            .gte("updated_at", startOfMonth)
        ),
        // 4) Chart: clients created from start of current month
        orgFilter(
          supabase
            .from("clients")
            .select("created_at")
            .gte("created_at", startOfMonth)
            .order("created_at", { ascending: true })
        ),
        // 5) Prossimi 5 appuntamenti futuri
        orgFilter(
          supabase
            .from("appointments")
            .select("*, clients(nome, cognome)")
            .neq("status", "cancelled")
            .gte("start_time", now.toISOString())
            .order("start_time", { ascending: true })
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
      setNewLeads(leadsRes.count ?? 0);
      setClientsMonth(clientsMonthRes.count ?? 0);

      let totalIncassato = 0;
      for (const row of incassatoRes.data ?? []) {
        totalIncassato += Number((row as { revenue: number }).revenue) || 0;
      }
      setIncassatoMonth(totalIncassato);

      // --- Spesa Mese: sum spend from campaign_metrics ---
      // Use plain YYYY-MM-DD strings for date column comparisons
      // (startOfMonthRomeISO returns an ISO timestamp that Postgres casts
      //  to the previous day due to UTC offset, causing off-by-one)
      const monthStartDate = romeToday.slice(0, 8) + "01"; // "YYYY-MM-01"
      const campaignIds = (orgCampaignsRes.data ?? []).map(
        (c: { id: string }) => c.id
      );
      let totalSpend = 0;
      if (campaignIds.length > 0) {
        const { data: metricsData } = await supabase
          .from("campaign_metrics")
          .select("spend")
          .in("campaign_id", campaignIds)
          .gte("date", monthStartDate)
          .lte("date", romeToday);

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

      // --- Prossimi Appuntamenti ---
      setUpcomingAppointments((upcomingApptsRes.data ?? []) as AppointmentWithClient[]);

      setLoading(false);
    }

    fetchAll();
    fetchLeadsToContact();
  }, [queryOrgId, isAdmin, orgLoading, fetchLeadsToContact, isViewMode, viewOrgId]);

  function openActionModal(lead: Client) {
    setActionLead(lead);
    setShowLostReason(false);
    setShowAppointmentDialog(false);
  }

  function closeActionModal() {
    setActionLead(null);
    setShowLostReason(false);
  }

  function removeLeadAndClose(leadId: string) {
    setLeadsToContact((prev) => prev.filter((l) => l.id !== leadId));
    closeActionModal();
  }

  async function handleNonRisponde() {
    if (!actionLead) return;
    setActionSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clients")
        .update({ sales_stage: "contacted", contacted_at: new Date().toISOString() })
        .eq("id", actionLead.id);
      if (error) { toast.error("Errore durante l'aggiornamento"); return; }
      toast.success("Lead segnato come Non Risponde");
      removeLeadAndClose(actionLead.id);
    } finally {
      setActionSaving(false);
    }
  }

  function handleAppuntamentoFissato() {
    setShowAppointmentDialog(true);
  }

  async function handleAppointmentSaved(appointmentDateISO: string) {
    if (!actionLead) return;
    setShowAppointmentDialog(false);
    setActionSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clients")
        .update({
          sales_stage: "appointment_scheduled",
          appointment_date: appointmentDateISO,
        })
        .eq("id", actionLead.id);
      if (error) { toast.error("Errore durante l'aggiornamento"); return; }
      toast.success("Appuntamento fissato!");
      removeLeadAndClose(actionLead.id);
    } finally {
      setActionSaving(false);
    }
  }

  function handlePerso() {
    setShowLostReason(true);
  }

  async function handleLostReasonSelect(reason: string) {
    if (!actionLead) return;
    setActionSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clients")
        .update({ sales_stage: "lost", lost_reason: reason })
        .eq("id", actionLead.id);
      if (error) { toast.error("Errore durante l'aggiornamento"); return; }
      toast.success("Lead segnato come Perso");
      removeLeadAndClose(actionLead.id);
    } finally {
      setActionSaving(false);
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Clienti Mese */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clienti Mese
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-2">
              <UserCheck className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[32px] font-bold leading-tight text-foreground">
              {clientsMonth}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Acquisiti questo mese
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

        {/* Incassato Mese */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incassato Mese
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-2">
              <Banknote className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold leading-tight text-foreground">
              {`\u20AC${incassatoMonth.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Incassi registrati questo mese</p>
          </CardContent>
        </Card>
      </div>

      {/* ====== SEZIONE 2 – Grafico Lead mese corrente ====== */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Lead Generati
          </CardTitle>
          <p className="text-sm text-muted-foreground">Mese Corrente</p>
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
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--primary)" }}
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
        {/* Prossimi Appuntamenti */}
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">
                Prossimi Appuntamenti
              </CardTitle>
              {!isViewMode && (
                <Link
                  href="/calendar"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
                >
                  Calendario
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 font-medium">
                  Nessun appuntamento in programma
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => {
                  const start = new Date(appt.start_time);
                  const end = new Date(appt.end_time);
                  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                  const durationLabel = durationMin >= 60
                    ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}min` : ""}`
                    : `${durationMin}min`;
                  const clientName = appt.clients
                    ? `${appt.clients.nome} ${appt.clients.cognome}`
                    : appt.title;

                  return (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => {
                        if (appt.client_id) {
                          router.push(`/clients?highlight=${appt.client_id}`);
                        }
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted ${
                        appt.client_id ? "cursor-pointer" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-xs font-semibold uppercase leading-none">
                          {format(start, "MMM", { locale: it })}
                        </span>
                        <span className="text-lg font-bold leading-none">
                          {format(start, "d")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {clientName}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(start, "HH:mm")} – {format(end, "HH:mm")}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>{durationLabel}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
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
                    {!isViewMode && role === 'owner' && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => openActionModal(lead)}
                        >
                          Aggiorna Stato
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

      {/* Lead Action Modal */}
      <Dialog open={!!actionLead && !showAppointmentDialog} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionLead ? `${actionLead.nome} ${actionLead.cognome}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!showLostReason ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-12"
                  disabled={actionSaving}
                  onClick={handleNonRisponde}
                >
                  {actionSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneOff className="h-4 w-4 text-blue-500" />
                  )}
                  Non Risponde
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-12"
                  onClick={handleAppuntamentoFissato}
                >
                  <CalendarPlus className="h-4 w-4 text-orange-500" />
                  Appuntamento Fissato
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-12"
                  onClick={handlePerso}
                >
                  <XCircle className="h-4 w-4 text-red-500" />
                  Perso
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Seleziona il motivo:</p>
                <Select
                  onValueChange={handleLostReasonSelect}
                  disabled={actionSaving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LOST_REASON_CONFIG) as LostReason[]).map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {LOST_REASON_CONFIG[reason].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowLostReason(false)}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Indietro
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Form Dialog (reused from clients) */}
      {actionLead && (
        <AppointmentFormDialog
          open={showAppointmentDialog}
          onOpenChange={(open) => {
            setShowAppointmentDialog(open);
            if (!open && actionLead) {
              // Re-show the action modal if appointment was cancelled
            }
          }}
          organizationId={queryOrgId ?? ""}
          clientId={actionLead.id}
          clientName={`${actionLead.nome} ${actionLead.cognome}`}
          clientNote={actionLead.note}
          onSuccess={handleAppointmentSaved}
        />
      )}
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
