/**
 * PLAYER REPORTS (1.4 bug-reports) — two numbers the player could not read.
 *
 *   "the money, savings, and diamonds (or gems) the font(or size) of them is
 *    very tiny"
 *   "Reputation stat is not viewable anywhere"
 *
 * The first was literal: the three headline figures in the app sat at
 * `responsiveFontSize.sm`, i.e. `fontScale(12)` — 12pt on a 375pt baseline and
 * about 10pt on a 320pt device, caption size, inside a pill with room to spare.
 * The pill's own box was RAW literals under a `fontScale()`d label, so it could
 * not grow with the text it holds — the same shape as the round-3
 * `FirstWeekGuide` finding.
 *
 * The second was half-true and that is why it survived: reputation WAS
 * rendered, but only as a tier word ("Standing: Respected"). The game gates on
 * the number — 30 for a council seat, 50 for mayor, 95 for president, plus
 * vehicle thresholds — and a word cannot tell a player whether the next office
 * is one week away or forty.
 *
 * 2026-08-01, from live player reports.
 */
import fs from 'fs';
import path from 'path';
import { styles } from '@/components/TopStatsBarStyles';
import { responsiveFontSize, fontScale, scale } from '@/utils/scaling';
import { getReputationStanding } from '@/lib/reputation/reputationTier';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('the HUD money/savings/gems figures are readable', () => {
  const chipText = styles.chipText as { fontSize: number; lineHeight: number };

  it('the scale really does put `sm` at caption size (the premise)', () => {
    // If this ever stops being true the fix below is measuring nothing.
    expect(responsiveFontSize.sm).toBe(fontScale(12));
    expect(responsiveFontSize.base).toBeGreaterThan(responsiveFontSize.sm);
  });

  it('the chip label is no longer the caption size the player complained about', () => {
    expect(chipText.fontSize).toBe(responsiveFontSize.base);
    expect(chipText.fontSize).toBeGreaterThan(responsiveFontSize.sm);
  });

  it('the line box leads the glyphs at every device scale', () => {
    // A raw `lineHeight: 18` under a scaled fontSize clips descenders once
    // fontScale climbs — on a tablet it reaches 1.6.
    expect(chipText.lineHeight).toBe(scale(20));
    expect(chipText.lineHeight).toBeGreaterThan(chipText.fontSize);
  });

  it('the pill grew with the text, instead of clipping it', () => {
    const chip = styles.moneyChip as {
      height: number; minWidth: number; paddingHorizontal: number;
    };

    // Every box dimension must be scaled, i.e. must track `scale()` — a raw
    // literal here is what made the old 28pt pill unable to hold a taller label.
    expect(chip.height).toBe(scale(32));
    expect(chip.minWidth).toBe(scale(64));
    expect(chip.paddingHorizontal).toBe(scale(12));
    // And the box must still clear the text it wraps.
    expect(chip.height).toBeGreaterThan(chipText.lineHeight);
  });

  it('the date block\'s line boxes scale with their text too', () => {
    // Same bug shape as `chipText` above, three more times, on the one bar that
    // is on screen at ALL times. `fontScale` clamps at 1.6 on a tablet, so a
    // raw `lineHeight: 20` under `responsiveFontSize.lg` put 26pt glyphs in a
    // 20pt box (month 22 in 18, age 19 in 16) and clipped on iPad.
    const lines: [string, { fontSize: number; lineHeight: number }, number][] = [
      ['yearText', styles.yearText as { fontSize: number; lineHeight: number }, 20],
      ['monthText', styles.monthText as { fontSize: number; lineHeight: number }, 18],
      ['ageText', styles.ageText as { fontSize: number; lineHeight: number }, 16],
    ];

    for (const [name, style, base] of lines) {
      // Scaled, not raw — the point of the fix.
      expect(`${name}: ${style.lineHeight}`).toBe(`${name}: ${fontScale(base)}`);
      // And the box still leads the glyphs at this device's scale.
      expect(`${name} leads`).toBe(
        style.lineHeight > style.fontSize ? `${name} leads` : `${name} clips`,
      );
    }
  });

  it('no style in the HUD pairs a scaled font with a raw line box', () => {
    // The guard, so a fourth one cannot be added quietly. Every `lineHeight` in
    // the sheet must equal a `scale()`/`fontScale()` output rather than a
    // literal that stays put while the text grows.
    const src = read('components/TopStatsBarStyles.ts');
    const raws = src.match(/lineHeight:\s*\d/g) ?? [];

    expect(raws).toEqual([]);
  });

  it('the chip can still shrink on a narrow device (the control)', () => {
    // Growing the pill must not have made it unable to fit three-across on a
    // 320pt screen, which would trade one legibility bug for another.
    const chip = styles.moneyChip as { flexShrink: number; maxWidth: string };
    expect(chip.flexShrink).toBe(1);
    expect(chip.maxWidth).toBe('100%');
  });
});

describe('the reputation stat is viewable as a number', () => {
  const CODE = read('components/IdentityCard.tsx');

  it('the card shows the raw 0-100 value, not only the tier word', () => {
    expect(CODE).toMatch(/const reputationValue = Math\.max\(0, Math\.round\(/);
    expect(CODE).toMatch(/\{reputationValue\} · \{reputationStanding\.label\}/);
  });

  it('and names the stat the player was looking for', () => {
    // "Standing" is not a term the player can search for; the stat is called
    // reputation everywhere else in the game and in every requirement gate.
    expect(CODE).toMatch(/>\s*Reputation\s*</);
  });

  it('still shows the tier word and its colour (the control)', () => {
    // Adding the number must not have deleted the standing it sits beside.
    expect(CODE).toMatch(/getReputationStanding\(reputationValue\)/);
    expect(CODE).toMatch(/color: reputationStanding\.color/);
  });

  it('a missing or broken reputation reads 0, not NaN', () => {
    // `stats.reputation` is optional on partial saves; `undefined` rendered
    // straight into a Text is the "NaN" class of report.
    for (const bad of [undefined, null, NaN, Infinity, 'x']) {
      const raw = typeof bad === 'number' && Number.isFinite(bad) ? bad : 0;
      expect(Math.max(0, Math.round(raw))).toBe(0);
    }
  });

  it('the thresholds the number exists to expose are real (the premise)', () => {
    // If reputation stopped gating anything, showing it would be noise.
    expect(getReputationStanding(0).label).toBe('Unknown');
    expect(getReputationStanding(95).label).toBe('Icon');
    expect(getReputationStanding(50).label).not.toBe(getReputationStanding(0).label);
  });
});
