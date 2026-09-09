# Fresh release audit: 9 September 2026

## Scope and verdict

Repository: Wrexist/DeepLifeSimulator. Fresh baseline `1e8c0fdfccbe59a37b0634b77d0be79a526cd108`.
Binary 2.13.0, save schema 51. Public US App Store version is 1.5.5. The next App Store Connect record and
currently processed TestFlight binary are unverified. Prior reports are context only. **HOLD for release.**

This pass combines actual source review, automated invariant checks, full Jest
baseline, fresh save/provider regressions, long-run simulations, local iOS export,
workflow inspection and live public-page checks. It is not native-device acceptance,
a security certification, an App Store Connect audit or Apple approval.

## New findings

| ID | Priority | Fresh evidence | Disposition |
|---|---|---|---|
| F01 | P1 | Actual mutex + doubleBufferSave with delayed old write: watchdog permits a newer successful save, then the old write overwrites it. Regression fails before fix. | Fixed in 14858aa. Watchdog reports stall while ownership persists. Waiters still time out. |
| F02 | P2 | Mounted CompanyActionsProvider and real GameStore: load week 10 to another slot at week 11, research advances 0 to 25% and patent ages 2 to 1. | Fixed in f25b080. Advancement moved into guarded played-week transition. |
| F03 | P2 | Identical research completion under different ambient RNG produces 7,500 vs 5,000 income. | Fixed with F02. Life/week/company/project keyed draws and current-state completion gate. |
| F04 | P1 validation | scripts/validate-release-candidate.mjs exits zero with UNREACHED and with missing branch coverage. | Browser result gate rejects missing, failed, unreached, duplicate or malformed required checks. Ten workflow tests pass, including priority selection. |
| F05 | P1 disclosure | Live privacy page and source deny Firebase, call AdMob disabled and omit RevenueCat, while eas.json production enables all three. | Factual source correction prepared, plus SDK/policy drift test. Publication, operational details and App Store privacy-label reconciliation remain blocked. |
| F06 | P3 copy | lib/events/secretEvents.ts allows age 16–18 but description says 13th year. | Age-independent copy corrected. Interactive/visual event acceptance remains in R04; no age or balance change. |

F01 is a reproduced failure under an injected storage stall longer than the watchdog,
not a measured incidence rate in released players. A permanently stuck storage call
now prevents new writes until recovery/relaunch. This is safer than parallel writes
because AsyncStorage cannot cancel the old call.

The R&D change preserves one completion per company per week, existing rates and
patent income ordering. No save schema change. Real weekly advancement and hydrated
save continuation are tested, not only helper output. Competition payout is still
idempotent in the existing provider effect; this change concerns research progression.

## Current player-system coverage

| Area | Current implementation reviewed or exercised | Remaining acceptance |
|---|---|---|
| New life, first job, Home | onboarding routes, firstSession render/behavior suites, GoalsCard/coach patterns | Native first-session readability and screenshot acceptance |
| Education and cash flow | EducationActions, education loan quotes and IdentityCard projection regressions | Real-device borrowing/recap flow |
| Business, research, patents | CompanyActionsProvider, RDActions, real weekly tick | Native completion feedback |
| Money, banking, investments | Economy static invariants, action and stress suites | Device clarity, longer distribution measurements if a new balance issue appears |
| Saves, checkpoints, life transitions | Mutex, queue, double buffer, migration/repair, save/integration/stress suites | Production signed save upgrade, background and kill/relaunch on device |
| Relationships, family, events, prestige | Existing real-tick/simulation regressions and source domain inventory | Full interactive relationship and heir journeys |
| Purchases, subscription, ads | IAP/recovery source, existing monetization tests, native feature flags | Real StoreKit/RevenueCat interruption, restore, ads and consent cases |
| Performance and retention | Current stress suite and opt-in retention/replay harnesses | Real device responsiveness; simulations are proxies for playtesting |
| Store and support | Metadata/content/liveops validators, appConfig URLs, public pages, open PR #202 | Native screenshot parity and App Store Connect fields |

Existing feature families also include crypto/mining, travel, vehicles, politics,
crime/darkweb, luxury, retirement, pets, pursuits and creator apps. Presence in source
is not proof every branch is enjoyable or exercised. R04 contains the deliberate
journey gate; do not advertise blanket app approval from the suite count.

## Baseline and completed evidence

- Fresh full Jest baseline: 777 suites, 9,762 tests and 308 snapshots passed, exit 0.
  17 suites and 32 tests skipped. Run began before fixes; it is baseline evidence.
- Source and test-tree typechecks passed after dependency installation.
- Save/integration baseline: 42 suites / 516 tests passed.
- F01 post-fix focused suite: 4 suites / 21 tests passed. Stalled-writer test failed
  against the original watchdog first; test uses the actual double-buffer writer.
