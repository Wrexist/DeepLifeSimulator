/**
 * The vector avatar system.
 *
 * The properties pinned here are the ones whose failure would be invisible in
 * review but obvious to a player: a character whose face changes when it
 * shouldn't, an index that silently wraps, or ageing that runs backwards.
 */
import {
  ACCESSORIES,
  BROW_SHAPES,
  CATALOG_SIZES,
  CLOTHING,
  EYE_SHAPES,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEADWEAR,
  MOUTH_SHAPES,
  buildStyleOptions,
  greyedHairHex,
  hairIndicesFor,
  MASCULINE_HAIR_IDS,
  FEMININE_HAIR_IDS,
} from '@/lib/avatar/style';
import { CLOTHING_COLORS, HAIR_COLORS, NATURAL_HAIR_COUNT, SKIN_TONES } from '@/lib/avatar/palette';
import { ageEffects, FACIAL_HAIR_MIN_AGE } from '@/lib/avatar/aging';
import { avatarFromSeed, cycleField, normalizeAvatar, PICKER_LENGTHS, randomAvatar } from '@/lib/avatar/random';
import { CODEC_MAX_INDEX, codecFitsCatalogs, decodeAvatar, encodeAvatar, FIELD_ORDER } from '@/lib/avatar/encode';
import { inheritAvatar } from '@/lib/avatar/inherit';
import { avatarSeedFor, resolveAvatar, resolveNpcAvatar, toAvatarSex } from '@/lib/avatar/resolve';
import { AVATAR_PICKERS, pickersFor } from '@/lib/avatar/pickers';
import { childParentSources, resolveChildAvatar } from '@/lib/avatar/family';
import { addDepth, BLINK, nextBlinkDelay } from '@/lib/avatar/depth';
import type { AvatarConfig } from '@/lib/avatar/types';

const HEX = /^#[0-9a-fA-F]{6}$/;

const luma = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

describe('catalogs', () => {
  it('reserves index 0 for "none" on every optional catalog', () => {
    // The renderer treats 0 as absent, so a real value at index 0 would put a
    // beard on every clean-shaven face and glasses on everyone.
    expect(FACIAL_HAIR[0].value).toBeNull();
    expect(ACCESSORIES[0].value).toBeNull();
    expect(HEADWEAR[0].value).toBeNull();
    // Index 0 of hair is bald, which is also expressed as "no layer".
    expect(HAIR_STYLES[0].value).toBeNull();
  });

  it('gives every other entry a real style value and a human label', () => {
    for (const list of [HAIR_STYLES, FACIAL_HAIR, ACCESSORIES, HEADWEAR, EYE_SHAPES, BROW_SHAPES, MOUTH_SHAPES, CLOTHING]) {
      for (const entry of list) {
        expect(typeof entry.name).toBe('string');
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.value === null || typeof entry.value === 'string').toBe(true);
      }
    }
  });

  it('offers no graphic tee', () => {
    // It stamps a logo across the chest — every available graphic is a skull,
    // a slogan or a pizza, which reads as a game icon rather than clothing.
    expect(CLOTHING.map((c) => c.value)).not.toContain('graphicShirt');
  });

  it('never generates headwear', () => {
    // A hat hides the hair and flattens the ageing preview. Deliberate only.
    for (let i = 0; i < 200; i++) {
      expect(avatarFromSeed(`hat-${i}`, i % 2 ? 'male' : 'female').headwear).toBe(0);
    }
    // ...but the player can still pick one.
    expect(HEADWEAR.length).toBeGreaterThan(1);
  });

  it('offers no distressed brow as a permanent face', () => {
    // Same principle as the mouths: a downturned brow reads as distress, and
    // with this style's large eyes it made generated characters look stricken.
    const brows = BROW_SHAPES.map((b) => b.value);
    for (const bad of ['sadConcerned', 'sadConcernedNatural', 'frownNatural', 'unibrowNatural']) {
      expect(brows).not.toContain(bad);
    }
    // A STERN brow is a different thing and stays.
    expect(brows).toContain('angry');
  });

  it('excludes the expressions a life sim must never show', () => {
    // The style ships `vomit`, `screamOpen`, `grimace`, `xDizzy` and an
    // eyepatch. Curation is the point — an unconstrained randomize button
    // eventually hands the player a vomiting face on the creation screen.
    const banned = ['vomit', 'screamOpen', 'grimace', 'eating', 'tongue'];
    const mouths = MOUTH_SHAPES.map((m) => m.value);
    for (const bad of banned) expect(mouths).not.toContain(bad);
    expect(EYE_SHAPES.map((e) => e.value)).not.toContain('xDizzy');
    expect(EYE_SHAPES.map((e) => e.value)).not.toContain('cry');
    expect(ACCESSORIES.map((a) => a.value)).not.toContain('eyepatch');
    expect(BROW_SHAPES.map((b) => b.value)).not.toContain('unibrowNatural');
  });

  it('reports catalog sizes that match the catalogs', () => {
    expect(CATALOG_SIZES.hairStyle).toBe(HAIR_STYLES.length);
    expect(CATALOG_SIZES.facialHair).toBe(FACIAL_HAIR.length);
    expect(CATALOG_SIZES.accessory).toBe(ACCESSORIES.length);
    expect(CATALOG_SIZES.headwear).toBe(HEADWEAR.length);
    expect(CATALOG_SIZES.clothing).toBe(CLOTHING.length);
  });

  it('offers no despondent expression as a permanent face', () => {
    // This is the character's face for their whole life. Sadness is a state,
    // not an identity — offering it produced characters who looked stricken at
    // their own wedding.
    const mouths = MOUTH_SHAPES.map((m) => m.value);
    for (const bad of ['sad', 'concerned', 'disbelief']) {
      expect(mouths).not.toContain(bad);
    }
    expect(mouths).toEqual(['default', 'smile', 'serious', 'twinkle']);
  });

  it('offers enough hair to feel like a choice', () => {
    // Bald plus 27 styles. The pool this replaces offered twelve whole faces.
    expect(HAIR_STYLES.length).toBeGreaterThanOrEqual(20);
  });
});

