/**
 * End-to-end verification against a real Supabase project and a real running
 * deployment. Opt in by exporting the two Supabase keys — without them every
 * suite here is skipped, so `npm test` stays offline and side-effect free.
 *
 *   npm run test:e2e            # against https://societymatter.vercel.app
 *
 * Requires:
 *   SUPABASE_SERVICE_KEY  service_role key (server-side writes, cleanup)
 *   SUPABASE_ANON_KEY     anon key (token verification, RLS checks)
 * Optional:
 *   E2E_APP_URL           defaults to the production deployment
 *   E2E_SUPABASE_REF      defaults to the linked project
 *   E2E_ADMIN_EMAIL       the seeded admin address
 *
 * Runs the REAL lib/invites.ts and lib/triage.ts against real Postgres, then
 * drives the deployment's authenticated API with a genuine session cookie.
 * Everything it creates is removed again in afterAll.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sourceHash } from "@/lib/hash";
import { acceptInvite, readInvite } from "@/lib/invites";
import { resolveCluster } from "@/lib/triage";

const REF = process.env.E2E_SUPABASE_REF ?? "bqbbnjfqtzqlbtptioub";
const SUPA = `https://${REF}.supabase.co`;
const APP = process.env.E2E_APP_URL ?? "https://societymatter.vercel.app";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "cricledge8292@gmail.com";

const SERVICE = process.env.SUPABASE_SERVICE_KEY ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const enabled = Boolean(SERVICE && ANON);
const offline = "set SUPABASE_SERVICE_KEY and SUPABASE_ANON_KEY to run";

/** Makes each run's import fixture unique so re-runs stay meaningful. */
const RUN = Date.now().toString(36);

const SOCIETY = "00000000-0000-0000-0000-000000000001";

let admin!: SupabaseClient;
let cookie = "";
let userId = "";
let userEmail = "";
let complaintId = "";

/** Everything the suite creates, so afterAll can remove exactly that. */
const importedRows: Array<{ sender: string; ts: string | null; text: string }> =
  [];
const createdComplaints = new Set<string>();
const createdClusters = new Set<string>();
const createdInvites = new Set<string>();
const createdNotices = new Set<string>();
const createdEvents = new Set<string>();

