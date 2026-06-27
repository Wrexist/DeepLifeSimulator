# DeepLife Simulator — Backend API Spec (NEXT-0)

## ✅ DEPLOYED — Analytics ingest is LIVE (2026-06-24)
Route 1 (analytics) is built and verified on Supabase (free tier, $0/mo):
- **Project:** `deeplife-backend` (ref `gyxmoqanjdvvllwjfsst`), region `eu-north-1`, org `Wrexist's Org`.
- **Endpoint (set this as `EXPO_PUBLIC_ANALYTICS_URL`):**
  `https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/analytics`
- **Edge function** `analytics` (public / `verify_jwt=false`, matching the client's no-auth flush):
  validates the event-name allowlist, caps batches at 500, inserts to `analytics_events` with
  `on conflict (id) do nothing` (idempotent de-dupe for client retries).
- **Tables created:** `analytics_events` (live), plus `cloud_saves` + `leaderboard_entries`
  (schema ready for NEXT-1/2; RLS enabled, written only via the service role).
- **Verified:** DB-level idempotency test passed (duplicate `event.id` → single row); table cleaned.
  Live HTTP smoke test could not run from the build agent (its egress proxy policy-denies
  `supabase.co`) — it will serve as soon as a client posts, or you can `curl` it from anywhere.

**To turn the funnel on (you, in the prod EAS profile), then rebuild:**
```
EXPO_PUBLIC_ANALYTICS_URL=https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/analytics
EXPO_PUBLIC_ENABLE_ANALYTICS=true
# and confirm BORING_BUILD_MODE is not on in release
```
Then watch rows land: `select name, count(*) from analytics_events group by 1 order by 2 desc;`

> Routes 2–4 (cloud save, leaderboards, receipt verify) still need the auth/accounts layer
> (Apple/Google) before they can go live — see sections 2–5 below.

### Repo-side gaps found while scoping (2026-06-24)
- **NEXT-1 conflict UI — ✅ BUILT (2026-06-24).** `components/CloudSyncConflictModal.tsx` now
  renders the local/remote/**merge** resolution surface (via `lib/cloudSync/conflictBridge.ts`,
  mounted in `app/_layout.tsx`), replacing the old crude native Alert. The
  migrate→repair→validate→setGameState apply pipeline stays in `GameActionsContext`. So the
  two-device divergence path now has a real UI. (Remaining for go-live: the backend `/save`
  routes + auth so conflicts can actually occur in prod.)
- **NEXT-4:** `utils/iapConfig.ts` defines **27 SKUs**. The roadmap target is ~3–4 gem tiers +
  the DeepLife+ anchor + a one-time Remove-Ads — a merchandising trim (product decision), not a
  code blocker. No explicit "dead gold-upgrade" markers remain in the file.

---


> **Status:** turnkey spec derived directly from the existing RN client code. Every
> route, payload, header, and validation rule below is what the app **already sends/expects** —
> the client is built and waiting on these endpoints. Build the server to match this exactly.
>
> Source of truth in the app:
> - Analytics: `lib/analytics/AnalyticsService.ts` (`flush()`), `lib/analytics/events.ts` (shapes)
> - Cloud save + leaderboards: `lib/progress/cloud.ts`, `services/CloudSyncService.ts`
> - Receipt verify: `services/IAPService.ts` (`verifyReceiptWithServer`)

One authenticated service serves **four** client contracts. Build them as routes of a single service.

---

## 0. Environment variables the client reads (set in the prod EAS profile)

| Var | Used by | Notes |
|-----|---------|-------|
| `EXPO_PUBLIC_ANALYTICS_URL` | analytics flush | full URL of the ingest route; if unset, flush is a permanent no-op |
| `EXPO_PUBLIC_ENABLE_ANALYTICS` | feature flag | must be `true` in prod; also gate off `BORING_BUILD_MODE` |
| `EXPO_PUBLIC_CLOUD_SAVE_URL` | cloud save + leaderboards | **base** URL; client appends `/save` and `/leaderboard/:category` |
| `EXPO_PUBLIC_CLOUD_AUTH_TOKEN` | cloud save + leaderboards | sent as `Authorization: Bearer <token>`. With real accounts this becomes a **per-user session token** minted at sign-in |
| `EXPO_PUBLIC_CLOUD_REQUIRE_AUTH` | cloud gating | anything other than `'false'` ⇒ auth required (default secure) |
| `EXPO_PUBLIC_IAP_VERIFY_URL` | receipt verify | full URL; if unset in prod the client **fails closed** (grants nothing) |
| `EXPO_PUBLIC_IAP_VERIFY_TOKEN` | receipt verify | optional `Authorization: Bearer <token>` |
| `EXPO_PUBLIC_ENABLE_ADMOB` | ads | `true` to serve real ads in prod |

Client behaviour to mirror: 5s timeout on cloud calls; client rate-limits already; cloud sync
auto-disables after 3 consecutive failures; all calls fail safe (local-only) on error.

---

## 1. Analytics ingest — `POST {EXPO_PUBLIC_ANALYTICS_URL}`
*(NOW-1. No per-user auth required — cheapest route, build first.)*

**Request** — `Content-Type: application/json`
```jsonc
{ "events": [
  {
    "id": "string",          // locally-unique; DE-DUPE ON THIS
    "name": "session_start", // must be one of the catalogue below
    "ts": "2026-06-24T12:00:00.000Z", // ISO, recorded on-device
    "installId": "string",   // anonymous app-generated id (NOT device/ad id)
    "sessionId": "string",   // per-launch id
    "props": { "k": "v" }    // optional; values are string|number|boolean|null
  }
] }
```
**Behaviour:** insert each event; **de-dupe on `event.id`** (client may resend on retry — the
batch is only dropped from the client queue on a 2xx). Batches are ≤ BATCH_SIZE.
**Response:** any `2xx` = accepted (client clears the sent ids). Non-2xx ⇒ client keeps & retries.

**Event-name catalogue** (reject unknown names): `session_start, session_end, onboarding_step,
tutorial_step, first_week_completed, week_advanced, prestige, death, daily_reward_claimed,
challenge_completed, streak_changed, achievement_unlocked, paywall_viewed, purchase_started,
purchase_succeeded, purchase_failed, ad_shown, ad_rewarded, screen_view, save_size, save_repaired`.

**Dashboards this unlocks:** D1/D7/D30 from `session_start` + `installId` + `ts`; the
`paywall_viewed → purchase_started → purchase_succeeded` funnel; ARPDAU from `ad_shown`/`ad_rewarded`.

---

## 2. Cloud save — `{EXPO_PUBLIC_CLOUD_SAVE_URL}/save`
*(NEXT-1. Requires `Authorization: Bearer`.)*

### `POST /save`
```jsonc
{ "state": { /* opaque GameState blob */ },
  "updatedAt": 1719230000000,  // epoch ms
  "userId": "string",          // server-issued, see auth
  "slotId": "slot_1",          // ^slot_[1-3]$
  "revision": 1,               // integer >= 1, monotonic per (userId,slotId)
  "hash": "string",            // >= 8 chars (client integrity digest)
  "signature": "string" }      // >= 16 chars (HMAC; verify server-side)
