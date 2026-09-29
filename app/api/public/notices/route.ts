import { NextResponse } from "next/server";

import { handle } from "@/lib/http";
import { listNotices } from "@/lib/notices";

/** Public notice board content — no session required. Cached for 5 minutes. */
export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  return handle(async () => {
    const items = await listNotices();
    return NextResponse.json({ items });
  });
}
