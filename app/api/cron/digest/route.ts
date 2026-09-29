import { assertCron, isDryRun } from "@/lib/cron";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_STATUSES, type Complaint, type Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItems(rows: Complaint[]): string {
  if (rows.length === 0) return "<li>None</li>";
  return rows
    .map(
      (row) =>
        `<li><strong>${escapeHtml(row.title ?? row.raw_text.slice(0, 60))}</strong> — ${
          row.flat_no ? escapeHtml(row.flat_no) : "no flat"
        } (${row.urgency})</li>`,
    )
    .join("");
}

function buildHtml(input: {
  societyName: string;
  critical: Complaint[];
  overdue: Complaint[];
  newCount: number;
  resolvedYesterday: number;
}): string {
  const link = `${appUrl()}/app/today`;
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111">
    <h2 style="margin:0 0 4px">${escapeHtml(input.societyName)} — daily digest</h2>
    <p style="margin:0 0 16px;color:#555">
      ${input.newCount} new · ${input.critical.length} critical ·
      ${input.overdue.length} overdue · ${input.resolvedYesterday} resolved yesterday
    </p>
    <h3 style="margin:16px 0 4px">Critical</h3>
    <ul>${listItems(input.critical)}</ul>
    <h3 style="margin:16px 0 4px">Overdue</h3>
    <ul>${listItems(input.overdue)}</ul>
    <p style="margin-top:24px">
      <a href="${link}" style="background:#a2dcf6;color:#123142;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">
        Open today's queue
      </a>
    </p>
  </div>`;
}

export async function POST(request: Request) {
  return handle(async () => {
    assertCron(request);

    if (!isEmailConfigured()) {
      return Response.json({ sent: 0, skipped: "email_not_configured" });
    }

    const admin = createAdminClient();
    const { data: societies } = await admin.from("societies").select("id, name");
    const now = Date.now();

    let sent = 0;

    for (const society of (societies ?? []) as Array<{ id: string; name: string }>) {
      const { data: openRows } = await admin
        .from("complaints")
        .select("*")
        .eq("society_id", society.id)
        .in("status", OPEN_STATUSES)
        .limit(500);

      const open = (openRows ?? []) as Complaint[];
      if (open.length === 0) continue;

      const yesterday = new Date(now - DAY_MS).toISOString();
      const { count: resolvedYesterday } = await admin
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .eq("society_id", society.id)
        .eq("status", "resolved")
        .gte("resolved_at", yesterday);

      const { data: recipients } = await admin
        .from("profiles")
        .select("id")
        .eq("society_id", society.id)
        .in("role", ["committee", "admin"]);

      const emails: string[] = [];
      for (const profile of (recipients ?? []) as Array<Pick<Profile, "id">>) {
        const { data } = await admin.auth.admin.getUserById(profile.id);
        const email = data.user?.email;
        if (email) emails.push(email);
      }

      if (emails.length === 0) continue;

      if (isDryRun(request)) {
        sent += 1;
        continue;
      }

      const ok = await sendEmail({
        to: emails,
        subject: `${society.name}: ${open.length} open complaint${open.length === 1 ? "" : "s"}`,
        html: buildHtml({
          societyName: society.name,
          critical: open.filter((row) => row.urgency === "critical").slice(0, 10),
          overdue: open
            .filter(
              (row) =>
                row.sla_due_at &&
                new Date(row.sla_due_at).getTime() < now &&
                row.urgency !== "critical",
            )
            .slice(0, 10),
          newCount: open.filter((row) => row.status === "new").length,
          resolvedYesterday: resolvedYesterday ?? 0,
        }),
      });

      if (ok) sent += 1;
    }

    return Response.json({ sent });
  });
}

export { POST as GET };
