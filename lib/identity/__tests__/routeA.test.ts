/**
 * Route A (preset heads) — the guarantee that a preset creator never ships a
 * slider the rig cannot move.
 *
 * A preset head's SHAPE is baked in at export, so almost nothing binds. Without
 * the filter the screen would render two dozen controls the player can drag
 * while the face sits still, with no error anywhere. This pins that the binding
 * report is what drives the UI, not a hand-maintained list that can drift.
 */

import { bindGenomeToRig, FACE_MORPH_KEYS } from '@/lib/identity';

/** What a MetaHuman preset actually ships: ARKit expression shapes. */
const METAHUMAN_PRESET = [
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthPucker',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browDownLeft', 'browDownRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight',
  'eyeLookUpLeft', 'eyeLookDownLeft', 'cheekPuff', 'cheekSquintLeft',
  'noseSneerLeft', 'noseSneerRight', 'tongueOut', 'mouthShrugUpper',
];

describe('route A — preset heads', () => {
  const binding = bindGenomeToRig(METAHUMAN_PRESET);

  it('leaves most sculpting morphs unbound, as a preset rig must', () => {
    // If this ever passes with a LOW unbound count, someone has wired sculpting
    // morphs to expression shapes and the face will deform wrongly.
    expect(binding.unbound.length).toBeGreaterThan(FACE_MORPH_KEYS.length * 0.5);
  });

  it('never binds a sculpting morph to an unrelated expression shape', () => {
    // The dangerous failure: a bound-but-wrong slider actively deforms the face
    // and reads as a modelling bug rather than a wiring one.
    const flat = Object.values(binding.bound).flat();
    expect(flat).not.toContain('tongueOut');
    expect(flat).not.toContain('eyeLookUpLeft');
    expect(flat).not.toContain('eyeLookDownLeft');
  });

  it('reports unused rig morphs so the optimizer can strip them', () => {
    // Every unused expression shape is pure bundle cost on a preset head.
    expect(binding.unused.length).toBeGreaterThan(0);
    for (const name of binding.unused) expect(METAHUMAN_PRESET).toContain(name);
  });

  it('accounts for every rig morph exactly once', () => {
    const total = Object.values(binding.bound).flat().length
      + Object.values(binding.negative).flat().length
      + binding.unused.length;
    expect(total).toBe(METAHUMAN_PRESET.length);
  });

  it('gives the UI enough to hide every dead control', () => {
    // The contract FaceStudio relies on: unbound ∪ bound covers all app morphs,
    // so filtering by `unbound` can never leave a dead slider visible.
    const live = new Set(Object.keys(binding.bound));
    for (const key of FACE_MORPH_KEYS) {
      expect(live.has(key) || binding.unbound.includes(key)).toBe(true);
    }
  });
});
