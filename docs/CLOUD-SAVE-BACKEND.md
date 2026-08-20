# Cloud Save Backend

The backend behind **cloud device backup** (`services/cloudBackup.ts`,
`services/CloudSyncService.ts`, `lib/progress/cloud.ts`) and the
**leaderboard** (`components/LeaderboardModal.tsx`).

Scope today is **device backup**, not cross-device sync: identity is an
anonymous per-install id, so there is no account to carry a save to a second
phone **without a transfer code** — see `POST /save/transfer` below. Sign-in was
considered and rejected: offering Google obliges offering Sign in with Apple
(App Store guideline 4.8), and having accounts at all obliges in-app account
deletion (5.1.1(v)). A transfer code gets the save across without either.

What is **supported today is same-install restore**: recovering a save into the
same app installation it was backed up from (a deleted or corrupted slot, a
cleared game save). That is the case the validation pass is written to prove.

**Reinstall survival is now platform-dependent, and the difference is not a
detail.** The identity is resolved by `utils/deviceIdentity.ts`, which reads
secure-store before falling back to AsyncStorage:

| | Survives uninstall? | Why |
|---|---|---|
| **iOS** | **Yes** | Keychain items outlive app deletion, so reinstall recovers the id |
| **Android** | **No** | Keystore-backed values live in app storage, which uninstall deletes |

Android cannot be fixed by configuration. Auto-backup would carry the
ciphertext to a device whose Keystore lacks the key, restoring undecryptable
garbage rather than an absent key — which is why the config plugin excludes it
(`app.config.js`). On Android the answer to reinstall is the same as the answer
to a new phone: **mint a transfer code before uninstalling.**

Neither has been run on real hardware yet. The device
validation in `tasks/cowork-handoff-cloud-backup.md` exists to settle it; if
the id is lost, the fix is to move it to the Keychain/Keystore
(`expo-secure-store`), which does survive a reinstall. Do not describe
reinstall restore as working until that check has been run.

---

## Deployment

| | |
|---|---|
| Provider | Supabase |
| Project | `deeplife-backend` (`gyxmoqanjdvvllwjfsst`), region `eu-north-1` |
| Base URL | `https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1` |
| Functions | `save`, `leaderboard` (both `verify_jwt: false` — they authenticate themselves, see below) |

The base URL is what `EXPO_PUBLIC_CLOUD_SAVE_URL` must hold. `lib/progress/cloud.ts`
appends the paths itself (`${API_URL}/save`, `${API_URL}/leaderboard/${category}`),
so the env var carries **no** trailing path.

## Tables

`public.cloud_saves` — PK `(user_id, slot_id)`

| column | type | notes |
|---|---|---|
| `user_id` | text | `player_*`, the anonymous device id |
| `slot_id` | text | `CHECK slot_id ~ '^slot_[1-3]$'` |
| `state` | jsonb | the serialized `GameState` |
| `updated_at` | bigint | client epoch ms |
| `revision` | integer | epoch **seconds** at upload, floored to `last + 1` per slot so it strictly increases per save; `CHECK >= 1`. Seconds, not ms, because ms overflows int4 — which also makes 2038-01-19 the ceiling. Widening to `bigint` is the fix when that matters. It is **not** `weeksLived`: that moves once per played week, so same-week saves read as already-synced and the cloud copy silently lagged. |
| `hash`, `signature` | text | client integrity proof |
| `received_at` | timestamptz | server clock, drives the write throttle |

`public.leaderboard_entries` — PK `(category, user_id)`, best score per player.

`public.backend_config` — service-role-only key/value; holds `cloud_auth_token`.

**RLS is enabled on every table with no policies**, deliberately: anon and
authenticated roles can do nothing at all, and the edge functions reach the
tables with the service role. The Supabase linter reports this as INFO
`rls_enabled_no_policy`; that is the intended posture, not a gap to fix.

## Auth model — read this before treating the token as a secret