- F02/F03 targeted regressions: 11 passed. Includes mounted slot transition,
  ambient-RNG independence, duplicate 1.5x bonus rejection, real weekly advancement,
  and hydrated save continuation.
- R&D stress and related audits: 49 suites / 833 tests passed.
- Release workflow evidence validation: 10 tests passed. Empty/incomplete browser
  evidence now blocks. This is a tested gate change, not a fresh browser pass.
- Privacy/provider drift test passed. The source no longer denies enabled SDKs.
- Local iOS export completed: 4,000 modules, 13.6 MB Hermes bundle. No signed IPA,
  native SDK exercise or production secret verification is implied.
- `audit:weekly` after installation: exit 0, no static critical/high findings,
  three warning groups. The earlier cold-container run could not execute test types;
  it was replaced by the installed run, not treated as a source failure.
- `check:aso`, `check:content`, `check:liveops`: passed. Content checker recommends
  tightening earned floors; no floor changed to manufacture a pass.

Final candidate suite/preflight/simulation results are recorded below when complete.
The actual command logs are kept with the PR evidence; neither earlier commit results
nor this baseline can certify future commits automatically.

### Warning triage

- 54 test `as GameState` assertions and one hand-built WeekContext/preRolls fixture
  are static review warnings. They are not 55 proven runtime defects. Test-tree types
  are clean; prioritize behavioral gaps rather than mass-casting cleanup.
- Nested-loop hotspots need device timing before declaring performance complete.
  The static report does not execute its optional performance suite.
- Liveops has sufficient runway but warns about an early-stage 43-day quiet stretch
  in the next 90 days. Catalogue content scheduling is a product backlog item, not
  automatically a crash or release blocker. Do not invent real events to erase it.
- Current baseline CI on main succeeded in run 34305456143. New PR CI must be checked
  separately on the latest head.

## Live pages and current primary sources

Checked 9 September 2026:

- [Privacy page](https://wrexist.github.io/DeepLifeSimulator/privacy.html): reachable,
  stale disclosures observed as documented in F05. Source correction is not deployed.
- [Support page](https://wrexist.github.io/DeepLifeSimulator/support.html): reachable;
  current contact is present. Page still references an older release and generic
  restore guidance. R07 must reconcile it with the native recovery experience.
- [Apple Standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/):
  reachable. SubscriptionModal uses the configured EULA/privacy URLs.
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/):
  screenshots must show the app in use and subscription information must be clear.
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/):
  validate the intended phone/tablet exports against accepted sizes before upload.
- [RevenueCat Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy):
  purchase-data disclosure is required when using its SDK.
