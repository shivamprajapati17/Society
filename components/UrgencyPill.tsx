import { URGENCY_LABELS, type Urgency } from "@/lib/types";

/** Urgency never relies on colour alone — the text label is always present. */
export function UrgencyPill({ urgency }: { urgency: Urgency }) {
  return (
    <span className={`pill pill-${urgency}`}>{URGENCY_LABELS[urgency]}</span>
  );
}
