"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function PendingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (profile?.organization_id) {
        router.push("/dashboard");
        router.refresh();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [supabase, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 text-6xl">&#x23F3;</div>
        <CardTitle className="text-2xl">
          Account in Attesa di Approvazione
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Il tuo account è stato creato con successo!
        </p>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <p className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-200">
            Prossimi Passi:
          </p>
          <ol className="list-inside list-decimal space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li>Un amministratore di Horizon One verificherà il tuo account</li>
            <li>Ti assegnerà al tuo studio/organizzazione</li>
            <li>Riceverai un&apos;email quando il tuo account sarà attivo</li>
          </ol>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Questo processo richiede normalmente meno di 24 ore.
        </p>

        <div className="border-t pt-4">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Hai bisogno di aiuto?
          </p>
          <p className="text-center text-sm">
            Contatta{" "}
            <a
              href="mailto:support@horizonone.it"
              className="text-primary hover:underline"
            >
              support@horizonone.it
            </a>
          </p>
        </div>

        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Logout
        </Button>
      </CardContent>
    </Card>
  );
}
