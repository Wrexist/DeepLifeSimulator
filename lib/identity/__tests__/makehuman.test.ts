/**
 * Binding against MakeHuman's target set — the route that makes the creator a
 * real sculpting editor rather than a preset picker.
 *
 * MakeHuman's modelling system IS morph targets: every slider applies a
 * `.target` file of `vertexIndex dx dy dz` deltas to one fixed-topology base
 * mesh. That is the same representation glTF morph targets use, so the sliders
 * in the design can be genuinely live — unlike an ARKit/MetaHuman rig, whose
 * blendshapes are expressions and cannot change face SHAPE at all.
 *
 * Its naming conventions differ from every other rig in two ways that each
 * caused a silent, face-breaking bug before these tests existed:
 *
 *   - side is a PREFIX (`l-eye-scale-incr`), not a suffix
 *   - every axis is BIPOLAR, spelled `-decr` / `-incr`
 *
 * The `-incr` half is the trap. The negative-marker pattern used to be
 * unanchored and contained `in`, which matches inside `incr` — so the POSITIVE
 * half of all ~1000 targets was classified as negative and both ends of every
 * slider drove the same direction.
 */

import {
  bindGenomeToRig,
  genomeToInfluences,
  randomizeFace,
  FACE_MORPH_KEYS,
  neutralMorphs,
} from '@/lib/identity';
import type { FaceGenome } from '@/lib/identity';

/**
 * A realistic slice of MakeHuman's `data/targets` tree — the axes the creator
 * drives, both halves of each, with the left/right splits it really ships.
 */
const MAKEHUMAN = [
  // head
  'head-scale-horiz-decr', 'head-scale-horiz-incr',
  'head-scale-vert-decr', 'head-scale-vert-incr',
  'head-scale-depth-decr', 'head-scale-depth-incr',
  'head-oval', 'head-round', 'head-square', 'head-rectangular', 'head-triangle',
  // forehead
  'forehead-nubian-decr', 'forehead-nubian-incr',
  'forehead-scale-vert-decr', 'forehead-scale-vert-incr',
  // eyebrows
  'eyebrows-trans-down', 'eyebrows-trans-up',
  // nose
  'nose-scale-horiz-decr', 'nose-scale-horiz-incr',
  'nose-scale-vert-decr', 'nose-scale-vert-incr',
  'nose-hump-decr', 'nose-hump-incr',
  'nose-point-width-decr', 'nose-point-width-incr',
  'nose-nostrils-angle-down', 'nose-nostrils-angle-up',
  // mouth
  'mouth-scale-horiz-decr', 'mouth-scale-horiz-incr',
  'mouth-upperlip-volume-decr', 'mouth-upperlip-volume-incr',
  'mouth-lowerlip-volume-decr', 'mouth-lowerlip-volume-incr',
  'mouth-trans-down', 'mouth-trans-up',
  // eyes (left/right split, side as a PREFIX)
  'l-eye-scale-decr', 'l-eye-scale-incr', 'r-eye-scale-decr', 'r-eye-scale-incr',
  'l-eye-move-in', 'l-eye-move-out', 'r-eye-move-in', 'r-eye-move-out',
  'l-eye-push1-in', 'l-eye-push1-out', 'r-eye-push1-in', 'r-eye-push1-out',
  'l-eye-corner1-down', 'l-eye-corner1-up', 'r-eye-corner1-down', 'r-eye-corner1-up',
  // cheeks
  'l-cheek-bones-decr', 'l-cheek-bones-incr', 'r-cheek-bones-decr', 'r-cheek-bones-incr',
  'l-cheek-inner-decr', 'l-cheek-inner-incr', 'r-cheek-inner-decr', 'r-cheek-inner-incr',
  // chin / jaw
  'chin-bones-decr', 'chin-bones-incr',
  'chin-prognathism-decr', 'chin-prognathism-incr',
  'chin-height-decr', 'chin-height-incr',
  'chin-prominent-decr', 'chin-prominent-incr',
  // ears
  'l-ear-scale-decr', 'l-ear-scale-incr', 'r-ear-scale-decr', 'r-ear-scale-incr',
  // neck
  'neck-scale-horiz-decr', 'neck-scale-horiz-incr',
];

