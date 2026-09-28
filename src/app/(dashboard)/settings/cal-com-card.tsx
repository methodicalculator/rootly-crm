"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CalComCardProps {
  organizationId: string;
}

export function CalComCard({ organizationId }: CalComCardProps) {
  const [calComLink, setCalComLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("cal_com_link")
        .eq("id", organizationId)
        .single();

      if (data) {
        setCalComLink(data.cal_com_link ?? "");
      }
      setLoading(false);
    }
    load();
  }, [organizationId]);

  const isConfigured = !!calComLink;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings/cal-com", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cal_com_link: calComLink,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Errore durante il salvataggio");
        return;
      }

      toast.success("Configurazione Cal.com salvata");
    } catch {
      toast.error("Errore di rete");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prenotazione Appuntamenti</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Prenotazione Appuntamenti</CardTitle>
            <CardDescription>
              Configura il link Cal.com per la prenotazione appuntamenti (facoltativo)
            </CardDescription>
          </div>
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Cal.com Attivo
            </Badge>
          ) : (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Calendario Interno
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cal_com_link">Link Cal.com (facoltativo)</Label>
            <Input
              id="cal_com_link"
              placeholder="es: nome-cognome/prima-visita"
              value={calComLink}
              onChange={(e) => setCalComLink(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Facoltativo. Se lo inserisci, gli appuntamenti si prenotano tramite Cal.com; altrimenti si usa il calendario interno.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Configurazione
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
