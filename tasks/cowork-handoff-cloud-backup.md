# Cowork handoff — validate & promote cloud device backup

Everything in this file needs a real machine, a device/simulator, EAS
credentials, or App Store Connect. None of it can be done from the cloud
agent sandbox (no simulator, no EAS auth, and outbound HTTP to the Supabase
functions host is blocked by the network policy).

Paste the prompt below into Cowork **verbatim**. It is written to be
self-contained — Cowork should not need this file's surrounding context.

---

## PROMPT FOR COWORK — copy from here

You are working on **DeepLife Simulator** (React Native 0.81 / Expo SDK 54 /
expo-router v6 / TypeScript strict), a life-simulation mobile game.
Read `CLAUDE.md` at the repo root first — it is the canonical project
context, and its Hard Rules are binding. Also read
`docs/CLOUD-SAVE-BACKEND.md`, which documents the backend you are about to
validate.

### Background

A cloud **device backup** feature was just built and merged to the feature
branch `claude/codebase-architecture-audit-dy6c5m` (5 commits). It is fully
implemented, unit-tested, type-checked, lint-clean, and `npm run preflight`
passes. The Supabase backend is deployed and its endpoints were smoke-tested
live (results table in `docs/CLOUD-SAVE-BACKEND.md`).

**What is NOT yet proven: that the feature works in the actual running app on
a real device.** Every test so far is a unit test or a direct HTTP call. That
is your job.

Scope is device backup, not cross-device sync: identity is an anonymous
per-install id stored in AsyncStorage under `cloud_user_id`, so a backup
restores onto the same install or a reinstall on that device.

Key files:
- `services/cloudBackup.ts` — debounce scheduler (5 min), restore candidate fetch
- `services/CloudSyncService.ts` — upload/download, identity, conflict handling
- `lib/progress/cloud.ts` — HTTP transport
- `lib/config/featureFlags.ts` — the `cloudSave` flag (needs BOTH
  `EXPO_PUBLIC_ENABLE_CLOUD_SAVE=true` and a non-empty
  `EXPO_PUBLIC_CLOUD_SAVE_URL`, plus `EXPO_PUBLIC_CLOUD_AUTH_TOKEN`)
- `components/settings/CloudBackupRow.tsx` — Settings UI
- `app/(onboarding)/SaveSlots.tsx` — the restore offer on the slot list
- `eas.json` — `preview` profile carries the three cloud env vars; `production`
  deliberately does not

### Task 1 — Validate locally (do this first, it is the fastest loop)

1. `npm install` if needed, then start the app with the cloud vars set, e.g.
   put them in `.env.local` or export them before `npm start`:
   ```
   EXPO_PUBLIC_ENABLE_CLOUD_SAVE=true
   EXPO_PUBLIC_CLOUD_SAVE_URL=https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1
   EXPO_PUBLIC_CLOUD_AUTH_TOKEN=<the value in eas.json's preview profile>
   ```
   Note `BORING_BUILD_MODE` defaults ON in `__DEV__`, but the `cloudSave`
   flag is deliberately exempt from it, so dev runs should still sync. If the
   Settings row does not appear, that exemption is the first thing to check.
2. Start a new life, play ~5 weeks, open **Settings** → confirm a
   "Cloud backup" row exists showing a last-backup time (or "Never" then a
   time after you tap **Back up now**).
3. Tap **Back up now**. Confirm success and that the timestamp updates.
4. Play several more weeks, then wait ~5 minutes of app activity and confirm
   an automatic backup happened (the timestamp advances without you tapping).
   Auto-upload is debounced to one upload per 5 minutes and only fires after
   a *successful* local save.
5. **The real test — restore.** Delete the app (or clear its storage), then
   reinstall/relaunch. On the **SaveSlots** screen you should see a
   "Cloud backup available — week N" affordance on the slot. Restore it and
   confirm the game comes back at the right week with money, career,
   relationships and family intact.
   - Caveat: deleting the app also clears `cloud_user_id`, which is the
     backup's identity. If restore shows nothing after a delete, that is the
     expected consequence of anonymous device identity, **not necessarily a
     bug** — verify by clearing only the game save (not the whole app) and
     retrying. Report which behaviour you saw; it decides whether the id
     needs to move to Keychain/Keystore, which survives reinstall.
