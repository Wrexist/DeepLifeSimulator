/**
 * The binding to the underlying art.
 *
 * Faces are drawn from **avataaars** by Pablo Stanley, shipped through
 * DiceBear (`@dicebear/collection`). It is illustrator-drawn modular art —
 * which is the whole point. An earlier pass in this repo hand-authored the
 * facial geometry as bezier path data and the result was stiff and uncanny;
 * see `docs/avatar-art-direction-research.md` for why that pipeline could
 * never have worked and how the alternatives were measured.
 *
 * Licence: avataaars is "free for personal and commercial use" and requires no
 * attribution, unlike the CC BY styles in the same collection. The DiceBear
 * library code is MIT.
 *
 * ── Why the option sets are CURATED ───────────────────────────────────────
 * The style ships expressions no life sim wants: `vomit`, `screamOpen`,
 * `grimace`, `xDizzy`, `eyepatch`. Left unconstrained, a randomize button
 * eventually hands the player a vomiting face on the character-creation
 * screen. Constraining the sets is the single biggest lever on how the result
 * reads, so the lists below are deliberate subsets, not the raw enums.
 *
 * CATALOG ORDER IS PART OF THE SAVE FORMAT — `AvatarConfig` stores indices.
 * Appending is safe; reordering or removing an entry silently changes the face
 * of every character already using it.
 */
import { CLOTHING_COLORS, HAIR_COLORS, SKIN_TONES } from './palette';
import type { AvatarAgeEffects, AvatarConfig, AvatarSex } from './types';

/**
 * The art package is deliberately NOT imported here. `lib/` stays pure data
 * and pure functions, so every catalog and the whole option-building path is
 * testable without pulling an ESM-only dependency into the test runtime. Only
 * `components/avatar/VectorAvatar.tsx` imports the style itself.
 */

export interface Named {
  /** The value passed to DiceBear. `null` means "render nothing". */
  value: string | null;
  /** What the picker shows the player. */
  name: string;
}


/**
 * Hair. `top` in the underlying style mixes hair and headwear into one list;
 * they are split here because a player choosing a hairstyle and a player
 * choosing a hat are doing different things. Index 0 is bald, expressed by
 * dropping the layer rather than by a "bald" asset.
 */
export const HAIR_STYLES: Named[] = [
  { value: null, name: 'Bald' },
  { value: 'shortFlat', name: 'Short flat' },
  { value: 'shortRound', name: 'Short round' },
  { value: 'shortWaved', name: 'Short waved' },
  { value: 'shortCurly', name: 'Short curly' },
  { value: 'theCaesar', name: 'Caesar' },
  { value: 'theCaesarAndSidePart', name: 'Side part' },
  { value: 'sides', name: 'Sides' },
  { value: 'shavedSides', name: 'Shaved sides' },
  { value: 'frizzle', name: 'Frizzle' },
  { value: 'shaggy', name: 'Shaggy' },
  { value: 'shaggyMullet', name: 'Mullet' },
  { value: 'curly', name: 'Curly' },
  { value: 'curvy', name: 'Curvy' },
  { value: 'straight01', name: 'Straight' },
  { value: 'straight02', name: 'Straight long' },
  { value: 'straightAndStrand', name: 'Straight strand' },
  { value: 'longButNotTooLong', name: 'Long' },
  { value: 'miaWallace', name: 'Blunt bob' },
  { value: 'bob', name: 'Bob' },
  { value: 'bun', name: 'Bun' },
  { value: 'bigHair', name: 'Big hair' },
  { value: 'fro', name: 'Afro' },
  { value: 'froBand', name: 'Afro band' },
  { value: 'dreads', name: 'Dreads' },
  { value: 'dreads01', name: 'Dreads short' },
  { value: 'dreads02', name: 'Dreads long' },
  { value: 'frida', name: 'Flower crown' },
];

/**
 * Which styles read masculine or feminine at a glance.
 *
 * The picker offers ALL of these to everyone — gating a hairstyle by sex is
 * the uniformity this system exists to avoid, and a player who wants a man
 * with a bob should get one. This list only biases RANDOM GENERATION, because
 * an unweighted roll gave a character called Andrew a long blonde bob on the
 * creation screen, which reads as the generator being broken rather than as a
 * choice anyone made.
 *
 * Anything not listed is neutral and can go to either.
 */
export const MASCULINE_HAIR_IDS = [
  'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'theCaesar',
  'theCaesarAndSidePart', 'sides', 'shavedSides', 'shaggy', 'shaggyMullet',
  'dreads01',
];

export const FEMININE_HAIR_IDS = [
  'curvy', 'straight01', 'straight02', 'straightAndStrand', 'longButNotTooLong',
  'miaWallace', 'bob', 'bun', 'bigHair', 'froBand', 'dreads02', 'frida',
];

