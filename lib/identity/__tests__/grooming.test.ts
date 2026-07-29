/**
 * Grooming and complexion: brows, facial-hair colour and density, skin
 * undertone and finish — and freckles, which existed the whole time.
 *
 * ## What was actually wrong
 *
 * `blemishes` was randomised, inherited from both parents, drifted upward with
 * age, and RENDERED on both heads. There was no control for it anywhere in the
 * app. A field the game maintains and never shows is the same defect as a
 * slider that moves nothing, and it had been that way for months.
 *
 * The rest are new, and each one had to earn its place by moving something on
 * screen. A control the renderer ignores is the failure this whole screen
 * already refuses to ship for the morph sliders (`binding.unbound` hides them);
 * the wiring block at the bottom is what stops these from becoming that.
 */
import {
  randomizeFace,
  normalizeGenome,
  inheritFace,
  applyAging,
} from '@/lib/identity/faceGenome';
import { FACE_MORPH_KEYS, HAIR_COLORS, type FaceGenome } from '@/lib/identity/types';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');

describe('normalizeGenome fills the new fields and respects an absent override', () => {
  it('defaults every concrete field to neutral', () => {
    const g = normalizeGenome({});
    expect(g.browThickness).toBe(0.5);
    expect(g.beardDensity).toBe(0.5);
    expect(g.skinUndertone).toBe(0.5);
    expect(g.skinShine).toBe(0.5);
  });

  it('leaves the colour overrides ABSENT rather than defaulting them to 0', () => {
    // Absent means "follow the hair". Defaulting to index 0 would hand every
    // existing character black eyebrows — a choice they did not make and cannot
    // tell apart from one they did.
    const g = normalizeGenome({});
    expect('browColor' in g).toBe(false);
    expect('beardColor' in g).toBe(false);
  });

  it('keeps a real override and clamps it into the palette', () => {
    expect(normalizeGenome({ browColor: 3 }).browColor).toBe(3);
    expect(normalizeGenome({ browColor: 999 }).browColor).toBe(HAIR_COLORS.length - 1);
    expect(normalizeGenome({ beardColor: -4 }).beardColor).toBe(0);
  });

  it('drops a non-numeric override instead of clamping it to black', () => {
    for (const bad of [null, NaN, Infinity, 'brown', {}]) {
      const g = normalizeGenome({ browColor: bad as unknown as number });
      expect(`${String(bad)} -> ${'browColor' in g}`).toBe(`${String(bad)} -> false`);
    }
  });

  it('clamps the sliders rather than letting a bad save deform the shader', () => {
    const g = normalizeGenome({ browThickness: 4, skinShine: -2, skinUndertone: NaN });
    expect(g.browThickness).toBe(1);
    expect(g.skinShine).toBe(0);
    expect(g.skinUndertone).toBe(0.5);
  });

  it('round-trips a normalized genome unchanged', () => {
    const once = normalizeGenome(randomizeFace('rt'));
    expect(normalizeGenome(once)).toEqual(once);
  });
});