Both functions require `Authorization: Bearer <token>`, compared against
`backend_config.cloud_auth_token`. The same value reaches the app as
`EXPO_PUBLIC_CLOUD_AUTH_TOKEN`, set as an **EAS environment variable** on the
profile — deliberately NOT in `eas.json`. It ships inlined in the bundle
either way, so keeping it out of the repo costs nothing and avoids it living
in git history permanently. Set it with `eas env:create` (or the EAS
dashboard) on the `preview` profile before building; `lib/config/featureFlags.ts`
requires it, so a build without it turns cloud backup cleanly OFF rather than
rendering buttons that cannot work.

`EXPO_PUBLIC_*` values are **inlined into the JS bundle**, so this token is
extractable from any installed build. It is an *abuse barrier* — it stops
casual internet-wide scanning and drive-by writes — **not** a secret and not
an authorization boundary. Do not let it accumulate more responsibility than
that, and do not reuse it for anything that guards money or identity.

The real integrity story is the per-payload `hash`/`signature` the client
sends. The server currently **checks their shape, not their cryptography**
(see *Future work*).

To rotate: `update public.backend_config set value = '<new>' where key =
'cloud_auth_token';`, update the EAS environment variable, ship a build. Old builds stop
syncing at that moment — rotate on a release boundary, not mid-cycle.

## Endpoint contract

### `POST /save`
Body: `{ state, updatedAt, userId, slotId, revision, hash, signature }`
→ `200 {success:true}` · `400` invalid field or missing integrity proof ·
`401` bad token · `409` **stale revision** (never lets an older backup
overwrite a newer one) · `413` body over 3 MB · `429` writes to the same slot
inside 5 s.

### `GET /save?userId=&slotId=`
→ `200` with the `CloudSave` shape (`state, updatedAt, userId, slotId,
revision, hash, signature`), or `200 null` when the slot has no backup —
the client reads JSON `null` as "nothing to restore". `400` on a malformed
id, `401` on a bad token.

### `DELETE /save?userId=&slotId=`
Erase ONE slot.
→ `200 {success:true, deleted:0|1}` · `400` invalid id · `401` bad token

### `DELETE /save?userId=`
Erase **everything** for that device: saves, leaderboard entries and transfer
codes. This is the GDPR article 17 path, so it deliberately reaches past
`cloud_saves` — a player asking to be erased means all of it.
→ `200 {success:true, deleted:n, leaderboardDeleted:n}` · `400` invalid id

Erasure is **idempotent**: deleting nothing answers `200 {deleted:0}`, never an
error, so a client retrying after a dropped response does not see a failure for
work that already succeeded.

### `POST /save/transfer`
Body: `{ userId }` → mint a single-use transfer code for that device.
→ `200 {success:true, code, expiresAt, expiresInMinutes:15}`

A code is a **bearer credential** — whoever holds it can copy the save. Hence:
15-minute TTL, single use, 10 characters of crypto-random entropy (~49.5 bits)
over an alphabet with `0/O/1/I/L` removed so it can be read aloud. Minting
again invalidates the previous unclaimed code.

### `POST /save/claim`
Body: `{ userId, code }` → spend a code, copying the source device's saves onto
the caller.
→ `200 {success:true, slots:n}` · `404` invalid, expired **or** already used ·
`429` too many attempts

`404` does not distinguish those three cases: telling a guesser which one a
code was is free information. `slots:0` is a legitimate success — a code minted
by a device that had not backed up yet.

It **copies, never repoints.** Repointing would leave two phones writing to one
key, clobbering each other on every backup; copying leaves the old phone
working and lets the two diverge. The claim and the copy happen in ONE Postgres
transaction (`claim_save_transfer`), so two devices racing the same code cannot
both win.

### `POST /leaderboard/{category}`
Body: `{ name, score, userId, runSignature, revision }` → upserts only when
it beats the player's existing score.

