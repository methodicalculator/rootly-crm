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
  Loader2,
  Mail,
  Phone,
  Briefcase,
  Clock,
  PhoneOff,
  CalendarPlus,
  XCircle,
  ArrowLeft,
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
import { CLIENT_STAGES } from "@/lib/constants/stages";
import { LOST_REASON_CONFIG } from "@/lib/constants";
import { toRomeDateStr, startOfMonthRomeISO } from "@/lib/date-utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { AppointmentFormDialog } from "@/components/clients/appointment-form-dialog";
import type { Client, LostReason } from "@/types";

interface LeadChartPoint {
  giorno: string;
  lead: number;
}

export function StudioDashboardTab({ organizationId }: { organizationId: string }) {
  const [newLeads, setNewLeads] = useState(0);
  const [clientsMonth, setClientsMonth] = useState(0);
  const [spendMonth, setSpendMonth] = useState(0);
  const [incassatoMonth, setIncassatoMonth] = useState(0);
  const [leadChartData, setLeadChartData] = useState<LeadChartPoint[]>([]);
  const [leadsToContact, setLeadsToContact] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Lead action modal state
  const [actionLead, setActionLead] = useState<Client | null>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgFilter = (q: any) => q.eq("organization_id", organizationId);

  const fetchLeadsToContact = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("organization_id", organizationId)
      .in("sales_stage", ["new", "contacted"])
      .order("created_at", { ascending: false })
      .limit(5);

    setLeadsToContact((data ?? []) as Client[]);
  }, [organizationId]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const supabase = createClient();

      const now = new Date();
      const romeToday = toRomeDateStr(now);
      const startOfMonth = startOfMonthRomeISO(now);
      const [
        leadsRes,
        clientsMonthRes,
        incassatoRes,
        chartClientsRes,
        orgCampaignsRes,
      ] = await Promise.all([
        // 1) Nuovi Lead Mese
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startOfMonth)
        ),
        // 2) Clienti Mese
        orgFilter(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .in("sales_stage", [...CLIENT_STAGES])
            .gte("created_at", startOfMonth)
        ),
        // 3) Incassato Mese
        orgFilter(
          supabase
            .from("clients")
            .select("revenue")
            .not("revenue", "is", null)
            .in("sales_stage", [...CLIENT_STAGES])
            .gte("updated_at", startOfMonth)
        ),
        // 4) Chart: clients created this month
        orgFilter(
          supabase
            .from("clients")
            .select("created_at")
            .gte("created_at", startOfMonth)
            .order("created_at", { ascending: true })
        ),
        // 5) Campaign IDs for spend calc
        orgFilter(supabase.from("campaigns").select("id")),
      ]);

      setNewLeads(leadsRes.count ?? 0);
      setClientsMonth(clientsMonthRes.count ?? 0);

      let totalIncassato = 0;
      for (const row of incassatoRes.data ?? []) {
        totalIncassato += Number((row as { revenue: number }).revenue) || 0;
      }
      setIncassatoMonth(totalIncassato);

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

      const todayDate = parseInt(romeToday.slice(8, 10));
      const monthPrefix = romeToday.slice(0, 8);
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

      setLoading(false);
    }

    fetchAll();
    fetchLeadsToContact();
  }, [organizationId, fetchLeadsToContact]);

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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="mt-1 text-xs text-muted-foreground">Aggiunti questo mese</p>
          </CardContent>
        </Card>

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
            <p className="mt-1 text-xs text-muted-foreground">Acquisiti questo mese</p>
          </CardContent>
        </Card>

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

      {/* Lead Chart */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Lead Generati
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

      {/* Lead da Contattare */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Lead da Contattare ({leadsToContact.length})
          </CardTitle>
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
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.telefono && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{lead.telefono}</span>
                        </div>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Appointment Form Dialog */}
      {actionLead && (
        <AppointmentFormDialog
          open={showAppointmentDialog}
          onOpenChange={(open) => {
            setShowAppointmentDialog(open);
          }}
          organizationId={organizationId}
          clientId={actionLead.id}
          clientName={`${actionLead.nome} ${actionLead.cognome}`}
          clientNote={actionLead.note}
          onSuccess={handleAppointmentSaved}
        />
      )}
    </div>
  );
}
