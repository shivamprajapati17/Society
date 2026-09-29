# 03 — UI/UX Design (Fastshot visual system, adapted)

> **Attach the Fastshot source document alongside this file.** It is authoritative for tokens, fonts, shaders, glass cards, and motion. Copy from it; do not redesign. Only copy/content changes below.

## 1. Where the Fastshot look applies
| Surface | Treatment |
|---|---|
| `/` landing, `/login`, `/invite/[token]` | **Full Fastshot**: black stage + procedural WebGL shader, Pixelify headline, liquid-glass card, ice-blue button |
| `/app/*` (dashboard) | Same tokens, fonts, glass cards, ice-blue accents on **solid dark slate** (`#0f1620`) with a *static* soft radial gradient. **No animated shader** (legibility + battery on committee phones). |

## 2. Assets & fonts (from Fastshot source)
Download with the source's `assets.json` script pattern → `public/media/inter.woff2`, `pixelify-sans.ttf` + license files (SHA-256 verified). `@font-face` Inter (100–900) and Pixelify (400–700), `font-display:block`. Pixelify only for headings/big numbers; Inter for everything else. Keep `three` MIT license file.

## 3. Design tokens (put in `app/globals.css`)
```css
:root{
 --bg:#000; --slate:#0f1620; --text:#fff; --muted:#d0d8e0; --dim:#a3a3a8;
 --ice:#b5e5ff; --ice-grad:linear-gradient(155deg,#e2faff,#a2dcf6 55%,#79c1e8); --on-ice:#123142;
 --glass:linear-gradient(135deg,rgba(224,240,255,.14),rgba(19,26,38,.32) 50%,rgba(165,207,236,.07));
 --glass-border:#e3f4ff38; --focus:#abe2ff;
 --crit:#ff6b6b; --high:#ffa94d; --med:#ffd43b; --low:#8ce99a;   /* urgency only */
 --e-primary:cubic-bezier(.16,1,.3,1); --e-soft:cubic-bezier(.22,1,.36,1);
 --font-text:Inter,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 --font-display:Pixelify,var(--font-text);
}
html,body{background:#000;color:#fff;font-family:var(--font-text);-webkit-font-smoothing:antialiased}
:focus-visible{outline:2px solid var(--focus);outline-offset:3px;border-radius:4px}
```
**Glass card** (`.glass`): `background:var(--glass); border:1px solid var(--glass-border); backdrop-filter:blur(24px) saturate(140%); box-shadow:inset 0 1px 1px #ffffff70, inset 0 -1px 1px #b1d7ff20, 0 18px 44px #0004; border-radius:22px;` + `::before` radial highlights and `::after` 1px top sheen exactly as in the source `.feature-card`. Fallback `@supports not (backdrop-filter:blur(1px))` → `rgba(29,39,49,.90)`.
**Primary button** (`.btn-primary`): ice gradient, `color:var(--on-ice)`, `inset 0 1px 1px #ffffffc4, 0 3px 16px #78c5ed36`. **Secondary** (`.btn`): `linear-gradient(160deg,#ffffff25,#ffffff0c)`, 1px `#ffffff30` border, radius 12, min-height 44px.
**Urgency pill**: 9–10px caps text, 1px border in urgency color at 40% alpha, bg 10% alpha. Never rely on color alone → include text label ("CRITICAL").

## 3.1 Shader (landing/login only)
`components/ShaderBackground.tsx` (`"use client"`): port `src/background.js` — same `homeShader` (landing Home + login) and `featuresShader` (landing Features), same vertex shader, uniforms, `time += 0.05`, `renderer.setPixelRatio(devicePixelRatio)`, resize handler, pause when `document.hidden`, single static frame when `prefers-reduced-motion`, handle `webglcontextlost/restored`, dispose renderer/geometry/material on unmount (React cleanup). If WebGL fails → static CSS `radial-gradient(ellipse at 50% 55%,#23212b,transparent 60%)` on black. Container `position:fixed; inset:0; z-index:0; pointer-events:none`.

