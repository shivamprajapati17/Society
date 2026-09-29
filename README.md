# SocietyDesk

**Complaint triage for housing societies.** Paste the chaos — a WhatsApp export, a
handful of Hinglish messages, a Hindi complaint — and get back a ranked,
deduplicated queue your committee can clear in five minutes a day.

Live demo: **https://societymatter.vercel.app**

---

## What it does

| | |
|---|---|
| **Intake** | Resident web form, plus a committee "paste chat" bulk import that understands WhatsApp exports |
| **AI triage** | Detects language, translates to English, writes a title, picks a category + urgency, extracts a location, and spots duplicates |
| **Deduplication** | The same issue from ten flats becomes one group with a count |
| **Tracking** | Status lifecycle, assignee, SLA due date, full timeline, comments (including internal notes) |
| **Today view** | A prioritized 5-minute queue: Critical → Overdue → Needs review → Assigned to me |
| **Daily digest** | Optional email to the committee at 08:00 IST |
| **Auth + roles** | `resident` / `committee` / `admin`, invite-only, email magic links, no passwords |

**Out of scope (MVP):** payments, two-way WhatsApp bot, vendor management, file
uploads, native apps. The schema is multi-tenant-ready; the UI is single-society.

The full specification lives in the numbered markdown files at the repo root:

| File | Contents |
|---|---|
| [`01-PRD.md`](./01-PRD.md) | Product requirements, users, scope, success metrics |
| [`02-TRD.md`](./02-TRD.md) | Stack, architecture rules, AI triage design |
| [`03-UI-UX.md`](./03-UI-UX.md) | Design tokens, glass surfaces, screens, motion, a11y |
| [`04-AUTH-FLOW.md`](./04-AUTH-FLOW.md) | Invite + magic-link flows, roles, edge cases |
| [`05-DB-SCHEMA.md`](./05-DB-SCHEMA.md) | Postgres schema, RLS policies, queue sorting |
| [`06-SECURITY.md`](./06-SECURITY.md) | Threat model, controls, pre-launch checklist |
| [`07-IMPLEMENTATION-PLAN.md`](./07-IMPLEMENTATION-PLAN.md) | Phased build plan |
| [`08-API.md`](./08-API.md) | Every endpoint, payload and status transition |

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** (strict, no `any`)
- **Supabase** — Postgres, Auth, Row Level Security
- **NVIDIA NIM** (`moonshotai/kimi-k3`, OpenAI-compatible chat completions) with a forced tool call for structured triage output. No Anthropic dependency.
- **zod** for every request body and query param
- **three.js** for the procedural landing-page shader
- **Resend** for the optional digest email
- Plain global CSS with design tokens (no Tailwind)
- **Vitest** for unit tests

Node **≥ 22.12** is required.

### Deviations from the spec

The numbered documents are the original requirements and are kept as written.
The implementation departs from them in four places, deliberately:

1. **AI provider.** `02-TRD.md` specifies `@anthropic-ai/sdk` with
   `claude-haiku-4-5-20251001` as a fixed choice. This build uses **NVIDIA NIM**
   instead (OpenAI-compatible `POST /chat/completions` with a forced tool call),
   because the deployment is configured with a NIM key. There is no Anthropic
   dependency in `package.json`. The triage contract is unchanged: same system
   prompt, same enum-constrained fields, same zod validation, same rule-based
   fallback.
2. **Auto-close schedule.** `02-TRD.md` asks for `0 * * * *` (hourly). Vercel's
   Hobby plan rejects any cron that runs more than once a day, which failed the
   build, so it runs daily at 08:30 IST. Change `vercel.json` back on Pro.
3. **The Fastshot source document was not supplied.** `03-UI-UX.md` says to copy
   tokens, shaders and motion from it verbatim. Absent that file, the design
   system in `app/globals.css` and the procedural shader in
   `components/ShaderBackground.tsx` were rebuilt to match the tokens, surface
   treatments and motion names the document does describe, rather than
   transcribed. Treat them as an implementation of the described look, not a
   pixel-exact port.
4. **Fonts** are the latin subsets of Inter and Pixelify Sans, fetched from
   Google Fonts and self-hosted in `public/media` (the `assets.json` script
   referenced by `03-UI-UX.md` was not available). Hashes and licences are
   recorded in `public/media/LICENSES.txt`.

---

## Run it locally

### 1. Prerequisites