```
**Server MUST mirror client validation** (client refuses to send otherwise):
`userId` ≥3 chars & not in {local_player, guest, anonymous, unknown, null, undefined};
`slotId` matches `^slot_[1-3]$`; `revision` finite integer ≥1; `hash` ≥8; `signature` ≥16.
**Conflict policy:** last-write-wins by `revision` (tie-break `updatedAt`); **reject stale revisions**.
**Verify the `signature`** (HMAC of the payload with a server-held secret) — do not trust the client.
**Response:** `2xx` on accept; non-2xx ⇒ client falls back to local-only.

### `GET /save?userId=<>&slotId=<>`
**Response 200:**
```jsonc
{ "state": {...}, "updatedAt": 1719230000000, "slotId": "slot_1",
  "userId": "string", "revision": 1, "hash": "string", "signature": "string" }
```
No save ⇒ return `null`/`404` (client treats either as "use local").

---

## 3. Leaderboards — `{EXPO_PUBLIC_CLOUD_SAVE_URL}/leaderboard/:category`
*(NEXT-2. Requires Bearer.)*

### `POST /leaderboard/:category`
```jsonc
{ "name": "string",         // display name, >=1 char
  "score": 12345,           // finite, >= 0
  "userId": "string",       // valid per cloud rules above
  "runSignature": "string", // >= 16 chars
  "revision": 1 }           // integer >= 1