describe('palette', () => {
  const HEXES = [...SKIN_TONES, ...HAIR_COLORS, ...CLOTHING_COLORS];

  it('is all valid hex', () => {
    for (const hex of HEXES) expect(hex).toMatch(HEX);
  });

  it('spans a genuinely wide skin range', () => {
    // The pool this replaces had almost no range, which was a specific
    // complaint. Guard the span rather than the exact values.
    const values = SKIN_TONES.map(luma);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(120);
  });

  it('never lets the generator reach a grey or white hair colour', () => {
    // Grey hair is how the game says "old". A generator that can pick it
    // outright breaks that signal AND puts grey hair on children — which has
    // now happened twice, once because NATURAL_HAIR_COUNT is an index count
    // that shifts when an entry above it is removed. Assert the property, not
    // the number.
    const generatorRange = HAIR_COLORS.slice(0, NATURAL_HAIR_COUNT);
    for (const hex of generatorRange) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      // Desaturation only reads as GREY when it is also light — near-black hair
      // is legitimately desaturated and must not trip this.
      const readsAsGrey = spread < 24 && luma(hex) > 120;
      const readsAsWhite = luma(hex) > 205;
      expect(readsAsGrey || readsAsWhite).toBe(false);
    }
    // ...and the player can still choose them.
    expect(HAIR_COLORS.length).toBeGreaterThan(NATURAL_HAIR_COUNT);
  });

  it('greys hair monotonically toward white', () => {
    let previous = luma(greyedHairHex(0, 0));
    for (const amount of [0.25, 0.5, 0.75, 1]) {
      const next = luma(greyedHairHex(0, amount));
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });
});

