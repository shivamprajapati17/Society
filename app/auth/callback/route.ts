import { NextResponse } from "next/server";

import { isAdminConfigured } from "@/lib/env";
import { acceptInvite } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

/** Exchanges the PKCE code, accepts an invite when present, then routes home. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const inviteToken =
    url.searchParams.get("invite") ?? url.searchParams.get("invite_token");

  if (!code) return redirect(request, "/login?error=missing_code");

  if (!isAdminConfigured()) {
    return redirect(request, "/login?error=not_configured");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    // Log the error class and code only — never the code, tokens or email.
    console.error(
      `[auth] exchange failed: ${error?.name ?? "no_user"} / ${error?.code ?? "-"} / ${error?.status ?? "-"}`,
    );
    return redirect(request, "/login?error=exchange_failed");
  }

  const admin = createAdminClient();

  if (inviteToken) {
    const result = await acceptInvite(admin, inviteToken, {
      id: data.user.id,
      email: data.user.email ?? null,
    });
    if (!result.ok) {
      return redirect(request, `/login?error=invite_${result.reason}`);
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    return redirect(request, "/login?error=no_invite");
  }

  if (!profile.full_name) {
    return redirect(request, "/app/profile-setup");
  }

  return redirect(request, "/app/today");
}
