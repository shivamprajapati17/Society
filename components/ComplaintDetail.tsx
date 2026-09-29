"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { StatusPill } from "@/components/StatusPill";
import { UrgencyPill } from "@/components/UrgencyPill";
import { api, errorMessage } from "@/lib/client";
import { formatAge, formatDateTime, hasDevanagari } from "@/lib/format";
import { slaRemaining } from "@/lib/sla";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type Category,
  type ComplaintComment,
  type ComplaintEvent,
  type ComplaintView,
  type Role,
  type Status,
  type Urgency,
} from "@/lib/types";

interface Props {
  id: string;
  role: Role;
  viewerId: string;
}

interface DetailResponse {
  complaint: ComplaintView;
  events: ComplaintEvent[];
  comments: ComplaintComment[];
}

interface Member {
  id: string;
  full_name: string | null;
  role: Role;
  flat_no: string | null;
}

const EVENT_TEXT: Record<string, string> = {
  created: "Complaint created",
  triaged: "AI triage finished",
  status_changed: "Status changed",
  assigned: "Assignee changed",
  category_changed: "Category changed",
  urgency_changed: "Urgency changed",
  clustered: "Grouped with a duplicate",
  reopened: "Complaint reopened",
  override: "Committee override",
};

function describeEvent(event: ComplaintEvent): string {
  const label = EVENT_TEXT[event.type] ?? event.type;
  const payload = event.payload ?? {};
  if (event.type === "status_changed") {
    const to = typeof payload.to === "string" ? payload.to : null;
    const from = typeof payload.from === "string" ? payload.from : null;
    if (to) return `${label}: ${from ?? "—"} → ${to}`;
  }
  if (event.type === "urgency_changed" || event.type === "category_changed") {
    const to = typeof payload.to === "string" ? payload.to : null;
    const from = typeof payload.from === "string" ? payload.from : null;
    if (to) return `${label}: ${from ?? "—"} → ${to}`;
  }
  if (event.type === "triaged" && typeof payload.source === "string") {
    return `${label} (${payload.source})`;
  }
  return label;
}

function stepperIndex(status: Status): number {
  return STATUSES.indexOf(status);
}

