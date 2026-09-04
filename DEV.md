# CLAUDE.md — DeepLife Simulator

> **This file is a mirror.** The canonical, up-to-date project context lives in
> [`CLAUDE.md`](CLAUDE.md) at the repo root — it covers everything below plus the
> repo map, commands, testing, save-format rules and release/App Store gotchas.
> Where the two disagree, `CLAUDE.md` wins. Kept here for tools that read `DEV.md`.

## Project Overview

- **Stack:** React Native 0.81.5 / Expo SDK 54 / React 19.1.0
- **Platforms:** iOS (App Store) + Android (Google Play)
- **Build system:** EAS Build — bundle ID: `com.deeplife.simulator`
- **Save format:** AsyncStorage + CRC32 checksums — `STATE_VERSION = 51` (canonical in `contexts/game/initialState.ts`)

---

## Core Principles

Priority order — when they conflict, higher wins:

1. **Correctness** — Never ship something broken. Prove it works before marking done.
2. **Simplicity** — Make changes as small and focused as possible. Touch only what is necessary.
3. **Root Causes** — No band-aids. Find and fix the actual problem, not symptoms.
4. **Elegance (when warranted)** — For non-trivial changes, ask: "Is there a cleaner way?" Skip for obvious fixes.

---

## Architecture

### State Management

- GameState managed via deeply nested React Context providers (8 levels)
- `gameState.week` cycles 1–4 (week-of-month) — **UI display only**
- `gameState.weeksLived` is the absolute week counter — **use for ALL time comparisons**
- Never mutate state directly — always use `setGameState(prev => ({ ...prev, ... }))`
- Always call `saveGame()` after state-changing actions

### Critical File Map

| Area                  | File                                       |
|-----------------------|--------------------------------------------|
| Core game loop        | `contexts/game/GameActionsContext.tsx`      |
| State types (canonical)| `contexts/game/types.ts`                  |
| Initial state         | `contexts/game/initialState.ts`            |
| Action functions      | `contexts/game/actions/*.ts`               |
| Save validation       | `utils/saveValidation.ts`                  |
| Feature flags         | `lib/config/featureFlags.ts`               |
| Theme tokens          | `lib/config/theme.ts`                      |
| App config            | `app.config.js`                            |
| IAP service           | `services/IAPService.ts`                   |
| AdMob service         | `services/AdMobService.ts`                 |

### Conventions

- **Feature flags:** centralized in `lib/config/featureFlags.ts`, env-var driven
- **AdMob:** opt-in only (`EXPO_PUBLIC_ENABLE_ADMOB=true`), lazy-loaded, circuit breaker
- **Native modules:** always lazy-load via `require()` in try/catch
- **Z-index layers:** `utils/zIndexConstants.ts` (CONTENT=1 → DROPDOWN=100 → TOOLTIP=200 → MODAL=300 → TOAST=400 → LOADING=500 → DEBUG=999)
- **Theme:** `useTheme()` hook or `getThemeColors(darkMode)` from `lib/config/theme.ts`
- **Glassmorphism:** helpers in `utils/glassmorphismStyles.ts` accept `darkMode` param
- **Scaling:** always use `scale()`, `fontScale()` from `utils/scaling.ts`
- **Borders:** no side accent bars / one-sided colored borders — use a full border (`borderWidth` + `borderColor`) instead. See Hard Rule 7

---

## Hard Rules

### 1. `entry.ts` Stays Dumb
- `app/entry.ts` handles **only** app initialization
- No business logic imports from `@/lib`, `@/contexts`, `@/components`
- No complex functions (>5), keep under 200 lines
- Need logic? Put it in `app/_layout.tsx` instead

### 2. No Unions Without Guards
- All union type property access **must** use: `'property' in object && object.property`
- No direct property access on unions, no `as any` casts
- Reference: `lib/types/requirements.ts`

### 3. No GameState Drift
- Tests **must** use `createTestGameState()` from `__tests__/helpers/createTestGameState.ts`
- No manual GameState construction, no `as GameState` assertions

### 4. Native Module Config Alignment
- **Never** remove a config plugin from `app.config.js` if the package is in `package.json`
- Native SDK init runs before JS — no JS try/catch can prevent crashes from missing config

### 5. DatingActions Signature Trap
- `DatingActions` functions expect: `updateMoney(setGameState, amount, reason)` from `./actions/MoneyActions`
- **Not** the hook version `useMoneyActions()` which has signature `(amount, reason)`

### 6. Preflight Before Release
- Run `npm run preflight` before any release build
- Do not skip checks, do not use `--force` flags

