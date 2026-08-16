/**
 * WP-F guard: actions that exist, are exported, are tested — and are called by
 * NOTHING. `tasks/lessons.md` records this as the repo's most repeated defect
 * shape ("a leaf with green tests, a context that exposes it, and nothing that
 * calls it"), and each instance below shipped a visibly broken feature:
 *
 *  - `bookmarkPost` had zero call sites while ProfileScreen's Bookmarks tab
 *    read `isBookmarked` — the tab could only ever say "No bookmarks yet".
 *  - `markHustleNotificationRead` / `clearHustleNotifications` had zero call
 *    sites while CompanyDetailScreen rendered `overlay.notifications` with an
 *    unread dot that nothing could ever clear.
 *  - IdentityCard's prestige badge was a TouchableOpacity whose `onPress` body
 *    was empty with a comment admitting it did nothing.
 *
 * A unit test on the action itself passes in all three cases, so the assertion
 * has to be about the CALL SITE. This scans real source.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

/** Every .ts/.tsx under these roots, minus tests. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(p);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(p);
      }
    }
  };
  for (const r of ['app', 'components', 'contexts', 'lib', 'hooks', 'utils', 'src']) {
    walk(path.join(root, r));
  }
  return out;
}

const FILES = sources();

/** Files that CALL `name(` outside its own definition file. */
function callers(name: string, definedIn: string): string[] {
  const defined = path.join(root, definedIn);
  const re = new RegExp(`\\b${name}\\s*\\(`);
  return FILES.filter((f) => f !== defined && re.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(root, f));
}

describe('exported actions have at least one production caller', () => {
  it.each([
    ['bookmarkPost', 'contexts/game/actions/PulseActions.ts'],
    ['markHustleNotificationRead', 'contexts/game/actions/HustleActions.ts'],
    ['clearHustleNotifications', 'contexts/game/actions/HustleActions.ts'],
  ])('%s is called from production code', (name, definedIn) => {
    const found = callers(name as string, definedIn as string);
    expect(found.length).toBeGreaterThan(0);
  });
});

describe('IdentityCard prestige badge is not a button that does nothing', () => {
  const src = read('components/IdentityCard.tsx');

  it('no empty onPress body survives in the card', () => {
    // `onPress={() => {` followed only by comments/whitespace before `}}`.
    const empty = /onPress=\{\(\)\s*=>\s*\{\s*(?:\/\/[^\n]*\n\s*)*\}\}/.test(src);
    expect(empty).toBe(false);
  });

  it('the badge opens the prestige shop through a wired handler', () => {
    expect(src).toContain('onOpenPrestigeShop');
    expect(read('app/(tabs)/home.tsx')).toContain('onOpenPrestigeShop={');
  });
});
