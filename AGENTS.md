# DeepLife Simulator: working context

Build a polished, trustworthy iOS life game. Preserve the accepted navy UI,
compact HUD, clear first-job guidance and coherent game art. Improve observed
player problems; do not replace the app's architecture or visual direction just
because a generic skill prefers another stack.

Current save schema: `STATE_VERSION = 51`. Read `contexts/game/initialState.ts`
before changing it and update the canonical documentation together.

## Start each task

Read `CLAUDE.md` for game invariants and `tasks/todo.md` for current work. For a
release, also read `tasks/release/queue.json`, `tasks/release/CONTRACT.md` and the latest dated
evidence. Refresh Git status, current main and open PRs before relying on old
reports. Completed historical PRs are not outstanding work.

User instructions govern scope. Use only skills relevant to the actual task.
Record a short checkable plan for substantial work, then perform authorized
reversible work without an extra confirmation loop. An unavailable device or
provider blocks that acceptance case; continue independent work and record the
missing evidence. Never describe the game as perfect or release-ready from unit
tests alone.

## Protect the player

- Money, items, claims and purchase benefits must update atomically against the
  latest state; rejection must not charge or grant anything.
- Save/replay writes require the owning mutex. A timeout is a failure to acquire,
  never permission to write unlocked. Keep pending recovery durable.
- Use `weeksLived` for time and life-relative helpers for time since starting.
- Use the real weekly transition for economy/recap regressions. Distinguish cash,
  debt, transfers and asset value; do not test a second copy of the game formula.
- Read native package versions before applying external skill examples. This is
  Expo/React Native, not a SwiftUI, Flutter or Godot rewrite. SDK upgrades and new
  native libraries require their own compatibility and native validation scope.

## Work and verification

Install the lockfile with `npm ci` when dependencies change or are broken. The
asset tools have a separate install: `npm ci --prefix art/game-assets-v1/source`.
Use `.agents/skills/test-suite` for focused tests and `.agents/skills/preflight`
for release checks. Do not reduce floors, skip failing cases or add broad lint
exceptions to make a gate pass. Run the full suite after integrating high-risk
fixes, not once per trivial edit. Always record completion/exit status; interrupted
logs are not passes.

On Windows use PowerShell-native paths and file operations. Repository-relative
scanner identities use `/`; ESM absolute imports use `pathToFileURL`; launch JS
CLIs through `process.execPath` instead of assuming executable `npx` shims. Keep
scratch scripts in the existing local scratch directories and promote useful
reproductions to domain tests. Preserve user work and named stash backups.

## iOS acceptance and handoff

Check compact iPhone and iPad layouts, safe areas, keyboard, modal priority,
VoiceOver/Larger Text, reduced motion, slow/offline states, old-save upgrades and
background/kill/relaunch. Test purchases/restore, interrupted fulfillment and ads
on the exact signed build. Browser evidence is useful but is not StoreKit or
device evidence. Verify current App Store fields through a read-only plan first.

Main pushes publish production OTA; support changes can deploy Pages. Prepare a
reviewable branch/PR and inspect its latest checks. Do not infer authorization to
merge, publish OTA, dispatch a paid build, submit to Apple or send community
messages from an audit or polish request.

Finish with what changed, measured results, remaining release gates and the next
concrete task. Update `tasks/todo.md` and dated evidence so the next chat can
continue without reconstructing this conversation. Skill setup and provenance:
`docs/AGENT_SETUP.md`.
