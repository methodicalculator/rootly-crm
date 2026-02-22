import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  let notificationsCreated = 0;

  // ─── Check 1: Incasso non aggiornato ───
  // Clients with appointment_scheduled, appointment in the past, no conversion_amount
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();

  const { data: incassoClients } = await supabase
    .from("clients")
    .select("id, organization_id, nome, cognome, appointment_date")
    .eq("sales_stage", "appointment_scheduled")
    .is("conversion_amount", null)
    .lt("appointment_date", now.toISOString())
    .not("appointment_date", "is", null);

  for (const client of incassoClients ?? []) {
    if (!client.organization_id) continue;

    const appointmentTime = new Date(client.appointment_date!).getTime();
    const hoursSinceAppointment = (now.getTime() - appointmentTime) / (1000 * 60 * 60);

    // Determine which reminder to send
    let message: string;
    if (hoursSinceAppointment >= 12) {
      message = `Promemoria: incasso non registrato per ${client.nome} ${client.cognome}`;
    } else if (hoursSinceAppointment >= 6) {
      message = `Ricorda di aggiornare l'incasso per ${client.nome} ${client.cognome}`;
    } else {
      continue; // appointment was less than 6h ago
    }

    // Dedup: check if this exact notification already exists
    const { data: existing } = await supabase
      .from("notifications")
      .select("id, message")
      .eq("client_id", client.id)
      .eq("type", "incasso_non_aggiornato")
      .limit(10);

    const isReminder = message.startsWith("Promemoria:");
    const alreadySent = (existing ?? []).some((n) =>
      isReminder
        ? n.message.startsWith("Promemoria:")
        : !n.message.startsWith("Promemoria:")
    );

    if (alreadySent) continue;

    // Get all users in this organization
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("organization_id", client.organization_id);

    for (const user of users ?? []) {
      await supabase.from("notifications").insert({
        organization_id: client.organization_id,
        user_id: user.id,
        type: "incasso_non_aggiornato",
        message,
        client_id: client.id,
      });
      notificationsCreated++;
    }
  }

  // ─── Check 2: Lead non contattato ───
  // Clients with sales_stage 'new' created more than 12h ago
  const { data: newLeads } = await supabase
    .from("clients")
    .select("id, organization_id, nome, cognome")
    .eq("sales_stage", "new")
    .lt("created_at", twelveHoursAgo);

  for (const client of newLeads ?? []) {
    if (!client.organization_id) continue;

    // Dedup: check if notification already exists for this client + type
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("type", "lead_non_contattato");

    if ((count ?? 0) > 0) continue;

    const message = `${client.nome} ${client.cognome} non è ancora stato contattato`;

    // Get all users in this organization
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("organization_id", client.organization_id);

    for (const user of users ?? []) {
      await supabase.from("notifications").insert({
        organization_id: client.organization_id,
        user_id: user.id,
        type: "lead_non_contattato",
        message,
        client_id: client.id,
      });
      notificationsCreated++;
    }
  }

  return NextResponse.json({
    ok: true,
    notificationsCreated,
    timestamp: now.toISOString(),
  });
}
