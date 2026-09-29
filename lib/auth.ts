import { cache } from "react";

import { isAdminConfigured } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Validated session user. Always uses `auth.getUser()` (server-verified JWT),
 * never `getSession()`.
 */
export const getSessionUser = cache(
  async (): Promise<SessionUser | null> => {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      return { id: user.id, email: user.email ?? null };
    } catch {
      return null;
    }
  },
);

/** Profile row for the signed-in user, or null. */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  if (!isAdminConfigured()) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
});

/**
 * Guard used by every /api handler. Throws 401 when signed out and 403 when
 * the caller's role is not allowed.
 */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) {
    throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }
  if (!roles.includes(profile.role)) {
    throw new HttpError(403, "FORBIDDEN", "You do not have access to this action.");
  }
  return profile;
}

/** Any signed-in role. */
export function requireSession(): Promise<Profile> {
  return requireRole(["resident", "committee", "admin"]);
}

export function isCommittee(role: Role): boolean {
  return role === "committee" || role === "admin";
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}
