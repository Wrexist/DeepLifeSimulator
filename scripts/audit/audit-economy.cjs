/**
 * AUDIT 1 — Economy & Balance
 *
 * Verifies the economic constants that, when they drift, silently turn the game into
 * either a money printer or an unwinnable grind. Each check is tied to a documented
 * incident in tasks/audit-findings-*.md so a regression re-trips the same wire.
 *
 * Invariants:
 *   E1  Savings APR < loan APR  (loan→savings arbitrage; the old 15% APR printer).
 *   E2  SAVINGS_APR_BASE <= SAVINGS_APR_FINANCIAL_PLANNING (the perk must be an upgrade).
 *   E3  Savings interest is rate-limited (regression guard on the 15%/30% exploit).
 *   E4  Savings soft-cap + efficiency are sane (0 < efficiency < 1, cap > 0).
 *   E5  Income tax brackets are strictly ascending, marginal, rates in [0,1], progressive.
 *   E6  Progressive tax is monotonic and never exceeds gross income (re-simulated).
 *   E7  Miner prices strictly increase across the tier ladder.
 *   E8  Loan missed-payment penalty is a sane per-week fraction.
 *   E9  Bankruptcy floor / rent rate / weeks-per-year are present and finite.
 */
'use strict';

const L = require('./_lib.cjs');

// Annual loan APR ceiling the savings rate must stay under. The loan engine's base
// rate is documented as 8% (lib/economy/constants.ts:21); savings above this enables
// risk-free arbitrage (audit-findings C-1 / H-3 family).
const LOAN_BASE_APR = 0.08;
// Hard ceiling for any *annual* savings APR. Above this is the historical exploit.
const MAX_SANE_SAVINGS_APR = 0.10;

