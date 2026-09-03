# CLAUDE.md — DeepLife Simulator

Canonical project context for AI assistants. `DEV.md` and `WORKFLOW.md` are older
mirrors of this file kept for other tools (Cursor/Codex); when they disagree with
this document, **this document wins**. Keep `STATE_VERSION` and the release rules
in sync across all three when they change.

---

## 1. Project Overview

- **What it is:** a life-simulation mobile game — careers, education, dating/family,
  crime & dark web, stocks/crypto, real estate, business, prestige & legacy.
- **Stack:** React Native 0.81.5 / Expo SDK 54 / React 19.1.0 / TypeScript 5.9 (strict)
- **Routing:** `expo-router` v6 (file-based), entry point `./app/entry.ts`
- **Platforms:** iOS (App Store) + Android (Google Play) + a web preview target
- **Bundle / package id:** `com.deeplife.simulator` · EAS project `55bb8510-…` · owner `isacm`
- **Persistence:** AsyncStorage + CRC32-checksummed saves — `STATE_VERSION = 50`
- **Binary version:** whatever `package.json` `version` says (2.9.0 at the time of
  writing — read the file, do not trust this line) — see §9

Codebase size: ~400 files in `lib/`, ~240 components, ~535 test files.

---

## 2. Commands

| Command | What it does |
|---|---|
| `npm start` / `npm run ios` / `npm run android` / `npm run web` | Expo dev server / native run / web preview |
| `npm test` | Full Jest suite |
| `npm run test:unit` | `lib/` only |
| `npm run test:integration` | Save/load integration test |
| `npm run test:e2e` / `test:performance` | `__tests__/e2e` / `__tests__/performance` |
| `npm run test:coverage` / `test:ci` | Coverage. `test:ci` now also runs the ratchet and **passes** — see §8 |
| `npm run coverage:ratchet` | Fails if any coverage metric DROPPED below its floor. Run after `test:coverage` |
| `npm run type-check` | `tsc --noEmit` over `tsconfig.typecheck.json` (app source only, excludes tests/scripts) |
| `npm run type-check:tests` | `tsc --noEmit` over `tsconfig.tests.json` — **the test tree**, which `type-check` excludes. **Clean as of 2026-08-02** (was 182). A type error in a test is usually a test asserting on a field that does not exist, i.e. asserting nothing |
| `npm run type-check:tests:ratchet` | The above as a **CI gate**, baseline in `scripts/check-test-types.js`, run on every PR via `eas-update.yml`. The baseline is now **0**, so this is simply "the test tree must type-check" — do not raise it to get unblocked. It kept a DOWN branch too while the backlog was burning down, because a stale baseline silently lets errors creep back up to it |
| `npm run lint` / `lint:errors` / `lint:fix` | ESLint (`lint:errors` = `--quiet`, used by preflight) |
| `npm run check:routes` | expo-router conflict guard (see §5) |
| `npm run preflight:quick` | routes + type-check — **run this during development** |
| `npm run preflight` | `check:routes` + the full preflight script (`--platform ios`, 11 sections) + `lint:errors` + `lint:ratchet` + `check:content` — **required before any release build** |
| `npm run audit:weekly` | Static five-domain audit → `tasks/weekly-audit-<date>.md` |
| `npm run audit:economy` \| `:stability` \| `:save` \| `:logic` \| `:perf` | Individual audit modules |
| `npm run discord:validate` / `discord:plan` / `discord:sync` | The Discord server as code (`discord/`). `validate` needs no token or network; `plan` is the dry run; only `sync` writes. See `discord/README.md` |

`npm install` runs `scripts/fix-podspec.js` as a postinstall step.

> Note: a fresh clone has **no `node_modules`**. Run `npm install` before any
> test/type-check claim — a "failing" suite in a cold container is usually just
> missing dependencies (recorded twice in `tasks/lessons.md`).

---

## 3. Repository Map

```text
app/                 expo-router routes only
  entry.ts           17 lines — app init ONLY (Hard Rule #1)
  _layout.tsx        root layout: providers, boot sequence, error boundaries
  (onboarding)/      MainMenu, SaveSlots, Customize, Scenarios, Perks, Ambitions
  (tabs)/            home, life, work, health, market, computer, mobile, apps, progression
contexts/game/       GameState, providers, actions  ← the core of the app
  types.ts           canonical GameState types (~3.1k lines)
  initialState.ts    initial state + STATE_VERSION (~1.7k lines)
  GameProvider.tsx   composes the 9 providers, each in its own ProviderBoundary
  GameActionsContext.tsx  the week loop + action wiring (~4.1k lines)
  actions/           per-domain action modules (Money, Job, Dating, Hustle, …)
  actions/weekly/    ~37 `apply*.ts` week-tick subsystems + preTick/weekContext
lib/                 pure game logic & data, one directory per domain
                     (careers, crypto, darkweb, economy, education, luxury,
                      prestige, realEstate, skillTrees, stocks, travel, …)
  config/            featureFlags.ts, theme.ts, gameConstants.ts, appConfig.ts
components/          ~245 shared UI components (modals, cards, HUD)
src/features/onboarding/  onboarding flow logic (separate from app/(onboarding) screens)
src/debug/           fuzz engine, AI debug snapshot, integrity checks
utils/               save pipeline, scaling, theme helpers, logging, validation
services/            IAP, RevenueCat, AdMob, Firebase/analytics, cloud sync
hooks/               useTheme, useAchievements, useTimerManager, …
scripts/             preflight, audits, route guard, asset/screenshot generators
scripts/audit/       the five weekly audit analyzers (.cjs)
discord/             the Discord server AS CODE — roles, categories, channels,
                     permissions, onboarding and the pinned copy, reconciled by
                     `npm run discord:sync`. Zero deps, plain `.mjs`
support-site/        GitHub Pages site — hand-written HTML/CSS/JS, no build step
  android/           the Beta Hub: recruitment → onboarding → feedback → admin
server/beta-hub/     Beta Hub API — Supabase edge function `betahub` + schema
__tests__/           cross-cutting suites by domain (see §8)
.agents/skills/      project skills: preflight, test-suite, eas-build, weekly-audit
tasks/               todo.md, lessons.md, dated audit reports
docs/                setup/runbook docs (IAP, RevenueCat, Firebase, launch, store)
```

Path alias: `@/*` → repo root (tsconfig + jest `moduleNameMapper` + metro).

---

## 4. Architecture

### 4.1 State management

- One `GameState` object, exposed through **9 nested context providers** composed in
  `contexts/game/GameProvider.tsx`: `GameState`, `GameActions`, `GameUI`, `GameData`,
  `MoneyActions`, `JobActions`, `ItemActions`, `SocialActions`, `CompanyActions`.
  Each is wrapped in a `ProviderBoundary` so a crash names the failing provider.
- **Subscribe narrowly — and know which mechanism actually narrows.** The
  hooks that really cut re-renders are `useGameSelector` / `useSetGameState` /
  `useGameStateGetter` in `contexts/game/useGameSelector.ts`
  (`useSyncExternalStore`-based; adopted in 50+ files — Pulse is the reference
  implementation). The named hooks in `contexts/game/index.ts` (`useGameStats`,
  `useGameMoney`, …) only stabilize the returned identity: they call
  `useGameState()` underneath, so the component still re-renders on every
  state mutation — do not reach for them expecting a perf win. Pulling
  `useGameState().setGameState` into a component re-subscribes it to the
  *entire* state — a documented perf regression (`tasks/lessons.md`,
  2026-06-09); use `useSetGameState` instead.
- **Never mutate.** Always `setGameState(prev => ({ ...prev, … }))`.
- Values computed *inside* a `setGameState` updater are not visible outside it —
  don't assign to an outer variable from within the updater and read it after.
- Call `saveGame()` after state-changing actions.

### 4.2 Time: `week` vs `weeksLived`

- `gameState.week` cycles **1–4** (week-of-month) — **display only**.
- `gameState.weeksLived` is the absolute counter — **use it for every comparison,
  cooldown, timestamp and history entry**. Helpers: `weeksInThisLife`
  (`lib/progress/lifeChapters.ts`) when you hold a `GameState`, and
  `weeksSinceLifeStart` / `resolveCalendar` / `ageFromWeeksLived`
  (`utils/weekCounters.ts`) when you only hold the raw numbers. This list used to
  name `resolveAbsoluteWeek` / `normalizeStoredWeekToAbsolute`, which had zero
  production callers for their whole life — legacy cyclic 1–4 markers were never
  actually stored, so nothing ever needed converting; they are deleted.
- Mixing these up has shipped bugs more than once; it is the first thing to check
  in any review of time-based logic.
