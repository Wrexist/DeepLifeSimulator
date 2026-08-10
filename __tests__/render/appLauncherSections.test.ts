/**
 * Buying a computer must not COST the player taps.
 *
 * The Apps launcher had a segmented toggle — "Desktop Apps" / "Mobile Apps" —
 * defaulting to Desktop. Before a computer, the phone grid showed all six phone
 * apps directly. The moment a player spent $5,000 on a computer, Bank, Stocks,
 * Pulse, Spark, Contacts and Pet moved behind an extra tap, with no explanation
 * and no pointer. Two of those (Bank and Stocks) are among the most-used
 * surfaces in the game.
 *
 * So an upgrade made six things harder to reach and silently relocated them.
 * The player's only route back was to rediscover a toggle they had never
 * needed before.
 *
 * Both halves now render as labelled SECTIONS in one scroll. The phone/computer
 * distinction is worth keeping — it is how the fiction is organised — but it
 * costs nothing to read past, and nothing is hidden.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
/** Assert on CODE — the file's comments name the retired toggle on purpose. */
const code = fs
  .readFileSync(path.join(ROOT, 'app/(tabs)/computer.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

describe('the category toggle is gone', () => {
  it('no segmented control', () => {
    expect(code).not.toMatch(/SegmentedControl/);
    expect(code).not.toMatch(/'Desktop Apps'/);
    expect(code).not.toMatch(/'Mobile Apps'/);
  });

  it('no category state to get stuck in', () => {
    expect(code).not.toMatch(/appCategory/);
    expect(code).not.toMatch(/setAppCategory/);
  });

  it('the deep link no longer has to guess a category', () => {
    // It used to switch the grid behind an opened app so BACK landed somewhere
    // sensible. With one grid there is nothing to switch.
    const effect = code.slice(code.indexOf('if (!initialApp) return;'), code.indexOf('}, [initialApp'));
    expect(effect).toMatch(/setActiveApp\(initialApp\)/);
    expect(effect).not.toMatch(/MOBILE_APP_IDS/);
  });
});

describe('every app is on screen at once', () => {
  it('renders labelled sections rather than one category', () => {
    expect(code).toMatch(/const appSections = useMemo\(/);
    expect(code).toMatch(/title: 'Phone'/);
    expect(code).toMatch(/title: 'Computer'/);
  });

  it('both sections come from the real app lists', () => {
    expect(code).toMatch(/apps: decorate\(mobileApps\)/);
    expect(code).toMatch(/apps: decorate\(desktopApps\)/);
  });

  it('phone apps come first — they are the everyday ones', () => {
    expect(code.indexOf("title: 'Phone'")).toBeLessThan(code.indexOf("title: 'Computer'"));
  });

  it('an empty section does not render a bare heading', () => {
    expect(code).toMatch(/\.filter\(section => section\.apps\.length > 0\)/);
  });

  it('keeps the lock + badge treatment on every card', () => {
    // Progressive disclosure is deliberate: a locked app stays visible, dimmed,
    // with its requirement, rather than disappearing and reshuffling the grid.
    expect(code).toMatch(/locked: !isFeatureUnlocked\(gameState, `app:\$\{app\.id\}`\)/);
    expect(code).toMatch(/lockReason: unlockRequirement\(gameState, `app:\$\{app\.id\}`\)/);
    expect(code).toMatch(/appBadges\[app\.id\]/);
  });
});

describe('the phone launcher is unaffected', () => {
  it('still exists for players without a computer', () => {
    // `apps.tsx` picks the phone launcher when no computer is owned; only the
    // computer-owner path had the toggle.
    const appsTab = fs.readFileSync(path.join(ROOT, 'app/(tabs)/apps.tsx'), 'utf8');
    expect(appsTab).toMatch(/MobileScreenContent/);
    expect(appsTab).toMatch(/ownsComputer \?/);
  });
});
