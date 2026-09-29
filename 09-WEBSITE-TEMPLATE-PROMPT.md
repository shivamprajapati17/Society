# 09 — Society Website Template (Suryanagari design) + Prompt

Overrides the landing/login visuals in `03-UI-UX.md` (Fastshot shader look).
Everything else in `01`–`08` stays. The dashboard (`/app/*`) reuses the tokens
below on a solid dark-brown background (no hero photo, no animation-heavy
effects).

## 1. What the reference shows (build exactly this)

**Nav** (glass bar, 76px, sticky): lotus logo + SURYANAGARI (serif caps) with
RESIDENTIAL SOCIETY small caps under it · links Home · About · Amenities ·
Events · Notices · Gallery · Contact (active = gold underline) · search icon ·
Resident Login pill (maroon gradient, gold 1px border, user icon) → `/login`.

**Hero** (full-viewport, dusk courtyard photo, dark left-to-right gradient
overlay for legibility):

- Left column: thin gold line + lotus ornament → giant Devanagari headline on
  two lines: हमरा (cream) / समाज (saffron gradient) → serif subhead *A Community
  Rooted in Tradition* → tagline *Modern Living • Indian Values • Stronger
  Together* → CTA *Explore Our Society* (maroon pill, gold border, circular
  arrow button at right) → scrolls to `#about`.
- Center: 4 staggered glass cards (each slightly offset in x), icon + title +
  subtitle + chevron:
  - **Latest Notice** — red `New` badge, newest published notice → `/#notices`
  - **Upcoming Event** — next event title + date/time → `/#events`
  - **Amenities** — "Discover facilities" → `/#amenities`
  - **Emergency Contact** — "24/7 Society Support" → `tel:` link from config
- Bottom-left: pill media player *A Peaceful Place to Call Home* / *Where
  Traditions Live On* + round gold play button. Toggles an optional muted
  ambient hero video (`/media/hero.mp4`); if no video file, hide the pill.
- Bottom-right: glass strip with 5 icon+label items: Beautiful Landscapes ·
  24/7 Security · Temple & Prayer Area · Club House & Events · Children's Play
  Area (thin dividers).
- Top-right chip "126 Residents Online" → **do not fake it**. Replaced with a
  real chip `{N} flats on SocietyDesk` (count of profiles), hidden at zero.

Addition (from the PRD): small text link under the CTA *Report an issue →* →
`/app/new`. Logged-in users: *Resident Login* becomes *Open Dashboard* →
`/app/today`.

## 2. Design tokens

```css
:root{
  --maroon-1:#a8321f; --maroon-2:#6f1d16;            /* button gradient 180deg */
  --gold:#e9c47a; --saffron:#f6a53a; --saffron-2:#ff8a1f; --cream:#fff3e0;
  --ink:#1a0d08; --glass:rgba(38,20,12,.55); --glass-border:rgba(233,196,122,.28);
  --text:#fff3e0; --muted:#e6cfae; --badge:#e5252a;
  --font-dev:"Noto Sans Devanagari",sans-serif;       /* weight 800, line-height 1.02 */
  --font-serif:"Cormorant Garamond",Georgia,serif;    /* subhead + logo */
  --font-text:Inter,system-ui,sans-serif;
}
.glass{background:var(--glass);border:1px solid var(--glass-border);backdrop-filter:blur(14px) saturate(120%);border-radius:18px;box-shadow:0 18px 44px #0006, inset 0 1px 0 #ffffff18}
.btn-maroon{background:linear-gradient(180deg,var(--maroon-1),var(--maroon-2));border:1px solid var(--gold);color:var(--cream);border-radius:999px;box-shadow:0 8px 24px #0006}
h1 .accent{background:linear-gradient(180deg,#ffc45a,var(--saffron-2));-webkit-background-clip:text;color:transparent}
```

Fonts via `next/font/google` (self-hosted at build time; Noto Sans Devanagari
800, Cormorant Garamond 500/600, Inter). Headline size
`clamp(72px,11vw,168px)` desktop, `clamp(56px,18vw,96px)` mobile.

## 3. Assets

`public/media/hero.jpg` (2400×1350, <400KB, WebP/AVIF fallback): the uploaded
mockup has UI baked in — do not use it as the background. Use a real society
photo, or generate a text-free background from the prompt in the original
brief. While the file is missing the hero renders a warm gradient placeholder.

Icons: `lucide-react`. Lotus logo/ornament as inline SVG. `next/image` with
`priority` on the hero; `sizes="100vw"`.

## 4. Sections below the hero

`#about` · `#amenities` · `#events` (from DB) · `#notices` (from DB, pinned
first) · `#gallery` (from `society.gallery`) · `#contact`. Every string lives in
`lib/society.config.ts`; nothing is hard-coded in JSX. Sections whose config is
empty render an honest empty state instead of invented content.

## 5. Data additions (small)

```sql
create table notices (id uuid primary key default gen_random_uuid(), society_id uuid not null references societies(id) on delete cascade,
  title text not null, body text, pinned boolean not null default false, published_at timestamptz not null default now(), created_by uuid references profiles(id) on delete set null);
create table events (id uuid primary key default gen_random_uuid(), society_id uuid not null references societies(id) on delete cascade,
  title text not null, description text, starts_at timestamptz not null, venue text, created_by uuid references profiles(id) on delete set null);
alter table notices enable row level security; alter table events enable row level security;
create policy notices_public_read on notices for select using (true);
create policy events_public_read on events for select using (true);
```

API (committee/admin write, public read): `GET /api/public/notices`,
`GET /api/public/events`, `POST/PATCH/DELETE /api/notices`, `/api/events`.
Landing fetches server-side, cached for 300s. Empty tables produce "No notices
yet". Single-society MVP: filter by `SOCIETY_ID` (defaults to the seeded
society).

## 6. Behavior, motion, responsive

Entrance: nav fade-down, headline rise+fade (.8s), cards stagger 90ms, strip
fade-up. Hover: cards `translateY(-3px)` + gold border brighten (`pointer:fine`
only). `prefers-reduced-motion` → no animation.

≥1100px: layout as the reference. 768–1099px: cards move under the headline as
a 2×2 grid; strip below cards. <768px: nav → burger sheet; cards as a vertical
stack; strip = 2-column grid (5th item spans); media pill hidden; no horizontal
scroll at 360/390/768/1440.

A11y: hero overlay contrast ≥ 4.5:1, visible focus ring `2px var(--gold)`,
`lang="hi"` on the Devanagari heading, alt text for the hero, video muted with
an `aria-label` toggle.

SEO: `<title>{Society} — Residential Society</title>`, meta description, OG
image = hero.

## 7. Rules applied in this implementation

- Hero, nav, glass cards and amenities strip built to the reference;
  `public/media/hero.jpg` with a gradient placeholder while it is missing.
- No fake stats, no claims. Content comes from `lib/society.config.ts` plus the
  `notices`/`events` tables.
- Landing is a Next.js server component; only the mobile menu, media pill and
  gallery lightbox are client components.
- `three.js` and the shader background removed; Fastshot pricing/features views
  dropped.
