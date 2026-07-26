/**
 * Face genome — creation, inheritance, aging.
 *
 * Pure functions over `FaceGenome`. No React, no GL. The 3D creator, the child
 * generator and the weekly aging tick all funnel through here, so there is
 * exactly one definition of "what a face is allowed to be".
 *
 * ## Determinism
 *
 * `randomizeFace(seed)` is seeded, not `Math.random()`, for the same reason the
 * weekly ticks are (see `utils/seededRoll.ts`): React 19 runs `setGameState`
 * updaters twice in StrictMode, so an unseeded generator would produce a
 * different face on each invocation and commit whichever render React kept. A
 * seeded genome also means an NPC's face can be regenerated from their id
 * instead of stored, which keeps saves small.
 */

import {
  FACE_MORPH_KEYS,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  EYE_COLORS,
  SKIN_TONES,
  type FaceGenome,
  type FaceMorphKey,
  type FaceMorphs,
  type FacialHairStyle,
  type HairStyle,
} from './types';

/** mulberry32 over an FNV-1a string hash — same construction as `seededRoll`. */
export function makeGenomeRng(seed: string): () => number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamp helper — every boundary in this file goes through it. */
function clamp01(n: number): number {
  if (!isFinite(n)) return 0.5;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clampRange(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

/** Every morph at its neutral midpoint. */
export function neutralMorphs(): FaceMorphs {
  const morphs = {} as FaceMorphs;
  for (const key of FACE_MORPH_KEYS) {
    morphs[key] = 0.5;
  }
  return morphs;
}

/**
 * Force a morph record into a renderable state.
 *
 * Called on EVERY path that produces morphs — random, inherited, aged, loaded
 * from a save, edited by a slider. A save is user-writable in principle and a
 * migration can hand us a partial object, so an out-of-range or missing morph
 * has to resolve to neutral rather than deforming the mesh.
 */
export function clampMorphs(input: Partial<FaceMorphs> | null | undefined): FaceMorphs {
  const morphs = {} as FaceMorphs;
  for (const key of FACE_MORPH_KEYS) {
    const raw = input?.[key];
    morphs[key] = typeof raw === 'number' ? clamp01(raw) : 0.5;
  }
  return morphs;
}

/**
 * Sample a morph with a centre bias.
 *
 * A flat uniform draw over [0, 1] gives every face an extreme value on roughly
 * half its morphs, and the population reads as a freak show. Averaging three
 * draws approximates a normal distribution around 0.5, so most faces are
 * ordinary and the striking ones are rare — which is both realistic and what
 * makes a good roll feel like a good roll.
 */
function sampleMorph(rng: () => number, spread: number): number {
  const bell = (rng() + rng() + rng()) / 3;
  return clamp01(0.5 + (bell - 0.5) * spread * 2);
}

export interface RandomizeFaceOptions {
  /** Biases hair/facial-hair defaults. Morphs themselves are not sex-gated. */
  sex?: string;
  /**
   * How far from neutral a random face may wander. 1 = full range.
   *
   * Defaults to 0.55, which puts the per-morph standard deviation at ~0.18 and
   * leaves only ~5% of morphs beyond +/-0.35 from neutral. The first pass used
   * 0.85 and the distribution test caught it: ~19% of morphs landed in the
   * extremes, which is the freak-show population the bell sampler exists to
   * prevent. 0.55 still gives obviously distinct faces — it just stops nearly
   * every one of them from having a caricatured feature.
   */
  spread?: number;
}

/**
 * A complete random face from a stable seed.
 *
 * Morphs are NOT split by sex. Real facial dimorphism is a soft statistical
 * tendency, not a partition, and hard-coding "male jaws are wide" would make
 * every male character look identical along the axis players most want control
 * of. Sex only biases hair and facial hair, which are choices rather than
 * anatomy — and the player can override both in the creator.
 */
export function randomizeFace(seed: string, options: RandomizeFaceOptions = {}): FaceGenome {
  const rng = makeGenomeRng(seed);
  const spread = clampRange(options.spread ?? 0.55, 0.1, 1);
  const isMale = String(options.sex || '').toLowerCase() === 'male';

  const morphs = {} as FaceMorphs;
  for (const key of FACE_MORPH_KEYS) {
    morphs[key] = sampleMorph(rng, spread);
  }

  // Hair: the tail of the list (ponytail/bun) reads feminine, so bias the pick
  // rather than forbidding anything — a male character can still have long hair.
  const hairPool: HairStyle[] = isMale
    ? ['bald', 'buzz', 'short', 'short', 'medium', 'medium', 'long', 'afro']
    : ['buzz', 'short', 'medium', 'medium', 'long', 'long', 'ponytail', 'bun', 'afro'];
  const hairStyle = hairPool[Math.floor(rng() * hairPool.length)] ?? 'short';

  // Facial hair is overwhelmingly a male trait, so non-male characters get
  // 'none' outright rather than a low-probability roll that would surprise a
  // player who never asked for it.
  const facialHair: FacialHairStyle = isMale
    ? FACIAL_HAIR_STYLES[Math.floor(rng() * FACIAL_HAIR_STYLES.length)] ?? 'none'
    : 'none';

  return {
    morphs,
    skinTone: Math.floor(rng() * SKIN_TONES.length),
    // Natural hair colours occupy the first 11 entries; the last three are dyes.
    // Random people are not born purple, so sample the natural range only.
    hairColor: Math.floor(rng() * 11),
    eyeColor: Math.floor(rng() * EYE_COLORS.length),
    hairStyle,
    facialHair,
    blemishes: clamp01(rng() * 0.6),
  };
}

/**
 * Force a loaded/partial genome into a valid one.
 *
 * Index fields are clamped into their palette rather than defaulted to 0, so a
 * save written by a build with a longer palette degrades to the nearest valid
 * colour instead of silently turning everyone pale.
 */
export function normalizeGenome(input: Partial<FaceGenome> | null | undefined, seed = 'default'): FaceGenome {
  if (!input || typeof input !== 'object') {
    return randomizeFace(seed);
  }
  const hairStyle = HAIR_STYLES.includes(input.hairStyle as HairStyle)
    ? (input.hairStyle as HairStyle)
    : 'short';
  const facialHair = FACIAL_HAIR_STYLES.includes(input.facialHair as FacialHairStyle)
    ? (input.facialHair as FacialHairStyle)
    : 'none';
  return {
    morphs: clampMorphs(input.morphs),
    skinTone: Math.round(clampRange(input.skinTone ?? 3, 0, SKIN_TONES.length - 1)),
    hairColor: Math.round(clampRange(input.hairColor ?? 2, 0, HAIR_COLORS.length - 1)),
    eyeColor: Math.round(clampRange(input.eyeColor ?? 0, 0, EYE_COLORS.length - 1)),
    hairStyle,
    facialHair,
    blemishes: clamp01(input.blemishes ?? 0.2),
  };
}

/**
 * Blend two faces into a child's.
 *
 * Each morph independently picks a random point on the segment between the two
 * parents, plus a small mutation. Independent per-morph draws are what make
 * siblings look related but not identical — a single global blend factor would
 * make every child of the same couple the exact same face.
 *
 * The mutation term is what lets a child have a nose neither parent has. Without
 * it, a lineage converges on the average face within three generations and the
 * family tree turns beige.
 */
export function inheritFace(
  mother: FaceGenome,
  father: FaceGenome,
  seed: string,
  options: RandomizeFaceOptions = {},
): FaceGenome {
  const rng = makeGenomeRng(seed);
  const isMale = String(options.sex || '').toLowerCase() === 'male';

  const morphs = {} as FaceMorphs;
  for (const key of FACE_MORPH_KEYS as readonly FaceMorphKey[]) {
    const mix = rng();
    const blended = mother.morphs[key] * mix + father.morphs[key] * (1 - mix);
    const mutation = (rng() - 0.5) * 0.12;
    morphs[key] = clamp01(blended + mutation);
  }

  // Skin tone lands between the parents (rounded), which is the one axis where a
  // free mutation would read as wrong rather than as variety.
  const toneLow = Math.min(mother.skinTone, father.skinTone);
  const toneHigh = Math.max(mother.skinTone, father.skinTone);
  const skinTone = Math.round(toneLow + rng() * (toneHigh - toneLow));

  // Hair and eye colour are inherited as a straight coin flip between parents.
  // Modelling real recessive inheritance would need allele pairs the save does
  // not carry, and the visible outcome is indistinguishable at this fidelity.
  const inheritedHair = rng() < 0.5 ? mother.hairColor : father.hairColor;
  const inheritedEye = rng() < 0.5 ? mother.eyeColor : father.eyeColor;

  const hairPool: HairStyle[] = isMale
    ? ['buzz', 'short', 'short', 'medium']
    : ['short', 'medium', 'long', 'ponytail'];

  return {
    morphs,
    skinTone: Math.round(clampRange(skinTone, 0, SKIN_TONES.length - 1)),
    // Dyed parents do not produce dyed babies — fold any dye index (>= 11) back
    // into the natural range.
    hairColor: inheritedHair >= 11 ? Math.floor(rng() * 11) : inheritedHair,
    eyeColor: Math.round(clampRange(inheritedEye, 0, EYE_COLORS.length - 1)),
    hairStyle: hairPool[Math.floor(rng() * hairPool.length)] ?? 'short',
    facialHair: 'none',
    blemishes: clamp01((mother.blemishes + father.blemishes) / 2 + (rng() - 0.5) * 0.2),
  };
}

/**
 * Age a face WITHOUT mutating the genome.
 *
 * This is the key move for "the avatar ages with you": the stored genome is the
 * player's authored face and never changes, and aging is a pure function
 * `(genome, age) -> genome` applied at render time. So a 70-year-old is
 * recognisably the 20-year-old the player built — which is exactly what the
 * pre-rendered portrait pool could not do, since it swapped in a stranger's
 * face at each age band.
 *
 * Nothing here is stored. Call it in the renderer, not in the reducer.
 */
export function applyAging(genome: FaceGenome, age: number): FaceGenome {
  const a = clampRange(age, 0, 120);
  const m = { ...genome.morphs };

  // Childhood: large eyes, small nose, round face, high forehead. Interpolated
  // continuously to 18 so a child's face grows rather than snapping at a
  // birthday.
  if (a < 18) {
    const childness = 1 - a / 18;
    m.eyeSize = clamp01(m.eyeSize + 0.28 * childness);
    m.noseLength = clamp01(m.noseLength - 0.22 * childness);
    m.noseWidth = clamp01(m.noseWidth - 0.12 * childness);
    m.cheekFullness = clamp01(m.cheekFullness + 0.3 * childness);
    m.jawWidth = clamp01(m.jawWidth - 0.22 * childness);
    m.jawAngle = clamp01(m.jawAngle - 0.18 * childness);
    m.chinLength = clamp01(m.chinLength - 0.2 * childness);
    m.foreheadSlope = clamp01(m.foreheadSlope + 0.18 * childness);
    m.faceLength = clamp01(m.faceLength - 0.2 * childness);
    m.neckThickness = clamp01(m.neckThickness - 0.25 * childness);
    m.browProtrusion = clamp01(m.browProtrusion - 0.15 * childness);
  }

  // Adulthood: soft tissue descends, cartilage keeps growing, fat pads deflate.
  // All three are real, and all three are what makes an old face read as old.
  if (a > 30) {
    const aged = clampRange((a - 30) / 55, 0, 1);
    m.cheekFullness = clamp01(m.cheekFullness - 0.24 * aged);
    m.cheekboneHeight = clamp01(m.cheekboneHeight - 0.1 * aged);
    m.eyeDepth = clamp01(m.eyeDepth + 0.22 * aged);
    m.eyeSize = clamp01(m.eyeSize - 0.12 * aged);
    m.noseLength = clamp01(m.noseLength + 0.16 * aged);
    m.noseTip = clamp01(m.noseTip - 0.14 * aged);
    m.earSize = clamp01(m.earSize + 0.18 * aged);
    m.lipFullness = clamp01(m.lipFullness - 0.2 * aged);
    m.browHeight = clamp01(m.browHeight - 0.14 * aged);
    m.jawAngle = clamp01(m.jawAngle - 0.12 * aged);
    m.faceLength = clamp01(m.faceLength + 0.08 * aged);
  }

  // Greying: starts ~40, effectively complete by ~75. Index 9/10 are the grey
  // and white entries in `HAIR_COLORS`; a dyed head (>= 11) stays dyed, because
  // dye is precisely the thing that hides grey.
  let hairColor = genome.hairColor;
  if (a >= 40 && genome.hairColor < 11) {
    const grey = clampRange((a - 40) / 35, 0, 1);
    if (grey > 0.75) hairColor = 10;
    else if (grey > 0.35) hairColor = 9;
  }

  // Male-pattern recession is modelled as a style change, not a morph, because
  // it is the hair mesh that changes. Only applied to already-short styles so a
  // player who chose long hair keeps it.
  let hairStyle = genome.hairStyle;
  if (a >= 55 && (genome.hairStyle === 'short' || genome.hairStyle === 'buzz')) {
    // Deterministic from the genome, not a roll — the same character must not
    // regrow hair between two renders of the same frame.
    if (genome.morphs.foreheadSlope > 0.62) {
      hairStyle = a >= 68 ? 'bald' : 'buzz';
    }
  }

  return {
    ...genome,
    morphs: m,
    hairColor,
    hairStyle,
    // Sun damage and age spots accumulate and never reverse.
    blemishes: clamp01(genome.blemishes + clampRange((a - 35) / 60, 0, 1) * 0.35),
  };
}

/**
 * Facial symmetry, [0, 1].
 *
 * Symmetry is the single most robust cross-cultural correlate of perceived
 * attractiveness, so `presence` needs a number for it. The genome has no
 * left/right split (the mesh is mirrored), so there is no literal asymmetry to
 * measure — instead this scores how *balanced* the proportions are, treating
 * extreme values on paired features as imbalance. It is a proxy, and an
 * intentionally gentle one: the range is compressed so a randomized face is
 * rarely punished hard for one unlucky slider.
 */
export function facialHarmony(genome: FaceGenome): number {
  const m = genome.morphs;
  // Pairs whose *relationship* matters more than either value alone.
  const tensions = [
    Math.abs(m.faceWidth - (1 - m.faceLength)),
    Math.abs(m.jawWidth - m.cheekboneHeight),
    Math.abs(m.eyeSpacing - 0.5) * 2,
    Math.abs(m.noseWidth - m.mouthWidth),
    Math.abs(m.chinLength - m.foreheadSlope),
    Math.abs(m.browHeight - m.eyeSize),
  ];
  const meanTension = tensions.reduce((sum, t) => sum + t, 0) / tensions.length;
  // meanTension is realistically ~0.1-0.5; map that onto a usable 0.3-1.0 band.
  return clamp01(1 - meanTension * 1.4);
}