### 7. NEVER: side accent bars / one-sided borders on cards
- **Do NOT** use a colored one-sided border as a decorative accent stripe
  (`borderLeftWidth` / `borderRightWidth` / `borderTopWidth` / `borderBottomWidth`
  paired with a `border*Color`). The side accent-bar / "stripe" callout look is
  **banned app-wide** — the product owner explicitly rejected it.
  - It also renders a crescent/parenthesis `(` artifact when combined with
    `borderRadius` (RN curls the one-sided border around the rounded corner).
- **Instead:** use a **plain full border** — `borderWidth: 1` + `borderColor: <color>`
  (all four sides) with a normal `borderRadius`. Keep the color for meaning
  (green=success, amber=warning, red=danger, blue=info); just no stripe.
- Also fine: a tinted `backgroundColor` with no border at all.
- **Allowed exceptions (structural selection/separation, NOT decorative accents):**
  a row/section divider (`borderBottomColor`/`borderTopColor` on a `View`), an
  **active-tab underline** (`borderBottomColor: accent.x` + `borderBottomWidth: 2` on
  the selected tab), a hairline thread-indent guide line, or a continuous hairline
  border wrapping a bottom-sheet's rounded top. These convey structure/selection —
  they are not a colored accent stripe on a card.
- Applies to every surface — mobile apps, desktop apps, popups, tooltips, the crash
  screen. If you catch yourself adding `borderLeftColor`/`borderTopColor` etc. as an
  accent, convert it to a full border.

---

## Protected Files

Modify these only with extra care and review:

- `app/entry.ts` — Must stay simple
- `contexts/game/types.ts` — GameState is the canonical source of truth
- `__tests__/helpers/createTestGameState.ts` — Test factory for all test suites
- `lib/types/requirements.ts` — Requirement type definitions
- `app.config.js` — Config plugin alignment with `package.json` is critical

---

## Workflow

### Planning
- Enter plan mode for any task with 3+ steps or architectural decisions
- Write a plan to `tasks/todo.md` with checkable items before writing code
- Confirm the plan before starting implementation
- If execution diverges from the plan, **stop and re-plan**

### Execution
- Mark items complete in `tasks/todo.md` as you go
- Provide a high-level summary of what changed at each step
- Challenge your own work: "Is this the solution I'd write if I started over?"

### Subagents
- Use subagents to keep the main context window clean
- Good uses: research, exploration, parallel analysis, isolated subtasks
- One focused task per subagent — don't use for trivial lookups
- **Use the project subagents below** for specialized review tasks

### Verification
- **Never mark a task complete without proving it works**
- Run tests (`npm test`), check logs, demonstrate correctness
- Run `npm run preflight:quick` (type check) during development
- Diff behavior between main and your changes when relevant

### Bug Fixing
- Investigate and fix autonomously — minimize context switching for the user
- Read logs, trace errors, find the root cause, then resolve
- Fix failing CI without being told how

### Learning
- After any correction: update `tasks/lessons.md` with what went wrong, the pattern, and the rule
- Review `tasks/lessons.md` at the start of each session

---

## Project Skills

Custom slash commands for this project. **Use these proactively:**

| Command | When to Use |
|---------|-------------|
| `/preflight` | Before any release or TestFlight build — runs type-check, lint, and tests |
| `/test-suite [filter]` | When running tests — supports `unit`, `integration`, `e2e`, `coverage`, or any Jest pattern |
| `/eas-build [platform]` | When the user asks to build — triggers EAS cloud builds for iOS/Android |
| `/weekly-audit [domain]` | The standing weekly health check — Economy, Crash/Stability, Save/State, Game Logic, Week-Loop Performance. Run weekly as a **Claude Routine** (Code → Routines → Schedule). Automated layer: `npm run audit:weekly` (static); deep layer: guided qualitative pass + project subagents |

**Also use these installed plugin skills:**
| Command | When to Use |
|---------|-------------|
| `/commit` | When committing changes |
| `/simplify` | After writing code — review for quality and reuse |
| `/review-pr` | When reviewing pull requests |
| `/feature-dev` | When planning and building new features |

---

## Review focus areas

There are no committed reviewer subagent definitions, prompt templates, or hooks in
this repo — `.claude/settings.json` holds only `customInstructions`, and
`.claude/agents/` / `.claude/prompts/` do not exist. Use these as review checklists:

| After a change to | Check for |
|---|---|
| `contexts/`, action modules, state logic | direct mutation, the `week` vs `weeksLived` trap, non-atomic gate → grant grants, `DatingActions` signature mismatches |
| `types.ts`, `initialState.ts`, `saveValidation.ts`, `saveMigrations.ts` | schema drift (new field without a version bump), migration ↔ `repairGameState` parity, `repaired = true` on every backfill |
| `contexts/game/actions/weekly/` | every `apply*` subsystem inside the try/catch; no unguarded helper in a per-tick loop |

The standing five-domain health check is the `weekly-audit` skill in
`.agents/skills/` (`npm run audit:weekly` for the automated layer).
