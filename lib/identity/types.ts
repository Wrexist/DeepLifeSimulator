/**
 * Identity & Body — the chapter's type surface.
 *
 * Everything here is PLAIN DATA. No React, no native modules, no three.js. The
 * 3D creator reads a `FaceGenome` and renders it; the weekly tick reads a
 * `BodyProfile` and drifts it. Neither knows about the other, which is what
 * lets the whole chapter be unit-tested without a GPU.
 *
 * ## Why a genome instead of a picked portrait
 *
 * The old system assigned one of ~60 pre-rendered PNGs by (age, sex, seed).
 * That can never show *your* face, and it cannot age continuously — it snaps
 * between age bands. A genome is a small vector of normalized morph values, so:
 *   - the creator can expose it as sliders,
 *   - a child can inherit a genuine blend of two parents,
 *   - aging is a continuous drift applied on top, not an asset swap.
 *
 * ## The 0..1 convention (load-bearing)
 *
 * EVERY morph in `FaceGenome` is normalized to [0, 1] with 0.5 as the neutral
 * midpoint. The renderer maps that range onto real geometry; the sliders map it
 * onto a track; `randomizeFace` samples it; `blendGenomes` averages it. If a
 * morph ever escapes [0, 1] the head deforms into something horrifying, so
 * `clampGenome` is applied at every boundary rather than trusting callers.
 */

/** Morph keys, in the order the creator lists them. */
export const FACE_MORPH_KEYS = [
  'faceWidth',
  'faceLength',
  'jawWidth',
  'jawAngle',
  'chinLength',
  'chinProtrusion',
  'cheekboneHeight',
  'cheekFullness',
  'browHeight',
  'browProtrusion',
  'eyeSize',
  'eyeSpacing',
  'eyeDepth',
  'eyeTilt',
  'noseLength',
  'noseWidth',
  'noseBridge',
  'noseTip',
  'mouthWidth',
  'lipFullness',
  'mouthHeight',
  'earSize',
  'foreheadSlope',
  'neckThickness',
] as const;

export type FaceMorphKey = (typeof FACE_MORPH_KEYS)[number];

/**
 * The parametric face. 24 morphs, each [0, 1] with 0.5 neutral.
 *
 * Kept as a flat record rather than nested groups so blending, clamping and
 * serialization are all one loop over `FACE_MORPH_KEYS`, and so a future morph
 * costs exactly one entry in that array.
 */
export type FaceMorphs = Record<FaceMorphKey, number>;

