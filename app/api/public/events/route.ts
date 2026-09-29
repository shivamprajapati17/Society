import { NextResponse } from "next/server";

import { handle } from "@/lib/http";
import { listEvents } from "@/lib/notices";

/** Public events — no session required. Cached for 5 minutes. */
export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  return handle(async () => {
    const items = await listEvents();
    return NextResponse.json({ items });
  });
}
