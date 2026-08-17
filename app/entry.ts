/**
 * Minimal entry point that loads Expo Router (CLAUDE.md Hard Rule #1 —
 * "entry.ts stays dumb"). All initialization logic lives in app/_layout.tsx.
 *
 * This file is `package.json` `main`, so it is the module Metro evaluates first,
 * and nothing imports it. The default export below is NOT for that role —
 * `expo-router/entry` needs nothing from this module.
 *
 * It exists because this file also sits inside `app/`, which expo-router scans
 * with `require.context`. `node_modules/expo-router/_ctx.ios.js` matches
 * `/^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.android|\.web)?\.[tj]sx?$/`
 * — the negative lookahead excludes only `+api` / `+html` / `+middleware`, so
 * `./entry.ts` IS collected as a route. `getRoutesCore.js` then does
 * `const route = routeItem?.default; if (route == null) { console.warn('Route
 * "…" is missing the required default export…'); continue; }` — a warning on
 * every dev boot, and the node dropped from the tree.
 *
 * So: the export satisfies the ROUTE COLLECTOR, not the main-entry contract. A
 * component returning null is the whole requirement — keep it that way.
 * (An earlier comment here claimed "Expo Router requires a default export" with
 * no reason; it was removed as false, then restored with the real one. 2026-08-16.)
 */
import 'expo-router/entry';

/**
 * Satisfies expo-router's route collector. Always returns null.
 */
export default function Entry(): null {
  return null;
}
