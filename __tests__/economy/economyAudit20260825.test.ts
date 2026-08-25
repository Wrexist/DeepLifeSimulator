/**
 * 2026-08-25 economy audit — cross-domain regression pins.
 *
 * 1. campaign() no longer banks the player's spend into `campaignFunds`.
 *    That pot is the party machine's money and is what the embezzlement skim
 *    (25%/wk) draws from; banking the player's own campaign spend there made
 *    every deposit ~100% recoverable as a geometric series of skims, so
 *    approval 50→100 cost ~$0 net (flagged 2026-08-23, closed here).
 *
 * 2. The stock market walk is salted per life (lineageId:generationNumber).
 *    Unsalted, every save/life/heir replayed ONE universal price tape, so a
 *    repeat player had perfect market foresight in every new life.
 *
 * 3. `educationAnyOf` — computer_science now genuinely opens the software
 *    career and law_school the lawyer career (both were trap purchases that
 *    gated nothing), without touching the existing routes.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { campaign } from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import {
  getStockPricesSnapshot,
  resetStockPrices,
  simulateWeek,
} from '@/lib/economy/stockMarket';
import { checkCareerRequirements } from '@/lib/careers/careerRequirements';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import type { GameState } from '@/contexts/game/types';

/** Minimal functional-setState harness over a mutable state box. */
function harness(initial: GameState) {
  const box = { state: initial };
  const setGameState = (updater: GameState | ((prev: GameState) => GameState)) => {
    box.state = typeof updater === 'function' ? (updater as (p: GameState) => GameState)(box.state) : updater;
  };
  return { box, setGameState };
}

describe('campaign() approval-refund loop is closed', () => {
  it('spends the money and raises approval WITHOUT banking into campaignFunds', () => {
    const state = createTestGameState({});
    state.stats.money = 50_000;
    state.politics = {
      careerLevel: 1,
      approvalRating: 50,
      policyInfluence: 0,
      electionsWon: 0,
      policiesEnacted: [],
      lobbyists: [],
      alliances: [],
      campaignFunds: 1_000, // pre-existing party money stays untouched
    } as GameState['politics'];

    const { box, setGameState } = harness(state);
    const r = campaign(box.state, setGameState as never, 5_000, { updateMoney });

    expect(r.success).toBe(true);
    expect(box.state.stats.money).toBe(45_000); // charged
    expect(box.state.politics?.approvalRating).toBe(51); // +1 per $5k
    // THE pin: the spend must NOT be recoverable via the embezzlement skim.
    expect(box.state.politics?.campaignFunds).toBe(1_000);
  });
});

describe('stock walk is salted per life', () => {
  beforeEach(() => resetStockPrices());
  afterAll(() => resetStockPrices());

  const runYear = (salt?: string) => {
    for (let week = 1; week <= 52; week++) simulateWeek(undefined, week, salt);
    return getStockPricesSnapshot();
  };

  it('two lives walk different tapes; the same life reproduces exactly', () => {
    const lifeA1 = runYear('lineage-1:1');
    resetStockPrices();
    const lifeB = runYear('lineage-1:2');
    resetStockPrices();
    const lifeA2 = runYear('lineage-1:1');

    // Same salt → bit-identical (save-scum / StrictMode determinism intact).
    expect(lifeA2).toEqual(lifeA1);
    // Different generation → a different market. (Not a single-symbol fluke:
    // require a substantial share of the board to diverge.)
    const symbols = Object.keys(lifeA1);
    const diverged = symbols.filter(s => lifeA1[s].price !== lifeB[s].price);
    expect(diverged.length).toBeGreaterThan(symbols.length / 2);
  });

  it('an unsalted call (legacy tests/tools) still runs and reproduces', () => {
    const a = runYear(undefined);
    resetStockPrices();
    const b = runYear(undefined);
    expect(b).toEqual(a);
  });
});

describe('educationAnyOf routes', () => {
  const software = INITIAL_CAREERS.find(c => c.id === 'software')!;
  const lawyer = INITIAL_CAREERS.find(c => c.id === 'lawyer')!;

  const stateWith = (educationIds: string[], itemIds: string[] = []) => {
    const s = createTestGameState({});
    s.educations = educationIds.map(id => ({
      id, name: id, description: '', cost: 1, duration: 1, completed: true,
    }));
    s.items = itemIds.map(id => ({ id, name: id, price: 0, owned: true })) as GameState['items'];
    return s;
  };

  it('computer_science alone satisfies the software education gate', () => {
    const check = checkCareerRequirements(software.requirements, stateWith(['computer_science'], ['computer']));
    expect(check.missingEducation).toEqual([]);
    expect(check.met).toBe(true);
  });

  it('the masters route still works for software', () => {
    const check = checkCareerRequirements(software.requirements, stateWith(['masters_degree'], ['computer']));
    expect(check.met).toBe(true);
  });

  it('law_school alone satisfies the lawyer education gate', () => {
    const check = checkCareerRequirements(lawyer.requirements, stateWith(['law_school'], ['suit']));
    expect(check.missingEducation).toEqual([]);
    expect(check.met).toBe(true);
  });

  it('no route completed → still gated', () => {
    const check = checkCareerRequirements(software.requirements, stateWith([], ['computer']));
    expect(check.met).toBe(false);
    expect(check.missingEducation).toContain('masters_degree');
  });
});
