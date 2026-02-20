import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["admin", "staff", "owner"] as const;
type AssignableRole = (typeof VALID_ROLES)[number];

export async function POST(request: NextRequest) {
  // 1. Auth guard — verify caller is admin/super_admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = callerProfile?.role;

  if (callerRole !== "admin" && callerRole !== "super_admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  // 2. Parse & validate body
  const body = await request.json();
  const { userId, role } = body as {
    userId?: string;
    role?: string;
  };

  if (!userId) {
    return NextResponse.json(
      { error: "userId è obbligatorio" },
      { status: 400 }
    );
  }

  if (!role || !VALID_ROLES.includes(role as AssignableRole)) {
    return NextResponse.json(
      { error: "role deve essere uno tra: admin, staff, owner" },
      { status: 400 }
    );
  }

  // 3. Hierarchy check — only super_admin can assign admin role
  if (callerRole !== "super_admin" && role === "admin") {
    return NextResponse.json(
      { error: "Solo super_admin può assegnare il ruolo admin" },
      { status: 403 }
    );
  }

  // 4. Prevent changing super_admin users
  const admin = createAdminClient();

  const { data: targetProfile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (targetProfile?.role === "super_admin") {
    return NextResponse.json(
      { error: "Non è possibile modificare il ruolo di un super_admin" },
      { status: 403 }
    );
  }

  // 5. Update role + access_level
  const { error } = await admin
    .from("user_profiles")
    .update({
      role,
      access_level: role,
    })
    .eq("id", userId);

  if (error) {
    console.error("[ASSIGN-ROLE] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
