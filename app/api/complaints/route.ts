import { after, NextResponse } from "next/server";

import { requireRole, requireSession } from "@/lib/auth";
import { loadDTOs, logEvent, stripForResident } from "@/lib/complaints";
import {
  assertSameOrigin,
  enforceRateLimit,
  handle,
  HttpError,
  readJson,
} from "@/lib/http";
import { CreateComplaint, ListComplaintsQuery } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { triageComplaint } from "@/lib/triage";
import type { Complaint } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url")
      .toString("utf8")
      .split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Search terms are stripped of PostgREST filter syntax characters. */
function sanitizeSearch(value: string): string {
  return value.replace(/[%,()\\]/g, "").trim();
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const profile = await requireRole(["resident", "committee", "admin"]);
    const body = CreateComplaint.parse(await readJson(request));

    await enforceRateLimit(`create:${profile.id}`, 20);

    const admin = createAdminClient();

    // Duplicate tap protection: identical text from the same user in 10 min.
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const { data: existing } = await admin
      .from("complaints")
      .select("*")
      .eq("reporter_id", profile.id)
      .eq("raw_text", body.text)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const [dto] = await loadDTOs(admin, [existing as Complaint]);
      return NextResponse.json({ complaint: dto }, { status: 200 });
    }

    const flatNo =
      profile.role === "resident"
        ? profile.flat_no
        : (body.flat_no ?? profile.flat_no);

    const { data, error } = await admin
      .from("complaints")
      .insert({
        society_id: profile.society_id,
        reporter_id: profile.id,
        flat_no: flatNo,
        source: "web",
        raw_text: body.text,
        status: "new",
        triage: "pending",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(500, "INTERNAL", "Could not save the complaint.");
    }

    const complaint = data as Complaint;
    await logEvent(admin, {
      complaint_id: complaint.id,
      actor_id: profile.id,
      type: "created",
      payload: { source: "web" },
    });

    const complaintId = complaint.id;
    after(async () => {
      await triageComplaint(createAdminClient(), complaintId, null);
    });

    const [dto] = await loadDTOs(admin, [complaint]);
    return NextResponse.json({ complaint: dto }, { status: 201 });
  });
}

export async function GET(request: Request) {
  return handle(async () => {
    const profile = await requireSession();
    const url = new URL(request.url);

    const raw: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (value !== "") raw[key] = value;
    });
    const query = ListComplaintsQuery.parse(raw);

    const admin = createAdminClient();
    const limit = query.limit ?? 20;

    let builder = admin
      .from("complaints")
      .select("*")
      .eq("society_id", profile.society_id);

    if (profile.role === "resident") {
      builder = builder.eq("reporter_id", profile.id);
    }

    if (query.status) builder = builder.eq("status", query.status);
    if (query.category) builder = builder.eq("category", query.category);
    if (query.urgency) builder = builder.eq("urgency", query.urgency);
    if (query.cluster_id) builder = builder.eq("cluster_id", query.cluster_id);
    if (query.mine === "1") builder = builder.eq("assignee_id", profile.id);

    const search = query.q ? sanitizeSearch(query.q) : "";
    if (search) {
      builder = builder.or(
        `title.ilike.%${search}%,raw_text.ilike.%${search}%`,
      );
    }

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (cursor) {
        builder = builder.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
        );
      }
    }

    const { data, error } = await builder
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (error) {
      console.error(`[complaints] list failed: ${error.code}`);
      throw new HttpError(500, "INTERNAL", "Could not load complaints.");
    }

    const rows = (data ?? []) as Complaint[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const dtos = await loadDTOs(admin, page);

    const items =
      profile.role === "resident"
        ? dtos.map((dto) => stripForResident(dto))
        : dtos;

    const last = page[page.length - 1];
    return NextResponse.json({
      items,
      next_cursor:
        hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    });
  });
}
