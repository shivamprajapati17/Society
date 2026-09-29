import { describe, expect, it } from "vitest";

import { canTransition } from "@/lib/complaints";
import {
  CreateComplaint,
  ImportCommit,
  PatchComplaint,
  TriageResult,
} from "@/lib/schemas";
import { STATUSES, type Status } from "@/lib/types";

describe("CreateComplaint", () => {
  it("accepts a normal complaint", () => {
    const parsed = CreateComplaint.parse({ text: "  lift is stuck  " });
    expect(parsed.text).toBe("lift is stuck");
  });

  it("rejects text outside 3..1000 characters", () => {
    expect(CreateComplaint.safeParse({ text: "ab" }).success).toBe(false);
    expect(
      CreateComplaint.safeParse({ text: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      CreateComplaint.safeParse({ text: "ok text", urgency: "critical" }).success,
    ).toBe(false);
  });
});

describe("PatchComplaint", () => {
  it("rejects an empty patch", () => {
    expect(PatchComplaint.safeParse({}).success).toBe(false);
  });

  it("accepts a valid status change", () => {
    expect(PatchComplaint.safeParse({ status: "in_progress" }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(PatchComplaint.safeParse({ status: "done" }).success).toBe(false);
  });
});

describe("ImportCommit", () => {
  it("caps rows at 300", () => {
    const rows = Array.from({ length: 301 }, (_, i) => ({
      sender: "Pasted",
      flat_no: null,
      text: `complaint ${i}`,
    }));
    expect(ImportCommit.safeParse({ mode: "commit", rows }).success).toBe(false);
  });

  it("requires at least one row", () => {
    expect(ImportCommit.safeParse({ mode: "commit", rows: [] }).success).toBe(
      false,
    );
  });
});

describe("TriageResult", () => {
  it("accepts a well-formed tool response", () => {
    const parsed = TriageResult.safeParse({
      language: "hinglish",
      title: "Person stuck in lift",
      summary_en: "Someone is stuck in the lift.",
      category: "lift",
      urgency: "critical",
      location: "B wing",
      duplicate_of_id: null,
      confidence: 0.94,
      reason: "Person trapped",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects confidence outside 0..1", () => {
    const parsed = TriageResult.safeParse({
      language: "en",
      title: "Test",
      summary_en: "Test",
      category: "other",
      urgency: "low",
      location: null,
      duplicate_of_id: null,
      confidence: 4,
      reason: "because",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("status transitions", () => {
  it("follows the documented lifecycle", () => {
    expect(canTransition("new", "triaged")).toBe(true);
    expect(canTransition("new", "assigned")).toBe(true);
    expect(canTransition("new", "resolved")).toBe(true);
    expect(canTransition("assigned", "triaged")).toBe(true);
    expect(canTransition("resolved", "in_progress")).toBe(true);
    expect(canTransition("resolved", "closed")).toBe(true);
  });

  it("blocks invalid moves", () => {
    expect(canTransition("new", "closed")).toBe(false);
    expect(canTransition("closed", "in_progress")).toBe(false);
    expect(canTransition("in_progress", "triaged")).toBe(false);
  });

  it("allows a no-op move", () => {
    for (const status of STATUSES) {
      expect(canTransition(status as Status, status as Status)).toBe(true);
    }
  });
});
