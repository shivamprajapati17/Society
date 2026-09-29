import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "@/lib/http";
import type { Complaint, ComplaintDTO, Profile, Status } from "@/lib/types";
import { OPEN_STATUSES } from "@/lib/types";

export interface DTOContext {
  clusterCounts: Map<string, number>;
  assignees: Map<string, { id: string; full_name: string | null }>;
}

/** Loads cluster sizes and assignee names for a page of complaints. */
export async function loadDTOContext(
  admin: SupabaseClient,
  rows: Complaint[],
): Promise<DTOContext> {
  const clusterIds = Array.from(
    new Set(rows.map((row) => row.cluster_id).filter((id): id is string => !!id)),
  );
  const assigneeIds = Array.from(
    new Set(rows.map((row) => row.assignee_id).filter((id): id is string => !!id)),
  );

  const clusterCounts = new Map<string, number>();
  const assignees = new Map<string, { id: string; full_name: string | null }>();

  if (clusterIds.length > 0) {
    const { data } = await admin
      .from("complaints")
      .select("cluster_id")
      .in("cluster_id", clusterIds);
    for (const row of (data ?? []) as Array<{ cluster_id: string | null }>) {
      if (!row.cluster_id) continue;
      clusterCounts.set(row.cluster_id, (clusterCounts.get(row.cluster_id) ?? 0) + 1);
    }
  }

  if (assigneeIds.length > 0) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", assigneeIds);
    for (const row of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
      assignees.set(row.id, { id: row.id, full_name: row.full_name });
    }
  }

  return { clusterCounts, assignees };
}

export function toDTO(row: Complaint, ctx: DTOContext): ComplaintDTO {
  return {
    ...row,
    ai_confidence:
      row.ai_confidence === null || row.ai_confidence === undefined
        ? null
        : Number(row.ai_confidence),
    cluster_count: row.cluster_id
      ? (ctx.clusterCounts.get(row.cluster_id) ?? 1)
      : 1,
    assignee: row.assignee_id
      ? (ctx.assignees.get(row.assignee_id) ?? null)
      : null,
  };
}

/** Residents never see AI internals or the original chat sender label. */
export function stripForResident(dto: ComplaintDTO): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...dto };
  delete clone.ai_confidence;
  delete clone.ai_reason;
  delete clone.needs_review;
  delete clone.reporter_label;
  delete clone.source_hash;
  return clone;
}

export async function loadDTOs(
  admin: SupabaseClient,
  rows: Complaint[],
): Promise<ComplaintDTO[]> {
  const ctx = await loadDTOContext(admin, rows);
  return rows.map((row) => toDTO(row, ctx));
}

export async function logEvent(
  admin: SupabaseClient,
  event: {
    complaint_id: string;
    actor_id: string | null;
    type:
      | "created"
      | "triaged"
      | "status_changed"
      | "assigned"
      | "category_changed"
      | "urgency_changed"
      | "clustered"
      | "reopened"
      | "override";
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("complaint_events").insert({
    complaint_id: event.complaint_id,
    actor_id: event.actor_id,
    type: event.type,
    payload: event.payload ?? {},
  });
}

/** Allowed status transitions (08-API.md). */
const TRANSITIONS: Record<Status, Status[]> = {
  new: ["triaged", "assigned", "in_progress", "resolved"],
  triaged: ["assigned", "in_progress", "resolved"],
  assigned: ["in_progress", "resolved", "triaged"],
  in_progress: ["resolved", "assigned"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export const OPEN = OPEN_STATUSES;

/**
 * Loads a complaint and enforces tenant + resident scoping.
 * A mismatch returns 404 (never 403) so ids cannot be probed.
 */
export async function loadComplaintFor(
  admin: SupabaseClient,
  id: string,
  profile: Profile,
): Promise<Complaint> {
  const { data } = await admin
    .from("complaints")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const complaint = data as Complaint | null;
  const notFound = new HttpError(404, "NOT_FOUND", "Complaint not found.");

  if (!complaint) throw notFound;
  if (complaint.society_id !== profile.society_id) throw notFound;
  if (profile.role === "resident" && complaint.reporter_id !== profile.id) {
    throw notFound;
  }

  return complaint;
}
