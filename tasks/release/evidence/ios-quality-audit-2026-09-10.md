# iOS quality and release audit — 10 September 2026

**Verdict: HOLD for App Store release.** This pass fixes reproduced defects and
improves the development setup. It does not certify a signed iOS candidate or
promise a defect-free game. Baseline main: `ea9880d0b56c714f5243cd12de6847e412768f1a`.
Candidate branch: `codex/ios-release-quality-2026-09-10`.

## PR and candidate audit

There were **no open PRs** when refreshed on 10 September. The fetched branch
names are historical branches, not a list of unmerged work.

| PR | Integrated result | Remaining acceptance |
| --- | --- | --- |
| #207 | Targeted quality gates and scheduled/manual coverage | Check this candidate's own CI |
| #206 | Save/load timeout failure contracts and evidence ancestry | Additional replay/backup races fixed in this pass |
| #205 | Repository cleanup and navigable history | Preserve unrelated local files |
| #204 | 30 exports: ten game-themed store panels in three sizes | Compare with native candidate and current store record |
| #203 | Release queue, stalled-writer and research corrections | Seven external/journey packages remain |
| #201 | First-job guidance and compact Home | Native layout/accessibility |
| #200 | Game art and recap presentation | HomeScene intentionally not mounted |
| #199 | Education quotes and loan/pension forecasts | Authoritative complete cash-flow forecast |
| #197 | Purchase persistence and recovery | Real StoreKit/RevenueCat scenarios |

Main's [EAS Update run 34342443130](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34342443130)
passed at the baseline, including production OTA. Latest inspected native iOS
[run 34054920090](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34054920090)
used `cc60c2e28436afb9724e14536886d0cd2fd3338a` on 6 September; it predates these
fixes. Prior #207 coverage was 783 suites, 9,789 tests and 308 snapshots, with
17 suites/32 tests skipped; 59.94% statements, 42.33% branches, 52.26% functions,
61.22% lines. Those measurements do not substitute for this candidate's checks.

## Reproduced findings addressed

| Priority | Problem and player/tool consequence | Change and proof |
| --- | --- | --- |
| P1 | Startup save replay wrote without ownership after a mutex timeout, allowing overlapping slot writes | Acquire before reading/publishing replay; retain durable journal and retry; duplicate calls share one operation. Real mutex/envelope/double-buffer regressions |
| P1 | Backup restoration could race an already-running save and later lose the restored payload | Own the mutex through read, safety snapshot, replacement and bookkeeping; timeout performs no write. Paused-writer regression |
| P1 release tooling | Apple's API rejected the retired `appStoreVersionState` requested field with HTTP 400 | Shared current `appVersionState` reader, legacy response fallback and explicit live-state announcement filter; API-contract/state tests |
| P2 | Weekly recap omitted actual rent and other settled bills and missed modern rental receipts | Reconcile recap with actual tick cash movement and realized rental income; seven real-provider cases covering rent, prepaid week, insufficient cash, arrears and landlord income |
| P2 tooling | Windows asset budget could measure zero shipped bytes; reachability audit falsely reported 589 orphan modules | Normalize repository identities with `/`; existing asset controls now execute against real files; only two orphan candidates remain |
| P2 tooling | Windows CLI/path/CRLF and Swedish locale assumptions failed otherwise meaningful checks | Launch ESLint through Node; normalize fixture identities/line endings and format known expected amounts with the host locale. No floors or behavioral assertions weakened |

The original local death/wedding popup fix in `app/_layout.tsx` was preserved
across the Git update and retained: these blocking popups render independently
of the HUD route visibility. Native route-transition validation remains pending.
Detailed save evidence: [save-replay-audit-2026-09-10.md](save-replay-audit-2026-09-10.md).

Dependency installation was repaired with the committed lockfiles, including the
isolated asset tools. Compatible transitive updates reduced npm advisories from
26 (one critical, 14 high) to 18 (zero critical, eight high, nine moderate, one low).
Remaining high findings include the Expo/Metro/image tooling dependency chain;
the suggested broad remedy is an Expo major upgrade. They require separate
reachability/upgrade review and are not evidence of eight shipped-runtime exploits.
No forced Expo upgrade or new native dependency was introduced.

## Measured verification

- Full local preflight: exit 0, including source/test types, lint, quality,
  content and liveops gates. Lint: zero errors, 715 existing warnings at the
  unchanged ceiling.
- iOS Metro/Hermes export: exit 0, generated a 13.6 MB entry bundle. This is a
  JavaScript production export, not signing, native compilation or TestFlight.
- Focused save regressions: eight suites/44 tests passed. Recap regressions:
  two suites/18 tests passed. Tooling and locale portability subsets passed.
- Integrated full suite completed in 279.831 s: 785 suites/9,800 tests passed,
  one encoding test failed on a temporary audit JSON BOM, 17 suites/32 tests
  skipped, 308 snapshots passed (exit 1). After fixing that scratch file,
  the unchanged encoding suite passed. No game assertion remained failing.
- Opt-in retention: four personas, 100 weeks; retention plus encoding two
  suites/six tests passed, exit 0. Later Apple/encoding focused check passed too.
- Weekly audit passed with three warning groups after adding the current schema
  to AGENTS.md: test casts, a pre-roll fixture and two reachability candidates.

