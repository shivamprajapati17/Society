import { createClient } from "@supabase/supabase-js";

import { publicEnv, serviceRoleKey } from "@/lib/env";
import { HttpError } from "@/lib/http";

/**
 * Service-role client. Bypasses RLS — server only, after requireRole().
 * Never import this from a client component.
 */
export function createAdminClient() {
  const key = serviceRoleKey();
  if (!publicEnv.supabaseUrl || !key) {
    throw new HttpError(
      500,
      "INTERNAL",
      "Server is not configured: Supabase service role key is missing.",
    );
  }

  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
