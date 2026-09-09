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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface MetaIntegrationCardProps {
  organizationId: string;
}

export function MetaIntegrationCard({ organizationId }: MetaIntegrationCardProps) {
  const [metaPageId, setMetaPageId] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaPageAccessToken, setMetaPageAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("meta_page_id, meta_ad_account_id, meta_page_access_token")
        .eq("id", organizationId)
        .single();

      if (data) {
        setMetaPageId(data.meta_page_id ?? "");
        setMetaAdAccountId(data.meta_ad_account_id ?? "");
        setMetaPageAccessToken(data.meta_page_access_token ?? "");
      }
      setLoading(false);
    }
    load();
  }, [organizationId]);

  const isConfigured = !!(metaPageId && metaAdAccountId && metaPageAccessToken);

  function maskToken(token: string) {
    if (!token) return "";
    if (token.length <= 4) return token;
    return "\u2022".repeat(Math.min(token.length - 4, 20)) + token.slice(-4);
  }

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
          meta_page_access_token: metaPageAccessToken,
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
          {metaPageId || metaAdAccountId || metaPageAccessToken ? (
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

          <div className="space-y-1.5">
            <Label htmlFor="meta_page_access_token">Page Access Token</Label>
            <div className="relative">
              <Input
                id="meta_page_access_token"
                type={showToken ? "text" : "password"}
                placeholder="Token di accesso della pagina"
                value={showToken ? metaPageAccessToken : (metaPageAccessToken ? maskToken(metaPageAccessToken) : "")}
                onChange={(e) => {
                  if (showToken) {
                    setMetaPageAccessToken(e.target.value);
                  }
                }}
                onFocus={() => {
                  if (!showToken) setShowToken(true);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token di lunga durata per la pagina Facebook collegata
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
