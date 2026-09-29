"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import ClustersPanel from "@/components/ClustersPanel";
import { api, errorMessage } from "@/lib/client";

interface PreviewRow {
  sender: string;
  flat_no: string | null;
  text: string;
  ts: string | null;
  duplicate: boolean;
}

interface PreviewResponse {
  rows: PreviewRow[];
  skipped: number;
}

interface CommitResponse {
  created: number;
  duplicates: number;
  ids: string[];
}

interface ProgressResponse {
  done: number;
  failed: number;
  pending: number;
  total: number;
}

type Stage = "idle" | "previewing" | "previewed" | "committing" | "done";

export default function ImportView() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function preview() {
    setStage("previewing");
    setError(null);
    try {
      const response = await api<PreviewResponse>("/api/complaints/import", {
        method: "POST",
        body: JSON.stringify({ mode: "preview", text }),
      });
      setRows(response.rows);
      setSkipped(response.skipped);
      setStage("previewed");
    } catch (err) {
      setError(errorMessage(err));
      setStage("idle");
    }
  }

  async function commit() {
    const payloadRows = rows
      .filter((row) => !row.duplicate)
      .map((row) => ({
        sender: row.sender,
        flat_no: row.flat_no,
        text: row.text,
        ts: row.ts,
      }));

    if (payloadRows.length === 0) {
      setError("Nothing left to import — every line is already in the system.");
      return;
    }

    setStage("committing");
    setError(null);
    try {
      const response = await api<CommitResponse>("/api/complaints/import", {
        method: "POST",
        body: JSON.stringify({ mode: "commit", rows: payloadRows }),
      });
      setResult(response);
      setStage("done");

      if (response.ids.length > 0) {
        const ids = response.ids.join(",");
        setProgress({ done: 0, failed: 0, pending: response.ids.length, total: response.ids.length });

        pollRef.current = setInterval(async () => {
          try {
            const state = await api<ProgressResponse>(
              `/api/import/progress?ids=${ids}`,
            );
            setProgress(state);
            if (state.pending === 0 && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }, 2000);
      }
    } catch (err) {
      setError(errorMessage(err));
      setStage("previewed");
    }
  }

  function reset() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setText("");
    setRows([]);
    setSkipped(0);
    setResult(null);
    setProgress(null);
    setStage("idle");
  }

  const pendingRows = rows.filter((row) => !row.duplicate);
  const duplicateRows = rows.length - pendingRows.length;
  const sortedPercent =
    progress && progress.total > 0
      ? Math.round(((progress.done + progress.failed) / progress.total) * 100)
      : 0;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 className="h1">Import</h1>

      {stage === "done" && result ? (
        <section className="glass card stack">
          <h2 className="h2">Imported</h2>
          <p className="muted">
            {result.created} created · {result.duplicates} duplicates skipped
          </p>

          {progress ? (
            <div className="stack-sm">
              <span className="tiny dim" aria-live="polite">
                Sorting {progress.done + progress.failed}/{progress.total}
                {progress.failed > 0 ? ` · ${progress.failed} need review` : ""}
              </span>
              <div className="progress">
                <span style={{ width: `${sortedPercent}%` }} />
              </div>
            </div>
          ) : null}

          <div className="row wrap">
            <Link className="btn-primary" href="/app/today">
              Open Today
            </Link>
            <button type="button" className="btn" onClick={reset}>
              Import more
            </button>
          </div>
        </section>
      ) : (
        <section className="glass card stack">
          <label className="field">
            <span className="label">Paste chat or complaints</span>
            <textarea
              className="textarea"
              style={{ minHeight: 220 }}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                "Paste WhatsApp chat or complaints, one per line\n" +
                "12/03/24, 9:15 pm - Ramesh A-302: lift me koi fasa hai"
              }
            />
          </label>

          <span className="tiny dim">
            Up to 300 lines per import. Re-importing the same lines creates
            nothing.
          </span>

          {error ? (
            <p className="banner banner-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="row wrap">
            <button
              type="button"
              className="btn"
              disabled={
                stage === "previewing" ||
                stage === "committing" ||
                text.trim().length < 3
              }
              onClick={preview}
            >
              {stage === "previewing" ? "Reading…" : "Preview"}
            </button>
            {stage === "previewed" || stage === "committing" ? (
              <button
                type="button"
                className="btn-primary"
                disabled={pendingRows.length === 0 || stage === "committing"}
                onClick={commit}
              >
                {stage === "committing"
                  ? "Importing…"
                  : `Import & sort (${pendingRows.length})`}
              </button>
            ) : null}
          </div>
        </section>
      )}

      {stage === "previewed" || stage === "committing" ? (
        <section className="glass card stack">
          <div className="row-between">
            <h2 className="h2">Preview</h2>
            <span className="tiny dim">
              {pendingRows.length} to import · {duplicateRows} duplicate(s) ·{" "}
              {skipped} system line(s) skipped
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="muted tiny">Nothing to import from that text.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Sender</th>
                    <th>Flat</th>
                    <th>Message</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.text}-${index}`}>
                      <td>{row.sender}</td>
                      <td>{row.flat_no ?? "—"}</td>
                      <td>
                        {row.duplicate ? (
                          <span className="badge" style={{ marginRight: 6 }}>
                            duplicate
                          </span>
                        ) : null}
                        <span lang={/[\u0900-\u097F]/.test(row.text) ? "hi" : undefined}>
                          {row.text}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((_, position) => position !== index),
                            )
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <ClustersPanel />
    </div>
  );
}
