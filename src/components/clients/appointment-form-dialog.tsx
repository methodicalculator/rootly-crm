"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMinutes } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Loader2 } from "lucide-react";
import {
  appointmentFormSchema,
  type AppointmentFormValues,
} from "@/lib/validations";
import { toRomeDateStr, toRomeTimestamp } from "@/lib/date-utils";
import { createAppointmentRecord } from "@/lib/supabase/queries";
import {
  APPOINTMENT_TIME_SLOTS,
  APPOINTMENT_DURATION_OPTIONS,
} from "@/lib/constants";

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  clientId: string;
  clientName: string;
  onSuccess: (appointmentDateISO: string) => void;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  organizationId,
  clientId,
  clientName,
  onSuccess,
}: AppointmentFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      date: undefined,
      time: "",
      duration: 60,
      notes: "",
    },
  });

  async function onSubmit(values: AppointmentFormValues) {
    setSubmitting(true);
    try {
      const dateStr = toRomeDateStr(values.date);
      const startISO = toRomeTimestamp(dateStr, values.time);
      const endISO = addMinutes(new Date(startISO), values.duration).toISOString();

      const { error } = await createAppointmentRecord(
        {
          client_id: clientId,
          title: `Appuntamento - ${clientName}`,
          start_time: startISO,
          end_time: endISO,
          notes: values.notes || null,
        },
        organizationId
      );

      if (error) {
        toast.error("Errore nella creazione dell'appuntamento", {
          description: error.message,
        });
        return;
      }

      toast.success("Appuntamento fissato!");
      form.reset();
      onOpenChange(false);
      onSuccess(startISO);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(value: boolean) {
    if (!value) form.reset();
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fissa Appuntamento</DialogTitle>
          <DialogDescription>{clientName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Calendar inline */}
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

          {/* Time + Duration */}
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
                        <SelectItem key={opt.value} value={String(opt.value)}>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="appointment-notes">Note</Label>
            <Textarea
              id="appointment-notes"
              {...form.register("notes")}
              rows={3}
              placeholder="Note opzionali..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/80"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Appuntamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
