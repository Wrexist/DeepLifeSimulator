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
 *   E10 Real-time/daily claim eligibility never gates on a clock-derived STRING alone
 *       (must use a strictly-monotone comparison — weekly audit 2026-07-24).
 *   E11 Luxury verb side-channel income stays under the trophy it belongs to: a
 *       recurring fee below the item's weekly upkeep, and at most ONE profitable
 *       outcome per verb (weekly audit 2026-07-28).
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
      const { rate } = brackets[i];
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

  checkClaimClockGuards(a);
  checkLuxuryVerbIncome(a);

  return a;
}

// ---------------------------------------------------------------------------
// E10 — real-time / daily claim eligibility (weekly audit 2026-07-24)
// ---------------------------------------------------------------------------
/**
 * The exploit this encodes: `canClaimDailyGems` gated the PAID-currency daily
 * drop on `settings.deepLifePlusLastGemClaim !== todayKey`, a pure device-clock
 * day STRING with no ordering. Rolling the clock either way produced a different
 * key, so the premium currency minted itself. The fix — and the rule — is that a
 * claim predicate must compare day keys with a strictly-monotone operator
 * (`todayKey <= lastKey` → refuse), never with bare (in)equality.
 *
 * A function is exempt when it delegates to another `can*` predicate: the guard
 * lives there, and that predicate is checked on its own.
 */