- **`weeksLived` does NOT start at 0.** It is seeded from the starting age —
  `computeWeeksLived` = `(age - 18) * 52` — so an age-20 character begins at
  **104** and an age-25 one at **364**. Any "have I played N weeks yet" check
  against the raw counter is already true before the first frame for every
  scenario except the age-18 ones. This has caused three bugs (the first-session
  coach, `FirstWeekGuide`, Chapter 1's "Survive 4 Weeks"). Use
  `weeksInThisLife(state)` from `lib/progress/lifeChapters.ts`, which reads the
  `lifeStartWeek` baseline (v43).

### 4.3 The weekly tick

`contexts/game/actions/weekly/` holds ~37 `apply*.ts` subsystems run from the week
loop. Two rules that recur in `tasks/lessons.md` five times over:

- **Every subsystem must run inside a try/catch.** A new `apply*` added outside the
  guarded block turns one subsystem's throw into a lost week for the whole save.
- Per-tick loops must not call unguarded helpers; a single bad entry must not
  abort the tick.
- **Natural decay's numbers live in `lib/economy/statDecay.ts`** (base 4, the
  8-week grace ramp, and the wealth multiplier `100000 / netWorth` clamped
  **0.5–1.0**). The ceiling was 2.0 until Program 7 (2026-09-02): it bound for
  every net worth under $50k, i.e. the whole early game, so "base 4" was a
  rate no fresh life ever lived at. The tick, the recap projection
  (`vitalDrift.ts`) and both HUD breakdown modals call the one function — do
  not restate the formula. Balance changes to the early game are measured on
  the persona simulator (`__tests__/helpers/earlyGameSim.ts`, soak
  `RUN_EARLY_GAME_SIM=1 npx jest earlyGamePersonas --silent=false`) and gated by
  `__tests__/simulation/earlyGameSurvivability.test.ts`; the evidence is in
  `tasks/early-game-balance-2026-09-02.md`.
- **The economy is measured on the real tick, not read off the doc.**
  `__tests__/helpers/economyPersonas.ts` holds nine economic personas (POOR
  START … TEXT-SKIPPER) over the same harness as the survival personas, with
  economic actions (deposit, stocks, property, enrol, company, licence,
  vehicle, luxury, loan, pet) routed through the production action modules.
  Soaks: `RUN_ECONOMY_PERSONAS=1 npx jest economyPersonas --silent=false`
  (20/50/100/250 weeks, `DUMP=<file>` for JSON), `RUN_ECONOMY_STRATEGIES=1`
  (equal capital, five deployments), `RUN_ECONOMY_SHOCKS=1` (job loss,
  illness, low cash, big bill, crash); gates in
  `__tests__/simulation/economyBoundaries.test.ts`. Two rules that came out
  of Program 10 (2026-09-03): a log-space drift is a MEDIAN, and the
  arithmetic expectation a diversified holder compounds at is drift + σ²/2 —
  `weeklyLogDriftFor` subtracts it and `expectedAnnualReturnFor` states the
  result, so assert market targets on that; and a single seeded tape is one
  draw, so market statistics in tests average over lives. Evidence:
  `tasks/economy-progression-2026-09-03.md`.
- **Every draw on the tick path is a function of the LIFE and the week.**
  `lifeSalt(state)` / `makeLifeRoll(state, weeksLived)` in `utils/seededRoll.ts`
  fold `lineageId:generationNumber` into the weekly stream; `buildPreRolls`,
  the old-age draw, the disease generator and every event payload use it.
  `lineageId` is minted per new life in `gameStateBuilder` and per prestige
  reset (Program 8) - it was the literal `'initial-lineage'` for every life
  before, which made every new game the same life. Never add a `Math.random()`
  to the tick or to an event `generate()`; never key a life-affecting roll on
  the week alone. Disease occurrence is `DISEASE_BASE_WEEKLY_CHANCE ×
  calculateDiseaseRisk` (`lib/diseases/diseaseGenerator.ts`); the template
  curves only pick WHICH illness. Evidence: `tasks/life-variation-2026-09-02.md`.
- **Retention is measured, not assumed.** `RUN_RETENTION_SIM=1 npx jest
  retentionJourney.sim --silent=false` prints a per-week signal map (new
  decision, promotion, unlock, chapter step, goal change, week-ahead row, life
  moment) over 100 weeks; `__tests__/simulation/retentionJourney.test.ts` gates
  it. The goal engine rotates SOON/DREAM through the eligible catalogue on an
  8-week window (`GOAL_SPOTLIGHT_WEEKS`), life moments run at
  `LIFE_MOMENT_WEEKLY_CHANCE` (5%, pity 30), and Chapter 2 asks for a home.
  Evidence: `tasks/retention-journey-2026-09-03.md` (Program 9).

### 4.4 Money and other grants must be atomic

The single most repeated bug class in this repo is **gate → grant**: checking
affordability (or an "already claimed" flag) *outside* the updater and mutating
inside, so a double-tap in the same React batch pays once and grants twice.

- Charge/credit **inside the same `setGameState` updater** that applies the effect,
  re-checking affordability against `prev` and returning `prev` unchanged to reject.
- Use `applyMoneyDelta` / `batchUpdateMoney` from `contexts/game/actions/MoneyActions.ts`.
- The same rule applies to reputation, gems, and any claim flag — and to UI
  components, not just action modules (both have shipped this bug).
- Anything gated on a device-clock day-string is farmable; gate on game state.

### 4.5 Save system

Pipeline lives in `utils/`: `saveValidation.ts` (validate + `repairGameState`),
`saveMigrations.ts`, `saveQueue.ts`, `saveBackup.ts`, `saveLoadMutex.ts`,
`saveSigningConfig.ts`, `saveSlotMeta.ts`, `loadedStateMerge.ts`,
`phantomSaveCleanup.ts`, `stateInvariants.ts`. See §7 for the schema rules.

### 4.6 Feature flags & native modules

- All optional systems are flagged in `lib/config/featureFlags.ts`, driven by
  `EXPO_PUBLIC_*` env vars. `BORING_BUILD_MODE` (default **on in `__DEV__`**)
  disables AdMob, IAP, analytics, notifications and ATT for a stable baseline.
- Native-SDK flags are **opt-in** (`=== 'true'`): `adMob`, `firebaseAnalytics`,
  `revenueCat`, `iap`, `att`. There is no Sentry `analytics` flag any more —
  Sentry was removed after the iOS 26 TurboModule crash and the flag had zero
  readers, so it was deleted (2026-08-23) like the `notifications` flag below. Production values are set per-profile in `eas.json`.
  `iap` and `att` were the two exceptions until 2026-08-16 — they read
  `!== 'false'`, so they were ON in any profile that simply did not mention the
  variable, which is exactly what `preview` and `development` do. An internal
  preview build therefore armed StoreKit with no products and burned the
  one-shot ATT prompt with no ad integration behind it. Both are `=== 'true'`
  now, `preview` carries `EXPO_PUBLIC_BORING_BUILD=true`, and
  `__tests__/tooling/nativeSdkFlagDefaults.test.ts` pins the per-profile truth
  table against `eas.json` so a profile that drops its explicit `"true"` fails
  in CI rather than on TestFlight.
- There is **no `notifications` flag**. `expo-notifications` was removed to fix a
  TurboModule crash, so the flag had zero readers — a kill switch nobody consults
  reads as working protection. `utils/notifications.ts` survived as a no-op stub
  for a while afterwards; nothing ever imported it either, so it is deleted too.
- Load native modules lazily via `require()` in a try/catch, never at module top level.

### 4.7 What a bond is worth, and the one place it is defined

`lib/social/closeness.ts` is the single definition of what a relationship score
MEANS — `estranged` 25 · `known` 45 · `close` 60 · `trusted` 80 — and every
consumer reads it rather than restating a threshold. Two rules came out of
measuring it (Program 12, `tasks/relationship-depth-2026-09-03.md`):

- **The wire runs BOTH ways.** `applyRelationshipHealth` returns a
  `happinessSupport` beside its `happinessPenalty`, and the tick caps them the
  same way (+1 per close bond to a ceiling of +3, mirroring the −1/−3 neglect
  drag). Before that, relationships could only ever subtract happiness, and a
  controlled nine-cohort run measured the consequence: happiness, health and
  energy byte-identical whether a life held nobody, one soulmate or fifty
  acquaintances. If you add a relationship effect, check which direction the
  existing wire runs before concluding it is merely weak.
- **The bond ladder diminishes.** `closenessFalloff` (`lib/social/npcDepth.ts`)
  makes a free catch-up worth less to somebody you already see — full value to
  45, a quarter at 100 — because a flat +3 at every score against a −0.5/week
  decay ratcheted every contact anyone ever rang to 100, which is what made
  headcount beat depth and left the upper half of the scale meaningless.
  Consistency buys depth; collecting people does not.

Relationship value is deliberately NOT money: nothing here grants cash on a
timer, and the one support branch that pays at all is capped at $400, needs real
arrears, and costs 12 bond.

### 4.8 Other people enter a life through exactly three doors

