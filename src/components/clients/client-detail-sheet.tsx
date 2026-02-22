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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Circle, CheckCircle2 } from "lucide-react";
import { clientEditSchema, type ClientEditValues } from "@/lib/validations";
import { SALES_STAGE_CONFIG, LOST_REASON_CONFIG, CLIENT_SOURCE_CONFIG } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Client, LostReason } from "@/types";

interface ClientDetailSheetProps {
  client: Client | null;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onClientUpdated: (updated: Client) => void;
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
}: ClientDetailSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");

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
      tags: [],
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        nome: client.nome,
        cognome: client.cognome,
        email: client.email ?? "",
        telefono: client.telefono ?? "",
        indirizzo: client.indirizzo ?? "",
        citta: client.citta ?? "",
        cap: client.cap ?? "",
        birth_date: client.birth_date ?? "",
        service_interest: client.service_interest ?? "",
        note: client.note ?? "",
        tags: client.tags ?? [],
      });
      setTagInput("");
    }
  }, [client, form]);

  const tags = form.watch("tags") ?? [];

  function addTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    form.setValue("tags", [...tags, trimmed]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    form.setValue("tags", tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

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
      tags: values.tags && values.tags.length > 0 ? values.tags : null,
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

  if (!client) return null;

  const stageCfg = SALES_STAGE_CONFIG[client.sales_stage ?? "new"];
  const sourceCfg = client.source ? CLIENT_SOURCE_CONFIG[client.source] : null;
  const timeline = buildTimeline(client);
  const isWebhookSource = client.source === "meta_ads" || client.source === "google_ads";

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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Servizio di Interesse</Label>
                <Select
                  value={form.watch("service_interest") ?? ""}
                  onValueChange={(val) => form.setValue("service_interest", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                    <SelectItem value="Osteopatia">Osteopatia</SelectItem>
                    <SelectItem value="Massoterapia">Massoterapia</SelectItem>
                    <SelectItem value="Riflessologia">Riflessologia</SelectItem>
                    <SelectItem value="Altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fonte Lead</Label>
                {isWebhookSource && sourceCfg ? (
                  <div className="flex h-9 items-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sourceCfg.color}`}>
                      {sourceCfg.label}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-9 items-center">
                    <span className="text-sm text-muted-foreground">
                      {sourceCfg ? sourceCfg.label : "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>
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

          {/* Tags */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Tags</h3>
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length === 0 ? "es. lombalgia, urgente..." : ""}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Premi Invio o virgola per aggiungere un tag
            </p>
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
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/80"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Modifiche
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
