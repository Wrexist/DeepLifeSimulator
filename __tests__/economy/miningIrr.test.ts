/**
 * ECO-4 gate: warehouse mining is a good investment, not the best one at any size.
 *
 * The 2026-10-21 audit measured ~50%/yr IRR on a quantum ($500k) or giga
 * ($10M) rig, before ECO-3 made rigs wear out and cost real repairs, and with
 * the minted coins outside the net-worth passive soft cap. The owner's
 * decision (2026-10-22) targets ~20-25%/yr and said to re-measure first.
 *
 * This drives the REAL weekly passes (`applyMiningCryptos` +
 * `applyMiningWarehouse`) week by week for one rig: BTC is minted and sold
 * every week at a constant price, auto-repair is paid from a separate coin,
 * and the rig is sold after eight years at the game's 50% resale
 * (`sellMiner`). Halvings come every 208 weeks; when the first one lands
 * depends on when in the epoch the rig was bought, so every figure is the
 * MEAN over eight purchase phases. Prices are flat on purpose: the gate is
 * about what the hardware pays, not the tape.
 *
 * Measured on this harness (pre-tax, mean over phases, quantum at $5M):
 *   the audit's own model, no repairs ....... ~50%/yr
 *   HEAD after ECO-3 repairs, cap 2.0 ......... 18.5%/yr (3% - 31% by phase)
 *   difficulty cap 2.5 ........................ 12.9%/yr
 *   difficulty cap 3.0 ........................ ~9%/yr
 * So the cap stays at 2.0: ECO-3 had already brought the rig to the target,
 * and 3.0 would leave it below a savings account after tax.
 */
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';
import { applyMiningWarehouse, MINING_DIFFICULTY_CAP } from '@/contexts/game/actions/weekly/applyMiningWarehouse';
import { MINER_PRICES } from '@/lib/economy/constants';
import { passiveIncomeEfficiency } from '@/lib/economy/passiveIncome';
import { CAPITAL_GAINS_TAX_RATE } from '@/lib/economy/taxLedger';

const BTC_PRICE = 42_150;
const ETH_PRICE = 2_580;
const HORIZON_WEEKS = 416;
const RESALE = 0.5;
const DEGRADATION = 3.5; // the middle of the pre-rolled 2-5%/wk
const HALVING_INTERVAL = 208;
const PHASES = [26, 52, 78, 104, 130, 156, 182, 208];

const aCrypto = (id: string, owned: number, price: number) =>
  ({ id, name: id.toUpperCase(), symbol: id.toUpperCase(), owned, price, weeklyRate: 0 } as never);

type Crypto = { id: string; owned: number };

/** Weekly cash flows for one rig of `tier`, the player at `netWorthUSD`. */
function cashFlows(tier: string, netWorthUSD: number, taxed: boolean, firstHalving: number): number[] {
  const price = MINER_PRICES[tier];
  let warehouse = {
    level: 5,
    miners: { [tier]: 1 },
    minerDurability: { [tier]: 100 },
    selectedCrypto: 'btc',
    autoRepairEnabled: true,
    autoRepairCryptoId: 'eth',
    autoRepairWeeklyCost: 0.0001,
    difficultyMultiplier: 1,
    lastDifficultyUpdateAbsoluteWeek: 0,
  } as never as Parameters<typeof applyMiningWarehouse>[0]['prevWarehouse'];
  const ETH_RESERVE = 1_000_000;
  let cryptos = [aCrypto('btc', 0, BTC_PRICE), aCrypto('eth', ETH_RESERVE, ETH_PRICE)];
  const efficiency = passiveIncomeEfficiency(netWorthUSD, 0);

  const flows: number[] = [-price];
  for (let w = 1; w <= HORIZON_WEEKS; w++) {
    const halvingCount = w < firstHalving ? 0 : 1 + Math.floor((w - firstHalving) / HALVING_INTERVAL);
    const mined = applyMiningCryptos({
      prevWarehouse: warehouse,
      prevCryptos: cryptos,
      halvingCount,
      minerDegradationRoll: DEGRADATION,
      passiveEfficiency: efficiency,
    });
    warehouse = applyMiningWarehouse({
      prevWarehouse: warehouse,
      prevCryptos: cryptos,
      weeksLived: w,
      minerDegradationRoll: DEGRADATION,
    }).updatedWarehouse;
    const after = mined.updatedCryptos as unknown as Crypto[];
    const btc = after.find((c) => c.id === 'btc')!.owned;
    const eth = after.find((c) => c.id === 'eth')!.owned;
    // Zero cost basis: the whole sale is a gain.
    const sale = btc * BTC_PRICE * (taxed ? 1 - CAPITAL_GAINS_TAX_RATE : 1);
    const repair = (ETH_RESERVE - eth) * ETH_PRICE;
    let flow = sale - repair;
    if (w === HORIZON_WEEKS) flow += price * RESALE;
    flows.push(flow);
    // Sell the BTC; top the repair coin back up (its cost is the flow above).
    cryptos = [aCrypto('btc', 0, BTC_PRICE), aCrypto('eth', ETH_RESERVE, ETH_PRICE)];
  }
  return flows;
}

/** Annualised IRR of weekly flows, by bisection. */
function annualIrr(flows: number[]): number {
  const npv = (r: number) => flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
  let lo = -0.02;
  let hi = 0.1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return Math.pow(1 + (lo + hi) / 2, 52) - 1;
}

const report: Record<string, number> = {};

/** Mean annual IRR over the purchase phases. */
function irr(tier: string, netWorthUSD: number, taxed: boolean): number {
  const all = PHASES.map((fh) => annualIrr(cashFlows(tier, netWorthUSD, taxed, fh)));
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  report[`${tier}@$${netWorthUSD / 1e6}M ${taxed ? 'after-tax' : 'pre-tax'}`] = Math.round(mean * 1000) / 10;
  return mean;
}

describe('ECO-4: warehouse mining IRR', () => {
  afterAll(() => {
    // MINING_IRR_REPORT=<file> writes every IRR measured (jest swallows console).
    if (process.env.MINING_IRR_REPORT) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(process.env.MINING_IRR_REPORT, JSON.stringify(report, null, 1));
    }
  });

  it('a quantum rig below the soft cap returns at most ~25%/yr pre-tax, not ~50%', () => {
    const preTax = irr('quantum', 5_000_000, false);
    expect(preTax).toBeLessThanOrEqual(0.25);
    expect(preTax).toBeGreaterThan(0.1);
    // Minted coins carry no cost basis, so selling them pays the full 25%.
    expect(irr('quantum', 5_000_000, true)).toBeLessThan(preTax);
  });

  it('a giga rig stays in the same band, and the net-worth soft cap bites above $10M', () => {
    const at20 = irr('giga', 20_000_000, false);
    const at100 = irr('giga', 100_000_000, false);
    expect(at20).toBeLessThanOrEqual(0.25);
    expect(at100).toBeLessThan(at20 - 0.1);
  });

  it('keeps the difficulty ceiling where the measurement put it', () => {
    expect(MINING_DIFFICULTY_CAP).toBe(2.0);
  });
});
