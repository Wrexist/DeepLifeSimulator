/**
 * The Discovery meter could only ever read 1.
 *
 * `DISCOVERABLE_SYSTEMS` catalogues 20 systems. `markSystemDiscovered` had NO
 * callers anywhere in the repo, and `updateSystemUsage` had exactly one —
 * `work.tsx`, hard-coded to `'streetJobs'`. So `discoveredSystems` could hold at
 * most ONE entry for the life of a save, while `DiscoveryIndicator` (mounted
 * full-size on the home feed after week 5) rendered "1 / 20" and
 * `calculateDepthScore` drew 40 of its 100 points from that ratio.
 *
 * A player running companies, stocks, real estate, politics and R&D who had
 * prestiged twice still saw 5% and a single-digit depth score.
 * 2026-07-30 audit GP-7.
 *
 * The fix derives discovery from observable state rather than sprinkling calls
 * across ~9 action entry points, so EXISTING saves get credit for what they have
 * already done — a per-call-site approach would leave a 2000-week veteran at
 * 1/20 until they happened to re-do each thing.
 */
import { reconcileDiscoveredSystems, DISCOVERABLE_SYSTEMS } from '@/lib/depth/discoverySystem';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const idsOf = (s: GameState) => (s.discoveredSystems || []).map((d) => d.systemId);

describe('a fresh life discovers almost nothing', () => {
  it('does not credit systems the player has not touched', () => {
    const fresh = createTestGameState({ weeksLived: 0 });
    const ids = idsOf(reconcileDiscoveredSystems(fresh));

    for (const id of ['stocks', 'realEstate', 'company', 'politics', 'prestige', 'dynasty']) {
      expect(ids).not.toContain(id);
    }
  });
});

