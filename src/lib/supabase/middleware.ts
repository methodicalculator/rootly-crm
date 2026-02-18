import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const isPendingPage = pathname.startsWith("/pending-approval");

  const isCallbackRoute = pathname.startsWith("/auth/callback");

  // Allow callback route to pass through
  if (isCallbackRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login (except auth pages)
  if (!user && !isAuthPage && !isPendingPage && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Check if user has been assigned to an organization
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    // DEBUG — remove after fixing
    console.log("[MIDDLEWARE DEBUG]", {
      pathname,
      userId: user.id,
      userEmail: user.email,
      profile,
      profileError: profileError?.message ?? null,
    });

    // Profile not found yet (trigger may not have fired) — let them through
    if (!profile) {
      console.log("[MIDDLEWARE DEBUG] profile is NULL → redirect to /pending-approval");
      if (!isPendingPage && !isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/pending-approval";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    const isPrivileged = profile.role === "admin" || profile.role === "super_admin";
    const isStaff = profile.role === "staff";
    const hasPendingApproval =
      !isPrivileged && !isStaff && !profile.organization_id;

    console.log("[MIDDLEWARE DEBUG]", {
      isPrivileged,
      hasPendingApproval,
      role: profile.role,
      organization_id: profile.organization_id,
    });

    if (hasPendingApproval) {
      // Pending user trying to access dashboard routes → redirect to pending page
      console.log("[MIDDLEWARE DEBUG] hasPendingApproval=true → redirect to /pending-approval");
      if (!isPendingPage && !isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/pending-approval";
        return NextResponse.redirect(url);
      }
    } else {
      // Approved user on auth/pending pages → redirect to dashboard
      if (isAuthPage || isPendingPage) {
        const dest = isPrivileged && !profile.organization_id
          ? "/admin"
          : "/dashboard";
        console.log("[MIDDLEWARE DEBUG] approved user on auth/pending → redirect to", dest);
        const url = request.nextUrl.clone();
        url.pathname = dest;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
