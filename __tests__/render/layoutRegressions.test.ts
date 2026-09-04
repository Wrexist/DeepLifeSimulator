/**
 * Four layout/consistency defects reported from TestFlight screenshots on
 * 2026-09-04. Each is pinned here because each was invisible to the type
 * checker and to every existing suite — they are style objects, a dependency
 * array and a lookup table, all of which compile perfectly while being wrong.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * Bank Pro rendered its five tabs floating in the middle of an empty box half
 * the viewport high.
 *
 * React Native's ScrollView carries `flexGrow: 1, flexShrink: 1` in its own
 * base style. `SegmentedControl`'s `scrollable` branch returns a HORIZONTAL
 * ScrollView, so as a direct child of a screen's flex column it claimed a share
 * of the leftover vertical space. The non-scrollable branch is a plain View and
 * was never affected — which is why only the two `scrollable` callers showed it.
 */
describe('a horizontal segmented control does not swallow the screen', () => {
  const src = read('components/ui/SegmentedControl.tsx');

  it('pins the scrollable control to its content height', () => {
    expect(src).toMatch(/scrollSelf:\s*\{[^}]*flexGrow:\s*0/);
    expect(src).toMatch(/scrollSelf:\s*\{[^}]*flexShrink:\s*0/);
  });

  it('applies it on the scrollable branch', () => {
    const scrollBranch = src.slice(src.indexOf('if (scrollable)'), src.indexOf('const styles'));
    expect(scrollBranch).toContain('styles.scrollSelf');
  });

  /**
   * `flex: 0` is not portable. Yoga expands it to `flexBasis: auto`; React
   * Native Web expands it to `flex: 0 1 0%` - basis ZERO - so the slot computes
   * to 0px wide and every label collapses to its icon. Measured on the web
   * export: slot width 0, label width 28. The bank's tabs were unreadable on
   * web while looking correct on device.
   */
  it('sizes scrollable segments in longhand, so both platforms agree', () => {
    for (const style of ['slotScroll', 'tabScroll']) {
      const block = src.slice(src.indexOf(`${style}: {`), src.indexOf('},', src.indexOf(`${style}: {`)));
      expect(block).toMatch(/flexBasis:\s*'auto'/);
      expect(block).toMatch(/flexGrow:\s*0/);
      expect(block).not.toMatch(/flex:\s*0\s*,/);
    }
  });

  it('still lets a caller override it', () => {
    // `style` must come after `scrollSelf` in the array, or a caller that
    // genuinely wants a taller control cannot have one.
    const m = src.match(/style=\{\[styles\.container[^\]]*\]\}/);
    expect(m).not.toBeNull();
    const arr = m![0];
    expect(arr.indexOf('styles.scrollSelf')).toBeLessThan(arr.lastIndexOf('style]'));
  });
});

/**
 * The market card advertised the catalogue restores while satiety (v48) paid a
 * fraction of them: past the third meal of a week Instant Ramen showed
 * "+4 Health / +8 Energy" and delivered +1/+2. The toast and the section hint
 * were routed through the satiety helpers when v48 landed; this card was
 * missed — so the one surface a player reads BEFORE spending was the one still
 * quoting pre-satiety numbers.
 */
describe('the food card advertises what it pays', () => {
  const src = read('app/(tabs)/market.tsx');

  it('scales the chips through the same helper the charge uses', () => {
    expect(src).toContain('scaledFoodRestore');
    const chips = src.slice(src.indexOf('const renderFood'), src.indexOf('const rentalOptions'));
    expect(chips).toMatch(/\{ key: 'health', value: preview\.health \}/);
    expect(chips).toMatch(/\{ key: 'energy', value: preview\.energy \}/);
    expect(chips).toMatch(/\{ key: 'happiness', value: preview\.happiness \}/);
  });

  it('does not hand the raw catalogue numbers to the chips', () => {
    const chips = src.slice(src.indexOf('const renderFood'), src.indexOf('const rentalOptions'));
    expect(chips).not.toMatch(/\{ key: 'health', value: food\.healthRestore \}/);
    expect(chips).not.toMatch(/\{ key: 'energy', value: food\.energyRestore \}/);
  });

  it('re-renders when the meal count or the price index moves', () => {
    // Both are read in the body; neither was declared, so the card kept showing
    // last week's numbers after a meal until something else changed.
    const deps = src.slice(src.indexOf('const renderFood'), src.indexOf('const rentalOptions'));
    expect(deps).toContain('gameState.weeklyFoodPurchases');
    expect(deps).toContain('gameState.economy?.priceIndex');
  });
});