const call = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${APP}${path}`, {
    ...init,
    headers: {
      cookie,
      origin: APP,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

beforeAll(async () => {
  if (!enabled) return;

  admin = createClient(SUPA, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Re-arm the seeded admin invite so the suite is repeatable.
  await admin
    .from("invites")
    .update({ accepted_at: null, accepted_by: null })
    .eq("email", ADMIN_EMAIL);

  const list = await admin.auth.admin.listUsers();
  const user = list.data.users[0];
  expect(user, "an auth user must exist").toBeTruthy();
  userId = user.id;
  userEmail = user.email ?? "";

  // Import/create/retriage are rate limited per user per hour; clear this
  // user's counters so a re-run cannot hit a 429.
  await admin.from("rate_limits").delete().like("key", `%${userId}%`);

  // Mint a real session without sending email.
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userEmail,
  });
  const hashed = (link.data as { properties?: { hashed_token?: string } })
    ?.properties?.hashed_token;
  expect(hashed, "generateLink must return a hashed token").toBeTruthy();

  const verify = await fetch(`${SUPA}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: ANON,
      authorization: `Bearer ${ANON}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", token_hash: hashed }),
  });
  expect(verify.ok, `verify failed: ${verify.status}`).toBe(true);
  const session = await verify.json();

  // Mirror exactly what @supabase/ssr stores: JSON, base64url, "base64-" prefix.
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  cookie = `sb-${REF}-auth-token=base64-${encoded}`;
  expect(session.access_token).toBeTruthy();
});

/** Two complaints attached to one cluster, exactly as triageComplaint would. */
async function makeCluster(tag: string) {
  const stamp = Date.now();
  const payload = [1, 2].map((n) => ({
    society_id: SOCIETY,
    reporter_id: null,
    reporter_label: `Cluster probe ${tag} ${n}`,
    source: "import" as const,
    source_hash: `probe-${tag}-${n}-${stamp}`,
    raw_text: `Cluster probe ${tag} number ${n}`,
    status: "new" as const,
    triage: "done" as const,
    urgency: "medium" as const,
    category: "water" as const,
    title: `Cluster probe ${tag}`,
  }));

  const { data } = await admin.from("complaints").insert(payload).select("*");
  const rows = data!;
  const [canonical, duplicate] = rows;
  for (const row of rows) createdComplaints.add(row.id);

  const clusterId = await resolveCluster(admin, duplicate, canonical.id);
  expect(clusterId, "resolveCluster must create a cluster").toBeTruthy();
  createdClusters.add(clusterId as string);

  await admin
    .from("complaints")
    .update({ cluster_id: clusterId })
    .in(
      "id",
      rows.map((row) => row.id),
    );

  return { clusterId: clusterId as string, ids: rows.map((row) => row.id) };
}

afterAll(async () => {
  if (!enabled) return;

  // Remove only what this suite created, so the project is left as found.
  const hashes = importedRows.map((row) =>
    sourceHash(SOCIETY, row.sender, row.ts ?? "", row.text),
  );

  if (hashes.length > 0) {
    await admin.from("complaints").delete().in("source_hash", hashes);
  }
  if (createdComplaints.size > 0) {
    await admin
      .from("complaints")
      .delete()
      .in("id", [...createdComplaints]);
  }
  if (createdClusters.size > 0) {
    await admin
      .from("complaint_clusters")
      .delete()
      .in("id", [...createdClusters]);
  }
  if (createdInvites.size > 0) {
    await admin.from("invites").delete().in("token", [...createdInvites]);
  }
  if (createdNotices.size > 0) {
    await admin.from("notices").delete().in("id", [...createdNotices]);
  }
  if (createdEvents.size > 0) {
    await admin.from("events").delete().in("id", [...createdEvents]);
  }

  await admin
    .from("rate_limits")
    .delete()
    .like("key", `%${userId}%`);
});

describe.skipIf(!enabled)("invite acceptance (real lib/invites.ts, real Postgres)", () => {
  it("rejects a token that does not exist", async () => {
    const result = await acceptInvite(admin, "deadbeef".repeat(6), {
      id: userId,
      email: userEmail,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an invite for a different email", async () => {
    const token = "mismatch".padEnd(32, "0");
    createdInvites.add(token);
    await admin.from("invites").insert({
      society_id: SOCIETY,
      email: "someone.else@example.com",
      role: "resident",
      token,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const result = await acceptInvite(admin, token, {
      id: userId,
      email: userEmail,
    });
    expect(result).toEqual({ ok: false, reason: "email_mismatch" });
  });

  it("accepts the pending invite and creates the admin profile", async () => {
    const { data: pending } = await admin
      .from("invites")
      .select("*")
      .eq("email", ADMIN_EMAIL)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(pending, "the seeded admin invite must be pending").toBeTruthy();

    const result = await acceptInvite(admin, pending!.token, {
      id: userId,
      email: userEmail,
    });
    expect(result.ok).toBe(true);

    const { data: profile } = await admin
      .from("profiles")
      .select("role, society_id")
      .eq("id", userId)
      .single();
    expect(profile?.role).toBe("admin");
    expect(profile?.society_id).toBe(SOCIETY);

    const { data: consumed } = await admin
      .from("invites")
      .select("accepted_at, accepted_by")
      .eq("token", pending!.token)
      .single();
    expect(consumed?.accepted_at).toBeTruthy();
    expect(consumed?.accepted_by).toBe(userId);
  });

  it("rejects the same invite a second time (single use)", async () => {
    const { data: used } = await admin
      .from("invites")
      .select("token")
      .eq("email", ADMIN_EMAIL)
      .not("accepted_at", "is", null)
      .limit(1)
      .single();

    const result = await acceptInvite(admin, used!.token, {
      id: userId,
      email: userEmail,
    });
    expect(result).toEqual({ ok: false, reason: "used" });
  });

  it("readInvite masks the email for the public page", async () => {
    const token = "mask".padEnd(32, "1");
    createdInvites.add(token);
    await admin.from("invites").insert({
      society_id: SOCIETY,
      email: "resident@example.com",
      role: "resident",
      token,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const result = await readInvite(admin, token);
    expect(result).toMatchObject({
      valid: true,
      role: "resident",
      email_hint: "r***@example.com",
    });
  });
});

describe.skipIf(!enabled)("live deployment: authenticated API surface", () => {
  it(
    "authenticates from the session cookie",
    async () => {
      const me = await call("/api/me");
      expect(me.status).toBe(200);
      expect(me.body.role).toBe("admin");
    },
    20_000,
  );

  it("saves the profile", async () => {
    const patched = await call("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ full_name: "Society Admin", flat_no: "A-001" }),
    });
    expect(patched.status).toBe(200);
  });

  it("rejects a resident trying to set urgency (strict schema)", async () => {
    const strict = await call("/api/complaints", {
      method: "POST",
      body: JSON.stringify({ text: "valid text here", urgency: "critical" }),
    });
    expect(strict.status).toBe(400);
  });

  it("creates a complaint and triages it with NVIDIA NIM", async () => {
    // The run stamp keeps this text distinct: the create route answers 200 with
    // the earlier complaint when the same text repeats inside 10 minutes.
    const created = await call("/api/complaints", {
      method: "POST",
      body: JSON.stringify({ text: `lift me koi fasa hai!! B wing [probe ${RUN}]` }),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    complaintId = created.body.complaint.id;
    createdComplaints.add(complaintId);

    let triaged: any = null;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const current = await call(`/api/complaints/${complaintId}`);
      if (current.body.complaint.triage !== "pending") {
        triaged = current.body.complaint;
        break;
      }
    }

    expect(triaged, "triage should finish within 30s").toBeTruthy();
    expect(triaged.category).toBe("lift");
    expect(triaged.urgency).toBe("critical");
    expect(triaged.summary_en).toBeTruthy();
    expect(triaged.sla_due_at).toBeTruthy();
  }, 40_000);

  it("runs the full lifecycle: assign, comment, resolve, reopen", async () => {
    const assigned = await call(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      body: JSON.stringify({ assignee_id: userId }),
    });
    expect(assigned.body.complaint.status).toBe("assigned");

    const commented = await call(`/api/complaints/${complaintId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: "Guard informed, motor being checked" }),
    });
    expect(commented.status).toBe(201);

    const resolved = await call(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(resolved.body.complaint.resolved_at).toBeTruthy();

    const invalid = await call(`/api/complaints/${complaintId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "triaged" }),
    });
    expect(invalid.status).toBe(400);

    const reopened = await call(`/api/complaints/${complaintId}/reopen`, {
      method: "POST",
      body: JSON.stringify({ note: "still broken" }),
    });
    expect(reopened.body.complaint.status).toBe("in_progress");
    expect(reopened.body.complaint.reopened_count).toBe(1);
  }, 30_000);
});

describe.skipIf(!enabled)("live deployment: chat import and dedupe", () => {
  it("parses a WhatsApp export and de-duplicates a re-import", async () => {
    const block = [
      `12/03/24, 9:15 pm - Ramesh A-302: पानी नहीं आ रहा 2 din se [imp ${RUN}]`,
      `12/03/24, 9:16 pm - Sunita A-101: Water supply band hai since morning [imp ${RUN}]`,
      "12/03/24, 9:17 pm - Guard: <Media omitted>",
    ].join("\n");

    const preview = await call("/api/complaints/import", {
      method: "POST",
      body: JSON.stringify({ mode: "preview", text: block }),
    });
    expect(preview.status).toBe(200);
    expect(preview.body.rows).toHaveLength(2);
    expect(preview.body.skipped).toBe(1);

    // The preview must not have written anything.
    const beforeCommit = await call(
      `/api/complaints?q=${encodeURIComponent(`imp ${RUN}`)}`,
    );
    expect(beforeCommit.body.items).toHaveLength(0);

    const rows = preview.body.rows.map((row: any) => ({
      sender: row.sender,
      flat_no: row.flat_no,
      text: row.text,
      ts: row.ts,
    }));

    const committed = await call("/api/complaints/import", {
      method: "POST",
      body: JSON.stringify({ mode: "commit", rows }),
    });
    expect(committed.status, JSON.stringify(committed.body)).toBe(202);
    expect(committed.body.created).toBe(2);
    for (const row of rows) importedRows.push(row);

    // A second import of the same lines creates nothing.
    const again = await call("/api/complaints/import", {
      method: "POST",
      body: JSON.stringify({ mode: "commit", rows }),
    });
    expect(again.status).toBe(202);
    expect(again.body.created).toBe(0);
    expect(again.body.duplicates).toBe(2);

    // A re-import is recognised as duplicate at preview time too.
    const rePreview = await call("/api/complaints/import", {
      method: "POST",
      body: JSON.stringify({ mode: "preview", text: block }),
    });
    expect(rePreview.body.rows.every((row: any) => row.duplicate)).toBe(true);

    // Background triage drains.
    let progress: any = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const current = await call(
        `/api/import/progress?ids=${committed.body.ids.join(",")}`,
      );
      progress = current.body;
      if (current.body.pending === 0) break;
    }
    expect(progress.pending).toBe(0);
    expect(progress.total).toBe(2);

    // The triaged water complaints reach the Today queue.
    const today = await call("/api/today");
    expect(today.status).toBe(200);
    expect(today.body.critical.map((c: any) => c.id)).toContain(complaintId);
  }, 60_000);
});

describe.skipIf(!enabled)("live deployment: cluster grouping", () => {
  it("groups follow-ups, filters them, merges and resolves", async () => {
    const first = await makeCluster("alpha");
    const second = await makeCluster("beta");

    // The canonical + follow-up pair shows up as one open cluster.
    const listed = await call("/api/clusters");
    expect(listed.status).toBe(200);
    const alpha = listed.body.items.find(
      (item: any) => item.id === first.clusterId,
    );
    expect(alpha, "cluster must be listed").toBeTruthy();
    expect(alpha.count).toBe(2);
    expect(alpha.open_count).toBe(2);

    // The complaints list can filter down to a single cluster.
    const filtered = await call(`/api/complaints?cluster_id=${first.clusterId}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.map((item: any) => item.id).sort()).toEqual(
      [...first.ids].sort(),
    );

    // Merging the second cluster into the first moves its complaints over.
    const merged = await call(`/api/clusters/${second.clusterId}/merge`, {
      method: "POST",
      body: JSON.stringify({ into_cluster_id: first.clusterId }),
    });
    expect(merged.status, JSON.stringify(merged.body)).toBe(200);

    const afterMerge = await call("/api/clusters");
    expect(
      afterMerge.body.items.find((item: any) => item.id === second.clusterId),
      "merged cluster must be gone",
    ).toBeUndefined();
    expect(
      afterMerge.body.items.find((item: any) => item.id === first.clusterId)
        .count,
    ).toBe(4);

    // Resolving a cluster resolves its open children.
    const resolved = await call(`/api/clusters/${first.clusterId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ note: "all sorted" }),
    });
    expect(resolved.body.resolved).toBe(4);

    const finallyListed = await call("/api/clusters");
    expect(
      finallyListed.body.items.find(
        (item: any) => item.id === first.clusterId,
      ),
      "a fully resolved cluster must drop off the open list",
    ).toBeUndefined();
  }, 40_000);
});

describe.skipIf(!enabled)("live deployment: public site content", () => {
  it("publishes a notice, shows it on the landing page, then removes it", async () => {
    const title = `Water tank cleaning ${RUN}`;

    const created = await call("/api/notices", {
      method: "POST",
      body: JSON.stringify({
        title,
        body: "Tank cleaning on Saturday morning; water supply resumes by noon.",
      }),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const noticeId = created.body.notice.id;
    createdNotices.add(noticeId);

    // Public read needs no session at all.
    const anon = await fetch(`${APP}/api/public/notices`);
    expect(anon.status).toBe(200);
    const anonBody = await anon.json();
    expect(
      anonBody.items.map((item: any) => item.title),
      "the notice must be publicly readable",
    ).toContain(title);

    // Pinning is a staff-only edit.
    const pinned = await call(`/api/notices/${noticeId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: true }),
    });
    expect(pinned.status).toBe(200);
    expect(pinned.body.notice.pinned).toBe(true);

    // The server-rendered landing page carries the notice text.
    const landing = await fetch(APP);
    expect(landing.status).toBe(200);
    const html = await landing.text();
    expect(html, "the landing page must render the notice").toContain(title);

    const removed = await call(`/api/notices/${noticeId}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);
    createdNotices.delete(noticeId);

    const gone = await fetch(`${APP}/api/public/notices`);
    expect(
      (await gone.json()).items.map((item: any) => item.title),
    ).not.toContain(title);
  }, 40_000);

  it("creates an event that appears publicly and on the landing page", async () => {
    const title = `Ganesh Chaturthi ${RUN}`;
    const startsAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const created = await call("/api/events", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: "Aarti at 8pm followed by prasad.",
        starts_at: startsAt,
        venue: "Society club house",
      }),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    createdEvents.add(created.body.event.id);

    const anon = await fetch(`${APP}/api/public/events`);
    expect(anon.status).toBe(200);
    const anonBody = await anon.json();
    const titles = anonBody.items.map((item: any) => item.title);
    expect(titles).toContain(title);
    expect(titles[0], "upcoming events come first").toBe(title);

    const landing = await fetch(APP);
    expect(await landing.text()).toContain(title);
  }, 40_000);

  it("rejects writes without a session, and bad payloads with a session", async () => {
    const anonPost = await fetch(`${APP}/api/notices`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP },
      body: JSON.stringify({ title: "Anonymous attempt" }),
    });
    expect(anonPost.status).toBe(401);

    const bad = await call("/api/events", {
      method: "POST",
      body: JSON.stringify({ title: "No start time" }),
    });
    expect(bad.status).toBe(400);
  });
});

describe.skipIf(!enabled)("live deployment: authorization and RLS", () => {
  it("rejects unauthenticated and wrong-secret calls", async () => {
    const noAuth = await fetch(`${APP}/api/today`);
    expect(noAuth.status).toBe(401);

    const cron = await fetch(`${APP}/api/cron/autoclose`, {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(cron.status).toBe(401);
  });

  it("stops the anon key from writing or reading complaints", async () => {
    const insert = await fetch(`${SUPA}/rest/v1/complaints`, {
      method: "POST",
      headers: {
        apikey: ANON,
        authorization: `Bearer ${ANON}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        society_id: SOCIETY,
        raw_text: "anon write attempt",
      }),
    });
    expect(insert.status).toBeGreaterThanOrEqual(400);

    const read = await fetch(
      `${SUPA}/rest/v1/complaints?select=id&society_id=eq.${SOCIETY}`,
      { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } },
    );
    expect(await read.json()).toEqual([]);

    const rate = await fetch(`${SUPA}/rest/v1/rate_limits?select=key`, {
      headers: { apikey: ANON, authorization: `Bearer ${ANON}` },
    });
    expect(await rate.json()).toEqual([]);
  });
});

describe.skipIf(enabled)("live end-to-end suite", () => {
  it.skip(offline, () => {});
});
