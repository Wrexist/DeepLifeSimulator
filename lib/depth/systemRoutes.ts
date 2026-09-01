/**
 * Where each discoverable system actually LIVES.
 *
 * ## Why this exists
 *
 * The Discovery Center lists all 20 systems, their mastery, and the
 * requirements to unlock the locked ones — and every entry is an inert `View`.
 * It shows the player the whole game and takes them nowhere. That is the same
 * shape as the bugs this audit keeps finding (`getDynastyTier` with no
 * consumer, the legacy shop with no buy button, the journal with no writer):
 * the work is done, the last connecting step is missing.
 *
 * This is that step. A system id maps to a real destination, so the directory
 * becomes navigation instead of a poster.
 *
 * ## Ids are checked against reality, not assumed
 *
 * The launcher's app ids are their own vocabulary and do not match the
 * discovery ids (`realEstate` vs `realestate`, `company` vs the Hustle app,
 * `darkWeb` vs `onion`). `__tests__/depth/systemRoutes.test.ts` asserts every
 * destination resolves against the launcher's real app map and the router's
 * real tab list, so a rename breaks the test rather than silently sending the
 * player back to an empty grid.
 *
 * The pet app is deliberately reachable as both `paw` and `pet` — the two
 * launchers disagree and both ids are accepted, which is why neither appears
 * here as a bare guess.
 */

/** An expo-router destination: a tab, optionally opening one app inside it. */
export interface SystemRoute {
  /** Route path, e.g. `/(tabs)/apps`. */
  pathname: string;
  /** `?app=<id>` for the two launcher screens. Omitted for plain tabs. */
  appId?: string;
  /** `?segment=<id>` for the Life shell's deep links. Omitted for plain tabs. */
  segment?: string;
  /** What the button says. Written for a player, not a developer. */
  label: string;
}

const APPS = '/(tabs)/apps';

/**
 * Discovery id → destination.
 *
 * Deliberately NOT exhaustive-by-type: a system with no sensible single
 * destination (or one that is a concept rather than a place) is simply absent,
 * and the UI falls back to showing no button rather than a wrong one. Sending a
 * player somewhere unrelated is worse than sending them nowhere.
 */
export const SYSTEM_ROUTES: Readonly<Record<string, SystemRoute>> = {
  career: { pathname: '/(tabs)/work', label: 'Open Work' },
  health: { pathname: '/(tabs)/life', segment: 'health', label: 'Open Health' },
  items: { pathname: '/(tabs)/life', segment: 'shop', label: 'Open Market' },
  hobbies: { pathname: '/(tabs)/life', label: 'Open Life' },
  relationships: { pathname: '/(tabs)/life', label: 'Open Life' },
  streetJobs: { pathname: '/(tabs)/work', label: 'Open Work' },

  education: { pathname: APPS, appId: 'education', label: 'Open Education' },
  bank: { pathname: APPS, appId: 'bank', label: 'Open Bank' },
  travel: { pathname: APPS, appId: 'travel', label: 'Open Travel' },
  realEstate: { pathname: APPS, appId: 'realestate', label: 'Open Real Estate' },
  stocks: { pathname: APPS, appId: 'stocks', label: 'Open Stocks' },
  company: { pathname: APPS, appId: 'company', label: 'Open Hustle' },
  politics: { pathname: APPS, appId: 'political', label: 'Open Politics' },
  socialMedia: { pathname: APPS, appId: 'social', label: 'Open Pulse' },
  darkWeb: { pathname: APPS, appId: 'onion', label: 'Open Onion Browser' },
  gamingStreaming: { pathname: APPS, appId: 'streaming', label: 'Open Streaming' },

  prestige: { pathname: '/(tabs)/life', segment: 'stats', label: 'Open Progress' },
  dynasty: { pathname: '/(tabs)/life', segment: 'stats', label: 'Open Progress' },
  legacy: { pathname: '/(tabs)/life', segment: 'stats', label: 'Open Progress' },
};

/** The destination for a system, or null when it has no single home. */
export function routeForSystem(systemId: string): SystemRoute | null {
  return SYSTEM_ROUTES[systemId] ?? null;
}