6. **Regression guard.** With a fresh local game *ahead* of the cloud copy
   (play past the backed-up week), try Restore from Settings. It must refuse
   with wording about the cloud save being older, and must change nothing.
7. Watch the Metro console for `[CloudSync]` / `[CloudBackup]` logs
   throughout. Any error, silent failure, or 401/429 is a finding.

**If anything fails:** diagnose and fix it on the branch, run
`npm run type-check`, `npm test -- __tests__/services __tests__/save`, and
`npm run preflight`, then commit and push to
`claude/codebase-architecture-audit-dy6c5m`.

### Task 2 — Preview build to TestFlight

Only after Task 1 passes.

1. Bump `version` in `package.json` (§9 of CLAUDE.md: **always** bump before
   a TestFlight build; the store version record and the binary version are
   deliberately different numbers — do not "fix" that).
2. `npm run preflight` must pass with no skipped checks.
3. Trigger the preview EAS build (the owner normally triggers builds — confirm
   before spending build minutes).
4. On TestFlight, repeat the Task 1 checks on a **physical device**. Pay
   attention to: the Settings row rendering correctly at real device scale,
   restore across an actual App Store reinstall, and behaviour on a flaky/
   offline network (airplane mode mid-backup must not lose the local save or
   hang the UI).

### Task 3 — Promote to production (only after Task 2 passes on device)

Copy these three lines from the `preview` profile's `env` into the
`production` profile's `env` in `eas.json`:

```
"EXPO_PUBLIC_ENABLE_CLOUD_SAVE": "true",
"EXPO_PUBLIC_CLOUD_SAVE_URL": "https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1",
"EXPO_PUBLIC_CLOUD_AUTH_TOKEN": "<same value as preview>"
```

Then `npm run preflight`, commit, push. Note
`__tests__/tooling/nativeSdkFlagDefaults.test.ts` pins the per-profile flag
truth table against `eas.json` — it will need its production expectation
updated in the same commit, which is the point of that test.

### Things to be careful about

- **Do not** widen `EXPO_PUBLIC_CLOUD_AUTH_TOKEN`'s role. It ships inside the
  JS bundle and is extractable; it is an abuse barrier, not a secret. See the
  auth section of `docs/CLOUD-SAVE-BACKEND.md`.
- **Do not** disable or weaken the `weeksLived` regression guard to make a
  restore succeed. If a restore is being refused, the cloud copy is genuinely
  behind; find out why the upload did not happen.
- Touching `contexts/game/` requires `__tests__/stress`; touching `app/`
  requires `__tests__/startup` (`.github/PULL_REQUEST_TEMPLATE.md`).
- If you change the save schema, CLAUDE.md §7's migration + carve-out rules
  apply in the same commit. `STATE_VERSION` is currently **45**.

### Report back

Give a short written result per task: what you ran, what you saw, what you
changed. Call out explicitly whether the reinstall-restore in Task 1 step 5
worked, since that decides the Keychain question. If you hit something
ambiguous or product-shaped (e.g. should restore be offered automatically on
first launch after a reinstall?), ask rather than guessing.

## END OF PROMPT

---

## Open questions this validation should settle

1. **Does the anonymous device id survive an app reinstall?** AsyncStorage
   does not on iOS. If it doesn't, `cloud_user_id` should move to
   Keychain/Keystore (`expo-secure-store`) — which is a small change, but it
   changes what "device backup" actually promises, so it needs the owner's
   sign-off, not a silent fix.
2. **Should restore be offered proactively** on first launch after a
   reinstall, rather than waiting for the player to notice the SaveSlots
   affordance? Product call.
3. **Retention/GDPR**: there is no delete-my-backup path. Needs solving
   before this leaves preview in a jurisdiction that cares.
