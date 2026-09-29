import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth";
import { loadComplaintFor } from "@/lib/complaints";
import {
  assertSameOrigin,
  enforceRateLimit,
  handle,
  HttpError,
  readJson,
} from "@/lib/http";
import { CreateComment } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireSession();
    const body = CreateComment.parse(await readJson(request));

    await enforceRateLimit(`comment:${profile.id}`, 60);

    const admin = createAdminClient();
    await loadComplaintFor(admin, id, profile);

    // Residents can never write internal notes.
    const isInternal =
      profile.role === "resident" ? false : (body.is_internal ?? false);

    const { data, error } = await admin
      .from("comments")
      .insert({
        complaint_id: id,
        author_id: profile.id,
        body: body.body,
        is_internal: isInternal,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(500, "INTERNAL", "Could not post the comment.");
    }

    return NextResponse.json({ comment: data }, { status: 201 });
  });
}
