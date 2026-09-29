import { describe, expect, it } from "vitest";

import {
  highestUrgency,
  isOverdue,
  maxUrgency,
  slaDueAt,
  slaRemaining,
  SLA_HOURS,
} from "@/lib/sla";

describe("SLA windows", () => {
  it("uses the documented hours per urgency", () => {
    expect(SLA_HOURS).toEqual({
      critical: 4,
      high: 24,
      medium: 72,
      low: 168,
    });
  });

  it("computes the due time from created_at", () => {
    const created = "2026-03-12T10:00:00.000Z";
    expect(slaDueAt(created, "critical")).toBe("2026-03-12T14:00:00.000Z");
    expect(slaDueAt(created, "low")).toBe("2026-03-19T10:00:00.000Z");
  });

  it("accepts a Date instance", () => {
    const created = new Date("2026-03-12T10:00:00.000Z");
    expect(slaDueAt(created, "high")).toBe("2026-03-13T10:00:00.000Z");
  });
});

describe("overdue detection", () => {
  const now = new Date("2026-03-12T12:00:00.000Z");

  it("flags past-due timestamps", () => {
    expect(isOverdue("2026-03-12T11:00:00.000Z", now)).toBe(true);
    expect(isOverdue("2026-03-12T13:00:00.000Z", now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });

  it("labels remaining time", () => {
    expect(slaRemaining("2026-03-12T14:00:00.000Z", now)?.label).toBe("2h 0m left");
    expect(slaRemaining("2026-03-11T12:00:00.000Z", now)?.label).toBe(
      "1d 0h overdue",
    );
    expect(slaRemaining(null, now)).toBeNull();
  });
});

describe("urgency ranking", () => {
  it("picks the highest urgency", () => {
    expect(maxUrgency("low", "critical")).toBe("critical");
    expect(maxUrgency("medium", "medium")).toBe("medium");
    expect(highestUrgency(["low", "high", "medium"])).toBe("high");
    expect(highestUrgency([])).toBe("low");
  });
});
