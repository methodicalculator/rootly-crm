import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaLeadSchema } from "@/lib/webhooks/schemas";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate payload
  const parsed = metaLeadSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // meta_page_id: body takes priority, then query param
  const metaPageId =
    data.meta_page_id || request.nextUrl.searchParams.get("meta_page_id");

  if (!metaPageId) {
    return NextResponse.json(
      { success: false, error: "meta_page_id is required (body or query param)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Resolve organization by meta_page_id
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("meta_page_id", metaPageId)
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { success: false, error: "Organization not found for this meta_page_id" },
      { status: 404 }
    );
  }

  if (org.status !== "active") {
    return NextResponse.json(
      { success: false, error: "Organization is not active" },
      { status: 403 }
    );
  }

  // Split full_name into nome/cognome
  const nameParts = data.full_name.trim().split(/\s+/);
  const nome = nameParts[0];
  const cognome = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // Insert client
  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({
      organization_id: org.id,
      nome,
      cognome,
      email: data.email || null,
      telefono: data.phone || null,
      note: data.notes || null,
      source: "meta_ads",
      status: "attivo",
      first_contact_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { success: false, error: "Failed to create contact" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, contact_id: client.id },
    { status: 201 }
  );
}
