# Master Program 17 — 2.13.0 Release Candidate Validation (2026-09-06)

Branch `claude/deeplife-release-blockers-7wcdpg` at `175efc4`. Input: Program
16's closure report. The question is not "do the tests pass" — it is **can
2.13.0 go to the App Store**.

## 0. The honest environment statement, first

This session runs on **Linux, with no macOS, no Xcode, no CocoaPods, no
`eas-cli`, no `EXPO_TOKEN` and no Apple credentials** (all verified, not
assumed). Therefore:

- **No `.ipa` was produced. No TestFlight build exists for 2.13.0.** Every
  device, StoreKit, VoiceOver, Dynamic Type and AdMob gate below is marked
  NOT EXECUTED — HUMAN DEVICE REQUIRED. None of them is inferred from Jest.
- What *was* produced is the **real iOS production JS bundle**
  (`expo export --platform ios --clear`), which is the runbook's own Part 0
  gate, and a **real static web export driven in Chromium at iPhone viewport
  sizes**, which exercises the app's actual rendering, navigation, save
  pipeline and life-transition state machine.

A browser pass is not an iOS pass. It is stated as what it is everywhere below.

## 1. Release candidate identity (Phase 0)

| item | value | source |
|---|---|---|
| HEAD | **`175efc4`** | `git rev-parse HEAD` |
| branch | `claude/deeplife-release-blockers-7wcdpg` | |
| working tree | **clean** | `git status --short` (empty) |
| `origin/main` | **`47595f5`** — one commit BEHIND the RC | `git fetch origin main` |
| `package.json` version | **2.13.0** | |
| version shown in the built UI | **v2.13.0** on the main menu | web export, read on screen |
| `STATE_VERSION` | **51**, unchanged by this program | `contexts/game/initialState.ts:9` |
| build number | not in the repo — minted at build time by `scripts/next-build-number.mjs` (ASC API, epoch fallback) | `app.config.js`, workflow |
| bundle id | `com.deeplife.simulator` | `app.config.js:76` |
| newest iOS build | **run #71, 2026-09-04, `d845b9e` — a 2.12.0 binary** | Actions API |
| builds of 2.13.0 | **none** | Actions API |
| open PRs | none | GitHub API |

**Gate D4 comes straight out of that table.** The two Program 16 fixes — the
mixed-consumable restore ledger id and the self-clearing wedding flag — are on
this branch and **not on `main`**. The iOS workflow is `workflow_dispatch` and
every one of its 71 runs was cut from `main`. Dispatching it today builds a
binary without either fix. Merging first is a release step, not a formality.

## 2. Automated gates, re-proved on `175efc4` (Phase 1)

Nothing here is quoted from Program 16; every line was re-run in this session.

| gate | result | vs Program 16 |
|---|---|---|
| `npx jest --ci` | **762 suites passed, 9 629 tests passed, 0 failed**, 17 suites / 32 tests skipped (`RUN_*` soaks) | identical |
| `npm run type-check` | clean | identical |
| `npm run type-check:tests:ratchet` | 0 errors (baseline 0) | identical |
| `npm run lint:errors` | clean | identical |
| `node scripts/check-lint.js` | 0 errors, **716 warnings (ceiling 716)** | identical |
| `npm run check:routes` | 17 routes, no conflicts | identical |
| `npm run check:aso` | EXIT 0, "No blocking problems" | identical |
| `npm run check:content` | at or above every floor | identical |
| `npm run check:liveops` | every stage has runway | identical |
| `npm run ui:ratchet` | 152 / 94 / 652, all at ceiling | identical |
| `npm run audit:save` | EXIT 0 — no blockers, 2 warnings | — |
| `npm run audit:stability` / `:logic` / `:economy` | EXIT 0 — no blockers, no warnings | — |
| `npm run audit:perf` | EXIT 0 — no blockers, 1 warning | — |
| `npx jest __tests__/liveops` | 2 suites / 19 tests pass | — |
| **`npm run preflight`** | **`PREFLIGHT EXIT: 0`** — the whole chain, checked as the runbook demands rather than the green banner | identical |
| `RUN_REPRO_SIM=1 RUNS=2 WEEKS=100` | **5/5 personas identical**, field for field | identical |
| `RUN_SAVELOAD_SIM=1 WEEKS=100 SPLIT=40` | **3/3 continuations identical** | identical |

