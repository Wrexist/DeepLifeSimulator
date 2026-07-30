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
      reconcileDiscoveredSystems({ weeksLived: 5 } as unknown as GameState),
    ).not.toThrow();
  });
});
