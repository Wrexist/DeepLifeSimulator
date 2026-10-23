/**
 * Regression tests for the second social audit (2026-10-23, SOC2-*). Each
 * block names the finding it pins; each failed on the tree before its fix.
 */
import type { ChildInfo, GameState, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { raiseRelationship, recordInteraction } from '@/contexts/game/actions/ContactsActions';
import { syncChildContactAfterParenting } from '@/lib/parenting';
import { proposeMarriage } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { getEngagementRing } from '@/lib/dating/engagementRings';
import { rollNPCLifeEvent } from '@/lib/social/npcDepth';

/** Synchronous stand-in for React's setter: applies each updater in order. */
function makeSetter(state: { current: GameState }) {
  return (update: GameState | ((prev: GameState) => GameState)) => {
    state.current = typeof update === 'function' ? update(state.current) : update;
  };
}

describe('SOC2-5 - a Contacts gesture toward a child moves the Family Bond too', () => {
  function withChild(bond: number): { current: GameState } {
    const base = createTestGameState({ weeksLived: 500 });
    const childRel: Relationship = {
      id: 'kid1', name: 'Mia', type: 'child', relationshipScore: bond,
      personality: 'Curious', gender: 'female', age: 20,
    };
    const childInfo = { ...childRel, birthWeeksLived: 0 } as ChildInfo;
    base.relationships = [...base.relationships, childRel];
    base.family = { ...base.family, children: [childInfo] };
    base.stats = { ...base.stats, money: 100_000 };
    return { current: base };
  }
  const familyBond = (s: GameState) => s.family.children.find((c) => c.id === 'kid1')?.relationshipScore;
  const contactBond = (s: GameState) => s.relationships.find((r) => r.id === 'kid1')?.relationshipScore;

  it('the paid bond gesture lands on both records', () => {
    const state = withChild(60);
    const moneyBefore = state.current.stats.money;
    const r = raiseRelationship(state.current, makeSetter(state), 'kid1');
    expect(r.success).toBe(true);
    expect(state.current.stats.money).toBeLessThan(moneyBefore);
    expect(contactBond(state.current)).toBeGreaterThan(60);
    expect(familyBond(state.current)).toBe(contactBond(state.current));
  });

  it('and is NOT reverted by the next parenting action\'s sync', () => {
    const state = withChild(60);
    raiseRelationship(state.current, makeSetter(state), 'kid1');
    const paidFor = contactBond(state.current)!;
    // What a parenting action with no bond effect writes back onto Contacts.
    const child = state.current.family.children.find((c) => c.id === 'kid1')!;
    const synced = syncChildContactAfterParenting(state.current.relationships, child, 501);
    expect(synced.find((r) => r.id === 'kid1')?.relationshipScore).toBe(paidFor);
  });

  it('a call mirrors too; a non-child contact leaves the family untouched', () => {
    const state = withChild(40);
    recordInteraction(state.current, makeSetter(state), 'kid1', 'call', 0, 3);
    expect(familyBond(state.current)).toBe(contactBond(state.current));

    const familyBefore = state.current.family;
    recordInteraction(state.current, makeSetter(state), 'parent1', 'call', 0, 3);
    expect(state.current.family).toBe(familyBefore);
  });
});

describe('SOC2-6 - proposing to someone already engaged is refused up front', () => {
  it('reports the refusal instead of "said YES", and charges nothing', () => {
    // Engaged at week 0 - the age-18 first week, where a truthiness check on
    // `engagementWeek` also read the engagement as absent.
    const partner: Relationship = {
      id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 99, personality: 'kind',
      gender: 'male', age: 25, datesCount: 30, livingTogether: true,
      engagementWeek: 0, engagementRing: getEngagementRing('simple_band'),
    };
    const base = createTestGameState({ weeksLived: 0 });
    base.relationships = [...base.relationships, partner];
    base.stats = { ...base.stats, money: 100_000 };
    const state = { current: base };
    const r = proposeMarriage(state.current, makeSetter(state), 'p1', 'simple_band', { updateMoney, updateStats });
    expect(r.success).toBe(false);
    expect(r.accepted).toBe(false);
    expect(r.message).toContain('already engaged');
    expect(state.current.stats.money).toBe(100_000);
  });
});

describe('SOC2-8 - NPC work events need a job', () => {
  const WORK = ['got_promotion', 'bonus_at_work', 'work_stress', 'lost_job'];
  /** Every event the filter allows, found by sweeping the pick roll (gate always open). */
  function reachable(rel: Relationship): Set<string> {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const pick = i / 1000;
      const ev = rollNPCLifeEvent(rel, (k) => (k === 'npc-life-gate' ? 0 : pick));
      if (ev) seen.add(ev.id);
    }
    return seen;
  }
  const base: Relationship = { id: 'n', name: 'Mom', type: 'parent', relationshipScore: 60, personality: 'caring', gender: 'female', age: 50 };

  it('a parent with no job never loses one, or gets promoted at one', () => {
    const ids = reachable(base);
    for (const w of WORK) expect(ids.has(w)).toBe(false);
    expect(ids.has('found_job')).toBe(false);
  });

  it('an unemployed NPC cannot lose their job again, and can find a new one', () => {
    const ids = reachable({ ...base, job: 'Unemployed' });
    for (const w of WORK) expect(ids.has(w)).toBe(false);
    expect(ids.has('found_job')).toBe(true);
  });

  it('an employed NPC keeps the full set of work events', () => {
    const ids = reachable({ ...base, job: 'Nurse' });
    for (const w of WORK) expect(ids.has(w)).toBe(true);
    expect(ids.has('found_job')).toBe(false);
  });
});
