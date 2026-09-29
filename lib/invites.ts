import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/lib/types";

export interface InviteRow {
  id: string;
  society_id: string;
  email: string;
  role: Role;
  flat_no: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}

const INVITE_TTL_DAYS = 7;

/** 192-bit single-use token, hex encoded. */
export function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function inviteExpiry(
  from: Date = new Date(),
  days = INVITE_TTL_DAYS,
): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

export type AcceptResult =
  | { ok: true; societyId: string; role: Role }
  | { ok: false; reason: "invalid" | "expired" | "used" | "email_mismatch" };

/**
 * Validates an invite and, when it matches the signed-in email, creates the
 * profile and consumes the invite.
 */
export async function acceptInvite(
  admin: SupabaseClient,
  token: string,
  user: { id: string; email: string | null },
): Promise<AcceptResult> {
  const { data } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  const invite = data as InviteRow | null;
  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.accepted_at) return { ok: false, reason: "used" };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, reason: "email_mismatch" };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      society_id: invite.society_id,
      role: invite.role,
      flat_no: invite.flat_no,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error(`[invite] profile upsert failed: ${profileError.code}`);
    return { ok: false, reason: "invalid" };
  }

  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id)
    .is("accepted_at", null);

  return { ok: true, societyId: invite.society_id, role: invite.role };
}

/** Validates a token for the public invite landing page. */
export async function readInvite(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { valid: true; society_name: string; role: Role; email_hint: string }
  | { valid: false }
> {
  const { data } = await admin
    .from("invites")
    .select("email, role, society_id, expires_at, accepted_at, societies(name)")
    .eq("token", token)
    .maybeSingle();

  if (!data) return { valid: false };

  const row = data as unknown as {
    email: string;
    role: Role;
    expires_at: string;
    accepted_at: string | null;
    societies: { name: string } | null;
  };

  if (row.accepted_at) return { valid: false };
  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false };

  return {
    valid: true,
    society_name: row.societies?.name ?? "your society",
    role: row.role,
    email_hint: maskEmail(row.email),
  };
}
