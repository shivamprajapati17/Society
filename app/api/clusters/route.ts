import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_STATUSES, type Cluster } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ClusterSummary extends Cluster {
  count: number;
  open_count: number;
}

export async function GET() {
  return handle(async () => {
    const profile = await requireRole(["committee", "admin"]);
    const admin = createAdminClient();

    const { data: clusters } = await admin
      .from("complaint_clusters")
      .select("*")
      .eq("society_id", profile.society_id)
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = (clusters ?? []) as Cluster[];
    if (rows.length === 0) return Response.json({ items: [] });

    const { data: children } = await admin
      .from("complaints")
      .select("cluster_id, status")
      .eq("society_id", profile.society_id)
      .in(
        "cluster_id",
        rows.map((row) => row.id),
      );

    const totals = new Map<string, { count: number; open: number }>();
    for (const child of (children ?? []) as Array<{
      cluster_id: string | null;
      status: string;
    }>) {
      if (!child.cluster_id) continue;
      const entry = totals.get(child.cluster_id) ?? { count: 0, open: 0 };
      entry.count += 1;
      if (OPEN_STATUSES.includes(child.status as never)) entry.open += 1;
      totals.set(child.cluster_id, entry);
    }

    const items: ClusterSummary[] = rows
      .map((row) => ({
        ...row,
        count: totals.get(row.id)?.count ?? 0,
        open_count: totals.get(row.id)?.open ?? 0,
      }))
      .filter((row) => row.open_count > 0);

    return Response.json({ items });
  });
}
