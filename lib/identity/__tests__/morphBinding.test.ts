/**
 * Rig binding — the layer that stops "the sliders do nothing" reaching a build.
 *
 * Tested against three realistic rig naming conventions, because the whole
 * point is that no two rigs agree and a guess produces silent dead controls.
 */

import {
  bindGenomeToRig,
  genomeToInfluences,
  describeBinding,
  FACE_MORPH_KEYS,
  randomizeFace,
  neutralMorphs,
} from '@/lib/identity';

/** Route B: an artist authors shapes named after our own morphs. */
const AUTHORED = [...FACE_MORPH_KEYS] as string[];

/** Blender-ish: snake_case, mixed casing, some side suffixes. */
const BLENDER = [
  'jaw_width', 'Jaw Angle', 'chin_length', 'chin_protrusion',
  'cheekbone_height', 'cheek_fullness', 'brow_height_L', 'brow_height_R',
  'eye_size_L', 'eye_size_R', 'nose_width', 'nose_bridge', 'mouth_width',
  'lip_fullness', 'ear_size', 'face_width',
];

/** MetaHuman / ARKit: EXPRESSION shapes, not sculpting ones. */
const ARKIT = [
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthPucker', 'mouthStretchLeft',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browDownLeft',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight',
  'cheekPuff', 'cheekSquintLeft', 'noseSneerLeft', 'noseSneerRight',
  'tongueOut', 'mouthFunnel', 'eyeLookUpLeft',
];

describe('bindGenomeToRig', () => {
  it('binds every app morph when the rig is authored to match (route B)', () => {
    const b = bindGenomeToRig(AUTHORED);
    expect(b.unbound).toEqual([]);
    expect(b.unused).toEqual([]);
    expect(Object.keys(b.bound).length).toBe(FACE_MORPH_KEYS.length);
  });

  it('matches through case, separators and side suffixes', () => {
    const b = bindGenomeToRig(BLENDER);
    expect(b.bound.jawWidth).toContain('jaw_width');
    expect(b.bound.jawAngle).toContain('Jaw Angle');
    expect(b.bound.cheekboneHeight).toContain('cheekbone_height');
    // One symmetric app morph legitimately drives BOTH sides of a split rig.
    expect(b.bound.browHeight).toEqual(expect.arrayContaining(['brow_height_L', 'brow_height_R']));
    expect(b.bound.eyeSize).toEqual(expect.arrayContaining(['eye_size_L', 'eye_size_R']));
  });

  it('reports dead sliders rather than silently binding nothing', () => {
    // The failure this whole module exists to prevent.
    const b = bindGenomeToRig(BLENDER);
    expect(b.unbound.length).toBeGreaterThan(0);
    expect(b.unbound).toContain('noseTip');
    expect(describeBinding(b)).toMatch(/DEAD SLIDERS/);
  });

  it('binds only partially against an ARKit expression rig — as expected', () => {
    // Confirms Finding 4 concretely: an expression rig cannot drive a sculpting
    // UI. Most app morphs must come out UNBOUND, and that has to be visible.
    const b = bindGenomeToRig(ARKIT);
    expect(b.unbound.length).toBeGreaterThan(FACE_MORPH_KEYS.length / 2);
    expect(b.unbound).toContain('noseLength');
    expect(b.unbound).toContain('faceLength');
  });

  it('never binds one rig morph to two app morphs', () => {
    for (const rig of [AUTHORED, BLENDER, ARKIT]) {
      const b = bindGenomeToRig(rig);
      const all = Object.values(b.bound).flat();
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('accounts for every rig morph exactly once, bound or unused', () => {
    for (const rig of [AUTHORED, BLENDER, ARKIT]) {
      const b = bindGenomeToRig(rig);
      const total = Object.values(b.bound).flat().length + b.unused.length;
      expect(total).toBe(rig.length);
    }
  });

  it('handles an empty rig without throwing', () => {
    const b = bindGenomeToRig([]);
    expect(b.unbound.length).toBe(FACE_MORPH_KEYS.length);
    expect(b.unused).toEqual([]);
  });
});

describe('genomeToInfluences', () => {
  const binding = bindGenomeToRig(AUTHORED);

  it('maps a neutral genome to zero influence everywhere', () => {
    const genome = { ...randomizeFace('x'), morphs: neutralMorphs() };
    const { influences } = genomeToInfluences(genome, binding);
    for (const v of Object.values(influences)) expect(v).toBeCloseTo(0, 6);
  });

  it('maps a railed morph to full influence', () => {
    const genome = { ...randomizeFace('x'), morphs: { ...neutralMorphs(), jawWidth: 1 } };
    const { influences } = genomeToInfluences(genome, binding);
    expect(influences.jawWidth).toBeCloseTo(1, 6);
  });

  it('keeps every influence inside [0, 1] for any genome', () => {
    for (let i = 0; i < 100; i++) {
      const { influences } = genomeToInfluences(randomizeFace(`g${i}`, { spread: 1 }), binding);
      for (const v of Object.values(influences)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reports one-sided axes instead of silently deadening half the slider', () => {
    // A rig with only "wider" has nowhere to put "narrower". Clamping would make
    // the bottom half of the slider inert — a dead slider by another name.
    const genome = { ...randomizeFace('x'), morphs: { ...neutralMorphs(), jawWidth: 0 } };
    const { oneSided } = genomeToInfluences(genome, binding);
    expect(oneSided).toContain('jawWidth');
  });

  it('does not flag one-sided when the rig offers an opposing shape', () => {
    const b = bindGenomeToRig(['jawWidth', 'jawWidthNarrow']);
    const genome = { ...randomizeFace('x'), morphs: { ...neutralMorphs(), jawWidth: 0 } };
    expect(genomeToInfluences(genome, b).oneSided).not.toContain('jawWidth');
  });

  it('survives a corrupt genome value', () => {
    const genome = { ...randomizeFace('x'), morphs: { ...neutralMorphs(), jawWidth: NaN as number } };
    const { influences } = genomeToInfluences(genome, binding);
    expect(Number.isFinite(influences.jawWidth)).toBe(true);
  });
});
