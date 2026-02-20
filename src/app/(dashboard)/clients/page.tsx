'use client';

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Users, Plus, Loader2, Mail, Phone } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getClients } from "@/lib/supabase/queries";
import { CLIENT_SOURCE_CONFIG } from "@/lib/constants";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { SalesPipelineSelect } from "@/components/clients/SalesPipelineSelect";
import type { Client, SalesStage } from "@/types";

const IN_LAVORAZIONE_STAGES: SalesStage[] = [
  "responded",
  "appointment_scheduled",
];

const tabs = [
  { key: "tutti", label: "Tutti" },
  { key: "new", label: "Nuovi Lead" },
  { key: "contacted", label: "Non Risponde" },
  { key: "in_lavorazione", label: "Appuntamento Fissato" },
  { key: "appointment_completed", label: "Da Fidelizzare" },
  { key: "converted", label: "Percorsi" },
  { key: "lost", label: "Persi" },
] as const;

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<string>("new");
  const { effectiveOrgId, isAdmin, staffOrgIds, loading: orgLoading } = useOrganization();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data } = await getClients(effectiveOrgId, isAdmin, undefined, staffOrgIds);
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }, [effectiveOrgId, isAdmin, staffOrgIds]);

  useEffect(() => {
    if (orgLoading) return;
    fetchClients();
  }, [orgLoading, fetchClients]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { tutti: clients.length };
    for (const c of clients) {
      const stage = c.sales_stage ?? "new";
      if (stage === "new") counts.new = (counts.new ?? 0) + 1;
      else if (stage === "contacted") counts.contacted = (counts.contacted ?? 0) + 1;
      else if (stage === "appointment_completed")
        counts.appointment_completed = (counts.appointment_completed ?? 0) + 1;
      else if (stage === "converted") counts.converted = (counts.converted ?? 0) + 1;
      else if (stage === "lost") counts.lost = (counts.lost ?? 0) + 1;
      else if (IN_LAVORAZIONE_STAGES.includes(stage))
        counts.in_lavorazione = (counts.in_lavorazione ?? 0) + 1;
    }
    return counts;
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (activeTab === "tutti") return clients;
    if (activeTab === "in_lavorazione")
      return clients.filter((c) => IN_LAVORAZIONE_STAGES.includes(c.sales_stage ?? "new"));
    return clients.filter((c) => (c.sales_stage ?? "new") === activeTab);
  }, [clients, activeTab]);

  function handleStageChange(clientId: string, newStage: SalesStage) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, sales_stage: newStage } : c
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lead</h1>
          <p className="text-muted-foreground">
            Gestisci i lead dalle tue campagne.
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/80"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Lead
        </Button>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label} ({tabCounts[tab.key] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Caricamento lead...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Nessun lead trovato
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {activeTab === "tutti"
              ? "Inizia aggiungendo il tuo primo lead. Potrai gestire le campagne, monitorare le performance e pianificare le comunicazioni."
              : "Nessun lead con questo filtro."}
          </p>
          {activeTab === "tutti" && (
            <Button
              className="mt-6 bg-primary hover:bg-primary/80"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi il primo lead
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Contatto</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stato Cliente</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Fonte</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Data Contatto</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const sourceCfg = client.source
                  ? CLIENT_SOURCE_CONFIG[client.source]
                  : null;

                return (
                  <tr
                    key={client.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {client.nome} {client.cognome}
                        </span>
                        {client.service_interest && (
                          <span className="text-xs text-muted-foreground">
                            {client.service_interest}
                          </span>
                        )}
                        {client.telefono && (
                          <a
                            href={`tel:${client.telefono}`}
                            className="mt-1 flex items-center gap-1 text-xs text-primary hover:text-primary/80 md:hidden"
                          >
                            <Phone className="h-3 w-3" />
                            {client.telefono}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-col gap-2">
                        {client.email && (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {client.email}
                          </span>
                        )}
                        {client.telefono && (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {client.telefono}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SalesPipelineSelect
                        clientId={client.id}
                        currentStage={client.sales_stage ?? "new"}
                        currentRevenue={client.revenue}
                        onStageChange={(stage) => handleStageChange(client.id, stage)}
                        organizationId={client.organization_id!}
                        clientName={`${client.nome} ${client.cognome}`}
                      />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {sourceCfg && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sourceCfg.color}`}
                        >
                          {sourceCfg.label}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {client.created_at
                        ? new Date(client.created_at).toLocaleDateString("it-IT")
                        : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {effectiveOrgId && (
        <ClientFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          organizationId={effectiveOrgId}
          onSuccess={fetchClients}
        />
      )}
    </div>
  );
}
