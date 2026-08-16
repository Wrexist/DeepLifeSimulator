# Wave 5 — owner decisions + review follow-ups (2026-08-16)

PR #138 merged; branch restarted from main. Owner decisions taken (via Q&A):
1. overdueBalance: SUBTRACT from the canonical net-worth sum.
2. DeepLife+ member gem drop: keep day-key grace, add an epoch/banked-claim
   guard so forward clock-scrubbing cannot compound (max 1 unplayed claim).
3. Cloud save: DEVICE BACKUP scope (anonymous device id, no sign-in).
   Backend = Supabase project deeplife-backend (gyxmoqanjdvvllwjfsst),
   auto-upload debounced after save, restore surfaced in Settings + SaveSlots,
   rollout preview-first (production later by adding one env line).

- [ ] Backend (orchestrator, via Supabase MCP): restore project, saves table
      (user_id, slot, data, version, timestamp, hash, signature), /save edge
      function (POST upsert + GET fetch, custom auth: payload signature check
      against CLOUD_SAVE_HMAC_KEY secret when configured, size/shape limits),
      README contract compliance.
- [ ] Agent A: overdueBalance subtracted in canonical netWorth() + tests;
      assess (report, don't blindly change) the pinned preTick copy.
- [ ] Agent B: member gem drop epoch/banked-claim guard (v45 carve-out +
      stub migration + docs sync + tests). Free-tier v40 gate untouched.
- [ ] Agent C: cloud client wiring — start() at boot behind a cloudSave flag
      (NOT boring-build-gated, per rollout decision), debounced auto-upload
      after successful saves, Settings cloud-backup row (status/back up now/
      restore), SaveSlots restore offer via hydrateRemoteState, eas.json
      preview env (EXPO_PUBLIC_ENABLE_CLOUD_SAVE + CLOUD_SAVE_URL).
- [ ] Agent D: review follow-ups — restore app/entry.ts default export
      (expo-router collects entry.ts as a route; missing default export warns
      every dev boot); route welcomeBack credit through applyMoneyDelta
      (ceiling + weekly-summary bookkeeping).
- [ ] Orchestrator: end-to-end verification, commit, push (PR #138 is merged —
      any new PR is a new one).