/** Indices into HAIR_STYLES that generation should favour for a sex. */
export function hairIndicesFor(sex: AvatarSex): number[] {
  const wanted = sex === 'male' ? MASCULINE_HAIR_IDS : FEMININE_HAIR_IDS;
  const other = sex === 'male' ? FEMININE_HAIR_IDS : MASCULINE_HAIR_IDS;
  const indices: number[] = [];
  HAIR_STYLES.forEach((entry, i) => {
    // Skip bald (index 0) — reaching it by chance makes a twelfth of every
    // crowd bald regardless of age. Ageing thins hair on its own.
    if (i === 0) return;
    const id = entry.value;
    if (!id) return;
    if (wanted.includes(id) || !other.includes(id)) indices.push(i);
  });
  return indices;
}

export const HEADWEAR: Named[] = [
  { value: null, name: 'None' },
  { value: 'hat', name: 'Hat' },
  { value: 'turban', name: 'Turban' },
  { value: 'hijab', name: 'Hijab' },
  { value: 'winterHat1', name: 'Beanie' },
  { value: 'winterHat02', name: 'Bobble hat' },
  { value: 'winterHat03', name: 'Knit hat' },
  { value: 'winterHat04', name: 'Ear-flap hat' },
];

export const FACIAL_HAIR: Named[] = [
  { value: null, name: 'Clean' },
  { value: 'beardLight', name: 'Stubble' },
  { value: 'beardMedium', name: 'Beard' },
  { value: 'beardMajestic', name: 'Full beard' },
  { value: 'moustacheFancy', name: 'Moustache' },
  { value: 'moustacheMagnum', name: 'Magnum' },
];

/** Curated: `cry`, `hearts`, `eyeRoll`, `winkWacky` and `xDizzy` are dropped. */
export const EYE_SHAPES: Named[] = [
  { value: 'default', name: 'Default' },
  { value: 'happy', name: 'Happy' },
  { value: 'squint', name: 'Squint' },
  { value: 'side', name: 'Side' },
  { value: 'wink', name: 'Wink' },
  { value: 'closed', name: 'Closed' },
  { value: 'surprised', name: 'Surprised' },
];

/**
 * Curated on the same principle as MOUTH_SHAPES: this is the character's
 * PERMANENT face.
 *
 * `unibrowNatural` is dropped as obviously wrong. So are `sadConcerned`,
 * `sadConcernedNatural` and `frownNatural` — a downturned brow reads as
 * distress, and combined with this style's large eyes it made randomly
 * generated characters look stricken. A STERN brow is a different thing and a
 * legitimate permanent look, so `angry` and `angryNatural` stay.
 */
export const BROW_SHAPES: Named[] = [
  { value: 'default', name: 'Default' },
  { value: 'defaultNatural', name: 'Natural' },
  { value: 'flatNatural', name: 'Flat' },
  { value: 'raisedExcited', name: 'Raised' },
  { value: 'raisedExcitedNatural', name: 'Raised soft' },
  { value: 'upDown', name: 'Up-down' },
  { value: 'upDownNatural', name: 'Up-down soft' },
  { value: 'angry', name: 'Stern' },
  { value: 'angryNatural', name: 'Stern soft' },
];

/**
 * Curated hard.
 *
 * `vomit`, `screamOpen`, `grimace`, `eating` and `tongue` are dropped as
 * obviously wrong. So are `sad`, `concerned` and `disbelief`, for a subtler
 * reason: this is the character's PERMANENT face, and sadness is a state, not
 * an identity. Offering it produced characters who looked stricken at their own
 * wedding, and a randomize button that regularly handed the player a miserable
 * stranger on the creation screen. Mood belongs to what happens in the life.
 */
export const MOUTH_SHAPES: Named[] = [
  { value: 'default', name: 'Neutral' },
  { value: 'smile', name: 'Smile' },
  { value: 'serious', name: 'Serious' },
  { value: 'twinkle', name: 'Twinkle' },
];

/** Curated: `eyepatch` is dropped — it reads as an injury, not a choice. */
export const ACCESSORIES: Named[] = [
  { value: null, name: 'None' },
  { value: 'prescription01', name: 'Thin frames' },
  { value: 'prescription02', name: 'Round frames' },
  { value: 'round', name: 'Round' },
  { value: 'wayfarers', name: 'Wayfarers' },
  { value: 'sunglasses', name: 'Sunglasses' },
  { value: 'kurt', name: 'Kurt' },
];

