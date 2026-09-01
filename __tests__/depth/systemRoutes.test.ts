/**
 * The Discovery Center goes somewhere.
 *
 * It listed all 20 discoverable systems, their mastery and their unlock
 * requirements — as inert `View` cards. It showed the player the entire game
 * and gave them no way into any of it. Same shape as `getDynastyTier` with no
 * consumer, the legacy shop with no buy button, and the journal with no writer:
 * the work was done and the last connecting step was missing.
 *
 * The risk with a hand-written route table is that it rots silently — an app
 * id gets renamed, the entry still "exists", and the button drops the player on
 * an empty grid. So this checks every destination against the launcher's REAL
 * app map and the router's REAL tab list rather than against a copy.
 */

import fs from 'fs';
import path from 'path';
import { SYSTEM_ROUTES, routeForSystem } from '@/lib/depth/systemRoutes';
import { DISCOVERABLE_SYSTEMS } from '@/lib/depth/discoverySystem';

const ROOT = path.join(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * App ids the launcher can actually resolve. The per-screen `apps[activeApp]`
 * lookup maps were merged into the one shared catalog
 * (`components/launcher/appCatalog.ts`), so that is the source scanned.
 */
const launcherAppIds = (() => {
  const src = read('components/launcher/appCatalog.ts');
  return new Set([...src.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]));
})();

/** Routes the tab navigator actually registers. */
const tabRoutes = (() => {
  const src = read('app/(tabs)/_layout.tsx');
  return new Set([...src.matchAll(/name="([a-z]+)"/g)].map((m) => m[1]));
})();

describe('the route table is real', () => {
  it('the scans actually found something (the control)', () => {
    // A regex that silently matched nothing would make every assertion below
    // pass while checking nothing — the failure mode that produced a false
    // "everything is dead" report earlier in this audit.
    expect(launcherAppIds.size).toBeGreaterThan(10);
    expect(launcherAppIds.has('bank')).toBe(true);
    expect(tabRoutes.size).toBeGreaterThan(5);
    expect(tabRoutes.has('apps')).toBe(true);
  });

  it.each(Object.entries(SYSTEM_ROUTES))(
    '%s points at a route that exists',
    (_systemId, route) => {
      const tab = route.pathname.replace('/(tabs)/', '');
      expect(tabRoutes.has(tab)).toBe(true);
    }
  );

  it.each(Object.entries(SYSTEM_ROUTES).filter(([, r]) => r.appId))(
    '%s opens an app the launcher can resolve',
    (_systemId, route) => {
      // An unknown `?app=` id resets the launcher to the grid (the P2-15 guard),
      // so a typo here is a silent bounce, not a crash.
      expect(launcherAppIds.has(route.appId!)).toBe(true);
    }
  );

  it('only ever targets the launcher tabs with an appId', () => {
    for (const [id, route] of Object.entries(SYSTEM_ROUTES)) {
      if (!route.appId) continue;
      expect(`${id}:${route.pathname}`).toBe(`${id}:/(tabs)/apps`);
    }
  });

  it('every entry names a system that actually exists', () => {
    const unknown = Object.keys(SYSTEM_ROUTES).filter((id) => !(id in DISCOVERABLE_SYSTEMS));
    expect(unknown).toEqual([]);
  });

  it('every label is written for a player', () => {
    for (const [id, route] of Object.entries(SYSTEM_ROUTES)) {
      expect(`${id}:${route.label.startsWith('Open ')}`).toBe(`${id}:true`);
    }
  });
});

describe('coverage of the systems list', () => {
  it('most discoverable systems have a destination', () => {
    const total = Object.keys(DISCOVERABLE_SYSTEMS).length;
    const routed = Object.keys(DISCOVERABLE_SYSTEMS).filter((id) => routeForSystem(id)).length;
    expect(routed / total).toBeGreaterThan(0.75);
  });

  it('an unrouted system returns null rather than a wrong guess', () => {
    // Sending a player somewhere unrelated is worse than sending them nowhere,
    // so the UI renders a plain card when there is no single home.
    expect(routeForSystem('definitely-not-a-system')).toBeNull();
  });
});

describe('the Discovery Center uses it', () => {
  const code = read('components/depth/DiscoveryIndicator.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  it('navigates on tap', () => {
    expect(code).toMatch(/routeForSystem\(/);
    expect(code).toMatch(/router\.push\(/);
  });

  it('closes before navigating', () => {
    // Leaving the modal mounted over the destination strands the player behind
    // an overlay they must dismiss to see what they asked for.
    const fn = code.slice(code.indexOf('const goToSystem'), code.indexOf('router.push('));
    expect(fn).toMatch(/onClose\(\)/);
  });

  it('no longer truncates the locked list silently', () => {
    // It showed 10 and dropped the rest with no indication that more existed.
    expect(code).not.toMatch(/lockedSystems\.slice\(0, 10\)/);
  });

  it('a system with no destination stays a plain card', () => {
    expect(code).toMatch(/const Card = route \? TouchableOpacity : View;/);
  });
});