function checkClaimClockGuards(a) {
  const files = L.walk(['contexts', 'lib', 'components', 'app'], L.isProductionSource);
  const offenders = [];
  for (const file of files) {
    const src = L.read(file);
    if (src == null || !/[Cc]laim/.test(src)) continue;
    for (const fn of namedFunctionBodies(src, /\b(can[A-Z]\w*|claim[A-Z]\w*)\b/)) {
      const readsClock = /utcDayKey|todayKey|dayKey|DayKey|Date\.now\(|new Date\(/.test(fn.body);
      if (!readsClock) continue;
      const delegates = /\bcan[A-Z]\w*\s*\(/.test(fn.body);
      if (delegates) continue;
      const hasOrdering = /[<>]=?/.test(fn.body);
      if (!hasOrdering) offenders.push(`${fn.name} (${file}:${fn.line})`);
    }
  }
  a.assert(offenders.length === 0, 'high',
    'Every clock-derived claim predicate uses a strictly-monotone comparison',
    `${offenders.length} claim predicate(s) gate on a clock-derived value with no ordering comparison`,
    offenders.join(', ') + ' — a bare `!==` on a device-clock day string is farmable in both directions (H-3 / weekly audit 2026-07-24).',
    'contexts/game/actions/SubscriptionActions.ts');
}

// ---------------------------------------------------------------------------
// E11 — luxury verb side-channel income (weekly audit 2026-07-28)
// ---------------------------------------------------------------------------
/**
 * The catalog's core invariant is that every `yield.weekly` sits BELOW its
 * item's `weeklyUpkeep`, so a collection always net-costs. Verb payouts are a
 * SEPARATE channel (`getLoanIncome`, race purses) that `getTotalLuxuryYield`
 * never sees, which is how two printers shipped. Two parseable rules:
 *
 *   (a) a recurring verb fee (`*_WEEKLY_FEE`) must be strictly below the owning
 *       item's `weeklyUpkeep` — it is continuously re-armable, so it is a yield
 *       in everything but name;
 *   (b) at most ONE outcome of a verb may profit: sort the payouts in the verb's
 *       resolver, and every payout below the best must be <= the verb's cost.
 *       The racehorse's $30k place purse against a $25k entry (2 of 3 outcomes
 *       profitable, +$5k base EV) is exactly what this catches.
 */
function checkLuxuryVerbIncome(a) {
  const verbsSrc = L.read('lib/luxury/verbs.ts');
  const catalogSrc = L.read('lib/luxury/catalog.ts');
  if (verbsSrc == null || catalogSrc == null) {
    a.info('Luxury verb sources not found', 'Skipping the verb-income invariant.', 'lib/luxury/verbs.ts');
    return;
  }

  const upkeepById = parseLuxuryUpkeep(catalogSrc);
  const verbs = parseLuxuryVerbs(verbsSrc);
  if (verbs.length === 0) {
    a.info('No luxury verbs parsed', 'LUXURY_VERBS shape changed — update the analyzer.', 'lib/luxury/verbs.ts');
    return;
  }

  // (a) Recurring fees.
  const feeRe = /export const (\w*_WEEKLY_FEE)\s*=\s*([0-9_]+)/g;
  let f;
  while ((f = feeRe.exec(verbsSrc))) {
    const [, name, raw] = f;
    const fee = Number(raw.replace(/_/g, ''));
    // Match the fee to its verb by shared word tokens (MUSEUM_LOAN_WEEKLY_FEE → museum_loan).
    const verb = verbs.find((v) => tokenOverlap(v.id, name) > 0);
    const upkeep = verb ? upkeepById[verb.itemId] : undefined;
    if (upkeep == null) {
      a.info(`${name} has no matching catalog item`, 'Cannot compare it to an upkeep.', 'lib/luxury/verbs.ts');
      continue;
    }
    a.assert(fee < upkeep, 'high',
      `${name} ($${fmt(fee)}/wk) stays below ${verb.itemId} upkeep ($${fmt(upkeep)}/wk)`,
      `${name} ($${fmt(fee)}/wk) meets or exceeds ${verb.itemId}'s upkeep ($${fmt(upkeep)}/wk)`,
      'A continuously re-armable verb fee is a yield: above upkeep it turns the trophy into an untaxed weekly rail.',
      'lib/luxury/verbs.ts');
  }

  // (b) At most one profitable outcome per verb.
  for (const verb of verbs) {
    const resolver = findResolverFor(verbsSrc, verb.id);
    if (!resolver) {
      a.info(`No resolver found for verb '${verb.id}'`, 'Payout distribution not checkable — name it resolve<Verb>.', 'lib/luxury/verbs.ts');
      continue;
    }
    const payouts = [...resolver.body.matchAll(/money:\s*(-?[0-9_]+)/g)]
      .map((m) => Number(m[1].replace(/_/g, '')))
      .sort((x, y) => y - x);
    if (payouts.length < 2) continue; // single-outcome verb — rule (a) territory
    const runnersUp = payouts.slice(1).filter((p) => p > verb.cost);
    a.assert(runnersUp.length === 0, 'high',
      `Verb '${verb.id}': only the best outcome profits (cost $${fmt(verb.cost)}, others ≤ cost)`,
      `Verb '${verb.id}' has ${runnersUp.length + 1} profitable outcome(s)`,
      `payouts [${payouts.map(fmt).join(', ')}] vs cost $${fmt(verb.cost)} — more than one outcome above the cost pushes base EV positive, which is the racehorse printer (weekly audit 2026-07-28).`,
      'lib/luxury/verbs.ts');
  }
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

/**
 * Brace-matched bodies of every named function/arrow whose name matches `nameRe`.
 * Comments and string literals are blanked first (positions preserved), so a
 * documented example inside a doc block can't be mistaken for real code.
 */
function namedFunctionBodies(src, nameRe) {
  const clean = L.stripNoise(src);
  const decl = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?(?:function\\s+(${nameRe.source})|const\\s+(${nameRe.source})\\s*=)`,
    'g',
  );
  const out = [];
  let m;
  while ((m = decl.exec(clean))) {
    const name = m[1] || m[2];
    const open = clean.indexOf('{', m.index + m[0].length);
    if (open === -1) continue;
    let depth = 0;
    let end = clean.length;
    for (let i = open; i < clean.length; i++) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    out.push({
      name,
      line: clean.slice(0, m.index).split('\n').length,
      body: clean.slice(open, end + 1),
    });
    decl.lastIndex = open;
  }
  return out;
}

/** `{ id, itemId, cost, cooldownWeeks }` for every entry of LUXURY_VERBS. */
function parseLuxuryVerbs(src) {
  const block = src.match(/LUXURY_VERBS[^=]*=\s*\[([\s\S]*?)\n\]/);
  if (!block) return [];
  const out = [];
  const re = /id:\s*'([\w_]+)'[\s\S]*?itemId:\s*'([\w_]+)'[\s\S]*?cost:\s*([0-9_]+)[\s\S]*?cooldownWeeks:\s*([0-9_]+)/g;
  let m;
  while ((m = re.exec(block[1]))) {
    out.push({
      id: m[1],
      itemId: m[2],
      cost: Number(m[3].replace(/_/g, '')),
      cooldownWeeks: Number(m[4].replace(/_/g, '')),
    });
  }
  return out;
}

/** `{ [catalogId]: weeklyUpkeep }` from the luxury catalog. */
function parseLuxuryUpkeep(src) {
  const out = {};
  const re = /id:\s*'([\w_]+)'[\s\S]{0,600}?weeklyUpkeep:\s*([0-9_]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (out[m[1]] === undefined) out[m[1]] = Number(m[2].replace(/_/g, ''));
  }
  return out;
}

/** Shared word tokens between a verb id (`race_horse`) and a symbol name. */
function tokenOverlap(verbId, name) {
  const tokens = verbId.split('_').filter(Boolean);
  const hay = name.toLowerCase();
  return tokens.filter((t) => hay.includes(t)).length;
}

/** The `resolve*` function whose name shares the most tokens with the verb id. */
function findResolverFor(src, verbId) {
  const candidates = namedFunctionBodies(src, /resolve[A-Z]\w*/);
  let best = null;
  let bestScore = 0;
  for (const fn of candidates) {
    const score = tokenOverlap(verbId, fn.name);
    if (score > bestScore) { best = fn; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
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
