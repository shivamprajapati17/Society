"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api, errorMessage } from "@/lib/client";
import type { MeResponse } from "@/lib/types";

interface Props {
  profile: Pick<
    MeResponse,
    "full_name" | "flat_no" | "phone" | "preferred_lang" | "role"
  >;
  requireName?: boolean;
}

export default function ProfileSetupForm({ profile, requireName }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [flatNo, setFlatNo] = useState(profile.flat_no ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [lang, setLang] = useState<"en" | "hi">(profile.preferred_lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          flat_no: flatNo.trim(),
          phone: phone.trim(),
          preferred_lang: lang,
        }),
      });
      setSaved(true);
      if (requireName) {
        router.push("/app/today");
        router.refresh();
        return;
      }
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1 className="h1">{requireName ? "Tell us who you are" : "Your profile"}</h1>
      <p className="muted">
        {requireName
          ? "One quick step so your committee knows who filed what."
          : "Keep your details up to date. Only your committee can see them."}
      </p>

      <label className="field">
        <span className="label">Full name</span>
        <input
          className="input"
          required
          maxLength={80}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Ramesh Kumar"
        />
      </label>

      <label className="field">
        <span className="label">Flat number</span>
        <input
          className="input"
          maxLength={10}
          value={flatNo}
          onChange={(event) => setFlatNo(event.target.value)}
          placeholder="B-302"
        />
      </label>

      <label className="field">
        <span className="label">Phone (optional)</span>
        <input
          className="input"
          maxLength={20}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+91 98765 43210"
        />
      </label>

      <label className="field">
        <span className="label">Preferred language</span>
        <select
          className="select"
          value={lang}
          onChange={(event) => setLang(event.target.value as "en" | "hi")}
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>
      </label>

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="banner banner-ok" role="status">
          Saved.
        </p>
      ) : null}

      <button
        className="btn-primary"
        type="submit"
        disabled={busy || fullName.trim().length === 0}
      >
        {busy ? "Saving…" : requireName ? "Continue" : "Save changes"}
      </button>
    </form>
  );
}
