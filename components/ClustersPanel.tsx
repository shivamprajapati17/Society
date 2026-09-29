"use client";

import { useCallback, useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/client";
import { CATEGORY_ICONS, CATEGORY_LABELS, type Category, type Urgency } from "@/lib/types";

interface ClusterItem {
  id: string;
  title: string;
  category: Category;
  urgency: Urgency;
  count: number;
  open_count: number;
}

export default function ClustersPanel() {
  const [items, setItems] = useState<ClusterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api<{ items: ClusterItem[] }>("/api/clusters");
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveCluster(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const response = await api<{ resolved: number }>(
        `/api/clusters/${id}/resolve`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setStatus(`Resolved ${response.resolved} complaint(s).`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function merge(fromId: string, intoId: string) {
    if (!intoId || fromId === intoId) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await api<{ moved: number }>(
        `/api/clusters/${fromId}/merge`,
        { method: "POST", body: JSON.stringify({ into_cluster_id: intoId }) },
      );
      setStatus(`Moved ${response.moved} complaint(s).`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 120 }} />;

  return (
    <section className="glass card stack">
      <div className="row-between">
        <h2 className="h2">Grouped issues</h2>
        <span className="tiny dim">{items.length} group(s)</span>
      </div>
      <p className="muted tiny">
        The same problem reported by several flats. Resolving a group resolves
        every open complaint inside it.
      </p>

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="banner banner-ok" role="status">
          {status}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="muted tiny">No grouped issues right now.</p>
      ) : (
        <div className="stack-sm">
          {items.map((cluster) => (
            <div key={cluster.id} className="glass card stack-sm">
              <div className="row wrap">
                <span className={`pill pill-${cluster.urgency}`}>
                  {cluster.urgency}
                </span>
                <strong>
                  {CATEGORY_ICONS[cluster.category]}{" "}
                  {cluster.title || CATEGORY_LABELS[cluster.category]}
                </strong>
                <span className="badge">
                  ×{cluster.count} flats · {cluster.open_count} open
                </span>
              </div>
              <div className="row wrap">
                <label className="field grow" style={{ minWidth: 180 }}>
                  <span className="label">Merge into</span>
                  <select
                    className="select"
                    defaultValue=""
                    disabled={busy}
                    onChange={(event) => merge(cluster.id, event.target.value)}
                  >
                    <option value="">Choose a group…</option>
                    {items
                      .filter((other) => other.id !== cluster.id)
                      .map((other) => (
                        <option key={other.id} value={other.id}>
                          {other.title || CATEGORY_LABELS[other.category]}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy}
                  style={{ alignSelf: "flex-end" }}
                  onClick={() => resolveCluster(cluster.id)}
                >
                  Resolve all
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
