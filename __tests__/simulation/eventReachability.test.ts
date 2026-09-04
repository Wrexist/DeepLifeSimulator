/**
 * IS THIS GATE SATISFIABLE AT ALL? — Master Program 13, §7.
 *
 * The delivery funnel measures what twelve simulated lives actually reached:
 * 365 authored templates, 118 ever eligible, 245 never eligible. That number
 * on its own is not a finding, because it conflates two opposite things:
 *
 *   GATED   - the condition is satisfiable, this cohort just never lived that
 *             life. A food courier at week 150 is not a retired billionaire
 *             with grandchildren and a political seat. Correct behaviour.
 *   DEAD    - the condition can NEVER be true, because it reads a field
 *             nothing writes or asks for a combination the game cannot
 *             produce. Content the player has already paid for in bundle size
 *             and can never see.
 *
 * That distinction has bitten this repo for real: `scholarship_opportunity`
 * gated on `weeksInPoverty >= 12` and NOTHING ever wrote that field, so the
 * event was unreachable for its entire life until Program 12 found it (v41).
 *
 * A simulation cannot tell the two apart - it can only ever say "not in these
 * lives". So this probes the conditions DIRECTLY against a spread of archetype
 * states covering the axes the game actually varies: money, career, health,
 * family, age, fame, crime, education, politics, property, travel. A template
 * satisfied by none of them is a candidate for DEAD and is named here so the
 * next reader checks it by hand rather than re-deriving the whole list.
 *
 * This is a fast pure test (no tick), so it runs in the normal suite.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { eventTemplates } from '@/lib/events/engine';
import type { GameState } from '@/contexts/game/types';

/** A relationship dense enough to satisfy "has friends" style gates. */
function people(n: number, score: number): GameState['relationships'] {
  return Array.from({ length: n }, (_, i) => ({
    id: `probe-${i}`,
    name: `Probe ${i}`,
    type: i === 0 ? ('spouse' as const) : i === 1 ? ('parent' as const) : ('friend' as const),
    relationshipScore: score,
    personality: 'friendly',
    gender: (i % 2 === 0 ? 'female' : 'male') as 'female' | 'male',
    age: 30 + i,
    ...(i === 0 ? { marriageWeek: 200, livingTogether: true } : {}),
  }));
}

/** Children old enough that the parenting/child gates have something to read. */
function kids(n: number): GameState['family']['children'] {
  return Array.from({ length: n }, (_, i) => ({
    id: `kid-${i}`,
    name: `Kid ${i}`,
    type: 'child' as const,
    relationshipScore: 80,
    personality: 'cheerful',
    gender: (i % 2 === 0 ? 'male' : 'female') as 'male' | 'female',
    age: 6 + i * 5,
    birthWeeksLived: 300 + i * 40,
  }));
}

/**
 * Archetypes, chosen to span the axes rather than to be realistic. Each is a
 * cheap sketch: the point is to make gates TRUE, not to simulate a life.
 */
