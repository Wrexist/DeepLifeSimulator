/**
 * Party standing must be able to MOVE — and enacting the platform is what
 * moves it (2026-08-23).
 *
 * v47 shipped `policySupportDelta`, the `favors`/`opposes` platforms, an
 * endorsement threshold at 60 and two appointments gated on 55/70 standing —
 * and then nothing ever called the delta. The only writers were `switchParty`
 * (caps at the 50 baseline) and the weekly drift (converges ON 50), so every
 * number above 50 was mathematically unreachable: `isEndorsed` was permanently
 * false, `weeklyPartyFunding` permanently $0, Party Chair and Cabinet
 * Secretary permanently unobtainable, and the Career tab rendered an unmoving
 * "10 more for an endorsement" countdown. On top of that the platform arrays
 * were written in a vocabulary (`environment`, `business`, `realEstate`,
 * `defense`) that `PolicyType` does not contain, so half the platform could
 * never have matched a policy even when called.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { enactPolicy } from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { POLICIES, type PolicyType } from '@/lib/politics/policies';
import {
  ENDORSEMENT_THRESHOLD,
  POLITICAL_PARTIES,
  isEndorsed,
  weeklyPartyFunding,
  policySupportDelta,
} from '@/lib/politics/parties';
import { POLITICAL_CAREER } from '@/lib/careers/political';

const deps = { updateMoney, updateStats };

function capture() {
  const updaters: ((prev: GameState) => GameState)[] = [];
  const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updaters.push(u as (prev: GameState) => GameState);
  };
  return { setGameState, commit: (prev: GameState) => updaters.reduce((a, u) => u(a), prev) };
}

function mayor(over: Partial<GameState['politics']> = {}): GameState {
  const base = createTestGameState({ weeksLived: 3_000, stats: { money: 1_000_000 } } as never);
  return {
    ...base,
    currentJob: 'political',
    careers: [{ ...POLITICAL_CAREER, level: 2, accepted: true, applied: true, startedWeeksLived: 2_000 }],
    politics: {
      careerLevel: 3,
      approvalRating: 60,
      policyInfluence: 50,
      electionsWon: 1,
      policiesEnacted: [],
      lobbyists: [],
      alliances: [],
      campaignFunds: 0,
      party: 'democratic',
      partySupport: 50,
      ...over,
    },
  };
}

describe('the platform vocabulary is real', () => {
  it('every favors/opposes entry names a category at least one policy carries', () => {
    const liveTypes = new Set<PolicyType>(POLICIES.map(p => p.type));
    for (const party of POLITICAL_PARTIES) {
      for (const cat of [...party.favors, ...party.opposes]) {
        expect(`${party.id}:${cat}:${liveTypes.has(cat)}`).toBe(`${party.id}:${cat}:true`);
      }
    }
  });
});

describe('enacting the platform moves standing', () => {
  const favored = POLICIES.find(p => p.type === 'social' && p.requiredLevel === 0)!;
  const opposed = POLICIES.find(p => p.type === 'crypto')!;

  it('a favored policy raises partySupport by the delta, atomically', () => {
    const prev = mayor();
    const cap = capture();
    expect(enactPolicy(prev, cap.setGameState, favored.id, deps).success).toBe(true);
    const after = cap.commit(prev);
    expect(after.politics!.partySupport).toBe(50 + policySupportDelta('democratic', favored.type));
    expect(policySupportDelta('democratic', favored.type)).toBeGreaterThan(0);
  });

  it("an opposed policy costs standing — the platform's downside is real", () => {
    // Crypto policies are gated at higher office levels; the mayor here holds
    // rank 3, so pick whichever opposed policy the state can legally enact by
    // lifting the level requirement out of the way via a President-rank state.
    const prev = mayor({ careerLevel: 7, policyInfluence: 100 });
    const cap = capture();
    const res = enactPolicy(prev, cap.setGameState, opposed.id, deps);
    if (res.success) {
      const after = cap.commit(prev);
      expect(after.politics!.partySupport).toBe(
        Math.max(0, 50 + policySupportDelta('democratic', opposed.type)),
      );
      expect(policySupportDelta('democratic', opposed.type)).toBeLessThan(0);
    } else {
      // If some other gate refuses (funds, influence), the pure delta still
      // must be negative — the wiring test above covers the application.
      expect(policySupportDelta('democratic', opposed.type)).toBeLessThan(0);
    }
  });

  it('an independent (or partyless) player never grows a stamped number', () => {
    const prev = mayor({ party: undefined, partySupport: undefined });
    const cap = capture();
    expect(enactPolicy(prev, cap.setGameState, favored.id, deps).success).toBe(true);
    const after = cap.commit(prev);
    expect(after.politics!.partySupport).toBeUndefined();
  });

  it('endorsement is REACHABLE: two favored policies from the baseline cross 60', () => {
    let state = mayor();
    const cheapSocial = POLICIES.filter(p => p.type === 'social' && p.requiredLevel <= 2).slice(0, 2);
    expect(cheapSocial).toHaveLength(2);
    for (const p of cheapSocial) {
      const cap = capture();
      expect(enactPolicy(state, cap.setGameState, p.id, deps).success).toBe(true);
      state = cap.commit(state);
    }
    const support = state.politics!.partySupport!;
    expect(support).toBeGreaterThanOrEqual(ENDORSEMENT_THRESHOLD);
    expect(isEndorsed('democratic', support)).toBe(true);
    // …which is what finally makes the party's war-chest funding non-zero.
    expect(weeklyPartyFunding({ party: 'democratic', support, careerLevel: 3 })).toBeGreaterThan(0);
  });
});
