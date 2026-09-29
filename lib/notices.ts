import type { SupabaseClient } from "@supabase/supabase-js";

import { isAdminConfigured, societyId } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public website content: notices and events
 * (09-WEBSITE-TEMPLATE-PROMPT.md §5).
 *
 * Reads never throw: the landing page must render even when the database is
 * unreachable or the deployment is not fully configured yet.
 */

export interface Notice {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  published_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  venue: string | null;
}

const NOTICE_FIELDS = "id, title, body, pinned, published_at";
const EVENT_FIELDS = "id, title, description, starts_at, venue";

function admin(): SupabaseClient | null {
  if (!isAdminConfigured()) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** Pinned first, then newest. */
export async function listNotices(
  societyIdOverride?: string,
): Promise<Notice[]> {
  const client = admin();
  if (!client) return [];

  const id = societyIdOverride ?? societyId();
  const { data, error } = await client
    .from("notices")
    .select(NOTICE_FIELDS)
    .eq("society_id", id)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []) as Notice[];
}

/**
 * Upcoming first; when nothing is scheduled the most recent past events are
 * returned so the section is never blank for a quiet society.
 */
export async function listEvents(
  societyIdOverride?: string,
): Promise<EventItem[]> {
  const client = admin();
  if (!client) return [];

  const id = societyIdOverride ?? societyId();
  const now = new Date().toISOString();

  const upcoming = await client
    .from("events")
    .select(EVENT_FIELDS)
    .eq("society_id", id)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(12);

  if (!upcoming.error && upcoming.data && upcoming.data.length > 0) {
    return upcoming.data as EventItem[];
  }

  const recent = await client
    .from("events")
    .select(EVENT_FIELDS)
    .eq("society_id", id)
    .order("starts_at", { ascending: false })
    .limit(6);

  if (recent.error) return [];
  return (recent.data ?? []) as EventItem[];
}

/** The newest published notice, for the hero card. */
export function latestNotice(items: Notice[]): Notice | null {
  return items[0] ?? null;
}

/** The soonest upcoming event, for the hero card. */
export function nextEvent(items: EventItem[]): EventItem | null {
  return items[0] ?? null;
}

/** Real count of flat profiles, used by the hero chip (never a fake number). */
export async function residentCount(): Promise<number> {
  const client = admin();
  if (!client) return 0;

  const { count } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("society_id", societyId());

  return count ?? 0;
}
