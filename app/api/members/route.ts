import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const profile = await requireRole(["committee", "admin"]);
    const admin = createAdminClient();

    const { data: members } = await admin
      .from("profiles")
      .select("id, role, full_name, flat_no, phone, preferred_lang, created_at")
      .eq("society_id", profile.society_id)
      .order("created_at", { ascending: true });

    const rows = (members ?? []) as Array<Partial<Profile> & { id: string }>;

    // Committee only needs names for the assignee picker; admins get emails.
    if (profile.role !== "admin") {
      return Response.json({
        members: rows.map((row) => ({
          id: row.id,
          role: row.role,
          full_name: row.full_name,
          flat_no: row.flat_no,
          email: null,
        })),
        pending_invites: [],
      });
    }

    const withEmail = await Promise.all(
      rows.map(async (row) => {
        const { data } = await admin.auth.admin.getUserById(row.id);
        return { ...row, email: data.user?.email ?? null };
      }),
    );

    const { data: invites } = await admin
      .from("invites")
      .select("id, email, role, flat_no, expires_at, accepted_at, created_at")
      .eq("society_id", profile.society_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    return Response.json({
      members: withEmail,
      pending_invites: invites ?? [],
    });
  });
}
