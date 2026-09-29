"use client";

import { useCallback, useEffect, useState } from "react";

import ComplaintCard from "@/components/ComplaintCard";
import { api, errorMessage } from "@/lib/client";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type Category,
  type ComplaintView,
  type Role,
  type Status,
  type Urgency,
} from "@/lib/types";

interface Props {
  role: Role;
  viewerId: string;
}

interface ListResponse {
  items: ComplaintView[];
  next_cursor: string | null;
}

/** An open duplicate group, as returned by `/api/clusters`. */
interface GroupOption {
  id: string;
  title: string;
  category: Category;
  urgency: Urgency;
  count: number;
  open_count: number;
}

export default function ComplaintsList({ role, viewerId }: Props) {
  const [items, setItems] = useState<ComplaintView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<Status | "">("");
  const [category, setCategory] = useState<Category | "">("");
  const [urgency, setUrgency] = useState<Urgency | "">("");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [groups, setGroups] = useState<GroupOption[]>([]);

  const isStaff = role !== "resident";

  const buildQuery = useCallback(
    (nextCursor: string | null) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (category) params.set("category", category);
      if (urgency) params.set("urgency", urgency);
      if (mine) params.set("mine", "1");
      if (clusterId) params.set("cluster_id", clusterId);
      if (appliedSearch) params.set("q", appliedSearch);
      if (nextCursor) params.set("cursor", nextCursor);
      return params.toString();
    },
    [status, category, urgency, mine, clusterId, appliedSearch],
  );

  /** Duplicate groups are a committee/admin view only. */
  const loadGroups = useCallback(async () => {
    if (!isStaff) return;
    try {
      const response = await api<{ items: GroupOption[] }>("/api/clusters");
      setGroups(response.items);
    } catch {
      // A missing group list must never break the complaint list itself.
    }
  }, [isStaff]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQuery(null);
      const response = await api<ListResponse>(
        `/api/complaints${query ? `?${query}` : ""}`,
      );
      setItems(response.items);
      setCursor(response.next_cursor);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const response = await api<ListResponse>(
        `/api/complaints?${buildQuery(cursor)}`,
      );
      setItems((prev) => [...prev, ...response.items]);
      setCursor(response.next_cursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const activeGroup = groups.find((group) => group.id === clusterId);
  const hasFilters = Boolean(
    status || category || urgency || mine || appliedSearch || clusterId,
  );

  return (
    <div className="stack">
      <h1 className="h1">Complaints</h1>

      <form
        className="stack-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
        }}
        role="search"
      >
        <label className="field">
          <span className="label">Search</span>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title or complaint text (Hindi supported)"
          />
        </label>
        <button className="btn btn-sm" type="submit">
          Search
        </button>
      </form>

      <div className="row wrap" role="group" aria-label="Status filter">
        <button
          type="button"
          className="chip"
          aria-pressed={status === ""}
          onClick={() => setStatus("")}
        >
          Any status
        </button>
        {STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {STATUS_LABELS[value]}
          </button>
        ))}
      </div>

      {role !== "resident" ? (
        <div className="row wrap">
          <label className="field" style={{ minWidth: 160 }}>
            <span className="label">Category</span>
            <select
              className="select"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as Category | "")
              }
            >
              <option value="">All categories</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: 140 }}>
            <span className="label">Urgency</span>
            <select
              className="select"
              value={urgency}
              onChange={(event) => setUrgency(event.target.value as Urgency | "")}
            >
              <option value="">All</option>
              {URGENCIES.map((value) => (
                <option key={value} value={value}>
                  {URGENCY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="chip"
            aria-pressed={mine}
            onClick={() => setMine((value) => !value)}
            style={{ alignSelf: "flex-end" }}
          >
            Mine
          </button>
        </div>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setStatus("");
            setCategory("");
            setUrgency("");
            setMine(false);
            setSearch("");
            setAppliedSearch("");
            setClusterId("");
          }}
        >
          Clear filters
        </button>
      ) : null}

      {isStaff && groups.length > 0 ? (
        <div className="stack-sm">
          <span className="tiny dim">
            Duplicate groups — the same issue reported by several flats
          </span>
          <div className="row wrap" role="group" aria-label="Duplicate group">
            <button
              type="button"
              className="chip"
              aria-pressed={clusterId === ""}
              onClick={() => setClusterId("")}
            >
              All complaints
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="chip"
                aria-pressed={clusterId === group.id}
                onClick={() => setClusterId(group.id)}
                title={`${group.count} complaint(s), ${group.open_count} open`}
              >
                {CATEGORY_ICONS[group.category]}{" "}
                {group.title || CATEGORY_LABELS[group.category]}
                <span className="badge">×{group.open_count} open</span>
              </button>
            ))}
          </div>
          {activeGroup ? (
            <p className="muted tiny" role="status">
              Showing only “
              {activeGroup.title || CATEGORY_LABELS[activeGroup.category]}” —{" "}
              {activeGroup.open_count} open of {activeGroup.count} reported.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="stack">
          <div className="skeleton" style={{ height: 140 }} />
          <div className="skeleton" style={{ height: 140 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="glass empty">
          <p className="display">Nothing here</p>
          <p className="muted">
            {hasFilters
              ? "No complaints match these filters."
              : "No complaints have been filed yet."}
          </p>
        </div>
      ) : (
        <div className="list">
          {items.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              role={role}
              viewerId={viewerId}
              onChanged={() => {
                void load();
                void loadGroups();
              }}
              onShowCluster={isStaff ? setClusterId : undefined}
            />
          ))}
        </div>
      )}

      {cursor ? (
        <button
          type="button"
          className="btn"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