- [Google ATT guidance](https://developers.google.com/admob/ios/privacy/idfa):
  denied ATT does not itself prohibit every ad request. The app explicitly requests
  non-personalized ads when tracking is denied.

The privacy source correction removes unsupported universal encryption, fixed
provider-retention and blanket compliance claims. Controller identity, actual
provider-dashboard retention/settings, regional consent and App Store privacy
answers still need current operational review. No invented name/address or claim
of legal certification was added. No analytics flags were enabled by this work.

## Release and workflow facts

- PR #202 owns the ten-image player-focused campaign. Avoid concurrent re-authoring.
  Its description acknowledges seeded web captures and a native parity gate.
- `.github/workflows/eas-update.yml` publishes production OTA on pushes to main.
  Thus merging is a release action, not just bookkeeping. Keep this work in a PR.
- Local preflight does not have the EAS production environment's signing/RevenueCat
  values. Missing local values are an unverified gate, not proof that EAS lacks them.
- Current App Store Connect build/version state was not accessed. Recent Actions
  page did not include a native build; that is not evidence that none exists.
- Browser connection to the local app failed with ERR_BLOCKED_BY_CLIENT for both
  127.0.0.1 and localhost. No fresh UI screenshots or device acceptance claimed.

## Finish criteria and deferred scope

All R00–R11 master prompts are in this folder. `queue.json` is the only current
release queue. `tasks/todo.md` keeps old work for history but points here first.
A package is locally verified only within its recorded acceptance scope; signed
candidate, latest CI, native testing, store content and owner approval are separate.

Do not expand this release into new story arcs, social maintenance redesign,
account/backend architecture or more marketing artwork. Capture those hypotheses
for a later release unless a measured defect makes them necessary now.

No release readiness percentage is invented. The verdict stays HOLD until the
recorded blockers are resolved with evidence for the actual candidate.


## Execution updates

- R&D's first final-suite run exposed the existing updater-result guard: 102 suspects
  against the unchanged 101 ceiling. Fixed in `6e2d17b` using a single pure outcome
  resolver for preview and commit. Follow-up 37 tests and both typechecks pass.
- Local full preflight exited 0 after the workflow-test fixture type was corrected.
  Production secrets remain unverified locally. Lint: 0 errors, 714 warnings versus
  ceiling 715. No ceilings or thresholds were weakened.
- Opt-in retention and save/load assertions passed, but async save work continued
  after test teardown. R05 stays active until the harness correctly drains and the
  run exits cleanly. Passing assertions alone do not close it.
- The existing hourly PR-check automation was extended to this queue on 9 September.
  It resumes eligible work, preserves all-open-PR CI recovery, avoids competing edits,
  keeps unchanged external blockers quiet and pauses progression once release gates
  are complete. Automation ID: `6aa0726152d08191b749480a005484ca`.

- The live [US App Store listing](https://apps.apple.com/us/app/deep-life-simulator-tycoon/id6749675615)
  was checked directly: version 1.5.5, age rating 13+, developer Isac Molin. This
  identifies the public listing, not the next App Store Connect record, signing
  identity or controller details. The policy source no longer hard-codes old 17+.
- The 120-week save/load continuation rerun passed 3/3 with exit 0 (73.211s),
  and no teardown errors after `1165d0b`. The earlier combined simulation run
  exited 1 despite passing assertions and is explicitly superseded, not hidden.

- Shared reference chat supplied later: https://chatgpt.com/share/6aa0d2b6-23dc-83eb-b40f-8d05f2933540 . Web fetch failed (DisabledError) and browser CDP timed out; its contents have not been read or treated as evidence. Fresh source audit continues independently.
- PR #202 merged at 2026-09-09T04:02:48Z; main advanced to `024f19e`. Screenshot assets are now on main; native parity still requires verification.
- Final local preflight and iOS export exited 0. Full suite found one remaining social-payoff fixture with discarded writes (781 suites pass, one fails); R05 remains active while its real-save fixture is corrected.
- Shared stateful storage fixture proof: two opt-in suites, eight tests at RUNS=2/WEEKS=4/SPLIT=2 pass and exit cleanly. Default full reproducibility rerun is in progress.

- Full default reproducibility: five personas × three runs × 80 weeks, 5/5 pass, exit 0 (234.368s). Retention: four personas × 100 weeks passed; the earlier combined command failed solely on the now-corrected replay fixture.
- Publishing uses GitHub Git Data API because command-line push has no GitHub credentials. Evidence SHAs above identify local implementation commits; the published commit contains their combined tree. No local evidence SHA is represented as a remotely published commit.

## Published candidate verification

Candidate `13fe9f315dd53ea141f98eaf1bde76db3845b16b`, PR #203, exactly matches the local implementation tree. Both remote workflows passed: Preflight run 34309941424 and EAS Update run 34309941422 (including preview update). Post-rebase local preflight also exited 0.

Full normal suite: 782 passed suites, 9,779 passed tests, 308 snapshots; 17 opt-in suites/32 tests skipped; exit 0 in 237.659s. It reported a worker teardown warning. A diagnostic `npm test -- --runInBand --detectOpenHandles --silent` reproduced all 782/9,779/308 passes in 613.388s, but the process stayed alive after the summary without identifying a handle. This diagnostic is not claimed as a clean exit. R05 remains active to isolate the test-runner cleanup cause; do not repeat the whole suite without narrowing the leak first or introduce forceExit to hide it. The focused real-save simulations exit cleanly.

## R05 cleanup completed

The preceding active status is superseded by implementation `591f372345d0be784169da7a96ac69827945f4ce`.
Domain isolation and async-resource tracing identified orphaned storage-readiness
deadlines, unawaited provider teardown in a jail-action fixture, and a subscription
test that abandoned its 90-second purchase request. Each owner now completes or
clears its own resource, with focused regression assertions; no forceExit, timer
purge, weakened threshold or production purchase-timeout change.

Full serial suite: **782 suites / 9,782 tests / 308 snapshots**, exit 0 in 591.556s,
without delayed-exit/worker-teardown warnings. Focused open-handle diagnostic: 23
tests, exit 0. Fresh 120-week save/load, five-persona 3 x 80-week replay and
four-persona 100-week retention runs all exit 0. Types, local preflight and unchanged
lint ratchet pass. Details and timing caveats:
`tasks/release/evidence/R05-cleanup-2026-09-09.md`.

R05 is locally verified. Remaining packages require the already recorded visual,
native, production-environment or store evidence; no independent pending package
is eligible. Keep the release verdict **HOLD**, inspect latest pushed-head CI
separately, and do not retry unchanged external blockers or expand feature scope.

## Completion handoff

Current implementation `6d2346e` has successful Preflight 34312514459 and EAS Update 34312514460. R05 is verified by its later cleanup evidence. The complete seven-gate remainder, exact missing inputs and expanded acceptance briefs are in `REMAINING_WORK.md` and R04/R06/R07/R08/R09/R10/R11. This pass corrected support-source recovery/save guidance and the ASO guide's unsupported subtitle A/B-test claim. All 30 screenshot exports, ASO, content and liveops checks pass. Browser visual access and ASC status remain blocked by the documented environment/access limitations. No native or live deployment acceptance is claimed.