describe('MakeHuman target binding', () => {
  const binding = bindGenomeToRig(MAKEHUMAN);

  it('binds all 24 app morphs — every slider in the creator is live', () => {
    // This is the whole reason MakeHuman beats a MetaHuman preset: it is a
    // sculpting set, so nothing has to be hidden as a dead control.
    expect(binding.unbound).toEqual([]);
    expect(Object.keys(binding.bound)).toHaveLength(FACE_MORPH_KEYS.length);
  });

  it('gives every morph a negative half, so sliders work below the midpoint', () => {
    const oneSided = FACE_MORPH_KEYS.filter((k) => !binding.negative[k]?.length);
    expect(oneSided).toEqual([]);
  });

  it('never files an `-incr` target as the negative half', () => {
    // The `in`-inside-`incr` bug. If this regresses, both ends of every slider
    // deform the face the same way and nothing reports a problem.
    for (const [key, names] of Object.entries(binding.negative)) {
      for (const name of names) {
        expect(`${key}: ${name}`).not.toMatch(/incr$/);
      }
    }
  });

  it('drives BOTH sides from one symmetric app morph', () => {
    // Side is a prefix in MakeHuman. Missing that binds only the left eye.
    for (const key of ['eyeSize', 'earSize', 'cheekboneHeight'] as const) {
      const names = binding.bound[key] ?? [];
      expect(names.some((n) => n.startsWith('l-'))).toBe(true);
      expect(names.some((n) => n.startsWith('r-'))).toBe(true);
    }
  });

  it('does not confuse axes that share a prefix', () => {
    // `nose-scale-horiz` is WIDTH and `nose-scale-vert` is LENGTH. Fuzzy
    // substring matching binds both to whichever key is tried first — a wrong
    // binding, which deforms the face and reads as a modelling bug rather than
    // a wiring one.
    expect(binding.bound.noseWidth).toEqual(['nose-scale-horiz-incr']);
    expect(binding.bound.noseLength).toEqual(['nose-scale-vert-incr']);
    expect(binding.bound.faceWidth).toEqual(['head-scale-horiz-incr']);
    expect(binding.bound.faceLength).toEqual(['head-scale-vert-incr']);
  });

  it('drives the positive and negative halves exclusively', () => {
    const genome = { ...randomizeFace('mh'), morphs: neutralMorphs() } satisfies FaceGenome;
    genome.morphs.noseWidth = 1; // fully wide
    const { influences } = genomeToInfluences(genome, binding);
    expect(influences['nose-scale-horiz-incr']).toBeCloseTo(1);
    expect(influences['nose-scale-horiz-decr']).toBe(0);

    genome.morphs.noseWidth = 0; // fully narrow
    const narrow = genomeToInfluences(genome, binding).influences;
    expect(narrow['nose-scale-horiz-incr']).toBe(0);
    expect(narrow['nose-scale-horiz-decr']).toBeCloseTo(1);
  });

  it('reports nothing as one-sided, so no control needs clamping', () => {
    const genome = { ...randomizeFace('mh'), morphs: neutralMorphs() } satisfies FaceGenome;
    for (const key of FACE_MORPH_KEYS) genome.morphs[key] = 0;
    expect(genomeToInfluences(genome, binding).oneSided).toEqual([]);
  });

  it('leaves unmatched targets in `unused` for the optimizer to strip', () => {
    // MakeHuman ships ~1000 targets; shipping the ones nothing drives is pure
    // bundle cost, so they must be reported rather than silently carried.
    expect(binding.unused).toContain('head-oval');
    expect(binding.unused).toContain('nose-nostrils-angle-up');
    expect(binding.unused).not.toContain('nose-scale-horiz-incr');
  });
});
