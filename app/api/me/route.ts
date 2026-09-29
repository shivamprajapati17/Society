import { assertSameOrigin, handle, readJson, HttpError } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { UpdateMe } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const profile = await requireSession();
    const admin = createAdminClient();
    const { data: society } = await admin
      .from("societies")
      .select("id, name")
      .eq("id", profile.society_id)
      .maybeSingle();

    const user = await admin.auth.admin.getUserById(profile.id);

    return Response.json({
      id: profile.id,
      email: user.data.user?.email ?? null,
      role: profile.role,
      full_name: profile.full_name,
      flat_no: profile.flat_no,
      phone: profile.phone,
      preferred_lang: profile.preferred_lang,
      society: society ?? { id: profile.society_id, name: "" },
    });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const profile = await requireSession();
    const body = UpdateMe.parse(await readJson(request));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update(body)
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(500, "INTERNAL", "Could not save your profile.");
    }

    return Response.json({ profile: data });
  });
}
