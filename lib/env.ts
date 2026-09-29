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

/** True when AI triage can run (otherwise the rule-based fallback is used). */
export function isTriageConfigured(): boolean {
  return Boolean(nvidiaKey());
}

export function serviceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

/** NVIDIA NIM API key (server only). */
export function nvidiaKey(): string | undefined {
  return process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY || undefined;
}

/**
 * Model used for triage. Verified against the sample complaints in
 * 07-IMPLEMENTATION-PLAN.md before being set as the default.
 */
export function nvidiaModel(): string {
  return process.env.NVIDIA_MODEL || "moonshotai/kimi-k3";
}

/** NIM is OpenAI-compatible, so the base URL is configurable per account. */
export function nvidiaBaseUrl(): string {
  return (
    process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
  ).replace(/\/+$/, "");
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
