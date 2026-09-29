import { STATUS_LABELS, type Status } from "@/lib/types";

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`pill pill-status is-${status}`}>{STATUS_LABELS[status]}</span>
  );
}
