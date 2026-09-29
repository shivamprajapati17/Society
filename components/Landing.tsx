"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ShaderBackground from "@/components/ShaderBackground";

type View = "home" | "features";

const FEATURES: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "📥",
    title: "Paste anything",
    body: "Paste chat exports or type in Hindi, English or Hinglish. No formats to learn.",
  },
  {
    icon: "🏷️",
    title: "Auto-sorted",
    body: "Water, lifts, parking, noise, cleaning — categorized the moment they arrive.",
  },
  {
    icon: "⏱️",
    title: "Urgent first",
    body: "Danger and outages rise to the top with a live countdown to the SLA.",
  },
  {
    icon: "🧲",
    title: "No repeats",
    body: "The same issue from ten flats becomes one item with a count.",
  },
  {
    icon: "✅",
    title: "Five-minute queue",
    body: "A short daily list. Clear it and you're done for the day.",
  },
  {
    icon: "🔁",
    title: "Closed loop",
    body: "Assign, update, resolve. Residents see progress the whole way.",
  },
];

function readView(): View {
  if (typeof window === "undefined") return "home";
  return window.location.hash.replace("#", "") === "features"
    ? "features"
    : "home";
}

export default function Landing({ modelLabel }: { modelLabel: string }) {
  const [view, setView] = useState<View>("home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sync = () => {
      setView(readView());
      setSheetOpen(false);
    };
    sync();
    window.addEventListener("hashchange", sync);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.location.hash = "#home";
        setSheetOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("hashchange", sync);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="stage">
      <ShaderBackground variant={view} />

      <nav className="nav">
        <a
          className="brand"
          href="#home"
          onClick={() => window.scrollTo({ top: 0 })}
        >
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          SocietyDesk
        </a>

        <div className="nav-links">
          <a className="nav-link" href="#features">
            Features
          </a>
          <Link className="btn-primary" href="/login">
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="burger"
          aria-label="Open menu"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </nav>

      {sheetOpen ? (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={() => setSheetOpen(false)}
        >
          <div className="glass sheet-panel" onClick={(event) => event.stopPropagation()}>
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <Link href="/login">Get Started</Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSheetOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {view === "features" ? (
        <div className="features-view">
          <div className="features-inner">
            <div className="features-head">
              <h2>
                <span>A messy inbox</span>
                <span>A calm queue</span>
              </h2>
              <p>Every complaint sorted, ranked and tracked until it&apos;s fixed.</p>
            </div>

            <div className="features-grid">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.title}
                  className="glass feature-card anim"
                  style={{ "--order": index } as React.CSSProperties}
                >
                  <span className="feature-icon" aria-hidden="true">
                    {feature.icon}
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <section className="hero">
          <div className="stack" style={{ gap: 22 }}>
            <h1>
              <span>Paste the chaos</span>
              <span>We&apos;ll sort it</span>
            </h1>
            <p className="hero-sub">
              SocietyDesk turns WhatsApp complaints into a ranked, deduplicated
              queue your committee can clear in five minutes a day — in English,
              Hindi or Hinglish.
            </p>
            <div className="row wrap">
              <Link className="btn-primary" href="/login">
                Get Started
              </Link>
              <a className="btn" href="#features">
                See how it works
              </a>
            </div>
          </div>

          <div className="glass composer">
            <label className="label" htmlFor="landing-composer">
              Try the idea
            </label>
            <textarea
              id="landing-composer"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Lift me koi fasa hai, 3rd floor B wing…"
              aria-label="Example complaint"
            />
            <div className="composer-chips">
              <span className="chip">Paste WhatsApp chat</span>
              <span className="chip">Add a complaint</span>
              <span className="chip">Hindi + English</span>
            </div>
            <div className="composer-foot">
              <span className="model-tag">{modelLabel}</span>
              <Link className="btn-primary btn-sm" href="/login">
                Sort it
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
