import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Request-scoped Supabase client using the caller's session cookies.
 *
 * Reads are subject to RLS. Writes must go through API routes with the
 * service-role client instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const setAll: SetAllCookies = (cookiesToSet) => {
    try {
      for (const { name, value, options } of cookiesToSet) {
        cookieStore.set(name, value, options);
      }
    } catch {
      // Called from a Server Component where cookies are read-only.
      // The middleware refreshes the session cookie instead.
    }
  };

  return createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll,
      },
    },
  );
}