## 4. Landing (`/`) — hash views `#home`, `#features`
Layout identical to Fastshot (nav: brand + Features link + "Get Started"; mobile burger sheet). **No Pricing view.** Logo → `#home`; Get Started → `/login`.
- **Brand**: `SocietyDesk` with the monochrome mark (reuse the F path? No → use a simple "S" square mark; same 34px size/style).
- **Home headline** (Pixelify, two explicit lines, same sizing `clamp(48px,calc(80*var(--u)),104px)`, mobile `clamp(34px,10.8vw,64px)`): `Paste the chaos` / `We'll sort it`.
- **Composer glass card** (same geometry as source `.card`): placeholder `Lift me koi fasa hai, 3rd floor B wing…`; chips: `Paste WhatsApp chat`, `Add a complaint`, `Hindi + English`; model label `Claude Haiku`; send button → routes to `/login` (presentation only on landing).
- Footer "Built by engineers from…" **removed** (do not copy that unverified claim).
- **Features view**: heading `A messy inbox` / `A calm queue` (Pixelify) + paragraph `Every complaint sorted, ranked and tracked until it's fixed.` Six glass cards with staggered `window-arrive` entrance (`--order` × .095s), demos as in source:
  1. **Paste anything** — Paste chat exports or type in Hindi, English or Hinglish.
  2. **Auto-sorted** — Water, lifts, parking, noise, cleaning — categorized instantly.
  3. **Urgent first** — Danger and outages rise to the top with a countdown.
  4. **No repeats** — Same issue from ten flats becomes one item.
  5. **Five-minute queue** — A short daily list. Clear it and you're done.
  6. **Closed loop** — Assign, update, resolve. Residents see progress.
- Keep source scroll behavior: `.features-view{overflow-y:auto; overscroll-behavior-y:contain}`, native vertical scroll, no horizontal overflow at 390/768/1440.
- Escape key returns to `#home`. Reduced motion: animation-duration .01ms.

## 5. Login (`/login`)
Home shader + centered glass card: Pixelify h1 `Welcome back`, email field (glass input, 48px), primary button `Send magic link`, helper text `We'll email you a sign-in link.` States: idle, sending (button disabled + "Sending…"), sent (`Check your inbox`), error (inline red text, `role="alert"`).

## 6. App shell (`/app/*`)
- **Mobile (default)**: top bar (brand mark + page title + avatar menu), **bottom tab bar** (Today · All · Import(committee) · New). 
- **Desktop ≥900px**: left rail 220px (same items + Members for admin), content max-width 960px.
- Background `--slate` + static radial highlight. Cards use `.glass`. Page h1 in Pixelify 32px (mobile) / 44px.

## 7. Screens
**Today (`/app/today`)** — the product's heart.
- Header: `Today` + date + counters `Critical 2 · Overdue 1 · New 5`.
- Sections in order: Critical → Overdue → New (needs review) → Assigned to me. Each = `ComplaintCard`.
- `ComplaintCard`: urgency pill, title, category icon+label, flat/location, "×N flats" cluster badge, age + SLA countdown (turns red when overdue), one-line summary (English) with "Show original" toggle (Hindi/Hinglish text), action row: `Assign to me` · `Start` · `Resolve` (44px min touch targets). `needs_review` shows an "AI unsure" chip + inline dropdowns to fix category/urgency.
- Empty state: "All clear 🎉 Nothing needs you today." (Pixelify).
- "Show more" after 15.

**All complaints (`/app/complaints`)** — filter chips (status, category, urgency, mine), search box (title/raw text, Hindi supported), list view grouped by cluster toggle, infinite "Load more" (cursor).

**Complaint detail (`/app/complaints/[id]`)** — header (title, pills), original + English text, details grid (flat, location, reporter, created, SLA, cluster link), status stepper, assignee select, timeline (events + comments merged, newest last), comment box with "Internal note" toggle (committee only), Resolve button opens a small confirm sheet with optional note.

**Import (`/app/import`)** (committee/admin) — large glass textarea `Paste WhatsApp chat or complaints, one per line`, `Preview` shows parsed rows (sender, flat, text) with remove buttons, `Import & sort` → progress bar "Sorting 12/20…", then results summary (created, duplicates skipped, clustered, needs review) + link to Today.

**New (`/app/new`)** — textarea (max 1000, counter), flat prefilled (editable by committee), submit → success screen with reference `#123` and status link.

**Members (`/app/members`, admin)** — table/list, role select, remove, `Invite` sheet (email, role, flat) → copyable invite link.

## 8. Motion
Reuse source keyframes (`e-settle-down`, `e-focus`, `e-panel`, `e-populate`, `window-arrive`) for landing/login only. In app: 150–200ms fades, cards hover lift `translateY(-4px)` only with `(hover:hover) and (pointer:fine)`. Remove the `.anim` class after 2.6s as in source. All disabled under `prefers-reduced-motion`.

## 9. Responsive & a11y checklist
Test 360, 390×844, 768×1024, 1440×900. No horizontal scroll. Labels on all inputs, `aria-live="polite"` for toasts and AI-progress, visible focus ring, contrast ≥ AA on glass (text `--muted` or white only), tap targets ≥44px, `lang="hi"` on Devanagari text spans.

## 10. Copy tone
Plain, short, friendly, no jargon. Errors say what to do next.
