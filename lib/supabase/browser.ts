"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Browser Supabase client. Read-only from the app's perspective: RLS grants
 * SELECT only, every mutation goes through /api/*.
 */
export function createSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      publicEnv.supabaseUrl,
      publicEnv.supabaseAnonKey,
    );
  }
  return client;
}
