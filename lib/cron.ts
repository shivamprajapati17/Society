import { timingSafeEqual } from "node:crypto";

import { cronSecret } from "@/lib/env";
import { HttpError } from "@/lib/http";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Cron routes accept only `Authorization: Bearer ${CRON_SECRET}`. */
export function assertCron(request: Request): void {
  const expected = cronSecret();
  if (!expected) {
    throw new HttpError(500, "INTERNAL", "CRON_SECRET is not configured.");
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || !safeEqual(token, expected)) {
    throw new HttpError(401, "UNAUTHENTICATED", "Invalid cron credentials.");
  }
}

/** True when the request asked for a dry run (`?dry=1`). */
export function isDryRun(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("dry") === "1";
}