Local raw logs are in `tmp-bugaudit/`; they are scratch evidence, not portable
CI artifacts. An earlier integrated run exposed Windows/locale defects and a
temporary baseline-reproduction file, all subsequently addressed. An audit JSON
written by PowerShell with a BOM also tripped the encoding guard; the scratch
file was rewritten as UTF-8 without a BOM, preserving the guard.

## Five-domain and visible review

**Economy:** actual recap settlement fixed without changing economic rates.
Atomic affordability, refunds and weekly expense paths were reviewed. The Home
Cash Flow forecast still mixes older rental calculations with the current tenant
model, does not consistently reflect incarceration/company-income eligibility,
and treats crypto-funded warehouse electricity as cash outflow. This is the
next bounded product correction (MP08); calculate from authoritative sources and
prove it with real before/after cash, debt and noncash fixtures.

**Crash/stability:** source/test types and export pass. Preserved blocking-popup
fix still needs death/wedding/navigation captures on native. JavaScript tests
do not establish production crash rate, startup latency or native SDK health.

**Save/state:** two additional unsafe writers fixed; current migration,
double-buffer fallback, slot occupancy and purchase intent/claim boundaries
reviewed. A never-settling native I/O holder still prevents replay progress;
the journal remains durable rather than being written unlocked. Same-installation
recovery is not a promise of cross-device or reinstall consumable recovery.

**Game logic/journeys:** browser preview visibly completed new life -> Find a job
-> Fast Food Worker -> first paid week. Sharon Davis progressed from $1,500 to
$1,642 and Continue restored that identity, job and balance. Directly reloading
`/home` temporarily exposed default Player state; returning through MainMenu and
Continue restored the real save. Record this as a web cold-route entry issue,
not proven data loss or verified native behavior. Education, business/research,
relationships, poverty recovery, death/heir and full navigation remain unreached
in this visible session. Do not mark R04 complete.

**Week-loop/performance:** static density 35 nested loops against ceiling 64;
no unexplained JSON deep clone in the tick path. Existing Node timing/simulation
checks are separate from device profiling. Dead-pet processing still repeatedly
searches the roster and has no established roster cap; measure pathological
rosters before choosing a cleanup. Two reachability candidates remain:
`hooks/useTopStatsBarHeight.ts`, `lib/config/onboardingTheme.ts`; neither deleted
solely because a heuristic found no importer. Test-fixture warnings remain for
54 GameState casts and one hand-built pre-roll fixture.

Live [support](https://wrexist.github.io/DeepLifeSimulator/support.html) was
visually readable on desktop and its pending-recovery accordion worked. Live
[privacy](https://wrexist.github.io/DeepLifeSimulator/privacy.html) contains the
9 September revision. Older claims that this source was undeployed are obsolete.
Provider facts, store privacy labels and actual consent behavior still need proof.
Existing 30 screenshot exports have automated format/hash checks; native parity
is not established by web-seeded marketing captures.

## Complete release sequence

| Order | Package | Exact next work and completion evidence |
| --- | --- | --- |
| 1 | Candidate integration | Review this diff; current CI/coverage; separately authorize any main merge because it publishes production OTA |
| 2A | R04 journeys | Reach every journey in R04; fix observed defects; capture candidate/device and expected versus actual results |
| 2B | R11 privacy/operations | Verify operator and provider data/retention/consent facts, live pages and ASC labels agree; publication already happened |
| 2C | R08 signed candidate | Read current store/build records; resolve exact version and production configuration; prepare an authorized signed build and confirm processed TestFlight identity |
| 3A | R06 purchases | On that build exercise quantities/packs/subscriptions, cancellation, interrupted fulfillment, wrong life, retry, Restore, termination/relaunch and reinstall boundaries |
| 3B | R09 native quality | Compact iPhone and iPad: safe areas, keyboard, modals, offline/lifecycle/old saves, ads/ATT, VoiceOver/Larger Text/reduced motion, measured startup/frame/memory behavior |
| 3C | R07 store assets | Reconcile current version/release notes/locales; compare all ten panels with native; verify links, content answers, image ordering and actual uploaded record |
| 4 | R10 submission | Reconcile all evidence to the exact candidate, review notes/IAP access/privacy/content answers, rollout/support plan and authorized submission |

The read-only ASC plan on baseline [run 34510532337](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34510532337)
proved repository credentials exist, but failed on the retired field. Local
missing credentials are not the remote blocker. Test the fixed reader through
the read-only workflow before choosing a version. Repository store metadata still
targets historical 1.5.0; neither that value nor an old public-store observation
establishes the next version. No store writes, native build, main push or community
messages were performed in this pass.

## Future-chat setup

[AGENTS.md](../../../AGENTS.md) now gives persistent project invariants, Windows
commands, release boundaries and evidence expectations. Updated preflight and
weekly-audit skills refer to real files and current scripts. Installed reviewed
Vercel React Native, Callstack performance and Expo dev-client skills plus a
small personal DeepLife iOS quality skill. [Setup and pinned provenance](../../../docs/AGENT_SETUP.md)
explain reuse and recreation. Generic skills are selected by task rather than
applied indiscriminately. No global permissions or model settings were changed.

The stale Git lock was verified and removed; main was fast-forwarded while
preserving local work in the retained `pre-release-audit-local-changes-2026-09-10`
stash. Existing scratch/triage files remain untouched and outside the candidate.