export const CLOTHING: Named[] = [
  { value: 'shirtCrewNeck', name: 'Crew neck' },
  { value: 'shirtVNeck', name: 'V-neck' },
  { value: 'shirtScoopNeck', name: 'Scoop neck' },
  { value: 'collarAndSweater', name: 'Collar + sweater' },
  { value: 'blazerAndShirt', name: 'Blazer + shirt' },
  { value: 'blazerAndSweater', name: 'Blazer + sweater' },
  { value: 'hoodie', name: 'Hoodie' },
  { value: 'overall', name: 'Overalls' },
  // `graphicShirt` is deliberately absent. It renders whatever
  // `clothingGraphic` is set to across the whole chest, and every available
  // graphic is a logo or slogan — a skull, "resist", a pizza. Pinned to the
  // tamest one it still read as a game icon stamped on the character rather
  // than as clothing.
];

/** Every catalog length, so a picker can be sized without importing each one. */
export const CATALOG_SIZES = {
  skinTone: SKIN_TONES.length,
  hairStyle: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  facialHair: FACIAL_HAIR.length,
  eyeShape: EYE_SHAPES.length,
  browShape: BROW_SHAPES.length,
  mouthShape: MOUTH_SHAPES.length,
  clothing: CLOTHING.length,
  clothingColor: CLOTHING_COLORS.length,
  accessory: ACCESSORIES.length,
  headwear: HEADWEAR.length,
} as const;

/** DiceBear takes colours as hex WITHOUT the leading `#`. */
const bare = (hex: string) => hex.replace('#', '');

/**
 * Turns a config plus its age into the option object DiceBear renders.
 *
 * Ageing is applied here rather than being baked into the config, so the
 * player's choices are untouched and the same config renders correctly at
 * every age. Everything is set explicitly — probabilities included — because
 * an unset probability lets the generator decide, which would make the same
 * config render differently for reasons the player cannot see.
 */
export function buildStyleOptions(
  config: AvatarConfig,
  sex: AvatarSex,
  effects: AvatarAgeEffects
): Record<string, unknown> {
  const hair = HAIR_STYLES[config.hairStyle]?.value ?? null;
  const hat = HEADWEAR[config.headwear]?.value ?? null;
  const glasses = ACCESSORIES[config.accessory]?.value ?? null;

  // Facial hair is masculine-only and suppressed on children; rendering it
  // otherwise reads as a bug rather than as customization.
  const beard =
    sex === 'male' && !effects.suppressFacialHair ? FACIAL_HAIR[config.facialHair]?.value ?? null : null;

  // Hair colour greys with age, and the beard greys with it — a grey-haired
  // man with a jet-black beard is a specific, very noticeable wrongness.
  const hairHex = bare(greyedHairHex(config.hairColor, effects.greying));

  // Headwear wins over hair for the `top` slot, since the style stacks them
  // in one layer. A hat with no hair under it is the correct read.
  const top = hat ?? hair;

  return {
    // `topProbability` doubles as the bald switch AND as age-driven thinning.
    top: top ? [top] : [],
    topProbability: top ? effects.hairProbability : 0,
    hatColor: [bare(CLOTHING_COLORS[config.clothingColor] ?? CLOTHING_COLORS[0])],
    hairColor: [hairHex],

    skinColor: [bare(SKIN_TONES[config.skinTone] ?? SKIN_TONES[0])],

    facialHair: beard ? [beard] : [],
    facialHairProbability: beard ? 100 : 0,
    facialHairColor: [hairHex],

    eyes: [EYE_SHAPES[config.eyeShape]?.value ?? 'default'],
    eyebrows: [BROW_SHAPES[config.browShape]?.value ?? 'default'],
    mouth: [MOUTH_SHAPES[config.mouthShape]?.value ?? 'default'],

    clothing: [CLOTHING[config.clothing]?.value ?? 'shirtCrewNeck'],
    clothesColor: [bare(CLOTHING_COLORS[config.clothingColor] ?? CLOTHING_COLORS[0])],
    // No shipped outfit uses this — `graphicShirt` is not in CLOTHING. Kept
    // pinned as a guard: unset, it randomises across a set including a skull
    // and a "resist" slogan, so re-adding the graphic tee later would quietly
    // put those on background NPCs.
    clothingGraphic: ['diamond'],

    // Glasses the player did not choose can still appear with age — reading
    // glasses are one of the cheapest honest age cues available here.
    accessories: glasses ? [glasses] : ['prescription01', 'prescription02'],
    accessoriesProbability: glasses ? 100 : effects.glassesProbability,

    // The style draws a face on a transparent field; the plate is ours.
    backgroundColor: ['transparent'],
  };
}

/** The hair hex for a colour index at a given greying amount. */
export function greyedHairHex(colorIndex: number, greying: number): string {
  const chosen = HAIR_COLORS[colorIndex] ?? HAIR_COLORS[0];
  if (greying <= 0) return chosen;
  return mix(chosen, '#E8E1E1', Math.min(1, greying));
}

function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const c = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  const hex = (v: number) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0');
  return `#${hex(c(0))}${hex(c(1))}${hex(c(2))}`;
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
