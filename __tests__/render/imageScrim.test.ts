/**
 * The scenario card's artwork is no longer half-covered.
 *
 * `heroScrim` was one flat band — `height: '55%'`, `rgba(15, 23, 42, 0.9)` —
 * painted over the bottom of every scenario painting. At 90% opacity across
 * more than half the image with a hard horizontal edge, the art below the line
 * was simply not visible, and the boundary read as a rendering fault.
 *
 * It was a flat band on purpose: `LinearGradient` in this app used to resolve to
 * `LinearGradientFallback`, which painted the FIRST colour as a solid
 * background, so a real gradient scrim either vanished or became an opaque slab.
 * `ImageScrim` draws the fade with `react-native-svg` instead — a different
 * library from the crashing Expo module, and the same one `components/ui/
 * Gradient` now uses at the call sites that fallback served.
 */

import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

const SCRIM = read('components/ui/ImageScrim.tsx');

// Both onboarding pickers shipped the identical slab, copy-pasted.
const HOSTS: [string, string][] = [
  ['Scenarios', 'app/(onboarding)/Scenarios.tsx'],
  ['Perks', 'app/(onboarding)/Perks.tsx'],
];

describe.each(HOSTS)('%s - the flat slab is gone', (_name, file) => {
  const SRC = read(file);

  it('no longer defines a 55% opaque band', () => {
    expect(SRC).not.toMatch(/height: '55%'/);
    expect(SRC).not.toMatch(/rgba\(15, 23, 42, 0\.9\)/);
  });

  it('renders the shared fade over the hero instead', () => {
    expect(SRC).toMatch(/<ImageScrim /);
    expect(SRC).toMatch(/from '@\/components\/ui\/ImageScrim'/);
  });

  it('every hero image is followed by a fade, not a leftover band', () => {
    // Perks has TWO heroes (perk cards and trait cards) — the first fix missed
    // exactly this kind of second instance elsewhere in the file.
    const heroes = SRC.match(/style=\{styles\.heroImage\}/g) ?? [];
    const scrims = SRC.match(/<ImageScrim /g) ?? [];
    expect(heroes.length).toBeGreaterThan(0);
    expect(scrims.length).toBe(heroes.length);
    expect(SRC).not.toMatch(/<View style=\{styles\.heroScrim\} \/>/);
  });

  it('the fade covers less of the image than the old band did', () => {
    const used = SRC.match(/<ImageScrim height=\{([\d.]+)\}/);
    expect(used).not.toBeNull();
    expect(Number(used![1])).toBeLessThan(0.55);
  });
});

describe('ImageScrim actually fades', () => {
  const code = SCRIM.slice(SCRIM.indexOf('import React'));

  it('draws a REAL gradient via react-native-svg', () => {
    // The first version faked the fade with stacked flat bands. That removed
    // the hard edge but replaced it with visible BANDING, and more steps could
    // not fix it — banding is quantisation of the composited colour, not of
    // pixels. Over the Optimist card's yellow sun (~250,190,60) against slate
    // (15,23,42) one channel spans ~235 levels, so an alpha step of 0.05 is a
    // 12-level jump. Getting under one level would need ~250 bands per card.
    expect(code).toMatch(/from 'react-native-svg'/);
    expect(code).toMatch(/<SvgLinearGradient/);
    expect(code).toMatch(/<Stop/);
  });

  it('never imports the Expo gradient module', () => {
    // `expo-linear-gradient` hard-aborts on iOS 26 TurboModule init (P0-7/P0-8,
    // tasks/critical-bugs-2026-05-29.md), which is why all 265 call sites use
    // the flat fallback. react-native-svg is a DIFFERENT library and is already
    // imported directly by GradientButton, ProgressRing and DeepLifePlusUpsell.
    expect(code).not.toMatch(/expo-linear-gradient/);
  });

  it('has no stacked bands left', () => {
    // Structural, not word-based: the surviving prose legitimately mentions
    // "steps" to explain why five gradient stops are not five steps.
    expect(code).not.toMatch(/steps\?:/);
    expect(code).not.toMatch(/steps =/);
    expect(code).not.toMatch(/Array\.from/);
  });

  it('curves rather than ramping linearly', () => {
    // A linear fade reads as a wash starting abruptly partway up the art;
    // squaring keeps the top near-invisible. The stops are t and t² sampled —
    // SVG interpolates between them, so five stops is a curve, not five steps.
    const stops = code.match(/\[([\d.]+), ([\d.]+)\]/g) ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const stop of stops) {
      const [t, v] = stop.match(/[\d.]+/g)!.map(Number);
      expect(`${t} -> ${v}`).toBe(`${t} -> ${Number((t * t).toFixed(4))}`);
    }
  });

  it('gives each instance a unique gradient id', () => {
    // SVG <Defs> ids share one document namespace on web, so a fixed id would
    // make every scrim on screen resolve to whichever mounted last.
    expect(code).toMatch(/_gid \+= 1/);
    expect(code).toMatch(/url\(#\$\{gid\}\)/);
  });

  it('never fully hides the art at its darkest point', () => {
    const strength = SCRIM.match(/strength = ([\d.]+)/);
    expect(strength).not.toBeNull();
    expect(Number(strength![1])).toBeLessThan(0.9);
  });

  it('does not swallow taps meant for the card underneath', () => {
    expect(SCRIM).toMatch(/pointerEvents="none"/);
  });

  it('clamps its inputs so a bad prop cannot produce an opaque cover', () => {
    expect(SCRIM).toMatch(/Math\.max\(0, Math\.min\(1, strength\)\)/);
    expect(SCRIM).toMatch(/Math\.max\(0, Math\.min\(1, height\)\)/);
  });
});
