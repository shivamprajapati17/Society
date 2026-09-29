import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const profile = await requireRole(["committee", "admin"]);
    const url = new URL(request.url);

    const ids = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, 300);

    if (ids.length === 0) {
      return Response.json({ done: 0, total: 0, failed: 0, pending: 0 });
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from("complaints")
      .select("id, triage")
      .eq("society_id", profile.society_id)
      .in("id", ids);

    const rows = (data ?? []) as Array<{ id: string; triage: string }>;
    const done = rows.filter((row) => row.triage === "done").length;
    const failed = rows.filter((row) => row.triage === "failed").length;

    return Response.json({
      done,
      failed,
      pending: Math.max(ids.length - done - failed, 0),
      total: ids.length,
    });
  });
}
