import { getNextChainEvent } from '../engine';
import { GameState } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

/**
 * Regression tests for the multi-week event-chain branching bug.
 *
 * The chains (health_scare / business_opportunity / family_crisis) branch on
 * `s.eventLog.some(e => e.id === X && e.choiceId === Y)`. Before the fix the
 * eventLog resolver never persisted `choiceId`, so every comparison was
 * `undefined` and each chain always fell through to its "ignored/failed"
 * branch — most damagingly the business chain lost the player's stake and made
 * the 3x payout stage unreachable.
 *
 * These tests write eventLog entries the same way the resolver now does
 * (`{ id, choiceId, ... }`) and assert the follow-up chain stage picks the
 * SUCCESS branch, plus the failure branch when the other choice was made.
 */

/** Mirrors the resolver's eventLog entry shape (post-fix). */
function logEntry(id: string, choiceId: string) {
  return {
    id,
    description: '',
    choice: '',
    choiceId,
    week: 1,
    year: 2025,
    weeksLived: 1,
  };
}

function stateWithLog(chainId: string, currentStage: number, log: any[]): GameState {
  return createTestGameState({
    eventLog: log,
    activeEventChain: {
      chainId,
      eventId: `${chainId}_stage${currentStage}`,
      currentStage,
      totalStages: 4,
    },
  });
}

describe('event chain branching (choiceId regression)', () => {
  describe('business_opportunity payout', () => {
    it('reaches the 3x payout stage when the player invested', () => {
      // Player listened (stage 0) and went all in (stage 1). Advance to results (stage 3).
      const state = stateWithLog('business_opportunity', 2, [
        logEntry('biz_meet_investor', 'listen'),
        logEntry('biz_pitch', 'invest_big'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.id).toBe('biz_results');
      // SUCCESS branch: description reports the payoff, not the "pang of regret".
      expect(next?.description).toContain('paid off');
      const collect = next?.choices[0];
      expect(collect?.id).toBe('celebrate');
      // $2,000 all-in returns 3x = $6,000 (positive money effect, stake recovered + profit).
      expect(collect?.effects.money).toBe(6000);
    });

    it('gives the smaller triple return for the half investment', () => {
      const state = stateWithLog('business_opportunity', 2, [
        logEntry('biz_meet_investor', 'listen'),
        logEntry('biz_pitch', 'invest_small'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.description).toContain('paid off');
      expect(next?.choices[0].effects.money).toBe(3000);
    });

    it('takes the regret/failure branch when the player passed', () => {
      const state = stateWithLog('business_opportunity', 2, [
        logEntry('biz_meet_investor', 'listen'),
        logEntry('biz_pitch', 'pass'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.id).toBe('biz_results');
      expect(next?.description).toContain('regret');
      expect(next?.choices[0].id).toBe('accept');
      expect(next?.choices[0].effects.stats?.happiness).toBe(-10);
    });
  });

  describe('health_scare diagnosis', () => {
    it('routes to the early-catch (doctor) branch when the player saw a doctor', () => {
      // Saw doctor at stage 0; advance to diagnosis (stage 1).
      const state = stateWithLog('health_scare', 0, [
        logEntry('health_scare_symptoms', 'see_doctor'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.id).toBe('health_scare_diagnosis');
      expect(next?.description).toContain('caught it before it got serious');
      const treatment = next?.choices.find(c => c.id === 'treatment');
      // Cheaper doctor-path treatment ($500) that improves health, not the $1,500 ER path.
      expect(treatment?.text).toContain('$500');
      expect(treatment?.effects.money).toBe(-500);
      expect(treatment?.effects.stats?.health).toBe(5);
    });

    it('routes to the inferior ER branch when the player ignored symptoms', () => {
      const state = stateWithLog('health_scare', 0, [
        logEntry('health_scare_symptoms', 'ignore'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.description).toContain('ER');
      const treatment = next?.choices.find(c => c.id === 'treatment');
      expect(treatment?.effects.money).toBe(-1500);
      expect(treatment?.effects.stats?.health).toBe(-5);
    });
  });

  describe('family_crisis deepen', () => {
    it('offers the supportive continuation when the player helped', () => {
      const state = stateWithLog('family_crisis', 0, [
        logEntry('family_crisis_call', 'help_money'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.id).toBe('family_crisis_deepen');
      expect(next?.description).toContain('made a real difference');
      expect(next?.choices.some(c => c.id === 'continue_help')).toBe(true);
    });

    it('takes the guilt branch when the player could not help', () => {
      const state = stateWithLog('family_crisis', 0, [
        logEntry('family_crisis_call', 'cant_help'),
      ]);
      const next = getNextChainEvent(state);
      expect(next?.description).toContain('Guilt');
      expect(next?.choices.some(c => c.id === 'reach_out')).toBe(true);
    });
  });
});