describe('ageing', () => {
  it('never runs backwards', () => {
    // A non-monotonic curve would let a character visibly get younger on a
    // birthday, which is the exact failure the old portrait pool shipped.
    let last = ageEffects(0, 'male');
    for (let age = 1; age <= 100; age++) {
      const current = ageEffects(age, 'male');
      expect(current.greying).toBeGreaterThanOrEqual(last.greying);
      expect(current.hairProbability).toBeLessThanOrEqual(last.hairProbability);
      expect(current.glassesProbability).toBeGreaterThanOrEqual(last.glassesProbability);
      last = current;
    }
  });

  it('leaves a young adult unaged', () => {
    const young = ageEffects(25, 'female');
    expect(young.greying).toBe(0);
    expect(young.hairProbability).toBe(100);
    expect(young.glassesProbability).toBe(0);
    expect(young.suppressFacialHair).toBe(false);
  });

  it('does not thin a feminine hairline', () => {
    // Thinning on a feminine face reads as an art bug, not as ageing.
    expect(ageEffects(85, 'female').hairProbability).toBe(100);
    expect(ageEffects(85, 'male').hairProbability).toBeLessThan(100);
  });

  it('suppresses facial hair on children', () => {
    expect(ageEffects(FACIAL_HAIR_MIN_AGE - 1, 'male').suppressFacialHair).toBe(true);
    expect(ageEffects(FACIAL_HAIR_MIN_AGE, 'male').suppressFacialHair).toBe(false);
  });

  it('greys substantially by old age', () => {
    expect(ageEffects(80, 'male').greying).toBeGreaterThan(0.9);
  });

  it('handles a nonsense age without throwing', () => {
    expect(() => ageEffects(Number.NaN, 'male')).not.toThrow();
    expect(ageEffects(Number.NaN, 'male').greying).toBe(0);
    expect(ageEffects(-5, 'male').greying).toBe(0);
  });
});

describe('style options handed to the generator', () => {
  const base = avatarFromSeed('options', 'male');

  it('never sends facial hair for a feminine face', () => {
    const o = buildStyleOptions({ ...base, facialHair: 3 }, 'female', ageEffects(40, 'female'));
    expect(o.facialHair).toEqual([]);
    expect(o.facialHairProbability).toBe(0);
  });

  it('never sends facial hair for a child', () => {
    const o = buildStyleOptions({ ...base, facialHair: 3 }, 'male', ageEffects(10, 'male'));
    expect(o.facialHair).toEqual([]);
  });

  it('greys the beard with the hair', () => {
    // A grey-haired man with a jet-black beard is a specific, very noticeable
    // wrongness, so the two must come from the same value.
    const o = buildStyleOptions({ ...base, facialHair: 2 }, 'male', ageEffects(80, 'male'));
    expect(o.facialHairColor).toEqual(o.hairColor);
  });

  it('drops the hair layer entirely when bald is chosen', () => {
    const o = buildStyleOptions({ ...base, hairStyle: 0, headwear: 0 }, 'male', ageEffects(30, 'male'));
    expect(o.top).toEqual([]);
    expect(o.topProbability).toBe(0);
  });

  it('lets headwear win the shared top slot', () => {
    const o = buildStyleOptions({ ...base, hairStyle: 5, headwear: 1 }, 'male', ageEffects(30, 'male'));
    expect(o.top).toEqual([HEADWEAR[1].value]);
  });

  it('forces chosen glasses to always render, and only guesses when none chosen', () => {
    const chosen = buildStyleOptions({ ...base, accessory: 2 }, 'male', ageEffects(30, 'male'));
    expect(chosen.accessoriesProbability).toBe(100);
    const none = buildStyleOptions({ ...base, accessory: 0 }, 'male', ageEffects(75, 'male'));
    expect(none.accessoriesProbability).toBeGreaterThan(0);
    expect(none.accessoriesProbability).toBeLessThan(100);
  });

  it('sends colours without the leading hash', () => {
    // DiceBear rejects '#rrggbb'; it wants bare hex.
    const o = buildStyleOptions(base, 'male', ageEffects(30, 'male'));
    for (const key of ['skinColor', 'hairColor', 'clothesColor']) {
      const value = (o as Record<string, string[]>)[key];
      expect(value[0]).not.toContain('#');
      expect(value[0]).toMatch(/^[0-9a-fA-F]{6}$/);
    }
  });

  it('keeps the background transparent so our plate shows', () => {
    expect(buildStyleOptions(base, 'male', ageEffects(30, 'male')).backgroundColor).toEqual(['transparent']);
  });
});

