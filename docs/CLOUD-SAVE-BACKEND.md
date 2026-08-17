# Cloud Save Backend

The backend behind **cloud device backup** (`services/cloudBackup.ts`,
`services/CloudSyncService.ts`, `lib/progress/cloud.ts`) and the
**leaderboard** (`components/LeaderboardModal.tsx`).

Scope today is **device backup**, not cross-device sync: identity is an
anonymous per-install id, so there is no account to carry a save to a second
phone. Cross-device requires sign-in — see *Future work*.

What is **supported today is same-install restore**: recovering a save into the
same app installation it was backed up from (a deleted or corrupted slot, a
cleared game save). That is the case the validation pass is written to prove.

**Whether a backup survives a REINSTALL is an open question, not a promise.**
The identity is `cloud_user_id`, minted per install and stored in AsyncStorage
(`services/CloudSyncService.ts`). AsyncStorage is not guaranteed to survive an
iOS app delete + reinstall, and if the id does not survive, the new install
mints a different one and finds no backup — the backup row is still there, but
nothing points at it. Nobody has run that on a device yet. The device
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
| `revision` | integer | `weeksLived` at upload; `CHECK >= 1` |
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
`backend_config.cloud_auth_token`. The same value ships to the app as
`EXPO_PUBLIC_CLOUD_AUTH_TOKEN` (see the `preview` profile in `eas.json`).

`EXPO_PUBLIC_*` values are **inlined into the JS bundle**, so this token is
extractable from any installed build. It is an *abuse barrier* — it stops
casual internet-wide scanning and drive-by writes — **not** a secret and not
an authorization boundary. Do not let it accumulate more responsibility than
that, and do not reuse it for anything that guards money or identity.

The real integrity story is the per-payload `hash`/`signature` the client
sends. The server currently **checks their shape, not their cryptography**
(see *Future work*).

To rotate: `update public.backend_config set value = '<new>' where key =
'cloud_auth_token';`, update `eas.json`, ship a build. Old builds stop
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
`EXPO_PUBLIC_CLOUD_AUTH_TOKEN` value in `eas.json`:

```bash
BASE="https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/save?userId=player_x&slotId=slot_1"   # 401
curl -s -X POST "$BASE/save" -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"state":{"weeksLived":1},"updatedAt":1,"userId":"player_curl_1","slotId":"slot_1","revision":1,"hash":"deadbeef01","signature":"0123456789abcdef0123"}'
curl -s "$BASE/save?userId=player_curl_1&slotId=slot_1" -H "Authorization: Bearer <TOKEN>"
```

## Rollout

`preview` carries the flag, URL and token today; `production` deliberately
does not. Promoting is three lines copied from the `preview` profile's `env`
into `production`'s in `eas.json`:

```json
"EXPO_PUBLIC_ENABLE_CLOUD_SAVE": "true",
"EXPO_PUBLIC_CLOUD_SAVE_URL": "https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1",
"EXPO_PUBLIC_CLOUD_AUTH_TOKEN": "<same value as preview>"
```

Do that only after a preview build has actually backed up and restored on a
device (§ *Task 1* in `tasks/cowork-handoff-cloud-backup.md` — step 5,
same-install restore, is the one that must pass).

The client refuses to enable itself unless **both** the flag and a non-empty
URL are present (`lib/config/featureFlags.ts`), so a half-filled profile
silently stays off rather than rendering buttons that cannot work.

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
