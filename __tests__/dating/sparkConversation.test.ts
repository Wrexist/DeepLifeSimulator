/**
 * Spark's choice-driven conversation — the engine, the gates and the commit.
 *
 * The chat stopped being a free-text box in v45 and became a short game with
 * state: a per-match rapport score, gated moves, per-option cooldowns and a
 * money-and-energy-charging date. That puts it squarely in the two bug classes
 * this repo keeps re-learning — CLAUDE.md §4.4 (gate outside the updater, grant
 * inside, so a double tap pays once) and §4.2 (cooldowns on `weeksLived`, never
 * the cyclic week and never a device clock) — so the coverage here is aimed at
 * those first and the copy second.
 *
 * Every roll is injected. Nothing in this file retries until it gets the
 * outcome it wants.
 */
import {
  playConversationOption,
  getSparkConversationView,
  resolveMatchPromotion,
  promoteMatchToRelationship,
} from '@/contexts/game/actions/SparkActions';
import {
  SPARK_CONVERSATION_OPTIONS,
  SPARK_DATE_VENUES,
  FRESH_MATCH_RAPPORT,
  SUPER_LIKE_RAPPORT_BONUS,
  clampRapport,
  cooldownRemaining,
  findConversationOption,
  listConversationOptions,
  playerAppeal,
  rapportBand,
  readRapport,
  resolveConversationOption,
  resolveOptionAvailability,
  successChanceFor,
  type SparkConversationOptionId,
} from '@/lib/spark/conversation';
import { PERSONALITY_TONE, resolveNpcPool, resolveTone } from '@/lib/spark/conversationContent';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { runMigrations, CURRENT_STATE_VERSION, isMigrationVersionCovered } from '@/utils/saveMigrations';
import { mergeLoadedSlice } from '@/utils/loadedStateMerge';
import type { GameState, SparkMatch } from '@/contexts/game/types';

const PROFILE = DATING_PROFILES[0];
const MATCH_ID = 'spm-test-1';

/** Always-succeed / always-fail rolls. `successChanceFor` is clamped to 0.05..0.95. */
const ALWAYS = () => 0;
const NEVER = () => 0.999;

function makeMatch(over: Partial<SparkMatch> = {}): SparkMatch {
  return {
    id: MATCH_ID,
    profileId: PROFILE.id,
    matchedWeek: 100,
    superLiked: false,
    promoted: false,
    ...over,
  };
}

/**
 * A state with one match, plenty of energy and cash, at week 3_000.
 *
 * `createTestGameState` (Hard Rule #3) — never a hand-built GameState, never
 * `as GameState`. It deep-clones its base, so mutating the returned slice here
 * cannot leak into the module singleton.
 */
function stateWith(
  match: Partial<SparkMatch> = {},
  overrides: Partial<GameState> = {},
): GameState {
  const s = createTestGameState({ weeksLived: 3_000, ...overrides });
  s.stats.energy = 100;
  s.stats.money = 10_000;
  s.stats.happiness = 60;
  s.stats.reputation = 50;
  s.stats.fitness = 50;
  s.sparkApp!.matches = [makeMatch(match)];
  s.sparkApp!.messages = {};
  return s;
}

function makeHarness(initial: GameState) {
  let current = initial;
  // Typed as the real `SetStateAction<GameState>` union rather than cast — an
  // `as GameState` here is exactly the drift Hard Rule #3 forbids, and the
  // save audit flags it.
  const setGameState = (updater: GameState | ((prev: GameState) => GameState)) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  };
  return { setGameState, getState: () => current };
}

const matchIn = (s: GameState): SparkMatch => s.sparkApp!.matches[0];
const threadIn = (s: GameState) => s.sparkApp!.messages[MATCH_ID] ?? [];

// ─────────────────────────────────────────────────────────────────────
// Rapport model
// ─────────────────────────────────────────────────────────────────────