describe('generation', () => {
  it('is deterministic for a seed', () => {
    expect(avatarFromSeed('ada lovelace', 'female')).toEqual(avatarFromSeed('ada lovelace', 'female'));
    expect(avatarFromSeed('a', 'male')).not.toEqual(avatarFromSeed('b', 'male'));
  });

  it('cannot generate a miserable face, because none exists to generate', () => {
    const sample = Array.from({ length: 400 }, (_, i) => avatarFromSeed(`mood-${i}`, 'female'));
    for (const config of sample) {
      expect(config.mouthShape).toBeLessThan(MOUTH_SHAPES.length);
    }
  });

  it('never gives a feminine face facial hair', () => {
    for (let i = 0; i < 200; i++) {
      expect(avatarFromSeed(`f-${i}`, 'female').facialHair).toBe(0);
    }
  });

  it('never puts a beard on a child-age render regardless of config', () => {
    const config = { ...avatarFromSeed('bearded', 'male'), facialHair: 4 };
    expect(buildStyleOptions(config, 'male', ageEffects(8, 'male')).facialHair).toEqual([]);
  });

  it('produces only in-range indices', () => {
    for (let i = 0; i < 200; i++) {
      const config = avatarFromSeed(`seed-${i}`, i % 2 ? 'male' : 'female');
      for (const field of FIELD_ORDER) {
        expect(config[field]).toBeGreaterThanOrEqual(0);
        expect(config[field]).toBeLessThan(PICKER_LENGTHS[field]);
      }
    }
  });

  it('keeps randomAvatar in range too', () => {
    for (let i = 0; i < 100; i++) {
      const config = randomAvatar('male');
      for (const field of FIELD_ORDER) {
        expect(config[field]).toBeLessThan(PICKER_LENGTHS[field]);
      }
    }
  });

  it('clamps anything out of range rather than throwing', () => {
    const broken = {
      skinTone: 999,
      clothing: -3,
      hairStyle: Number.NaN,
      hairColor: 1.7,
    } as unknown as Partial<AvatarConfig>;
    const fixed = normalizeAvatar(broken);
    expect(fixed.skinTone).toBe(SKIN_TONES.length - 1);
    expect(fixed.clothing).toBe(0);
    expect(fixed.hairStyle).toBe(0);
    expect(fixed.hairColor).toBe(1);
    expect(normalizeAvatar(undefined).skinTone).toBe(0);
  });

  it('wraps at both ends when cycling a field', () => {
    const base = normalizeAvatar({});
    expect(cycleField(base, 'skinTone', -1).skinTone).toBe(SKIN_TONES.length - 1);
    const top = { ...base, skinTone: SKIN_TONES.length - 1 };
    expect(cycleField(top, 'skinTone', 1).skinTone).toBe(0);
  });
});

describe('save codec', () => {
  it('round-trips every field', () => {
    const config = avatarFromSeed('round-trip', 'male');
    expect(decodeAvatar(encodeAvatar(config))).toEqual(config);
  });

  it('fits every catalog in one character per field', () => {
    // Base-36 holds 0…35. A catalog growing past that would silently clamp
    // every face using its tail entries.
    expect(codecFitsCatalogs()).toBe(true);
    for (const field of FIELD_ORDER) {
      expect(PICKER_LENGTHS[field] - 1).toBeLessThanOrEqual(CODEC_MAX_INDEX);
    }
  });

  it('covers every field of the config', () => {
    const config = avatarFromSeed('coverage', 'female');
    expect(FIELD_ORDER.slice().sort()).toEqual(Object.keys(config).sort());
  });

  it('rejects anything that is not a config string', () => {
    expect(decodeAvatar(undefined)).toBeUndefined();
    expect(decodeAvatar(null)).toBeUndefined();
    expect(decodeAvatar('')).toBeUndefined();
    // A legacy portrait-pool id must NOT decode as a face.
    expect(decodeAvatar('f7')).toBeUndefined();
    expect(decodeAvatar('a1.')).toBeUndefined();
  });

  it('treats a short string as a config written before a field was appended', () => {
    const decoded = decodeAvatar('a1.012');
    expect(decoded).toBeDefined();
    expect(decoded!.skinTone).toBe(0);
    expect(decoded!.hairStyle).toBe(1);
    expect(decoded!.hairColor).toBe(2);
    // The absent tail defaults rather than failing the whole decode.
    expect(decoded!.accessory).toBe(0);
  });
});

