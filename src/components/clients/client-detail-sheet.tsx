'use client';

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Circle, CheckCircle2 } from "lucide-react";
import { clientEditSchema, type ClientEditValues } from "@/lib/validations";
import { SALES_STAGE_CONFIG, LOST_REASON_CONFIG } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { TreatmentInputField } from "@/components/clients/treatment-input-field";
import type { Client, LostReason } from "@/types";

interface ClientDetailSheetProps {
  client: Client | null;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onClientUpdated: (updated: Client) => void;
  onClientDeleted?: (clientId: string) => void;
}

interface TimelineEntry {
  date: string;
  label: string;
  completed: boolean;
}

function buildTimeline(client: Client): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (client.created_at) {
    entries.push({
      date: client.created_at,
      label: "Lead creato",
      completed: true,
    });
  }

  if (client.contacted_at) {
    entries.push({
      date: client.contacted_at,
      label: "Contattato",
      completed: true,
    });
  }

  if (client.appointment_date) {
    entries.push({
      date: client.appointment_date,
      label: `Appuntamento fissato per ${new Date(client.appointment_date).toLocaleDateString("it-IT")}`,
      completed: true,
    });
  }

  if (client.appointment_completed_at) {
    entries.push({
      date: client.appointment_completed_at,
      label: "Seduta completata",
      completed: true,
    });
  }

  if (client.sales_stage === "lost") {
    const reasonLabel = client.lost_reason
      ? LOST_REASON_CONFIG[client.lost_reason as LostReason]?.label
      : null;
    entries.push({
      date: client.updated_at,
      label: reasonLabel ? `Perso — ${reasonLabel}` : "Perso",
      completed: true,
    });
  }

  if (client.sales_stage === "converted") {
    entries.push({
      date: client.updated_at,
      label: "Percorso acquistato",
      completed: true,
    });
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientDetailSheet({
  client,
  onOpenChange,
  organizationId,
  onClientUpdated,
  onClientDeleted,
}: ClientDetailSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [treatmentInput, setTreatmentInput] = useState("");

  const form = useForm<ClientEditValues>({
    resolver: zodResolver(clientEditSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      indirizzo: "",
      citta: "",
      cap: "",
      birth_date: "",
      service_interest: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!client) return;
    const si = client.service_interest ?? "";
    form.reset({
      nome: client.nome,
      cognome: client.cognome,
      email: client.email ?? "",
      telefono: client.telefono ?? "",
      indirizzo: client.indirizzo ?? "",
      citta: client.citta ?? "",
      cap: client.cap ?? "",
      birth_date: client.birth_date ?? "",
      service_interest: si,
      note: client.note ?? "",
    });
    setTreatmentInput(si);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  async function onSubmit(values: ClientEditValues) {
    if (!client) return;
    setSubmitting(true);

    const supabase = createClient();
    const updateData = {
      nome: values.nome,
      cognome: values.cognome,
      email: values.email || null,
      telefono: values.telefono || null,
      indirizzo: values.indirizzo || null,
      citta: values.citta || null,
      cap: values.cap || null,
      birth_date: values.birth_date || null,
      service_interest: values.service_interest || null,
      note: values.note || null,
    };

    const { data, error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", client.id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      toast.error("Errore nel salvataggio", { description: error.message });
      return;
    }

    toast.success("Modifiche salvate!");
    onClientUpdated(data as Client);
  }

  async function handleDelete() {
    if (!client) return;
    setDeleting(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", client.id)
      .eq("organization_id", organizationId);

    setDeleting(false);
    setShowDeleteConfirm(false);

    if (error) {
      toast.error("Errore nell'archiviazione", { description: error.message });
      return;
    }

    toast.success("Lead archiviato");
    onOpenChange(false);
    onClientDeleted?.(client.id);
  }

  if (!client) return null;

  const stageCfg = SALES_STAGE_CONFIG[client.sales_stage ?? "new"];
  const timeline = buildTimeline(client);

  return (
    <Sheet open={!!client} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {client.nome} {client.cognome}
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${stageCfg.color}`}>
              {stageCfg.emoji} {stageCfg.label}
            </span>
          </SheetTitle>
          <SheetDescription>
            Dettaglio e modifica lead
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-6 px-4 pb-4"
        >
          {/* Informazioni */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informazioni</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-nome" className="text-xs">Nome *</Label>
                <Input id="edit-nome" {...form.register("nome")} />
                {form.formState.errors.nome && (
                  <p className="text-xs text-red-500">{form.formState.errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cognome" className="text-xs">Cognome *</Label>
                <Input id="edit-cognome" {...form.register("cognome")} />
                {form.formState.errors.cognome && (
                  <p className="text-xs text-red-500">{form.formState.errors.cognome.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-xs">Email</Label>
                <Input id="edit-email" type="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-telefono" className="text-xs">Telefono</Label>
                <Input id="edit-telefono" {...form.register("telefono")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-indirizzo" className="text-xs">Indirizzo</Label>
              <Input id="edit-indirizzo" {...form.register("indirizzo")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-citta" className="text-xs">Citt&agrave;</Label>
                <Input id="edit-citta" {...form.register("citta")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cap" className="text-xs">CAP</Label>
                <Input id="edit-cap" {...form.register("cap")} maxLength={5} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-birth_date" className="text-xs">Data di Nascita</Label>
              <Input id="edit-birth_date" type="date" {...form.register("birth_date")} />
            </div>

            {/* Trattamento Richiesto */}
            <TreatmentInputField
              value={treatmentInput}
              onChange={(val) => {
                setTreatmentInput(val);
                form.setValue("service_interest", val);
              }}
              organizationId={organizationId}
              active={!!client}
            />
          </section>

          {/* Note */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Note</h3>
            <Textarea
              {...form.register("note")}
              rows={4}
              placeholder="Nessuna nota..."
            />
          </section>

          {/* Timeline Stato */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Timeline Stato</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
            ) : (
              <div className="relative space-y-0">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-3">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center">
                      {entry.completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      {i < timeline.length - 1 && (
                        <div className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-4">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer */}
          <SheetFooter className="mt-auto px-0">
            <div className="flex w-full items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Archivia
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/80"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva Modifiche
              </Button>
            </div>
          </SheetFooter>
        </form>

        {/* Conferma eliminazione */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Archiviare questo lead?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Sei sicuro di voler archiviare <strong>{client.nome} {client.cognome}</strong>? Il lead non comparirà più nelle liste attive.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Annulla
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Archivia Lead
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
