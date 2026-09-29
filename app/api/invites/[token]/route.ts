import { isAdminConfigured } from "@/lib/env";
import { handle } from "@/lib/http";
import { readInvite } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

/** Public: validates an invite token so the join page can render. */
export async function GET(_request: Request, context: RouteContext) {
  return handle(async () => {
    const { token } = await context.params;

    if (!isAdminConfigured() || !/^[a-f0-9]{16,64}$/i.test(token)) {
      return Response.json({ valid: false });
    }

    const admin = createAdminClient();
    const result = await readInvite(admin, token);
    return Response.json(result);
  });
}