describe('inheritance', () => {
  const mother = avatarFromSeed('mother', 'female');
  const father = avatarFromSeed('father', 'male');

  it('is deterministic in the child seed', () => {
    expect(inheritAvatar(mother, father, 'child-1', 'female')).toEqual(
      inheritAvatar(mother, father, 'child-1', 'female')
    );
    expect(inheritAvatar(mother, father, 'child-1', 'female')).not.toEqual(
      inheritAvatar(mother, father, 'child-2', 'female')
    );
  });

  it('keeps skin tone between the parents', () => {
    const low = Math.min(mother.skinTone, father.skinTone);
    const high = Math.max(mother.skinTone, father.skinTone);
    for (let i = 0; i < 100; i++) {
      const child = inheritAvatar(mother, father, `kid-${i}`, i % 2 ? 'male' : 'female');
      // Blended with a little drift, so allow one step outside the parents.
      expect(child.skinTone).toBeGreaterThanOrEqual(Math.max(0, low - 1));
      expect(child.skinTone).toBeLessThanOrEqual(high + 1);
    }
  });

  it('takes discrete features from one parent or the other', () => {
    for (let i = 0; i < 100; i++) {
      const child = inheritAvatar(mother, father, `kid-${i}`, 'female');
      expect([mother.browShape, father.browShape]).toContain(child.browShape);
      expect([mother.mouthShape, father.mouthShape]).toContain(child.mouthShape);
      expect([mother.eyeShape, father.eyeShape]).toContain(child.eyeShape);
    }
  });

  it('falls back to a seeded face when no parent is known', () => {
    const orphan = inheritAvatar(undefined, undefined, 'orphan', 'male');
    expect(orphan).toEqual(avatarFromSeed('orphan', 'male'));
  });

  it('works from a single known parent', () => {
    expect(() => inheritAvatar(mother, undefined, 'only-mum', 'male')).not.toThrow();
    expect(inheritAvatar(undefined, father, 'only-dad', 'female').facialHair).toBe(0);
  });

  it('never gives a daughter facial hair', () => {
    for (let i = 0; i < 100; i++) {
      expect(inheritAvatar(mother, father, `d-${i}`, 'female').facialHair).toBe(0);
    }
  });
});

