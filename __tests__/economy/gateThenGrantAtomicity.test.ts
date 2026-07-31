/**
 * Three more gate-then-grant holes — the repo's most repeated bug class.
 *
 * Each checks affordability (or an "already done" flag) against the STALE outer
 * snapshot and then mutates inside the updater without re-checking, so two taps
 * inside one React batch both pass. CLAUDE.md §4.4 exists for exactly this.
 *
 * ECON-2 `startResearch` — no in-updater re-check at all, and
 * `Math.max(0, money - cost)` floored the debit instead of rejecting it. Two
 * taps ran N projects on a Basic lab whose `maxConcurrentProjects` is 1,
 * defeating the lab-tier progression gate; two projects for the SAME technology
 * made `completeResearch` roll `triggerBreakthrough` twice — two chances at a
 * PERMANENT 2x/3x company income multiplier for one purchase.
 *
 * ECON-3 `hireLobbyist` — same clamp, plus no duplicate check. The picker
 * renders every catalogue lobbyist as its own row with affordability computed
 * from the render snapshot, so with cash for exactly one retainer two taps hired
 * two, the second free and its influence permanent.
 *
 * ECON-4 `deliverBrandDealPost` — incremented `postsDelivered` without checking
 * the post had already been used, so one post satisfied a whole multi-post
 * contract and triggered the early-completion payout.
 *
 * `filePatent`, `enterCompetition`, `runForElection` and `enactPolicy` already
 * carry the correct pattern from the 2026-07-02 audit. These were left behind.
 * 2026-07-30 audit.
 */
import { startResearch } from '@/contexts/game/actions/RDActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { hireLobbyist } from '@/contexts/game/actions/PoliticalActions';
import { deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** Two calls against the SAME stale snapshot, as one React batch would. */
function batch(state: GameState, run: (set: never, state: GameState) => void, times = 2): GameState {
  let current = state;
  const set = ((u: (prev: GameState) => GameState) => {
    current = typeof u === 'function' ? u(current) : u;
  }) as never;
  for (let i = 0; i < times; i += 1) run(set, state);
  return current;
}

describe('ECON-4 — a brand-deal post can only be delivered once', () => {
  const DEAL = 'deal-1';
  const POST = 'post-1';

  function withDeal(): GameState {
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: 10,
      socialMedia: {
        ...(base.socialMedia ?? {}),
        followers: 50_000,
        activeBrandDeals: [
          {
            id: DEAL,
            brandName: 'Nova',
            payment: 20_000,
            weeklyPayment: 1_000,
            expiresAt: 30,
            postsRequired: 3,
            postsDelivered: 0,
          },
        ],
        recentPosts: [{ id: POST, content: 'hi', gameWeek: 10 }],
        brandInbox: { pending: [], declined: [], history: [] },
        notifications: [],
      } as never,
    });
  }

  const deliveredCount = (s: GameState) =>
    (s.socialMedia?.activeBrandDeals ?? []).find((d) => d.id === DEAL)?.postsDelivered;

  it('counts ONE delivery when the same post is submitted twice in a batch', () => {
    const after = batch(withDeal(), (set) => {
      deliverBrandDealPost(set, DEAL, POST);
    });

    expect(deliveredCount(after)).toBe(1);
  });

  it('does not complete a 3-post contract from a single post', () => {
    const after = batch(withDeal(), (set) => {
      deliverBrandDealPost(set, DEAL, POST);
    }, 3);

    // Still active — early completion pays every remaining installment at once.
    expect((after.socialMedia?.activeBrandDeals ?? []).some((d) => d.id === DEAL)).toBe(true);
    expect(deliveredCount(after)).toBe(1);
  });

  it('tells the player why the second attempt did nothing', () => {
    let current = withDeal();
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;

    expect(deliverBrandDealPost(set, DEAL, POST).success).toBe(true);
    const second = deliverBrandDealPost(set, DEAL, POST);

    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already/i);
  });
});

