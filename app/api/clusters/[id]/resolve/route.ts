import { requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/complaints";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { ResolveCluster } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);
    const body = ResolveCluster.parse(await readJson(request));

    const admin = createAdminClient();

    const { data: cluster } = await admin
      .from("complaint_clusters")
      .select("id")
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .maybeSingle();

    if (!cluster) throw new HttpError(404, "NOT_FOUND", "Cluster not found.");

    const { data: children } = await admin
      .from("complaints")
      .select("id")
      .eq("cluster_id", id)
      .in("status", OPEN_STATUSES);

    const ids = ((children ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) return Response.json({ resolved: 0 });

    const now = new Date().toISOString();
    await admin
      .from("complaints")
      .update({ status: "resolved", resolved_at: now })
      .in("id", ids);

    for (const complaintId of ids) {
      await logEvent(admin, {
        complaint_id: complaintId,
        actor_id: profile.id,
        type: "status_changed",
        payload: {
          to: "resolved",
          via: "cluster",
          cluster_id: id,
          note: body.note ?? null,
        },
      });
    }

    return Response.json({ resolved: ids.length });
  });
}
