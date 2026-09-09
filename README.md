# Deep Life Simulator

A mobile life simulation game built with Expo, React Native and TypeScript.
Players build careers, relationships, families, businesses and lives across generations.

## Start here

| I want to… | Read |
|---|---|
| See what is done and what is next | [Current work](tasks/todo.md) |
| Pick the next bounded implementation | [Master-prompt backlog](tasks/MASTER_PROMPT_BACKLOG.md) |
| Work safely in the codebase | [Project instructions](CLAUDE.md) and [lessons](tasks/lessons.md) |
| Find a system, document or runbook | [Documentation index](docs/README.md) |
| Prepare a release | [Release runbook](docs/RELEASE_RUNBOOK.md) |
| Prepare store screenshots | [Screenshot guide](SCREENSHOT_GUIDE.md) |
| Understand earlier decisions | [Task archive](tasks/archive/README.md) |

## Local development

```bash
npm ci
npm run web
```

Use the URL printed by Expo. Web is a preview target; native purchases, ads,
device lifecycle and accessibility require a native candidate.
Native configuration is documented in [CLAUDE.md](CLAUDE.md) and the release runbook.

```bash
npm run preflight:quick
npm run type-check:tests
npm test
```

Install the isolated [asset tooling](art/game-assets-v1/README.md) when running
checks that inspect its scripts. CI uses `npm ci --prefix art/game-assets-v1/source`.
Read the applicable test and release requirements before making changes.

## Repository map

| Directory | Purpose |
|---|---|
| `app/` | Expo Router screens and app startup |
| `components/`, `hooks/`, `src/` | Shared interface, hooks and feature helpers |
| `contexts/game/` | Game state, action providers and weekly orchestration |
| `lib/` | Domain logic and game content |
| `utils/`, `services/` | Persistence, platform services and integrations |
| `__tests__/`, `__mocks__/` | Behavior checks and test support |
| `scripts/`, `plugins/`, `android/` | Tooling, Expo plugins and native Android project |
| `assets/`, `art/` | Runtime assets and editable asset sources |
| `screenshots/`, `marketing/` | Store assets and growth materials |
| `support-site/`, `user-pages/`, `server/`, `discord/` | Support/community surfaces and service code |
| `docs/` | Current guides and reference indexes |
| `tasks/` | Current work, recent evidence and archived history |

## Release and service status

Read the binary version from [package.json](package.json), the save schema from
`contexts/game/initialState.ts`, and the current store/build records from their
providers. A version in an old report is not proof of a published build.

The active release work is tracked in [PR #203](https://github.com/Wrexist/DeepLifeSimulator/pull/203).
Its queue includes native/device/store gates that must not be closed by web tests.
Merging main can publish a production OTA. Support-site changes can deploy Pages.

Cloud backup is not a promise of automatic cross-device or reinstall recovery.
Read the [existing backend and identity contract](docs/CLOUD-SAVE-BACKEND.md)
before changing or describing it.
