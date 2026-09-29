import { assertCron, isDryRun } from "@/lib/cron";
import { handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Closes complaints that were resolved more than 3 days ago. */
export async function POST(request: Request) {
  return handle(async () => {
    assertCron(request);
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - THREE_DAYS_MS).toISOString();

    const { data } = await admin
      .from("complaints")
      .select("id")
      .eq("status", "resolved")
      .lt("resolved_at", cutoff)
      .limit(500);

    const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) return Response.json({ closed: 0 });
    if (isDryRun(request)) return Response.json({ closed: 0, would_close: ids.length });

    const now = new Date().toISOString();
    await admin
      .from("complaints")
      .update({ status: "closed", closed_at: now })
      .in("id", ids);

    await admin.from("complaint_events").insert(
      ids.map((id) => ({
        complaint_id: id,
        actor_id: null,
        type: "status_changed",
        payload: { to: "closed", via: "autoclose" },
      })),
    );

    return Response.json({ closed: ids.length });
  });
}

export { POST as GET };
