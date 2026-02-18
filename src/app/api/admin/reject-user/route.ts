import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // 1. Verify the caller is an admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // 2. Parse body
  const body = await request.json();
  const { userId } = body as { userId?: string };

  if (!userId) {
    return NextResponse.json({ error: "userId obbligatorio" }, { status: 400 });
  }

  // 3. Delete with admin client (bypasses RLS)
  const admin = createAdminClient();

  // Delete from user_profiles first (FK cascade handles related rows)
  const { error: profileError } = await admin
    .from("user_profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    console.error("reject-user profile delete error:", profileError);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Delete from Supabase Auth
  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    console.error("reject-user auth delete error:", authError);
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
