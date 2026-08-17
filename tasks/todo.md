# Wave 5 — owner decisions + review follow-ups (2026-08-16) — COMPLETE

All landed on claude/codebase-architecture-audit-dy6c5m (restarted from merged
main after PR #138). Final tree: both type-checks, lint:errors, check:routes,
audit-save all clear, full preflight exit 0, 1936 tests green across
services/save/startup/tooling/economy/actions.

- [x] Backend (Supabase project deeplife-backend, gyxmoqanjdvvllwjfsst):
      /functions/v1/save (POST upsert + GET, bearer auth via backend_config,
      3MB cap, stale-revision 409, per-slot write throttle) and
      /functions/v1/leaderboard/{category} (best-score upsert + top-50) both
      ACTIVE, matching lib/progress/cloud.ts's real contract. DB round-trip
      verified via SQL; HTTP smoke test blocked by sandbox network policy —
      owner has the curl commands (chat, 2026-08-16).
- [x] Agent A: overdueBalance subtracted in canonical netWorth() (full, no
      floor) + 13 tests; preTick snapshot copy deliberately untouched.
- [x] Agent B: DeepLife+ member gem drop capped at one unplayed claim per
      played week (v45 carve-out `deepLifePlusLastMemberClaimWeek`), free
      tier untouched, truth-table suite.
- [x] Agent C: cloud device backup wired — cloudSave flag (opt-in + URL
      required, Boring-Build-exempt), boot start via startup orchestrator,
      5-min debounced auto-upload off successful saves, Settings
      CloudBackupRow, SaveSlots restore offer (only when cloud is ahead),
      restore via migrate + hydrateRemoteState (regression refused with
      honest message). Fixed a real identity bug: resolveUserId preferred
      username (default 'player' — every install one cloud key); now the
      anonymous device id, test-pinned.
- [x] Agent D: entry.ts default export restored (expo-router 6.0.24 collects
      entry.ts as /entry; evidence quoted in file header); welcome-back
      credit through applyMoneyDelta (ceiling + summary bookkeeping).
- [x] Orchestrator: EXPO_PUBLIC_CLOUD_AUTH_TOKEN added to eas.json preview
      (pairs with backend_config.cloud_auth_token server-side).

- [x] Endpoint smoke test DONE (2026-08-16) — run from inside the project's
      own network via a temporary `http` extension, since the sandbox blocks
      outbound HTTP to the functions host. All 8 behaviours verified: 401
      unauth, POST 200, GET byte-identical round trip, absent slot -> null,
      invalid slot 400, stale revision 409, two writes in 5s -> 429, stub
      integrity proof 400, leaderboard POST+GET in the client's shape. Test
      rows deleted, extension dropped. Results table in
      docs/CLOUD-SAVE-BACKEND.md.
- [x] docs/CLOUD-SAVE-BACKEND.md — deployment, schema, auth model (why the
      token is an abuse barrier, not a secret), full endpoint contract,
      rollout steps, and the three future-work items (server-side signature
      verification, cross-device identity, retention/GDPR).

## Handed off — needs a real machine (see tasks/cowork-handoff-cloud-backup.md)
That file contains a ready-to-paste Cowork prompt covering: local validation
of the backup/restore flow in the running app, the preview TestFlight build
and on-device checks, and the production promotion (three env lines +
the nativeSdkFlagDefaults truth-table update).

## Open questions the device validation will settle
- Does `cloud_user_id` survive an iOS reinstall? AsyncStorage does not. If it
  doesn't, the id belongs in Keychain (expo-secure-store) — small change, but
  it changes what "device backup" promises, so owner sign-off, not a silent fix.
- Should restore be offered proactively on first launch after a reinstall?
- Retention/GDPR: no delete-my-backup path exists yet.
