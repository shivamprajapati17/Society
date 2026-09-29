import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(code: ErrorCode, message: string, status?: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status: status ?? STATUS_BY_CODE[code] },
  );
}

/**
 * Wraps a route handler: converts thrown errors into the documented
 * `{ error: { code, message } }` envelope and logs only safe metadata.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status >= 500) {
        console.error(`[api] ${error.code}: ${error.message}`);
      }
      return errorResponse(error.code, error.message, error.status);
    }

    if (error instanceof ZodError) {
      const first = error.issues[0];
      return errorResponse(
        "VALIDATION",
        first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request",
      );
    }

    console.error(`[api] unhandled: ${error instanceof Error ? error.name : "unknown"}`);
    return errorResponse("INTERNAL", "Something went wrong. Please try again.");
  }
}

/**
 * CSRF guard for state-changing routes: JSON content type plus a same-origin
 * Origin header. Cron routes use a bearer token instead and opt out.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "VALIDATION", "Expected an application/json body.");
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients (tests, curl) may omit Origin; cookies still apply.
    return;
  }

  const host = request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "FORBIDDEN", "Origin is not allowed.");
  }

  if (host && originHost !== host) {
    throw new HttpError(403, "FORBIDDEN", "Origin is not allowed.");
  }
}

/**
 * Fixed-window rate limiter backed by the `rate_limits` table.
 * Key is scoped by the caller (e.g. `retriage:<user id>`).
 */
export async function enforceRateLimit(key: string, limit: number): Promise<void> {
  const admin = createAdminClient();
  const windowStart = new Date();
  windowStart.setUTCMinutes(0, 0, 0);
  const windowIso = windowStart.toISOString();

  const { data, error } = await admin
    .from("rate_limits")
    .select("count")
    .eq("key", key)
    .eq("window_start", windowIso)
    .maybeSingle();

  if (error) {
    // Never block traffic because the limiter itself failed.
    console.error(`[ratelimit] read failed: ${error.code}`);
    return;
  }

  const current = data?.count ?? 0;
  if (current >= limit) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please try again later.",
    );
  }

  const { error: upsertError } = await admin
    .from("rate_limits")
    .upsert(
      { key, window_start: windowIso, count: current + 1 },
      { onConflict: "key,window_start" },
    );

  if (upsertError) {
    console.error(`[ratelimit] write failed: ${upsertError.code}`);
  }
}

/** Parses and validates a JSON body. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Body must be valid JSON.");
  }
}
