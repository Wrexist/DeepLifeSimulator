# Cowork handoff — ship cloud device backup

Everything below needs a real machine: a simulator or device, EAS credentials,
the Supabase dashboard, and App Store Connect. None of it can be done from the
cloud agent sandbox (no simulator, no EAS auth, and outbound HTTP to the
Supabase functions host is blocked by the network policy).

**Paste the block between the two markers into Cowork verbatim.** It is written
to be self-contained — Cowork should not need anything else on this page.

One deliberate omission: **the auth token is not written down here.** It was
just removed from the repo so it stops living in git history; the prompt tells
Cowork where to read it instead. Do not paste it into this file.

---

## ▼▼▼ PROMPT FOR COWORK — COPY FROM HERE ▼▼▼

You are shipping a **cloud device backup** feature for **DeepLife Simulator**,
a React Native 0.81 / Expo SDK 54 / expo-router v6 / TypeScript-strict life
simulation game. The code is written, reviewed and merged to the branch
`claude/codebase-architecture-audit-dy6c5m`; every gate is green. Your job is
to make it real: configure the secret, prove it works on a device, and promote
it.

**Read first, in this order:** `CLAUDE.md` at the repo root (canonical project
context — its Hard Rules are binding), then `docs/CLOUD-SAVE-BACKEND.md` (the
backend you are validating against).

You have Claude in Chrome available. Use it for anything that lives in a web
dashboard — the Supabase dashboard, the EAS/Expo dashboard, App Store Connect,
TestFlight. Prefer a CLI when one is authenticated and will do the job; fall
back to the browser when it is not. Say which route you took.

### What this feature is (and is not)

An anonymous, per-install cloud **backup**. The identity is a `cloud_user_id`
minted per install and kept in AsyncStorage — there is no sign-in and no
account, so a save cannot travel to a second phone. **Same-install restore is
what it claims today.** Whether a backup survives a full reinstall is an open
question you are going to answer, not a promise it makes.

Three environment variables gate it, and **all three are required**
(`lib/config/featureFlags.ts`) — a profile with only some of them turns the
feature cleanly OFF rather than rendering Back up / Restore buttons that
cannot work:

- `EXPO_PUBLIC_ENABLE_CLOUD_SAVE=true`
- `EXPO_PUBLIC_CLOUD_SAVE_URL=https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1`
- `EXPO_PUBLIC_CLOUD_AUTH_TOKEN=<secret — see Task 0>`

The first two are in `eas.json`'s `preview` profile. The third deliberately is
not: `EXPO_PUBLIC_*` values are inlined into the JS bundle, so it is an abuse
barrier rather than a real secret, but keeping it out of the repo keeps it out
of git history permanently.

Key files: `services/cloudBackup.ts` (5-minute debounce scheduler, restore
candidate fetch) · `services/CloudSyncService.ts` (upload/download, identity,
revisions) · `lib/progress/cloud.ts` (HTTP transport) ·
`components/settings/CloudBackupRow.tsx` (Settings UI) ·
`app/(onboarding)/SaveSlots.tsx` (the per-slot restore offer).

---

### Task 0 — Get the token, and put it in EAS

1. **Read the token.** It is the `value` of the row `key = 'cloud_auth_token'`
   in the `backend_config` table of the Supabase project `deeplife-backend`
   (ref `gyxmoqanjdvvllwjfsst`). Use the Supabase MCP if it is connected
   (`execute_sql`), otherwise open the Supabase dashboard in Chrome → the
   project → Table Editor → `backend_config`.
   Do **not** write this value into any file in the repo.
2. **Set it as an EAS environment variable** on the `preview` profile — not in
   `eas.json`. Either from the repo:
   ```bash
   eas env:create --name EXPO_PUBLIC_CLOUD_AUTH_TOKEN --value '<token>' \
     --environment preview --visibility plaintext --scope project
   ```
   (check `eas whoami` first), or the Expo dashboard in Chrome → the project →
   Environment Variables. **Plaintext visibility is correct here, not
   "secret"**: the value must be readable at build time to be inlined into the
   bundle, and EAS will not expose a secret-visibility var that way.
3. **Confirm** it registered: `eas env:list --environment preview`, or the
   dashboard list. You should see the two `eas.json` vars plus this one.

### Task 1 — Validate locally (fastest loop; do this before any build)

1. `npm install` if needed. Put the three variables in `.env.local`
   (git-ignored) or export them, then `npm start`:
   ```bash
   EXPO_PUBLIC_ENABLE_CLOUD_SAVE=true
   EXPO_PUBLIC_CLOUD_SAVE_URL=https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1
   EXPO_PUBLIC_CLOUD_AUTH_TOKEN=<the value from Task 0>
   ```
   `BORING_BUILD_MODE` defaults ON under `__DEV__`, but the `cloudSave` flag is
   deliberately exempt from it, so a dev run still syncs. If the Settings row
   never appears, check that exemption and that all three vars are actually
   reaching the bundle.
2. Start a new life, play ~5 weeks, open **Settings** → a **Cloud backup** row
   should be there with a last-backup time (or "Never" until you tap).
3. Tap **Back up now** → success, and the timestamp updates.
4. Play a few more weeks and leave the app running ~5 minutes → the timestamp
   should advance on its own. Auto-upload is debounced to one per 5 minutes and
   only fires after a *successful* local save.