`Relationship` records are produced by **three** functions and nothing else:
`promoteMatchToFriend` / `promoteMatchToRelationship` (Spark, **tier 2**), the
`intro` favour (`resolveNonMoneyFavor`, offered only on a `business` contact, so
**tier 3**), and `meetSomeone` (`lib/social/meetPeople.ts`, the Contacts app,
**tier 1**). Before the third existed a player below tier 2 could not meet
anybody at all, which is why Chapter 2's social goal had to count the seeded
parents and paid its share of the bundle for a state every life starts in. If
you add a fourth, say which tier it is reachable at — a social system nobody can
reach is indistinguishable from one that does not exist.

Two rules that came out of measuring it (Program 11,
`tasks/social-systems-2026-09-03.md`):

- **`Relationship.income` is an ANNUAL salary.** It is copied from
  `DATING_PROFILES`, whose 52 rows are annual figures, and
  `householdPartnerIncome` divides by `WEEKS_PER_YEAR` before spending it. It
  used to be added straight into the WEEKLY income beside `careerSalary`
  ($110–$6,000), so one Spark promotion paid up to $62,500 a week forever. Every
  label that shows it says "/yr".
- **The social systems are measured on the real tick**, like the economy.
  `__tests__/helpers/socialPersonas.ts` holds seven personas (LONER … RISK-TAKER)
  over the `earlyGameSim` harness, with swipes, conversation moves, calls,
  bonds, dates, gifts and proposals routed through the production action
  modules. Soak: `RUN_SOCIAL_PERSONAS=1 npx jest socialPersonas --silent=false`
  (`DUMP=<file>` for JSON); gates in
  `__tests__/simulation/socialBoundaries.test.ts`. The rule that came out of it:
  a persona that never reaches a system cannot measure it — Program 10 ran nine
  economic personas for 250 weeks and never saw the partner-income defect,
  because not one of them ever got a partner.

---

## 5. Conventions

- **Theme:** `useTheme()` or `getThemeColors(darkMode)` from `lib/config/theme.ts`
  (`colors`, `accent`, `typography`, `radii`, `shadows`, `animation`). **Spacing is
  not there** — it used to export a raw `spacing` ladder whose keys collided with
  `responsiveSpacing` in `utils/scaling.ts` at different values (`md` was 12 vs
  `scale(16)`), so `spacing.md` meant two things depending on the import line and
  only one of the two scaled with the device. By the time it was measured the raw
  ladder had zero importers; it is deleted, and `responsiveSpacing` / `scale()`
  are the one spacing scale.
- **Scaling:** always `scale()` / `fontScale()` from `utils/scaling.ts` — never raw pixels.
- **Z-index:** `Z_INDEX` in `utils/zIndexConstants.ts` —
  `CONTENT 1 → DROPDOWN 100 → TOOLTIP 200 → MODAL 300 → TOAST 400 → LOADING 500 → DEBUG 999`.
- **Glassmorphism:** helpers in `utils/glassmorphismStyles.ts`, all take a `darkMode` param.
- **Routing:** two files must never resolve to the same route. `(group)` segments are
  stripped and `index` maps to its parent, so `app/index.tsx` and `app/(tabs)/index.tsx`
  collide — expo-router silently drops one **in production only**. That shipped the
  v2.5.0 launch crash; `npm run check:routes` now guards it.
- **`React.lazy()` in a screen file is narrow, not banned.** Converting a screen's
  sub-app map (`apps[activeApp]`) to `lazy(() => import(…))` shipped an "Element type
  is invalid" launch crash in the production Hermes bundle and was reverted, so
  `app/(tabs)/computer.tsx` and `app/(tabs)/mobile.tsx` must stay eager —
  `__tests__/startup/screenImports.test.ts` blocks a regression there. Lazy-loading a
  heavy *modal leaf* rendered directly is the established pattern and is used on
  purpose (`MainMenu.tsx` lazies `SettingsModal` precisely to keep its heavy graph out
  of MainMenu's module init; `_layout.tsx`, `home.tsx` and `(tabs)/_layout.tsx` do the
  same). Don't add a new one without a production smoke test, and never for a component
  the router resolves through a lookup map at module top.
- **Logging:** `utils/logger.ts`, not `console.*`.
- **Lint guardrails** (`eslint.config.js`), which encode the hard rules:
  - `as any` → warn app-wide, **error in 58 of `lib/`'s 59 directories** — every
    one that is fully clean of `as any` and internal `require()`, i.e. all but
    `lib/simulation`. `lib/travel`
    was the first and sat alone for months; a count on 2026-08-14 found 48 more
    were ALREADY clean and simply unprotected, so the burndown had been
    happening as a side effect of ordinary work with nothing locking it in.
    The enumeration drifts behind `lib/` whenever a directory is ADDED —
    `lib/markets` and `lib/spark` were both born clean and both sat outside the
    list until 2026-08-17 — so re-count it when you add one.
    **The rule earns its keep: each of the two directories cleared by hand so
    far turned up a real player-facing bug** — the obituary naming no job
    (`career.name`, which `Career` does not have) and the 8,000-point
    Investment Portfolio granting nothing (`stockInfo.currentPrice`, which
    `StockData` does not have). Both were fabricated property names that a
    `require()`-erased type let compile, then silently `undefined` inside a
    falsy gate. Treat clearing a directory as bug-hunting, not tidying.
  - **"It's a cycle-breaker" is a claim to check, not to inherit.** All 30 lazy
    requires in the six long-held-back directories were tested against the
    static import graph on 2026-08-14: 29 were not cycle-breakers, and the
    justification had simply been copied forward. Ask of each one *does the
    target already reach this file?* — and exclude `import type` edges, which
    tsc erases and which therefore cannot form a runtime cycle (four false
    positives all routed through `contexts/game/types.ts`, whose every import
    is type-only; a types file on a cycle is the tell). Also check what a type
    checker cannot: a lazy require defers module EVALUATION, so confirm the
    target has no top-level side effects before making it eager.
  - Two legitimate reasons to keep one, both requiring a measurement in the
    comment: **weight** (`lib/prestige/prestigeTypes.ts` — a 161-LOC leaf that
    `contexts/game/initialState.ts` imports, pulling 5 949 LOC if made static;
    already typed via `as typeof import(...)`, so it degrades nothing) and
    **boundary** (`lib/simulation`, the last unenforced directory — ~10k LOC of
    dev tooling already dead-code-eliminated by the `__DEV__`-folded require in
    `SettingsModal.tsx`, whose requires reach into `contexts/game/*` and would
    bake a lib → contexts inversion into the graph).
  - `require('@/lib|utils|contexts…')` for internal modules → warn (degrades types
    to `any`/`never`); use static `import` or `import type` + a typed lazy getter.
  - **`lib/` may not import VALUES from `contexts|components|app|services|hooks`**
    (`@typescript-eslint/no-restricted-imports`, error across `lib/**`).
    `import type` stays legal in both directions — tsc erases those edges, so
    they cannot form a runtime cycle — and `@/contexts/game/types` is exempt
    outright as a types-only module. The rule exists because an upward edge that
    closes a cycle does not fail the build: it reads as `undefined` at module
    init, and `lib/mail` / `lib/crypto` sit on the week-loop path, where that is
    a lost week. Three symbols were moved DOWN when it landed
    (`RAISE_MIN_PERFORMANCE` → `lib/careers/raisePremium`,
    `calculateMiningEarnings` → `lib/crypto/miningEarnings`, `applyMoneyDelta` →
    `lib/economy/moneyDelta`), each re-exported from its old home so importers
    were untouched. Two files carry a line-level disable with the reasoning
    in place — `lib/prestige/prestigeExecution.ts` (`initialGameState` is data,
    and injecting it ripples through ~20 call sites for no structural gain) and
    `lib/subscription/deepLifePlus.ts` (one entitlement query; a registration
    hook would put a boot-order hazard on a PAYMENT gate). `lib/simulation`,
    `lib/devtools` and `lib/analytics` are exempt by directory as
    adapters/dev-tooling rather than game logic.
  - `@ts-ignore` / `@ts-nocheck` banned; `@ts-expect-error` needs a ≥5-char description.
  - Tests are exempt from both rules.

---

## 6. Hard Rules

**1. `app/entry.ts` stays dumb.** App initialization only — no imports from
`@/lib`, `@/contexts`, `@/components`, no complex functions, under 200 lines
(it is currently 17). Logic belongs in `app/_layout.tsx`. Preflight §3 reports
violations but only **warns** — it fails the build solely when `entry.ts` is
missing, so a green preflight is not proof this rule held. Check it by eye.

**2. No unions without guards.** Access union members via
`'property' in object && object.property`. No direct access, no `as any`.
Reference: `lib/types/requirements.ts`.

**3. No GameState drift.** Tests **must** build state with `createTestGameState()`
from `__tests__/helpers/createTestGameState.ts` — no hand-built GameState, no
`as GameState`. Every field added to `initialState.ts` ships with its migration in
the same change (§7).

**4. Native module config alignment.** Never remove a config plugin from
`app.config.js` while its package is still in `package.json`. Native SDK init runs
before JS, so no try/catch can save you.

