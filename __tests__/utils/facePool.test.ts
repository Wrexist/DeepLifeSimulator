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
  HERO_FACE_SEX,
  _avatarSlot,
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
      // f_sr lost `hero_grandparent` — a neutral filename for a portrait of an
      // elderly MAN. This assertion previously read "4 + grandparent" and was
      // green the whole time the bug was live: it counted the bucket without
      // ever asking who was in it.
      expect(POOL_SIZES.f_sr).toBe(4);
      expect(POOL_SIZES.m_sr).toBe(6); // 4 + mentor + grandparent
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

/**
 * Player report, 2026-08-01: "Parents age into different genders." Mom turned
 * into an elderly man the week she crossed 56.
 *
 * Root cause: `hero_grandparent.png` depicts an elderly MAN, but its filename
 * says only "grandparent", and it had been folded into the `f_sr` bucket. Mom's
 * seed (`parent1`) hashes onto exactly that slot. The same asset also caught
 * the player directly — `getAvatarPortrait` clamped to the LAST slot of a
 * bucket, and `hero_grandparent` was the last entry in `f_sr`.
 *
 * Why the existing suite missed it: every portrait assertion above is
 * `toBeTruthy()`. A face was always returned, so the tests were green while the
 * wrong person was on screen. These check WHO, not just whether.
 */
describe('a portrait never changes the character sex', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'utils/facePool.ts'), 'utf8',
  );

  /** bucket key → the asset basenames listed under it in the POOL literal. */
  function bucketContents(): Record<string, string[]> {
    const pool = SRC.slice(SRC.indexOf('const POOL'), SRC.indexOf('export const HERO_FACE_SEX'));
    const out: Record<string, string[]> = {};
    const bucketRe = /^ {2}([a-z_]+): \[([\s\S]*?)^ {2}\],$/gm;
    let m: RegExpExecArray | null;
    while ((m = bucketRe.exec(pool)) !== null) {
      // Extension-agnostic. This was `\.png` and broke the moment the art was
      // re-encoded to WebP for the bundle-size fix — a format change that cannot
      // affect what this suite is actually about (which asset sits in which sex
      // bucket). The control below is what caught it; without that control the
      // regex would have matched nothing and every assertion here would have
      // passed vacuously forever.
      out[m[1]] = [...m[2].matchAll(/pool\/([a-z0-9_]+)\.(?:png|jpe?g|webp)/g)].map((a) => a[1]);
    }
    return out;
  }

  it('the parser actually found the buckets (the control)', () => {
    // A regex that matched nothing would make every assertion below vacuous.
    const buckets = bucketContents();
    expect(Object.keys(buckets).length).toBe(Object.keys(POOL_SIZES).length);
    for (const [key, size] of Object.entries(POOL_SIZES)) {
      expect(`${key}: ${buckets[key]?.length}`).toBe(`${key}: ${size}`);
    }
  });

  it('every sex-named asset sits in the bucket its name claims', () => {
    for (const [key, names] of Object.entries(bucketContents())) {
      if (key === 'baby') continue; // babies are sex-neutral by design
      const wanted = key[0]; // 'f' or 'm'
      for (const name of names) {
        if (!/^[fm]_/.test(name)) continue; // hero faces handled below
        expect(`${key} contains ${name}`).toBe(`${key} contains ${name.startsWith(wanted) ? name : `${wanted}${name.slice(1)}`}`);
      }
    }
  });

  it('every hero face sits in the bucket its DEPICTED sex requires', () => {
    // The hero files are named for a role, not a person, so the name cannot be
    // trusted. HERO_FACE_SEX is the written-down answer; this holds the table
    // and the buckets to each other.
    for (const [key, names] of Object.entries(bucketContents())) {
      if (key === 'baby') continue;
      for (const name of names) {
        if (!name.startsWith('hero_')) continue;
        expect(`${name} in ${key}`).toBe(`${name} in ${HERO_FACE_SEX[name]}_${key.split('_')[1]}`);
      }
    }
  });

  it('hero_grandparent is declared male and lives in m_sr', () => {
    // The specific regression. Named explicitly so a future re-shuffle has to
    // delete a sentence about a real player report, not just move a line.
    expect(HERO_FACE_SEX.hero_grandparent).toBe('m');
    expect(bucketContents().f_sr).not.toContain('hero_grandparent');
    expect(bucketContents().m_sr).toContain('hero_grandparent');
  });

  it('Mom resolves to a female bucket at every age past the hero years', () => {
    // parent1 is Mom's seeded id in initialState, and the seed that hashed onto
    // the bad slot — so she is the case that matters.
    //
    // Asserted as a BUCKET, not by comparing images: jest maps every PNG to one
    // shared file mock, so `getParentPortrait(...) === getParentPortrait(...)`
    // is true for any two characters and proves nothing. The bucket plus the
    // source assertions above (only female assets live in f_*) are the real
    // guarantee.
    for (const age of [30, 45, 55, 56, 65, 80, 100]) {
      const label = _parentUsesHero(age)
        ? 'hero_mom'
        : _portraitSlot('parent1', age, 'female')!.key;
      expect(`age ${age}: ${label}`)
        .toBe(`age ${age}: ${_parentUsesHero(age) ? 'hero_mom' : `f_${bandForAge(age)}`}`);
    }
  });

  it('and every seeded woman lands in a female bucket, never a male one', () => {
    // Not just Mom: no seed, at any age, may route a woman into an m_ bucket.
    for (let i = 0; i < 300; i++) {
      for (const age of [8, 15, 24, 34, 48, 70]) {
        const key = _portraitSlot(`w${i}`, age, 'female')!.key;
        expect(`w${i}@${age}: ${key.startsWith('m_') ? 'MALE BUCKET' : 'ok'}`)
          .toBe(`w${i}@${age}: ok`);
      }
    }
  });

  it('and the senior women spread over the whole bucket (the control)', () => {
    // Guards against "always female" being satisfied by always returning slot 0.
    const indices = new Set(
      Array.from({ length: 300 }, (_, i) => _portraitSlot(`w${i}`, 70, 'female')!.index),
    );
    expect(indices.size).toBe(POOL_SIZES.f_sr);
  });
});

