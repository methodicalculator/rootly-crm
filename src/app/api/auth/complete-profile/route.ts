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

  // Wait for trigger handle_new_user() to create the row (up to 10s)
  const MAX_RETRIES = 10;
  let profile = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const { data } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      profile = data;
      console.log(`[COMPLETE-PROFILE] row found on attempt ${i + 1}/${MAX_RETRIES}`);
      break;
    }

    console.log(`[COMPLETE-PROFILE] row not found, attempt ${i + 1}/${MAX_RETRIES}`);
  }

  if (!profile) {
    console.error("[COMPLETE-PROFILE] row missing after all retries");
    return NextResponse.json(
      { error: "Timeout: profilo non ancora creato. Riprova tra qualche secondo." },
      { status: 408 }
    );
  }

  // Profile exists — update only
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
