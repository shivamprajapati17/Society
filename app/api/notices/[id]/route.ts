import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { UpdateNotice } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);
    const body = UpdateNotice.parse(await readJson(request));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notices")
      .update(body)
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .select("id, title, body, pinned, published_at")
      .maybeSingle();

    if (error) {
      throw new HttpError(500, "INTERNAL", "Could not update the notice.");
    }
    if (!data) throw new HttpError(404, "NOT_FOUND", "Notice not found.");

    return NextResponse.json({ notice: data });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notices")
      .delete()
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new HttpError(500, "INTERNAL", "Could not remove the notice.");
    }
    if (!data) throw new HttpError(404, "NOT_FOUND", "Notice not found.");

    return NextResponse.json({ deleted: true });
  });
}