describe('the player keeps their own face as they age', () => {
  it('two women who picked different starter faces never become the same person', () => {
    // The clamp bug: `Math.min(index, len - 1)` collapsed every pick from 5
    // upward onto ONE slot, so most players aged into an identical stranger —
    // and into each other. Read as slots, because jest gives every PNG the same
    // file mock and comparing the images would report 1 distinct face either way.
    const starters = listStarterAvatars('female', 25);
    expect(starters.length).toBeGreaterThan(POOL_SIZES.f_sr); // the clamp's precondition

    for (const age of [34, 48, 70]) {
      const bucketSize = POOL_SIZES[`f_${bandForAge(age)}`];
      const occupancy = new Map<number, number>();
      for (const a of starters) {
        const i = _avatarSlot(a.id, age)!.index;
        occupancy.set(i, (occupancy.get(i) ?? 0) + 1);
      }
      // COVERAGE is the wrong property and would pass either way: clamping
      // min(i, len-1) across ids 0..11 still touches every slot. What clamping
      // actually did was pile ids 4..11 onto the LAST slot — eight of twelve
      // women sharing one face. So assert the heaviest slot instead.
      const worst = Math.max(...occupancy.values());
      expect(`age ${age}: worst ${worst}`)
        .toBe(`age ${age}: worst ${Math.ceil(starters.length / bucketSize)}`);
    }
  });

  it('a chosen face is stable — same pick, same age, same slot', () => {
    for (const age of [18, 34, 70]) {
      expect(_avatarSlot('f7', age)).toEqual(_avatarSlot('f7', age));
    }
    // And the image the slot resolves to is returned without throwing.
    expect(getAvatarPortrait('f7', 34, 'Ada', 'female')).toBeTruthy();
  });

  it('and it never changes sex on the player', () => {
    for (const a of listStarterAvatars('female', 25)) {
      for (const age of [25, 34, 48, 70]) {
        const key = _avatarSlot(a.id, age)!.key;
        expect(`${a.id} at ${age}: ${key.startsWith('m_') ? 'MALE BUCKET' : 'ok'}`)
          .toBe(`${a.id} at ${age}: ok`);
      }
    }
  });

  // ── Owner decision, 2026-08-02: "age, keep identity" ────────────────────
  //
  // The player's own portrait SHOULD change as they get older, but it must
  // stay the same person — the complaint behind the report was seeing yourself
  // turn into someone else.
  //
  // The two halves pull against each other, so both are asserted. A fix for
  // "stops changing sex" that froze the portrait would pass the stability tests
  // above and silently deliver the "one portrait for life" option the owner did
  // NOT choose.

  it('the player portrait advances through every band as they age', () => {
    // Not "changes at least once" — that would pass if it moved a single time
    // and then froze. Every band boundary must be crossed, in order.
    const id = 'f3';
    const seen = [5, 13, 18, 30, 40, 56].map((age) => _avatarSlot(id, age)!.key);

    expect(seen).toEqual(['f_kid', 'f_tn', 'f_ya', 'f_ad', 'f_mid', 'f_sr']);
    expect(new Set(seen).size).toBe(seen.length); // all distinct
  });

  it('a pick keeps its RELATIVE position in every band', () => {
    // The identity half of the decision, and the assertion that actually
    // catches the reported bug.
    //
    // Buckets are different sizes (f: 3 teen, 12 young-adult, 4 senior), so an
    // absolute index cannot be stable — 12 people cannot have 12 distinct faces
    // in a band holding 3. What CAN hold is ordering: someone who picked an
    // early face must stay early at every age.
    //
    // `index % bucket.length` did not. `f7` went 1 → 7 → 1 → 2 → 3 across the
    // lifespan, unrelated band to band. That is the player report.
    const ages = [6, 14, 20, 34, 45, 70];

    for (const sex of ['male', 'female'] as const) {
      const ids = listStarterAvatars(sex, 18).map((a) => a.id);

      for (const age of ages) {
        const slots = ids.map((id) => _avatarSlot(id, age)!.index);
        // Non-decreasing: picks may COLLIDE in a small bucket, but must never
        // cross over each other.
        const sorted = [...slots].sort((a, b) => a - b);
        expect(`${sex}@${age}: ${slots.join(',')}`).toBe(`${sex}@${age}: ${sorted.join(',')}`);
      }
    }
  });

  it('the starter picker still offers distinct faces at the pick age (the control)', () => {
    // The collisions above are only acceptable in the SMALL bands. At the age
    // the player actually chooses, every offered face must still be its own
    // slot — otherwise the picker is showing duplicates.
    for (const sex of ['male', 'female'] as const) {
      const slots = listStarterAvatars(sex, 18).map((a) => _avatarSlot(a.id, 18)!.index);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it('an out-of-range or junk avatar id still resolves (the control)', () => {
    expect(getAvatarPortrait('f999', 30, 'Ada', 'female')).toBeTruthy();
    expect(getAvatarPortrait('garbage', 25, 'Ada', 'male')).toBeTruthy();
    expect(getAvatarPortrait(undefined, 25, 'Ada', 'female')).toBeTruthy();
  });
});