describe('ECON-3 — a lobbyist cannot be hired twice, or for free', () => {
  function player(money: number): GameState {
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: 200,
      stats: { ...base.stats, money },
      politics: { ...(base.politics ?? {}), careerLevel: 3, lobbyists: [] } as never,
    });
  }

  const lobbyists = (s: GameState) => s.politics?.lobbyists ?? [];

  it('charges once when two taps read the same stale snapshot', () => {
    const before = player(10_000_000);
    const results: { success: boolean }[] = [];
    const after = batch(before, (set, snapshot) => {
      results.push(hireLobbyist(snapshot, set, 'corporate_lobbyist', { updateMoney }));
    });

    expect(lobbyists(after)).toHaveLength(1);
    expect(after.stats.money).toBeLessThan(before.stats.money);
    // The REJECTED call must say so. Asserting only on final state let a
    // hardcoded `{ success: true }` slip through — the caller was told the
    // lobbyist was hired when the guard had bailed.
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  it('does not grant influence for a duplicate hire', () => {
    const before = player(10_000_000);
    const once = batch(before, (set, snapshot) => {
      hireLobbyist(snapshot, set, 'corporate_lobbyist', { updateMoney });
    }, 1);
    const twice = batch(before, (set, snapshot) => {
      hireLobbyist(snapshot, set, 'corporate_lobbyist', { updateMoney });
    }, 2);

    expect(twice.politics?.policyInfluence).toBe(once.politics?.policyInfluence);
  });

  it('REFUSES rather than flooring the debit when the money is not there', () => {
    const before = player(1);
    const after = batch(before, (set, snapshot) => {
      hireLobbyist(snapshot, set, 'corporate_lobbyist', { updateMoney });
    }, 1);

    expect(lobbyists(after)).toHaveLength(0);
    expect(after.stats.money).toBe(before.stats.money);
  });
});

describe('ECON-2 — research respects the lab cap and charges once', () => {
  /** A real catalogue technology with no prerequisites. */
  const TECH = 'automation_lvl1';

  function owner(money: number): GameState {
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: 200,
      stats: { ...base.stats, money },
      companies: [
        {
          id: 'c1',
          name: 'Acme',
          type: 'factory',
          employees: 10,
          unlockedTechnologies: [],
          rdLab: { type: 'basic', researchProjects: [] },
        },
      ] as never,
    });
  }

  const projects = (s: GameState) =>
    (s.companies ?? []).find((c) => c.id === 'c1')?.rdLab?.researchProjects ?? [];

  it('actually starts research on a single tap (guards the assertions below)', () => {
    // Without this, every "<= 1" assertion below would pass vacuously if
    // startResearch rejected for some unrelated reason.
    const after = batch(owner(100_000_000), (set, snapshot) => {
      startResearch(snapshot, set, 'c1', TECH, { updateMoney });
    }, 1);

    expect(projects(after)).toHaveLength(1);
  });

  it('does not exceed the lab concurrency cap from one React batch', () => {
    const results: { success: boolean }[] = [];
    const after = batch(owner(100_000_000), (set, snapshot) => {
      results.push(startResearch(snapshot, set, 'c1', TECH, { updateMoney }));
    });

    // A Basic lab handles ONE concurrent project. Two taps used to make two.
    expect(projects(after).length).toBeLessThanOrEqual(1);
    // ...and the second call reports the refusal rather than claiming success.
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  it('never starts the same technology twice', () => {
    const after = batch(owner(100_000_000), (set, snapshot) => {
      startResearch(snapshot, set, 'c1', TECH, { updateMoney });
    }, 3);

    const ids = projects(after).map((p: { technologyId: string }) => p.technologyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('REFUSES rather than flooring the debit when the money is not there', () => {
    const before = owner(1);
    const after = batch(before, (set, snapshot) => {
      startResearch(snapshot, set, 'c1', TECH, { updateMoney });
    }, 1);

    expect(projects(after)).toHaveLength(0);
    expect(after.stats.money).toBe(before.stats.money);
  });
});
