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
  LEGACY_MORPH_COUNT,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  LIP_COLORS,
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
 * Per-morph mean shift applied to a MALE character, in slider units.
 *
 * Facial dimorphism is a soft statistical tendency, not a partition, so this
 * moves the CENTRE of the distribution and leaves its spread alone. Every value
 * remains reachable for every character; a narrow-jawed male and a heavy-browed
 * female are both still rolled, just less often, which is what "tendency"
 * means. Non-male characters get the same shifts negated.
 *
 * Without it, `sex` biased nothing but the hairstyle: a player who chose female
 * got the same head with longer hair, which in a game about living a life is
 * not a small thing to get wrong.
 *
 * The signs are the uncontroversial ones — wider and squarer jaw, heavier brow
 * ridge, lower-set brows, longer nose, thinner lips. Deliberately SMALL, around
 * a third of a slider at most: pushed further it stops being a tendency and
 * starts being two fixed faces, which is the failure the previous note here
 * warned about and was right to.
 */
const MALE_BIAS: Partial<Record<FaceMorphKey, number>> = {
  jawWidth: 0.16,
  jawAngle: 0.14,
  chinProtrusion: 0.10,
  browProtrusion: 0.18,
  browHeight: -0.12,
  cheekboneHeight: -0.06,
  noseLength: 0.10,
  noseWidth: 0.10,
  lipFullness: -0.12,
  faceWidth: 0.08,
  neckThickness: 0.20,
};

/**
 * A complete random face from a stable seed.
 *
 * Morphs are not PARTITIONED by sex — see `MALE_BIAS` for what is and is not
 * done, and why the difference matters.
 */
