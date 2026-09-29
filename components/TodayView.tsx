"use client";

import { useCallback, useEffect, useState } from "react";

import ComplaintCard from "@/components/ComplaintCard";
import { api, errorMessage } from "@/lib/client";
import { formatDate } from "@/lib/format";
import type { ComplaintView, Role, TodayResponse } from "@/lib/types";

interface Props {
  role: Role;
  viewerId: string;
}

interface Section {
  key: string;
  title: string;
  hint: string;
  items: ComplaintView[];
}

export default function TodayView({ role, viewerId }: Props) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api<TodayResponse>(
        `/api/today${expanded ? "?more=1" : ""}`,
      );
      setData(response);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [expanded]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="stack">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack">
        <p className="banner banner-error" role="alert">
          {error}
        </p>
        <button className="btn" type="button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  const isStaff = role !== "resident";

  const sections: Section[] = isStaff
    ? [
        {
          key: "critical",
          title: "Critical",
          hint: "Danger or total outage — act first",
          items: data?.critical ?? [],
        },
        {
          key: "overdue",
          title: "Overdue",
          hint: "Past their SLA window",
          items: data?.overdue ?? [],
        },
        {
          key: "review",
          title: "New · needs review",
          hint: "AI was unsure — check the labels",
          items: data?.needs_review ?? [],
        },
        {
          key: "mine",
          title: "Assigned to me",
          hint: "Yours to move forward",
          items: data?.mine ?? [],
        },
      ]
    : [
        {
          key: "mine",
          title: "Your complaints",
          hint: "Status updates appear here",
          items: data?.mine ?? [],
        },
      ];

  const counts = data?.counts;
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="h1">Today</h1>
          <p className="muted tiny">{formatDate(new Date())}</p>
        </div>
        {isStaff && counts ? (
          <div className="counters">
            <span className="pill pill-critical">Critical {counts.critical}</span>
            <span className="pill pill-high">Overdue {counts.overdue}</span>
            <span className="pill">New {counts.new}</span>
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <div className="glass empty">
          <p className="display">All clear 🎉</p>
          <p className="muted">
            {isStaff
              ? "Nothing needs you today."
              : "You have no open complaints right now."}
          </p>
        </div>
      ) : null}

      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.key}>
            <div className="section-head">
              <h2>{section.title}</h2>
              <span className="tiny dim">
                {section.hint} · {section.items.length}
              </span>
            </div>
            <div className="list">
              {section.items.map((complaint) => (
                <ComplaintCard
                  key={complaint.id}
                  complaint={complaint}
                  role={role}
                  viewerId={viewerId}
                  onChanged={() => void load()}
                />
              ))}
            </div>
          </section>
        ),
      )}

      {isStaff && !expanded && total >= 15 ? (
        <button
          type="button"
          className="btn"
          style={{ marginTop: 18 }}
          onClick={() => setExpanded(true)}
        >
          Show more
        </button>
      ) : null}
    </div>
  );
}
