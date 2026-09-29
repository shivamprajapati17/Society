"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/client";
import { ROLE_LABELS, type Role } from "@/lib/types";

interface Props {
  role: Role;
  fullName: string | null;
  flatNo: string | null;
  societyName: string;
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}

const TITLES: Record<string, string> = {
  "/app/today": "Today",
  "/app/complaints": "All complaints",
  "/app/import": "Import",
  "/app/new": "New complaint",
  "/app/members": "Members",
  "/app/profile-setup": "Your profile",
};

const NAV: NavItem[] = [
  { href: "/app/today", label: "Today", icon: "☀️", roles: ["resident", "committee", "admin"] },
  { href: "/app/complaints", label: "All", icon: "🗂️", roles: ["resident", "committee", "admin"] },
  { href: "/app/import", label: "Import", icon: "📥", roles: ["committee", "admin"] },
  { href: "/app/new", label: "New", icon: "➕", roles: ["resident", "committee", "admin"] },
  { href: "/app/members", label: "Members", icon: "👥", roles: ["admin"] },
];

export default function AppShell({
  role,
  fullName,
  flatNo,
  societyName,
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "SocietyDesk";
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = NAV.filter((item) => item.roles.includes(role));
  const initial = (fullName ?? societyName ?? "S").trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // Fall through to the redirect; the session cookie is cleared server-side.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <span className="topbar-title grow">{title}</span>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="avatar"
            aria-label="Account menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {initial}
          </button>
          {menuOpen ? (
            <div className="glass menu" role="menu">
              <div style={{ padding: "8px 12px 4px" }}>
                <div style={{ fontWeight: 600 }}>{fullName ?? "Complete profile"}</div>
                <div className="tiny dim">
                  {ROLE_LABELS[role]}
                  {flatNo ? ` · ${flatNo}` : ""}
                </div>
                <div className="tiny dim">{societyName}</div>
              </div>
              <Link className="menu-item" href="/app/profile-setup" role="menuitem">
                Profile <span aria-hidden="true">→</span>
              </Link>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                disabled={signingOut}
                onClick={signOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="shell-body">
        <nav className="rail" aria-label="Sections">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rail-link ${pathname === item.href ? "is-active" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="shell-main" id="main">
          {children}
        </main>
      </div>

      <nav className="tabs" aria-label="Sections">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`tab ${pathname === item.href ? "is-active" : ""}`}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span className="tab-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