**5. `DatingActions` signature trap.** Those functions expect the module form
`updateMoney(setGameState, amount, reason)` from `./actions/MoneyActions` — **not**
the hook form `useMoneyActions().updateMoney(amount, reason)`.

**6. Preflight before release.** `npm run preflight` must pass. No skipped checks,
no `--force`.

**7. No side accent bars / one-sided colored borders on cards.** A colored
one-sided border used as a decorative stripe (`borderLeftWidth`/`Right`/`Top`/`Bottom`
plus a matching `border*Color`) is **banned app-wide** — the product owner rejected
the look, and RN also curls it into a crescent artifact against `borderRadius`.
Use a full `borderWidth: 1` + `borderColor` on all four sides (keep the color for
meaning: green=success, amber=warning, red=danger, blue=info), or a tinted
`backgroundColor` with no border. *Allowed exceptions — structural, not decorative:*
row/section dividers, an active-tab underline, a hairline thread-indent guide, and
the hairline wrapping a bottom sheet's rounded top. Applies to every surface,
including the crash screen.

### Protected files — change only with extra care

`app/entry.ts` · `contexts/game/types.ts` · `contexts/game/initialState.ts` ·
`__tests__/helpers/createTestGameState.ts` · `lib/types/requirements.ts` ·
`app.config.js`

---

## 7. Save Format

- **Canonical `STATE_VERSION = 50`** — single source of truth in
  `contexts/game/initialState.ts` (re-exported as `CURRENT_STATE_VERSION` in
  `utils/saveMigrations.ts`). Keep `DEV.md` / `WORKFLOW.md` in sync when it bumps.
- Any field added to `initialState.ts` must ship in the **same change** with
  (a) a migration in `utils/saveMigrations.ts` that bumps `STATE_VERSION`, and
  (c) inclusion in `__tests__/helpers/createTestGameState.ts`. Adding a field
  without bumping the version is the "GameState drift" the weekly audit
  (Hard Rule #3) exists to catch.
- The (b) backfill step — set a value in the migration **and mirror it in
  `repairGameState` (`utils/saveValidation.ts`)** for partial saves — applies to
  fields with a **concrete stored default** (`[]`, `false`, `0`, an object).
  Fields whose default is `undefined` (an absent key already equals the default,
  e.g. `ambitionId`) need no backfill: still bump the version, but don't write the
  key. That is why v23 backfills `luxuryItems` / `ambitionCompletedMilestones` /
  `ambitionRewardClaimed` but intentionally omits `ambitionId`.
- **Migration ↔ repair parity is not checked by the static audit.** A field with a
  migration but no `repairGameState` mirror (v22 `realEstateActivity`) survives
  until a partial save hits it. Add both, always.
- **v26 adds `settings.quickActionWeeks`** — the per-game-week marker gating the
  HUD long-press quick actions. Default is `undefined`, so it is one of the
  carve-out fields: version bumped, NO backfill and no `repairGameState` mirror,
  because an absent key already equals "no action used this week".
- **v27 adds `lastLoginRewardAt`** — the epoch high-water mark that stops a
  rewound device clock re-arming the daily-login gem claim. Default `undefined`,
  so it is another carve-out: version bumped, NO backfill and no
  `repairGameState` mirror. Writing a value would be actively wrong — it would
  lock an existing player out of their next legitimate claim.
- **v28 adds `settings.lastNoFillGrantWeek`** — the game-week marker capping the
  ad orb's no-fill courtesy reward. It replaces a module-level boolean that reset
  on app restart, which made the net-worth-scaled grant farmable by force-quitting.
  Default `undefined`, so another carve-out: version bumped, NO backfill and no
  `repairGameState` mirror — writing a value would deny an existing player their
  first legitimate courtesy grant.
- **v29 adds `legacyUpgrades`** — the ids bought with legacy points (C-11).
  `legacyPoints` had accrued since v11 with nothing to spend them on; this adds
  the purchase record and a shop that spends them on the heir's starting
  position. Concrete stored default (`[]`), so unlike the v26/v27/v28 carve-outs
  this one takes a REAL backfill **and** a `repairGameState` mirror. The
  spendable balance is derived (lifetime earned − spent) rather than
  decremented, because the week loop only ever ADDS to `legacyPoints`.
- **v30 registers `revivalPack`** — the unspent charge from the $2.99 Revival
  Pack (MON-5). The field is NOT new: it has sat on `GameState` and in
  `initialState` since the beginning with a `false` default, read by nothing and
  written by nothing. It was a standing instance of the very drift Hard Rule #3
  exists to catch — a concrete stored default that never shipped a migration —
  and it is registered now because it became load-bearing (the IAP grant banks a
  charge, `reviveWithPack` spends one). Concrete default, so a REAL backfill
  **and** a `repairGameState` mirror, both writing `false`. Functionally a no-op
  (an absent key is already falsy = "no banked revive"), which is also the only
  safe answer: inventing a charge would hand out a paid one-shot for free. The
  migration deliberately does NOT read `settings.hasRevivalPack` — that records
  the PURCHASE and survives prestige, while this records the unspent CHARGE.
- **v31 adds `overdueBalance` and `lastLoginRewardWeek`** — one bump, two fields
  with opposite treatment, which is exactly why they are worth reading together.
  `overdueBalance` is the arrears bucket that replaced the silent forgiveness of
  unpayable weekly bills (the cash line was one `Math.max(0, …)`), so the money
  axis finally has a failure state. Concrete stored default (`0`) → REAL backfill
  **and** a `repairGameState` mirror; parity matters more than usual because the
  value is arithmetic in the weekly cash line, so an absent key would produce
  `cash - undefined` = NaN and poison `stats.money` for the rest of the life.
  `lastLoginRewardWeek` is the game-week gate that finally closes the
  forward-clock daily-gem farm (both existing guards only refuse a REWOUND
  clock). Default `undefined`, so it is another carve-out: version bumped, NO
  backfill and no mirror — stamping the current week would deny an existing
  player their next legitimate claim.
- **v32 adds `rental`** — the home the player is currently renting
  (`{ tierId, startedWeek }`). Deliberately NOT an entry in `realEstate`: a
  tenancy is not a holding, and a synthetic entry there would make
  `calculateNetWorth` add the property's full price to the wealth of someone who
  does not own it, and surface a rental in the portfolio UI as an asset. Default
  `undefined`, so it is a carve-out: version bumped, NO backfill and no
  `repairGameState` mirror — writing a tenancy would start charging rent to a
  player who never signed for anything.
- **v34 adds `grandchildren`** on `ChildInfo` — lightweight records one
  generation below the player's children, so the 13 genetic traits and the
  nurture stats stop terminating at the heir. Default `undefined`, so it is a
  CARVE-OUT: version bumped, NO backfill and no `repairGameState` mirror. An
  absent key already means "no grandchildren", and writing an empty array onto
  every child of every save would churn the whole family tree for nothing.
  Births are rolled deterministically from `weeksLived` inside the pass the tick
  already makes over children (`applyChildAging`), so no nested loop is added —
  the perf audit tracks nested-loop density in the weekly path.
- **v33 adds `legacyContracts`** — the claimed-id record for Legacy Contracts,
  the multi-life goals that pay Legacy Points into the Dynasty Tree. Concrete
  stored default (`{ claimedIds: [] }`), so a REAL backfill **and** a
  `repairGameState` mirror. An absent key genuinely means "nothing claimed",
  which is also the only safe repair: inventing a claim would deny the player
  the points for a contract they had already earned. Note what is deliberately
  NOT stored — progress. Every contract metric is read from a value the save
  already tracks and that only ever increases (prestige count, generations,
  lifetime weeks), so nothing can drift out of sync, a tick that runs twice
  cannot double-credit, and an existing save loads with its contracts already
  part-complete rather than reset to zero.
- **v35 adds `settings.lastAdCashGrantWeek`** — the `weeksLived` marker the ad
  orb's week gate reads, capping rewarded-ad CASH grants to one per game week.
  The orb's only limiter was a wall-clock respawn timer, decoupled from
  `weeksLived` entirely, so a reward worth 1.5% of net worth compounded on REAL
  time — roughly doubling net worth every couple of hours of play, past the tax
  brackets and the net-worth soft cap. The same "gate on game state, not the
  device clock" fix as v28/v31/v40. Default `undefined`, so a CARVE-OUT: version
  bumped, NO backfill and no `repairGameState` mirror — stamping the current
  week would deny an existing player their next legitimate claim.
- **v36 adds `dynasty`** — one object holding the bookkeeping for prestige
  tiers 2–5 (the Vault, the Endowment, Dynasty Trials, the Dynasty Seat). ONE
  optional field rather than four top-level keys, so four new systems cost one
  carve-out instead of four backfills and four repair mirrors. Default
  `undefined`, so it is a CARVE-OUT: version bumped, NO backfill and no
  `repairGameState` mirror. Absence already means empty vault / nothing endowed
  / no Trial / no wings, and nothing here can be invented safely — stamping a
  vaulted item, a taken tranche or an active Trial would hand out or charge for
  something the player never chose. Every read goes through
  `lib/dynasty/state.ts`, which degrades a missing or malformed shape to the
  empty answer rather than throwing inside the week loop. Shipped alongside a
  fix in the same area: `legacyContracts.claimedIds` was **never carried across
  a prestige**, so `initialGameState`'s empty board was restored every cycle and
  the whole contract ladder was re-claimable. Both paths now run one hook,
  `applyDynastyTransition` (`lib/dynasty/transition.ts`).
- **v37 adds `mail`** — the paper trail (payslips, statements, invoices,
  receipts) and the phishing channel that rides on it. Default `undefined`, so
  another CARVE-OUT: version bumped, NO backfill and no `repairGameState`
  mirror. Absence is the only honest state here — seeding an inbox would have to
  invent the documents to fill it, and every one would be a number the player
  could check and find wrong (payslips for weeks already lived, statements for
  balances that have since moved). A scam message is worse still: it is an
  unresolved decision, and writing one onto an existing save would present a
  choice about money earned before the feature existed. Reads go through
  `lib/mail/state.ts`. Generation is deterministic in `weeksLived` and
  double-guarded (a `lastGeneratedWeek` marker plus week-encoded ids), so a
  double-invoked updater cannot deliver twice — which matters because one of the
  messages can take money. Losses are only ever charged when the player taps the
  fraudulent action, inside the same updater that marks it resolved (§4.4).
- **v38 added `gameMode` — story mode is RETIRED, and the field is now inert.**
  It shipped as the pace of a life (`'classic'` = one week per tap, `'story'` =
  up to 52 ticks batched into one tap) and was removed after playtesting.
  Nothing reads the type or the field today, nothing can set it, and
  `lib/gameMode/` no longer exists. **There is no batch, no `resolveGameMode`,
  and no `__tests__/gameMode/batchEquivalence.test.ts`** — earlier revisions of
  this file described all three and sent readers looking for code that is not
  there.

  The field and the version stay because a TestFlight build shipped story mode,
  so saves carrying `gameMode: 'story'` and `version: 38` exist on real devices.
  Deleting the key would make those saves parse into a shape the types call
  impossible, and dropping back to 37 would make every one of them trip the
  "save is newer than the app" warning in `saveMigrations.ts`. The cost of
  leaving it is one unread optional key. The reasoning lives next to
  `GameMode` in `contexts/game/types.ts`; keep the two in step.
- **v39 adds `userProfile.avatar`** — the encoded `AvatarConfig` behind the
  rebuilt character creator. Faces are now assembled from illustrator-drawn
  modular art (avataaars via DiceBear, curated in `lib/avatar/style.ts`,
  rendered under a 2.5D lit plate by `components/avatar/VectorAvatar.tsx`)
  rather than picked from a pool of pre-rendered portraits, so appearance is a
  set of parameters that AGES with the character instead of a PNG swapped for a
  different person's face at each age band. The old pool assigned a bucket slot
  per age band, so crossing a band swapped the character for a DIFFERENT
  rendered person at the same index — the "my character turned into someone
  else" class of report. `docs/avatar-art-direction-research.md` records the
  mechanism; `utils/facePool.ts` and its 3.5 MB of portraits are deleted.
  The first attempt hand-authored the facial geometry as bezier path data and
  had to be thrown away; `docs/avatar-art-direction-research.md` records why
  that pipeline could never have worked and how the alternatives were measured.
  Default `undefined`, so it is a CARVE-OUT: version bumped, NO backfill and no
  `repairGameState` mirror. Two independent reasons, either sufficient. First,
  absence already resolves: `resolveAvatar` (`lib/avatar/resolve.ts`) derives a
  face deterministically from the character's name and their legacy `avatarId`,
  so an existing save loads with a stable face reflecting the portrait they had
  picked — the same one on every load. Second, writing a value would be actively
  harmful: a stored config is a set of INDICES into the catalogs in
  `lib/avatar/style.ts`, so stamping today's indices would freeze this
  catalog order into every save, and appending one hair style later would
  silently re-roll every character that had been stamped. `avatarId` is
  deliberately left in place rather than translated — it still carries the
  player's original pick, which is what seeds the derived face.
  **Catalog order is part of the save format**: appending to a catalog is safe,
  reordering or removing an entry changes the face of every character using it.
- **v40 adds `settings.deepLifePlusLastGemClaimWeek`** — the `weeksLived` marker
  that gates the FREE-tier daily-gem faucet (`SubscriptionActions.claimDailyGems`,
  surfaced by `DailyGemClaim`). That faucet was gated only on a UTC day-key and an
  epoch high-water mark, both of which only refuse a REWOUND clock — advancing the
  device date a day at a time farmed gems (20/day) with no play. It closes the same
  way the sibling login faucet did with `lastLoginRewardWeek` (v31): `weeksLived`
  only advances by playing. The DeepLife+ member drop (250/day) keeps its
  deliberate day-key grace (claim on any new calendar day without playing a week —
  guarded by its own test) and is intentionally NOT gated — extending the gate to
  paying members is a retention decision left to the owner. Default `undefined`,
  so a CARVE-OUT: version bumped, NO backfill and no `repairGameState` mirror —
  stamping the current week onto an existing save would deny the player their next
  legitimate claim (the v28 `lastNoFillGrantWeek` reasoning). It still has to
  survive the load round-trip, which `loadedStateMerge` guarantees.
- **v41 adds `tuitionWaiverUSD`** — an unspent tuition credit, granted by the
  poverty-recovery scholarship event and consumed at the next enrolment. The
  event (`scholarship_opportunity`) had been unreachable for its entire life:
  its condition reads `weeksInPoverty >= 12` and NOTHING wrote that field.
  Making it fire exposed the other half — its `grant_free_education` effect
  granted +10 reputation under a choice reading "Accept the scholarship (Free
  education!)". This field is what makes the promise real. A CREDIT rather than
  cash on purpose: the event fires for a player under $500 and programmes cost
  $12k–$180k, so paying it out as money would be a life-changing injection from
  one random roll, and it is not what the event promises anyway. Default
  `undefined`, so a CARVE-OUT: version bumped, NO backfill and no
  `repairGameState` mirror. Absent already means "no credit", and writing a
  value would hand every existing save a scholarship nobody earned — the mirror
  image of the v27/v28 reasoning, where stamping a value would have DENIED
  something instead. Consumed inside the same updater that enrols (§4.4), and
  only for the part that actually paid tuition, so a 4.0 student whose merit
  award already covers 80% keeps the rest of the credit.
