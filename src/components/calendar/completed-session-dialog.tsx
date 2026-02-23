"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentWithClient } from "@/types";

type Mode = "choice" | "singola" | "percorso";

interface CompletedSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithClient | null;
  onComplete: () => void;
}

export function CompletedSessionDialog({
  open,
  onOpenChange,
  appointment,
  onComplete,
}: CompletedSessionDialogProps) {
  const [mode, setMode] = useState<Mode>("choice");
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [sessionsCount, setSessionsCount] = useState("");

  function handleOpenChange(value: boolean) {
    if (!value) {
      setMode("choice");
      setAmount("");
      setSessionsCount("");
    }
    onOpenChange(value);
  }

  async function handleConfirm() {
    if (!appointment || !appointment.client_id) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Inserisci un importo valido");
      return;
    }

    if (mode === "percorso") {
      const parsedSessions = parseInt(sessionsCount, 10);
      if (isNaN(parsedSessions) || parsedSessions < 1) {
        toast.error("Inserisci un numero di sedute valido");
        return;
      }
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      // Fetch current revenue to accumulate
      const { data: clientData } = await supabase
        .from("clients")
        .select("revenue")
        .eq("id", appointment.client_id)
        .single();
      const currentRevenue = clientData?.revenue ?? 0;

      const isSingola = mode === "singola";
      const clientUpdate: Record<string, unknown> = {
        sales_stage: isSingola ? "appointment_completed" : "converted",
        appointment_completed_at: new Date().toISOString(),
        revenue: currentRevenue + parsedAmount,
        sessions_count: isSingola ? 1 : parseInt(sessionsCount, 10),
      };

      // Update client
      const { error: clientErr } = await supabase
        .from("clients")
        .update(clientUpdate)
        .eq("id", appointment.client_id);

      if (clientErr) {
        toast.error("Errore nell'aggiornamento del lead", {
          description: clientErr.message,
        });
        return;
      }

      // Mark appointment as completed (same pattern as cancel — UPDATE not DELETE due to RLS)
      const { error: apptErr } = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointment.id);

      if (apptErr) {
        toast.error("Errore nell'aggiornamento dell'appuntamento", {
          description: apptErr.message,
        });
        return;
      }

      toast.success(
        isSingola
          ? "Singola seduta registrata!"
          : "Percorso registrato!"
      );
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "choice" && "Seduta Completata"}
            {mode === "singola" && "Singola Seduta"}
            {mode === "percorso" && "Percorso"}
          </DialogTitle>
        </DialogHeader>

        {mode === "choice" && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">{clientName}</p>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setMode("singola")}
            >
              💆 Singola Seduta
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setMode("percorso")}
            >
              💰 Percorso
            </Button>
          </div>
        )}

        {mode === "singola" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{clientName}</p>

            <div className="space-y-2">
              <Label htmlFor="amount-singola">Importo (€) *</Label>
              <Input
                id="amount-singola"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setMode("choice"); setAmount(""); }}>
                Indietro
              </Button>
              <Button
                disabled={!amount || submitting}
                onClick={handleConfirm}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conferma
              </Button>
            </div>
          </div>
        )}

        {mode === "percorso" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{clientName}</p>

            <div className="space-y-2">
              <Label htmlFor="amount-percorso">Importo (€) *</Label>
              <Input
                id="amount-percorso"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessions-count">Numero Sedute *</Label>
              <Input
                id="sessions-count"
                type="number"
                min="1"
                step="1"
                placeholder="es. 10"
                value={sessionsCount}
                onChange={(e) => setSessionsCount(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setMode("choice"); setAmount(""); setSessionsCount(""); }}>
                Indietro
              </Button>
              <Button
                disabled={!amount || !sessionsCount || submitting}
                onClick={handleConfirm}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conferma
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