describe('a played life is credited for what it has actually done', () => {
  const veteran = () => {
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: 2000,
      stats: { ...base.stats, fitness: 70 },
      currentJob: 'tech' as never,
      relationships: [{ id: 'r1', name: 'Ada', type: 'friend' }] as never,
      educations: [{ id: 'university', completed: true }] as never,
      bankSavings: 250_000,
      realEstate: [{ id: 'house', value: 400_000 }] as never,
      stocks: { holdings: [{ symbol: 'ACME', shares: 10, currentPrice: 50 }] } as never,
      companies: [{ id: 'tech', name: 'Acme', employees: 12 }] as never,
      prestige: { prestigeLevel: 2 } as never,
      generationNumber: 3,
      socialMedia: { ...(base.socialMedia ?? {}), followers: 90_000 } as never,
    });
  };

  it('credits far more than one system', () => {
    const ids = idsOf(reconcileDiscoveredSystems(veteran()));

    // The headline: this used to be capped at 1 no matter what the player did.
    expect(ids.length).toBeGreaterThan(6);
  });

  it('credits each system the state shows evidence of', () => {
    const ids = idsOf(reconcileDiscoveredSystems(veteran()));

    for (const id of [
      'career',
      'relationships',
      'education',
      'bank',
      'realEstate',
      'stocks',
      'company',
      'prestige',
      'dynasty',
      'socialMedia',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('credits an EXISTING save immediately, without re-doing anything', () => {
    // The reason this is derived rather than wired at call sites.
    const beforeUpdate = createTestGameState({
      weeksLived: 2000,
      realEstate: [{ id: 'house', value: 400_000 }] as never,
      companies: [{ id: 'tech', name: 'Acme', employees: 3 }] as never,
      discoveredSystems: [],
    });

    const ids = idsOf(reconcileDiscoveredSystems(beforeUpdate));
    expect(ids).toContain('realEstate');
    expect(ids).toContain('company');
  });
});

/**
 * H1 (2026-08-16 audit): the function reached through
 * `gameState as unknown as Record<string, any>` and read six names that exist
 * nowhere in `contexts/game/types.ts` — `bankAccounts`, `visitedCountries`,
 * `currentTrip` (it lives on `travel`), `rdProjects`, `research`,
 * `darkWebPurchases` — plus `pursuits` as an array (it is a Record),
 * `socialMedia.posts` (it is `totalPosts`) and `gamingStreaming.streams` (it is
 * `streamHistory`). Every one read `undefined`, so those systems were
 * undiscoverable by their own evidence. The escape hatch is gone; these pin the
 * REAL paths so a rename cannot silently re-open the hole.
 */
describe('every system is detected through its real GameState path', () => {
  const played = (over: Partial<GameState>) =>
    idsOf(reconcileDiscoveredSystems(createTestGameState({ weeksLived: 300, ...over } as Partial<GameState>)));

  it('banking: a funded account, a card, a goal or a bill rule marks `bank`', () => {
    const base = createTestGameState();
    const bank = base.banking!;
    expect(played({ banking: { ...bank, accounts: [{ ...bank.accounts[0], balance: 5_000 }] } })).toContain('bank');
    expect(played({ banking: { ...bank, creditCards: [{ id: 'c' }] as never } })).toContain('bank');
    expect(played({ banking: { ...bank, savingsGoals: [{ id: 'g' }] as never } })).toContain('bank');
    // Legacy pre-v14 saves keep working through the flat balance.
    expect(played({ bankSavings: 1 })).toContain('bank');
  });

  it('banking: the two accounts `initialGameState` SEEDS are not evidence', () => {
    // `has(banking.accounts)` would credit the bank on week 1 of every save.
    const fresh = idsOf(reconcileDiscoveredSystems(createTestGameState({ weeksLived: 0 })));
    expect(fresh).not.toContain('bank');
  });

  it('travel: a visited destination, an in-flight trip or a passport marks `travel`', () => {
    const base = createTestGameState();
    const t = base.travel!;
    expect(played({ travel: { ...t, visitedDestinations: ['tokyo'] } })).toContain('travel');
    expect(played({ travel: { ...t, currentTrip: { destinationId: 'tokyo', returnWeek: 5, startWeek: 1 } } })).toContain('travel');
    expect(played({ travel: { ...t, passportOwned: true } })).toContain('travel');
    expect(idsOf(reconcileDiscoveredSystems(createTestGameState({ weeksLived: 0 })))).not.toContain('travel');
  });

  it('rd: a company that built a lab marks `rd`', () => {
    expect(
      played({ companies: [{ id: 'acme', name: 'Acme', rdLab: { type: 'basic', builtWeek: 3, researchProjects: [], completedResearch: [] } }] as never }),
    ).toContain('rd');
    expect(played({ companies: [{ id: 'acme', name: 'Acme', patents: [{ id: 'p1' }] }] as never })).toContain('rd');
    // A company with no lab is a company, not R&D.
    expect(played({ companies: [{ id: 'acme', name: 'Acme' }] as never })).not.toContain('rd');
  });

  it('darkWeb: an OWNED dark-web item or a raised criminal level marks `darkWeb`', () => {
    const base = createTestGameState();
    expect(played({ darkWebItems: base.darkWebItems.map((i, n) => (n === 0 ? { ...i, owned: true } : i)) })).toContain('darkWeb');
    expect(played({ criminalLevel: 3 })).toContain('darkWeb');
  });

  it('darkWeb: the shipped CATALOGUE and the default criminalLevel of 1 are not evidence', () => {
    // `darkWebItems` ships in full on every save with `owned: false`, and
    // `criminalLevel` starts at 1 — the old `> 0` test credited everyone.
    const fresh = createTestGameState({ weeksLived: 0 });
    expect(fresh.darkWebItems.length).toBeGreaterThan(0);
    expect(fresh.criminalLevel).toBe(1);
    expect(idsOf(reconcileDiscoveredSystems(fresh))).not.toContain('darkWeb');
  });

  it('politics: the `politics` slice, not a career id that does not exist', () => {
    const base = createTestGameState();
    // `careers` is the 30-entry catalogue and holds no `political` entry, so the
    // old read could never fire.
    expect(base.careers.some((c) => c.id === 'political')).toBe(false);
    expect(played({ politics: { ...base.politics!, careerLevel: 2 } })).toContain('politics');
    expect(played({ politics: { ...base.politics!, electionsWon: 1 } })).toContain('politics');
    expect(idsOf(reconcileDiscoveredSystems(createTestGameState({ weeksLived: 0 })))).not.toContain('politics');
  });

  it('hobbies: `pursuits` is a Record, so it is counted by keys', () => {
    expect(played({ pursuits: { chess: { xp: 10, level: 1 } } })).toContain('hobbies');
    expect(played({ pursuits: {} })).not.toContain('hobbies');
  });

  it('socialMedia: `totalPosts` counts even before the first follower', () => {
    const base = createTestGameState();
    expect(played({ socialMedia: { ...base.socialMedia!, totalPosts: 3 } })).toContain('socialMedia');
  });

  it('gamingStreaming: `streamHistory` / subscribers / views mark it', () => {
    const base = createTestGameState();
    const g = base.gamingStreaming!;
    expect(played({ gamingStreaming: { ...g, subscribers: 5 } })).toContain('gamingStreaming');
    expect(played({ gamingStreaming: { ...g, totalViews: 900 } })).toContain('gamingStreaming');
    expect(played({ gamingStreaming: { ...g, streamHistory: [{ id: 's1' }] as never } })).toContain('gamingStreaming');
    expect(idsOf(reconcileDiscoveredSystems(createTestGameState({ weeksLived: 0 })))).not.toContain('gamingStreaming');
  });

  it('streetJobs: the typed counter', () => {
    expect(played({ streetJobsCompleted: 4 })).toContain('streetJobs');
    expect(played({ streetJobsCompleted: 0 })).not.toContain('streetJobs');
  });

  it('stocks: the modern holdings array OR the legacy `stocksOwned` map', () => {
    expect(played({ stocksOwned: { ACME: 10 } })).toContain('stocks');
  });
});

describe('it is safe to run every tick', () => {
  it('is idempotent — running twice adds nothing', () => {
    const played = createTestGameState({
      weeksLived: 100,
      realEstate: [{ id: 'house', value: 1 }] as never,
    });

    const once = reconcileDiscoveredSystems(played);
    const twice = reconcileDiscoveredSystems(once);

    expect(idsOf(twice).sort()).toEqual(idsOf(once).sort());
  });

  it('only ever ADDS — selling your last property does not un-discover it', () => {
    const owned = reconcileDiscoveredSystems(
      createTestGameState({ weeksLived: 100, realEstate: [{ id: 'h', value: 1 }] as never }),
    );
    expect(idsOf(owned)).toContain('realEstate');

    const sold = reconcileDiscoveredSystems({ ...owned, realEstate: [] });
    // Discovery means "you have seen this", not "you currently own this".
    expect(idsOf(sold)).toContain('realEstate');
  });

  it('never records a system that is not in the catalogue', () => {
    const ids = idsOf(reconcileDiscoveredSystems(createTestGameState({ weeksLived: 500 })));
    for (const id of ids) {
      expect(Object.keys(DISCOVERABLE_SYSTEMS)).toContain(id);
    }
  });

  it('survives a garbage or minimal state without throwing', () => {
    expect(() => reconcileDiscoveredSystems(createTestGameState())).not.toThrow();
    expect(() =>
      reconcileDiscoveredSystems(createTestGameState({ weeksLived: 5, discoveredSystems: undefined })),
    ).not.toThrow();
  });
});
