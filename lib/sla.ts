import type { Urgency } from "@/lib/types";

/** SLA window in hours per urgency level (see 05-DB-SCHEMA.md). */
export const SLA_HOURS: Record<Urgency, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
};

const HOUR_MS = 60 * 60 * 1000;

/** ISO timestamp of when a complaint of this urgency is due. */
export function slaDueAt(
  createdAt: string | Date,
  urgency: Urgency,
): string {
  const start = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return new Date(start.getTime() + SLA_HOURS[urgency] * HOUR_MS).toISOString();
}

export function isOverdue(
  slaDueAtValue: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!slaDueAtValue) return false;
  return new Date(slaDueAtValue).getTime() < now.getTime();
}

export interface Remaining {
  overdue: boolean;
  /** Milliseconds until due (negative when overdue). */
  ms: number;
  /** Human label, e.g. "2h 15m left" or "3h overdue". */
  label: string;
}

/** Countdown label for a complaint card. */
export function slaRemaining(
  slaDueAtValue: string | null | undefined,
  now: Date = new Date(),
): Remaining | null {
  if (!slaDueAtValue) return null;
  const due = new Date(slaDueAtValue).getTime();
  const ms = due - now.getTime();
  const overdue = ms < 0;
  const abs = Math.abs(ms);

  const days = Math.floor(abs / (24 * HOUR_MS));
  const hours = Math.floor((abs % (24 * HOUR_MS)) / HOUR_MS);
  const minutes = Math.floor((abs % HOUR_MS) / (60 * 1000));

  let amount: string;
  if (days > 0) amount = `${days}d ${hours}h`;
  else if (hours > 0) amount = `${hours}h ${minutes}m`;
  else amount = `${Math.max(minutes, 1)}m`;

  return {
    overdue,
    ms,
    label: overdue ? `${amount} overdue` : `${amount} left`,
  };
}

/** Urgency ranking helper — critical is highest. */
const RANK: Record<Urgency, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return RANK[a] >= RANK[b] ? a : b;
}

export function highestUrgency(values: Urgency[]): Urgency {
  return values.reduce<Urgency>(
    (acc, value) => maxUrgency(acc, value),
    "low",
  );
}
