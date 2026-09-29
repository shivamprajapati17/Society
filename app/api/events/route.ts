import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { listEvents } from "@/lib/notices";
import { CreateEvent } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Committee/admin view of the events calendar. */
export async function GET() {
  return handle(async () => {
    const profile = await requireRole(["committee", "admin"]);
    const items = await listEvents(profile.society_id);
    return NextResponse.json({ items });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const profile = await requireRole(["committee", "admin"]);
    const body = CreateEvent.parse(await readJson(request));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("events")
      .insert({
        society_id: profile.society_id,
        title: body.title,
        description: body.description ?? null,
        starts_at: body.starts_at,
        venue: body.venue ?? null,
        created_by: profile.id,
      })
      .select("id, title, description, starts_at, venue")
      .single();

    if (error || !data) {
      throw new HttpError(500, "INTERNAL", "Could not create the event.");
    }

    return NextResponse.json({ event: data }, { status: 201 });
  });
}