function archetypes(): Record<string, GameState> {
  const base = () => createTestGameState({});
  const A: Record<string, GameState> = {};

  A.destitute = createTestGameState({
    stats: { money: 12, health: 30, happiness: 20, energy: 25, reputation: 5 },
    weeksLived: 60, lifeStartWeek: 0, overdueBalance: 2400,
  });

  A.working = createTestGameState({
    stats: { money: 4200, health: 70, happiness: 60, energy: 70, reputation: 40 },
    weeksLived: 200, lifeStartWeek: 104, currentJob: 'retail_associate',
    relationships: people(4, 55),
  });

  // $8.5M was the first draft and reached NONE of the 45 wealth templates:
  // `wealthEvents` gates on `netWorth(state)` at 10M / 50M / 250M, so the probe
  // sat just under the lowest band. Set above the DYNASTY band so all three
  // tiers open - a threshold the screen found by reporting a whole module dark.
  A.wealthy = createTestGameState({
    stats: { money: 400_000_000, health: 80, happiness: 75, energy: 80, reputation: 85 },
    weeksLived: 900, lifeStartWeek: 104, currentJob: 'retail_associate',
    relationships: people(9, 70),
  });

  A.ill = createTestGameState({
    stats: { money: 900, health: 18, happiness: 25, energy: 15, reputation: 30 },
    weeksLived: 300, lifeStartWeek: 104, relationships: people(3, 85),
  });

  A.family = createTestGameState({
    stats: { money: 30_000, health: 70, happiness: 70, energy: 60, reputation: 50 },
    weeksLived: 700, lifeStartWeek: 104, relationships: people(6, 90),
    family: { children: kids(2) },
  });

  A.elderly = createTestGameState({
    stats: { money: 250_000, health: 45, happiness: 60, energy: 35, reputation: 60 },
    weeksLived: 2700, lifeStartWeek: 104, relationships: people(5, 75),
    family: { children: kids(3) },
  });

  A.young = createTestGameState({
    stats: { money: 300, health: 90, happiness: 80, energy: 95, reputation: 10 },
    weeksLived: 4, lifeStartWeek: 0,
  });

  A.famous = createTestGameState({
    stats: { money: 1_200_000, health: 75, happiness: 70, energy: 70, reputation: 99 },
    weeksLived: 600, lifeStartWeek: 104, relationships: people(12, 65),
  });

  A.criminal = createTestGameState({
    stats: { money: 60_000, health: 60, happiness: 45, energy: 60, reputation: 8 },
    weeksLived: 400, lifeStartWeek: 104, relationships: people(3, 40),
  });

  A.jobless = createTestGameState({
    stats: { money: 700, health: 60, happiness: 35, energy: 55, reputation: 35 },
    weeksLived: 350, lifeStartWeek: 104, currentJob: undefined,
    relationships: people(5, 80),
  });

  // ── Subsystem archetypes ─────────────────────────────────────────────────
  // The ten above span money/health/family/age. They cannot reach a template
  // gated on a SUBSYSTEM the life never opted into, and about two hundred
  // templates are: politics, fame, travel, hobbies, pets, vehicles, business,
  // education, and the ancestor content that only exists after a prestige.
  // Without these the screen reports the game's whole optional surface as
  // unreachable, which is the wrong answer loudly.
  A.politician = createTestGameState({
    stats: { money: 180_000, health: 70, happiness: 65, energy: 65, reputation: 78 },
    weeksLived: 800, lifeStartWeek: 104, relationships: people(6, 60),
    politics: { ...base().politics!, careerLevel: 3 },
  });

  A.traveller = createTestGameState({
    stats: { money: 45_000, health: 75, happiness: 80, energy: 70, reputation: 45 },
    weeksLived: 400, lifeStartWeek: 104, relationships: people(4, 60),
    travel: {
      ...base().travel!,
      currentTrip: { destinationId: 'paris', startWeek: 398, returnWeek: 402 },
    },
  });

  A.influencer = createTestGameState({
    stats: { money: 400_000, health: 70, happiness: 70, energy: 65, reputation: 92 },
    weeksLived: 500, lifeStartWeek: 104, relationships: people(10, 55),
    socialMedia: { ...base().socialMedia!, influenceLevel: 'celebrity' } as GameState['socialMedia'],
  });

  A.hobbyist = createTestGameState({
    stats: { money: 20_000, health: 75, happiness: 78, energy: 70, reputation: 40 },
    weeksLived: 450, lifeStartWeek: 104, relationships: people(4, 65),
    pursuits: {
      guitar: { level: 4, xp: 900 },
      running: { level: 3, xp: 500 },
      chess: { level: 2, xp: 260 },
      cooking: { level: 3, xp: 480 },
    } as GameState['pursuits'],
  });

  A.heir = createTestGameState({
    stats: { money: 90_000, health: 70, happiness: 65, energy: 65, reputation: 55 },
    weeksLived: 300, lifeStartWeek: 104, generationNumber: 3,
    relationships: people(5, 65),
    previousLives: base().previousLives?.length
      ? base().previousLives
      : ([
          { name: 'Ancestor One', generationNumber: 1, netWorth: 120_000 },
          { name: 'Ancestor Two', generationNumber: 2, netWorth: 340_000 },
        ] as unknown as GameState['previousLives']),
  });

  A.owner = createTestGameState({
    stats: { money: 120_000, health: 70, happiness: 70, energy: 65, reputation: 50 },
    weeksLived: 600, lifeStartWeek: 104, currentJob: 'retail_associate',
    relationships: people(5, 65),
    pets: [{ id: 'pet-1', name: 'Bean', type: 'dog', age: 3, hunger: 40, happiness: 70, health: 80 }],
    vehicles: base().vehicles?.length
      ? base().vehicles
      : ([{ id: 'car-1', name: 'Hatchback', condition: 70, purchaseWeek: 400 }] as unknown as GameState['vehicles']),
  });

  A.pristine = base();
  return A;
}

