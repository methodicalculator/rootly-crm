import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Non autenticato" },
      { status: 401 }
    );
  }

  // Fetch profile to verify role and get organization_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return NextResponse.json(
      { success: false, error: "Accesso riservato al titolare" },
      { status: 403 }
    );
  }

  if (!profile.organization_id) {
    return NextResponse.json(
      { success: false, error: "Nessuna organizzazione associata" },
      { status: 400 }
    );
  }

  let body: {
    meta_page_id?: string;
    meta_ad_account_id?: string;
    meta_page_access_token?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON non valido" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      meta_page_id: body.meta_page_id || null,
      meta_ad_account_id: body.meta_ad_account_id || null,
      meta_page_access_token: body.meta_page_access_token || null,
    })
    .eq("id", profile.organization_id);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Errore durante il salvataggio" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
