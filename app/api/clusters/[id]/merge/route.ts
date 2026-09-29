import { requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/complaints";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { MergeCluster } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClusterUrgency } from "@/lib/triage";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["committee", "admin"]);
    const body = MergeCluster.parse(await readJson(request));

    if (id === body.into_cluster_id) {
      throw new HttpError(400, "VALIDATION", "Pick a different target cluster.");
    }

    const admin = createAdminClient();

    const { data: clusters } = await admin
      .from("complaint_clusters")
      .select("id")
      .eq("society_id", profile.society_id)
      .in("id", [id, body.into_cluster_id]);

    const ids = ((clusters ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length !== 2) {
      throw new HttpError(404, "NOT_FOUND", "Cluster not found.");
    }

    const { data: moved } = await admin
      .from("complaints")
      .select("id")
      .eq("cluster_id", id);

    const movedIds = ((moved ?? []) as Array<{ id: string }>).map((row) => row.id);

    await admin
      .from("complaints")
      .update({ cluster_id: body.into_cluster_id })
      .eq("cluster_id", id);

    await admin
      .from("complaint_clusters")
      .delete()
      .eq("id", id)
      .eq("society_id", profile.society_id);

    for (const complaintId of movedIds) {
      await logEvent(admin, {
        complaint_id: complaintId,
        actor_id: profile.id,
        type: "clustered",
        payload: { merged_into: body.into_cluster_id, from: id },
      });
    }

    await syncClusterUrgency(admin, body.into_cluster_id);

    return Response.json({ moved: movedIds.length });
  });
}
