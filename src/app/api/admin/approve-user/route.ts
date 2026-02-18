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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // 2. Parse body
  const body = await request.json();
  const { userId, organizationId, role, staffOrgIds } = body as {
    userId?: string;
    organizationId?: string;
    role?: "owner" | "staff";
    staffOrgIds?: string[];
  };

  if (!userId) {
    return NextResponse.json(
      { error: "userId è obbligatorio" },
      { status: 400 }
    );
  }

  const effectiveRole = role ?? "owner";

  if (effectiveRole === "owner" && !organizationId) {
    return NextResponse.json(
      { error: "organizationId è obbligatorio per il ruolo owner" },
      { status: 400 }
    );
  }

  if (effectiveRole === "staff" && (!staffOrgIds || staffOrgIds.length === 0)) {
    return NextResponse.json(
      { error: "staffOrgIds è obbligatorio per il ruolo staff" },
      { status: 400 }
    );
  }

  // 3. Update with admin client (bypasses RLS)
  const admin = createAdminClient();

  if (effectiveRole === "staff") {
    // Staff: set role=staff, organization_id=NULL
    const { error: profileError } = await admin
      .from("user_profiles")
      .update({ role: "staff", organization_id: null })
      .eq("id", userId);

    if (profileError) {
      console.error("approve-user staff profile error:", profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Insert staff_organizations rows
    const rows = staffOrgIds!.map((orgId) => ({
      user_id: userId,
      organization_id: orgId,
    }));

    const { error: staffError } = await admin
      .from("staff_organizations")
      .insert(rows);

    if (staffError) {
      console.error("approve-user staff_organizations error:", staffError);
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }
  } else {
    // Owner: set role=owner, organization_id=X
    const { error } = await admin
      .from("user_profiles")
      .update({ role: "owner", organization_id: organizationId })
      .eq("id", userId);

    if (error) {
      console.error("approve-user error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
