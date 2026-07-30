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
- **Persistence:** AsyncStorage + CRC32-checksummed saves — `STATE_VERSION = 26`
- **Binary version:** `package.json` `version` (currently `2.5.12`) — see §9

Codebase size: ~350 files in `lib/`, ~245 components, ~330 test files.

---

## 2. Commands

| Command | What it does |
|---|---|
| `npm start` / `npm run ios` / `npm run android` / `npm run web` | Expo dev server / native run / web preview |
| `npm test` | Full Jest suite |
| `npm run test:unit` | `lib/` only |
| `npm run test:integration` | Save/load integration test |
| `npm run test:e2e` / `test:performance` | `__tests__/e2e` / `__tests__/performance` |
| `npm run test:coverage` / `test:ci` | Coverage (global threshold **70%** branches/functions/lines/statements) |
| `npm run type-check` | `tsc --noEmit` over `tsconfig.typecheck.json` (app source only, excludes tests/scripts) |
| `npm run type-check:tests` | `tsc --noEmit` over `tsconfig.tests.json` — **the test tree**, which `type-check` excludes. 186 errors outstanding; ratcheted by audit S6 so the count can only go down. A type error in a test is usually a test asserting on a field that does not exist, i.e. asserting nothing |
| `npm run lint` / `lint:errors` / `lint:fix` | ESLint (`lint:errors` = `--quiet`, used by preflight) |
| `npm run check:routes` | expo-router conflict guard (see §5) |
| `npm run preflight:quick` | routes + type-check — **run this during development** |
| `npm run preflight` | routes + full 10-section preflight + `lint:errors` — **required before any release build** |
| `npm run audit:weekly` | Static five-domain audit → `tasks/weekly-audit-<date>.md` |
| `npm run audit:economy` \| `:stability` \| `:save` \| `:logic` \| `:perf` | Individual audit modules |
| `npm run e2e` | Playwright (web) |

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
- **Subscribe narrowly.** Prefer the selector hooks in `contexts/game/index.ts`
  (`useGameStats`, `useGameMoney`, `useGameCareer`, `useGamePrestige`, …) or a
  domain action hook over the combined `useGame()`. Pulling
  `useGameState().setGameState` into a component re-subscribes it to the *entire*
  state — a documented perf regression (`tasks/lessons.md`, 2026-06-09).
- **Never mutate.** Always `setGameState(prev => ({ ...prev, … }))`.
- Values computed *inside* a `setGameState` updater are not visible outside it —
  don't assign to an outer variable from within the updater and read it after.
- Call `saveGame()` after state-changing actions.

### 4.2 Time: `week` vs `weeksLived`

- `gameState.week` cycles **1–4** (week-of-month) — **display only**.
- `gameState.weeksLived` is the absolute counter — **use it for every comparison,
  cooldown, timestamp and history entry**. Helpers: `utils/weekCounters.ts`
  (`resolveAbsoluteWeek`, `normalizeStoredWeekToAbsolute`).
- Mixing these up has shipped bugs more than once; it is the first thing to check
  in any review of time-based logic.

### 4.3 The weekly tick

`contexts/game/actions/weekly/` holds ~37 `apply*.ts` subsystems run from the week
loop. Two rules that recur in `tasks/lessons.md` five times over:

- **Every subsystem must run inside a try/catch.** A new `apply*` added outside the
  guarded block turns one subsystem's throw into a lost week for the whole save.
- Per-tick loops must not call unguarded helpers; a single bad entry must not
  abort the tick.

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
`saveMigrations.ts`, `saveQueue.ts`, `saveBackup.ts`, `saveCompression.ts`,
`saveLoadMutex.ts`, `saveSigningConfig.ts`, `saveSlotMeta.ts`,
`phantomSaveCleanup.ts`, `stateInvariants.ts`. See §7 for the schema rules.

### 4.6 Feature flags & native modules

- All optional systems are flagged in `lib/config/featureFlags.ts`, driven by
  `EXPO_PUBLIC_*` env vars. `BORING_BUILD_MODE` (default **on in `__DEV__`**)
  disables AdMob, IAP, analytics, notifications and ATT for a stable baseline.
