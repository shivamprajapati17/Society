# 08 — API Plan

Conventions: JSON only, base `/api`. Auth = Supabase session cookie. Errors: `{ "error": { "code": "VALIDATION|UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|RATE_LIMITED|INTERNAL", "message": "..." } }` with status 400/401/403/404/429/500. Every handler: `requireRole` → zod parse → tenant check → action → write `complaint_events`. Roles: **R**esident, **C**ommittee, **A**dmin.

Shared enums: `category`, `urgency`, `status` exactly as in `05-DB-SCHEMA.md`.

## Complaint object
```json
{ "id":"uuid","ref_no":123,"flat_no":"B-302","reporter_label":"Ramesh","raw_text":"lift me koi fasa hai",
  "language":"hinglish","summary_en":"Someone is stuck in the lift","title":"Person stuck in lift",
  "category":"lift","urgency":"critical","status":"new","triage":"done","location":"B wing",
  "ai_confidence":0.94,"ai_reason":"Person trapped","needs_review":false,
  "cluster_id":null,"cluster_count":1,"assignee":{"id":"uuid","full_name":"Anil"}|null,
  "sla_due_at":"ISO","created_at":"ISO","updated_at":"ISO" }
```
(Residents get the same object minus `ai_*`, `needs_review`, `reporter_label`.)

## Endpoints

### Me
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/me` | all | `{id,email,role,full_name,flat_no,phone,preferred_lang,society:{id,name}}` |
| PATCH | `/api/me` | all | body `{full_name?,flat_no?,phone?,preferred_lang?}` (strict) |
| POST | `/api/auth/logout` | all | signs out |

### Complaints
| Method | Path | Role | Body / Query → Response |
|---|---|---|---|
| POST | `/api/complaints` | R,C,A | `{text:string(3..1000), flat_no?}` (flat_no only honored for C/A). Creates row (`triage='pending'`, status `new`), event `created`, schedules triage via `after()`. Returns `201 {complaint}`. Dedup: same user+text within 10 min → `200` existing. |
| GET | `/api/complaints` | R (own only), C, A | Query: `status,category,urgency,mine=1,cluster_id,q,cursor,limit(≤50,default 20)`. Returns `{items:[Complaint], next_cursor|null}`. Cursor = base64 of `created_at,id`. Search `q` = `ilike` on title/raw_text. |
| GET | `/api/complaints/:id` | R(own), C, A | `{complaint, events:[…], comments:[…]}` (residents: no events, no internal comments). Used for triage polling. |
| PATCH | `/api/complaints/:id` | C, A | Any of `{status, category, urgency, assignee_id|null, title, cluster_id|null}`. Rules: valid status transitions (`new→triaged→assigned→in_progress→resolved→closed`; also any→`resolved`; `resolved→in_progress` = reopen); `resolved` sets `resolved_at`; urgency change recomputes `sla_due_at`; category/urgency edits log `override` event and clear `needs_review`; assignee must be committee/admin of same society. |
| POST | `/api/complaints/:id/reopen` | R(own), C, A | Only from `resolved`; increments `reopened_count`; status → `in_progress`. |
| POST | `/api/complaints/:id/retriage` | C, A | Re-runs AI. Rate limited 5/hour. Returns `202`. |
| POST | `/api/complaints/:id/comments` | R(own,`is_internal=false` forced), C, A | `{body, is_internal?}` → `201 {comment}` |

### Import
| POST | `/api/complaints/import` | C, A | Two modes. `{mode:"preview", text}` → `{rows:[{sender,flat_no,text,ts?,duplicate:boolean}], skipped:number}` (no writes, no AI). `{mode:"commit", rows:[{sender,flat_no,text}]}` (≤300) → `202 {created:number, duplicates:number, ids:[uuid]}`; inserts with `source='import'`, `source_hash`; triage runs in background (concurrency 5). UI polls `GET /api/import/progress?ids=a,b,c` → `{done:n,total:m,failed:k}`. |

### Today & summary
| GET | `/api/today` | R,C,A | C/A: `{critical:[…],overdue:[…],needs_review:[…],mine:[…],counts:{critical,overdue,new,mine}}` (open statuses only; each list max 15, `?more=critical` to page). R: `{mine:[own open complaints]}`. Order per `05-DB-SCHEMA.md` notes. |

### Clusters
| GET | `/api/clusters` | C,A | `[{id,title,category,urgency,count,open_count,canonical_complaint_id}]` open clusters. |
| POST | `/api/clusters/:id/merge` | C,A | `{into_cluster_id}` → moves complaints, deletes empty cluster, event `clustered`. |
| POST | `/api/clusters/:id/resolve` | C,A | `{note?}` → sets all open children `resolved`; returns `{resolved:n}`. |

### Members & invites
| GET | `/api/members` | A | list profiles (+ pending invites) |
| PATCH | `/api/members/:id` | A | `{role?,flat_no?}`; cannot demote last admin |
| DELETE | `/api/members/:id` | A | removes profile (+ auth user); cannot remove self if last admin |
| POST | `/api/invites` | A | `{email,role,flat_no?}` → `201 {invite_url,expires_at}`; emails link if Resend set |
| POST | `/api/invites/accept` | server-internal | used by `/auth/callback` (not exposed to browser fetch) |
| GET | `/api/invites/:token` | public | `{valid:boolean, society_name?, role?, email_hint?}` (email masked `r***@x.com`) |

### Cron (Bearer `CRON_SECRET`)
| POST | `/api/cron/digest` | cron | Builds per-society digest → emails all committee/admin: critical list, overdue list, new count, resolved-yesterday count, link to `/app/today`. Skips if nothing open. Returns `{sent:n}`. |
| POST | `/api/cron/autoclose` | cron | Closes `resolved` > 3 days. Returns `{closed:n}`. |

### Phase 2 (stub only, return 501)
`POST /api/webhooks/whatsapp` — Meta Cloud API webhook: verify `X-Hub-Signature-256`, map sender phone → profile, create complaint with `source='whatsapp'`.

## zod snippets (`lib/schemas.ts`)
```ts
export const Category = z.enum(["water","lift","parking","noise","cleaning","electrical","security","other"]);
export const Urgency  = z.enum(["critical","high","medium","low"]);
export const Status   = z.enum(["new","triaged","assigned","in_progress","resolved","closed"]);
export const CreateComplaint = z.object({ text: z.string().trim().min(3).max(1000), flat_no: z.string().trim().max(10).optional() }).strict();
export const PatchComplaint = z.object({ status: Status.optional(), category: Category.optional(), urgency: Urgency.optional(),
  assignee_id: z.string().uuid().nullable().optional(), title: z.string().trim().max(120).optional(), cluster_id: z.string().uuid().nullable().optional() }).strict();
export const ImportCommit = z.object({ mode: z.literal("commit"), rows: z.array(z.object({ sender: z.string().max(60), flat_no: z.string().max(10).nullable(), text: z.string().trim().min(3).max(1000) })).min(1).max(300) });
```

## Status-transition table (enforce in PATCH)
```
new → triaged, assigned, in_progress, resolved
triaged → assigned, in_progress, resolved
assigned → in_progress, resolved, triaged
in_progress → resolved, assigned
resolved → in_progress (reopen), closed
closed → (none)
```
Setting `assignee_id` on `new|triaged` auto-moves status to `assigned`.