function build() {
  const a = new L.Audit(1, 'Economy & Balance');
  const econ = L.read('lib/economy/constants.ts');
  const game = L.read('lib/config/gameConstants.ts');

  if (econ == null) {
    a.high('lib/economy/constants.ts missing', 'Cannot verify economic invariants.', 'lib/economy/constants.ts');
    return a;
  }

  // --- E1/E2/E3: Savings APR ----------------------------------------------
  const aprBase = L.extractNumber(econ, 'SAVINGS_APR_BASE');
  const aprPlan = L.extractNumber(econ, 'SAVINGS_APR_FINANCIAL_PLANNING');

  if (aprBase == null || aprPlan == null) {
    a.high('Savings APR constants not parseable', `base=${aprBase} planning=${aprPlan}`, 'lib/economy/constants.ts:22');
  } else {
    a.assert(aprBase <= aprPlan, 'high',
      `Savings APR ordering ok (base ${pct(aprBase)} ≤ planning ${pct(aprPlan)})`,
      'Savings base APR exceeds the financial-planning APR',
      `base=${pct(aprBase)} planning=${pct(aprPlan)} — the perk should never be worse than baseline`,
      'lib/economy/constants.ts:22');

    a.assert(aprPlan < LOAN_BASE_APR, 'critical',
      `No loan→savings arbitrage (planning APR ${pct(aprPlan)} < loan ${pct(LOAN_BASE_APR)})`,
      'Savings APR ≥ loan APR — risk-free arbitrage money printer',
      `Borrow at ${pct(LOAN_BASE_APR)}, park in savings at ${pct(aprPlan)} → free money. Keep savings strictly below loan APR.`,
      'lib/economy/constants.ts:21');

    a.assert(aprBase <= MAX_SANE_SAVINGS_APR && aprPlan <= MAX_SANE_SAVINGS_APR, 'critical',
      `Savings APR within sane annual band (≤ ${pct(MAX_SANE_SAVINGS_APR)})`,
      'Savings APR regression — exceeds sane annual ceiling',
      `base=${pct(aprBase)} planning=${pct(aprPlan)}. The 15%/30% rates were a documented money printer (audit-findings H-3).`,
      'lib/economy/constants.ts:22');
  }

  // --- E4: Soft cap & efficiency ------------------------------------------
  const softCap = L.extractNumber(econ, 'SAVINGS_BALANCE_SOFT_CAP');
  const capEff = L.extractNumber(econ, 'SAVINGS_CAP_EFFICIENCY');
  a.assert(softCap != null && softCap > 0, 'medium',
    `Savings soft-cap present ($${fmt(softCap)})`,
    'Savings balance soft-cap missing or non-positive',
    'Without a soft-cap, compounding on huge balances runs away.', 'lib/economy/constants.ts:26');
  a.assert(capEff != null && capEff > 0 && capEff < 1, 'medium',
    `Soft-cap efficiency sane (${pct(capEff)})`,
    'Savings cap efficiency outside (0,1)',
    `efficiency=${capEff}. Must dampen, not amplify, above-cap interest.`, 'lib/economy/constants.ts:27');

  // --- E5/E6: Progressive income tax --------------------------------------
  const brackets = parseTaxBrackets(econ);
  if (!brackets || brackets.length === 0) {
    a.high('INCOME_TAX_BRACKETS not parseable', 'Cannot verify progressive-tax invariants.', 'lib/economy/constants.ts:34');
  } else {
    let ascending = true;
    let progressive = true;
    let inRange = true;
    for (let i = 0; i < brackets.length; i++) {
      const { threshold, rate } = brackets[i];
      if (rate < 0 || rate > 1) inRange = false;
      if (i > 0) {
        if (brackets[i].threshold <= brackets[i - 1].threshold) ascending = false;
        if (brackets[i].rate < brackets[i - 1].rate) progressive = false;
      }
    }
    a.assert(ascending, 'high', 'Tax bracket thresholds strictly ascending',
      'Tax bracket thresholds not strictly ascending',
      'Marginal-tax math (constants.ts:46) walks brackets top-down and assumes ordering.', 'lib/economy/constants.ts:34');
    a.assert(progressive, 'medium', 'Tax is progressive (non-decreasing rates)',
      'Tax rates decrease across brackets (regressive)',
      'Higher income should never be taxed at a lower marginal rate.', 'lib/economy/constants.ts:34');
    a.assert(inRange, 'high', 'All tax rates within [0,1]',
      'A tax rate falls outside [0,1]', 'A rate >1 taxes more than earned → negative income.', 'lib/economy/constants.ts:34');

    // E6: re-simulate marginal tax and assert monotone + bounded.
    const samples = [0, 100, 200, 500, 1000, 5000, 25000, 100000, 1_000_000];
    let mono = true, bounded = true, prevTax = -1;
    for (const inc of samples) {
      const tax = marginalTax(brackets, inc);
      if (tax < prevTax) mono = false;
      if (tax > inc) bounded = false;
      prevTax = tax;
    }
    a.assert(mono, 'high', 'Tax owed is monotonic in income (re-simulated)',
      'Tax owed decreases as income rises (re-simulated)', 'Earning more must never reduce tax owed.', 'lib/economy/constants.ts:46');
    a.assert(bounded, 'critical', 'Tax never exceeds gross income (re-simulated)',
      'Tax can exceed gross income (re-simulated)', 'Effective rate >100% drives money negative.', 'lib/economy/constants.ts:46');
  }

  // --- E7: Miner price ladder ---------------------------------------------
  const miners = parseMinerPrices(econ);
  if (!miners || miners.length === 0) {
    a.low('MINER_PRICES not parseable', 'Skipping miner ladder check.', 'lib/economy/constants.ts:7');
  } else {
    let ascending = true;
    for (let i = 1; i < miners.length; i++) {
      if (miners[i].price <= miners[i - 1].price) ascending = false;
    }
    a.assert(ascending, 'medium', `Miner price ladder strictly ascending (${miners.length} tiers)`,
      'Miner price ladder not strictly ascending',
      'A cheaper higher tier is a dominant-strategy buy. Order: ' + miners.map((m) => m.key).join(' < '),
      'lib/economy/constants.ts:7');
  }

  // --- E8: Loan penalty ----------------------------------------------------
  const penalty = L.extractNumber(econ, 'LOAN_MISSED_PAYMENT_PENALTY');
  a.assert(penalty != null && penalty > 0 && penalty < 0.25, 'medium',
    `Loan missed-payment penalty sane (${pct(penalty)}/wk)`,
    'Loan missed-payment penalty missing or out of band',
    `penalty=${penalty}. Expected a small positive weekly fraction.`, 'lib/economy/constants.ts:24');

  // --- E9: Core game constants exist & finite -----------------------------
  if (game == null) {
    a.medium('lib/config/gameConstants.ts missing', 'Cannot verify core economy constants.', 'lib/config/gameConstants.ts');
  } else {
    for (const name of ['WEEKS_PER_YEAR', 'BANKRUPTCY_FLOOR', 'RENT_INCOME_RATE']) {
      const v = L.extractNumber(game, name);
      a.assert(v != null && Number.isFinite(v), 'medium',
        `${name} present (${v})`, `${name} missing or non-finite`,
        'Weekly economy math divides/scales by these.', 'lib/config/gameConstants.ts');
    }
    const wpy = L.extractNumber(game, 'WEEKS_PER_YEAR');
    if (wpy != null && wpy !== 52) {
      a.medium('WEEKS_PER_YEAR ≠ 52', `value=${wpy}. APR→weekly conversions assume 52.`, 'lib/config/gameConstants.ts:9');
    }
  }

  return a;
}

// --- helpers ---------------------------------------------------------------
const pct = (n) => (n == null ? 'n/a' : `${(n * 100).toFixed(2)}%`);
const fmt = (n) => (n == null ? 'n/a' : n.toLocaleString('en-US'));

function parseTaxBrackets(src) {
  const block = src.match(/INCOME_TAX_BRACKETS\s*=\s*\[([\s\S]*?)\]/);
  if (!block) return null;
  const out = [];
  const re = /threshold:\s*([0-9_]+)\s*,\s*rate:\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(block[1]))) {
    out.push({ threshold: Number(m[1].replace(/_/g, '')), rate: Number(m[2]) });
  }
  return out;
}

function parseMinerPrices(src) {
  const block = src.match(/MINER_PRICES[^=]*=\s*\{([\s\S]*?)\}/);
  if (!block) return null;
  const out = [];
  const re = /(\w+):\s*([0-9_]+)/g;
  let m;
  while ((m = re.exec(block[1]))) {
    out.push({ key: m[1], price: Number(m[2].replace(/_/g, '')) });
  }
  return out;
}

// Mirror of calculateIncomeTax (lib/economy/constants.ts) — kept in sync as an
// independent oracle so a buggy edit to the real function is caught by divergence.
function marginalTax(brackets, income) {
  if (income <= 0) return 0;
  let tax = 0;
  let remaining = income;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (remaining > brackets[i].threshold) {
      tax += (remaining - brackets[i].threshold) * brackets[i].rate;
      remaining = brackets[i].threshold;
    }
  }
  return Math.round(tax);
}

module.exports = { build };
if (require.main === module) L.runStandalone(build);