```
### `GET /leaderboard/:category` → `200`
```jsonc
[ { "name": "string", "score": 12345, "category": "net_worth",
    "userId": "string", "runSignature": "string", "revision": 1 } ]
```
**⚠️ Anti-cheat is ship-blocking:** `runSignature` is generated client-side and is **forgeable**.
The server MUST sanity-bound scores (max plausible net-worth/age per `revision`) and reject
impossible values, or the boards fill with `9e99` garbage day one. Tie identity to the verified
account `userId`, not the free-text `name`.

---

## 4. Receipt verification — `POST {EXPO_PUBLIC_IAP_VERIFY_URL}`
*(NEXT-3. Optional Bearer via `EXPO_PUBLIC_IAP_VERIFY_TOKEN`.)*
```jsonc
{ "receipt": "string", "productId": "string", "transactionId": "string|undefined" }
```
**Response:** `{ "verified": true }` — client grants the entitlement **only** when `verified === true`
(any non-2xx or missing/false ⇒ grants nothing; in prod with no URL the client fails closed).
**Server:** validate with Apple App Store Server API (prod first, fall back to sandbox) and Google
Play Developer API; ensure idempotent one-time grant per `transactionId`.

---

## 5. Auth / identity (decided: real accounts — Apple + Google)
Hard prerequisite for routes 2–4 using a real `userId`.
- Sign in with Apple + Google → mint a backend **session token** (the value the client carries as
  `EXPO_PUBLIC_CLOUD_AUTH_TOKEN`, now per-user) and a stable server-issued `userId`
  (must satisfy cloud rules: ≥3 chars, not reserved).
- **Mandatory in-app account deletion** (App Store Guideline 5.1.1(v)) — purge cloud saves +
  leaderboard entries server-side.
- On first sign-in, **adopt the local save** into the account (claim `slot_[1-3]`).
- Verify `Authorization: Bearer` on every route 2–4; rate-limit server-side.

---

## 6. Suggested build order (cheapest unblock first)
1. **Analytics ingest** (route 1) — no per-user auth; unblocks NOW-1 measurement immediately.
2. **Auth/accounts** (section 5) — gates the rest.
3. **Receipt verify** (route 4) — protects revenue.
4. **Cloud save** (route 2) → **Leaderboards + anti-cheat** (route 3).

## 7. Data model sketch (Postgres)
```sql
-- analytics
create table analytics_events (
  id text primary key,                       -- client event.id → idempotent insert
  name text not null,
  ts timestamptz not null,
  install_id text not null,
  session_id text not null,
  props jsonb,
  received_at timestamptz default now()
);
-- cloud saves (one row per user+slot, newest revision wins)
create table cloud_saves (
  user_id text not null,
  slot_id text not null check (slot_id ~ '^slot_[1-3]$'),
  state jsonb not null,
  updated_at bigint not null,
  revision int not null check (revision >= 1),
  hash text not null,
  signature text not null,
  primary key (user_id, slot_id)
);
-- leaderboards
create table leaderboard_entries (
  category text not null,
  user_id text not null,
  name text not null,
  score numeric not null check (score >= 0),
  run_signature text not null,
  revision int not null check (revision >= 1),
  created_at timestamptz default now(),
  primary key (category, user_id)            -- best score per user per category
);
```
Insert analytics with `on conflict (id) do nothing` to get de-dupe for free.