describe('rapport', () => {
  it('an absent value reads as the fresh-match baseline (the v45 carve-out)', () => {
    // This is WHY the migration needs no backfill: absence already resolves.
    expect(readRapport(makeMatch())).toBe(FRESH_MATCH_RAPPORT);
    expect(readRapport(undefined)).toBe(FRESH_MATCH_RAPPORT);
  });

  it('a super-like starts the chat warmer, without storing anything', () => {
    expect(readRapport(makeMatch({ superLiked: true }))).toBe(
      FRESH_MATCH_RAPPORT + SUPER_LIKE_RAPPORT_BONUS,
    );
  });

  it('clamps to 0-100 and survives garbage', () => {
    expect(clampRapport(-40)).toBe(0);
    expect(clampRapport(9_999)).toBe(100);
    expect(clampRapport(Number.NaN)).toBe(FRESH_MATCH_RAPPORT);
    expect(readRapport(makeMatch({ rapport: 250 }))).toBe(100);
    expect(readRapport(makeMatch({ rapport: -8 }))).toBe(0);
  });

  it('never leaves 0-100 however many moves land or miss', () => {
    // The week must be advanced BEFORE the harness is built, so the updater's
    // `prev` carries it too — otherwise the cooldown, not the clamp, is what
    // stops the loop and the test proves nothing.
    const nextWeek = (st: GameState): GameState => ({
      ...st,
      weeksLived: (st.weeksLived ?? 0) + 1,
      stats: { ...st.stats, energy: 100 },
    });

    // 30 successful jokes at +9 each would be 290 unclamped.
    let s = stateWith({ rapport: 90 });
    for (let i = 0; i < 30; i++) {
      s = nextWeek(s);
      const { setGameState, getState } = makeHarness(s);
      const played = playConversationOption(setGameState, s, MATCH_ID, 'joke', undefined, ALWAYS);
      expect(played.success).toBe(true);
      s = getState();
      expect(readRapport(matchIn(s))).toBeLessThanOrEqual(100);
      expect(readRapport(matchIn(s))).toBeGreaterThanOrEqual(0);
    }
    expect(readRapport(matchIn(s))).toBe(100);

    let t = stateWith({ rapport: 5 });
    for (let i = 0; i < 10; i++) {
      t = nextWeek(t);
      const { setGameState, getState } = makeHarness(t);
      playConversationOption(setGameState, t, MATCH_ID, 'compliment', undefined, NEVER);
      t = getState();
    }
    expect(readRapport(matchIn(t))).toBe(0);
  });

  it('bands the score for the header label', () => {
    expect(rapportBand(0)).toBe('strangers');
    expect(rapportBand(30)).toBe('warming up');
    expect(rapportBand(50)).toBe('clicking');
    expect(rapportBand(70)).toBe('into you');
    expect(rapportBand(100)).toBe('smitten');
  });
});