export function randomizeFace(seed: string, options: RandomizeFaceOptions = {}): FaceGenome {
  const rng = makeGenomeRng(seed);
  const spread = clampRange(options.spread ?? 0.55, 0.1, 1);
  const isMale = String(options.sex || '').toLowerCase() === 'male';

  // A sex was only supplied for some callers; an unspecified one gets the
  // unbiased centre rather than being treated as female.
  const stated = String(options.sex || '').toLowerCase();
  const bias = stated === 'male' ? 1 : stated === 'female' ? -1 : 0;

  // TWO STREAMS, AND THE SPLIT IS LOAD-BEARING.
  //
  // One draw per morph, in key order, from one seeded stream — so a morph
  // appended to `FACE_MORPH_KEYS` consumes a draw and shifts every later one,
  // INCLUDING the palette indices drawn after this loop. Appending the second
  // batch of seven on the main stream would have handed every existing seeded
  // character a different skin tone, hair colour, eye colour and haircut, for a
  // change that was supposed to add sliders. Nothing would have looked broken;
  // they would just have been different people.
  //
  // So the original twenty-four keep the original stream, and anything after
  // them draws from a second one derived from the same seed. A third batch
  // appends the same way and costs nothing.
  const morphs = {} as FaceMorphs;
  const legacy = FACE_MORPH_KEYS.slice(0, LEGACY_MORPH_COUNT);
  const appended = FACE_MORPH_KEYS.slice(LEGACY_MORPH_COUNT);
  for (const key of legacy) {
    morphs[key] = clamp01(sampleMorph(rng, spread) + bias * (MALE_BIAS[key] ?? 0));
  }
  const extraRng = makeGenomeRng(`${seed}#morphs2`);
  for (const key of appended) {
    morphs[key] = clamp01(sampleMorph(extraRng, spread) + bias * (MALE_BIAS[key] ?? 0));
  }

  // Hair: biased, never forbidden — a male character can still have long hair
  // and a female one a buzz cut. Repetition is the weighting.
  //
  // These pools list the styles by NAME, so a style added to HAIR_STYLES and
  // not added here can never be rolled. Twenty of the thirty-five were in
  // exactly that position — every everyday cut in the set, unreachable by the
  // randomiser and therefore never seen on an NPC or a first-roll character.
  const hairPool: HairStyle[] = isMale
    ? [
      'bald', 'buzz', 'buzzFade', 'crew', 'short', 'short', 'caesar',
      'taperFade', 'taperFade', 'highFade', 'ivyLeague', 'sidePart',
      'combOver', 'slickBack', 'pompadour', 'quiff', 'texturedCrop',
      'messy', 'spiky', 'flatTop', 'undercut', 'mohawk', 'cornrows',
      'afro', 'curls', 'medium', 'long', 'receding', 'fringe', 'bowl',
    ]
    : [
      'pixie', 'bob', 'bob', 'short', 'medium', 'medium', 'layered',
      'layered', 'wavy', 'wavy', 'curtains', 'long', 'long', 'ponytail',
      'bun', 'afro', 'curls', 'sidePart', 'messy', 'cornrows', 'buzz',
      'fringe', 'bowl', 'pixie',
    ];
  const hairStyle = hairPool[Math.floor(rng() * hairPool.length)] ?? 'short';

  // Facial hair is overwhelmingly a male trait, so non-male characters get
  // 'none' outright rather than a low-probability roll that would surprise a
  // player who never asked for it.
  //
  // The draw happens either way and is DISCARDED for non-male, rather than being
  // skipped. Skipping it shifted every later draw by one, so the same seed gave
  // a male and a female character different skin tones, hair colours and eye
  // colours — `sex` silently reaching three traits it has nothing to do with.
  // Nothing was visibly broken by it, which is why it survived: a random face is
  // a random face either way. It showed up the moment two sexes of ONE seed were
  // rendered side by side to check the face bias, and the two heads differed in
  // colouring as well, which is exactly the comparison the bias needs to be
  // judged on.
  const facialHairRoll = FACIAL_HAIR_STYLES[Math.floor(rng() * FACIAL_HAIR_STYLES.length)];
  const facialHair: FacialHairStyle = isMale ? facialHairRoll ?? 'none' : 'none';

  return {
    morphs,
    skinTone: Math.floor(rng() * SKIN_TONES.length),
    // Indices 0-8 are the colours people are BORN with.
    //
    // 9 and 10 are grey and white, which this used to sample: it handed newborns
    // and twenty-year-olds white hair at a rate of one in six. They are AGE
    // colours — `applyAging` moves a character onto them from 40 — and 11-13 are
    // dyes, which are a choice. Neither belongs in a birth roll.
    hairColor: Math.floor(rng() * 9),
    eyeColor: Math.floor(rng() * EYE_COLORS.length),
    hairStyle,
    facialHair,
    blemishes: clamp01(rng() * 0.6),
    // Grooming and complexion. Bell-sampled at a narrow spread for the same
    // reason the morphs are: an even draw gives half the population an extreme
    // on every axis, and a face with the thinnest possible brows AND the
    // shiniest possible skin is a caricature nobody rolled for.
    //
    // Drawn AFTER everything above so a seed that produced a given face before
    // these existed still produces that face. Appending is not a style choice
    // here — inserting a draw shifts every later one, which is how `sex` once
    // reached skin tone, hair colour and eye colour.
    browThickness: sampleMorph(rng, 0.55),
    beardDensity: sampleMorph(rng, 0.55),
    skinUndertone: sampleMorph(rng, 0.7),
    skinShine: sampleMorph(rng, 0.5),
    // browColor and beardColor are left undefined: following the hair is what
    // almost everyone's do, and it keeps a random face from arriving with
    // eyebrows that do not belong to it.
    //
    // MAKEUP IS NOT ROLLED, and it consumes no draw. Constants rather than
    // samples on purpose — twice over. A randomiser that puts lipstick on a
    // character nobody asked to wear it is one the player fights, and drawing
    // for it would extend the stream, which is the thing that silently re-rolls
    // every existing seeded face (see `LEGACY_MORPH_COUNT`).
    lipStrength: 0,
    eyeshadowStrength: 0,
    blush: 0,
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
    browThickness: clamp01(input.browThickness ?? 0.5),
    beardDensity: clamp01(input.beardDensity ?? 0.5),
    skinUndertone: clamp01(input.skinUndertone ?? 0.5),
    skinShine: clamp01(input.skinShine ?? 0.5),
    // Spread rather than assigned, so an absent key STAYS absent. Writing
    // `browColor: undefined` would be the same value and a different object —
    // and `'browColor' in genome` is how the renderer asks whether to derive
    // the colour from the hair or to obey the player.
    ...paletteOverride('browColor', input.browColor),
    ...paletteOverride('beardColor', input.beardColor),
    // Makeup. Defaults to NONE rather than to neutral, unlike everything above
    // it: 0.5 undertone is a face, 0.5 lipstick is a decision. An existing save
    // that has never heard of these renders exactly as it did before.
    lipStrength: clampOff(input.lipStrength),
    eyeshadowStrength: clampOff(input.eyeshadowStrength),
    blush: clampOff(input.blush),
    ...makeupOverride('lipColor', input.lipColor),
    ...makeupOverride('eyeshadowColor', input.eyeshadowColor),
  };
}

