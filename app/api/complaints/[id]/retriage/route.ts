import { after } from "next/server";

import { requireRole } from "@/lib/auth";
import { loadComplaintFor } from "@/lib/complaints";
import { assertSameOrigin, enforceRateLimit, handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { triageComplaint } from "@/lib/triage";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);

    await enforceRateLimit(`retriage:${profile.id}`, 5);

    const admin = createAdminClient();
    await loadComplaintFor(admin, id, profile);

    await admin.from("complaints").update({ triage: "pending" }).eq("id", id);

    after(async () => {
      await triageComplaint(createAdminClient(), id, profile.id);
    });

    return Response.json({ ok: true }, { status: 202 });
  });
}