describe('playerAppeal', () => {
  it('is built from stats that actually exist on GameStats', () => {
    // The point of the assertion: a typo'd stat name would compile, read
    // undefined and silently neutralise the term (CLAUDE.md §5).
    expect(playerAppeal({ happiness: 100, reputation: 100, fitness: 100 })).toBeCloseTo(1);
    expect(playerAppeal({ happiness: 0, reputation: 0, fitness: 0 })).toBeCloseTo(0);
    expect(playerAppeal(undefined)).toBeCloseTo(0.5);
    expect(playerAppeal({ happiness: 200, reputation: -50, fitness: 50 })).toBeGreaterThan(0);
  });

  it('moves the success chance in the right direction', () => {
    const option = findConversationOption('compliment')!;
    const low = successChanceFor({ option, rapport: 50, personality: 'caring', appeal: 0 });
    const high = successChanceFor({ option, rapport: 50, personality: 'caring', appeal: 1 });
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThanOrEqual(0.05);
    expect(high).toBeLessThanOrEqual(0.95);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Gates
// ─────────────────────────────────────────────────────────────────────

describe('availability gating', () => {
  const gate = (rapport: number) => ({
    rapport,
    energy: 100,
    money: 10_000,
    weeksLived: 3_000,
    messageCount: 2,
    promoted: false,
  });

  it('locks flirt at low rapport, unlocks it in the middle', () => {
    const flirt = findConversationOption('flirt')!;
    expect(resolveOptionAvailability(flirt, gate(10)).available).toBe(false);
    expect(resolveOptionAvailability(flirt, gate(10)).reason).toContain('rapport');
    expect(resolveOptionAvailability(flirt, gate(40)).available).toBe(true);
  });

  it('locks the date at mid rapport and go-steady at high', () => {
    const date = findConversationOption('ask_date')!;
    const steady = findConversationOption('go_steady')!;
    expect(resolveOptionAvailability(date, gate(30)).available).toBe(false);
    expect(resolveOptionAvailability(date, gate(50)).available).toBe(true);
    expect(resolveOptionAvailability(steady, gate(50)).available).toBe(false);
    expect(resolveOptionAvailability(steady, gate(80)).available).toBe(true);
  });

  it('offers the opener only on a fresh chat, and hides go-steady once promoted', () => {
    const ice = findConversationOption('break_ice')!;
    expect(resolveOptionAvailability(ice, { ...gate(20), messageCount: 0 }).available).toBe(true);
    expect(resolveOptionAvailability(ice, { ...gate(20), messageCount: 4 }).visible).toBe(false);

    const steady = findConversationOption('go_steady')!;
    expect(resolveOptionAvailability(steady, { ...gate(90), promoted: true }).visible).toBe(false);
  });

  it('gates on rapport BEFORE energy, so the chip reads as a goal not a wallet problem', () => {
    const flirt = findConversationOption('flirt')!;
    const broke = resolveOptionAvailability(flirt, { ...gate(5), energy: 0 });
    expect(broke.reason).toContain('rapport');
  });

  it('surfaces the energy and cash reasons when the rapport gate is cleared', () => {
    const compliment = findConversationOption('compliment')!;
    expect(resolveOptionAvailability(compliment, { ...gate(50), energy: 1 }).reason).toContain('energy');
    const date = findConversationOption('ask_date')!;
    expect(resolveOptionAvailability(date, { ...gate(60), money: 0 }).reason).toContain('$');
  });

  it('every catalog option is either available or carries a reason', () => {
    for (const row of listConversationOptions(gate(0))) {
      if (!row.available) expect(typeof row.reason).toBe('string');
    }
  });
});

describe('cooldowns', () => {
  it('block a repeat and expire on weeksLived, never on the wall clock', () => {
    const compliment = findConversationOption('compliment')!;
    expect(compliment.cooldownWeeks).toBeGreaterThanOrEqual(1);
    const cooldowns = { compliment: 3_000 };
    expect(cooldownRemaining(compliment, cooldowns, 3_000)).toBe(compliment.cooldownWeeks);
    expect(cooldownRemaining(compliment, cooldowns, 3_000 + compliment.cooldownWeeks)).toBe(0);
    expect(cooldownRemaining(compliment, undefined, 3_000)).toBe(0);
  });

  it('every option carries one - this is also the double-tap guard', () => {
    for (const option of SPARK_CONVERSATION_OPTIONS) {
      expect(option.cooldownWeeks).toBeGreaterThanOrEqual(1);
    }
  });

  it('stops a compliment being spammed to ratchet rapport', () => {
    const s = stateWith({ rapport: 40 });
    const { setGameState, getState } = makeHarness(s);

    const first = playConversationOption(setGameState, s, MATCH_ID, 'compliment', undefined, ALWAYS);
    expect(first.success).toBe(true);
    const afterOne = readRapport(matchIn(getState()));

    // Same game week, fresh snapshot: the cooldown refuses.
    const second = playConversationOption(setGameState, getState(), MATCH_ID, 'compliment', undefined, ALWAYS);
    expect(second.success).toBe(false);
    expect(second.message.toLowerCase()).toContain('week');
    expect(readRapport(matchIn(getState()))).toBe(afterOne);

    // A week later it is playable again. Pushed through the harness so the
    // updater's `prev` sees the new week as well as the caller's snapshot.
    const later: GameState = { ...getState(), weeksLived: (getState().weeksLived ?? 0) + 1 };
    setGameState(later);
    const third = playConversationOption(setGameState, later, MATCH_ID, 'compliment', undefined, ALWAYS);
    expect(third.success).toBe(true);
    expect(readRapport(matchIn(getState()))).toBeGreaterThan(afterOne);
  });

  it('stamps weeksLived, not the cyclic week (CLAUDE.md §4.2)', () => {
    const s = stateWith({}, { weeksLived: 3_000, week: 2 });
    s.stats.energy = 100;
    const { setGameState, getState } = makeHarness(s);
    playConversationOption(setGameState, s, MATCH_ID, 'ask_interests', undefined, ALWAYS);
    expect(matchIn(getState()).conversationCooldowns?.ask_interests).toBe(3_000);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Atomicity — CLAUDE.md §4.4
// ─────────────────────────────────────────────────────────────────────

describe('atomicity', () => {
  it('a same-batch double tap charges once and says one thing (§4.4)', () => {
    const s = stateWith({ rapport: 40 });
    const { setGameState, getState } = makeHarness(s);
    const energyBefore = s.stats.energy;

    // BOTH calls read the SAME stale pre-dispatch snapshot — the shape a
    // double tap in one React batch actually takes. Only the in-updater
    // re-check against `prev` can stop the second.
    playConversationOption(setGameState, s, MATCH_ID, 'compliment', undefined, ALWAYS);
    playConversationOption(setGameState, s, MATCH_ID, 'compliment', undefined, ALWAYS);

    const option = findConversationOption('compliment')!;
    expect(getState().stats.energy).toBe(energyBefore - option.energyCost);
    expect(threadIn(getState())).toHaveLength(2); // one player line, one reply
    expect(readRapport(matchIn(getState()))).toBe(clampRapport(40 + option.rapportOnSuccess));
  });

  it('a double-tapped date charges the cash once', () => {
    const s = stateWith({ rapport: 60 });
    const { setGameState, getState } = makeHarness(s);
    const moneyBefore = s.stats.money;
    const dinner = SPARK_DATE_VENUES.find((v) => v.id === 'dinner')!;

    playConversationOption(setGameState, s, MATCH_ID, 'ask_date', 'dinner', ALWAYS);
    playConversationOption(setGameState, s, MATCH_ID, 'ask_date', 'dinner', ALWAYS);

    expect(getState().stats.money).toBe(moneyBefore - dinner.cashCost);
    expect(getState().sparkApp!.lifetimeStats.totalDatesGoneOn).toBe(1);
  });

  it('refuses without mutating when energy is short', () => {
    const s = stateWith({ rapport: 40 });
    s.stats.energy = 1;
    const { setGameState, getState } = makeHarness(s);

    const r = playConversationOption(setGameState, s, MATCH_ID, 'compliment', undefined, ALWAYS);
    expect(r.success).toBe(false);
    expect(r.message).toContain('energy');
    expect(getState().stats.energy).toBe(1);
    expect(threadIn(getState())).toHaveLength(0);
    expect(matchIn(getState()).rapport).toBe(40); // untouched
    expect(matchIn(getState()).conversationCooldowns).toBeUndefined();
  });

  it('refuses without mutating when the chosen date is unaffordable', () => {
    // Deliberately enough for COFFEE but not for DINNER: the generic gate
    // prices a date at its cheapest venue, so this is the case that used to
    // report success while the updater silently rejected the charge.
    const s = stateWith({ rapport: 60 });
    s.stats.money = 50;
    const { setGameState, getState } = makeHarness(s);

    const r = playConversationOption(setGameState, s, MATCH_ID, 'ask_date', 'dinner', ALWAYS);
    expect(r.success).toBe(false);
    expect(r.message).toContain('$');
    expect(getState().stats.money).toBe(50);
    expect(getState().stats.energy).toBe(100);
    expect(threadIn(getState())).toHaveLength(0);
  });

  it('refuses a locked move without mutating', () => {
    const s = stateWith({ rapport: 5 });
    const { setGameState, getState } = makeHarness(s);
    const r = playConversationOption(setGameState, s, MATCH_ID, 'flirt', undefined, ALWAYS);
    expect(r.success).toBe(false);
    expect(getState().stats.energy).toBe(100);
    expect(threadIn(getState())).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────

describe('dates', () => {
  it.each(SPARK_DATE_VENUES.map((v) => [v.id, v] as const))(
    'charges the %s venue its own cash and energy',
    (_id, venue) => {
      const s = stateWith({ rapport: 60 });
      const { setGameState, getState } = makeHarness(s);
      const askDate = findConversationOption('ask_date')!;

      const r = playConversationOption(setGameState, s, MATCH_ID, 'ask_date', venue.id, ALWAYS);
      expect(r.success).toBe(true);
      expect(getState().stats.money).toBe(10_000 - venue.cashCost);
      expect(getState().stats.energy).toBe(100 - (askDate.energyCost + venue.energyCost));
      expect(readRapport(matchIn(getState()))).toBe(clampRapport(60 + venue.rapportOnSuccess));
    },
  );

  it('counts a bad date as a date, and it costs the same', () => {
    const s = stateWith({ rapport: 60 });
    const { setGameState, getState } = makeHarness(s);
    const coffee = SPARK_DATE_VENUES.find((v) => v.id === 'coffee')!;

    const r = playConversationOption(setGameState, s, MATCH_ID, 'ask_date', 'coffee', NEVER);
    expect(r.success).toBe(true); // the MOVE was played
    expect(r.outcome).toBe('miss'); // it just did not land
    expect(getState().stats.money).toBe(10_000 - coffee.cashCost);
    expect(getState().sparkApp!.lifetimeStats.totalDatesGoneOn).toBe(1);
    expect(readRapport(matchIn(getState()))).toBe(clampRapport(60 + coffee.rapportOnMiss));
  });

  it('needs a venue before it can be played', () => {
    const s = stateWith({ rapport: 60 });
    const { setGameState, getState } = makeHarness(s);
    const r = playConversationOption(setGameState, s, MATCH_ID, 'ask_date', undefined, ALWAYS);
    expect(r.success).toBe(false);
    expect(threadIn(getState())).toHaveLength(0);
  });

  it('the venue changes who says yes - the sub-choice is not cosmetic', () => {
    const askDate = findConversationOption('ask_date')!;
    const adventure = SPARK_DATE_VENUES.find((v) => v.id === 'adventure')!;
    const coffee = SPARK_DATE_VENUES.find((v) => v.id === 'coffee')!;
    const boldPerson = { option: askDate, rapport: 60, appeal: 0.5, personality: 'adventurous' };
    expect(successChanceFor({ ...boldPerson, venue: adventure })).toBeGreaterThan(
      successChanceFor({ ...boldPerson, venue: coffee }),
    );
    const calmPerson = { option: askDate, rapport: 60, appeal: 0.5, personality: 'zen' };
    expect(successChanceFor({ ...calmPerson, venue: coffee })).toBeGreaterThan(
      successChanceFor({ ...calmPerson, venue: adventure }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Go steady — delegating to the one anti-bigamy authority
// ─────────────────────────────────────────────────────────────────────

describe('go steady', () => {
  it('creates the partner relationship through resolveMatchPromotion', () => {
    const s = stateWith({ rapport: 90 });
    const { setGameState, getState } = makeHarness(s);

    const r = playConversationOption(setGameState, s, MATCH_ID, 'go_steady', undefined, ALWAYS);
    expect(r.success).toBe(true);
    expect(r.outcome).toBe('success');
    expect(r.relationshipId).toBe(MATCH_ID);

    const rel = getState().relationships?.find((x) => x.id === MATCH_ID);
    expect(rel?.type).toBe('partner');
    expect(rel?.name).toBe(PROFILE.name);
    expect(matchIn(getState()).promoted).toBe(true);
    expect(threadIn(getState())).toHaveLength(2);
  });

  it('surfaces the anti-bigamy refusal and charges nothing', () => {
    const s = stateWith({ rapport: 90 });
    s.relationships = [
      ...(s.relationships ?? []),
      {
        id: 'existing-partner',
        name: 'Robin Vale',
        type: 'partner',
        relationshipScore: 70,
        personality: 'caring',
        gender: 'female',
        age: 30,
      },
    ];
    const { setGameState, getState } = makeHarness(s);

    const r = playConversationOption(setGameState, s, MATCH_ID, 'go_steady', undefined, ALWAYS);
    expect(r.success).toBe(false);
    // The message comes from the promotion authority, not a copy of its rule.
    expect(r.message).toContain('Robin Vale');
    expect(getState().stats.energy).toBe(100);
    expect(threadIn(getState())).toHaveLength(0);
    expect(matchIn(getState()).promoted).toBe(false);
  });

  it('a refusal from THEM leaves the match unpromoted but still costs the energy', () => {
    const s = stateWith({ rapport: 90 });
    const { setGameState, getState } = makeHarness(s);
    const steady = findConversationOption('go_steady')!;

    const r = playConversationOption(setGameState, s, MATCH_ID, 'go_steady', undefined, NEVER);
    expect(r.success).toBe(true);
    expect(r.outcome).toBe('miss');
    expect(r.relationshipId).toBeUndefined();
    expect(matchIn(getState()).promoted).toBe(false);
    expect(getState().relationships?.some((x) => x.id === MATCH_ID)).toBe(false);
    expect(getState().stats.energy).toBe(100 - steady.energyCost);
    expect(readRapport(matchIn(getState()))).toBe(clampRapport(90 + steady.rapportOnMiss));
  });

  it('a double tap cannot create two partners', () => {
    const s = stateWith({ rapport: 90 });
    const { setGameState, getState } = makeHarness(s);
    playConversationOption(setGameState, s, MATCH_ID, 'go_steady', undefined, ALWAYS);
    playConversationOption(setGameState, s, MATCH_ID, 'go_steady', undefined, ALWAYS);
    expect(getState().relationships?.filter((x) => x.type === 'partner')).toHaveLength(1);
  });

  it('the header heart still routes through the same authority', () => {
    // `promoteMatchToRelationship` was refactored onto `resolveMatchPromotion`;
    // its contract must be unchanged.
    const s = stateWith();
    const { setGameState, getState } = makeHarness(s);
    const r = promoteMatchToRelationship(setGameState, s, MATCH_ID);
    expect(r.success).toBe(true);
    expect(r.relationshipId).toBe(MATCH_ID);
    expect(getState().relationships?.find((x) => x.id === MATCH_ID)?.type).toBe('partner');

    const again = promoteMatchToRelationship(setGameState, getState(), MATCH_ID);
    expect(again.success).toBe(false);
    expect(resolveMatchPromotion(getState(), MATCH_ID).ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Content coverage
// ─────────────────────────────────────────────────────────────────────

describe('reply content', () => {
  const personalities = Array.from(new Set(DATING_PROFILES.map((p) => p.personality)));

  it('every catalog personality has an explicit tone (no silent default)', () => {
    const unmapped = personalities.filter((p) => !(p in PERSONALITY_TONE));
    expect(unmapped).toEqual([]);
  });

  it.each(personalities)('%s resolves a non-empty reply for every option and outcome', (personality) => {
    const tone = resolveTone(personality);
    for (const option of SPARK_CONVERSATION_OPTIONS) {
      for (const outcome of ['success', 'miss'] as const) {
        const pool = resolveNpcPool(option.id, outcome, tone);
        expect(pool.length).toBeGreaterThan(0);
        for (const line of pool) expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves real text for every personality x option x outcome, end to end', () => {
    for (const profile of DATING_PROFILES) {
      for (const option of SPARK_CONVERSATION_OPTIONS) {
        for (const rand of [ALWAYS, NEVER]) {
          const res = resolveConversationOption({
            optionId: option.id,
            venueId: option.requiresVenue ? 'dinner' : undefined,
            rapport: 50,
            profile: {
              name: profile.name,
              personality: profile.personality,
              interests: profile.interests,
            },
            appeal: 0.5,
            rand,
          });
          expect(res).not.toBeNull();
          expect(res!.playerText.trim().length).toBeGreaterThan(0);
          expect(res!.npcText.trim().length).toBeGreaterThan(0);
          // No unresolved template tokens made it into the thread.
          expect(res!.playerText).not.toMatch(/\{\w+\}/);
          expect(res!.npcText).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });

  it('pulls the profile\'s real interests into the "ask about them" line', () => {
    const res = resolveConversationOption({
      optionId: 'ask_interests',
      rapport: 30,
      profile: { name: PROFILE.name, personality: PROFILE.personality, interests: PROFILE.interests },
      appeal: 0.5,
      rand: ALWAYS,
    })!;
    const mentioned = PROFILE.interests.some((i) =>
      res.playerText.toLowerCase().includes(i.toLowerCase()),
    );
    expect(mentioned).toBe(true);
  });

  it('survives a profile with no interests at all', () => {
    const res = resolveConversationOption({
      optionId: 'ask_interests',
      rapport: 30,
      profile: { name: 'Nameless One', personality: 'unknown-personality-xyz', interests: [] },
      appeal: 0.5,
      rand: ALWAYS,
    });
    expect(res).not.toBeNull();
    expect(res!.playerText).not.toMatch(/\{\w+\}/);
  });

  it('ships no emoji in any conversation line', () => {
    // These strings are rendered as chat bubbles and read back in match
    // previews; the brief for this system is emoji-free copy.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const profile of DATING_PROFILES.slice(0, 8)) {
      for (const option of SPARK_CONVERSATION_OPTIONS) {
        for (const rand of [ALWAYS, NEVER]) {
          const res = resolveConversationOption({
            optionId: option.id,
            venueId: option.requiresVenue ? 'coffee' : undefined,
            rapport: 60,
            profile: {
              name: profile.name,
              personality: profile.personality,
              interests: profile.interests,
            },
            appeal: 0.5,
            rand,
          })!;
          expect(res.playerText).not.toMatch(emoji);
          expect(res.npcText).not.toMatch(emoji);
        }
      }
    }
  });

  it('personality fit actually moves the odds', () => {
    const joke = findConversationOption('joke')!;
    const playful = successChanceFor({ option: joke, rapport: 50, personality: 'cheerful', appeal: 0.5 });
    const driven = successChanceFor({ option: joke, rapport: 50, personality: 'ambitious', appeal: 0.5 });
    expect(playful).toBeGreaterThan(driven);

    const flirt = findConversationOption('flirt')!;
    const bold = successChanceFor({ option: flirt, rapport: 50, personality: 'adventurous', appeal: 0.5 });
    const calm = successChanceFor({ option: flirt, rapport: 50, personality: 'zen', appeal: 0.5 });
    expect(bold).toBeGreaterThan(calm);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Thread integrity + the view the UI draws from
// ─────────────────────────────────────────────────────────────────────

describe('the thread', () => {
  it('records the chosen line as a real player message so previews keep working', () => {
    const s = stateWith({ rapport: 30 });
    const { setGameState, getState } = makeHarness(s);
    playConversationOption(setGameState, s, MATCH_ID, 'ask_interests', undefined, ALWAYS);

    const thread = threadIn(getState());
    expect(thread).toHaveLength(2);
    expect(thread[0].from).toBe('player');
    expect(thread[1].from).toBe('npc');
    // MatchesScreen sorts on this and shows the last entry as the preview.
    expect(matchIn(getState()).lastMessageTimestamp).toBeGreaterThan(0);
    expect(thread[0].gameWeek).toBe(3_000);
    expect(thread[1].gameWeek).toBe(3_000);
    expect(thread.every((m) => m.matchId === MATCH_ID)).toBe(true);
    expect(new Set(thread.map((m) => m.id)).size).toBe(2);
  });

  it('clears both unread counters - the player is looking at the chat', () => {
    const s = stateWith({ rapport: 30, unreadByPlayer: 3, unreadByNpc: 2 });
    const { setGameState, getState } = makeHarness(s);
    playConversationOption(setGameState, s, MATCH_ID, 'ask_interests', undefined, ALWAYS);
    expect(matchIn(getState()).unreadByPlayer).toBe(0);
    expect(matchIn(getState()).unreadByNpc).toBe(0);
  });

  it('rejects an unknown match or option without touching state', () => {
    const s = stateWith();
    const { setGameState, getState } = makeHarness(s);
    expect(playConversationOption(setGameState, s, 'nope', 'compliment', undefined, ALWAYS).success).toBe(false);
    expect(
      playConversationOption(
        setGameState,
        s,
        MATCH_ID,
        'not_a_move' as SparkConversationOptionId,
        undefined,
        ALWAYS,
      ).success,
    ).toBe(false);
    expect(getState().stats.energy).toBe(100);
  });
});

describe('getSparkConversationView', () => {
  it('gives the UI the same gate the action re-checks', () => {
    const s = stateWith({ rapport: 30 });
    const view = getSparkConversationView(s, MATCH_ID)!;
    expect(view.rapport).toBe(30);
    expect(view.options).toHaveLength(SPARK_CONVERSATION_OPTIONS.length);

    const flirtRow = view.options.find((o) => o.option.id === 'flirt')!;
    expect(flirtRow.available).toBe(true);
    const dateRow = view.options.find((o) => o.option.id === 'ask_date')!;
    expect(dateRow.available).toBe(false);

    // Exactly the refusal the action gives for the same move on the same state.
    const { setGameState } = makeHarness(s);
    const refusal = playConversationOption(setGameState, s, MATCH_ID, 'ask_date', 'coffee', ALWAYS);
    expect(refusal.success).toBe(false);
    expect(refusal.message).toBe(dateRow.reason);
  });

  it('returns null for a match that is not there', () => {
    expect(getSparkConversationView(stateWith(), 'ghost')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Save format — the v45 carve-out
// ─────────────────────────────────────────────────────────────────────

describe('v45 save format', () => {
  it('the version is registered and the migration is a declared no-op stub', () => {
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(45);
    expect(isMigrationVersionCovered(45)).toBe(true);

    const legacy: Record<string, unknown> = { version: 44 };
    const out = runMigrations(legacy);
    expect(out.errors).toEqual([]);
    expect((out.state as { version?: number }).version).toBe(CURRENT_STATE_VERSION);
    // A carve-out writes NOTHING — an absent key already means the baseline.
    expect(out.state).not.toHaveProperty('rapport');
  });

  it('a save carrying the new fields survives the load merge', () => {
    const saved = stateWith({ rapport: 73, conversationCooldowns: { compliment: 2_999, flirt: 3_000 } });
    saved.version = STATE_VERSION;

    // Serialize/parse first: that is what actually reaches disk.
    const parsed = JSON.parse(JSON.stringify(saved)) as Partial<GameState>;
    const merged: GameState = {
      ...initialGameState,
      ...parsed,
      stats: parsed.stats ? mergeLoadedSlice(parsed.stats, initialGameState.stats) : initialGameState.stats,
      date: parsed.date ? mergeLoadedSlice(parsed.date, initialGameState.date) : initialGameState.date,
      settings: parsed.settings
        ? mergeLoadedSlice(parsed.settings, initialGameState.settings)
        : initialGameState.settings,
      userProfile: parsed.userProfile
        ? mergeLoadedSlice(parsed.userProfile, initialGameState.userProfile)
        : initialGameState.userProfile,
    };

    const loadedMatch = merged.sparkApp!.matches[0];
    expect(loadedMatch.rapport).toBe(73);
    expect(loadedMatch.conversationCooldowns).toEqual({ compliment: 2_999, flirt: 3_000 });
    // And a match from BEFORE v45 still resolves, which is why no backfill ran.
    expect(readRapport({ ...loadedMatch, rapport: undefined })).toBe(FRESH_MATCH_RAPPORT);
  });

  it('a pre-v45 match plays normally, with no fields written until it is used', () => {
    const s = stateWith(); // no rapport, no cooldowns
    expect(matchIn(s).rapport).toBeUndefined();
    expect(matchIn(s).conversationCooldowns).toBeUndefined();

    const { setGameState, getState } = makeHarness(s);
    const r = playConversationOption(setGameState, s, MATCH_ID, 'break_ice', undefined, ALWAYS);
    expect(r.success).toBe(true);
    expect(matchIn(getState()).rapport).toBe(
      clampRapport(FRESH_MATCH_RAPPORT + findConversationOption('break_ice')!.rapportOnSuccess),
    );
    expect(matchIn(getState()).conversationCooldowns?.break_ice).toBe(3_000);
  });
});
