# 01 — PRD: SocietyDesk (Complaint Triage for Housing Societies)

## 1. Problem
A ~100-flat society committee (volunteers, a few minutes/day) receives complaints via chat (water, lifts, parking, noise, cleaning). They pile up, repeat, and urgent ones get buried. Messages are mixed English/Hindi/Hinglish.

## 2. Goal
Turn messy complaints into a **ranked, deduplicated, tracked queue** that a volunteer can clear in **≤5 minutes/day**, until each item is resolved.

## 3. Users
| Role | Needs |
|---|---|
| Resident | Submit complaint in any language, see status, get closure |
| Committee member | 5-min daily queue, assign, update status, comment |
| Admin (secretary/chair) | Everything above + members, invites, settings, digest |

## 4. Scope (MVP)
1. **Intake**: (a) resident web form, (b) committee "Paste chat" bulk import (WhatsApp export or pasted text). WhatsApp API = Phase 2.
2. **AI triage** (per complaint): language detect, English translation, title, category, urgency, location, duplicate cluster, confidence.
3. **Dedup/Clustering**: same issue from many flats → one cluster with a count.
4. **Tracking**: status lifecycle, assignee, SLA due date, timeline, comments.
5. **Today view**: prioritized 5-minute queue.
6. **Daily digest** email to committee (8:00 IST).
7. **Auth + roles** (resident / committee / admin).

## 5. Out of scope (MVP)
Payments/billing, WhatsApp two-way bot, vendor management, file uploads/photos, native apps, multi-society SaaS billing (schema is multi-tenant-ready; UI is single society).

## 6. Categories & urgency
Categories: `water`, `lift`, `parking`, `noise`, `cleaning`, `electrical`, `security`, `other`.
Urgency (SLA): `critical` 4h · `high` 24h · `medium` 72h · `low` 7d.
Critical examples: person stuck in lift, no water >24h, water leakage into flats, fire/electrical spark, gas smell, security breach.

## 7. Status lifecycle
`new → triaged → assigned → in_progress → resolved → closed`
- Resident can confirm/reopen after `resolved` (auto-close after 3 days).
- Every change writes a `complaint_events` row.

## 8. Functional requirements
- FR1 Resident submits text (≤1000 chars), flat auto-filled from profile.
- FR2 Import accepts ≤300 lines pasted; parsed into individual complaints; duplicates of already-imported lines skipped (hash).
- FR3 AI result must appear ≤10s; if AI fails, complaint saved with rule-based fallback and `needs_review=true`.
- FR4 Committee can override any AI field (category/urgency/cluster); override logged.
- FR5 Today view shows: critical → overdue → new/untriaged → assigned-to-me. Max 15 items with "show more".
- FR6 One-tap actions on a card: Assign to me, Mark in progress, Resolve.
- FR7 Cluster view: merge/split; resolving a cluster resolves all children after confirm.
- FR8 Resident sees own complaints + status only (no other residents' data).
- FR9 Digest email lists critical, overdue, new count, resolved-yesterday count.

## 9. Non-functional
- Mobile-first (committee uses phones). Works at 360px.
- Hindi (Devanagari) text renders and is searchable.
- p95 page load <2s on 4G; AI cost < ₹0.30/complaint.
- Accessibility: keyboard focus, contrast AA, reduced-motion respected.

## 10. Success metrics
- Median time from complaint → first action < 4h for critical.
- Daily committee time ≤5 min (self-reported).
- ≥85% AI category accuracy (spot-check 50 complaints).
- Duplicate reduction ≥30%.

## 11. Acceptance test (demo script)
1. Paste 20 mixed messages incl. "lift me koi fasa hai!!", "पानी नहीं आ रहा 2 din se", "Parking slot 12 pe koi gaadi khadi hai" → all sorted, lift = critical, water repeats clustered.
2. Today view shows lift first with SLA countdown.
3. Assign, resolve; resident sees status update.