describe('THE ONE THAT WOULD HAVE BROKEN EVERY EXISTING FACE', () => {
  /**
   * `randomizeFace` draws from one seeded stream, so inserting a draw anywhere
   * shifts every later one — the same defect that once let `sex` reach skin
   * tone, hair colour and eye colour. The new traits are drawn LAST for that
   * reason, and this is the golden that says so.
   *
   * Captured from the build immediately before the traits were added, after
   * checking every field of every seed against that build directly. If a future
   * change moves a draw, these numbers move and this fails — which is the point.
   * A character's face is stored as a seed in places; changing the stream
   * silently replaces people.
   */
  const GOLDEN: Record<string, Record<string, unknown>> = {
    'golden-a/male': {
      skinTone: 8, hairColor: 0, eyeColor: 8, hairStyle: 'messy', facialHair: 'stubble',
      blemishes: 0.580774, jawWidth: 0.844165, noseWidth: 0.928738,
    },
    'golden-a/female': {
      skinTone: 8, hairColor: 0, eyeColor: 8, hairStyle: 'bun', facialHair: 'none',
      blemishes: 0.580774, jawWidth: 0.524165, noseWidth: 0.728738,
    },
    'golden-b/male': {
      skinTone: 6, hairColor: 5, eyeColor: 2, hairStyle: 'short', facialHair: 'stubble',
      blemishes: 0.009352, jawWidth: 0.930812, noseWidth: 0.690271,
    },
    'golden-b/female': {
      skinTone: 6, hairColor: 5, eyeColor: 2, hairStyle: 'short', facialHair: 'none',
      blemishes: 0.009352, jawWidth: 0.610812, noseWidth: 0.490271,
    },
  };

  it.each(Object.keys(GOLDEN))('%s is the same face it was', (key) => {
    const [seed, sex] = key.split('/');
    const g = randomizeFace(seed, { sex });
    expect({
      skinTone: g.skinTone, hairColor: g.hairColor, eyeColor: g.eyeColor,
      hairStyle: g.hairStyle, facialHair: g.facialHair,
      blemishes: +g.blemishes.toFixed(6),
      jawWidth: +g.morphs.jawWidth.toFixed(6),
      noseWidth: +g.morphs.noseWidth.toFixed(6),
    }).toEqual(GOLDEN[key]);
  });

  it('still gives the new traits a spread instead of a constant', () => {
    // The other way this could be wrong: drawn last AND never drawn, so every
    // character gets exactly 0.5 and four controls look broken by default.
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) seen.add(+randomizeFace(`spread-${i}`).skinUndertone.toFixed(4));
    expect(seen.size).toBeGreaterThan(20);
  });

  it('keeps the random spread near neutral rather than at the rails', () => {
    // The same bell-sampling the morphs get. A flat draw would give a fifth of
    // all characters the thinnest possible brows.
    let extreme = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const g = randomizeFace(`bell-${i}`);
      if (g.browThickness < 0.15 || g.browThickness > 0.85) extreme++;
    }
    expect(extreme / N).toBeLessThan(0.08);
  });

  it('never randomises a colour override on', () => {
    for (let i = 0; i < 50; i++) {
      const g = randomizeFace(`ov-${i}`);
      expect(`${i}:${'browColor' in g}${'beardColor' in g}`).toBe(`${i}:falsefalse`);
    }
  });
});

describe('inheritance', () => {
  const parent = (over: Partial<FaceGenome>): FaceGenome =>
    normalizeGenome({ ...randomizeFace('p'), ...over });

  it('lands a child between its parents on every new trait', () => {
    const mum = parent({ browThickness: 0.9, skinUndertone: 0.9, skinShine: 0.9, beardDensity: 0.9 });
    const dad = parent({ browThickness: 0.1, skinUndertone: 0.1, skinShine: 0.1, beardDensity: 0.1 });
    // The mutation term is +/-0.06, so the band is the parents' range widened
    // by that — a child outside it would mean the blend is not a blend.
    for (let i = 0; i < 30; i++) {
      const kid = inheritFace(mum, dad, `kid-${i}`);
      for (const k of ['browThickness', 'skinUndertone', 'skinShine', 'beardDensity'] as const) {
        expect(`${k}:${kid[k] >= 0.04 && kid[k] <= 0.96}`).toBe(`${k}:true`);
      }
    }
  });

  it('produces siblings that differ, not clones', () => {
    const mum = parent({ browThickness: 0.8 });
    const dad = parent({ browThickness: 0.2 });
    const kids = Array.from({ length: 12 }, (_, i) => inheritFace(mum, dad, `sib-${i}`).browThickness);
    expect(new Set(kids.map((v) => v.toFixed(4))).size).toBeGreaterThan(8);
  });

  it('does not inherit a colour override', () => {
    // An override is "this character dyes their brows", not a trait. A baby born
    // already overriding is nobody's idea of inheritance.
    const mum = parent({ browColor: 11 });
    const dad = parent({ beardColor: 12 });
    const kid = inheritFace(mum, dad, 'kid');
    expect('browColor' in kid).toBe(false);
    expect('beardColor' in kid).toBe(false);
  });
});

