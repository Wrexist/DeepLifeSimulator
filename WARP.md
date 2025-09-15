# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: DeeplifeSim — an Expo (React Native + TypeScript) life simulation game using expo-router, Jest, and AsyncStorage-based save slots with optional cloud sync.

Commands you’ll commonly use

- Install dependencies
  ```bash path=null start=null
  npm install
  ```

- Start the app
  - Metro dev server (choose platform in the Expo UI)
    ```bash path=null start=null
    npm run start
    ```
  - Web (with the in-repo preview page)
    ```bash path=null start=null
    npm run web
    ```
  - Android emulator
    ```bash path=null start=null
    npm run android
    ```
  - iOS simulator (macOS only)
    ```bash path=null start=null
    npm run ios
    ```

- Lint and TypeScript checks
  ```bash path=null start=null
  npm run lint
  npm run lint:fix
  npm run type-check
  ```

- Tests (Jest)
  - Run all tests
    ```bash path=null start=null
    npm test
    ```
  - Watch mode / coverage / CI
    ```bash path=null start=null
    npm run test:watch
    npm run test:coverage
    npm run test:ci
    ```
  - By suite (as defined in scripts)
    ```bash path=null start=null
    npm run test:unit
    npm run test:integration
    npm run test:e2e
    npm run test:performance
    ```
  - Run a single test file
    ```bash path=null start=null
    npm test -- lib/economy/__tests__/inflation.test.ts
    ```
  - Run a single test by name
    ```bash path=null start=null
    npm test -- --testNamePattern="should save and load game state successfully"
    ```

- Optional: End-to-end via Playwright
  A Playwright script exists (e2e, e2e:install), but the repo’s primary E2E suite runs under Jest in __tests__/e2e. Prefer the Jest E2E scripts above.
  ```bash path=null start=null
  npm run test:e2e    # Jest E2E in __tests__/e2e
  # If you do use Playwright locally:
  npm run e2e:install
  npm run e2e
  ```

Web preview (from README)

- After starting web with npm run web, open the preview page at:
  - http://localhost:19006/preview (or the port shown by Expo)
- Device presets are built-in; you can also set a custom viewport via URL params, e.g.:
  - http://localhost:19006/preview?w=393&h=852
- Presets persist via localStorage and there’s a Reset button in the UI.

Environment configuration (Cloud Save)

- To enable cloud saves and leaderboards, set EXPO_PUBLIC_CLOUD_SAVE_URL to your backend base URL.
  - The game will POST to /save and GET /save for cloud sync, and POST/GET /leaderboard/:category for scores.
  - If EXPO_PUBLIC_CLOUD_SAVE_URL is not set, cloud features are no-ops.

Architecture overview (big picture)

- Navigation & UI (app/ via expo-router)
  - Route groups organize flows:
    - (onboarding): Stack for MainMenu, SaveSlots, Scenarios, Customize, Perks
    - (tabs): Main app tabs (home, work, market, health, mobile, computer) with dynamic visibility:
      - Tabs like mobile and computer are hidden until the player owns the corresponding item (smartphone/computer)
  - A web-only preview page exists at app/preview.tsx to aid responsive testing.

- Core game state and orchestrator (contexts/GameContext.tsx)
  - GameProvider supplies the entire game state (GameState) and all game actions to the UI.
  - Key responsibilities:
    - nextWeek(): advances time and orchestrates the weekly simulation
      - Simulates market prices
      - Computes passive income (calcWeeklyPassiveIncome) and adds other earnings (e.g., gaming/streaming, sponsors)
      - Applies lifestyle stat drift and inflation (applyWeeklyInflation)
      - Rolls random events (rollWeeklyEvents) and handles jail/status effects
      - Tracks zero-stat weeks and can trigger character death flow
      - Schedules notifications and daily gift logic
      - Persists state (autosave)
    - Persistence
      - Local: AsyncStorage save slots save_slot_{n} with lastSlot pointer; debounced autosave via a queued writer (utils/saveQueue.ts) and a force-save fallback
      - Cloud: Optional sync via lib/progress/cloud.ts when EXPO_PUBLIC_CLOUD_SAVE_URL is set
    - Achievements & progress
      - Evaluate immediate “progress” achievements and display toasts; also tracks long-term achievements via lib/progress/achievements.ts
    - Integrations
      - Notifications (daily reminders and daily gifts)
      - Company and social logic are delegated to extracted modules (contexts/game/company.ts, contexts/game/social.ts)
    - Quality & safety
      - Sanitizes critical numeric fields on load, versioned state migrations, and guarded UI updates

- Domain modules (lib/*)
  - Economy (lib/economy)
    - passiveIncome.ts: calculates weekly passive income across stocks, real estate, music/art, sponsors
    - inflation.ts: applies weekly inflation and price index adjustments
    - stockMarket.ts: simple stochastic weekly price simulation and helpers
  - Events (lib/events)
    - engine.ts: a weighted/event-conditional templating system; rollWeeklyEvents picks up to N events based on category risks and state
  - Progress (lib/progress)
    - achievements.ts: net worth and career/health/relationship achievements; helper netWorth()
    - cloud.ts: upload/download cloud save and leaderboard entries; no-ops if env var is missing

- Persistence & caching
  - utils/saveQueue.ts: de-duplicates and sequences AsyncStorage writes with retry and a forceSave path
  - utils/cacheManager.ts: version-based cache clearing and category-specific cache operations; called on startup

- Testing setup (see TESTING_GUIDE.md and jest.config.js)
  - Jest + ts-jest; test paths include lib/**/__tests__ and __tests__/**
  - Coverage thresholds (global): 70% branches/functions/lines/statements
  - jest.setup.js provides RN/Expo mocks, performance API shims, AsyncStorage mocks, and a createTestGameState helper
  - E2E and performance suites run under Jest in __tests__/e2e and __tests__/performance

- TypeScript & build tooling
  - tsconfig.json: strict mode; path alias @/* -> project root
  - babel.config.js: uses babel-preset-expo and react-native-reanimated/plugin
  - eslint.config.js: eslint-config-expo (flat) with dist/ ignored

Notes and references in repo

- README.md: Web preview usage and recent feature highlights
- TESTING_GUIDE.md: Strategy, structure, commands, and coverage targets (70%)
- Additional design/implementation docs: e.g., PERFORMANCE_OPTIMIZATION.md, TRANSLATION_GUIDE.md, UI_UX_IMPROVEMENTS_GUIDE.md, IAP_ADMOB_SETUP_GUIDE.md — consult as needed for those areas

Behavioral rules for this project (for Warp)

- Prefer running tests and type checks before proposing code changes to core simulation (GameContext) or domain modules; these areas have broad impact
- When modifying persistence or migration logic, ensure both local slots (AsyncStorage) and optional cloud sync remain consistent
- Respect typed route structure and dynamic tab visibility; UI entry points depend on game state
