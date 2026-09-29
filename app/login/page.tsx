import type { Metadata } from "next";
import Link from "next/link";

import HeroBackdrop from "@/components/HeroBackdrop";
import LotusMark from "@/components/LotusMark";
import MagicLinkForm from "@/components/MagicLinkForm";
import { isSupabaseConfigured } from "@/lib/env";
import { heroAssets } from "@/lib/hero";
import { society } from "@/lib/society.config";

export const metadata: Metadata = {
  title: `Sign in — ${society.name}`,
};

const ERRORS: Record<string, string> = {
  missing_code: "That sign-in link was incomplete. Please request a new one.",
  exchange_failed:
    "Open the link in the same browser you requested it from, or request a new one.",
  invite_invalid: "This invite is no longer valid. Ask your admin for a new one.",
  invite_expired: "This invite has expired. Ask your admin for a new one.",
  invite_used: "This invite has already been used. Ask your admin for a new one.",
  invite_email_mismatch: "Sign in with the email address this invite was sent to.",
  no_invite: "That email has no society yet. Ask your committee admin for an invite.",
  not_configured: "This deployment is not fully configured yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params.error;
  const errorText = errorKey ? (ERRORS[errorKey] ?? "Something went wrong.") : null;
  const configured = isSupabaseConfigured();
  const { image } = heroAssets();

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

          {errorText ? (
            <p className="banner banner-error" role="alert">
              {errorText}
            </p>
          ) : null}

          {configured ? (
            <MagicLinkForm
              heading="Welcome back"
              helper="Sign in with the email your committee invited."
            />
          ) : (
            <div className="stack">
              <h1 className="h1">Set up required</h1>
              <p className="muted">
                This deployment is missing its Supabase environment variables, so
                sign-in is disabled.
              </p>
              <p className="banner">
                Add them in Vercel → Settings → Environment Variables, then
                redeploy. The README covers the one-time database setup.
              </p>
            </div>
          )}

          <Link className="auth-back" href="/">
            ← Back to the website
          </Link>
        </div>
      </main>
    </div>
  );
}