export default function ComplaintDetail({ id, role, viewerId }: Props) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [resolveNote, setResolveNote] = useState("");

  const isStaff = role !== "resident";

  const load = useCallback(async () => {
    try {
      const response = await api<DetailResponse>(`/api/complaints/${id}`);
      setData(response);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isStaff) return;
    api<{ members: Member[] }>("/api/members")
      .then((response) =>
        setMembers(response.members.filter((m) => m.role !== "resident")),
      )
      .catch(() => setMembers([]));
  }, [isStaff]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await api(`/api/complaints/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        await load();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [id, load],
  );

  async function postComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (comment.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/complaints/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment.trim(), is_internal: internal }),
      });
      setComment("");
      setInternal(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      await api(`/api/complaints/${id}/reopen`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function retriage() {
    setBusy(true);
    try {
      await api(`/api/complaints/${id}/retriage`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stack">
        <p className="banner banner-error" role="alert">
          {error ?? "Complaint not found."}
        </p>
        <Link className="btn" href="/app/complaints">
          Back to complaints
        </Link>
      </div>
    );
  }

  const complaint = data.complaint;
  const remaining = slaRemaining(complaint.sla_due_at);
  const open = complaint.status !== "resolved" && complaint.status !== "closed";
  const devanagari = hasDevanagari(complaint.raw_text);
  const currentIndex = stepperIndex(complaint.status);

  const timeline = [
    ...data.events.map((event) => ({
      id: `event-${event.id}`,
      kind: "event" as const,
      at: event.created_at,
      title: describeEvent(event),
      body: null as string | null,
      internal: false,
    })),
    ...data.comments.map((item) => ({
      id: `comment-${item.id}`,
      kind: "comment" as const,
      at: item.created_at,
      title: item.is_internal ? "Internal note" : "Comment",
      body: item.body,
      internal: item.is_internal,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="stack">
      <Link className="nav-link" href="/app/complaints">
        ← All complaints
      </Link>

      <div className="row wrap">
        <UrgencyPill urgency={complaint.urgency} />
        <StatusPill status={complaint.status} />
        {complaint.cluster_count > 1 ? (
          <span className="badge">×{complaint.cluster_count} flats</span>
        ) : null}
        {isStaff && complaint.needs_review ? (
          <span className="badge badge-review">AI unsure</span>
        ) : null}
        <span className="tiny dim">#{complaint.ref_no}</span>
      </div>

      <h1 className="h1">{complaint.title ?? "Complaint"}</h1>

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="glass card stack-sm">
        <span className="label">English summary</span>
        <p>{complaint.summary_en ?? "Not summarized yet."}</p>
        <span className="label" style={{ marginTop: 8 }}>
          Original
        </span>
        <p className="original-text" lang={devanagari ? "hi" : undefined}>
          {complaint.raw_text}
        </p>
      </section>

      <section className="glass card detail-grid">
        <div className="detail-item">
          <span className="label">Flat</span>
          <span>{complaint.flat_no ?? "—"}</span>
        </div>
        <div className="detail-item">
          <span className="label">Location</span>
          <span>{complaint.location ?? "—"}</span>
        </div>
        {isStaff ? (
          <div className="detail-item">
            <span className="label">Reported by</span>
            <span>{complaint.reporter_label ?? "Resident"}</span>
          </div>
        ) : null}
        <div className="detail-item">
          <span className="label">Created</span>
          <span>{formatDateTime(complaint.created_at)}</span>
        </div>
        <div className="detail-item">
          <span className="label">SLA due</span>
          <span className={remaining?.overdue && open ? "overdue-text" : undefined}>
            {formatDateTime(complaint.sla_due_at)}
            {open && remaining ? ` · ${remaining.label}` : ""}
          </span>
        </div>
        <div className="detail-item">
          <span className="label">Age</span>
          <span>{formatAge(complaint.created_at)}</span>
        </div>
        <div className="detail-item">
          <span className="label">Assignee</span>
          <span>{complaint.assignee?.full_name ?? "Unassigned"}</span>
        </div>
      </section>

      <section className="stack-sm">
        <span className="label">Progress</span>
        <div className="stepper">
          {STATUSES.map((value, index) => (
            <span
              key={value}
              className={`step ${
                index === currentIndex
                  ? "is-current"
                  : index < currentIndex
                    ? "is-done"
                    : ""
              }`}
            >
              {STATUS_LABELS[value]}
            </span>
          ))}
        </div>
      </section>

      {isStaff ? (
        <section className="glass card stack">
          <div className="row wrap">
            <label className="field grow" style={{ minWidth: 150 }}>
              <span className="label">Category</span>
              <select
                className="select"
                value={complaint.category}
                disabled={busy}
                onChange={(event) =>
                  patch({ category: event.target.value as Category })
                }
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field grow" style={{ minWidth: 150 }}>
              <span className="label">Urgency</span>
              <select
                className="select"
                value={complaint.urgency}
                disabled={busy}
                onChange={(event) =>
                  patch({ urgency: event.target.value as Urgency })
                }
              >
                {URGENCIES.map((value) => (
                  <option key={value} value={value}>
                    {URGENCY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field grow" style={{ minWidth: 180 }}>
              <span className="label">Assignee</span>
              <select
                className="select"
                value={complaint.assignee_id ?? ""}
                disabled={busy}
                onChange={(event) =>
                  patch({ assignee_id: event.target.value || null })
                }
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name ?? member.flat_no ?? "Committee member"}
                    {member.id === viewerId ? " (me)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row wrap">
            {open && complaint.assignee_id !== viewerId ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => patch({ assignee_id: viewerId })}
              >
                Assign to me
              </button>
            ) : null}
            {open && complaint.status !== "in_progress" ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => patch({ status: "in_progress" })}
              >
                Mark in progress
              </button>
            ) : null}
            {open ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busy}
                onClick={() => setConfirmResolve(true)}
              >
                Resolve
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={reopen}
              >
                Reopen
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={retriage}
            >
              Re-run AI
            </button>
          </div>
        </section>
      ) : null}

      {!isStaff && complaint.status === "resolved" ? (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={reopen}
        >
          Not fixed? Reopen
        </button>
      ) : null}

      <section className="stack-sm">
        <h2 className="h2">Timeline</h2>
        <div className="timeline">
          {timeline.length === 0 ? (
            <p className="muted tiny">No activity yet.</p>
          ) : (
            timeline.map((item) => (
              <div
                key={item.id}
                className={`timeline-item ${item.kind === "comment" ? "is-comment" : ""}`}
              >
                <div className="timeline-body">
                  <strong>{item.title}</strong>
                  {item.body ? (
                    <>
                      {": "}
                      <span
                        lang={hasDevanagari(item.body) ? "hi" : undefined}
                      >
                        {item.body}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="timeline-when">{formatDateTime(item.at)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <form className="glass card stack" onSubmit={postComment}>
        <label className="field">
          <span className="label">Add a comment</span>
          <textarea
            className="textarea"
            value={comment}
            maxLength={2000}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share an update…"
          />
        </label>
        {isStaff ? (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={internal}
              onChange={(event) => setInternal(event.target.checked)}
            />
            Internal note (hidden from residents)
          </label>
        ) : null}
        <button
          className="btn-primary"
          type="submit"
          disabled={busy || comment.trim().length === 0}
        >
          {busy ? "Posting…" : "Post comment"}
        </button>
      </form>

      {confirmResolve ? (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm resolve"
          onClick={() => setConfirmResolve(false)}
        >
          <div
            className="glass sheet-panel stack"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="h2">Resolve this complaint?</h2>
            <p className="muted tiny">
              The resident can reopen it within 3 days.
            </p>
            <label className="field">
              <span className="label">Note (optional)</span>
              <input
                className="input"
                value={resolveNote}
                maxLength={200}
                onChange={(event) => setResolveNote(event.target.value)}
                placeholder="e.g. Motor replaced, tested"
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                await patch({ status: "resolved" });
                if (resolveNote.trim()) {
                  try {
                    await api(`/api/complaints/${id}/comments`, {
                      method: "POST",
                      body: JSON.stringify({
                        body: resolveNote.trim(),
                        is_internal: false,
                      }),
                    });
                  } catch {
                    // The resolve already succeeded; ignore the note failure.
                  }
                }
                setResolveNote("");
                setConfirmResolve(false);
                await load();
              }}
            >
              Yes, resolve
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmResolve(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
