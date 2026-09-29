"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { StatusPill } from "@/components/StatusPill";
import { UrgencyPill } from "@/components/UrgencyPill";
import { api, errorMessage } from "@/lib/client";
import { formatAge, formatDateTime, hasDevanagari } from "@/lib/format";
import { slaRemaining } from "@/lib/sla";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type Category,
  type ComplaintView,
  type Role,
  type Urgency,
} from "@/lib/types";

interface Props {
  complaint: ComplaintView;
  role: Role;
  viewerId: string;
  onChanged?: () => void;
}

const POLL_INTERVAL_MS = 2000;
// NIM triage runs in the background; poll long enough to cover a slow model.
const POLL_TIMEOUT_MS = 25000;

export default function ComplaintCard({
  complaint: initial,
  role,
  viewerId,
  onChanged,
}: Props) {
  const [complaint, setComplaint] = useState<ComplaintView>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  useEffect(() => {
    setComplaint(initial);
  }, [initial]);

  const isStaff = role !== "resident";

  // Poll while AI triage is still running (max 15s).
  const triage = complaint.triage;
  useEffect(() => {
    if (triage !== "pending" || !isStaff) return;

    let cancelled = false;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > POLL_TIMEOUT_MS) {
        clearInterval(timer);
        return;
      }
      try {
        const data = await api<{ complaint: ComplaintView }>(
          `/api/complaints/${complaint.id}`,
        );
        if (cancelled || !data.complaint) return;
        setComplaint((prev) => ({ ...prev, ...data.complaint }));
        if (data.complaint.triage !== "pending") {
          clearInterval(timer);
          changedRef.current?.();
        }
      } catch {
        // Polling failures are silent; the next tick retries.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [triage, complaint.id, isStaff]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const data = await api<{ complaint: ComplaintView }>(
          `/api/complaints/${complaint.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
        setComplaint((prev) => ({ ...prev, ...data.complaint }));
        changedRef.current?.();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [complaint.id],
  );

  const reopen = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ complaint: ComplaintView }>(
        `/api/complaints/${complaint.id}/reopen`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setComplaint((prev) => ({ ...prev, ...data.complaint }));
      changedRef.current?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [complaint.id]);

  const remaining = slaRemaining(complaint.sla_due_at);
  const open = complaint.status !== "resolved" && complaint.status !== "closed";
  const devanagari = hasDevanagari(complaint.raw_text);

  return (
    <article className="glass complaint-card">
      <div className="row wrap">
        <UrgencyPill urgency={complaint.urgency} />
        <StatusPill status={complaint.status} />
        {complaint.cluster_count > 1 ? (
          <span className="badge">
            {CATEGORY_ICONS[complaint.category]} ×{complaint.cluster_count} flats
          </span>
        ) : null}
        {isStaff && complaint.needs_review ? (
          <span className="badge badge-review">AI unsure</span>
        ) : null}
        {complaint.triage === "pending" ? (
          <span className="badge" aria-live="polite">
            Sorting…
          </span>
        ) : null}
      </div>

      <div>
        <h3 className="complaint-title">
          {complaint.title ?? complaint.raw_text.slice(0, 80)}
        </h3>
        {complaint.summary_en ? (
          <p className="summary-line" style={{ marginTop: 4 }}>
            {complaint.summary_en}
          </p>
        ) : null}
      </div>

      <div className="complaint-meta">
        <span>#{complaint.ref_no}</span>
        <span>
          {CATEGORY_ICONS[complaint.category]} {CATEGORY_LABELS[complaint.category]}
        </span>
        <span>{complaint.flat_no ?? complaint.location ?? "Flat not given"}</span>
        <span>{formatAge(complaint.created_at)}</span>
        {remaining ? (
          <span className={remaining.overdue && open ? "overdue-text" : undefined}>
            {open ? `SLA ${remaining.label}` : `Due ${formatDateTime(complaint.sla_due_at)}`}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setShowOriginal((value) => !value)}
        aria-expanded={showOriginal}
      >
        {showOriginal ? "Hide original" : "Show original"}
      </button>

      {showOriginal ? (
        <p className="original-text" lang={devanagari ? "hi" : undefined}>
          {complaint.raw_text}
        </p>
      ) : null}

      {isStaff && complaint.needs_review ? (
        <div className="row wrap">
          <label className="field grow" style={{ minWidth: 140 }}>
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
          <label className="field grow" style={{ minWidth: 140 }}>
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
        </div>
      ) : null}

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      {isStaff ? (
        <div className="complaint-actions">
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
              Start
            </button>
          ) : null}
          {open ? (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={() => patch({ status: "resolved" })}
            >
              Resolve
            </button>
          ) : null}
          <Link
            className="btn btn-ghost btn-sm"
            href={`/app/complaints/${complaint.id}`}
          >
            Open
          </Link>
        </div>
      ) : (
        <div className="complaint-actions">
          <Link
            className="btn btn-ghost btn-sm"
            href={`/app/complaints/${complaint.id}`}
          >
            View details
          </Link>
          {complaint.status === "resolved" ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={reopen}
            >
              Not fixed? Reopen
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}
