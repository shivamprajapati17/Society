"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Props {
  heading: string;
  helper: string;
  defaultEmail?: string;
  lockedEmail?: string;
  inviteToken?: string;
}

export default function MagicLinkForm({
  heading,
  helper,
  defaultEmail = "",
  lockedEmail,
  inviteToken,
}: Props) {
  const [email, setEmail] = useState(lockedEmail ?? defaultEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirect =
        `${window.location.origin}/auth/callback` +
        (inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "");

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: (lockedEmail ?? email).trim(),
        options: { emailRedirectTo: redirect },
      });

      if (authError) {
        setStatus("error");
        // Generic copy: never reveal whether the address exists.
        setError(
          "We couldn't send that link right now. Check the address and try again.",
        );
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h1 className="h1">{status === "sent" ? "Check your inbox" : heading}</h1>

      {status === "sent" ? (
        <p className="muted" aria-live="polite">
          If an account exists for that address, a sign-in link is on its way.
          Open it in this browser.
        </p>
      ) : (
        <>
          <p className="muted">{helper}</p>

          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={lockedEmail ?? email}
              readOnly={Boolean(lockedEmail)}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-describedby="magic-helper"
            />
          </label>

          {error ? (
            <p className="banner banner-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="btn-primary btn-block"
            type="submit"
            disabled={status === "sending" || (lockedEmail ?? email).trim().length === 0}
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>

          <p className="tiny dim" id="magic-helper">
            We&apos;ll email you a sign-in link. No password needed.
          </p>
        </>
      )}

      {status === "sent" ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setStatus("idle")}
        >
          Use a different email
        </button>
      ) : null}
    </form>
  );
}
