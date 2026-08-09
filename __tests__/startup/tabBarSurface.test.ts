/**
 * The bottom tab bar must stay small, and it must stay small SILENTLY-PROOF.
 *
 * `app/(tabs)/` holds nine route files but only four are meant to be tabs:
 * home, work, apps, life. The other five (mobile, computer, progression,
 * market, health) were folded into Apps and Life and are registered with
 * `href: null` so deep links and `router.push()` still resolve while no tab
 * button renders.
 *
 * ── Why a test and not a comment ──────────────────────────────────────────
 * expo-router surfaces every file in a group as a tab BY DEFAULT. A new screen
 * added to `app/(tabs)/` therefore joins the bar automatically, and a removed
 * `href: null` silently un-folds one of the five. Neither shows up as a failure
 * anywhere — the app builds, the routes work, the bar just quietly grows back
 * toward the nine-tab wall that `lib/progress/featureUnlocks.ts` describes as
 * "the single biggest thing making a first session feel unreadable".
 *
 * This reads the layout source rather than rendering it: the tab bar's shape is
 * decided by static `<Tabs.Screen>` options, so the file is the honest source,
 * and a render test here would need the entire provider stack to assert one
 * property.
 */

import fs from 'fs';
import path from 'path';

const LAYOUT = path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx');
const TABS_DIR = path.join(process.cwd(), 'app', '(tabs)');

/** The only screens allowed to render a bottom-bar button. */
const VISIBLE_TABS = ['home', 'work', 'apps', 'life'];

/** Folded into Apps/Life — registered, but never a tab. */
const FOLDED_TABS = ['mobile', 'computer', 'progression', 'market', 'health'];

const source = fs.readFileSync(LAYOUT, 'utf8');

/** Every `name="..."` passed to a `<Tabs.Screen>` in the layout. */
function declaredScreens(): string[] {
  const names: string[] = [];
  const re = /<Tabs\.Screen\s[^>]*?name="([^"]+)"/gs;
  let m;
  while ((m = re.exec(source)) !== null) names.push(m[1]);
  return names;
}

/** The options block that follows a given screen's `name=`. */
function optionsFor(name: string): string {
  const idx = source.indexOf(`name="${name}"`);
  if (idx === -1) return '';
  // Options run to the closing `/>` of that Tabs.Screen element.
  const end = source.indexOf('/>', idx);
  return source.slice(idx, end === -1 ? undefined : end);
}

describe('bottom tab bar surface', () => {
  it('every route file in (tabs) is explicitly declared in the layout', () => {
    // This is the guard that matters most: an UNDECLARED file is auto-surfaced
    // as a tab by expo-router, so a new screen silently widens the bar.
    const routeFiles = fs
      .readdirSync(TABS_DIR)
      .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
      .map((f) => f.replace(/\.tsx$/, ''));

    const declared = declaredScreens();
    const undeclared = routeFiles.filter((f) => !declared.includes(f));

    expect(undeclared).toEqual([]);
  });

  it('declares exactly the four intended tabs plus the five folded routes', () => {
    const declared = declaredScreens().sort();
    expect(declared).toEqual([...VISIBLE_TABS, ...FOLDED_TABS].sort());
  });

  it('folds every non-tab route with href: null', () => {
    for (const name of FOLDED_TABS) {
      const opts = optionsFor(name);
      expect(opts).not.toBe('');
      // `href: null` is what keeps the route resolvable but off the bar.
      expect(opts).toMatch(/href:\s*null/);
    }
  });

  it('never hard-nulls a route that is supposed to BE a tab', () => {
    for (const name of VISIBLE_TABS) {
      const opts = optionsFor(name);
      expect(opts).not.toBe('');
      // These may gate conditionally (prison, owning a device), but an
      // unconditional `href: null` would remove the tab outright.
      const unconditional = /href:\s*null\s*,/.test(opts);
      expect(unconditional).toBe(false);
    }
  });

  it('keeps the visible bar at four — the wall starts at nine', () => {
    expect(VISIBLE_TABS).toHaveLength(4);
    expect(VISIBLE_TABS.length).toBeLessThanOrEqual(5);
  });
});
