/**
 * Every `?app=` id must resolve in the shared launcher catalog.
 *
 * History: the pet app was `paw` on the desktop grid and `pet` on the phone
 * grid, papered over with alias entries in three files (both launchers' lookup
 * maps and the badge layer). The launchers now read ONE catalog
 * (`components/launcher/appCatalog.ts`) with ONE canonical id per app - `pet`
 * won because analytics, the icon-asset map and the simulator already used it,
 * and no save persists a launcher app id, so the desktop-only `paw` spelling
 * had nothing stored under it.
 *
 * These assertions are the live trap for the next notification tap, badge tap
 * or CTA anyone adds: an id that is not in the catalog silently bounces the
 * player back to the grid (the P2-15 guard), a dead tap with no error.
 */

import fs from 'fs';
import path from 'path';
import { APP_CATALOG, appsForHost, resolveAppComponent } from '@/components/launcher/appCatalog';
import { SYSTEM_ROUTES } from '@/lib/depth/systemRoutes';

const REPO_ROOT = path.join(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

describe('sub-app deep-link ids', () => {
  it('the catalog is real (the control)', () => {
    expect(APP_CATALOG.length).toBeGreaterThan(15);
    const ids = APP_CATALOG.map((a) => a.id);
    expect(ids).toContain('tinder');
    expect(ids).toContain('bank');
  });

  it('every catalog id is unique - one spelling per app', () => {
    const ids = APP_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the pet app has exactly one id, and it is `pet`', () => {
    // The specific divergence this suite was written for. `paw` must not creep
    // back in as a second spelling.
    expect(APP_CATALOG.some((a) => a.id === 'pet')).toBe(true);
    expect(APP_CATALOG.some((a) => a.id === 'paw')).toBe(false);
  });

  it('the paw alias patches are gone from the launcher sources and badges', () => {
    for (const rel of [
      'components/launcher/appCatalog.ts',
      'components/launcher/AppLauncher.tsx',
      'lib/notifications/appBadges.ts',
    ]) {
      const code = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      expect(`${rel}:${/['"]paw['"]|counts\.paw|\bpaw:/.test(code)}`).toBe(`${rel}:false`);
    }
  });

  it('resolves every catalog id on the computer host', () => {
    // The desktop launcher shows everything, so everything must open there.
    const unresolvable = APP_CATALOG.filter((a) => !resolveAppComponent(a.id, 'computer'));
    expect(unresolvable.map((a) => a.id)).toEqual([]);
  });

  it('resolves every phone-visible id on the phone host', () => {
    const unresolvable = appsForHost('phone').filter((a) => !resolveAppComponent(a.id, 'phone'));
    expect(unresolvable.map((a) => a.id)).toEqual([]);
  });

  it('keeps every phone-launcher app openable on the computer too', () => {
    // A player who buys a computer must not lose access to an app they had.
    const computerIds = new Set(appsForHost('computer').map((a) => a.id));
    const missing = appsForHost('phone').filter((a) => !computerIds.has(a.id));
    expect(missing.map((a) => a.id)).toEqual([]);
  });

  it('an unknown id resolves to null, never undefined-render', () => {
    expect(resolveAppComponent('definitely-not-an-app', 'computer')).toBeNull();
    expect(resolveAppComponent('paw', 'phone')).toBeNull();
  });

  it('every system route appId still resolves in the catalog', () => {
    // The Discovery Center's buttons deep-link through `?app=`; a catalog
    // rename must break here, not on a player's tap.
    for (const [systemId, route] of Object.entries(SYSTEM_ROUTES)) {
      if (!route.appId) continue;
      expect(`${systemId}:${!!resolveAppComponent(route.appId, 'computer')}`).toBe(`${systemId}:true`);
    }
  });
});
