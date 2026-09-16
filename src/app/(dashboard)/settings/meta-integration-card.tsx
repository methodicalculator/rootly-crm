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

interface MetaIntegrationCardProps {
  organizationId: string;
}

export function MetaIntegrationCard({ organizationId }: MetaIntegrationCardProps) {
  const [metaPageId, setMetaPageId] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("meta_page_id, meta_ad_account_id")
        .eq("id", organizationId)
        .single();

      if (data) {
        setMetaPageId(data.meta_page_id ?? "");
        setMetaAdAccountId(data.meta_ad_account_id ?? "");
      }
      setLoading(false);
    }
    load();
  }, [organizationId]);

  const isConfigured = !!(metaPageId && metaAdAccountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings/meta-integration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta_page_id: metaPageId,
          meta_ad_account_id: metaAdAccountId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Errore durante il salvataggio");
        return;
      }

      toast.success("Configurazione Meta salvata");
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
          <CardTitle>Integrazione Meta Ads</CardTitle>
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
            <CardTitle>Integrazione Meta Ads</CardTitle>
            <CardDescription>
              Configura la connessione diretta con Meta Lead Ads
            </CardDescription>
          </div>
          {metaPageId || metaAdAccountId ? (
            isConfigured ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Configurata
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Incompleta
              </Badge>
            )
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meta_page_id">Facebook Page ID</Label>
            <Input
              id="meta_page_id"
              placeholder="es: 123456789012345"
              value={metaPageId}
              onChange={(e) => setMetaPageId(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta_ad_account_id">Meta Ad Account ID</Label>
            <Input
              id="meta_ad_account_id"
              placeholder="es: 123456789012345"
              value={metaAdAccountId}
              onChange={(e) => setMetaAdAccountId(e.target.value)}
            />
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
