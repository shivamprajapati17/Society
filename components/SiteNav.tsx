"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Search, User, X } from "lucide-react";

import LotusMark from "@/components/LotusMark";
import { society } from "@/lib/society.config";

/**
 * Sticky glass navbar. Client-side because of the mobile sheet and the active
 * link highlight; everything it renders comes from `lib/society.config.ts`.
 */
export default function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Home");

  // Anchor links live on the same page, so mark them from the hash.
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace("#", "");
      setActive(hash || "Home");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Close the sheet on Escape and lock the page while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ctaHref = signedIn ? "/app/today" : "/login";
  const ctaLabel = signedIn ? "Open Dashboard" : "Resident Login";

  return (
    <header className="site-nav glass">
      <div className="site-nav-inner">
        <Link className="site-brand" href="/" aria-label={`${society.name} home`}>
          <LotusMark size={38} className="site-brand-mark" />
          <span className="site-brand-text">
            <span className="site-brand-name">{society.nameCaps}</span>
            <span className="site-brand-sub">{society.tagline}</span>
          </span>
        </Link>

        <nav className="site-links" aria-label="Sections">
          {society.nav.map((item) => {
            const key = item.href.replace("#", "") || "Home";
            const isActive = active === key;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`site-link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="site-nav-actions">
          <Link
            className="site-icon-btn"
            href={signedIn ? "/app/complaints" : "/login"}
            aria-label="Search complaints"
            title="Search complaints"
          >
            <Search size={18} strokeWidth={1.6} aria-hidden="true" />
          </Link>

          <Link className="btn-maroon site-login" href={ctaHref}>
            <User size={16} strokeWidth={1.8} aria-hidden="true" />
            {ctaLabel}
          </Link>

          <button
            type="button"
            className="site-icon-btn site-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X size={20} strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <Menu size={20} strokeWidth={1.7} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="site-sheet" id="site-menu">
          {society.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="site-sheet-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className="btn-maroon site-sheet-cta"
            href={ctaHref}
            onClick={() => setOpen(false)}
          >
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
