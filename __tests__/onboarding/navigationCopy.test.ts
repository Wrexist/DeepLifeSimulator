/**
 * The app's own instructions must name navigation that exists.
 *
 * The tab bar is Home / Work / Apps / Life (`app/(tabs)/_layout.tsx`); Health,
 * Market, Computer, Mobile and Progression are all registered with `href: null`
 * and are reached THROUGH those four. But the help FAQ, the first-week guide and
 * the identity card still told players to "visit the Health tab", "the Mobile
 * tab", "the Hobbies tab" and so on — tabs removed in the merge.
 *
 * That is the purest form of the "confusing" complaint: a stuck player opens
 * Help and is sent somewhere that is not on screen. This test pins the fix so
 * the next nav change has to update the copy with it.
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.join(__dirname, '../..');

/**
 * Tab names that no longer exist in the tab bar.
 *
 * A denylist, not an allowlist of good names: plenty of copy legitimately refers
 * to sub-tabs INSIDE an app ("the Jobs tab of the Onion Browser", "the Miners
 * tab" of the mining app), and those are real, reachable UI. Only the top-level
 * tabs that were removed or hidden are wrong to name as tabs.
 */
const REMOVED_TABS = [
  'Health',
  'Market',
  'Mobile',
  'Computer',
  'Progression',
  'Hobbies',
  'Achievements',
  'Education',
  'Crypto Market',
];

/**
 * Player-facing copy surfaces. These are the files that TELL a player where to
 * go, so they are the ones that must stay truthful.
 */
const COPY_SURFACES = [
  'components/HelpModal.tsx',
  'components/FirstWeekGuide.tsx',
  'components/IdentityCard.tsx',
];

describe('player-facing copy only names tabs that exist', () => {
  it.each(COPY_SURFACES)('%s names no removed tab', (relPath) => {
    const source = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');

    const offenders = REMOVED_TABS.filter((name) =>
      // Case-insensitive on the trailing word so "Tab" and "tab" both count.
      new RegExp(`\\b${name} [Tt]ab\\b`).test(source)
    );

    // A non-empty array names the exact stale reference to rewrite: the target
    // is the real path, e.g. "Life → Health" or "Apps".
    expect(offenders).toEqual([]);
  });

  it('the real tab list matches the routes actually rendered as tab buttons', () => {
    // Guards the constant above: if a tab is added or hidden, this fails and
    // forces REAL_TABS (and therefore the copy) to be revisited.
    const layout = fs.readFileSync(
      path.join(REPO_ROOT, 'app/(tabs)/_layout.tsx'),
      'utf8'
    );

    // A route is a visible tab when it is declared and NOT given `href: null`
    // unconditionally. `home`, `work`, `apps` and `life` are conditional at
    // most (prison / device ownership); the rest are hard `href: null`.
    for (const hidden of ['mobile', 'computer', 'progression', 'market', 'health']) {
      expect(layout).toMatch(new RegExp(`name="${hidden}"`));
    }
    for (const visible of ['home', 'work', 'apps', 'life']) {
      expect(layout).toMatch(new RegExp(`name="${visible}"`));
    }

    // There are exactly five hard `href: null` entries - one per hidden route.
    const hardNulls = layout.match(/href: null,/g) ?? [];
    expect(hardNulls).toHaveLength(5);
  });
});