5. **The test that must pass — SAME-INSTALL restore.** Do **not** delete the
   app here; deleting it also destroys `cloud_user_id`, so a failure would tell
   you nothing.
   - Back up, then on **SaveSlots** delete the slot you just backed up (leave
     the app installed).
   - Return to SaveSlots → the slot should offer "Cloud backup available —
     week N".
   - Restore, and confirm the game returns at the right week with money,
     career, relationships and family intact.
   - Anything less is a **bug**: diagnose and fix it.
6. **Separate probe — does the identity survive a REINSTALL?** This is the open
   question, so **whatever happens here is a finding to report, not a bug to fix
   on the spot.**
   - Back up again, delete the app entirely, reinstall, open SaveSlots.
   - **Offer appears and restores** → the id survived on this platform; say so,
     it widens what the feature can honestly claim.
   - **Nothing offered** → the expected consequence of an AsyncStorage-backed
     id. Report it; the fix is moving the id to Keychain/Keystore
     (`expo-secure-store`), which is an owner decision because it changes what
     "device backup" promises. **Do not implement that move here.**
   - Note which platform you tested — iOS and Android can differ.
7. **Regression guard.** With a local game *ahead* of the cloud copy (play past
   the backed-up week), try Restore from Settings. It must refuse, saying the
   cloud save is older, and change nothing. **Never weaken this guard to make a
   restore succeed** — if a restore is being refused, find out why the upload
   did not happen.
8. Watch the Metro console for `[CloudSync]` / `[CloudBackup]` lines throughout.
   Any error, silent failure, 401 or 429 is a finding.

If anything fails: fix it on the branch, then `npm run type-check`,
`npm test -- __tests__/services __tests__/save`, `npm run preflight`, commit and
push to `claude/codebase-architecture-audit-dy6c5m`.

### Task 2 — Preview build to TestFlight

Only once Task 1 step 5 passes.

1. Bump `version` in `package.json`. CLAUDE.md §9: always bump before a
   TestFlight build. The App Store Connect version record and the binary version
   are deliberately different numbers — do not "fix" that.
2. `npm run preflight` must pass. No skipped sections, never `--force`.
3. Trigger the preview EAS build — `eas build --profile preview --platform ios`,
   or the Expo dashboard in Chrome. **Confirm with the owner before spending
   build minutes.** Watch it to completion (the dashboard in Chrome is fine).
4. When it lands in TestFlight (App Store Connect in Chrome to check
   processing), install on a **physical device** and repeat Task 1 steps 2–8.
   Pay particular attention to:
   - the Settings row at real device scale,
   - same-install restore (step 5) — the one that must pass,
   - step 6 across an actual App Store reinstall — the authoritative answer to
     the identity question,
   - airplane mode mid-backup: it must not lose the local save or hang the UI.

### Task 3 — Promote to production

Only after Task 2 passes on a device.

1. Copy these two lines from `preview`'s `env` into `production`'s in `eas.json`:
   ```json
   "EXPO_PUBLIC_ENABLE_CLOUD_SAVE": "true",
   "EXPO_PUBLIC_CLOUD_SAVE_URL": "https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1"
   ```
2. Set `EXPO_PUBLIC_CLOUD_AUTH_TOKEN` on the **production** profile in EAS, the
   same way as Task 0. Forgetting it leaves the feature off rather than half-on
   — by design, but it also means it silently does not ship.
3. `__tests__/tooling/nativeSdkFlagDefaults.test.ts` pins the per-profile truth
   table against `eas.json` and currently asserts production does **not** carry
   cloud backup. Update that expectation in the same commit — that test existing
   is the point.
4. `npm run preflight`, commit, push.

### Rules that are not negotiable

- **Never** put the auth token in the repo — not in `eas.json`, not in a doc,
  not in a test fixture. EAS environment variables only.
- **Never** weaken or bypass the `weeksLived` regression guard on restore.
- **Never** skip a preflight section or pass `--force` (Hard Rule #6).
- Touching `contexts/game/` requires `npm test -- __tests__/stress`; touching
  `app/` requires `__tests__/startup` (`.github/PULL_REQUEST_TEMPLATE.md`).
- Save-schema changes carry migration + carve-out rules in the same commit
  (CLAUDE.md §7). `STATE_VERSION` is currently **46**.

### Report back

A short written result per task: what you ran, what you saw, what you changed.
Call out explicitly:

- whether same-install restore (Task 1 step 5) worked — the go/no-go,
- what the reinstall probe (step 6) showed, and on which platform — this decides
  the Keychain question,
- anything in the Metro/device logs that looked wrong even if nothing visibly
  broke.

If you hit something ambiguous or product-shaped — e.g. "should restore be
offered automatically on first launch after a reinstall?" — ask rather than
guessing.

## ▲▲▲ END OF PROMPT — COPY TO HERE ▲▲▲

---

## Open questions this validation settles

1. **Does the anonymous device id survive an app reinstall?** AsyncStorage is
   not guaranteed to on iOS. If it does not, `cloud_user_id` should move to
   Keychain/Keystore (`expo-secure-store`) — a small change that alters what
   "device backup" promises, so it wants owner sign-off, not a silent fix.
2. **Should restore be offered proactively** on first launch after a reinstall,
   rather than waiting for the player to notice the SaveSlots affordance?
3. **Retention / GDPR**: there is no delete-my-backup path, and nothing prunes
   abandoned rows. Both want solving before this leaves preview in a
   jurisdiction that cares.
