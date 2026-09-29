import { createHash } from "node:crypto";

/** Stable hash used to skip already-imported chat lines. */
export function sourceHash(...parts: (string | null | undefined)[]): string {
  const input = parts.map((part) => part ?? "").join("\u0000");
  return createHash("sha256").update(input).digest("hex");
}
