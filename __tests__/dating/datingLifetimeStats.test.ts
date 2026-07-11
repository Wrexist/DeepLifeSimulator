/**
 * DatingActions → Spark lifetime stats.
 *
 * The five relationship-milestone counters live on sparkApp.lifetimeStats but
 * fire from DatingActions (reached from Contacts/Family). These tests assert the
 * counters actually accrue now (previously they were only ever initialized).
 */
import {
  goOnDate,
  giveGift,
  proposeMarriage,
  executeWedding,
  fileDivorce,
} from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, Relationship, WeddingPlan } from '@/contexts/game/types';

const DEPS = { updateMoney, updateStats };

function harness(initial: GameState) {
  let current = initial;
  const setGameState = (updater: any) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  };
  return { setGameState, getState: () => current };
}

function stateWithPartner(partner: Partial<Relationship>, overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState({ weeksLived: 1, ...overrides });
  s.sparkApp = JSON.parse(JSON.stringify(s.sparkApp));
  s.stats = { ...s.stats, money: 50000, energy: 100 };
  s.relationships = [
    { id: 'p1', name: 'Alex', type: 'partner', relationshipScore: 70, datesCount: 5, ...partner } as Relationship,
  ];
  return s;
}

describe('DatingActions increment Spark lifetime stats', () => {
  it('goOnDate bumps totalDatesGoneOn', () => {
    const state = stateWithPartner({});
    const before = state.sparkApp!.lifetimeStats.totalDatesGoneOn;
    const { setGameState, getState } = harness(state);
    const r = goOnDate(getState(), setGameState, 'p1', 'coffee', DEPS);
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.lifetimeStats.totalDatesGoneOn).toBe(before + 1);
  });

  it('giveGift bumps totalGiftsGiven', () => {
    const state = stateWithPartner({});
    const before = state.sparkApp!.lifetimeStats.totalGiftsGiven;
    const { setGameState, getState } = harness(state);
    const r = giveGift(getState(), setGameState, 'p1', 'flowers', DEPS);
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.lifetimeStats.totalGiftsGiven).toBe(before + 1);
  });

  it('proposeMarriage bumps totalProposals (accepted or declined)', () => {
    const state = stateWithPartner({ relationshipScore: 75, datesCount: 10 });
    const before = state.sparkApp!.lifetimeStats.totalProposals;
    const { setGameState, getState } = harness(state);
    const r = proposeMarriage(getState(), setGameState, 'p1', 'simple_band', DEPS);
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.lifetimeStats.totalProposals).toBe(before + 1);
  });

  it('executeWedding bumps totalMarriages', () => {
    const plan: WeddingPlan = {
      venueId: 'courthouse',
      venueName: 'City Courthouse',
      venueType: 'courthouse',
      partnerId: 'p1',
      guestCount: 10,
      scheduledWeek: 0,
      budget: 1000,
      catering: false,
      photography: false,
      music: false,
      decorations: false,
    };
    const state = stateWithPartner({ engagementWeek: 0, weddingPlanned: plan });
    const before = state.sparkApp!.lifetimeStats.totalMarriages;
    const { setGameState, getState } = harness(state);
    const r = executeWedding(getState(), setGameState, 'p1', DEPS);
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.lifetimeStats.totalMarriages).toBe(before + 1);
  });

  it('fileDivorce bumps totalDivorces', () => {
    const state = stateWithPartner({ type: 'spouse', marriageWeek: 0 });
    state.lastDivorceWeek = 0;
    const before = state.sparkApp!.lifetimeStats.totalDivorces;
    const { setGameState, getState } = harness(state);
    const r = fileDivorce(getState(), setGameState, 'p1', DEPS);
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.lifetimeStats.totalDivorces).toBe(before + 1);
  });
});
