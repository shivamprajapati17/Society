import { after } from "next/server";

import { requireRole } from "@/lib/auth";
import { runWithConcurrency } from "@/lib/concurrency";
import {
  assertSameOrigin,
  enforceRateLimit,
  handle,
  HttpError,
} from "@/lib/http";
import { sourceHash } from "@/lib/hash";
import { MAX_IMPORT_LINES, parseChat } from "@/lib/parse-chat";
import { ImportRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { triageComplaint } from "@/lib/triage";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100 * 1024;
const TRIAGE_CONCURRENCY = 5;

interface PreviewRow {
  sender: string;
  flat_no: string | null;
  text: string;
  ts: string | null;
  duplicate: boolean;
  hash: string;
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const profile = await requireRole(["committee", "admin"]);

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      throw new HttpError(400, "VALIDATION", "Import is limited to 100KB.");
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "VALIDATION", "Body must be valid JSON.");
    }

    const body = ImportRequest.parse(parsedBody);

    await enforceRateLimit(`import:${profile.id}`, 5);

    const admin = createAdminClient();

    if (body.mode === "preview") {
      const { rows, skipped } = parseChat(body.text, MAX_IMPORT_LINES);

      const withHash: PreviewRow[] = rows.map((row) => ({
        ...row,
        hash: sourceHash(profile.society_id, row.sender, row.ts ?? "", row.text),
        duplicate: false,
      }));

      const hashes = withHash.map((row) => row.hash);
      if (hashes.length > 0) {
        const { data: existing } = await admin
          .from("complaints")
          .select("source_hash")
          .eq("society_id", profile.society_id)
          .in("source_hash", hashes);

        const seen = new Set(
          ((existing ?? []) as Array<{ source_hash: string | null }>).map(
            (row) => row.source_hash,
          ),
        );

        const inBatch = new Set<string>();
        for (const row of withHash) {
          if (seen.has(row.hash)) {
            row.duplicate = true;
            continue;
          }
          if (inBatch.has(row.hash)) {
            row.duplicate = true;
            continue;
          }
          inBatch.add(row.hash);
        }
      }

      return Response.json({
        rows: withHash.map((row) => ({
          sender: row.sender,
          flat_no: row.flat_no,
          text: row.text,
          ts: row.ts,
          duplicate: row.duplicate,
        })),
        skipped,
      });
    }

    // --- commit -----------------------------------------------------------
    const payload = body.rows.map((row) => ({
      society_id: profile.society_id,
      reporter_id: null,
      reporter_label: row.sender || null,
      flat_no: row.flat_no,
      source: "import" as const,
      // Must match the preview hash exactly (society + sender + date + text),
      // otherwise a re-import would look new in the preview and then be
      // silently skipped by the unique index.
      source_hash: sourceHash(
        profile.society_id,
        row.sender,
        row.ts ?? "",
        row.text,
      ),
      raw_text: row.text,
      status: "new" as const,
      triage: "pending" as const,
    }));

    const { data: inserted, error } = await admin
      .from("complaints")
      .upsert(payload, {
        onConflict: "society_id,source_hash",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      console.error(`[import] insert failed: ${error.code}`);
      throw new HttpError(500, "INTERNAL", "Could not import the complaints.");
    }

    const created = (inserted ?? []) as Array<{ id: string }>;
    const ids = created.map((row) => row.id);

    if (ids.length > 0) {
      await admin.from("complaint_events").insert(
        ids.map((id) => ({
          complaint_id: id,
          actor_id: profile.id,
          type: "created",
          payload: { source: "import" },
        })),
      );

      const targetIds = [...ids];
      after(async () => {
        const worker = createAdminClient();
        await runWithConcurrency(targetIds, TRIAGE_CONCURRENCY, async (id) => {
          await triageComplaint(worker, id, null);
        });
      });
    }

    return Response.json(
      {
        created: ids.length,
        duplicates: payload.length - ids.length,
        ids,
      },
      { status: 202 },
    );
  });
}
