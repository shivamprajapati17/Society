import { describe, expect, it } from "vitest";

import { extractFlat, parseChat, parseTimestamp, WA_LINE } from "@/lib/parse-chat";

describe("WhatsApp line format", () => {
  it("matches the Android export form", () => {
    const match = WA_LINE.exec(
      "12/03/24, 9:15 pm - Ramesh A-302: lift me koi fasa hai",
    );
    expect(match).not.toBeNull();
    expect(match?.[4]).toBe("Ramesh A-302");
    expect(match?.[5]).toBe("lift me koi fasa hai");
  });

  it("matches the iOS export form", () => {
    const match = WA_LINE.exec(
      "[12/03/24, 9:15:32 PM] Sunita B-101: pani nahi aa raha",
    );
    expect(match).not.toBeNull();
    expect(match?.[4]).toBe("Sunita B-101");
  });
});

describe("extractFlat", () => {
  it("pulls the flat code from a sender label", () => {
    expect(extractFlat("Ramesh A-302")).toBe("A-302");
    expect(extractFlat("Sunita B101")).toBe("B101");
    expect(extractFlat("Guard room")).toBeNull();
  });
});

describe("parseTimestamp", () => {
  it("applies the pm meridiem", () => {
    expect(parseTimestamp("12/03/24", "9:15", "pm")).toBe(
      "2024-03-12T21:15:00.000Z",
    );
  });

  it("handles midnight and noon correctly", () => {
    expect(parseTimestamp("12/03/24", "12:05", "am")).toBe(
      "2024-03-12T00:05:00.000Z",
    );
    expect(parseTimestamp("12/03/24", "12:05", "pm")).toBe(
      "2024-03-12T12:05:00.000Z",
    );
  });

  it("treats 4-digit years as-is", () => {
    expect(parseTimestamp("12/03/2026", "10:00", undefined)).toBe(
      "2026-03-12T10:00:00.000Z",
    );
  });
});

describe("parseChat", () => {
  it("parses a WhatsApp export and skips system lines", () => {
    const raw = [
      "12/03/24, 9:00 pm - Messages and calls are end-to-end encrypted.",
      "12/03/24, 9:15 pm - Ramesh A-302: lift me koi fasa hai!!",
      "12/03/24, 9:16 pm - Sunita B-101: pani nahi aa raha",
      "<Media omitted>",
      "12/03/24, 9:20 pm - Guard: ok",
    ].join("\n");

    const { rows, skipped } = parseChat(raw);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.flat_no).toBe("A-302");
    expect(rows[0]?.text).toBe("lift me koi fasa hai!!");
    expect(rows[1]?.ts).toBe("2024-03-12T21:16:00.000Z");
    expect(skipped).toBeGreaterThan(0);
  });

  it("appends wrapped continuation lines to the previous message", () => {
    const raw = [
      "12/03/24, 9:15 pm - Ramesh A-302: parking slot 12 pe",
      "koi gaadi khadi hai",
    ].join("\n");

    const { rows } = parseChat(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("parking slot 12 pe koi gaadi khadi hai");
  });

  it("treats plain text as one complaint per line", () => {
    const { rows } = parseChat(
      "Parking slot 12 pe koi gaadi khadi hai\n\nGarbage not collected 3 days",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.sender).toBe("Pasted");
    expect(rows[1]?.text).toBe("Garbage not collected 3 days");
  });

  it("enforces the 300 line limit", () => {
    const raw = Array.from({ length: 320 }, (_, i) => `complaint number ${i}`).join(
      "\n",
    );
    const { rows, skipped } = parseChat(raw);
    expect(rows).toHaveLength(300);
    expect(skipped).toBe(20);
  });
});
