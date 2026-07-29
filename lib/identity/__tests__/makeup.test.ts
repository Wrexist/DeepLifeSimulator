/**
 * Makeup: lipstick, eyeshadow and blush.
 *
 * ## The trap this file is mostly about
 *
 * A makeup region is a per-vertex field, and a field narrower than the distance
 * between vertices renders as nothing at all. The first version of these fields
 * gave the lips a half-height of 0.030 on a mesh whose grid spacing is about
 * 0.022 — barely one and a half vertices tall — so the lips covered EIGHTEEN
 * vertices out of 16,641 and full-strength lipstick rendered as a faint stain
 * on the lip line.
 *
 * That is the third time this exact mistake has been made in `headMesh.ts`,
 * after `chinCleft` and the mouth line, and the second time in one sitting —
 * `nostrilFlare` and `philtrumDepth` shipped too narrow and were caught by CI.
 * So the guard here is a COUNT, not a rendering: a region has to cover a real
 * number of vertices before it is geometry rather than arithmetic.
 *
 * ## What is deliberately not here
 *
 * Randomisation, inheritance and aging. Makeup is a choice rather than a trait,
 * so it is none of those things — asserted below, because "we simply never
 * wrote that code" is indistinguishable from "the code is broken" without a
 * test that says which was intended.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildHeadMesh } from '@/lib/identity/headMesh';
import {
  randomizeFace, normalizeGenome, inheritFace, applyAging,
} from '@/lib/identity/faceGenome';
import { LIP_COLORS, LIP_COLOR_NAMES } from '@/lib/identity/types';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');

describe('the regions are wide enough to exist on the mesh', () => {
  const mesh = buildHeadMesh(randomizeFace('makeup-coverage'), { age: 30 });
  const covered = (field?: Float32Array): number =>
    field ? field.reduce((n, v) => n + (v > 0.5 ? 1 : 0), 0) : 0;

  it('bakes all three fields', () => {
    expect(mesh.lip).toBeDefined();
    expect(mesh.lid).toBeDefined();
    expect(mesh.cheek).toBeDefined();
  });

  it.each([
    ['lip', 40],
    ['lid', 30],
    ['cheek', 40],
  ] as const)('%s covers at least %i vertices', (name, floor) => {
    // Benchmarked against the eyebrow field, which covers 42 and is plainly
    // visible. Anything far below that is a control the player cannot see.
    const field = mesh[name as 'lip' | 'lid' | 'cheek'];
    expect(covered(field)).toBeGreaterThanOrEqual(floor);
  });

  it('reaches full strength somewhere, not just a smear', () => {
    for (const name of ['lip', 'lid', 'cheek'] as const) {
      const peak = (mesh[name] ?? new Float32Array()).reduce((m, v) => Math.max(m, v), 0);
      expect(`${name}:${peak > 0.9}`).toBe(`${name}:true`);
    }
  });

  it('keeps the regions apart — makeup on the wrong feature is worse than none', () => {
    // Lipstick on an eyelid is not a subtle bug, and the fields are blobs that
    // grow when widened, which is exactly what was just done to all three.
    const overlap = (a: Float32Array, b: Float32Array): number => {
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] > 0.4 && b[i] > 0.4) n++;
      return n;
    };
    expect(overlap(mesh.lip!, mesh.lid!)).toBe(0);
    expect(overlap(mesh.lip!, mesh.cheek!)).toBe(0);
    // Brows and lids are adjacent by construction; the lid field subtracts the
    // brow, so they must not fight over a vertex either.
    expect(overlap(mesh.lid!, mesh.brow!)).toBe(0);
  });
});

describe('makeup is a choice, not a trait', () => {
  it('defaults to none', () => {
    const g = normalizeGenome({});
    expect([g.lipStrength, g.eyeshadowStrength, g.blush]).toEqual([0, 0, 0]);
  });

  it('is never randomised on', () => {
    for (let i = 0; i < 40; i++) {
      const g = randomizeFace(`mk-${i}`);
      expect(`${i}:${g.lipStrength}${g.eyeshadowStrength}${g.blush}`).toBe(`${i}:000`);
    }
  });

  it('is not inherited — no baby is born wearing lipstick', () => {
    const parent = normalizeGenome({
      ...randomizeFace('p'), lipStrength: 1, blush: 1, eyeshadowStrength: 1, lipColor: 4,
    });
    const kid = inheritFace(parent, parent, 'kid');
    expect([kid.lipStrength, kid.eyeshadowStrength, kid.blush]).toEqual([0, 0, 0]);
    expect('lipColor' in kid).toBe(false);
  });

  it('is not aged — it is reapplied, not weathered', () => {
    const g = normalizeGenome({ ...randomizeFace('a'), lipStrength: 0.7, blush: 0.4 });
    for (const age of [8, 25, 60, 95]) {
      const aged = applyAging(g, age);
      expect(`${age}:${aged.lipStrength}/${aged.blush}`).toBe(`${age}:0.7/0.4`);
    }
  });

  it('clamps a hostile save rather than letting it through', () => {
    const g = normalizeGenome({ lipStrength: 9, blush: -3, eyeshadowStrength: NaN });
    // NaN resolves to 0, NOT to the 0.5 that `clamp01` gives a morph. A morph
    // has a meaningful midpoint and a makeup strength does not — half a face of
    // lipstick is not a sane recovery from a corrupt save.
    expect([g.lipStrength, g.blush, g.eyeshadowStrength]).toEqual([1, 0, 0]);
    expect('lipColor' in normalizeGenome({ lipColor: 'red' as unknown as number })).toBe(false);
    expect(normalizeGenome({ lipColor: 99 }).lipColor).toBe(LIP_COLORS.length - 1);
  });
});

describe('the palette', () => {
  it('has a name for every colour', () => {
    // A swatch is a button with no text in it; without this a screen reader
    // announces ten identical "button, selected".
    expect(LIP_COLOR_NAMES).toHaveLength(LIP_COLORS.length);
    expect(LIP_COLOR_NAMES.every((n) => n.length > 0)).toBe(true);
  });

  it('is all valid hex', () => {
    for (const c of LIP_COLORS) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('every control reaches the shader and the screen', () => {
  const SHADER = read('components/identity/gl/proceduralSkinShader.ts');
  const RENDERER = read('components/identity/gl/FaceRenderer.ts');
  const STUDIO = read('components/identity/FaceStudio.tsx');

  it('the shader declares AND uses each uniform', () => {
    // Declared-only is worse than absent: GLSL optimises it out, the uniform
    // location comes back null, and the slider is dead with no error anywhere.
    for (const u of ['uLipColor', 'uLipStrength', 'uShadowColor', 'uShadowStrength', 'uBlush']) {
      expect(`${u}:${(SHADER.match(new RegExp(u, 'g')) ?? []).length > 1}`).toBe(`${u}:true`);
    }
  });

  it('the shader reads all three vertex fields', () => {
    for (const v of ['vLip', 'vLid', 'vCheek']) {
      expect(`${v}:${(SHADER.match(new RegExp(v, 'g')) ?? []).length > 1}`).toBe(`${v}:true`);
    }
  });

  it('the renderer binds the attributes the shader declares', () => {
    // The shader declares `lip`, `lid` and `cheek` unconditionally. An unbound
    // attribute reads as zero, which is "no makeup" — safe, and safe purely by
    // accident. Without these three lines every control here does nothing.
    for (const a of ['lip', 'lid', 'cheek']) {
      expect(RENDERER).toMatch(new RegExp(`setAttribute\\('${a}'`));
    }
  });

  it('the renderer sets the uniforms from the genome', () => {
    for (const f of ['lipStrength', 'eyeshadowStrength', 'blush']) {
      expect(`${f}:${RENDERER.includes(`aged.${f}`)}`).toBe(`${f}:true`);
    }
    expect(RENDERER).toMatch(/makeupHex\(aged\.lipColor\)/);
    expect(RENDERER).toMatch(/makeupHex\(aged\.eyeshadowColor\)/);
  });

  it('the studio offers all five', () => {
    for (const f of ['lipStrength', 'eyeshadowStrength', 'blush']) {
      expect(`${f}:${STUDIO.includes(`genome.${f}`)}`).toBe(`${f}:true`);
    }
    expect(STUDIO).toMatch(/genome\.lipColor/);
    expect(STUDIO).toMatch(/genome\.eyeshadowColor/);
  });

  it('hides a colour row until there is something to colour', () => {
    expect(STUDIO).toMatch(/genome\.lipStrength > 0/);
    expect(STUDIO).toMatch(/genome\.eyeshadowStrength > 0/);
  });
});