/** Hair styles the renderer knows how to build. */
export const HAIR_STYLES = [
  'bald',
  'buzz',
  'crew',
  'short',
  'fringe',
  'medium',
  'long',
  'ponytail',
  'bun',
  'afro',
  'curls',
  'mohawk',
  'undercut',
  'quiff',
  'receding',
  // APPEND-ONLY. A saved genome stores the style by name, so reordering or
  // renaming any entry above silently rewrites the hair of every existing
  // character; `normalizeGenome` falls back for names it does not recognise,
  // which turns a rename into a mass reset rather than an error.
  //
  // The everyday cuts. The first fifteen were shape experiments and several are
  // things nobody asks a barber for.
  'sidePart',
  'combOver',
  'slickBack',
  'pompadour',
  'caesar',
  'ivyLeague',
  'taperFade',
  'highFade',
  'buzzFade',
  'texturedCrop',
  'messy',
  'bowl',
  'curtains',
  'layered',
  'bob',
  'pixie',
  'spiky',
  'flatTop',
  'wavy',
  'cornrows',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

/**
 * A style id as a human label: `taperFade` -> "Taper fade".
 *
 * The ids are camelCase because they are keys in the renderer's spec tables and
 * in saved genomes. Printing them raw gave the picker chips reading "SidePart"
 * and "IvyLeague" the moment the everyday cuts were added, so the split lives
 * here — next to the list — rather than in each of the two screens that show it.
 */
export function styleLabel(id: string): string {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Facial hair the renderer knows how to build. */
export const FACIAL_HAIR_STYLES = ['none', 'stubble', 'moustache', 'goatee', 'full'] as const;
export type FacialHairStyle = (typeof FACIAL_HAIR_STYLES)[number];

/**
 * A complete face.
 *
 * `skinTone` is an index into `SKIN_TONES` rather than a hex string so a save
 * can never carry an unrenderable colour, and so the palette can be re-tuned in
 * one place without rewriting every save.
 */
export interface FaceGenome {
  morphs: FaceMorphs;
  /** Index into `SKIN_TONES`. */
  skinTone: number;
  /** Index into `HAIR_COLORS`. */
  hairColor: number;
  /** Index into `EYE_COLORS`. */
  eyeColor: number;
  hairStyle: HairStyle;
  facialHair: FacialHairStyle;
  /**
   * Freckle density, [0, 1]. Purely cosmetic — it does not feed presence,
   * because "has freckles" is not a beauty axis and scoring it would quietly
   * punish a valid aesthetic choice.
   *
   * Rendered in the skin shader, gated to skin by the roughness map so freckles
   * never land on lips or eyebrows. `applyAging` drifts it upward, which is
   * what turns freckles into age spots over a lifetime without a second field.
   *
   * This was stored, randomised, inherited by children and aged for months
   * while NOTHING read it — a field the game maintains and never shows is the
   * same defect as a slider that moves nothing.
   */
  blemishes: number;
}

/**
 * Body simulation state.
 *
 * Stored in real units (kg, cm, %) rather than an abstract 0-100 "fitness" bar
 * because the chapter's premise is realism: the player should be able to read
 * "82 kg, 22% body fat" and have it mean the thing it means. Derived readouts
 * (BMI, silhouette, presence) are computed, never stored — a stored derived
 * value is a desync waiting to happen.
 */
export interface BodyProfile {
  /** Centimetres. Fixed at creation; adults do not grow. */
  heightCm: number;
  /** Kilograms. Drifts weekly with intake vs. expenditure. */
  weightKg: number;
  /** Percent, [3, 60]. The number that actually drives silhouette. */
  bodyFatPct: number;
  /**
   * Lean mass index, [0, 100]. Not kilograms — an abstract "how trained are
   * you" axis, because modelling real hypertrophy needs data the game will
   * never have. 0 = untrained, 50 = active, 100 = elite athlete.
   */
  muscle: number;
  /** Cardiovascular conditioning, [0, 100]. Decays fast, builds slow. */
  fitness: number;
  /** Posture & carriage, [0, 100]. Nudged by fitness, age and confidence. */
  posture: number;
}

/** How well-kept the character is right now. */
export interface StyleProfile {
  /** Haircut freshness, [0, 100]. Decays every week. */
  grooming: number;
  /** Skin condition, [0, 100]. Decays with stress, age, poor sleep. */
  skincare: number;
  /** Index into `WARDROBE_TIERS` — the quality of clothes they own. */
  wardrobeTier: number;
  /** Dental condition, [0, 100]. Decays very slowly, expensive to restore. */
  teeth: number;
  /** Absolute week (`weeksLived`) of the last haircut. `-1` = never. */
  lastHaircutWeek: number;
}

/**
 * How the character eats. The player's direct lever on energy balance.
 *
 * Modelled as an intent rather than a calorie number because the player is
 * choosing a lifestyle, not logging meals — and because a literal calorie
 * tracker in a life sim is a chore, not a mechanic.
 */
export type NutritionMode = 'cut' | 'maintain' | 'bulk';

/** How hard the character trains. Gated by gym access above `light`. */
export type TrainingMode = 'none' | 'light' | 'regular' | 'intense';

/**
 * The weekly regimen — the two choices that drive the body simulation.
 *
 * These exist so the body is something the player *operates*, not something
 * that happens to them. Without a lever, `BodyProfile` would be a read-only
 * readout that drifts on its own, which is a stat display rather than a system.
 * With them, every week carries a small decision that compounds over decades:
 * cutting costs energy and happiness, bulking costs money and adds fat, and
 * training hard costs energy you also need for work.
 */
export interface Regimen {
  nutrition: NutritionMode;
  training: TrainingMode;
}

/** A cosmetic procedure the character has undergone. */
export interface CosmeticProcedureRecord {
  /** Id from `COSMETIC_PROCEDURES`. */
  id: string;
  /** Absolute week (`weeksLived`) it was performed. */
  week: number;
  /**
   * How it turned out, [-1, 1]. Negative = botched (the face got worse and the
   * morph moved the wrong way). A procedure that could only ever help would
   * make surgery a pure money->beauty converter with no tension.
   */
  outcome: number;
}

/**
 * The whole chapter's state, hung off `GameState.identity` as a single optional
 * object.
 *
 * One field rather than six top-level ones: it keeps the migration to a single
 * backfill, keeps `repairGameState` to one guard, and means a future addition to
 * the chapter never touches `GameState` again.
 */
export interface Identity {
  face: FaceGenome;
  body: BodyProfile;
  style: StyleProfile;
  regimen: Regimen;
  procedures: CosmeticProcedureRecord[];
  /**
   * The baked portrait — a `data:image/png;base64,...` URI snapshotted from the
   * 3D head when the player leaves the creator.
   *
   * This is the whole reason live GL stays on one screen. Every other surface
   * (Spark stack, Pulse feed, family list, relationship rows) renders this flat
   * image, so the app never runs more than one GL context and scrolling lists
   * cost exactly what they cost today.
   *
   * Absent means "not baked yet" — callers fall back to the existing portrait
   * pool, so a save from before this chapter still renders a face.
   */
  portraitUri?: string;
  /** `weeksLived` when `portraitUri` was baked, so aging can trigger a re-bake. */
  portraitWeek?: number;
}

/** Skin tones, light → deep. Index is what a save stores. */
export const SKIN_TONES: readonly string[] = [
  '#F6D9C6', '#F0C8AA', '#E3B08B', '#D2955F', '#C07E4F',
  '#A5643C', '#8A4F2E', '#6B3A21', '#4E2A18', '#3A1F12',
];

/** Hair colours. Index is what a save stores. */
export const HAIR_COLORS: readonly string[] = [
  '#0E0B0A', '#2C1B12', '#4A2E1C', '#6B4423', '#8C6239',
  '#B58A50', '#D6B370', '#E8D5A3', '#8C3B1E', '#A8A29E',
  '#E5E7EB', '#7C3AED', '#DC2626', '#2563EB',
];

/**
 * Eye colours. Index is what a save stores, so entries may be RE-TONED but
 * never reordered.
 *
 * The dark end was lifted after rendering the palette against the new eye
 * shader: at the old values a brown-eyed character had no visible pupil. The
 * iris sat close enough to the pupil's black that the whole aperture read as
 * one dark mass with a catchlight on it — and brown is the most common eye
 * colour there is, so that was most players.
 *
 * Lifting the PALETTE rather than brightening the shader is the right lever:
 * the pupil is already as dark as it can be, so the contrast has to come from
 * the iris, and a real dark-brown iris under light photographs far closer to
 * #54341C than to #3B2415. Shading it up instead would have washed out the
 * pale colours at the same time.
 */
export const EYE_COLORS: readonly string[] = [
  '#54341C', '#6F4826', '#8F6134', '#5E7A4A', '#4A7C6C',
  '#3B6BA5', '#5B8FC7', '#8A8F98', '#7A5A9C',
];

/**
 * Names for the palettes, index-aligned with them.
 *
 * These exist because a colour swatch is a button with no text in it: a screen
 * reader announced twenty-four of them as "button, selected" with nothing to
 * tell them apart, which makes choosing a skin tone impossible rather than
 * merely awkward. `swatchName` is the accessor every surface should use.
 *
 * Kept beside the palettes rather than in a component so the two cannot drift —
 * `paletteNames.test.ts` fails if a colour is added without a name.
 */
export const SKIN_TONE_NAMES: readonly string[] = [
  'Porcelain', 'Fair', 'Light', 'Light tan', 'Tan',
  'Golden', 'Bronze', 'Deep bronze', 'Deep', 'Darkest',
];

export const HAIR_COLOR_NAMES: readonly string[] = [
  'Black', 'Darkest brown', 'Dark brown', 'Brown', 'Light brown',
  'Dark blonde', 'Blonde', 'Platinum blonde', 'Auburn', 'Grey',
  'White', 'Violet', 'Red', 'Blue',
];

export const EYE_COLOR_NAMES: readonly string[] = [
  'Dark brown', 'Brown', 'Amber', 'Hazel', 'Teal',
  'Blue', 'Light blue', 'Grey', 'Violet',
];

/**
 * The name of swatch `index` in `names`, with a positional fallback.
 *
 * Never returns an empty string: an unnamed swatch is exactly the case this
 * exists to prevent, so a palette that outgrows its name list degrades to
 * "Colour 15" rather than back to silence.
 */
export function swatchName(names: readonly string[], index: number): string {
  return names[index] ?? `Colour ${index + 1}`;
}

/** Wardrobe tiers, cheapest → finest. Index is what a save stores. */
export const WARDROBE_TIERS: readonly { name: string; cost: number; presence: number }[] = [
  { name: 'Hand-me-downs', cost: 0, presence: -6 },
  { name: 'Fast fashion', cost: 300, presence: 0 },
  { name: 'Smart casual', cost: 1500, presence: 5 },
  { name: 'Tailored', cost: 6000, presence: 11 },
  { name: 'Designer', cost: 25000, presence: 17 },
  { name: 'Bespoke couture', cost: 120000, presence: 23 },
];
