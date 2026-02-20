"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMinutes } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { createClient } from "@/lib/supabase/client";
import {
  appointmentFormSchema,
  type AppointmentFormValues,
} from "@/lib/validations";
import { toRomeDateStr, toRomeTimestamp } from "@/lib/date-utils";
import { createAppointmentRecord } from "@/lib/supabase/queries";
import {
  APPOINTMENT_TIME_SLOTS,
  APPOINTMENT_DURATION_OPTIONS,
  LOST_REASON_CONFIG,
} from "@/lib/constants";
import type { AppointmentWithClient, LostReason } from "@/types";

const LOST_REASONS: LostReason[] = [
  "disdetta",
  "non_presentato",
  "non_interessato",
  "contatto_falso",
];

type Mode = "choice" | "reschedule" | "lost";

interface CancelAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithClient | null;
  onComplete: () => void;
}

export function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onComplete,
}: CancelAppointmentDialogProps) {
  const [mode, setMode] = useState<Mode>("choice");
  const [submitting, setSubmitting] = useState(false);
  const [lostReason, setLostReason] = useState<LostReason | "">("");

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      date: undefined,
      time: "",
      duration: 60,
      notes: "",
    },
  });

  function handleOpenChange(value: boolean) {
    if (!value) {
      setMode("choice");
      setLostReason("");
      form.reset();
    }
    onOpenChange(value);
  }

  async function handleReschedule(values: AppointmentFormValues) {
    if (!appointment) return;
    setSubmitting(true);
    try {
      const supabase = createClient();

      // Delete old appointment
      const { error: delErr } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointment.id);

      if (delErr) {
        toast.error("Errore nell'eliminazione dell'appuntamento", {
          description: delErr.message,
        });
        return;
      }

      // Create new appointment
      const clientName = appointment.clients
        ? `${appointment.clients.nome} ${appointment.clients.cognome}`
        : appointment.title;

      const dateStr = toRomeDateStr(values.date);
      const startISO = toRomeTimestamp(dateStr, values.time);
      const endISO = addMinutes(new Date(startISO), values.duration).toISOString();

      const { error: createErr } = await createAppointmentRecord(
        {
          client_id: appointment.client_id!,
          title: `Appuntamento - ${clientName}`,
          start_time: startISO,
          end_time: endISO,
          notes: values.notes || null,
        },
        appointment.organization_id
      );

      if (createErr) {
        toast.error("Errore nella creazione del nuovo appuntamento", {
          description: createErr.message,
        });
        return;
      }

      toast.success("Appuntamento riprogrammato!");
      handleOpenChange(false);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLostConfirm() {
    if (!appointment || !lostReason) return;
    setSubmitting(true);
    try {
      const supabase = createClient();

      // Delete appointment
      const { error: delErr } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointment.id);

      if (delErr) {
        toast.error("Errore nell'eliminazione dell'appuntamento", {
          description: delErr.message,
        });
        return;
      }

      // Update client as lost
      const { error: updErr } = await supabase
        .from("clients")
        .update({
          sales_stage: "lost",
          lost_reason: lostReason,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", appointment.client_id!);

      if (updErr) {
        toast.error("Errore nell'aggiornamento del lead", {
          description: updErr.message,
        });
        return;
      }

      toast.success("Lead segnato come perso");
      handleOpenChange(false);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  const clientName = appointment?.clients
    ? `${appointment.clients.nome} ${appointment.clients.cognome}`
    : "—";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "choice" && "Cosa vuoi fare con questo contatto?"}
            {mode === "reschedule" && "Riprogramma Appuntamento"}
            {mode === "lost" && "Segna come Perso"}
          </DialogTitle>
        </DialogHeader>

        {mode === "choice" && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">{clientName}</p>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setMode("reschedule")}
            >
              📅 Riprogramma Appuntamento
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setMode("lost")}
            >
              ❌ Segna come Perso
            </Button>
          </div>
        )}

        {mode === "reschedule" && (
          <form
            onSubmit={form.handleSubmit(handleReschedule)}
            className="space-y-4"
          >
            <p className="text-sm text-muted-foreground">{clientName}</p>

            <div className="space-y-2">
              <Label>Data *</Label>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    locale={it}
                    disabled={{ before: new Date() }}
                    className="rounded-md border mx-auto"
                  />
                )}
              />
              {form.formState.errors.date && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orario *</Label>
                <Controller
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleziona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {APPOINTMENT_TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.time && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.time.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Durata *</Label>
                <Controller
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleziona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {APPOINTMENT_DURATION_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={String(opt.value)}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.duration && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.duration.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reschedule-notes">Note</Label>
              <Textarea
                id="reschedule-notes"
                {...form.register("notes")}
                rows={3}
                placeholder="Note opzionali..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("choice")}
              >
                Indietro
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salva Appuntamento
              </Button>
            </div>
          </form>
        )}

        {mode === "lost" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{clientName}</p>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select
                value={lostReason}
                onValueChange={(v) => setLostReason(v as LostReason)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {LOST_REASON_CONFIG[reason].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMode("choice")}>
                Indietro
              </Button>
              <Button
                variant="destructive"
                disabled={!lostReason || submitting}
                onClick={handleLostConfirm}
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Conferma
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
