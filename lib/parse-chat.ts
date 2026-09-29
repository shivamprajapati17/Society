/**
 * Parses pasted WhatsApp exports or plain complaint lines into individual
 * complaints. See 02-TRD.md §6.
 */

export interface ParsedMessage {
  sender: string;
  flat_no: string | null;
  text: string;
  ts: string | null;
}

export interface ParseResult {
  rows: ParsedMessage[];
  skipped: number;
}

export const MAX_IMPORT_LINES = 300;

/** WhatsApp line: `12/03/24, 9:15 pm - Ramesh A-302: message` (also the iOS form). */
export const WA_LINE =
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s?([APap][Mm])?\]?\s?-?\s?([^:]{1,60}?):\s(.+)$/;

const SYSTEM_PATTERNS: RegExp[] = [
  /messages and calls are end-to-end encrypted/i,
  /^<media omitted>$/i,
  /^image omitted$/i,
  /^video omitted$/i,
  /^sticker omitted$/i,
  /^audio omitted$/i,
  /^document omitted$/i,
  /^gif omitted$/i,
  /^contact card omitted$/i,
  /this message was deleted/i,
  /you deleted this message/i,
  /\bchanged the subject\b/i,
  /\bchanged this group's icon\b/i,
  /\bchanged their phone number\b/i,
  /\bcreated group\b/i,
  /\badded you\b/i,
  /\bjoined using this group's invite link\b/i,
  /\bjoined\b$/i,
  /\bleft$/i,
];

const FLAT_RE = /\b([A-Ha-h]-?\d{2,4})\b/;

export function isSystemLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SYSTEM_PATTERNS.some((re) => re.test(trimmed));
}

/** Pulls a flat/tower code out of a sender label such as "Ramesh A-302". */
export function extractFlat(sender: string): string | null {
  const match = FLAT_RE.exec(sender);
  if (!match || !match[1]) return null;
  return match[1].toUpperCase();
}

/** `12/03/24, 9:15 pm` -> ISO string (assumes 20xx for 2-digit years). */
export function parseTimestamp(
  datePart: string,
  timePart: string,
  meridiem: string | undefined,
): string | null {
  const [d, m, y] = datePart.split("/").map((part) => Number(part));
  if (!d || !m || !y) return null;

  const [hhRaw, mmRaw] = timePart.split(":").map((part) => Number(part));
  if (Number.isNaN(hhRaw) || Number.isNaN(mmRaw)) return null;

  let hours = hhRaw;
  if (meridiem) {
    const isPm = meridiem.toLowerCase() === "pm";
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
  }

  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, m - 1, d, hours, mmRaw));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Parses raw pasted text. Auto-detects WhatsApp exports; otherwise treats each
 * non-empty line as one complaint.
 */
export function parseChat(raw: string, limit = MAX_IMPORT_LINES): ParseResult {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const rows: ParsedMessage[] = [];
  let skipped = 0;

  const waMode = lines.some((line) => WA_LINE.test(line.trim()));

  if (!waMode) {
    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      if (rows.length >= limit) {
        skipped += 1;
        continue;
      }
      rows.push({ sender: "Pasted", flat_no: null, text, ts: null });
    }
    return { rows, skipped };
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = WA_LINE.exec(line);
    if (match) {
      const [, datePart, timePart, meridiem, senderRaw, message] = match;
      const sender = (senderRaw ?? "").trim();
      const text = (message ?? "").trim();

      if (isSystemLine(text)) {
        skipped += 1;
        continue;
      }
      if (rows.length >= limit) {
        skipped += 1;
        continue;
      }

      rows.push({
        sender: sender || "Unknown",
        flat_no: extractFlat(sender),
        text,
        ts: parseTimestamp(datePart ?? "", timePart ?? "", meridiem),
      });
      continue;
    }

    if (isSystemLine(line)) {
      skipped += 1;
      continue;
    }

    const previous = rows[rows.length - 1];
    if (previous) {
      // Continuation of a wrapped multi-line message.
      previous.text = `${previous.text} ${line}`.trim();
    } else {
      skipped += 1;
    }
  }

  return { rows, skipped };
}