/**
 * The Apps grid: a fixed tile height left a third of every card empty, and
 * DeepMail — the one app with no PNG — rendered a grey chip beside seven
 * full-bleed icons and read as unfinished.
 */
describe('the app grid', () => {
  const launcher = read('components/launcher/AppLauncher.tsx');
  const catalog = read('components/launcher/appCatalog.ts');

  it('sizes tiles to their content instead of a fixed height', () => {
    const card = launcher.slice(launcher.indexOf('  appCard: {'), launcher.indexOf('  appCardInner: {'));
    expect(card).toContain('minHeight');
    expect(card).not.toMatch(/^\s*height:/m);
  });

  it('lets an art-less app declare a brand tint', () => {
    expect(catalog).toMatch(/tint\?:\s*string/);
    expect(launcher).toContain('app.tint');
  });

  it('gives DeepMail one, since it has no icon asset', () => {
    const assets = read('components/ui/appIconAssets.ts');
    // If mail ever gets real artwork this test should be deleted, not relaxed:
    // `tint` is only consulted when no PNG exists.
    expect(assets).not.toMatch(/^\s*mail:/m);
    expect(catalog).toMatch(/id: 'mail'[^}]*tint: '#/);
  });
});

/**
 * The seasonal card: a light-mode fill with no dark override, under a
 * dark-mode text colour identical to it — so the holiday's name was white on
 * white and had never been readable. And four of the eight holidays had no
 * icon entry at all, so the card silently did not render for them.
 */
describe('the seasonal card', () => {
  const indicator = read('components/SeasonalIndicator.tsx');
  const events = read('lib/events/seasonalEvents.ts');

  it('gives the holiday panel a dark-mode surface', () => {
    expect(indicator).toMatch(/holidaySectionDark:\s*\{/);
    expect(indicator).toContain('styles.holidaySectionDark');
  });

  it('never renders the holiday name in the panel colour', () => {
    const nameDark = indicator.match(/holidayNameDark:\s*\{\s*color:\s*'(#[0-9A-Fa-f]{6})'/);
    const panelDark = indicator.match(/holidaySectionDark:\s*\{\s*backgroundColor:\s*'(#[0-9A-Fa-f]{6})'/);
    expect(nameDark).not.toBeNull();
    expect(panelDark).not.toBeNull();
    expect(nameDark![1].toLowerCase()).not.toBe(panelDark![1].toLowerCase());
  });

  it('has an icon for every holiday the calendar can return', () => {
    const table = events.slice(events.indexOf('const HOLIDAY_WEEKS'), events.indexOf('\n];', events.indexOf('const HOLIDAY_WEEKS')));
    const holidays = [...table.matchAll(/holiday: '([a-z]+)'/g)].map((m) => m[1]);
    expect(holidays.length).toBe(8);
    const map = indicator.slice(indicator.indexOf('const holidays = {'), indicator.indexOf('};', indicator.indexOf('const holidays = {')));
    for (const h of holidays) expect(map).toContain(`${h}:`);
  });

  it('derives "next season in N weeks" from the same index it prints', () => {
    // `13 - weekInSeason` mixed the 0-based index with the `weekInSeason + 1`
    // printed one row above, so "week 8 / 13" claimed 6 weeks when 5 remain.
    expect(indicator).not.toMatch(/13 - seasonData\.weekInSeason/);
    expect(indicator).toMatch(/WEEKS_PER_SEASON - 1 - seasonData\.weekInSeason/);
  });
});