Preflight WARNs, all five the same ones Programs 15 and 16 recorded: the save
HMAC and the three RevenueCat keys are "not verifiable locally" (they live in
the EAS env store — report §18 of Program 15 explains why that is *not*
evidence of absence), the iOS interstitial ad unit, and 14 unreferenced images.

Audit warnings, both pre-existing and both P3: 54 `as GameState` assertions in
tests bypass the factory, and 2 modules (`hooks/useTopStatsBarHeight.ts`,
`lib/config/onboardingTheme.ts`) have no importer.

## 3. The production build (Phase 2)

**What was verified before building:** `eas.json` production carries
`environment: production` (so the EAS env store layers on top), `autoIncrement`,
`appVersionSource: remote`, and ads/IAP/ATT/RevenueCat/Firebase on with Boring
Build off. `app.config.js` derives the version from `package.json`, validates
`BUILD_NUMBER` at config-eval time, sets `NSPrivacyTracking: false` with the
ITMS-91064 reasoning in place, and leaves `NSUserTrackingUsageDescription` to
the `expo-tracking-transparency` plugin. The iOS workflow validates the
marketing version against `package.json`, logs into EAS, and runs preflight
INSIDE `eas env:exec production` — the Program 15 change, present at line 161.

**What was actually built:**

| artefact | result |
|---|---|
| `expo export --platform ios --clear` | **EXIT 0 — 3 998 modules, 13.5 MB Hermes bytecode** (`entry-bf23cf5e….hbc`) |
| vs the runbook's recorded figure | **3 998 modules / 13.5 MB — identical.** No bundling regression from Program 16 |
| `expo export --platform web --clear` | EXIT 0 — 3 610 modules |
| **`.ipa`** | **NOT PRODUCED — requires macOS + Xcode + Apple credentials, none present** |

The bundle line is the one that matters most here: preflight §4 is a syntax
check that defers real bundling, and this repo has shipped a production-only
Hermes crash before (the `React.lazy` incident). The full export was run rather
than trusted, and it succeeds.

## 4. Browser device-viewport validation (Phases 4–7, 11, 14)

Harness: `scripts/validate-release-candidate.mjs` (new). It drives the real web
export in Chromium and **asserts** — a check that cannot reach its subject
reports UNREACHED rather than passing, which is the silent-staleness failure
`capture-rich-state.mjs` documents.

**Result: 24 checks · 23 PASS · 0 FAIL · 0 UNREACHED.**

| id | check | evidence |
|---|---|---|
| A1 | startup | main menu rendered; boot breadcrumbs show `first_screen_visible` at **73 ms** |
| A2 | save config | no "Build Configuration Error" dialog |
| A3 | fresh life | reached a playable week |
| A4 | coherent first state | age 20, $1,500, January 2025, Gen 1, named character |
| A5 | tab navigation | routes reached: `/home /work /apps /life` |
| A6 | apps grid | rendered; tiles sized to content, DeepMail tinted, "Locked (6)" shelf |
| B1–B3 | **save / relaunch continuity** | advance → save → **cold launch at `/`** → menu offers "Continue · <name> · 20 yrs · $1,601" → resumed **age 20 / $1,601, identical** |
| C1–C2 | death screen | rendered; reads **"Age 20 • 4 wks lived"** — the Program 15 P1 fix, confirmed on a rendered screen |
| C3–C4 | escape death | Start New Life dismisses the screen; the player is not trapped |
| C5 | relaunch after a life transition | lands clean, not back on the death screen |
| D1 | **revival** | Revive returns to a playable week with no death modal left up |
| E | UI at 430 / 390 / 360 pt | worst horizontal overflow **0 px** on every tab at every width |
| F1 | 12 rapid week taps | screen still renders, no wedged state |
| F2 | 10 rapid modal open/close cycles | **input still accepted afterwards** |
| F3 | kill during save | cold launch immediately after a week tap resumes a playable life |
| G1 | uncaught JS errors | **none**, across the entire run |
| G2 | console errors | only `Failed to load purchases: Unsupported platform: web` — the IAP layer degrading gracefully on a platform it does not support, caught, app continues |

