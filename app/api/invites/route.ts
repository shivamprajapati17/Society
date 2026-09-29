import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import {
  assertSameOrigin,
  enforceRateLimit,
  handle,
  HttpError,
  readJson,
} from "@/lib/http";
import { inviteExpiry, newInviteToken } from "@/lib/invites";
import { CreateInvite } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

function inviteEmailHtml(societyName: string, role: Role, link: string): string {
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111">
    <h2>You're invited to ${societyName}</h2>
    <p>You have been invited as <strong>${role}</strong> on SocietyDesk.</p>
    <p><a href="${link}" style="background:#a2dcf6;color:#123142;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Accept invite</a></p>
    <p style="color:#666;font-size:13px">This link expires in 7 days and can be used once.</p>
  </div>`;
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const profile = await requireRole(["admin"]);
    const body = CreateInvite.parse(await readJson(request));

    await enforceRateLimit(`invite:${profile.id}`, 20);

    const admin = createAdminClient();

    const { data: society } = await admin
      .from("societies")
      .select("name")
      .eq("id", profile.society_id)
      .maybeSingle();

    const token = newInviteToken();
    const expiresAt = inviteExpiry();

    const { data, error } = await admin
      .from("invites")
      .insert({
        society_id: profile.society_id,
        email: body.email,
        role: body.role,
        flat_no: body.flat_no ?? null,
        token,
        expires_at: expiresAt,
        created_by: profile.id,
      })
      .select("id, email, role, flat_no, expires_at")
      .single();

    if (error || !data) {
      throw new HttpError(500, "INTERNAL", "Could not create the invite.");
    }

    const inviteUrl = `${appUrl()}/invite/${token}`;

    await sendEmail({
      to: body.email,
      subject: `Invite to ${society?.name ?? "your society"} on SocietyDesk`,
      html: inviteEmailHtml(society?.name ?? "your society", body.role, inviteUrl),
    });

    return Response.json(
      { invite_url: inviteUrl, expires_at: data.expires_at, invite: data },
      { status: 201 },
    );
  });
}
