"use client";

import { useState } from "react";
import Link from "next/link";

import { api, errorMessage } from "@/lib/client";
import type { ComplaintView, Role } from "@/lib/types";

const MAX_LENGTH = 1000;

interface Props {
  role: Role;
  flatNo: string | null;
}

export default function NewComplaintForm({ role, flatNo }: Props) {
  const [text, setText] = useState("");
  const [flat, setFlat] = useState(flatNo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ComplaintView | null>(null);

  const isStaff = role !== "resident";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { text: text.trim() };
      if (isStaff && flat.trim()) payload.flat_no = flat.trim();

      const response = await api<{ complaint: ComplaintView }>(
        "/api/complaints",
        { method: "POST", body: JSON.stringify(payload) },
      );
      setCreated(response.complaint);
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="glass card stack">
        <h1 className="h1">Logged as #{created.ref_no}</h1>
        <p className="muted">
          We&apos;re sorting it now. You&apos;ll see status updates on your Today
          page and can reopen it if it isn&apos;t fixed.
        </p>
        <div className="row wrap">
          <Link className="btn-primary" href="/app/today">
            Go to Today
          </Link>
          <Link className="btn" href={`/app/complaints/${created.id}`}>
            View complaint
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCreated(null)}
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1 className="h1">New complaint</h1>
      <p className="muted">
        Type in English, Hindi or Hinglish — we&apos;ll translate and sort it.
      </p>

      <label className="field">
        <span className="label">What&apos;s the problem?</span>
        <textarea
          className="textarea"
          required
          minLength={3}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="पानी नहीं आ रहा 2 din se, A tower"
        />
      </label>

      <div className="row-between">
        <span className="tiny dim" aria-live="polite">
          {text.length}/{MAX_LENGTH}
        </span>
      </div>

      <label className="field">
        <span className="label">Flat</span>
        <input
          className="input"
          value={flat}
          maxLength={10}
          readOnly={!isStaff}
          onChange={(event) => setFlat(event.target.value)}
          placeholder="B-302"
        />
        <span className="tiny dim">
          {isStaff
            ? "Committee members can file on behalf of a flat."
            : "Taken from your profile."}
        </span>
      </label>

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="btn-primary"
        type="submit"
        disabled={busy || text.trim().length < 3}
      >
        {busy ? "Submitting…" : "Submit complaint"}
      </button>
    </form>
  );
}
