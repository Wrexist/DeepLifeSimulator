/**
 * The scenario card's artwork is no longer half-covered.
 *
 * `heroScrim` was one flat band — `height: '55%'`, `rgba(15, 23, 42, 0.9)` —
 * painted over the bottom of every scenario painting. At 90% opacity across
 * more than half the image with a hard horizontal edge, the art below the line
 * was simply not visible, and the boundary read as a rendering fault.
 *
 * It was a flat band on purpose: `LinearGradient` in this app resolves to
 * `LinearGradientFallback`, which paints the FIRST colour as a solid
 * background, so a real gradient scrim either vanishes or becomes an opaque
 * slab. `ImageScrim` builds the fade from stacked plain Views instead, which
 * behaves identically on every platform with no native module involved.
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

describe.each(HOSTS)('%s — the flat slab is gone', (_name, file) => {
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
  it('is built from plain Views, not LinearGradient', () => {
    // The whole reason it exists: LinearGradientFallback paints the first
    // colour flat, so a gradient scrim cannot be trusted here.
    // Scoped to real code — the file's own doc comment names LinearGradient
    // precisely to explain why it is not used.
    const code = SCRIM.slice(SCRIM.indexOf("import React"));
    expect(code).not.toMatch(/LinearGradient/);
    expect(code).toMatch(/from 'react-native'/);
  });

  it('uses more than a couple of bands, so the steps are imperceptible', () => {
    const steps = SCRIM.match(/steps = (\d+)/);
    expect(steps).not.toBeNull();
    expect(Number(steps![1])).toBeGreaterThanOrEqual(8);
  });

  it('eases rather than ramping linearly', () => {
    // A linear ramp starts as a visible wash partway up the art; squaring keeps
    // the top of the fade near-invisible.
    expect(SCRIM).toMatch(/const ease = \(t: number\): number => t \* t;/);
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
