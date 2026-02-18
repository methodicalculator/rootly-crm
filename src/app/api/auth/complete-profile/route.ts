import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, phone, professionalType } = body as {
    userId?: string;
    phone?: string;
    professionalType?: string;
  };

  console.log("[COMPLETE-PROFILE] received:", { userId, phone, professionalType });

  if (!userId) {
    return NextResponse.json({ error: "userId obbligatorio" }, { status: 400 });
  }

  const admin = createAdminClient();

  // First check if the row exists (trigger may not have fired yet)
  const { data: existing, error: selectError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  console.log("[COMPLETE-PROFILE] existing row:", { existing, selectError: selectError?.message });

  if (!existing) {
    // Row doesn't exist yet — wait briefly for trigger, then retry
    console.log("[COMPLETE-PROFILE] row not found, waiting 1s...");
    await new Promise((r) => setTimeout(r, 1000));

    const { data: retry } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!retry) {
      console.error("[COMPLETE-PROFILE] row still missing after wait");
      return NextResponse.json(
        { error: "Profilo utente non ancora creato. Riprova tra qualche secondo." },
        { status: 404 }
      );
    }
  }

  const { error } = await admin
    .from("user_profiles")
    .update({
      phone: phone || null,
      professional_type: professionalType || null,
    })
    .eq("id", userId);

  console.log("[COMPLETE-PROFILE] update result:", { error: error ? JSON.stringify(error) : null });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
