import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth";
import { loadComplaintFor, loadDTOs, logEvent } from "@/lib/complaints";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { ReopenComplaint } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Complaint } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireSession();
    const parsed = ReopenComplaint.parse(await readJson(request).catch(() => ({})));

    const admin = createAdminClient();
    const complaint = await loadComplaintFor(admin, id, profile);

    if (complaint.status !== "resolved") {
      throw new HttpError(
        400,
        "VALIDATION",
        "Only a resolved complaint can be reopened.",
      );
    }

    const { data: updated, error } = await admin
      .from("complaints")
      .update({
        status: "in_progress",
        resolved_at: null,
        reopened_count: complaint.reopened_count + 1,
      })
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .select("*")
      .single();

    if (error || !updated) {
      throw new HttpError(500, "INTERNAL", "Could not reopen the complaint.");
    }

    await logEvent(admin, {
      complaint_id: id,
      actor_id: profile.id,
      type: "reopened",
      payload: parsed?.note ? { note: parsed.note } : {},
    });

    const [dto] = await loadDTOs(admin, [updated as Complaint]);
    return NextResponse.json({ complaint: dto }, { status: 200 });
  });
}