describe('resolving a face from a save', () => {
  it('prefers a stored config', () => {
    const config = avatarFromSeed('stored', 'female');
    const resolved = resolveAvatar({ avatar: encodeAvatar(config), name: 'Someone Else' });
    expect(resolved).toEqual(config);
  });

  it('is stable across loads for a save with no stored config', () => {
    // This is what makes the v39 carve-out safe: an absent key resolves to the
    // SAME face every time, so nothing has to be backfilled.
    const profile = { firstName: 'Ada', lastName: 'Lovelace', sex: 'female', avatarId: 'f3' };
    expect(resolveAvatar(profile)).toEqual(resolveAvatar({ ...profile }));
  });

  it('keeps two characters with the same name but different legacy picks distinct', () => {
    const a = resolveAvatar({ name: 'Alex Smith', sex: 'male', avatarId: 'm1' });
    const b = resolveAvatar({ name: 'Alex Smith', sex: 'male', avatarId: 'm7' });
    expect(a).not.toEqual(b);
  });

  it('folds the legacy pick into the seed', () => {
    expect(avatarSeedFor({ name: 'Ada', avatarId: 'f2' })).toBe('Ada|f2');
    expect(avatarSeedFor({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace|');
    expect(avatarSeedFor(undefined)).toBe('anon|');
  });

  it('ignores a corrupt stored config rather than throwing', () => {
    const resolved = resolveAvatar({ avatar: 'not-a-config', name: 'Ada', sex: 'female' });
    expect(resolved).toEqual(resolveAvatar({ name: 'Ada', sex: 'female' }));
  });

  it('normalizes whatever the save calls a sex', () => {
    expect(toAvatarSex('female')).toBe('female');
    expect(toAvatarSex('f')).toBe('female');
    expect(toAvatarSex('m')).toBe('male');
    expect(toAvatarSex(undefined, 'female')).toBe('female');
    expect(toAvatarSex('nonbinary', 'male')).toBe('male');
  });

  it('gives NPCs a stable face from a seed alone', () => {
    expect(resolveNpcAvatar('boss-1', 'male')).toEqual(resolveNpcAvatar('boss-1', 'male'));
    expect(resolveNpcAvatar(null, null)).toBeDefined();
  });
});

describe('pickers', () => {
  it('offers facial hair only on a masculine face', () => {
    expect(pickersFor('male').some((c) => c.field === 'facialHair')).toBe(true);
    expect(pickersFor('female').some((c) => c.field === 'facialHair')).toBe(false);
  });

  it('gives every category as many options as its catalog has entries', () => {
    for (const category of AVATAR_PICKERS) {
      expect(category.options.length).toBe(PICKER_LENGTHS[category.field]);
    }
  });

  it('gives every colour category a swatch colour', () => {
    for (const category of AVATAR_PICKERS.filter((c) => c.kind === 'color')) {
      for (const option of category.options) {
        expect(option.color).toMatch(HEX);
      }
    }
  });

  it('covers every editable field exactly once', () => {
    const fields = AVATAR_PICKERS.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(fields.slice().sort()).toEqual(FIELD_ORDER.slice().sort());
  });
});

describe('family faces', () => {
  const mother = avatarFromSeed('the-mother', 'female');
  const father = avatarFromSeed('the-father', 'male');

  it('picks the player and their partner as the two parents', () => {
    const state = {
      userProfile: { name: 'Ada', sex: 'female' },
      relationships: [
        { type: 'friend', name: 'Nope', gender: 'male' },
        { type: 'spouse', name: 'Grace', gender: 'male' },
      ],
    };
    const parents = childParentSources(state);
    expect(parents.mother?.name).toBe('Ada');
    expect(parents.father?.name).toBe('Grace');
  });

  it('prefers a spouse over a partner', () => {
    const state = {
      userProfile: { name: 'Ada', sex: 'male' },
      relationships: [
        { type: 'partner', name: 'Partner', gender: 'female' },
        { type: 'spouse', name: 'Spouse', gender: 'female' },
      ],
    };
    expect(childParentSources(state).mother?.name).toBe('Spouse');
  });

  it('survives a save with no partner, no relationships, or no profile', () => {
    expect(() => childParentSources({ userProfile: { name: 'Solo', sex: 'male' } })).not.toThrow();
    expect(() => childParentSources({ relationships: null })).not.toThrow();
    expect(() => childParentSources(undefined)).not.toThrow();
    expect(childParentSources(undefined).mother).toBeUndefined();
  });

  it('gives a child a face derived from both parents, stable per child id', () => {
    const parents = { mother: { avatar: encodeAvatar(mother) }, father: { avatar: encodeAvatar(father) } };
    const once = resolveChildAvatar('child-7', 'female', parents);
    const again = resolveChildAvatar('child-7', 'female', parents);
    expect(once).toEqual(again);
    expect(resolveChildAvatar('child-8', 'female', parents)).not.toEqual(once);
  });

  it('actually inherits rather than seeding independently', () => {
    // The whole point: a child of these parents must not look like a stranger
    // who happens to share their id.
    const parents = { mother: { avatar: encodeAvatar(mother) }, father: { avatar: encodeAvatar(father) } };
    const child = resolveChildAvatar('child-1', 'male', parents);
    const stranger = avatarFromSeed('child-1', 'male');
    const low = Math.min(mother.skinTone, father.skinTone);
    const high = Math.max(mother.skinTone, father.skinTone);
    expect(child.skinTone).toBeGreaterThanOrEqual(Math.max(0, low - 1));
    expect(child.skinTone).toBeLessThanOrEqual(high + 1);
    expect(child).not.toEqual(stranger);
  });

  it('falls back to a seeded face when neither parent is known', () => {
    expect(resolveChildAvatar('orphan', 'male', undefined)).toEqual(avatarFromSeed('orphan', 'male'));
    expect(resolveChildAvatar('orphan', 'male', {})).toEqual(avatarFromSeed('orphan', 'male'));
  });
});

describe('hair leaning', () => {
  it('keeps every style available in the picker', () => {
    // The bias is a GENERATION weighting, not a gate. A player who wants a man
    // with a bob must still be able to pick one.
    const picker = AVATAR_PICKERS.find((c) => c.field === 'hairStyle')!;
    expect(picker.options.length).toBe(HAIR_STYLES.length);
    expect(pickersFor('male').find((c) => c.field === 'hairStyle')!.options.length).toBe(
      HAIR_STYLES.length
    );
  });

  it('never generates bald by accident', () => {
    // Index 0 is bald. Reaching it by chance makes a slice of every crowd bald
    // regardless of age; ageing thins hair on its own.
    expect(hairIndicesFor('male')).not.toContain(0);
    expect(hairIndicesFor('female')).not.toContain(0);
    for (let i = 0; i < 200; i++) {
      expect(avatarFromSeed(`bald-${i}`, i % 2 ? 'male' : 'female').hairStyle).not.toBe(0);
    }
  });

  it('keeps the strongly-gendered styles out of the other sex\'s pool', () => {
    const masc = hairIndicesFor('male').map((i) => HAIR_STYLES[i].value);
    const fem = hairIndicesFor('female').map((i) => HAIR_STYLES[i].value);
    for (const id of FEMININE_HAIR_IDS) expect(masc).not.toContain(id);
    for (const id of MASCULINE_HAIR_IDS) expect(fem).not.toContain(id);
  });

  it('still leaves both sexes a wide choice', () => {
    // A bias that collapsed to three styles would be worse than no bias.
    expect(hairIndicesFor('male').length).toBeGreaterThanOrEqual(12);
    expect(hairIndicesFor('female').length).toBeGreaterThanOrEqual(12);
  });
});

describe('depth overlays', () => {
  const svg = '<svg viewBox="0 0 280 280"><g/></svg>';

  it('injects the four lighting layers', () => {
    const out = addDepth(svg, 'abc');
    for (const layer of ['avFs', 'avKl', 'avRim', 'avOcc']) {
      expect(out).toContain(`${layer}abc`);
    }
    expect(out.endsWith('</svg>')).toBe(true);
  });

  it('namespaces every id per instance', () => {
    // Two avatars sharing a gradient id land in one document scope on web, and
    // the second silently renders with the first's lighting.
    const a = addDepth(svg, 'one');
    const b = addDepth(svg, 'two');
    expect(a).toContain('avFsone');
    expect(a).not.toContain('avFstwo');
    expect(b).toContain('avFstwo');
  });

  it('uses no filter and no blend mode', () => {
    // Support for both is uneven across iOS, Android and web.
    const out = addDepth(svg, 'x');
    expect(out).not.toMatch(/filter|mix-blend|feGaussian/i);
  });

  it('degrades to the input rather than to a blank frame', () => {
    expect(addDepth('not an svg', 'x')).toBe('not an svg');
    expect(addDepth('', 'x')).toBe('');
  });

  it('keeps blink timing in its authored range', () => {
    expect(nextBlinkDelay(() => 0)).toBe(BLINK.minGapMs);
    expect(nextBlinkDelay(() => 0.999)).toBeLessThan(BLINK.maxGapMs);
    for (let i = 0; i < 50; i++) {
      const d = nextBlinkDelay();
      expect(d).toBeGreaterThanOrEqual(BLINK.minGapMs);
      expect(d).toBeLessThan(BLINK.maxGapMs);
    }
    // A blink the player can actually perceive, but not a wink.
    expect(BLINK.closedMs).toBeGreaterThan(60);
    expect(BLINK.closedMs).toBeLessThan(250);
  });
});

describe('depth overlay seams', () => {
  it('fades the contact occlusion IN from the top', () => {
    // Running it dark-to-transparent downward put a hard horizontal line across
    // every character's chest, and faded out exactly where the shadow belonged.
    const out = addDepth('<svg viewBox="0 0 280 280"></svg>', 'z');
    const occ = /<linearGradient id="avOccz"[^>]*>(.*?)<\/linearGradient>/s.exec(out)?.[1] ?? '';
    const stops = [...occ.matchAll(/stop-opacity="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(stops[0]).toBe(0);
    expect(stops[stops.length - 1]).toBeGreaterThan(0);
  });

  it('runs the occlusion rect to the bottom edge', () => {
    // Stopping short leaves a visible line where the rect ends.
    const out = addDepth('<svg viewBox="0 0 280 280"></svg>', 'z');
    const rect = /<rect x="0" y="(\d+)" width="280" height="(\d+)" fill="url\(#avOccz\)"\/>/.exec(out);
    expect(rect).toBeTruthy();
    expect(Number(rect![1]) + Number(rect![2])).toBe(280);
  });
});
