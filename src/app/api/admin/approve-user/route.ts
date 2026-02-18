import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // 1. Verify the caller is an admin via their session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin && !profile?.is_super_admin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // 2. Parse body
  const body = await request.json();
  const { userId, organizationId } = body as {
    userId?: string;
    organizationId?: string;
  };

  if (!userId || !organizationId) {
    return NextResponse.json(
      { error: "userId e organizationId sono obbligatori" },
      { status: 400 }
    );
  }

  // 3. Update with admin client (bypasses RLS)
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ organization_id: organizationId })
    .eq("id", userId);

  if (error) {
    console.error("approve-user error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
