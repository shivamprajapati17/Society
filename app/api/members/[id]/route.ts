import { requireRole } from "@/lib/auth";
import { assertSameOrigin, handle, HttpError, readJson } from "@/lib/http";
import { UpdateMember } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function countAdmins(admin: ReturnType<typeof createAdminClient>, societyId: string) {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("society_id", societyId)
    .eq("role", "admin");
  return count ?? 0;
}

export async function PATCH(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["admin"]);
    const body = UpdateMember.parse(await readJson(request));

    const admin = createAdminClient();

    const { data: target } = await admin
      .from("profiles")
      .select("id, role, society_id")
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .maybeSingle();

    if (!target) throw new HttpError(404, "NOT_FOUND", "Member not found.");

    if (
      body.role &&
      body.role !== "admin" &&
      target.role === "admin" &&
      (await countAdmins(admin, profile.society_id)) <= 1
    ) {
      throw new HttpError(400, "VALIDATION", "The last admin cannot be demoted.");
    }

    const { data: updated, error } = await admin
      .from("profiles")
      .update(body)
      .eq("id", id)
      .select("id, role, full_name, flat_no, phone, created_at")
      .single();

    if (error || !updated) {
      throw new HttpError(500, "INTERNAL", "Could not update the member.");
    }

    return Response.json({ member: updated });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const profile = await requireRole(["admin"]);

    if (id === profile.id) {
      throw new HttpError(
        400,
        "VALIDATION",
        "You cannot remove your own account.",
      );
    }

    const admin = createAdminClient();

    const { data: target } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .eq("society_id", profile.society_id)
      .maybeSingle();

    if (!target) throw new HttpError(404, "NOT_FOUND", "Member not found.");

    if (
      target.role === "admin" &&
      (await countAdmins(admin, profile.society_id)) <= 1
    ) {
      throw new HttpError(400, "VALIDATION", "The last admin cannot be removed.");
    }

    // Anonymise their complaints, then drop the profile and auth user.
    await admin
      .from("complaints")
      .update({ reporter_id: null, reporter_label: null })
      .eq("reporter_id", id);

    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);

    return Response.json({ ok: true });
  });
}