- **v42 adds `title` on `CareerHistoryEntry`** — the job title as of the most
  recent paid week, stamped by the weekly tick. The obituary derived a title
  from the LIVE career record, and the political exit deliberately resets
  `careers.political.level` to 0 (so lifestyle costs and the "in office?" UI
  stop treating a voted-out player as a sitting official), so a president who
  left office was eulogised as whatever level 0 is called. Recording the title
  while it is TRUE, rather than reconstructing it later, makes the history
  independent of anything an exit path does to `careers` — including paths that
  do not exist yet. Default `undefined`, so a CARVE-OUT: version bumped, NO
  backfill and no `repairGameState` mirror. Entries written before this cannot
  grow one (the week they were worked is gone) and readers fall back to deriving
  from `careers`, which is correct for every career except the political one.
- **v43 adds `lifeStartWeek`** — `weeksLived` at the moment a life began.
  `weeksLived` is ABSOLUTE and seeded from the starting age
  (`computeWeeksLived` = `(age - 18) * 52`), so an age-20 character starts at
  **104** and an age-25 one at **364**. Every "have I played N weeks yet" check
  against the raw counter is therefore already true before the first frame.
  That has now caused three bugs: the first-session coach retired before it ever
  rendered, `FirstWeekGuide` carried a comment warning about it that was read and
  not applied, and Chapter 1's "Survive 4 Weeks" was complete on week 1 for every
  scenario that does not start at 18 — paying its per-goal reward for nothing, in
  the tutorial chapter. Read it through `weeksInThisLife` (`lib/progress/lifeChapters.ts`),
  never by subtracting by hand. Default `undefined`, so a CARVE-OUT: version
  bumped, NO backfill and no `repairGameState` mirror. A save written earlier has
  no record of when its life began and cannot grow one, so readers fall back to
  0 — exactly the behaviour those saves have today. Guessing a baseline would
  silently un-complete a goal an existing player was already paid for.
- **v44 adds `settings.lastWelcomeBackWeek`** — the `weeksLived` marker capping
  the welcome-back cash bonus to one per game week. The bonus
  (`0.5 × weekly salary × min(daysAway, 7)`, floor $100, computed in
  `utils/welcomeBackBonus.ts`) was gated purely on `Date.now() - lastLogin`,
  which refuses a REWOUND clock and nothing else — so scrubbing the device date
  FORWARD a week at a time paid 3.5 weeks of salary per scrub with no game weeks
  played, past the tax brackets, past the net-worth soft cap and outside the
  weekly tick entirely. The same "gate on game state, not the device clock" fix
  as v28/v31/v35/v40. The grant and the stamp happen in ONE updater
  (`applyWelcomeBackBonus`), which returns `prev` unchanged when the week is
  already claimed, and the popup SPAWNER consults the same pure
  `welcomeBackClaimed` guard so an unredeemable bonus is never offered — the
  `AdRewardOrb` spawner pattern. Default `undefined`, so a CARVE-OUT: version
  bumped, NO backfill and no `repairGameState` mirror — stamping the current
  week would deny an existing player their next legitimate bonus.
