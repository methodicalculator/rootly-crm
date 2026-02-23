"use client";

import { format, differenceInMinutes } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STATUS_CONFIG } from "@/lib/constants";
import type { AppointmentWithClient, AppointmentStatus } from "@/types";

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithClient | null;
  onComplete?: (appointment: AppointmentWithClient) => void;
  onCancel?: (appointment: AppointmentWithClient) => void;
}

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  onComplete,
  onCancel,
}: AppointmentDetailDialogProps) {
  if (!appointment) return null;

  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const durationMin = differenceInMinutes(end, start);
  const durationLabel =
    durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}min` : ""}`
      : `${durationMin} min`;

  const clientName = appointment.clients
    ? `${appointment.clients.nome} ${appointment.clients.cognome}`
    : "—";

  const statusCfg = APPOINTMENT_STATUS_CONFIG[appointment.status as AppointmentStatus];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Dettaglio Appuntamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <span className="text-muted-foreground">Lead</span>
            <p className="font-medium text-foreground">{clientName}</p>
          </div>

          <div>
            <span className="text-muted-foreground">Data</span>
            <p className="font-medium capitalize text-foreground">
              {format(start, "EEEE d MMMM yyyy", { locale: it })}
            </p>
          </div>

          <div>
            <span className="text-muted-foreground">Orario</span>
            <p className="font-medium text-foreground">
              {format(start, "HH:mm")} – {format(end, "HH:mm")}
            </p>
          </div>

          <div>
            <span className="text-muted-foreground">Durata</span>
            <p className="font-medium text-foreground">{durationLabel}</p>
          </div>

          <div>
            <span className="text-muted-foreground">Stato</span>
            <p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}
              >
                {statusCfg.label}
              </span>
            </p>
          </div>

          {appointment.notes && (
            <div>
              <span className="text-muted-foreground">Note</span>
              <p className="whitespace-pre-wrap text-foreground">
                {appointment.notes}
              </p>
            </div>
          )}

          {(onComplete || onCancel) && (
            <div className="flex flex-col gap-2 mt-2">
              {onComplete && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    onOpenChange(false);
                    onComplete(appointment);
                  }}
                >
                  Seduta Completata
                </Button>
              )}
              {onCancel && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    onCancel(appointment);
                  }}
                >
                  Cancella Appuntamento
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
