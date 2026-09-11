# Five-point product and measurement follow-up

Baseline: `67528146` on origin/main. Candidate: the commit containing this file
on `codex/retention-measurement-followup`. No schema, economy, grant, store record,
production configuration or live release changes.

## Findings and implementation

1. Save repair: inspected GA4 repair events by app version and exercised real
   repair/hydration/serialization plus migrations with synthetic partial v22,
   v43 and v50 saves. These fixtures stabilize after reload and preserve cash,
   gems and fulfilled-purchase markers. They are not affected players' saves.
   Historical events lack repaired fields and a load denominator; their cause
   remains unresolved. Add consent-gated `save_repair_checked` at hydration with
   repair count and known pre-migration schema. This is a repair check, not proof
   of completed loading. No speculative repair-algorithm change.
2. Measurement: reproduced a lost first-week event while the weekly loading
   overlay is active. Distinguish advancing a week from hydrating a save. Use
   native named screen views and disable automatic native class-only reporting
   in the next binary. Namespace the game session ID. Purchase-flow telemetry
   labels catalog quotes explicitly; it never treats trial success as revenue.
   Actual Firebase paid-revenue coverage remains a signed-build acceptance case.
3. Return journey: the existing summary's primary button opens its displayed
   next goal, with double-tap protection and reduced-motion support. No new
   rewards, notifications or economy rates.
4. Premium: explain active-access limits, daily gem claiming, working-week income
   and earned Legacy Pass rewards. Remove the misleading subscription promise
   "Ad-Free Forever". Trial/lifetime explanatory text is shown for active access.
5. Store: compared completed, matched UTC weeks in App Store Connect Sources,
   including first-time downloads, unique impressions and conversion. Search
   exposure and conversion declined; Browse exposure rose slightly while
   conversion declined. Rounded daily averages cannot causally decompose total
   download change. Country mix and a controlled creative test are next; no
   live store material was changed. Private provider figures stay outside this
   public repository in `../DeepLife-statistikaudit-2026-09-11.md`.

## Verification

- Weekly regression demonstrated red before the fix (1 failed / 7 passed), then
  passed after it. Initial focused run: 6 suites / 30 tests passed, exit 0.
- Expanded save/return regressions: 2 suites / 6 tests passed, exit 0.
- `npm run preflight`: exit 0, source/test types pass, lint 0 errors / 700 warnings
  within the unchanged 715 ceiling, UI/content/liveops checks pass. Existing
  liveops quiet-period warnings remain; passing runway does not prove retention.
- Production iOS/Hermes export with `eas.json` production environment: exit 0,
  4,005 modules bundled. Local output: `tmp-bugaudit/five-point-ios/`.
- Full suite is running; completion and latest PR checks remain pending.
- Real-component local web captures: before/after return and active premium,
  375x667 and 820x1180, reduced motion. Eight captures, no JS errors. Visually
  inspected compact phone and tablet layouts, primary actions and scrollable
  benefits. Local artifacts: `tmp-bugaudit/five-point-preview/`; capture log
  `tmp-bugaudit/five-point-capture-final.log`. Temporary fixture route removed.

## Remaining release gates

Rebuild a signed candidate: firebase.json native screen configuration is not an
OTA change. Verify opt-in/denial/withdrawal, named screens, one committed week,
old-save loading, sandbox trial/paid item/restore and revenue deduplication on
that build. Complete iPhone/iPad VoiceOver, Larger Text, background/relaunch and
purchase recovery acceptance. Retention and trial conversion effects require
mature post-release cohorts; render tests cannot establish business improvement.
Investigate actual repair causes using the new denominator/schema evidence and
an explicitly supplied reproduction if repair rates remain elevated.

See `docs/MEASUREMENT_CONTRACT.md`. R06/R08/R09 remain blocked on native evidence;
R07 remains blocked on final store record/native screenshot parity. No merge,
paid build, submission, community post or production publish was performed.
