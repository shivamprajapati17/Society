import { requireSession } from "@/lib/auth";
import { loadDTOs, stripForResident } from "@/lib/complaints";
import { handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_STATUSES, type Complaint } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTION_LIMIT = 15;
const EXPANDED_LIMIT = 50;
const FETCH_LIMIT = 300;

/**
 * Documented queue order:
 * critical first, then overdue, then needs review, then by SLA due date.
 */
function queueSort(a: Complaint, b: Complaint): number {
  const criticalDiff =
    Number(b.urgency === "critical") - Number(a.urgency === "critical");
  if (criticalDiff !== 0) return criticalDiff;

  const now = Date.now();
  const aOverdue = a.sla_due_at ? new Date(a.sla_due_at).getTime() < now : false;
  const bOverdue = b.sla_due_at ? new Date(b.sla_due_at).getTime() < now : false;
  if (aOverdue !== bOverdue) return Number(bOverdue) - Number(aOverdue);

  const reviewDiff = Number(b.needs_review) - Number(a.needs_review);
  if (reviewDiff !== 0) return reviewDiff;

  const aDue = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity;
  const bDue = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity;
  return aDue - bDue;
}

export async function GET(request: Request) {
  return handle(async () => {
    const profile = await requireSession();
    const url = new URL(request.url);
    const expanded = Boolean(url.searchParams.get("more"));
    const limit = expanded ? EXPANDED_LIMIT : SECTION_LIMIT;

    const admin = createAdminClient();

    const base = admin
      .from("complaints")
      .select("*")
      .eq("society_id", profile.society_id)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);

    const scoped =
      profile.role === "resident"
        ? base.eq("reporter_id", profile.id)
        : base;

    const { data } = await scoped;
    const rows = ((data ?? []) as Complaint[]).sort(queueSort);
    const dtos = await loadDTOs(admin, rows);

    // Residents only ever see their own open complaints.
    if (profile.role === "resident") {
      return Response.json({
        mine: dtos.slice(0, limit).map((dto) => stripForResident(dto)),
      });
    }

    const now = Date.now();
    const isOverdue = (row: Complaint) =>
      row.sla_due_at ? new Date(row.sla_due_at).getTime() < now : false;

    const critical = dtos.filter((dto) => dto.urgency === "critical");
    const criticalIds = new Set(critical.map((dto) => dto.id));

    const overdue = dtos.filter(
      (dto) => !criticalIds.has(dto.id) && isOverdue(dto),
    );
    const overdueIds = new Set(overdue.map((dto) => dto.id));

    const needsReview = dtos.filter(
      (dto) =>
        dto.needs_review && !criticalIds.has(dto.id) && !overdueIds.has(dto.id),
    );
    const reviewIds = new Set(needsReview.map((dto) => dto.id));

    const mine = dtos.filter(
      (dto) =>
        dto.assignee_id === profile.id &&
        !criticalIds.has(dto.id) &&
        !overdueIds.has(dto.id) &&
        !reviewIds.has(dto.id),
    );

    return Response.json({
      critical: critical.slice(0, limit),
      overdue: overdue.slice(0, limit),
      needs_review: needsReview.slice(0, limit),
      mine: mine.slice(0, limit),
      counts: {
        critical: critical.length,
        overdue: overdue.length,
        new: dtos.filter((dto) => dto.status === "new").length,
        mine: mine.length,
      },
    });
  });
}