- **v45 adds `rapport` and `conversationCooldowns` on `SparkMatch`** — the
  per-match state behind Spark's choice-driven chat. The dating app's chat was
  a free-text box wired to a personality reply pool: whatever the player typed,
  the NPC answered from a fixed list, nothing about the match changed, and there
  was no reason to send a second message. It is a short game now — `rapport`
  (0-100) moves on every move and gates Flirt (25), Ask on a date (45) and Ask
  to go steady (75), while `conversationCooldowns` (optionId → `weeksLived`)
  stops the cheapest move being tapped ten times to ratchet it. The cooldown map
  is keyed on `weeksLived` (absolute), never the cyclic `week` and never the
  device clock — a wall-clock gate here would be farmable, and this one paces
  happiness, cash and ultimately a relationship. That stamp is also what makes
  the commit safe: it lands in the SAME updater as the energy/cash charge, so a
  same-batch double tap re-checks it against `prev` and pays once (§4.4).
  Default `undefined` for both, so a CARVE-OUT: version bumped, NO backfill and
  no `repairGameState` mirror. Two independent reasons, either sufficient.
  Absence already resolves — `readRapport` (`lib/spark/conversation.ts`) applies
  the fresh-match baseline at read time, and an absent map already means
  "nothing on cooldown". And writing a value would be a guess in either
  direction: a save carries no record of how its chats went, so a low number
  erases a conversation the player invested in and a high one hands out the date
  and go-steady moves for free. Stamping cooldowns would be worse still — it
  would lock every existing match out of moves it has never played. The
  go-steady move commits through `resolveMatchPromotion`, a pure extraction of
  `promoteMatchToRelationship`, so the anti-bigamy rule stays in exactly one
  place while the promotion lands inside the conversation's single updater.
- **v46 adds `settings.deepLifePlusLastMemberClaimWeek`** — the `weeksLived`
  marker capping the DeepLife+ MEMBER daily-gem grace at ONE claim per played
  game week. v40 gated the FREE faucet and deliberately left the member drop
  (250/day) on its calendar-day grace, because claiming on a quiet day without
  playing is a paid perk. The perk stays; what it lacked was a cap. The day-key
  and epoch guards only refuse a REWOUND clock, so scrubbing the device date
  FORWARD a day at a time compounded that one-day courtesy into an unbounded
  250-gems/day faucet on the premium currency that is otherwise an IAP. The rule
  is now: a claim BACKED BY PLAY (`weeksLived` advanced since the last claim)
  is always allowed and never touches the grace; an unplayed claim spends the
  grace and stamps this marker; a second unplayed claim at the same `weeksLived`
  is refused. Only playing re-arms it — the same "gate on game state, not the
  device clock" fix as v28/v31/v35/v40/v44. The truth table lives next to
  `isPlayBackedGemClaim` in `contexts/game/actions/SubscriptionActions.ts`; the
  gate and the stamp run in ONE updater and the CTA (`DailyGemClaim`) consults
  the same predicate, so an unclaimable drop is never offered. Default
  `undefined`, so a CARVE-OUT: version bumped, NO backfill and no
  `repairGameState` mirror — stamping the current week would refuse a paying
  member's next legitimate claim. It is deliberately NOT in
  `PURCHASED_SETTINGS_KEYS`: a `weeksLived` marker must not cross a life
  boundary (see the note there).
  Numbered 46 because the Spark carve-out above reached `main` first and owns
  45; one version number must mean one schema shape.
- **v48 adds `weeklyFoodPurchases`** — the per-game-week meal counter behind
  food satiety (`lib/economy/foodSatiety.ts`): meals 1-3 restore in full, 4-6
  at half strength, 7+ at a quarter. `buyFood` had no weekly cap, so a $40
  steak was an uncapped ~$1.60/point energy conversion that collapsed the
  weekly energy budget into money. Default `undefined`, so a CARVE-OUT:
  version bumped, NO backfill and no `repairGameState` mirror — absent already
  means "nothing eaten this week" (exactly what the tick writes at every week
  boundary, resetting the counter to 0 beside `weeklyStreetJobs`), and
  stamping a count would deny an existing player full-strength meals they
  never ate. The charge, the scaled restores and the counter bump run in ONE
  updater, and the market toast + section hint read the same helpers, so what
  is advertised is exactly what is applied.
- **v49 adds `liveOps`** — the bookkeeping behind the Live Ops event system
  (`lib/liveops/`): claimed event instance ids, opened instances, and the
  rolling reward budget. ONE optional object for a whole subsystem, the v36
  `dynasty` precedent. Default `undefined`, so a CARVE-OUT: version bumped, NO
  backfill and no `repairGameState` mirror. Absence already resolves —
  `readLiveOpsState` returns the empty answer, which is the truth for a save
  written before any live event existed. Writing a value would be wrong in both
  directions: a stamped claim id denies a reward never taken, a stamped budget
  entry refuses the first legitimate claim for a week — and there is nothing to
  guess from, since no earlier save records a live event. Note what is
  deliberately NOT stored: objective PROGRESS. Every objective reads a value the
  save already tracks (the v33 `legacyContracts` reasoning), so nothing drifts,
  a tick that runs twice cannot double-credit, and an existing save loads with
  its events already part-complete. Event WINDOWS are real UTC time and
  everything EARNED is game state — see `docs/LIVEOPS.md`.
- **v50 adds `metAt` on `Relationship`** — where and when somebody entered the
  life (`{ venue, label, week }`, the week being `weeksInThisLife`). A field on
  the ELEMENT of a concrete array, so it takes the v34 `grandchildren` / v42
  `title` treatment rather than a top-level backfill. It exists because the game
  had nowhere DURABLE to put the one fact a player most wants back about
  somebody: how they met. `npcMemories` looked like the place and is not —
  `decayMemories` drops anything older than `MEMORY_TTL_WEEKS` (52), so an
  origin written as a memory is guaranteed to be forgotten in the second year,
  which is exactly when remembering it starts to matter. Default `undefined`, so
  a CARVE-OUT: version bumped, NO backfill and no `repairGameState` mirror. A
  relationship written before this has no record of where it began and cannot
  grow one — the week it happened is gone — so readers fall back to saying
  nothing, which is what those saves show today. Writing a value would be worse
  than useless: it would be a FABRICATED memory, telling a player they met their
  spouse somewhere they did not, on the screens whose whole job is to be the
  life they remember. Shipped with the first producer that has an origin to
  record, the tier-1 meeting door (§4.8).
- **v47 adds five fields on `PoliticsState`** — `partySupport`, `partySwitches`,
  `appointment`, `embezzlement` and `retirement`: the Political Life expansion,
  built from a player request for "campaign retirement and other positions you
  can have that pay, you can choose to steal stake money, join political
  parties". Five fields, ONE bump, because they are one feature and one schema
  shape — the v36 `dynasty` precedent (four systems, one carve-out) rather than
  five separate backfills. Every default is `undefined`, so it is a CARVE-OUT:
  version bumped, NO backfill and no `repairGameState` mirror. Absence resolves
  for all five, and a written value would be wrong in a DIFFERENT direction for
  each — which is the useful thing to notice here. `partySupport` reads through
  `readPartySupport` (fresh-member baseline at read time, and always 0 for
  `independent`, which has no machine to stand in), so stamping a number would
  either hand out an endorsement nobody earned or open a primary challenge
  nobody lost. `appointment` would pay a salary for a job nobody took — and two
  of the six posts BAR elected office, so it could silently disqualify a sitting
  official. `embezzlement` would accuse a player of a crime they did not commit
  AND feed it into the scandal roll. `retirement` would pay a pension nobody
  earned and stamp a title on a career that never reached it. Only
  `partySwitches` is harmless either way, and "never crossed the floor" is the
  truth for every save written before switching had a cost.
  Two things worth reading together: the pension is paid through
  `getPoliticalPensionWeekly` and NOT folded into `getPoliticalWeeklySalary`,
  because that figure is the WORK `applyLifetimeStatistics` counts toward
  earning a pension — a pension inside it would compound on itself. And
  embezzlement heat is expressed in the same dollar currency as
  `pac.lifetimeDirtyUSD` so it feeds the EXISTING `scandalProbability` driver:
  corruption risk stays one number with one tuning point, not two curves that
  have to be kept in step.
- **v24 adds `luxuryHoldings`** — per-item luxury state, an additive SIDECAR keyed
  by the same ids as `luxuryItems`, which stays the ownership source of truth. Both
  the migration and `repairGameState` backfill a holding for every already-owned id.