describe('aging', () => {
  const base = normalizeGenome({ ...randomizeFace('age'), browThickness: 0.5, skinShine: 0.5, skinUndertone: 0.5 });

  it('coarsens the brows late, and not before', () => {
    expect(applyAging(base, 30).browThickness).toBeCloseTo(0.5, 5);
    expect(applyAging(base, 80).browThickness).toBeGreaterThan(0.6);
  });

  it('runs skin oily young and dry old', () => {
    expect(applyAging(base, 14).skinShine).toBeGreaterThan(applyAging(base, 30).skinShine);
    expect(applyAging(base, 75).skinShine).toBeLessThan(applyAging(base, 30).skinShine);
  });

  it('leaves undertone and beard density alone', () => {
    // Both are authored. A beard that thickens on its own overwrites a choice
    // rather than expressing one, and undertone does not change over a life.
    for (const age of [5, 25, 60, 95]) {
      expect(`${age}:${applyAging(base, age).skinUndertone}`).toBe(`${age}:${base.skinUndertone}`);
      expect(`${age}:${applyAging(base, age).beardDensity}`).toBe(`${age}:${base.beardDensity}`);
    }
  });

  it('never leaves a value outside [0, 1] at any age', () => {
    const extreme = normalizeGenome({ ...base, browThickness: 1, skinShine: 1 });
    const low = normalizeGenome({ ...base, browThickness: 0, skinShine: 0 });
    for (let age = 0; age <= 110; age += 5) {
      for (const g of [applyAging(extreme, age), applyAging(low, age)]) {
        for (const k of ['browThickness', 'skinShine', 'blemishes'] as const) {
          expect(`${age}/${k}:${g[k] >= 0 && g[k] <= 1}`).toBe(`${age}/${k}:true`);
        }
        for (const m of FACE_MORPH_KEYS) {
          expect(`${age}/${m}:${g.morphs[m] >= 0 && g.morphs[m] <= 1}`).toBe(`${age}/${m}:true`);
        }
      }
    }
  });
});

describe('every new control reaches the renderer and the screen', () => {
  // The point of this block. Six controls that a shader ignores are six sliders
  // the player drags while nothing happens — and nothing else in this file would
  // notice, because the genome would be perfectly correct.

  const RENDERER = read('components/identity/gl/FaceRenderer.ts');
  const SHADER = read('components/identity/gl/proceduralSkinShader.ts');
  const STUDIO = read('components/identity/FaceStudio.tsx');
  const HEAD = read('lib/identity/headMesh.ts');

  it.each([
    ['browThickness', /genome\.browThickness|aged\.browThickness/],
    ['browColor', /aged\.browColor/],
    ['beardColor', /aged\.beardColor/],
    ['beardDensity', /aged\.beardDensity/],
    ['skinUndertone', /aged\.skinUndertone/],
    ['skinShine', /aged\.skinShine/],
  ])('%s is read by the renderer', (_name, pattern) => {
    expect(RENDERER).toMatch(pattern);
  });

  it('the procedural shader consumes thickness and undertone', () => {
    expect(SHADER).toMatch(/uBrowThickness/);
    expect(SHADER).toMatch(/uUndertone/);
    // Declared AND used — a uniform that is only declared is optimised out and
    // the slider goes dead with no error anywhere.
    expect(SHADER.match(/uBrowThickness/g)!.length).toBeGreaterThan(1);
    expect(SHADER.match(/uUndertone/g)!.length).toBeGreaterThan(1);
  });

  it('the scanned head gets the same two uniforms, not just the procedural one', () => {
    // Two render paths, and the scanned one is what ships once the GLB loads.
    // The brow tint was added to both; the first version of the freckle work
    // was added to only one and looked finished.
    expect(RENDERER).toMatch(/uniform float uBrowThickness;\\nuniform float uUndertone;/);
    expect(RENDERER).toMatch(/browMask/);
  });

  it('beard density changes the mesh, not only the colour', () => {
    expect(HEAD).toMatch(/genome\.beardDensity/);
  });

  it('the studio offers all six, plus freckles', () => {
    for (const field of [
      'browThickness', 'beardDensity', 'skinUndertone', 'skinShine', 'blemishes',
    ]) {
      expect(`${field}:${STUDIO.includes(`genome.${field}`)}`).toBe(`${field}:true`);
    }
    expect(STUDIO).toMatch(/selected=\{genome\.browColor\}/);
    expect(STUDIO).toMatch(/selected=\{genome\.beardColor\}/);
  });

  it('the studio can clear an override, not only set one', () => {
    // A colour picker with no way back to "same as hair" is one the player uses
    // once, by accident, and then lives with.
    expect(STUDIO).toMatch(/function withOptional/);
    expect(STUDIO).toMatch(/delete next\[key\]/);
  });
});
