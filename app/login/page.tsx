import type { Metadata } from "next";
import Link from "next/link";

import MagicLinkForm from "@/components/MagicLinkForm";
import ShaderBackground from "@/components/ShaderBackground";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in — SocietyDesk",
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

  return (
    <div className="stage">
      <ShaderBackground variant="home" />

      <main className="center-screen">
        <div className="glass card anim-focus" style={{ width: "min(440px, 100%)", padding: 24 }}>
          <div className="row" style={{ marginBottom: 18 }}>
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                S
              </span>
              SocietyDesk
            </Link>
          </div>

          {errorText ? (
            <p className="banner banner-error" role="alert" style={{ marginBottom: 14 }}>
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
                Add <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
                <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel → Settings →
                Environment Variables, then redeploy. See the README for the
                one-time database setup.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