- **`checkpoints` is persisted in a SIDECAR, not in the slot payload**
  (2026-08-26, no version bump). Time Machine checkpoints measured 62% of a
  late-game save (291KB of 469KB) while changing once per game-YEAR, so the
  save queue strips them from the serialized slot payload and writes them to a
  per-slot signed envelope (`checkpoint_sidecar_slot_N`,
  `utils/checkpointSidecar.ts`), written only when they change. `loadGame`
  reattaches the sidecar ONLY when the parsed save has no `checkpoints` key —
  inline always wins, so old saves, backups and cloud states (which all still
  carry checkpoints inline, serialized from the in-memory state) are
  untouched. The in-memory GameState keeps `checkpoints` exactly as before.
  Deliberately NO STATE_VERSION bump: the field has always been optional and
  every reader defaults an absent key, so a checkpoint-less payload is legal
  under every version back to v10; a bump would only make TestFlight
  downgrades refuse a save the old app could read (the v38 trade). A stale
  sidecar from a previous life in the same slot is defused twice: the first
  save of every session rewrites the sidecar, and the load-time filter drops
  any checkpoint whose `weeksLived` or snapshot `lifeStartWeek` cannot belong
  to the loaded save. `deleteSaveSlot` removes the sidecar key (spelled
  literally there to avoid an import cycle — a parity test pins the two).
- **A carve-out still has to survive the LOAD.** "No backfill needed" is a claim
  about the save FORMAT; it says nothing about the round trip. `loadGame` merges
  `stats`, `date`, `settings` and `userProfile` key-by-key, and that merge used to
  iterate `initialGameState`'s keys — a whitelist, which by construction excludes
  every field a carve-out deliberately leaves out of `initialGameState`. The whole
  category was written to disk correctly and erased on the way back in, silently:
  `userProfile.avatar` (v39) showed the player a different face than the one they
  built, and `settings.lastNoFillGrantWeek` (v28) reopened the very restart-farm
  exploit it was added to close. The merge is now `utils/loadedStateMerge.ts` and
  keeps the saved object's own keys. After adding a field, load a save that has it
  and assert it is still there.
- When adding a repair, it **must set `repaired = true`**: the repaired clone is only
  written back onto the caller's object when that flag is set, so a backfill without
  it is computed and then silently discarded.
- A version bump with genuinely no structural change must still be **declared**,
  so a forgotten migration never looks identical to a deliberate one. There are
  two mechanisms and they are not interchangeable:
  - `NO_OP_MIGRATION_VERSIONS` — versions 2–9 only. They predate the v10
    "initial production release" baseline and never shipped a schema, so a save
    at one of them simply steps up to v10. Nothing new belongs in this set.
  - A **stub migration** (`N: (state) => { state.version = N; return state; }`)
    carrying a comment that says what the field is and why it needs no backfill.
    This is what every carve-out since v26 uses (15 of them today), and it is
    the form to copy: the registry entry proves the version was considered, and
    the comment is where the reasoning lives.
- **The inverse rule is now machine-checked.** `scripts/audit/audit-save.cjs`
  V11 walks `initialGameState`'s top-level fields and fails on any CONCRETE
  default with neither a migration nor a `repairGameState` mirror — the drift
  Hard Rule #3 describes, previously caught only by eye. The 57 legacy fields
  that predate this discipline are grandfathered in `LEGACY_PRE_MIGRATION_FIELDS`
  (they are not live bugs: the primary load path spreads `initialGameState`
  first). That set is a ratchet like the coverage floors — it may only shrink.
  **Never add a new field to it to get unstuck**; write the migration and the
  mirror.

---

## 8. Testing

- Jest + `ts-jest`, `testEnvironment: 'node'`, setup in `jest.setup.js` (large RN mock).
- Tests live in `__tests__/<domain>/`, `lib/**/__tests__/`, and co-located
  `*.test.ts`. Domains include: `save`, `stress`, `startup`, `economy`, `monetization`,
  `render`, `performance`, `e2e`, `integration`, `onboarding`, `prestige`, `dating`,
  `banking`, `ads`, `services`, `social`, `statistics`, `scenarios`, `refactor`.
- `maxWorkers` is capped at 2 in CI to avoid OOM/SIGTERM on the big suites.
- **Coverage is a RATCHET, not a threshold.** The old 70% `coverageThreshold`
  in `jest.config.js` was never met — actual is statements 48.9 / branches 30.5
  / functions 38.8 / lines 50.2 — so `test:coverage` and `test:ci` exited
  non-zero from the day it landed (2026-07-11). Nothing was blocked, since CI
  runs `npm test -- --ci` without coverage, and that is what made it corrosive:
  a gate that cannot pass trains you to skim the failure, which is how a real
  one gets missed.

  It was **not** lowered to match reality — green today, silent on tomorrow's
  regression, which is worse than a red gate because it lies. Enforcement is
  now `scripts/check-coverage.js`, which fails only on a **drop** below the
  floors in `scripts/lib/coverageRatchet.js`. 70 remains a documented goal
  (`COVERAGE_GOAL`), and the runner tells you when a metric reaches it so the
  floor can be raised to lock the win in.

  Same shape as `type-check:tests:ratchet`. **Raise the floors in the commit
  that earns the coverage; never lower them to get a build unstuck** — the
  accompanying suite asserts each floor sits within one point of the measured
  value, so a quiet slide is caught.
- Heap-growth assertions in `__tests__/stress` raise their budget under
  `--coverage`: istanbul's counters accumulate in the very heap being sampled,
  so the number stops measuring the code under test. The non-coverage budget —
  the one CI exercises — is unchanged.
- **Never mark work done without proof.** Run the relevant suite, show the output,
  and say plainly if something failed or was skipped. Verify a suspicious
  "failure" isn't a cold container (missing `node_modules`) before reporting it.
- Don't trust an audit/subagent claim that "file:line is broken" without re-reading
  the source — over-graded findings have burned time here before.

---

## 9. Releases / TestFlight

**Always bump the app version before cutting a new TestFlight/EAS build.**

- Edit `version` in `package.json` so every build shows a clearly newer number than
  the last one shipped to TestFlight.
- The displayed app version and iOS `CFBundleShortVersionString` are derived from
  `package.json` via `app.config.js` — that one field is the single source of truth.
- The iOS build number / Android `versionCode` come from the `BUILD_NUMBER` env var
  at EAS build time (`app.config.js`), not from a committed file, so no code change
  is needed. Note `eas build --local` never auto-increments — a duplicate
  `CFBundleVersion` is rejected at submit.
- The actual TestFlight/EAS build is triggered by the owner; the version bump is the
  part done in the repo beforehand.

### The App Store version and the binary version are DIFFERENT numbers — on purpose

The store product page shows the **App Store Connect version record** (1.3.5 live,
1.4.0 next). The binary reports `CFBundleShortVersionString` from `package.json`
(2.5.x). They have never matched, and every release since 1.2.7 shipped that way:
1.2.7 on a 2.2.7 binary, 1.3.1 on 2.5.0, 1.3.5 on 2.5.x.

**Do not "fix" the mismatch by raising the App Store Connect version to match the
binary.** Apple's validator does not compare the two — the only rule is that each
store version beats the last released one. But store version numbers can only ever
increase, so setting the record to 2.5.x is a one-way door that permanently abandons
the 1.x line.

- App Store Connect version record → what users see. Must beat the last release.
- `package.json` version → TestFlight, crash reports, in-app version display. Must
  keep climbing so builds stay distinguishable.

Cost of the split: support tickets and analytics report the 2.5.x number while the
store says 1.4.0. Known and accepted.

### Privacy manifest (iOS) — reads as metadata, rejects like a build break

`expo.ios.privacyManifests` in `app.config.js` is validated by Apple *after* upload,
so a mistake costs a full build + TestFlight processing round trip and parks the
version in **Invalid Binary**. `NSPrivacyTracking: true` with an absent or empty
`NSPrivacyTrackingDomains` is rejected as ITMS-91064 — an empty array is not a fix.
And domains listed there are blocked by iOS whenever ATT is denied, so listing
Google's ad domains silently zeroes out ad revenue. Tracking is declared by the
AdMob/Firebase SDK manifests instead; see the comment in `app.config.js`.
`scripts/preflight-check.js` §5b enforces this before a build starts.

### Purpose strings (iOS) — pass upload, fail review, take the IAPs down with them

Every `NS*UsageDescription` is scanned by App Review *after* the build is accepted,
so a weak one costs a full review cycle instead of failing at upload. It also returns
the whole submission: each attached IAP and subscription comes back marked "Rejected"
even though nothing is wrong with them — resubmit them with the next build.