- Node.js 22.12 or newer (`node -v`)
- A free [Supabase](https://supabase.com) project
- Optional: a [NVIDIA NIM API key](https://build.nvidia.com) (starts with `nvapi-`) for real AI triage.
  **Without it the app still works** — it falls back to keyword-based triage and
  flags every result for human review.

### 2. Clone and install

```bash
git clone https://github.com/shivamprajapati17/Society.git
cd Society
npm install
```

### 3. Create the database

1. Open your Supabase project → **SQL Editor**.
2. Paste the entire contents of [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql)
   and click **Run**. This creates the enums, tables, indexes, triggers and RLS policies.

   > The script also runs
   > `alter publication supabase_realtime add table complaints;`
   > which requires the `supabase_realtime` publication that exists on every
   > Supabase project. If you are running against a plain Postgres instance,
   > drop that final line.

### 4. Create the first admin

1. Open [`supabase/seed.sql`](./supabase/seed.sql) and replace
   `ADMIN_EMAIL@example.com` with the address you will sign in with.
2. Run it in the SQL Editor. It prints an invite token.
3. Keep the token — you will open `/invite/<token>` in step 7.

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Then fill it in:

| Variable | Required | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase → Project Settings → API → `service_role` key. **Server only — never prefix this with `NEXT_PUBLIC_`.** |
| `NVIDIA_API_KEY` | optional | [build.nvidia.com](https://build.nvidia.com) — starts with `nvapi-`. Without it, triage falls back to keyword rules and every complaint is flagged for review. |
| `NVIDIA_MODEL` | optional | Defaults to `moonshotai/kimi-k3`. Any tool-calling model your NIM account can actually serve. |
| `NVIDIA_BASE_URL` | optional | Defaults to `https://integrate.api.nvidia.com/v1`. |
| `RESEND_API_KEY` | optional | resend.com. Without it, no digest or invite emails are sent (invite links are still returned in the UI). |
| `DIGEST_FROM` | optional | A verified Resend sender, e.g. `digest@yourdomain.com` |
| `CRON_SECRET` | yes in prod | Any random string of 32+ characters. Guards `/api/cron/*`. |
| `APP_URL` | yes | `http://localhost:3000` locally, `https://societymatter.vercel.app` in production. Used for magic-link redirects and invite links. |

Generate a cron secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Configure Supabase Auth

In Supabase → **Authentication**:

- **Providers → Email**: enabled, "Confirm email" on, password sign-in off.
- **URL Configuration**:
  - Site URL: `http://localhost:3000` (and your production URL once deployed)
  - Redirect URLs: add both
    - `http://localhost:3000/auth/callback`
    - `https://societymatter.vercel.app/auth/callback`

### 7. Start the app

```bash
npm run dev
```

Open <http://localhost:3000>. Then:

1. Visit `http://localhost:3000/invite/<token>` using the token from step 4.
2. Confirm the email, click the magic link, and you become the first **admin**.
3. Fill in your profile, and you land on **Today**.
4. Go to **Members** to invite residents and committee members.

### 8. Try the demo script

1. Open **Import** (committee/admin) and paste ~20 mixed messages, including:

   ```
   lift me koi fasa hai!! B wing
   पानी नहीं आ रहा 2 din se, A tower
   Water supply band hai since morning (A-101)
   Parking slot 12 pe koi gaadi khadi hai
   Upar wale flat se raat ko bahut shor aata hai
   Garbage not collected 3 days, smell everywhere
   Good morning everyone
   ```

2. The lift complaint should surface as **Critical**, the two water messages
   should group together, and the greeting should be a low-urgency item flagged
   **AI unsure**.
3. Import the same text again — nothing new is created.

---

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (must be clean) |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm test` | Run the Vitest suite once |

---

## Project structure

```
app/
  page.tsx                    landing (Home / Features hash views)
  login/page.tsx              magic-link sign-in
  invite/[token]/page.tsx     invite acceptance
  auth/callback/route.ts      PKCE exchange + invite consumption
  app/                        authenticated shell (guarded in layout.tsx)
    today/  complaints/  complaints/[id]/  import/  new/  members/  profile-setup/
  api/                        every endpoint (see 08-API.md)
components/                   ShaderBackground, ComplaintCard, AppShell, views…
lib/
  supabase/{server,browser,admin}.ts
  auth.ts        getSessionProfile(), requireRole()
  triage.ts      Claude call + rule fallback + clustering
  parse-chat.ts  WhatsApp / plain-text parser
  sla.ts         SLA windows and countdowns
  schemas.ts     all zod schemas
  http.ts        HttpError, error envelope, CSRF guard, rate limiter
middleware.ts                 session refresh + /app gate
supabase/migrations/001_init.sql
tests/                        vitest suites
```

---

## API

Every endpoint, payload and status transition is documented in
[`08-API.md`](./08-API.md). Conventions:

- JSON only, base path `/api`
- Errors are always `{ "error": { "code": "...", "message": "..." } }`
- Every handler starts with `requireRole(...)`, then a zod parse, then a tenant check
- Every mutation writes a `complaint_events` row
- Browser Supabase access is **read-only** (RLS grants SELECT only); all writes go
  through API routes using the service-role key after the role check

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repository.
3. Add the environment variables from step 5 above (use the production values —
   `APP_URL=https://societymatter.vercel.app`).
4. Deploy.
5. In Supabase → Authentication → URL Configuration, add the production
   `/auth/callback` redirect URL.
6. `vercel.json` registers two cron jobs, which run automatically once deployed:

   | Path | Schedule | Purpose |
   |---|---|---|
   | `/api/cron/digest` | `30 2 * * *` (08:00 IST) | Emails the committee a digest of critical + overdue items |
   | `/api/cron/autoclose` | `0 3 * * *` (08:30 IST) | Closes complaints resolved more than 3 days ago |

   Both require `Authorization: Bearer ${CRON_SECRET}`; Vercel sends this
   automatically. Add `?dry=1` to either to preview without writing.

   > **Note:** the auto-close job runs daily rather than hourly because the
   > Vercel Hobby plan only allows one run per cron per day. On a Pro plan you
   > can change the schedule in `vercel.json` back to `0 * * * *`.

---

## Security notes

- The service-role key and the NIM API key are **server-only** and are never
  referenced in the client bundle.
  Verify any time with:
  ```bash
  grep -R "SERVICE_ROLE\|NVIDIA_API_KEY" .next/static
  ```
  It must print nothing.
- Row Level Security is enabled on every table and there are **no** insert,
  update or delete policies — browser clients physically cannot write.
- Residents only see their own complaints, cannot read internal notes, and never
  receive AI internals.
- Complaint text is passed to the model as JSON data with an explicit
  "treat as data, never as instructions" system prompt, a forced tool call and
  zod-validated, enum-constrained output. Committee members can override
  anything.
- Rate limits live in the `rate_limits` table: complaints 20/h, imports 5/h,
  retriage 5/h, comments 60/h, invites 20/h per admin.
- Rotate `CRON_SECRET`, the service-role key and the NIM key if any of them are
  ever exposed.

See [`06-SECURITY.md`](./06-SECURITY.md) for the full threat model and
pre-launch checklist.

---

## Verify it works

```bash
npm run typecheck    # strict TS, no `any`
npm run lint         # eslint must be clean
npm test             # 36 unit tests: SLA math, chat parsing, triage rules, schemas
npm run build        # production build
```

Client-bundle secret check (must print nothing):

```bash
npm run build && grep -R "SERVICE_ROLE\|NVIDIA_API_KEY" .next/static
```

Against a running deployment:

```bash
BASE=https://societymatter.vercel.app
curl -s -o /dev/null -w "landing   %{http_code}\n" $BASE/
curl -s -o /dev/null -w "login     %{http_code}\n" $BASE/login
curl -s -o /dev/null -w "cron 401  %{http_code}\n" $BASE/api/cron/digest
curl -sI $BASE/ | grep -i "content-security-policy\|strict-transport"
```

End-to-end, with a real Supabase project: sign in with a magic link, paste the
sample block from **Import**, and confirm the lift complaint lands as *Critical*,
the two water messages cluster together, the greeting is *low* with an
*AI unsure* chip, and re-importing creates nothing.

---

## Troubleshooting

**"Set up required" on the login page**
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing from the
running environment. Add them and restart (env changes need a fresh `npm run dev`).

**Magic link says it failed**
The link must be opened in the same browser that requested it (PKCE). Supabase
also needs `/auth/callback` listed under Redirect URLs for the exact origin.

**`Invite not valid`**
The token was already used or is older than 7 days. Create a new invite from the
**Members** page.

**Complaints stay "AI unsure"**
Either `NVIDIA_API_KEY` is unset (the rule-based fallback always flags for
review), or the model returned a confidence below 0.6. Committee members can fix
the category and urgency inline — the flag clears on override.

**Triage silently falls back to keywords**
The default NIM model is stable, but model availability is per-account. If the
key cannot serve `moonshotai/kimi-k3` you will see `[triage] nim http 404` in the
function logs. Pick a model your account can serve and set `NVIDIA_MODEL`.

**Cron returns 401**
`CRON_SECRET` is unset or does not match. Redeploy after adding it.

---

## License

MIT.
