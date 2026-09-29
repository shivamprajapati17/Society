/**
 * Environment access.
 *
 * NEXT_PUBLIC_* values are referenced literally so the bundler can inline them
 * into the browser bundle. Everything else is server-only and must never be
 * imported from a client component.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** True when the browser-safe Supabase credentials are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** True when server-side writes (service role) are possible. */
export function isAdminConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function serviceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

export function anthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export function resendKey(): string | undefined {
  return process.env.RESEND_API_KEY || undefined;
}

export function digestFrom(): string {
  return process.env.DIGEST_FROM || "digest@example.com";
}

export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET || undefined;
}

/** Canonical public base URL, no trailing slash. */
export function appUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