### `GET /leaderboard/{category}`
→ top 50 by score desc, as `LeaderboardEntry[]`.

## Verified

Smoke-tested against the live functions on 2026-08-16 (run from inside the
project's own network via a temporary `http` extension, since the agent
sandbox blocks outbound HTTP to the functions host; the extension was
dropped afterwards):

| check | result |
|---|---|
| GET without a token | `401` |
| POST a save | `200 {"success":true,"message":"Save successful"}` |
| GET it back | `200`, payload byte-identical to what was written |
| GET a slot with no backup | `200 null` |
| GET `slot_9` (invalid) | `400` |
| POST an older revision | `409 Stale revision` |
| Two writes inside 5 s | second is `429 Too many writes` |
| POST with a stub hash/signature | `400 Missing integrity proof` |
| Leaderboard POST then GET | `200`, entry returned in the client's shape |

Test rows were deleted; both tables are empty.

To re-run from a machine with network access, replace `<TOKEN>` with the
`cloud_auth_token` value (from `backend_config`, or the EAS env var):

```bash
BASE="https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/save?userId=player_x&slotId=slot_1"   # 401
curl -s -X POST "$BASE/save" -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"state":{"weeksLived":1},"updatedAt":1,"userId":"player_curl_1","slotId":"slot_1","revision":1,"hash":"deadbeef01","signature":"0123456789abcdef0123"}'
curl -s "$BASE/save?userId=player_curl_1&slotId=slot_1" -H "Authorization: Bearer <TOKEN>"
```

## Retention

Backups untouched for **18 months** are deleted by
`prune_abandoned_cloud_saves()`, run daily at 03:17 UTC via `pg_cron`. Spent
transfer codes are dropped a week after expiry.

Keep the 18-month figure in step with the privacy policy — it is the number
that must be defensible, and it is the one players are entitled to be told.

## Rollout

`preview` carries the flag and URL today; `production` deliberately does not.
The auth token is an EAS environment variable on the profile, not repo config.
Promoting means two lines copied from the `preview` profile's `env` into
`production`'s in `eas.json`:

```json
"EXPO_PUBLIC_ENABLE_CLOUD_SAVE": "true",
"EXPO_PUBLIC_CLOUD_SAVE_URL": "https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1"
```

plus setting `EXPO_PUBLIC_CLOUD_AUTH_TOKEN` on the `production` profile in EAS.
All three are required (`lib/config/featureFlags.ts`), so forgetting the token
leaves the feature off rather than half-on.

Do that only after a preview build has actually backed up and restored on a
device (§ *Task 1* in `tasks/cowork-handoff-cloud-backup.md` — step 5,
same-install restore, is the one that must pass).

The client refuses to enable itself unless the flag, a non-empty URL **and**
the auth token are all present (`lib/config/featureFlags.ts`), so a half-filled
profile stays off rather than rendering buttons that cannot work.

## Future work

1. **Server-side signature verification.** The functions validate that
   `hash`/`signature` are present and plausibly shaped; they do not recompute
   them. Doing so needs the save-signing key server-side (`backend_config` is
   the natural home) and must mirror `utils/saveValidation.ts`'s digest
   exactly — including its **CESU-8** treatment of astral characters
   (documented at `utfBytes` there). Until then, a determined player can
   write an arbitrary state to their own backup, which is a cheating vector,
   not a data-integrity one — they can already edit local saves.
2. **Cross-device sync** needs real identity (Sign in with Apple is mandatory
   on iOS if any third-party sign-in is offered), an account UI, and a merge
   policy. `services/CloudSyncService.ts` has a `resolveConflict` path already
   routed through the shared load hydration; last-write-wins by `weeksLived`
   is the sane default.
3. **Retention/GDPR.** No deletion endpoint exists. A player cannot currently
   ask for their backup to be erased, and nothing prunes abandoned rows. Both
   want solving before this leaves preview in a jurisdiction that cares.
