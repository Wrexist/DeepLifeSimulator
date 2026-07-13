import {
  getPortrait,
  getParentPortrait,
  getHeroPortrait,
  bandForAge,
  hashSeed,
  legacyFace,
  _portraitSlot,
  _parentUsesHero,
  POOL_SIZES,
  listStarterAvatars,
  avatarSexFromId,
  getAvatarPortrait,
} from '@/utils/facePool';

describe('facePool', () => {
  describe('bandForAge', () => {
    it('maps ages to the right band', () => {
      expect(bandForAge(1)).toBe('baby');
      expect(bandForAge(4)).toBe('baby');
      expect(bandForAge(5)).toBe('kid');
      expect(bandForAge(12)).toBe('kid');
      expect(bandForAge(13)).toBe('tn');
      expect(bandForAge(17)).toBe('tn');
      expect(bandForAge(18)).toBe('ya');
      expect(bandForAge(29)).toBe('ya');
      expect(bandForAge(30)).toBe('ad');
      expect(bandForAge(39)).toBe('ad');
      expect(bandForAge(40)).toBe('mid');
      expect(bandForAge(55)).toBe('mid');
      expect(bandForAge(56)).toBe('sr');
      expect(bandForAge(90)).toBe('sr');
    });
  });

  describe('hashSeed', () => {
    it('is deterministic and non-negative', () => {
      expect(hashSeed('sarah-1')).toBe(hashSeed('sarah-1'));
      expect(hashSeed('sarah-1')).toBeGreaterThanOrEqual(0);
      expect(hashSeed('a')).not.toBe(hashSeed('b'));
    });
  });

  describe('_portraitSlot', () => {
    it('is stable for the same person', () => {
      const a = _portraitSlot('profile-7', 24, 'female');
      const b = _portraitSlot('profile-7', 24, 'female');
      expect(a).toEqual(b);
      expect(a).not.toBeNull();
    });

    it('routes by sex + age band', () => {
      expect(_portraitSlot('x', 24, 'female')!.key).toBe('f_ya');
      expect(_portraitSlot('x', 24, 'male')!.key).toBe('m_ya');
      expect(_portraitSlot('x', 34, 'female')!.key).toBe('f_ad');
      expect(_portraitSlot('x', 48, 'male')!.key).toBe('m_mid');
      expect(_portraitSlot('x', 70, 'female')!.key).toBe('f_sr');
      expect(_portraitSlot('x', 15, 'male')!.key).toBe('m_tn');
      expect(_portraitSlot('x', 8, 'female')!.key).toBe('f_kid');
    });

    it('treats babies as sex-neutral', () => {
      expect(_portraitSlot('x', 2, 'female')!.key).toBe('baby');
      expect(_portraitSlot('y', 2, 'male')!.key).toBe('baby');
    });

    it('gives random/unknown sex a stable m/f from the seed', () => {
      const first = _portraitSlot('rand-seed', 24, 'random')!.key;
      expect(['f_ya', 'm_ya']).toContain(first);
      expect(_portraitSlot('rand-seed', 24, 'random')!.key).toBe(first); // stable
    });

    it('follows the age band as a person ages (face tracks age)', () => {
      // Same person (seed), different ages → the bucket follows their age band.
      const ya = _portraitSlot('lily', 24, 'female')!;
      const ad = _portraitSlot('lily', 34, 'female')!;
      const sr = _portraitSlot('lily', 70, 'female')!;
      expect(ya.key).toBe('f_ya');
      expect(ad.key).toBe('f_ad');
      expect(sr.key).toBe('f_sr');
      // Deterministic per band.
      expect(_portraitSlot('lily', 24, 'female')).toEqual(ya);
      expect(ya.index).toBe(hashSeed('lily') % POOL_SIZES.f_ya);
    });

    it('spreads different people across the bucket (not all index 0)', () => {
      const indices = new Set<number>();
      for (let i = 0; i < 60; i++) {
        indices.add(_portraitSlot(`person-${i}`, 24, 'female')!.index);
      }
      expect(indices.size).toBeGreaterThan(4);
    });

    it('keeps every index within the bucket', () => {
      for (let i = 0; i < 100; i++) {
        const slot = _portraitSlot(`p${i}`, 34, 'male')!;
        expect(slot.index).toBeGreaterThanOrEqual(0);
        expect(slot.index).toBeLessThan(POOL_SIZES[slot.key]);
      }
    });
  });

  describe('getPortrait', () => {
    it('returns a face for a seeded person', () => {
      expect(getPortrait('sarah-1', 24, 'female')).toBeTruthy();
    });
    it('falls back to a base face when no seed', () => {
      expect(getPortrait(undefined, 24, 'female')).toBeTruthy();
      expect(getPortrait('', 70, 'male')).toBeTruthy();
    });
  });

  describe('parents age instead of freezing', () => {
    it('shows the fixed Mom/Dad portrait only while middle-aged', () => {
      expect(_parentUsesHero(35)).toBe(false); // young parent → pool
      expect(_parentUsesHero(48)).toBe(true); // middle-aged → hero
      expect(_parentUsesHero(55)).toBe(true);
      expect(_parentUsesHero(60)).toBe(false); // elderly → senior pool
      expect(_parentUsesHero(80)).toBe(false);
    });
    it('always returns a face across the parent lifespan', () => {
      for (const age of [30, 45, 55, 65, 85]) {
        expect(getParentPortrait('female', 'mom-1', age)).toBeTruthy();
        expect(getParentPortrait('male', 'dad-1', age)).toBeTruthy();
      }
    });
  });

  describe('legacyFace', () => {
    it('returns a face for every age/sex', () => {
      expect(legacyFace(1, 'female')).toBeTruthy();
      expect(legacyFace(25, 'male')).toBeTruthy();
      expect(legacyFace(70, 'female')).toBeTruthy();
    });
  });

  describe('getHeroPortrait', () => {
    it('resolves Mom and Dad', () => {
      expect(getHeroPortrait('mom')).toBeTruthy();
      expect(getHeroPortrait('dad')).toBeTruthy();
    });
  });

  describe('POOL_SIZES', () => {
    it('has the expected bucket counts (base + folded hero faces)', () => {
      expect(POOL_SIZES.f_ya).toBe(12); // 10 + bestfriend_f + sibling_f
      expect(POOL_SIZES.m_ya).toBe(13); // 10 + bestfriend_m + sibling_m + rival
      expect(POOL_SIZES.f_ad).toBe(6);
      expect(POOL_SIZES.m_ad).toBe(6);
      expect(POOL_SIZES.f_mid).toBe(5);
      expect(POOL_SIZES.m_mid).toBe(6); // 5 + boss
      expect(POOL_SIZES.f_sr).toBe(5); // 4 + grandparent
      expect(POOL_SIZES.m_sr).toBe(5); // 4 + mentor
      expect(POOL_SIZES.f_tn).toBe(3);
      expect(POOL_SIZES.f_kid).toBe(3);
      expect(POOL_SIZES.baby).toBe(3);
    });
  });

  describe('starter avatar picker', () => {
    it('lists male / female / mixed starter faces with parseable, unique ids', () => {
      const males = listStarterAvatars('male');
      const females = listStarterAvatars('female');
      const mixed = listStarterAvatars('random');
      expect(males.length).toBe(POOL_SIZES.m_ya);
      expect(females.length).toBe(POOL_SIZES.f_ya);
      expect(mixed.length).toBe(POOL_SIZES.m_ya + POOL_SIZES.f_ya);
      expect(males.every((o) => o.id.startsWith('m'))).toBe(true);
      expect(females.every((o) => o.id.startsWith('f'))).toBe(true);
      const ids = new Set(mixed.map((o) => o.id));
      expect(ids.size).toBe(mixed.length); // unique
      expect(mixed.every((o) => o.source)).toBe(true); // every face has an image
    });

    it('matches the scenario starting-age band', () => {
      expect(listStarterAvatars('female', 22).length).toBe(POOL_SIZES.f_ya);
      expect(listStarterAvatars('male', 22).length).toBe(POOL_SIZES.m_ya);
      expect(listStarterAvatars('female', 45).length).toBe(POOL_SIZES.f_mid);
      expect(listStarterAvatars('male', 33).length).toBe(POOL_SIZES.m_ad);
    });

    it('reads the sex encoded in an avatar id', () => {
      expect(avatarSexFromId('m3')).toBe('male');
      expect(avatarSexFromId('f0')).toBe('female');
      expect(avatarSexFromId('x9')).toBeUndefined();
      expect(avatarSexFromId(undefined)).toBeUndefined();
      expect(avatarSexFromId('')).toBeUndefined();
    });

    it('resolves a chosen avatar to a face at any age (clamps out-of-range)', () => {
      expect(getAvatarPortrait('m0', 18, 'Ada', 'male')).toBeTruthy();
      expect(getAvatarPortrait('f2', 25, 'Ada', 'female')).toBeTruthy();
      expect(getAvatarPortrait('m3', 70, 'Ada', 'male')).toBeTruthy(); // ages into senior band
      expect(getAvatarPortrait('m3', 3, 'Ada', 'male')).toBeTruthy(); // baby band
      expect(getAvatarPortrait('f999', 30, 'Ada', 'female')).toBeTruthy(); // clamps, no crash
    });

    it('falls back to the seeded portrait when no avatar is chosen', () => {
      expect(getAvatarPortrait(undefined, 25, 'Ada', 'female')).toBeTruthy();
      expect(getAvatarPortrait('', 25, 'Ada', 'male')).toBeTruthy();
      expect(getAvatarPortrait('garbage', 25, 'Ada', 'male')).toBeTruthy();
    });
  });
});