/**
 * Clamp a makeup strength, defaulting a broken value to OFF.
 *
 * Not `clamp01`, which resolves a non-finite number to 0.5 — the neutral
 * midpoint, and the right answer for a morph or an undertone, where "no value"
 * means "the middle of the range". A makeup strength has no middle: 0.5 is half
 * a face of lipstick, and a corrupt save should not put makeup on a character
 * who never chose any. Absence and corruption both mean none.
 */
function clampOff(value: unknown): number {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** The same rule as `paletteOverride`, against the makeup palette. */
function makeupOverride(
  key: 'lipColor' | 'eyeshadowColor', value: unknown,
): Record<string, number> {
  if (typeof value !== 'number' || !isFinite(value)) return {};
  return { [key]: Math.round(clampRange(value, 0, LIP_COLORS.length - 1)) };
}

/**
 * An optional palette index, present only when it is a real one.
 *
 * These fields mean "the player overrode this"; anything that is not a usable
 * index — undefined, null, a string from a hand-edited save, NaN — means they
 * did not, and must come back absent rather than clamped to 0. Clamping would
 * turn every corrupt value into "black", which is a choice the player did not
 * make and cannot tell apart from one they did.
 */
function paletteOverride(
  key: 'browColor' | 'beardColor', value: unknown,
): Record<string, number> {
  if (typeof value !== 'number' || !isFinite(value)) return {};
  return { [key]: Math.round(clampRange(value, 0, HAIR_COLORS.length - 1)) };
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
    // Blended like the morphs are, with the same small mutation. Brow thickness
    // and skin undertone run in families as visibly as a nose does — a child who
    // inherits neither parent's colouring is the thing that makes a family tree
    // stop reading as a family.
    browThickness: blendTrait(mother.browThickness, father.browThickness, rng),
    beardDensity: blendTrait(mother.beardDensity, father.beardDensity, rng),
    skinUndertone: blendTrait(mother.skinUndertone, father.skinUndertone, rng),
    skinShine: blendTrait(mother.skinShine, father.skinShine, rng),
    // browColor and beardColor are deliberately NOT inherited. They are an
    // override — "this character dyes their brows" — not a trait, and a child
    // born already overriding their own brow colour is nobody's idea of
    // inheritance. Absent means "follow the hair", which is what a baby's do.
    //
    // Makeup is not inherited for the same reason, only more so.
    lipStrength: 0,
    eyeshadowStrength: 0,
    blush: 0,
  };
}

/** One inherited trait: a point between the parents, plus a small mutation. */
function blendTrait(a: number, b: number, rng: () => number): number {
  const mix = rng();
  return clamp01(a * mix + b * (1 - mix) + (rng() - 0.5) * 0.12);
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
    // Brows coarsen and grow out from about fifty. A small, one-directional
    // drift, like the blemishes above — it is one of the few cues that reads as
    // age rather than as a different person.
    browThickness: clamp01(genome.browThickness + clampRange((a - 48) / 40, 0, 1) * 0.22),
    // Skin peaks oily in the teens and dries steadily after thirty. Both ends
    // are real and both are legible: a shiny teenager and a matte seventy-year
    // -old are recognisable without a single wrinkle being drawn.
    skinShine: clamp01(
      genome.skinShine
      + clampRange((20 - a) / 8, 0, 1) * 0.20
      - clampRange((a - 30) / 45, 0, 1) * 0.30,
    ),
    // Undertone and beard density are authored, not aged. Undertone does not
    // change over a life, and a beard that thickens on its own would overwrite
    // a choice the player made rather than express one.
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
