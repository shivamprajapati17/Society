# 04 — Auth Flow

## 1. Method
Supabase Auth, **email magic link** (no passwords). Invite-only: nobody can join a society without an invite token. (Phone OTP = Phase 2; needs an SMS provider.)

## 2. Roles
`resident` < `committee` < `admin`. Stored in `profiles.role`. Role changes only via API by admin.

## 3. Supabase setup
- Auth → Providers: Email ON, "Confirm email" ON, password sign-in OFF.
- Auth → URL config: Site URL = `APP_URL`; Redirect URLs: `${APP_URL}/auth/callback`.
- Session cookies via `@supabase/ssr` (server + browser clients, middleware refresh).

## 4. Bootstrap (first admin)
`supabase/seed.sql` (run once by developer):
```sql
insert into societies (id, name) values ('00000000-0000-0000-0000-000000000001','My Society');
insert into invites (society_id, email, role, token, expires_at)
values ('00000000-0000-0000-0000-000000000001','ADMIN_EMAIL@example.com','admin',
        encode(gen_random_bytes(24),'hex'), now() + interval '7 days');
select token from invites where email='ADMIN_EMAIL@example.com';
```
Open `/invite/<token>` to become admin.

## 5. Flows
### 5.1 Invite
1. Admin → Members → Invite (email, role, flat) → `POST /api/invites` → creates row with random 48-hex token, expiry 7 days, returns link `${APP_URL}/invite/{token}` (also emails it if Resend configured).
2. Invitee opens link → `/invite/[token]` server-validates (exists, not used, not expired) and shows "Join {society} as {role}" + email prefilled/locked + `Send magic link`.
3. Sign-in call: `supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: `${APP_URL}/auth/callback?invite=${token}` } })`.

### 5.2 Callback (`app/auth/callback/route.ts`)
1. `exchangeCodeForSession(code)`.
2. If `invite` param: call server function `acceptInvite(token, user)` using service role:
   - invite valid, unused, unexpired, **email matches `user.email` (case-insensitive)** else 403.
   - upsert `profiles(id=user.id, society_id, role, flat_no, full_name=null)`.
   - mark invite `accepted_at=now(), accepted_by=user.id` (single-use, in one transaction).
3. If no invite and no profile → redirect `/login?error=no_invite`.
4. Redirect: no `full_name` → `/app/profile-setup` (name, flat, phone, preferred language; saved via `PATCH /api/me`), else **all roles land on `/app/today`** (residents see only their own complaints there).

### 5.3 Returning login
`/login` → email → magic link → callback → profile exists → `/app/today`. If email has no profile, show generic "If you're invited, a link is on its way" (no account enumeration).

### 5.4 Logout
`POST /api/auth/logout` → `supabase.auth.signOut()` → `/login`.

## 6. Route protection
| Path | Rule |
|---|---|
| `/`, `/login`, `/invite/*`, `/auth/callback` | public |
| `/app/*` | session + profile required (middleware + `getSessionProfile()` in layout) |
| `/app/import` | committee, admin |
| `/app/members` | admin |
| `/api/*` | each handler calls `requireRole([...])`; unauthenticated → 401, wrong role → 403 |
| `/api/cron/*` | `Bearer CRON_SECRET` only |

`lib/auth.ts`:
```ts
export async function getSessionProfile() { /* supabase.auth.getUser() (NOT getSession) → select profile via admin client */ }
export async function requireRole(roles: Role[]) { const p = await getSessionProfile(); if(!p) throw new HttpError(401); if(!roles.includes(p.role)) throw new HttpError(403); return p; }
```
Always use `auth.getUser()` server-side (validates JWT), never trust `getSession()`.

## 7. Edge cases
- Expired/used invite → page "This invite is no longer valid. Ask your admin for a new one."
- Resident removed → profile deleted → next request 403 → redirect `/login`.
- Last admin cannot be demoted/removed (API check).
- Rate limit: 5 magic-link requests / email / hour (Supabase default + API-level for invite creation: 20/hour/admin).
- Magic link opened on different device: works (PKCE code exchange needs same browser → if `exchangeCodeForSession` fails show "Open the link in the same browser you requested it from, or request a new one").
