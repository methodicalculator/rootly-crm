import { createAdminClient } from "@/lib/supabase/admin";
import { toRomeDateStr } from "@/lib/date-utils";

interface InsertLeadParams {
  organizationId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  serviceInterest?: string | null;
}

export async function insertLead(
  params: InsertLeadParams
): Promise<{ clientId: string } | { error: string }> {
  const nameParts = params.fullName.trim().split(/\s+/);
  const nome = nameParts[0];
  const cognome = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const supabase = createAdminClient();

  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({
      organization_id: params.organizationId,
      nome,
      cognome,
      email: params.email || null,
      telefono: params.phone || null,
      note: params.note || null,
      service_interest: params.serviceInterest || null,
      source: "meta_ads",
      status: "attivo",
      first_contact_date: toRomeDateStr(new Date()),
    })
    .select("id")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  return { clientId: client.id };
}
