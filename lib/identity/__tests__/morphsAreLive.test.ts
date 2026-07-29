/**
 * Every morph moves the head, and no two move it the same way.
 *
 * ## Why this is worth a file of its own
 *
 * A slider that renders, saves, inherits, ages and does NOTHING is the single
 * most repeated defect in this chapter. `blemishes` was maintained by four
 * systems and shown by none. `binding.unbound` exists because the preset-head
 * route would otherwise ship two dozen controls that move no vertices. And the
 * sweep tool this was meant to be checked with had a bug of exactly the same
 * shape — it set `genome.nostrilFlare` instead of `genome.morphs.nostrilFlare`,
 * so four renders came back "ok" having changed nothing at all.
 *
 * So this asks the mesh directly, for every morph, with no renderer and no eye
 * involved: pin it low, pin it high, and require the vertices to differ.
 *
 * ## The second assertion is the interesting one
 *
 * Moving vertices is necessary and not sufficient. A new slider that displaces
 * the same vertices in the same direction as an existing one is a duplicate
 * control — it looks like a feature and gives the player nothing, and it is a
 * genuinely easy mistake: "nostril flare" reads as a plausible name for a thing
 * `noseWidth` already does. Comparing the DISPLACEMENT FIELDS catches that,
 * where comparing the meshes cannot.
 */
import { buildHeadMesh } from '@/lib/identity/headMesh';
import { neutralMorphs, normalizeGenome } from '@/lib/identity/faceGenome';
import { FACE_MORPH_KEYS, type FaceMorphKey } from '@/lib/identity/types';

const BASE = normalizeGenome({ morphs: neutralMorphs(), hairStyle: 'bald', facialHair: 'none' });

/** Vertex displacement caused by moving one morph from 0 to 1. */
function displacement(key: FaceMorphKey): Float32Array {
  const low = buildHeadMesh(normalizeGenome({ ...BASE, morphs: { ...BASE.morphs, [key]: 0 } }));
  const high = buildHeadMesh(normalizeGenome({ ...BASE, morphs: { ...BASE.morphs, [key]: 1 } }));
  expect(low.positions.length).toBe(high.positions.length);
  const delta = new Float32Array(low.positions.length);
  for (let i = 0; i < delta.length; i++) delta[i] = high.positions[i] - low.positions[i];
  return delta;
}

const FIELDS = new Map<FaceMorphKey, Float32Array>();
for (const key of FACE_MORPH_KEYS) FIELDS.set(key, displacement(key));

function magnitude(d: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  return Math.sqrt(sum / (d.length / 3));
}

/** Cosine similarity of two displacement fields, treating each as one vector. */
function similarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

describe('no morph is a dead slider', () => {
  it.each([...FACE_MORPH_KEYS])('%s moves the mesh', (key) => {
    // The threshold is in head units, where the whole head is about 1.5 tall.
    // 1e-4 RMS is far below anything visible and far above floating-point
    // noise, so this fails only for a morph that is genuinely inert.
    expect(magnitude(FIELDS.get(key)!)).toBeGreaterThan(1e-4);
  });

  it('lists every morph the studio can show', () => {
    // Guards the other direction: a morph added to the type and never given a
    // term in `buildHeadMesh` would pass nothing above, because it would not be
    // in this list either if the list were hand-written.
    expect(FIELDS.size).toBe(FACE_MORPH_KEYS.length);
    expect(FACE_MORPH_KEYS.length).toBeGreaterThanOrEqual(31);
  });
});

describe('no morph is a duplicate of another', () => {
  /**
   * There are NO exemptions, and that is a finding rather than an omission.
   *
   * Six were written first — face/jaw/temple width, ear size against ear angle,
   * nose width against nostril flare, lip fullness against lip ratio — on the
   * reasoning that each pair acts on overlapping geometry and would read as
   * near-identical. Removing them changed nothing: the suite passes without a
   * single one. Every pair on this head is comfortably under the threshold,
   * including the ones that share a region, because sharing a region is not the
   * same as sharing a direction.
   *
   * Left as a note instead of a set, because an exemption list that excuses
   * pairs which would have passed anyway is worse than none: it reads as
   * evidence that those controls overlap, and the next person to add a morph
   * near one of them will believe it.
   */
  const pairs: [FaceMorphKey, FaceMorphKey][] = [];
  for (let i = 0; i < FACE_MORPH_KEYS.length; i++) {
    for (let j = i + 1; j < FACE_MORPH_KEYS.length; j++) {
      pairs.push([FACE_MORPH_KEYS[i], FACE_MORPH_KEYS[j]]);
    }
  }

  it('no unexplained pair is near-identical', () => {
    const offenders: string[] = [];
    for (const [a, b] of pairs) {
      const s = Math.abs(similarity(FIELDS.get(a)!, FIELDS.get(b)!));
      // 0.9 is "these are the same control with two names". Genuinely different
      // features on a shared surface land well below it — the head is one mesh,
      // so almost every pair has some overlap.
      if (s > 0.9) offenders.push(`${a} vs ${b}: ${s.toFixed(3)}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the seven new ones each do something the old ones did not', () => {
    // The specific risk this whole file exists for. Every one of the second
    // batch is a plausible-sounding name for something an existing morph might
    // already cover.
    const NEW: FaceMorphKey[] = [
      'nostrilFlare', 'philtrumDepth', 'lipRatio', 'cheekHollow',
      'templeWidth', 'chinCleft', 'earAngle',
    ];
    for (const key of NEW) {
      let worst = 0;
      let worstAgainst = '';
      for (const other of FACE_MORPH_KEYS) {
        if (other === key) continue;
        const s = Math.abs(similarity(FIELDS.get(key)!, FIELDS.get(other)!));
        if (s > worst) { worst = s; worstAgainst = other; }
      }
      // Named in the message so a failure says WHICH existing morph the new one
      // duplicates, which is the only thing worth knowing at that point.
      expect(`${key} closest to ${worstAgainst} at ${worst.toFixed(3)}`)
        .toBe(`${key} closest to ${worstAgainst} at ${worst.toFixed(3)}`);
      expect(`${key}/${worstAgainst}:${worst < 0.9}`).toBe(`${key}/${worstAgainst}:true`);
    }
  });
});
