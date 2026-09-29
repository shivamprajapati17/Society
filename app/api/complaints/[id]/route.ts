import { NextResponse } from "next/server";

import { requireRole, requireSession } from "@/lib/auth";
import {
  canTransition,
  loadComplaintFor,
  loadDTOs,
  logEvent,
  stripForResident,
} from "@/lib/complaints";
import {
  assertSameOrigin,
  handle,
  HttpError,
  readJson,
} from "@/lib/http";
import { PatchComplaint } from "@/lib/schemas";
import { slaDueAt } from "@/lib/sla";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClusterUrgency } from "@/lib/triage";
import type { Complaint, Status } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return handle(async () => {
    const { id } = await context.params;
    const profile = await requireSession();
    const admin = createAdminClient();
    const complaint = await loadComplaintFor(admin, id, profile);

    const [dto] = await loadDTOs(admin, [complaint]);
    const isStaff = profile.role !== "resident";

    const commentsQuery = admin
      .from("comments")
      .select("*")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    const { data: comments } = isStaff
      ? await commentsQuery
      : await commentsQuery.eq("is_internal", false);

    if (!isStaff) {
      return NextResponse.json({
        complaint: stripForResident(dto!),
        events: [],
        comments: comments ?? [],
      });
    }

    const { data: events } = await admin
      .from("complaint_events")
      .select("*")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      complaint: dto,
      events: events ?? [],
      comments: comments ?? [],
    });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);
    const body = PatchComplaint.parse(await readJson(request));

    const admin = createAdminClient();
    const complaint = await loadComplaintFor(admin, id, profile);

    const patch: Record<string, unknown> = {};

    // --- status -----------------------------------------------------------
    let nextStatus: Status = complaint.status;
    if (body.status && body.status !== complaint.status) {
      if (!canTransition(complaint.status, body.status)) {
        throw new HttpError(
          400,
          "VALIDATION",
          `Cannot move a complaint from ${complaint.status} to ${body.status}.`,
        );
      }
      nextStatus = body.status;
    }

    // --- assignee ---------------------------------------------------------
    if (body.assignee_id !== undefined) {
      if (body.assignee_id === null) {
        patch.assignee_id = null;
      } else {
        const { data: assignee } = await admin
          .from("profiles")
          .select("id, role, society_id")
          .eq("id", body.assignee_id)
          .maybeSingle();

        if (
          !assignee ||
          assignee.society_id !== profile.society_id ||
          assignee.role === "resident"
        ) {
          throw new HttpError(
            400,
            "VALIDATION",
            "Assignee must be a committee member of this society.",
          );
        }
        patch.assignee_id = body.assignee_id;
        if (nextStatus === "new" || nextStatus === "triaged") {
          nextStatus = "assigned";
        }
      }
    }

    // --- urgency (affects SLA) -------------------------------------------
    const urgencyChanged =
      body.urgency !== undefined && body.urgency !== complaint.urgency;
    if (body.urgency) {
      patch.urgency = body.urgency;
      patch.sla_due_at = slaDueAt(complaint.created_at, body.urgency);
    }

    // --- category ---------------------------------------------------------
    const categoryChanged =
      body.category !== undefined && body.category !== complaint.category;
    if (body.category) patch.category = body.category;

    // --- title ------------------------------------------------------------
    if (body.title) patch.title = body.title;

    // --- cluster ----------------------------------------------------------
    if (body.cluster_id !== undefined) {
      if (body.cluster_id === null) {
        patch.cluster_id = null;
      } else {
        const { data: cluster } = await admin
          .from("complaint_clusters")
          .select("id, society_id")
          .eq("id", body.cluster_id)
          .maybeSingle();

        if (!cluster || cluster.society_id !== profile.society_id) {
          throw new HttpError(400, "VALIDATION", "Unknown cluster.");
        }
        patch.cluster_id = body.cluster_id;
      }
    }

    // A manual category/urgency edit is an override: it clears needs_review.
    if (categoryChanged || urgencyChanged) {
      patch.needs_review = false;
    }

    if (nextStatus !== complaint.status) {
      patch.status = nextStatus;
      if (nextStatus === "resolved") patch.resolved_at = new Date().toISOString();
      if (nextStatus === "closed") patch.closed_at = new Date().toISOString();
      if (nextStatus === "in_progress" && complaint.status === "resolved") {
        patch.resolved_at = null;
      }
    }

    if (Object.keys(patch).length === 0) {
      const [dto] = await loadDTOs(admin, [complaint]);
      return NextResponse.json({ complaint: dto });
    }

    const { data: updated, error } = await admin
      .from("complaints")
      .update(patch)
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .select("*")
      .single();

    if (error || !updated) {
      throw new HttpError(500, "INTERNAL", "Could not update the complaint.");
    }

    // --- events -----------------------------------------------------------
    if (patch.status) {
      await logEvent(admin, {
        complaint_id: id,
        actor_id: profile.id,
        type: "status_changed",
        payload: { from: complaint.status, to: patch.status },
      });
    }
    if (body.assignee_id !== undefined) {
      await logEvent(admin, {
        complaint_id: id,
        actor_id: profile.id,
        type: "assigned",
        payload: { assignee_id: body.assignee_id },
      });
    }
    if (categoryChanged) {
      await logEvent(admin, {
        complaint_id: id,
        actor_id: profile.id,
        type: "category_changed",
        payload: { from: complaint.category, to: body.category },
      });
    }
    if (urgencyChanged) {
      await logEvent(admin, {
        complaint_id: id,
        actor_id: profile.id,
        type: "urgency_changed",
        payload: { from: complaint.urgency, to: body.urgency },
      });
    }
    if (categoryChanged || urgencyChanged) {
      await logEvent(admin, {
        complaint_id: id,
        actor_id: profile.id,
        type: "override",
        payload: { fields: Object.keys(body) },
      });
    }

    const clusterId = (patch.cluster_id as string | null | undefined) ?? complaint.cluster_id;
    if (clusterId && (urgencyChanged || patch.status)) {
      await syncClusterUrgency(admin, clusterId);
    }

    const [dto] = await loadDTOs(admin, [updated as Complaint]);
    return NextResponse.json({ complaint: dto });
  });
}
