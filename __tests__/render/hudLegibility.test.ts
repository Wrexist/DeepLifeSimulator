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

/**
 * The same defect, hunted repo-wide.
 *
 * The TopStatsBar fix above was found by eye, four times in one file. The
 * pairing it names - a `fontScale()`d fontSize sitting in a line box written as
 * a RAW literal - is mechanical enough to scan for, so this walks every style
 * object in `components/` and `app/` and fails on any survivor.
 *
 * What is IN scope: scaled font + literal `lineHeight`. `fontScale` clamps at
 * 1.6 and `scale` at 1.8, so the glyphs grow toward the clamp while the box
 * stays where it was written and the descenders clip on a tablet.
 *
 * What is deliberately NOT in scope: a RAW fontSize with a RAW lineHeight. That
 * is merely unscaled - the pair keeps its ratio at every device size, so the
 * text never clips. It is a separate (and much larger) debt, and converting
 * those fontSizes would move layout app-wide.
 */
describe('no style anywhere pairs a scaled font with a raw line box', () => {
  const ROOT = path.join(__dirname, '..', '..');

  /**
   * Justified survivors, `'<relative path>': '<why>'`. Empty, and it should
   * stay that way - a scaled font in a fixed box has no good reason to exist.
   */
  const ALLOWLIST: Record<string, string> = {};

  const SCALED_FONT =
    /fontSize:\s*(responsiveFontSize\.[\w'"[\]]+|fontScale\(|scale\(|moderateScale\(|getResponsiveValue\()/;
  const RAW_LINE_HEIGHT = /lineHeight:\s*(\d+(?:\.\d+)?)\s*[,\n}]/;

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(p, out);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        out.push(p);
      }
    }
    return out;
  };

  /**
   * Every `{...}` in the file, reduced to its OWN properties by blanking any
   * nested object (a `Platform.select({...})`, a `textShadowOffset`). Without
   * that, a sheet's outer object inherits its children's properties and every
   * style in the file reads as one giant object.
   */
  const ownPropertyBodies = (src: string): string[] => {
    const open: number[] = [];
    const bodies: string[] = [];
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '{') open.push(i);
      else if (src[i] === '}') {
        const start = open.pop();
        if (start === undefined) continue;
        let body = src.slice(start + 1, i);
        let prev = '';
        while (body !== prev) {
          prev = body;
          body = body.replace(/\{[^{}]*\}/g, '{}');
        }
        bodies.push(body);
      }
    }
    return bodies;
  };

  const scan = (): string[] => {
    const files = [
      ...walk(path.join(ROOT, 'components')),
      ...walk(path.join(ROOT, 'app')),
    ];
    const found = new Set<string>();

    for (const file of files) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      if (rel in ALLOWLIST) continue;
      const src = fs.readFileSync(file, 'utf8');
      // Cheap reject: no literal lineHeight anywhere means nothing to find.
      if (!/lineHeight:\s*\d/.test(src)) continue;

      for (const body of ownPropertyBodies(src)) {
        const font = body.match(SCALED_FONT);
        const line = body.match(RAW_LINE_HEIGHT);
        if (font && line) {
          found.add(`${rel} - fontSize: ${font[1]}… paired with lineHeight: ${line[1]}`);
        }
      }
    }
    return [...found].sort();
  };

  it('finds no scaled-font/raw-lineHeight pair in components/ or app/', () => {
    // Listed rather than counted, so a regression names the file to open.
    expect(scan()).toEqual([]);
  });

  it('the scanner can still see the defect it was written for (the control)', () => {
    // A guard that silently stopped matching would pass forever. Re-run the
    // matchers over the shape they exist to catch, and over the shape they must
    // NOT catch (raw + raw, which keeps its ratio and is out of scope).
    const clipping = ` fontSize: responsiveFontSize.base, color: '#000', lineHeight: 24, `;
    expect(SCALED_FONT.test(clipping) && RAW_LINE_HEIGHT.test(clipping)).toBe(true);

    const merelyUnscaled = ` fontSize: 14, color: '#000', lineHeight: 24, `;
    expect(SCALED_FONT.test(merelyUnscaled)).toBe(false);

    const fixed = ` fontSize: responsiveFontSize.base, lineHeight: fontScale(24), `;
    expect(RAW_LINE_HEIGHT.test(fixed)).toBe(false);
  });

  it('the work-screen sheet that started this carries no raw line box', () => {
    // The two confirmed findings (`sectionDescription`, `jobDescription`) were
    // fixed, then found to be DEAD keys - two of 567 the sheet carried with no
    // reader - and deleted with the rest (Program 4). The pointer stays on the
    // file: nothing in it may pair text with a raw line box again.
    const src = read('components/work/workScreenStyles.ts');
    expect(src.match(/lineHeight:\s*\d/g) ?? []).toEqual([]);
    // And the screen's own sheet, where the live styles moved, is scaled.
    const screen = read('app/(tabs)/work.tsx');
    expect(screen).toContain('lineHeight: fontScale(');
    expect(screen.match(/lineHeight:\s*\d/g) ?? []).toEqual([]);
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