The one purpose string this app ships is `NSUserTrackingUsageDescription`, written by
the `expo-tracking-transparency` plugin in `app.config.js`. Expo's documentation
boilerplate ("This identifier will be used to deliver personalized ads to you.") was
rejected as a placeholder: it names the resource but never says what the app does with
it — the same shape as Apple's own failing examples ("App needs microphone access").
A passing string needs both halves: the use, **and a concrete example of the result**.
`scripts/preflight-check.js` §5c fails the build on known boilerplate, strings under
60 characters, and strings with no verb of use; it reads both `ios.infoPlist` and the
plugin options that become purpose strings at prebuild time, so add a row to its
`PLUGIN_PURPOSE_OPTIONS` table whenever a plugin that writes one is installed.

### What preflight actually checks

`scripts/preflight-check.js` (11 numbered sections plus four lettered
sub-sections): 1 type-check · 2 lint (non-blocking) · 3 `entry.ts` syntax &
complexity · 4 Metro bundling · 5 native ad SDK config · 5b iOS privacy
manifest · 5c iOS purpose strings · 6 IAP native module · 7 startup safety
guardrails · 8 save signing · 8b IAP legacy entitlements flag · 9 IAP receipt
verification (production) · 9b analytics pipeline (production) · 10 AdMob ad
unit ids (production) · 11 shipped image payload.

### EAS profiles (`eas.json`)

`production` (ads/IAP/ATT/RevenueCat on, Boring Build off, `autoIncrement`) ·
`preview` (internal, devtools on) · `development` (dev client).
`cli.appVersionSource: "remote"` — and it must stay that way. The cloud workflow
(`eas-build.yml`) has no `BUILD_NUMBER` step and relies on remote +
`autoIncrement`; flipping it to `"local"` would bake app.config.js's `"99"`
fallback into every cloud build. The `--local` workflows are unaffected: they
mint their own number via `scripts/next-build-number.mjs` and app.config.js bakes
it, which TestFlight has accepted repeatedly. `tasks/lessons.md` (2026-06-11)
prescribes `"local"`; that half of the rule is stale and annotated in place.

The `version` input on both local-build workflows sets the **binary** version
(`package.json`). It is validated to be MAJOR.MINOR.PATCH **and not lower than
the current value** — typing the App Store Connect version record (the 1.x line)
there would silently downgrade the binary. See §9 for why the two numbers differ.

The check rejects only a *lower* version, not an equal one, and the two cases
mean different things. A **new release** must go **higher** — that is §9's "bump
it for every build" rule, and it is what keeps TestFlight and crash reports
orderable. **Re-running the same version is the deliberate exception**, for
rebuilding an unchanged marketing version after a failed submit or an infra
flake: `BUILD_NUMBER` is minted fresh per run, so the rebuild still carries a
unique `CFBundleVersion` / `versionCode` and the store accepts it. The guard
cannot tell the two apart from the input alone, so it enforces the floor and
leaves the bump to you.

---

## 10. CI / GitHub

Workflows in `.github/workflows/`: `eas-build.yml`, `eas-update.yml`,
`eas-build-local-ios.yml` (+ diagnostics variant), `eas-build-local-android.yml`,
`deploy-support-site.yml` — mostly `workflow_dispatch`. Corrupt YAML from unfinished
merges has broken these before: parse locally and confirm in the Actions tab after
touching them.

`.github/PULL_REQUEST_TEMPLATE.md` is a risk checklist — fill it in. Its high-risk
triggers: touching `app/` (run `__tests__/startup`), `app/_layout.tsx` / `entry.ts`
(verify via TestFlight), `contexts/game/` (run `__tests__/stress`), the save files
(run save tests), IAP/AdMob services, native deps, workflows, secret-bearing config,
or `React.lazy()`/`import()` in a screen.

---

## 11. Working Agreements

**Priority order — higher wins on conflict:** Correctness → Simplicity →
Root causes (no band-aids) → Elegance where warranted.

**Planning.** For any task with 3+ steps or an architectural decision, write a
checkable plan to `tasks/todo.md` before writing code and confirm it. If execution
diverges from the plan, stop and re-plan.

**Execution.** Tick items off in `tasks/todo.md` as you go; summarize what changed at
each step. Keep diffs small and focused — touch only what the task needs.

**Bug fixing.** Investigate and fix autonomously: read logs, trace the error, fix the
root cause. Fix failing CI without being told how.

**Learning.** Read `tasks/lessons.md` at the start of a session and append to it after
any correction — what went wrong, the pattern, the rule. It is the highest-value file
in the repo for avoiding repeat bugs; the recurring classes are summarized in §4.3–4.4.

**Before pushing:** check open PRs and rebase — concurrent audit PRs have already
fixed the "new" finding more than once.

---

## 12. Project Skills

Skills live in `.agents/skills/`:

| Skill | When to use |
|---|---|
| `preflight` | Before any release/TestFlight build — type-check, lint, unit + integration tests, `npm run preflight` |
| `test-suite [filter]` | Running tests — `unit`, `integration`, `e2e`, `performance`, `coverage`, or any Jest pattern |
| `eas-build [platform]` | Explicit user request only — triggers a cloud build (side effects) |
| `weekly-audit [domain]` | The standing weekly health check — Economy, Crash/Stability, Save/State, Game Logic, Week-Loop Performance. Automated layer `npm run audit:weekly` (static analyzers in `scripts/audit/`); deep layer is a guided qualitative pass. Run as a Claude Routine |

`.claude/settings.json` holds only `customInstructions` — there are currently **no
hooks, no `.claude/agents/`, and no `.claude/prompts/`** in this repo. Older
revisions of `DEV.md` / `WORKFLOW.md` described all three; those sections have been
replaced with review checklists.

---

## 13. Related Docs

| File | Contents |
|---|---|
| `README.md` | Feature overview, web preview viewports, cloud-save backend contract |
| `tasks/lessons.md` | Post-mortems and recurring bug patterns — read first |
| `tasks/social-systems-2026-09-03.md` | The social/relationship/family map, the persona measurements, and §4.8's evidence |
| `tasks/relationship-depth-2026-09-03.md` | What a bond is WORTH: the controlled cohort experiment, the ladder measurements, and §4.7's evidence |
| `tasks/todo.md` | Active plan |
| `tasks/*-audit-*.md` | Dated audit reports (incl. `weekly-audit-<date>.md`) |
| `docs/IAP-SETUP.md`, `docs/REVENUECAT-SETUP.md`, `docs/FIREBASE_ADMOB_SETUP.md` | Monetization setup |
| **`docs/RELEASE_RUNBOOK.md`** | **The step-by-step release procedure — follow it top to bottom** |
| `docs/LAUNCH_CHECKLIST.md`, `docs/LAUNCH_PLAN.md`, `docs/STORE_LISTING.md`, `docs/DATA_SAFETY.md` | Store/release reference |
| **`discord/README.md`** | **The Discord server as code. `npm run discord:validate` / `:plan` / `:sync`. Read before editing `discord/server.mjs` — channels are matched by NAME, so a rename needs `previousNames` or it reads as delete-and-recreate. Nothing writes without `--apply`, and nothing is ever deleted (`--prune` archives)** |
| **`docs/BETA-HUB.md`** | **The Android Beta Hub — tester recruitment, onboarding, feedback, bugs, ideas, marketing centre, admin dashboard. Read before touching `support-site/android/`** |
| `server/beta-hub/README.md` | The Beta Hub API — endpoints, the three auth tiers, and how to rotate the admin token |
| **`docs/LIVEOPS.md`** | **The Live Ops event system (`lib/liveops/`). The one rule: event WINDOWS are real UTC time, PROGRESS and REWARDS are game state — a clock scrub changes which shop window you see and can never manufacture progress or re-open a claim. Remote content can only ADD events or take them away: objectives are ids into a compiled-in registry, rewards are capped at validation time, one bad definition is dropped individually, and the ladder is remote → cache → compiled-in catalogue. Three economy protections (per-event caps, an idempotent claim ledger keyed on `eventId@<parsed startsAt>`, and a rolling weekly budget across all events). Read before authoring an event or touching `claim.ts`** |
| **`docs/ANALYTICS.md`** | **What the game measures and why: the event taxonomy (`lib/analytics/events.ts` is the one source of truth - the TS union and the runtime validation set are both derived from one array), the funnels, the retention cohorts, the experiment system (assignment is a hash so it needs no storage; persistence only PINS an in-flight arm against a weight change; exposure is tracked where the player meets the surface, never at assignment), the dashboards, the privacy review - and the "Limitations" section, which is the one to read before quoting a number** |
| `marketing/aso/` | Store metadata as data + `npm run check:aso`. `docs/store-screenshot-design.md` covers the screenshot system |
| `marketing/apple-ads/` | Apple Ads (App Store Ads) program — campaign structure, keyword + negative-keyword CSVs, CPP briefs, LTV→max-CPA model, optimization playbook. Start at its `README.md` |
| `docs/RELEASE_SECRETS.md`, `tasks/leaked-key-rotation-runbook.md` | Secret handling |
| `RELEASE_NOTES.md`, `WHATS_NEW.md` | Player-facing release copy |
| `SCREENSHOT_GUIDE.md`, `scripts/README_BUILD_SCRIPTS.md` | Asset/screenshot generation |