**Two failures in the first run were my harness, not the app, and both are
worth recording because either would have been reported as a P0.**

1. `page.reload()` reported the save as lost — age 20 / $1,567 became age 18 /
   $200. expo-router mirrors the route into the web URL, so reloading lands on
   `/home` and deep-links **past the menu and past the load**. iOS has no URL to
   restore. The honest equivalent is a cold launch at `/`, and with that the
   save resumes exactly. **A browser-only path can manufacture a save-loss
   report; check what the platform actually does before grading one.**
2. "2/4 tabs rendered a distinct screen" — react-native-web keeps every mounted
   screen in the DOM, so all four tabs share an innerText prefix. Checking the
   ROUTE gives 4/4. The same trap the repo already documents for
   `[aria-label="Close"]`.

**App reachability (Phase 4's "all 19 apps").** Not asserted from the browser:
progressive disclosure gates apps by chapter tier, so a fresh life legitimately
shows 3 unlocked and 6 locked. It is already proven where it belongs —
`__tests__/onboarding/featureUnlocks.test.ts` sweeps **every** entry in
`FEATURE_UNLOCKS` at the last chapter ("the last chapter opens everything") and
again for a 300-week veteran, a prestiged player and a generation-2 heir. No
new test was written for something already covered.

## 5. Live ops, seasons and holidays (Phase 10)

| check | result |
|---|---|
| published calendar reachable | `https://wrexist.github.io/…/liveops.json` → **HTTP 200** |
| remote vs repo | **byte-identical** (4 311 bytes both sides) |
| kill switch | `paused: false`, `disabledEventIds: []` |
| remote runway | ends 2027-03-15 — **190 days** |
| **remote events active today (2026-09-06)** | **none** — next is `winter_first_steps` on 2026-11-02, **57 days out** |
| **compiled-in events active today** | **two** — `welcome_back_footing`, `first_rungs` |
| merge semantics | `selectValidEvents([...remoteEvents, ...LOCAL_EVENTS])` — remote **merges with and overrides** local by id, it does not replace the catalogue (`lib/liveops/remote.ts:103`) |

That last row is what turns the empty-remote-window fact from a scare into a
finding. Because remote merges rather than replaces, **a player launching
2.13.0 today sees two live events, not an empty card** — the failure mode the
runbook's Part 1b warns about does not occur. What remains is an owner call
(D3 below): the September–October window is carried entirely by the compiled-in
floor, and `first_rungs` expires 2026-10-26.

**Seasonal surfaces, read off a rendered screen at 430 pt in both colour
schemes** — all four PR #190 defects hold fixed:

- HUD month **January** and the badge label **"New Year, Winter season"** agree.
- Season modal: **Winter Season · Week in Season 1 / 13 · Spring in 12 weeks**
  (12, not 13 — the off-by-one fix).
- The holiday card ("New Year — Special holiday events are active this week!")
  is **legible in dark mode**; it was white-on-white before.
- Close control present and reachable.

## 6. Startup and error observability (Phase 13)

Read out of the app's own instrumentation after a full session including three
week-ticks, a save, a death and a revive:

```
@startup_failures        []
@startup_circuit_breaker {"state":"closed","lastFailureTime":0,"recoveryAttempts":0}
@boot_breadcrumbs        layout_init_start 0ms → error_handlers_setup 5ms
                         → providers_init 64ms → layout_start 65ms
                         → first_screen_visible 73ms
```

Zero recorded startup failures, circuit breaker closed with no recovery
attempts, no uncaught JS errors. **Xcode device console, TestFlight crash
reports, RevenueCat logs and Firebase error reporting: NOT EXECUTED — HUMAN.**

## 7. Accessibility (Phase 12)

| check | result |
|---|---|
| labelled interactive elements | **27 of 27 visible interactive elements carry a label** (aria-label or text); zero unlabelled |
| season badge label | "New Year, Winter season" — descriptive, not "button" |
| touch targets | **8 of 27 measure under 44 pt by DOM rect** (D2 below) |
| **VoiceOver** | **NOT EXECUTED — iOS only, HUMAN** |
| **largest Dynamic Type** | **NOT EXECUTED — iOS only, HUMAN** |
| dark / light | both render the full season modal legibly |

## 8. Purchases (Phase 8)

**NOT EXECUTED. StoreKit, sandbox purchase, restore, interrupted purchase,
RevenueCat entitlement state and intro offers all require a signed build on a
device.** They are stated as HUMAN and nothing about them is inferred here.

What this session could establish: the IAP layer **degrades safely** on a
platform with no store — `Failed to load purchases: Unsupported platform: web`
is caught, no uncaught error escapes, and the app remains fully playable. And
the Program 16 B7 scenario (a mixed consumable restoring under a synthetic
ledger id so the store's retry survives) is pinned by
`__tests__/monetization/restoreLedgerIdentity.test.ts`, which walks the real
catalogue — but a test is not a sandbox purchase, and the device gate stands.

## 9. Defects found

| ID | Sev | Class | Reproduction | Root cause | Fix | Regression test | Verification |
|---|---|---|---|---|---|---|---|
| **D1** | P3 | CODE (test-only) | `RUN_REPRO_SIM=1 … npx jest simulationReproducibility` → all 5 tests pass, process **exits 1** | The soak's simulated `saveGame()` leaves an in-flight `SaveQueue` promise; after Jest tears the environment down its dynamic `import()` in `utils/saveQueue.ts:305,423` throws "import after teardown" | **None made.** A fix means adding a drain API to production `saveQueue.ts` for a test-hygiene problem, with no release reason — a change this program's rules forbid. Pre-existing and identical in Program 16's run | n/a | Assertions are the signal (5/5, 3/3); the exit code is not. Recorded so a future real failure is not mistaken for this |
| **D2** | P3 | DEVICE | 8 of 27 visible interactive elements measure < 44 pt by `getBoundingClientRect` at 430 pt | Not established. RN `hitSlop` and `touchTargets` (`utils/scaling.ts:225`) enlarge the tap area without changing the DOM rect, so this measurement cannot see the real target | None — measuring the wrong thing is not grounds for a change | n/a | **HUMAN**: confirm on device with Accessibility Inspector before treating it as real |
| **D3** | P2 | OWNER / CONFIG | No **remote** live event is open between today and 2026-11-02 (57 days) | The published calendar starts at winter | None — and none is warranted: the compiled-in floor carries two active events today, and `check:liveops` passes | n/a | Owner decides whether to author a Sep–Oct remote event. `first_rungs` expires 2026-10-26 |
| **D4** | gate | BUILD | The RC is `175efc4`; `origin/main` is `47595f5`. All 71 iOS runs were cut from `main` | Program 16's branch is not merged | Merge before dispatching the build | n/a | **Blocking if ignored**: building `main` today ships without either Program 16 fix |

**No P0 and no P1 defect was found.** Nothing in this pass crashes, corrupts a
save, loses a purchase, blocks input or strands a player.

## 10. Gate table (Phase 17)

| Gate | Result | Evidence | Blocking? | Human action? |
|---|---|---|---|---|
| Current SHA | `175efc4`, clean tree | `git` | no | — |
| Version | 2.13.0, shown as v2.13.0 in the built UI | `package.json`, screenshot | no | — |
| Build number | minted at build time | `next-build-number.mjs` | no | — |
| Full test suite | 762 suites / 9 629 tests / 0 failed | this session | no | — |
| Lint | 0 errors, 716/716 | `check-lint.js` | no | — |
| Preflight | **EXIT 0** | this session | no | — |
| iOS JS bundle | 3 998 modules, 13.5 MB Hermes | `expo export` | no | — |
| **Production build (.ipa)** | **NOT EXECUTED** | no macOS/Xcode/creds | **yes** | **owner runs the workflow** |
| **TestFlight install** | **NOT EXECUTED** | no build exists | **yes** | **owner** |
| Fresh install | browser only: PASS | harness A1–A4 | partly | device |
| Startup | PASS, 73 ms to first screen, 0 failures | breadcrumbs | no | device confirm |
| Save/load | PASS — cold-launch continuity exact | harness B1–B3 | no | device confirm |
| Migration behaviour | 41 save suites green; `carveOutRoundTrip` pins every §7 carve-out | suite | no | — |
| Death | PASS, "4 wks lived" correct | harness C1–C2 + screenshot | no | device confirm |
| Revival | PASS, no stuck modal | harness D1 | no | device confirm |
| Wedding | **NOT EXECUTED on device**; the flag fix is pinned by `weddingPopupSelfClear.render.test.tsx` | Program 16 | no | device |
| Social | suite green; not exercised on device | — | no | device |
| Purchases / Restore / Interrupted purchase | **NOT EXECUTED** | StoreKit needed | **yes** | **owner, sandbox** |
| RevenueCat entitlement | **NOT EXECUTED** | dashboard needed | **yes** | **owner** |
| Ads | **NOT EXECUTED** | AdMob needs a device | **yes** | **owner** |
| Analytics | preflight §9b PASS (config); pipeline not exercised | preflight | no | owner decides `ENABLE_ANALYTICS` |
| Liveops | remote 200, byte-identical, merges with local, 2 events active today | §5 | no | — |
| Offline fallback | ladder verified in code + 15 liveops suites | §5 | no | device confirm |
| Season/holiday | PASS — Winter/January agree, 12 weeks, dark-mode legible | screenshots | no | — |
| Dark mode | PASS both schemes | screenshots | no | — |
| **VoiceOver** | **NOT EXECUTED** | iOS only | **yes** | **owner** |
| **Dynamic Type** | **NOT EXECUTED** | iOS only | **yes** | **owner** |
| Crash/log review | 0 startup failures, breaker closed, 0 uncaught errors | app instrumentation | no | Xcode console on device |
| Red team | PASS — rapid taps, modal churn, kill-during-save | harness F1–F3 | no | device confirm |
| App Store metadata | `check:aso` EXIT 0 | this session | no | owner prints `npm run aso` |
| Release notes | v2.13.0 entry exists in `changelog.ts`; `WHATS_NEW.md` draft **untrimmed** | Program 16 | no | **owner trims** |
| **Merge the RC to `main`** | **NOT DONE** | `origin/main` = `47595f5` | **yes** | **owner** |

## 11. Verdict

**YELLOW — no known P0 or P1 defect in the code, and every remaining gate is a
human or owner action that cannot be performed from a repository.**

Not GREEN, and the reason is concrete rather than cautious: **no 2.13.0 binary
exists.** The newest iOS build is run #71 from 2026-09-04, a 2.12.0 binary cut
from a commit that predates both Program 15's and Program 16's fixes. Until the
workflow runs, every claim about StoreKit, VoiceOver, Dynamic Type, AdMob and
iOS Modal presentation is unproven — and this program will not launder a Jest
result into one.

Not RED either: everything that *can* be proved from here was, and it holds.
The suite, the ratchets, the audits and the whole preflight chain are green on
this exact SHA; the production Hermes bundle builds to the same 3 998 modules
the runbook recorded; and driving the real export in a browser at three iPhone
widths found no crash, no overflow, no input lock, no lost save and no way to
strand the player — including through death, revival, twelve rapid week taps,
ten modal open/close cycles and a kill mid-save.

## 12. Exact next step

**COMPLETE THE OUTSTANDING HUMAN DEVICE GATES.**

In order:

1. **Merge `claude/deeplife-release-blockers-7wcdpg` into `main`** (D4). Every
   iOS run has been cut from `main`; dispatching today builds without either
   Program 16 fix.
2. Dispatch `eas-build-local-ios.yml` with version **2.13.0**, `submit: true`.
   **Watch that run**: it is the first since preflight moved inside
   `eas env:exec production`, so a genuinely missing RevenueCat or save-signing
   key now fails the build by name instead of warning.
3. On the TestFlight build, work the device matrix — the runbook's three
   ("saves and reloads", "a sandbox purchase completes", "faces render"), then
   the Program 16 list: the Spark and Verified Pro cancel confirms, death →
   Start New Life, death → Revival Pack, the wedding Continue, VoiceOver on
   Home / Apps / Bank Pro, and largest Dynamic Type on the death screen.
4. Owner calls, neither of which blocks the build: trim the drafted v2.13.0
   `WHATS_NEW.md` entry before store submission, and decide
   `EXPO_PUBLIC_ENABLE_ANALYTICS`. D3 (no remote live event before 2026-11-02)
   is a third, and the compiled-in floor covers it either way.
