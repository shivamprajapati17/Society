import type { Metadata } from "next";
import Link from "next/link";

import HeroBackdrop from "@/components/HeroBackdrop";
import LotusMark from "@/components/LotusMark";
import MagicLinkForm from "@/components/MagicLinkForm";
import { isAdminConfigured } from "@/lib/env";
import { heroAssets } from "@/lib/hero";
import { society } from "@/lib/society.config";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type Role } from "@/lib/types";

export const metadata: Metadata = {
  title: `Join your society — ${society.name}`,
};

// Tokens are validated per request, never pre-rendered at build time.
export const dynamic = "force-dynamic";

interface InviteLookup {
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  societies: { name: string } | null;
}

function InvalidInvite() {
  return (
    <div className="stack">
      <h1 className="h1">Invite not valid</h1>
      <p className="muted">
        This invite is no longer valid. Ask your admin for a new one.
      </p>
      <Link className="btn" href="/login">
        Back to sign in
      </Link>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { image } = heroAssets();

  let invite: InviteLookup | null = null;

  if (isAdminConfigured() && /^[a-f0-9]{16,64}$/i.test(token)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("invites")
      .select("email, role, expires_at, accepted_at, societies(name)")
      .eq("token", token)
      .maybeSingle();

    const row = data as unknown as InviteLookup | null;
    if (
      row &&
      !row.accepted_at &&
      new Date(row.expires_at).getTime() > Date.now()
    ) {
      invite = row;
    }
  }

  return (
    <div className="auth-stage">
      <HeroBackdrop image={image} alt={society.hero.imageAlt} blurred />

      <main className="auth-main">
        <div className="glass auth-card anim-focus">
          <Link className="auth-brand" href="/">
            <LotusMark size={40} />
            <span className="site-brand-text">
              <span className="site-brand-name">{society.nameCaps}</span>
              <span className="site-brand-sub">{society.tagline}</span>
            </span>
          </Link>

          {invite ? (
            <MagicLinkForm
              heading={`Join ${invite.societies?.name ?? "your society"}`}
              helper={`You're joining as ${ROLE_LABELS[invite.role]}. Confirm your email and we'll send a sign-in link.`}
              lockedEmail={invite.email}
              inviteToken={token}
            />
          ) : (
            <InvalidInvite />
          )}
        </div>
      </main>
    </div>
  );
}
