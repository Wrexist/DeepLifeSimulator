/**
 * The vector avatar system.
 *
 * The properties pinned here are the ones whose failure would be invisible in
 * review but obvious to a player: a character whose face changes when it
 * shouldn't, an index that silently wraps, or ageing that runs backwards.
 */
import {
  ACCESSORIES,
  ANCHORS,
  BROW_SHAPES,
  CATALOG_SIZES,
  EYE_SHAPES,
  FACE_SHAPES,
  FACIAL_HAIR,
  HAIR_STYLES,
  MOUTH_SHAPES,
  NOSE_SHAPES,
} from '@/lib/avatar/features';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, CLOTHING, greyRamp } from '@/lib/avatar/palette';
import { ageEffects, recessionOffset } from '@/lib/avatar/aging';
import { avatarFromSeed, cycleField, normalizeAvatar, PICKER_LENGTHS, randomAvatar } from '@/lib/avatar/random';
import { CODEC_MAX_INDEX, codecFitsCatalogs, decodeAvatar, encodeAvatar, FIELD_ORDER } from '@/lib/avatar/encode';
import { inheritAvatar } from '@/lib/avatar/inherit';
import { avatarSeedFor, resolveAvatar, resolveNpcAvatar, toAvatarSex } from '@/lib/avatar/resolve';
import { AVATAR_PICKERS, pickersFor } from '@/lib/avatar/pickers';
import type { AvatarConfig } from '@/lib/avatar/types';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('geometry catalogs', () => {
  it('keeps the landmark anchors the catalogs are authored against', () => {
    // Every catalog is drawn to these coordinates. Moving one without redrawing
    // the shapes misaligns eyes against brows, glasses against eyes, and so on.
    expect(ANCHORS.eyeLeft).toEqual({ x: 78, y: 96 });
    expect(ANCHORS.eyeRight).toEqual({ x: 122, y: 96 });
    expect(ANCHORS.mouth).toEqual({ x: 100, y: 132 });
    // The eyes must stay symmetric about the centre line, or a mirrored right
    // eye lands off-centre.
    expect(ANCHORS.eyeLeft.x + ANCHORS.eyeRight.x).toBe(2 * ANCHORS.noseCenter);
    expect(ANCHORS.earLeft.x + ANCHORS.earRight.x).toBe(2 * ANCHORS.noseCenter);
  });

  it('gives every shape a drawable path', () => {
    const withPaths = [
      ...FACE_SHAPES.map((e) => e.path),
      ...BROW_SHAPES.map((e) => e.path),
      ...EYE_SHAPES.map((e) => e.path),
      ...NOSE_SHAPES.flatMap((e) => [e.shade, e.light, e.nostrils]),
      ...MOUTH_SHAPES.flatMap((e) => [e.upper, e.lower]),
    ];
    for (const path of withPaths) {
      expect(typeof path).toBe('string');
      expect(path.trim().startsWith('M')).toBe(true);
    }
  });

  it('leaves index 0 empty for the optional catalogs', () => {
    // The renderer treats 0 as "none" without consulting the entry, so a
    // non-empty path at index 0 would draw a beard on every clean-shaven face.
    expect(FACIAL_HAIR[0].path).toBe('');
    expect(ACCESSORIES[0].path).toBe('');
  });

  it('has at least one hair style with no front mass, and one with back mass', () => {
    expect(HAIR_STYLES.some((h) => !h.front)).toBe(true);
    expect(HAIR_STYLES.some((h) => h.back)).toBe(true);
  });

  it('reports catalog sizes that match the catalogs', () => {
    expect(CATALOG_SIZES.faceShape).toBe(FACE_SHAPES.length);
    expect(CATALOG_SIZES.hairStyle).toBe(HAIR_STYLES.length);
    expect(CATALOG_SIZES.facialHair).toBe(FACIAL_HAIR.length);
    expect(CATALOG_SIZES.accessory).toBe(ACCESSORIES.length);
  });
});

describe('palette', () => {
  it('gives every ramp three valid hex stops', () => {
    for (const ramp of [...SKIN_TONES, ...HAIR_COLORS, ...EYE_COLORS, ...CLOTHING]) {
      expect(ramp.base).toMatch(HEX);
      expect(ramp.shadow).toMatch(HEX);
      expect(ramp.light).toMatch(HEX);
    }
  });

  it('spans a genuinely wide skin range', () => {
    // The pool this replaces had almost no range, which was a specific
    // complaint. Guard the span rather than the exact values.
    const luma = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    const values = SKIN_TONES.map((r) => luma(r.base));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(120);
  });

  it('greys hair monotonically toward white', () => {
    const black = HAIR_COLORS[0];
    const luma = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    let previous = luma(greyRamp(black, 0).base);
    for (const amount of [0.25, 0.5, 0.75, 1]) {
      const next = luma(greyRamp(black, amount).base);
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
      expect(current.wrinkles).toBeGreaterThanOrEqual(last.wrinkles);
      expect(current.recession).toBeGreaterThanOrEqual(last.recession);
      expect(current.headScale).toBeLessThanOrEqual(last.headScale + 1e-9);
      last = current;
    }
  });

  it('leaves a young adult unaged', () => {
    const young = ageEffects(22, 'female');
    expect(young.greying).toBe(0);
    expect(young.wrinkles).toBe(0);
    expect(young.babyness).toBe(0);
    expect(young.headScale).toBe(1);
  });

  it('does not recede a feminine hairline', () => {
    expect(ageEffects(80, 'female').recession).toBe(0);
    expect(ageEffects(80, 'male').recession).toBeGreaterThan(0);
  });

  it('gives children larger heads', () => {
    expect(ageEffects(1, 'male').headScale).toBeGreaterThan(ageEffects(20, 'male').headScale);
    expect(ageEffects(3, 'female').babyness).toBeGreaterThan(0);
  });

  it('suppresses recession for styles that cannot recede', () => {
    const old = ageEffects(85, 'male');
    expect(recessionOffset(old, 0.5, true)).toBe(0);
    expect(recessionOffset(old, 0.5, false)).toBeGreaterThan(0);
  });

  it('handles a nonsense age without throwing', () => {
    expect(() => ageEffects(Number.NaN, 'male')).not.toThrow();
    expect(ageEffects(Number.NaN, 'male').greying).toBe(0);
    expect(ageEffects(-5, 'male').greying).toBe(0);
  });
});

describe('generation', () => {
  it('is deterministic for a seed', () => {
    expect(avatarFromSeed('ada lovelace', 'female')).toEqual(avatarFromSeed('ada lovelace', 'female'));
    expect(avatarFromSeed('a', 'male')).not.toEqual(avatarFromSeed('b', 'male'));
  });

  it('never gives a feminine face facial hair', () => {
    for (let i = 0; i < 200; i++) {
      expect(avatarFromSeed(`f-${i}`, 'female').facialHair).toBe(0);
    }
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
      faceShape: -3,
      hairStyle: Number.NaN,
      hairColor: 1.7,
    } as unknown as Partial<AvatarConfig>;
    const fixed = normalizeAvatar(broken);
    expect(fixed.skinTone).toBe(SKIN_TONES.length - 1);
    expect(fixed.faceShape).toBe(0);
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
    expect(decoded!.faceShape).toBe(1);
    expect(decoded!.hairStyle).toBe(2);
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
      expect([mother.faceShape, father.faceShape]).toContain(child.faceShape);
      expect([mother.noseShape, father.noseShape]).toContain(child.noseShape);
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
