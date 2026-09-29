import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { listNotices } from "@/lib/notices";
import { CreateNotice } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Committee/admin view of the notice board, including drafts' order. */
export async function GET() {
  return handle(async () => {
    const profile = await requireRole(["committee", "admin"]);
    const items = await listNotices(profile.society_id);
    return NextResponse.json({ items });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const profile = await requireRole(["committee", "admin"]);
    const body = CreateNotice.parse(await readJson(request));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notices")
      .insert({
        society_id: profile.society_id,
        title: body.title,
        body: body.body ?? null,
        pinned: body.pinned ?? false,
        created_by: profile.id,
      })
      .select("id, title, body, pinned, published_at")
      .single();

    if (error || !data) {
      throw new HttpError(500, "INTERNAL", "Could not publish the notice.");
    }

    return NextResponse.json({ notice: data }, { status: 201 });
  });
}
