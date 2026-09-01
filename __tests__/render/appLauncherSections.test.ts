/**
 * The launcher: one shared surface, sections not toggles, disclosure not walls.
 *
 * Three regressions this pins against `components/launcher/`:
 *
 * 1. THE TOGGLE STAYS DEAD. Buying a computer once moved Bank, Stocks, Pulse,
 *    Spark, Contacts and Pet behind a "Desktop Apps / Mobile Apps" segmented
 *    control defaulting to Desktop - a $5,000 purchase ADDED a tap to six apps.
 *    Both halves render as labelled sections in one scroll, phone first.
 *
 * 2. ONE CATALOG. computer.tsx and mobile.tsx each declared their own app
 *    list; the copies drifted (two different Bank gradients, the paw/pet id
 *    fork). Both screens are now thin wrappers around AppLauncher + the
 *    shared catalog.
 *
 * 3. NO WALL OF LOCKED CARDS. Locked apps used to sit inline dimmed to 0.45 -
 *    most of a new player's grid was unusable. They now fold into a
 *    "Locked (N)" row per section that expands on tap, keeping the teaching
 *    value (each locked tile shows its requirement) without the wall.
 */

import fs from 'fs';
import path from 'path';
import { APP_CATALOG } from '@/components/launcher/appCatalog';

const ROOT = path.join(__dirname, '../..');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const launcher = stripComments(
  fs.readFileSync(path.join(ROOT, 'components/launcher/AppLauncher.tsx'), 'utf8'),
);
const computerTab = stripComments(
  fs.readFileSync(path.join(ROOT, 'app/(tabs)/computer.tsx'), 'utf8'),
);
const mobileTab = stripComments(fs.readFileSync(path.join(ROOT, 'app/(tabs)/mobile.tsx'), 'utf8'));

describe('the category toggle is gone', () => {
  it('no segmented control and no category state to get stuck in', () => {
    for (const code of [launcher, computerTab, mobileTab]) {
      expect(code).not.toMatch(/SegmentedControl/);
      expect(code).not.toMatch(/'Desktop Apps'/);
      expect(code).not.toMatch(/appCategory/);
    }
  });

  it('renders labelled sections on the computer host, phone first', () => {
    expect(launcher).toMatch(/title: 'Phone'/);
    expect(launcher).toMatch(/title: 'Computer'/);
    expect(launcher.indexOf("title: 'Phone'")).toBeLessThan(launcher.indexOf("title: 'Computer'"));
  });

  it('an empty section does not render a bare heading', () => {
    expect(launcher).toMatch(/\.filter\(\(section\) => section\.apps\.length > 0\)/);
  });
});

describe('both screens consume the one launcher', () => {
  it.each([
    ['app/(tabs)/computer.tsx', computerTab, 'computer'],
    ['app/(tabs)/mobile.tsx', mobileTab, 'phone'],
  ])('%s is a thin wrapper with no catalog of its own', (_rel, code, host) => {
    expect(code).toMatch(new RegExp(`<AppLauncher\\s+host="${host}"`));
    // The duplicated-screen tells: a private app list, lookup map or gradient.
    expect(code).not.toMatch(/const appsList/);
    expect(code).not.toMatch(/const apps = \{/);
    expect(code).not.toMatch(/gradient/i);
  });
});

describe('the tiles are de-noised', () => {
  it('the catalog carries no gradients and no marketing descriptions', () => {
    for (const app of APP_CATALOG) {
      const entry = app as unknown as Record<string, unknown>;
      expect(`${app.id}:gradient=${'gradient' in entry}`).toBe(`${app.id}:gradient=false`);
      expect(`${app.id}:iconGradient=${'iconGradient' in entry}`).toBe(`${app.id}:iconGradient=false`);
      expect(`${app.id}:description=${'description' in entry}`).toBe(`${app.id}:description=false`);
    }
  });

  it('the launcher renders the real app icon, and no gradient elements', () => {
    expect(launcher).toMatch(/getAppIconAsset\(/);
    expect(launcher).not.toMatch(/<(?:Linear)?Gradient[\s/>]/);
  });

  it('keeps the lock + badge treatment on every card', () => {
    expect(launcher).toMatch(/locked: !isFeatureUnlocked\(gameState, `app:\$\{app\.id\}`\)/);
    expect(launcher).toMatch(/lockReason: unlockRequirement\(gameState, `app:\$\{app\.id\}`\)/);
    expect(launcher).toMatch(/appBadges\[app\.id\]/);
  });
});

describe('locked apps collapse instead of walling the grid', () => {
  it('unlocked apps render first, locked ones behind a disclosure row', () => {
    expect(launcher).toMatch(/section\.apps\.filter\(\(app\) => !app\.locked\)/);
    expect(launcher).toMatch(/Locked \(\{locked\.length\}\)/);
    expect(launcher).toMatch(/expanded && <View style=\{styles\.appsGrid\}>\{locked\.map\(renderTile\)\}/);
  });

  it('a locked tile still teaches - tap explains, requirement shown', () => {
    expect(launcher).toMatch(/gameAlert\(name, app\.lockReason \|\| 'Not available yet\.'\)/);
    expect(launcher).toMatch(/app\.locked && !!app\.lockReason/);
  });
});

describe('the phone launcher is unaffected', () => {
  it('still exists for players without a computer', () => {
    const appsTab = fs.readFileSync(path.join(ROOT, 'app/(tabs)/apps.tsx'), 'utf8');
    expect(appsTab).toMatch(/MobileScreenContent/);
    expect(appsTab).toMatch(/ownsComputer \?/);
  });
});
