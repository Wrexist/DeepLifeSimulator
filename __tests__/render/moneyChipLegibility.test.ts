/**
 * The money figure must stay readable while it changes.
 *
 * `AnimatedMoney` used to override the text colour for 650ms after a change -
 * green on a gain, red on a loss. Its only call site is the HUD money chip,
 * which sits on a GREEN gradient (`#16A34A` -> `#22C55E`), so a gain painted
 * green text onto a green pill and the player could not read their own balance
 * for two thirds of a second. Reported from TestFlight.
 *
 * The balance is the single most-read number in the game. A change emphasis
 * must never cost legibility of the thing it is emphasising.
 */
import * as fs from 'fs';
import * as path from 'path';
import { styles as topStatsBarStyles } from '@/components/TopStatsBarStyles';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('the HUD money chip stays legible', () => {
  it('renders its text white', () => {
    expect((topStatsBarStyles.chipText as { color?: string }).color).toBe('#FFFFFF');
  });

  it('AnimatedMoney never overrides the caller-set colour', () => {
    const src = read('components/ui/AnimatedMoney.tsx');
    // No direction tint, and nothing else writing `color` into the rendered
    // style array. The base `styles.text` colour is a fallback the caller
    // overrides; a tint applied AFTER `style` is what broke this.
    expect(src).not.toMatch(/accent\.success/);
    expect(src).not.toMatch(/accent\.danger/);
    expect(src).not.toMatch(/tint \? \{ color: tint \}/);
  });

  it('still acknowledges a change - the pop is what replaced the tint', () => {
    const src = read('components/ui/AnimatedMoney.tsx');
    expect(src).toMatch(/Animated\.sequence/);
    expect(src).toMatch(/toValue: 1\.12/);
  });

  it('the chip really is on a green gradient (why a green tint was invisible)', () => {
    const src = read('components/TopStatsBar.tsx');
    expect(src).toMatch(/colors=\{\['#16A34A','#22C55E'\] as const\}/);
  });
});
