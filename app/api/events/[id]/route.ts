import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { UpdateEvent } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);
    const body = UpdateEvent.parse(await readJson(request));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("events")
      .update(body)
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .select("id, title, description, starts_at, venue")
      .maybeSingle();

    if (error) {
      throw new HttpError(500, "INTERNAL", "Could not update the event.");
    }
    if (!data) throw new HttpError(404, "NOT_FOUND", "Event not found.");

    return NextResponse.json({ event: data });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("events")
      .delete()
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new HttpError(500, "INTERNAL", "Could not remove the event.");
    }
    if (!data) throw new HttpError(404, "NOT_FOUND", "Event not found.");

    return NextResponse.json({ deleted: true });
  });
}
