/**
 * No hard-edged partial-cover scrims anywhere.
 *
 * The bug fixed on Scenarios and Perks was a shape, not a one-off: a style that
 * is absolutely positioned, pinned to one edge, given a PARTIAL height, and
 * filled with a dark translucent colour. That is a slab with a visible
 * horizontal line across the artwork, hiding everything below it.
 *
 * It appeared four separate times, each with the same rationale in its comment —
 * `LinearGradient` here resolves to `LinearGradientFallback`, which paints only
 * `colors[0]` as a flat background, so a real gradient scrim either vanishes
 * (`transparent → dark`) or becomes an opaque block (`dark → transparent`).
 * Four authors independently reached for a flat band as the workaround:
 *
 *   app/(onboarding)/Scenarios.tsx          heroScrim   55% @ 0.90
 *   app/(onboarding)/Perks.tsx              heroScrim   55% @ 0.90  (×2 heroes)
 *   components/mobile/Pulse/…/ProfileScreen coverScrim  50% @ 0.85
 *   components/computer/GamingApp.tsx       thumbScrim  65% @ 0.35
 *
 * All four now render `ImageScrim`. This test is the sweep made permanent: it
 * re-derives the shape from source, so a fifth one cannot be added quietly.
 *
 * Deliberately NOT flagged — these are different things that happen to be dark:
 *   • `...StyleSheet.absoluteFillObject` tints — uniform wash, no edge
 *   • `flex: 1` modal backdrops — no artwork underneath
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const SEARCH_DIRS = ['components', 'app', 'src'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') walk(p, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const DARK_FILL = /backgroundColor:\s*['"]rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)['"]/;

interface Offender {
  file: string;
  style: string;
  alpha: number;
}

function findOffenders(): Offender[] {
  const files = SEARCH_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const offenders: Offender[] = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    // Style blocks with no nested object — enough to catch every real instance,
    // and nested ones are shadow/transform specs, not scrims.
    const blocks = src.matchAll(/(\w+):\s*\{([^{}]*)\}/g);

    for (const [, style, body] of blocks) {
      if (!/position:\s*'absolute'/.test(body)) continue;

      const fill = body.match(DARK_FILL);
      if (!fill) continue;

      const [, r, g, b, a] = fill;
      const luminance = (Number(r) + Number(g) + Number(b)) / 3;
      const alpha = Number(a);
      if (luminance > 90 || alpha < 0.2) continue; // not a dark cover

      const pinned = /(bottom|top|left|right):\s*0/.test(body);
      const partial =
        /height:\s*['"]?\d{1,2}%/.test(body) ||
        /height:\s*[A-Za-z_]+\s*\/\s*\d/.test(body) ||
        /width:\s*['"]\d{1,2}%/.test(body);

      if (pinned && partial) {
        offenders.push({ file: path.relative(ROOT, file), style, alpha });
      }
    }
  }
  return offenders;
}

describe('no hard-edged partial-cover scrims', () => {
  it('the sweep is clean', () => {
    const offenders = findOffenders();
    // Named in the failure so a regression says WHERE, not just "1 !== 0".
    expect(offenders.map((o) => `${o.file} → ${o.style} (alpha ${o.alpha})`)).toEqual([]);
  });

  it('the detector still recognises the shape it was written to catch', () => {
    // A guard whose detector silently stopped matching would pass forever. This
    // is the exact style that shipped on the scenario card.
    const sample = `
      heroScrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '55%',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
      },
    `;
    // Group 1 is the style NAME, group 2 the body.
    const [, , body] = sample.match(/(\w+):\s*\{([^{}]*)\}/)!;
    expect(/position:\s*'absolute'/.test(body)).toBe(true);
    expect(DARK_FILL.test(body)).toBe(true);
    expect(/(bottom|top|left|right):\s*0/.test(body)).toBe(true);
    expect(/height:\s*['"]?\d{1,2}%/.test(body)).toBe(true);
  });
});

describe('every former offender now uses the shared fade', () => {
  it.each([
    'app/(onboarding)/Scenarios.tsx',
    'app/(onboarding)/Perks.tsx',
    'components/mobile/Pulse/screens/ProfileScreen.tsx',
    'components/computer/GamingApp.tsx',
  ])('%s renders ImageScrim', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src).toMatch(/<ImageScrim /);
    expect(src).toMatch(/from '@\/components\/ui\/ImageScrim'/);
  });
});