- Native-SDK flags are **opt-in** (`=== 'true'`): `adMob`, `firebaseAnalytics`,
  `revenueCat`. Sentry `analytics` is hard-disabled (iOS 26 TurboModule crash).
  Production values are set per-profile in `eas.json`.
- Load native modules lazily via `require()` in a try/catch, never at module top level.

---

## 5. Conventions

- **Theme:** `useTheme()` or `getThemeColors(darkMode)` from `lib/config/theme.ts`
  (`colors`, `accent`, `spacing`, `typography`, `radii`, `shadows`, `animation`).
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
  - `as any` → warn app-wide, **error in `lib/travel/**`** (the first fully clean
    directory; add directories to that block as the burndown clears them).
  - `require('@/lib|utils|contexts…')` for internal modules → warn (degrades types
    to `any`/`never`); use static `import` or `import type` + a typed lazy getter.
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

- **Canonical `STATE_VERSION = 26`** — single source of truth in
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
- **v24 adds `luxuryHoldings`** — per-item luxury state, an additive SIDECAR keyed
  by the same ids as `luxuryItems`, which stays the ownership source of truth. Both
  the migration and `repairGameState` backfill a holding for every already-owned id.
- When adding a repair, it **must set `repaired = true`**: the repaired clone is only
  written back onto the caller's object when that flag is set, so a backfill without
  it is computed and then silently discarded.
- A version bump with genuinely no structural change must be listed in the
  intentional-no-op set in `saveMigrations.ts` — otherwise a forgotten migration
  looks identical to a deliberate one.

---

## 8. Testing

- Jest + `ts-jest`, `testEnvironment: 'node'`, setup in `jest.setup.js` (large RN mock).
- Tests live in `__tests__/<domain>/`, `lib/**/__tests__/`, and co-located
  `*.test.ts`. Domains include: `save`, `stress`, `startup`, `economy`, `monetization`,
  `render`, `performance`, `e2e`, `integration`, `onboarding`, `prestige`, `dating`,
  `banking`, `ads`, `services`, `social`, `statistics`, `scenarios`, `refactor`.
- `maxWorkers` is capped at 2 in CI to avoid OOM/SIGTERM on the big suites.
- Coverage threshold 70% across `lib/`, `components/`, `contexts/`, `hooks/`, `utils/`.
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

`scripts/preflight-check.js` (10 sections): 1 type-check · 2 lint (non-blocking) ·
3 `entry.ts` syntax & complexity · 4 Metro bundling · 5 native ad SDK config ·
5b iOS privacy manifest · 5c iOS purpose strings · 6 IAP native module ·
7 startup safety guardrails · 8 save signing · 8b IAP legacy entitlements flag ·
9 IAP receipt verification (production) · 10 AdMob ad unit ids (production).

### EAS profiles (`eas.json`)

`production` (ads/IAP/ATT/RevenueCat on, Boring Build off, `autoIncrement`) ·
`preview` (internal, devtools on) · `development` (dev client).
`cli.appVersionSource: "remote"`.

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
| `tasks/todo.md` | Active plan |
| `tasks/*-audit-*.md` | Dated audit reports (incl. `weekly-audit-<date>.md`) |
| `docs/IAP-SETUP.md`, `docs/REVENUECAT-SETUP.md`, `docs/FIREBASE_ADMOB_SETUP.md` | Monetization setup |
| `docs/LAUNCH_CHECKLIST.md`, `docs/LAUNCH_PLAN.md`, `docs/STORE_LISTING.md`, `docs/DATA_SAFETY.md` | Store/release |
| `docs/RELEASE_SECRETS.md`, `tasks/leaked-key-rotation-runbook.md` | Secret handling |
| `RELEASE_NOTES.md`, `WHATS_NEW.md` | Player-facing release copy |
| `SCREENSHOT_GUIDE.md`, `scripts/README_BUILD_SCRIPTS.md` | Asset/screenshot generation |