/** Evaluate one condition safely; a throwing gate is itself a finding. */
function satisfiedBy(t: (typeof eventTemplates)[number], s: GameState): boolean | 'threw' {
  try {
    return t.condition ? !!t.condition(s) : true;
  } catch {
    return 'threw';
  }
}

describe('event reachability', () => {
  const A = archetypes();
  const names = Object.keys(A);

  it('no template condition throws on any archetype', () => {
    const threw: string[] = [];
    for (const t of eventTemplates) {
      for (const n of names) {
        if (satisfiedBy(t, A[n]) === 'threw') { threw.push(`${t.id} on ${n}`); break; }
      }
    }
    // A condition that throws is worse than one that is never true: the engine
    // evaluates gates inside the weekly tick, so a throw here is a lost week.
    expect(threw).toEqual([]);
  });

  it('reports which templates no archetype can reach', () => {
    const unreached: string[] = [];
    const reachedBy = new Map<string, number>();
    for (const t of eventTemplates) {
      let hits = 0;
      for (const n of names) if (satisfiedBy(t, A[n]) === true) hits += 1;
      reachedBy.set(t.id, hits);
      if (hits === 0) unreached.push(t.id);
    }

    const weightZero = new Set(
      eventTemplates.filter((t) => typeof t.weight === 'number' && t.weight === 0).map((t) => t.id),
    );
    // Weight-0 templates are SEQUELS reached through `followUpEventId`, never
    // through the weekly pick, so their gates are allowed to be unreachable
    // from a cold state - that is how a sequel is spelled here.
    const unreachedNonSequel = unreached.filter((id) => !weightZero.has(id));

    const lines = [
      `archetypes: ${names.length} (${names.join(', ')})`,
      `templates: ${eventTemplates.length}`,
      `reached by at least one archetype: ${eventTemplates.length - unreached.length}`,
      `unreached, of which sequel-only (weight 0): ${unreached.length - unreachedNonSequel.length}`,
      `unreached and NOT sequel-only: ${unreachedNonSequel.length}`,
      unreachedNonSequel.join(', '),
    ];
    for (const l of lines) console.log(l);
    if (process.env.DUMP) {
      // Jest swallows console output from a `--silent` or backgrounded run, so
      // the numbers go to a file the caller names. Learned the hard way twice.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(
        process.env.DUMP,
        JSON.stringify({ summary: lines, unreached, unreachedNonSequel, reachedBy: [...reachedBy] }, null, 2),
      );
    }

    // A RATCHET, not a target. Seventeen sketch states cannot represent every
    // life - `secret_palindrome` needs a net worth that reads the same
    // backwards and is delivered 36 times across 50 simulated lives, so the
    // screen under-reports by construction and the funnel is the authoritative
    // reachability measure. What this number protects is the SCREEN: it went
    // 137 -> 183 -> 226 while the archetypes were being written, twice because
    // the probe was wrong rather than the game (a $8.5M "wealthy" state sat
    // under `wealthEvents`' 10M gate and reported all 45 of them dark). If it
    // falls, either an archetype drifted out of a gate it used to satisfy or a
    // real gate tightened - both worth knowing. Raise it when you earn it.
    expect(eventTemplates.length - unreached.length).toBeGreaterThanOrEqual(226);
  });
});
