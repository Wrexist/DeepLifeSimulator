/**
 * Winning an election recoups a campaign; it does not pay a jackpot.
 *
 * The 2026-08-25 audit found the reward ladder paying 2-3x its own campaign
 * cost at up to 95% win odds - a presidential run was +$2.75M expected on ONE
 * tap, positive-EV cash no civilian career in the game can match, for a
 * decision that is supposed to be about the office. The two tables were also
 * hand-written separately, which is how they drifted that far apart.
 */
import {
  CAMPAIGN_COSTS,
  ELECTION_VICTORY_FUND_MULTIPLIER,
  electionVictoryFund,
} from '@/contexts/game/actions/PoliticalActions';

/** The ceiling the win roll is clamped to in `runForOffice`. */
const MAX_WIN_CHANCE = 0.95;

describe('election victory fund', () => {
  it('is derived from the campaign cost, never a second table', () => {
    for (const [office, cost] of Object.entries(CAMPAIGN_COSTS)) {
      expect(electionVictoryFund(office)).toBe(
        Math.round(cost * ELECTION_VICTORY_FUND_MULTIPLIER),
      );
    }
  });

  it('roughly recoups the campaign at every rung', () => {
    for (const [office, cost] of Object.entries(CAMPAIGN_COSTS)) {
      const ratio = electionVictoryFund(office) / cost;
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(1.5);
    }
  });

  it('leaves running for office only marginally profitable, even at best odds', () => {
    // The presidency used to be +$2.75M expected. A small positive expectation
    // keeps running from being a punishment without making it the best
    // investment in the economy.
    for (const [office, cost] of Object.entries(CAMPAIGN_COSTS)) {
      const ev = MAX_WIN_CHANCE * electionVictoryFund(office) - cost;
      expect(ev).toBeLessThan(cost * 0.2);
    }
  });

  it('never pays for an office that does not exist', () => {
    expect(electionVictoryFund('emperor')).toBe(0);
  });
});
