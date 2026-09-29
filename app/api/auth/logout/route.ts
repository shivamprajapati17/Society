import { assertSameOrigin, handle } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return Response.json({ ok: true });
  });
}
