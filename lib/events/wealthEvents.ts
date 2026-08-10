/**
 * Late-game / wealth-tier event pack — the first content to actually USE
 * `EventChoiceEffects.moneyPct`.
 *
 * ## Why this pack exists
 *
 * `moneyPct` (see engine.ts and moneyScaling.ts) shipped as a no-op: the
 * mechanism resolves a choice to `max(|money|, netWorth * moneyPct)` with the
 * sign of `money`, but NO template declared it, so every one of the ~400
 * authored events still offered a hand-tuned flat figure. At $50M net worth a
 * "$5,000 windfall" is a rounding error, which is a large part of why the late
 * game reads as empty even though events keep arriving. These 45 templates are
 * the content that makes the mechanism live.
 *
 * ## Authoring rules used throughout (keep them if you add to this pack)
 *
 * 1. **Sign agreement.** `resolveEventMoney` takes its sign from `money` when
 *    `money !== 0` and only falls back to the sign of `moneyPct`. A loss must
 *    therefore declare BOTH negative — `{ money: -5_000, moneyPct: 0.01 }`
 *    resolves NEGATIVE and would read as a bug in the choice text. Every money
 *    effect here is built through `M(flat, pct)` and the test suite asserts the
 *    two signs agree for every choice in the pack.
 * 2. **The flat figure is a FLOOR, not a fallback.** It is set to roughly half
 *    of what the percentage is worth at the tier's own gate, so the percentage
 *    is what binds for anyone who legitimately qualifies, and the flat number
 *    still reads sensibly for a player whose net worth is momentarily illiquid
 *    or who dipped just under the line.
 * 3. **Never exceed the bound.** `MAX_EVENT_NET_WORTH_FRACTION` is 0.05 and is
 *    enforced inside `resolveEventMoney` regardless of what a template asks
 *    for. Nothing here declares more than 0.05, so the declared number and the
 *    resolved number always agree — a template that over-declares would print
 *    one figure in its text and apply another.
 * 4. **`generate()` is pure and deterministic.** No `Math.random()`: the choice
 *    text prints the resolved figure, so a second render must produce the same
 *    string. Money labels are resolved through the SAME `resolveEventMoney`
 *    the resolver uses, so the text cannot drift from the effect.
 * 5. **Defensive at any wealth.** `generate()` is called by sweep tests (and by
 *    the follow-up audit) against a default poor state, so nothing here may
 *    assume the gate passed.
 *
 * ## Gating — where "wealthy" was taken from, rather than guessed
 *
 * | Tier      | Net worth | Where the number comes from                        |
 * |-----------|-----------|----------------------------------------------------|
 * | AFFLUENT  | $1M       | entry of the luxury catalogue's `premium` band ($1.2M) — the first point the player is buying trophies rather than necessities |
 * | WEALTHY   | $10M      | `BASE_PRESTIGE_THRESHOLD` — the game's OWN definition of "rich enough to end this life" |
 * | TYCOON    | $50M      | inside the `elite` luxury band ($15M-$65M); also ~5 weeks of the fully-capped passive income ceiling (`PER_SOURCE_CAPS` totals ~$950K/wk) |
 * | DYNASTY   | $250M     | inside the `ultra` luxury band ($120M-$500M); above the $100M prestige achievement |
 *
 * Every template additionally requires `weeksLived >= MIN_WEEKS_LIVED` (26), so
 * a scenario that STARTS the player rich still plays half a year of ordinary
 * life before the tycoon pool opens, and these can never compete with the
 * weeks-0-12 welcome events.
 *
 * Net worth is read from the canonical `netWorth()` (lib/progress/achievements)
 * — the same figure the prestige gate, the HUD and the leaderboard use — not a
 * re-derived partial sum. That mistake has already been fixed once in this
 * directory (secretEvents.ts, 2026-07-30 audit GP-2).
 *
 * ## Wiring
 *
 * Spread into `eventTemplates` in engine.ts exactly like the other packs, so it
 * rolls through the same weighted + pity pipeline.
 *
 * Weights sit at 1.3-1.8, which looks high next to the 0.2-0.5 of a typical
 * template but is not: the eligible late-game pool is ~80 templates whose
 * weights (after the selector's per-category risk multiplier) total ~23, and
 * the pack has to be a visible share of that or the whole exercise fails the
 * way the life-stage packs first did — content that exists and never fires.
 * Measured against a $120M fixture the pack takes ~28% of fired events, with
 * 25+ distinct templates surfacing over a 600-week sweep. The reachability
 * test in `__tests__/wealthEvents.test.ts` pins that; it is the assertion to
 * re-run if these weights are ever tuned.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import { resolveEventMoney } from './moneyScaling';

// ── Gates ──────────────────────────────────────────────────────────────────

/** Luxury catalogue `premium` band entry — the first "trophy money" tier. */
export const AFFLUENT_NET_WORTH = 1_000_000;
/** BASE_PRESTIGE_THRESHOLD: the game's own line for "wealthy". */
export const WEALTHY_NET_WORTH = 10_000_000;
/** Mid `elite` luxury band. */
export const TYCOON_NET_WORTH = 50_000_000;
/** Lower `ultra` luxury band — dynastic money. */
export const DYNASTY_NET_WORTH = 250_000_000;

/**
 * No wealth beat before half a year of play, whatever the balance sheet says.
 * Keeps a rich-start scenario from skipping straight past the ordinary early
 * game and stops this pack competing with the weeks-0-12 welcome events.
 */
export const MIN_WEEKS_LIVED = 26;

/** Every template's gate: age of the life AND the wealth tier, plus extras. */
const gate =
  (minNetWorth: number, extra?: (state: GameState) => boolean) =>
    (state: GameState): boolean => {
      if ((state.weeksLived || 0) < MIN_WEEKS_LIVED) return false;
      if (netWorth(state) < minNetWorth) return false;
      return extra ? extra(state) : true;
    };

// ── Money helpers ──────────────────────────────────────────────────────────

/** A scalable money effect: flat FLOOR + fraction of net worth. */
interface Money {
  money: number;
  moneyPct: number;
}

/**
 * Build a money effect. `flat` carries the sign; `pct` is given as a positive
 * magnitude and is signed to match, so a caller can never author the
 * sign-disagreement trap described in rule 1 above.
 */
const M = (flat: number, pct: number): Money => ({
  money: flat,
  moneyPct: flat < 0 ? -Math.abs(pct) : Math.abs(pct),
});

/** Drops a trailing ".0" so a figure reads "$8M", not "$8.0M". */
const trim1dp = (n: number): string => n.toFixed(1).replace(/\.0$/, '');

const usd = (value: number): string => {
  const v = Math.abs(Math.round(value));
  if (v >= 1_000_000_000) return `$${trim1dp(v / 1_000_000_000)}B`;
  if (v >= 10_000_000) return `$${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000_000) return `$${trim1dp(v / 1_000_000)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
};

/**
 * The player-facing label for a money effect, resolved through the SAME
 * function the resolver uses so the printed figure is the applied figure.
 */
const show = (state: GameState, m: Money): string => {
  const resolved = resolveEventMoney(m, netWorth(state));
  return `${resolved < 0 ? '-' : '+'}${usd(resolved)}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// A. Business / tycoon dealings
// ═══════════════════════════════════════════════════════════════════════════

const hostileTakeover: EventTemplate = {
  id: 'wealth_hostile_takeover',
  category: 'economy',
  weight: 1.8,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const premium = M(150_000, 0.035);
    const defence = M(-60_000, 0.015);
    return {
      id: 'wealth_hostile_takeover',
      description: 'A raider has quietly built a stake in your largest holding and gone public with a bid — above market, below what you think it is worth.',
      choices: [
        { id: 'sell', text: `Sell into the bid (${show(state, premium)}, you lose the asset)`, effects: { ...premium, stats: { reputation: -6, happiness: -4 } } },
        { id: 'defend', text: `Fund a defence — bankers, poison pill (${show(state, defence)})`, effects: { ...defence, stats: { reputation: 8, energy: -12 } } },
        { id: 'counter', text: 'Court a friendlier buyer instead', effects: { stats: { reputation: 4, energy: -8, happiness: -2 } } },
      ],
    };
  },
};

const boardCoup: EventTemplate = {
  id: 'wealth_board_coup',
  category: 'economy',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH, state => (state.companies?.length || 0) > 0),
  generate: state => {
    const buyout = M(-80_000, 0.02);
    return {
      id: 'wealth_board_coup',
      description: 'Two of your directors have been counting votes without you. They want a "professional" CEO in the chair by the end of the quarter.',
      choices: [
        { id: 'buy_them_out', text: `Buy out their stock and end it (${show(state, buyout)})`, effects: { ...buyout, stats: { reputation: -3, energy: -6 } } },
        { id: 'fight', text: 'Take it to a shareholder vote', effects: { stats: { reputation: -8, energy: -15, happiness: -6 } } },
        { id: 'step_back', text: 'Step back to chairman and keep the dividend', effects: { stats: { happiness: 6, energy: 10, reputation: -4 } } },
      ],
    };
  },
};

const ipoWindow: EventTemplate = {
  id: 'wealth_ipo_window',
  category: 'economy',
  weight: 1.8,
  condition: gate(WEALTHY_NET_WORTH, state => (state.companies?.length || 0) > 0),
  generate: state => {
    const full = M(200_000, 0.045);
    const partial = M(90_000, 0.02);
    return {
      id: 'wealth_ipo_window',
      description: 'Your bankers say the listing window is open — but only for about six weeks. After that, who knows.',
      choices: [
        { id: 'full', text: `List the whole thing now (${show(state, full)}, and the story becomes public)`, effects: { ...full, stats: { reputation: 10, happiness: -5, energy: -15 } } },
        { id: 'partial', text: `Sell a minority stake and keep control (${show(state, partial)})`, effects: { ...partial, stats: { reputation: 5, energy: -8 } } },
        { id: 'wait', text: 'Stay private — no quarterly circus', effects: { stats: { happiness: 8, reputation: -2 } } },
      ],
    };
  },
};

const distressedCompetitor: EventTemplate = {
  id: 'wealth_distressed_competitor',
  category: 'economy',
  weight: 1.8,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const buy = M(-120_000, 0.03);
    const cherryPick = M(-40_000, 0.01);
    return {
      id: 'wealth_distressed_competitor',
      description: 'Your closest competitor missed payroll. Their lender would rather sell the whole thing this month than run an auction.',
      choices: [
        { id: 'buy_whole', text: `Buy the company outright (${show(state, buy)})`, effects: { ...buy, stats: { reputation: 6, energy: -12 } } },
        { id: 'cherry_pick', text: `Take only the good contracts and the team (${show(state, cherryPick)})`, effects: { ...cherryPick, stats: { reputation: -6, energy: -6 } } },
        { id: 'let_fail', text: 'Let them fold and take the customers for free', effects: { stats: { reputation: -10, happiness: 3 }, karma: { dimension: 'ambition', amount: 4, reason: 'Let a rival fail rather than rescue it' } } },
      ],
    };
  },
};

const supplyShock: EventTemplate = {
  id: 'wealth_supply_shock',
  category: 'economy',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH, state => (state.companies?.length || 0) > 0),
  generate: state => {
    const stockpile = M(-70_000, 0.018);
    const passOn = M(-25_000, 0.006);
    return {
      id: 'wealth_supply_shock',
      description: 'A shipping lane closed overnight. Every input you buy just repriced, and your competitors are all calling the same three suppliers.',
      choices: [
        { id: 'stockpile', text: `Pay up and corner a year of supply (${show(state, stockpile)})`, effects: { ...stockpile, stats: { reputation: 5, energy: -10 } } },
        { id: 'pass_on', text: `Absorb part of it, pass the rest to customers (${show(state, passOn)})`, effects: { ...passOn, stats: { reputation: -5 } } },
        { id: 'ride_it', text: 'Ride it out on thin inventory', effects: { stats: { reputation: -8, happiness: -6, energy: -5 } } },
      ],
    };
  },
};

const activistInvestor: EventTemplate = {
  id: 'wealth_activist_investor',
  category: 'economy',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const buyback = M(-100_000, 0.025);
    const settle = M(-45_000, 0.01);
    return {
      id: 'wealth_activist_investor',
      description: 'An activist fund has published a 90-slide deck about everything you are doing wrong. Half of it is unfair. The other half is not.',
      choices: [
        { id: 'buyback', text: `Announce a buyback and drown them out (${show(state, buyback)})`, effects: { ...buyback, stats: { reputation: 4, energy: -8 } } },
        { id: 'settle', text: `Give them a board seat and move on (${show(state, settle)})`, effects: { ...settle, stats: { reputation: -3, happiness: -4, energy: 5 } } },
        { id: 'ignore', text: 'Ignore the deck entirely', effects: { stats: { reputation: -9, happiness: -3 } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// B. Philanthropy
// ═══════════════════════════════════════════════════════════════════════════

const namingGift: EventTemplate = {
  id: 'wealth_naming_gift',
  category: 'relationship',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const named = M(-120_000, 0.03);
    const quiet = M(-40_000, 0.01);
    return {
      id: 'wealth_naming_gift',
      description: 'The hospital needs a new children\'s wing. The development director has already had your name mocked up on the sign.',
      choices: [
        { id: 'named', text: `Fund the wing, name on the wall (${show(state, named)})`, effects: { ...named, stats: { reputation: 18, happiness: 8 }, karma: { dimension: 'generosity', amount: 6, reason: 'Funded a hospital wing' } } },
        { id: 'anonymous', text: `Fund it anonymously (${show(state, quiet)}, nobody knows)`, effects: { ...quiet, stats: { happiness: 12 }, karma: { dimension: 'generosity', amount: 9, reason: 'Gave anonymously' } } },
        { id: 'decline', text: 'Decline — you already pay tax for this', effects: { stats: { reputation: -8 }, karma: { dimension: 'generosity', amount: -4, reason: 'Refused a hospital appeal' } } },
      ],
    };
  },
};

const foundationLaunch: EventTemplate = {
  id: 'wealth_foundation_launch',
  category: 'relationship',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const endow = M(-200_000, 0.045);
    const small = M(-60_000, 0.012);
    return {
      id: 'wealth_foundation_launch',
      description: 'Your advisors have drafted the paperwork for a private foundation. Endow it properly and it outlives you; endow it thinly and it becomes a press release.',
      choices: [
        { id: 'endow', text: `Endow it properly (${show(state, endow)})`, effects: { ...endow, stats: { reputation: 20, happiness: 10 }, karma: { dimension: 'generosity', amount: 8, reason: 'Endowed a foundation' } } },
        { id: 'token', text: `Fund a modest first year and see (${show(state, small)})`, effects: { ...small, stats: { reputation: 6, happiness: 4 }, karma: { dimension: 'generosity', amount: 3, reason: 'Started a small foundation' } } },
        { id: 'shelve', text: 'Shelve it — give directly instead', effects: { stats: { happiness: 3, reputation: -2 } } },
      ],
    };
  },
};

const disasterRelief: EventTemplate = {
  id: 'wealth_disaster_relief',
  category: 'relationship',
  weight: 1.68,
  condition: gate(AFFLUENT_NET_WORTH),
  generate: state => {
    const big = M(-25_000, 0.02);
    const matched = M(-10_000, 0.008);
    return {
      id: 'wealth_disaster_relief',
      description: 'A flood has taken out an entire district. Three separate people have your phone number and all three are calling.',
      choices: [
        { id: 'wire', text: `Wire the relief fund immediately (${show(state, big)})`, effects: { ...big, stats: { reputation: 14, happiness: 8 }, karma: { dimension: 'generosity', amount: 7, reason: 'Funded disaster relief' } } },
        { id: 'match', text: `Announce a matching pledge (${show(state, matched)}, others give too)`, effects: { ...matched, stats: { reputation: 16, happiness: 5 }, karma: { dimension: 'generosity', amount: 4, reason: 'Matched public donations' } } },
        { id: 'later', text: 'Wait until the rebuild plan is credible', effects: { stats: { reputation: -6, happiness: -3 } } },
      ],
    };
  },
};

const scholarshipEndowment: EventTemplate = {
  id: 'wealth_scholarship_endowment',
  category: 'relationship',
  weight: 1.52,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const endow = M(-90_000, 0.022);
    return {
      id: 'wealth_scholarship_endowment',
      description: 'Your old school wants to endow a scholarship in your name. They have sent a photograph of you at seventeen, which is an unfair negotiating tactic.',
      choices: [
        { id: 'endow', text: `Endow it in perpetuity (${show(state, endow)})`, effects: { ...endow, stats: { reputation: 15, happiness: 10 }, karma: { dimension: 'generosity', amount: 6, reason: 'Endowed a scholarship' } } },
        { id: 'mentor', text: 'Skip the money — mentor two students yourself', effects: { stats: { happiness: 9, reputation: 6, energy: -10 }, karma: { dimension: 'generosity', amount: 5, reason: 'Gave time instead of money' } } },
        { id: 'decline', text: 'Send regrets', effects: { stats: { reputation: -5 } } },
      ],
    };
  },
};

const givingPledge: EventTemplate = {
  id: 'wealth_giving_pledge',
  category: 'relationship',
  weight: 1.4,
  condition: gate(DYNASTY_NET_WORTH),
  generate: state => {
    const first = M(-400_000, 0.05);
    return {
      id: 'wealth_giving_pledge',
      description: 'A club of billionaires wants you to sign a public pledge to give most of it away. Signing costs nothing today. That is rather the point.',
      choices: [
        { id: 'sign_and_pay', text: `Sign it and make the first transfer now (${show(state, first)})`, effects: { ...first, stats: { reputation: 22, happiness: 12 }, karma: { dimension: 'generosity', amount: 10, reason: 'Signed and honoured a giving pledge' } } },
        { id: 'sign_only', text: 'Sign it, give later', effects: { stats: { reputation: 12, happiness: -3 }, karma: { dimension: 'honesty', amount: -3, reason: 'Made a pledge with no money behind it' } } },
        { id: 'refuse', text: 'Refuse — your heirs come first', effects: { stats: { reputation: -10, happiness: 4 }, karma: { dimension: 'generosity', amount: -5, reason: 'Refused the giving pledge' } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// C. Tax & legal exposure
// ═══════════════════════════════════════════════════════════════════════════

const taxAudit: EventTemplate = {
  id: 'wealth_tax_audit',
  category: 'economy',
  weight: 1.8,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const settle = M(-100_000, 0.025);
    const fight = M(-45_000, 0.011);
    return {
      id: 'wealth_tax_audit',
      description: 'The revenue service has opened a full examination of the last six years. Their letter is four pages long and entirely polite.',
      choices: [
        { id: 'settle', text: `Settle quietly and close it (${show(state, settle)})`, effects: { ...settle, stats: { happiness: 5, energy: 5 } } },
        { id: 'fight', text: `Fight every line with counsel (${show(state, fight)} in fees)`, effects: { ...fight, stats: { energy: -15, happiness: -8, reputation: 3 } } },
        { id: 'stall', text: 'Stall and hope it lapses', effects: { stats: { reputation: -12, happiness: -10 }, karma: { dimension: 'honesty', amount: -5, reason: 'Stonewalled a tax examination' } } },
      ],
    };
  },
};

const offshoreStructure: EventTemplate = {
  id: 'wealth_offshore_structure',
  category: 'economy',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const saving = M(120_000, 0.03);
    const cleanUp = M(-50_000, 0.012);
    return {
      id: 'wealth_offshore_structure',
      description: 'A boutique firm can restructure your holdings through three jurisdictions. It is legal. It is also the sort of thing that reads badly in print.',
      choices: [
        { id: 'do_it', text: `Do it — the saving is real (${show(state, saving)})`, effects: { ...saving, stats: { reputation: -12 }, karma: { dimension: 'honesty', amount: -6, reason: 'Moved wealth offshore' } } },
        { id: 'onshore', text: `Bring the old structures home instead (${show(state, cleanUp)})`, effects: { ...cleanUp, stats: { reputation: 12, happiness: 5 }, karma: { dimension: 'honesty', amount: 6, reason: 'Unwound an offshore structure' } } },
        { id: 'nothing', text: 'Leave everything exactly as it is', effects: { stats: { energy: 5 } } },
      ],
    };
  },
};

const wealthTaxProposal: EventTemplate = {
  id: 'wealth_tax_proposal',
  category: 'economy',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const levy = M(-150_000, 0.035);
    const lobby = M(-60_000, 0.014);
    return {
      id: 'wealth_tax_proposal',
      description: 'A one-off levy on large fortunes has passed its first reading. Your name is not in the bill, but everyone knows who it is for.',
      choices: [
        { id: 'pay', text: `Pay it without complaint (${show(state, levy)})`, effects: { ...levy, stats: { reputation: 14, happiness: -4 }, karma: { dimension: 'honesty', amount: 4, reason: 'Paid the levy without a fight' } } },
        { id: 'lobby', text: `Fund the lobbying campaign against it (${show(state, lobby)})`, effects: { ...lobby, stats: { reputation: -14, energy: -8 }, karma: { dimension: 'ambition', amount: 4, reason: 'Lobbied against a wealth levy' } } },
        { id: 'relocate', text: 'Move your tax residence abroad', effects: { stats: { reputation: -18, happiness: -8, energy: -12 } } },
      ],
    };
  },
};

const estatePlanning: EventTemplate = {
  id: 'wealth_estate_planning',
  category: 'economy',
  weight: 1.52,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const trust = M(-70_000, 0.016);
    return {
      id: 'wealth_estate_planning',
      description: 'Your estate lawyer lays out three structures. Each one decides, in advance, who resents you after you are gone.',
      choices: [
        { id: 'dynasty_trust', text: `Lock it in a dynasty trust (${show(state, trust)} to set up)`, effects: { ...trust, stats: { happiness: 6, reputation: 4 } } },
        { id: 'equal_split', text: 'Simple equal split, no conditions', effects: { stats: { happiness: 8 }, relationship: 8 } },
        { id: 'charity_first', text: 'Most of it to the foundation, a fixed sum to family', effects: { stats: { reputation: 12, happiness: -3 }, relationship: -12, karma: { dimension: 'generosity', amount: 6, reason: 'Left the bulk of the estate to charity' } } },
      ],
    };
  },
};

const classActionSuit: EventTemplate = {
  id: 'wealth_class_action',
  category: 'economy',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const settle = M(-110_000, 0.028);
    const defend = M(-55_000, 0.013);
    return {
      id: 'wealth_class_action',
      description: 'Eleven hundred former customers have filed as a class. Their lawyer is on television every evening, and he is good at it.',
      choices: [
        { id: 'settle', text: `Settle now, no admission (${show(state, settle)})`, effects: { ...settle, stats: { reputation: -4, energy: 6 } } },
        { id: 'defend', text: `Defend it for as long as it takes (${show(state, defend)} a year in fees)`, effects: { ...defend, stats: { reputation: -8, energy: -14, happiness: -8 } } },
        { id: 'fix_and_apologise', text: 'Apologise publicly and fix the product first', effects: { stats: { reputation: 10, happiness: 4, energy: -10 }, karma: { dimension: 'honesty', amount: 6, reason: 'Owned a product failure publicly' } } },
      ],
    };
  },
};

const regulatoryProbe: EventTemplate = {
  id: 'wealth_regulatory_probe',
  category: 'general',
  weight: 1.52,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const compliance = M(-65_000, 0.015);
    return {
      id: 'wealth_regulatory_probe',
      description: 'A regulator has requested "voluntary" production of five years of internal messages. Voluntary is doing a lot of work in that sentence.',
      choices: [
        { id: 'cooperate', text: `Hand everything over and overhaul compliance (${show(state, compliance)})`, effects: { ...compliance, stats: { reputation: 10, energy: -8 }, karma: { dimension: 'honesty', amount: 5, reason: 'Cooperated fully with a regulator' } } },
        { id: 'minimal', text: 'Produce the bare minimum the letter requires', effects: { stats: { reputation: -4, energy: -5 } } },
        { id: 'obstruct', text: 'Have the messages "retained elsewhere"', effects: { stats: { reputation: -20, happiness: -8 }, karma: { dimension: 'honesty', amount: -9, reason: 'Obstructed a regulatory probe' } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// D. Reputation & press
// ═══════════════════════════════════════════════════════════════════════════

const richList: EventTemplate = {
  id: 'wealth_rich_list',
  category: 'general',
  weight: 1.68,
  condition: gate(WEALTHY_NET_WORTH),
  surface: 'pulse_notification',
  generate: state => {
    const pr = M(-20_000, 0.005);
    return {
      id: 'wealth_rich_list',
      description: `A magazine is publishing its annual rich list and has you at roughly ${usd(netWorth(state))}. They would like a comment, and a photograph.`,
      choices: [
        { id: 'pose', text: 'Sit for the photograph and enjoy it', effects: { stats: { reputation: 12, happiness: 8 } } },
        { id: 'correct_down', text: `Pay a PR firm to talk the number DOWN (${show(state, pr)})`, effects: { ...pr, stats: { reputation: -3, happiness: 5 } } },
        { id: 'refuse', text: 'Refuse to engage at all', effects: { stats: { reputation: -6, happiness: 3 } } },
      ],
    };
  },
};

const hitPiece: EventTemplate = {
  id: 'wealth_hit_piece',
  category: 'general',
  weight: 1.68,
  condition: gate(WEALTHY_NET_WORTH),
  surface: 'pulse_scandal',
  generate: state => {
    const lawyers = M(-70_000, 0.017);
    return {
      id: 'wealth_hit_piece',
      description: 'A reporter has spent four months on a profile of you. The fact-checking email arrives at 11pm with nineteen questions.',
      choices: [
        { id: 'answer', text: 'Answer all nineteen honestly', effects: { stats: { reputation: 6, happiness: -6, energy: -10 }, karma: { dimension: 'honesty', amount: 5, reason: 'Answered a hostile profile honestly' } } },
        { id: 'lawyers', text: `Send the letter from your lawyers (${show(state, lawyers)})`, effects: { ...lawyers, stats: { reputation: -10, happiness: -4 } } },
        { id: 'preempt', text: 'Publish your own version first', effects: { stats: { reputation: 4, energy: -12, happiness: -3 } } },
      ],
    };
  },
};

const yachtPhoto: EventTemplate = {
  id: 'wealth_yacht_photo',
  category: 'general',
  weight: 1.52,
  condition: gate(TYCOON_NET_WORTH),
  surface: 'pulse_scandal',
  generate: state => {
    const donate = M(-45_000, 0.011);
    return {
      id: 'wealth_yacht_photo',
      description: 'A long-lens photograph of you on a deck, on the day the layoffs were announced, is the most-shared image in the country.',
      choices: [
        { id: 'donate', text: `Announce a hardship fund for the laid-off staff (${show(state, donate)})`, effects: { ...donate, stats: { reputation: 12, happiness: 4 }, karma: { dimension: 'generosity', amount: 6, reason: 'Funded support for laid-off staff' } } },
        { id: 'explain', text: 'Post a long, sincere explanation', effects: { stats: { reputation: -5, happiness: -4 } } },
        { id: 'silence', text: 'Say nothing and let it burn out', effects: { stats: { reputation: -10, happiness: -6, energy: 5 } } },
      ],
    };
  },
};

const ghostwrittenMemoir: EventTemplate = {
  id: 'wealth_ghostwritten_memoir',
  category: 'general',
  weight: 1.32,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const advance = M(60_000, 0.012);
    const buyCopies = M(-35_000, 0.008);
    return {
      id: 'wealth_ghostwritten_memoir',
      description: 'A publisher offers a large advance for your memoirs. The ghostwriter has already asked two questions you would rather not answer.',
      choices: [
        { id: 'honest', text: `Write the honest version (${show(state, advance)}, some people will not speak to you again)`, effects: { ...advance, stats: { reputation: 8, happiness: -6 }, relationship: -10, karma: { dimension: 'honesty', amount: 6, reason: 'Told the truth in print' } } },
        { id: 'safe', text: `Write the flattering version (${show(state, advance)})`, effects: { ...advance, stats: { reputation: 3, happiness: 2 } } },
        { id: 'bulk_buy', text: `Buy your own book onto the bestseller list (${show(state, buyCopies)})`, effects: { ...buyCopies, stats: { reputation: -8, happiness: 4 }, karma: { dimension: 'honesty', amount: -5, reason: 'Gamed a bestseller list' } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// E. Rival operators
// ═══════════════════════════════════════════════════════════════════════════

const shortAttack: EventTemplate = {
  id: 'wealth_short_attack',
  category: 'economy',
  weight: 1.68,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const hit = M(-160_000, 0.04);
    const defend = M(-60_000, 0.014);
    return {
      id: 'wealth_short_attack',
      description: 'A short seller has published a report calling your empire a house of cards. The market believed about a third of it before lunch.',
      choices: [
        { id: 'take_hit', text: `Say nothing and wear the mark-down (${show(state, hit)})`, effects: { ...hit, stats: { reputation: -6, happiness: -8 } } },
        { id: 'buy_dip', text: `Buy your own stock all the way down (${show(state, defend)})`, effects: { ...defend, stats: { reputation: 8, energy: -10 } } },
        { id: 'open_books', text: 'Open the books to an independent auditor', effects: { stats: { reputation: 12, energy: -12, happiness: -4 }, karma: { dimension: 'honesty', amount: 6, reason: 'Opened the books under attack' } } },
      ],
    };
  },
};

const rivalPoaches: EventTemplate = {
  id: 'wealth_rival_poaches_team',
  category: 'economy',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const counter = M(-55_000, 0.013);
    return {
      id: 'wealth_rival_poaches_team',
      description: 'A rival has offered your four best operators double, and a corner office each. Two of them have already stopped answering your messages.',
      choices: [
        { id: 'counter', text: `Counter every offer and then some (${show(state, counter)})`, effects: { ...counter, stats: { reputation: 5, energy: -8 } } },
        { id: 'let_go', text: 'Let them go and promote from underneath', effects: { stats: { reputation: -6, happiness: -5, energy: -6 } } },
        { id: 'sue', text: 'Sue on the non-competes', effects: { stats: { reputation: -10, energy: -10 }, karma: { dimension: 'loyalty', amount: -4, reason: 'Sued departing employees' } } },
      ],
    };
  },
};

const biddingWar: EventTemplate = {
  id: 'wealth_bidding_war',
  category: 'economy',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const win = M(-180_000, 0.042);
    const disciplined = M(-70_000, 0.016);
    return {
      id: 'wealth_bidding_war',
      description: 'The trophy asset of the decade is at auction, and the only other serious bidder is the one person you would most like to beat.',
      choices: [
        { id: 'win_at_any_price', text: `Win it, whatever it costs (${show(state, win)})`, effects: { ...win, stats: { reputation: 12, happiness: 10 }, karma: { dimension: 'ambition', amount: 5, reason: 'Won a bidding war on ego' } } },
        { id: 'disciplined', text: `Bid to your number and stop (${show(state, disciplined)} if it lands)`, effects: { ...disciplined, stats: { reputation: 4, happiness: -3 } } },
        { id: 'walk', text: 'Walk out before the first round', effects: { stats: { happiness: -6, reputation: -3, energy: 5 } } },
      ],
    };
  },
};

const truceDinner: EventTemplate = {
  id: 'wealth_truce_dinner',
  category: 'relationship',
  weight: 1.4,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const carveUp = M(90_000, 0.02);
    return {
      id: 'wealth_truce_dinner',
      description: 'Your oldest rival invites you to dinner, alone. Halfway through the second course they suggest, gently, that you stop competing on price.',
      choices: [
        { id: 'agree', text: `Shake on it (${show(state, carveUp)} a year in margin — and it is a cartel)`, effects: { ...carveUp, stats: { reputation: -10, happiness: 4 }, karma: { dimension: 'honesty', amount: -7, reason: 'Agreed to carve up a market' } } },
        { id: 'refuse', text: 'Refuse and finish the wine anyway', effects: { stats: { reputation: 8, happiness: 3 }, karma: { dimension: 'honesty', amount: 5, reason: 'Refused a price-fixing arrangement' } } },
        { id: 'record', text: 'Refuse — and quietly hand the recording to a regulator', effects: { stats: { reputation: 6, happiness: -5, energy: -8 }, karma: { dimension: 'loyalty', amount: -5, reason: 'Recorded and reported a rival' } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// F. Distressed-asset opportunities
// ═══════════════════════════════════════════════════════════════════════════

const fireSalePortfolio: EventTemplate = {
  id: 'wealth_fire_sale_portfolio',
  category: 'economy',
  weight: 1.8,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const whole = M(-140_000, 0.035);
    const slice = M(-50_000, 0.012);
    return {
      id: 'wealth_fire_sale_portfolio',
      description: 'A fund is being wound up and its property book must clear by Friday. The price is roughly sixty cents on the dollar, and the diligence window is four days.',
      choices: [
        { id: 'whole_book', text: `Take the whole book, diligence later (${show(state, whole)})`, effects: { ...whole, stats: { reputation: 8, energy: -14, happiness: 5 } } },
        { id: 'best_lots', text: `Take only the three assets you understand (${show(state, slice)})`, effects: { ...slice, stats: { reputation: 4, energy: -6 } } },
        { id: 'pass', text: 'Pass — four days is not diligence', effects: { stats: { happiness: -3, energy: 3 } } },
      ],
    };
  },
};

const bankFailureBargain: EventTemplate = {
  id: 'wealth_bank_failure_bargain',
  category: 'economy',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const rescue = M(-200_000, 0.048);
    return {
      id: 'wealth_bank_failure_bargain',
      description: 'A regional bank failed on Friday night. The regulator is looking for a buyer before the branches open on Monday, and your phone is ringing.',
      choices: [
        { id: 'buy', text: `Buy it over the weekend (${show(state, rescue)}, and you own its problems)`, effects: { ...rescue, stats: { reputation: 16, energy: -18, happiness: -4 } } },
        { id: 'deposits_only', text: 'Take the deposits, leave the bad book with the state', effects: { stats: { reputation: -6, happiness: 4, energy: -8 } } },
        { id: 'decline', text: 'Decline the call', effects: { stats: { reputation: -8, energy: 4 } } },
      ],
    };
  },
};

const bankruptSportsTeam: EventTemplate = {
  id: 'wealth_bankrupt_sports_team',
  category: 'economy',
  weight: 1.52,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const buy = M(-170_000, 0.04);
    return {
      id: 'wealth_bankrupt_sports_team',
      description: 'The city\'s football club is in administration. Fifteen thousand people have signed a petition asking you, by name, to save it.',
      choices: [
        { id: 'save', text: `Buy the club and clear its debts (${show(state, buy)})`, effects: { ...buy, stats: { reputation: 20, happiness: 12, energy: -10 }, karma: { dimension: 'generosity', amount: 5, reason: 'Rescued the city\'s club' } } },
        { id: 'asset_strip', text: 'Buy it for the stadium land and move the club', effects: { stats: { reputation: -22, happiness: 3 }, karma: { dimension: 'loyalty', amount: -8, reason: 'Bought a club to strip its ground' } } },
        { id: 'decline', text: 'Decline publicly and explain why', effects: { stats: { reputation: -6, happiness: -3 } } },
      ],
    };
  },
};

const landBankPlay: EventTemplate = {
  id: 'wealth_land_bank_play',
  category: 'economy',
  weight: 1.52,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const assemble = M(-100_000, 0.025);
    const flipNow = M(60_000, 0.014);
    return {
      id: 'wealth_land_bank_play',
      description: 'You have quietly assembled four of the six parcels on the old dock site. The fifth owner has just worked out why the letters keep coming.',
      choices: [
        { id: 'pay_up', text: `Pay his number and complete the block (${show(state, assemble)})`, effects: { ...assemble, stats: { reputation: -4, energy: -8, happiness: 6 } } },
        { id: 'sell_now', text: `Sell the four parcels on as they are (${show(state, flipNow)})`, effects: { ...flipNow, stats: { reputation: 2 } } },
        { id: 'squeeze', text: 'Have the council condemn his access road', effects: { stats: { reputation: -16, happiness: -4 }, karma: { dimension: 'honesty', amount: -7, reason: 'Used the council to squeeze a landowner' } } },
      ],
    };
  },
};

const artDeaccession: EventTemplate = {
  id: 'wealth_art_deaccession',
  category: 'economy',
  weight: 1.4,
  condition: gate(TYCOON_NET_WORTH, state => (state.luxuryItems?.length || 0) > 0),
  generate: state => {
    const sell = M(150_000, 0.035);
    const lend = M(-30_000, 0.007);
    return {
      id: 'wealth_art_deaccession',
      description: 'An estate is quietly releasing a painting you have wanted for twenty years — but the only way to fund it this month is to sell something of your own.',
      choices: [
        { id: 'sell_collection', text: `Sell three pieces at auction (${show(state, sell)})`, effects: { ...sell, stats: { happiness: -6, reputation: 3 } } },
        { id: 'lend_museum', text: `Lend your collection to a museum instead (${show(state, lend)} in transport and insurance)`, effects: { ...lend, stats: { reputation: 14, happiness: 6 }, karma: { dimension: 'generosity', amount: 4, reason: 'Lent a private collection to the public' } } },
        { id: 'keep', text: 'Keep everything and let the painting go', effects: { stats: { happiness: -4, energy: 3 } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// G. Family & inheritance pressure
// ═══════════════════════════════════════════════════════════════════════════

const familyOfficeRequest: EventTemplate = {
  id: 'wealth_family_office_request',
  category: 'relationship',
  weight: 1.52,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const setup = M(-45_000, 0.011);
    return {
      id: 'wealth_family_office_request',
      description: 'Three relatives now ask you for money directly, at family occasions. Your advisor suggests a family office, so that the answer stops being personal.',
      choices: [
        { id: 'set_up', text: `Set one up with a written policy (${show(state, setup)})`, effects: { ...setup, stats: { happiness: 8, energy: 6, reputation: 3 } } },
        { id: 'keep_personal', text: 'Keep saying yes or no yourself', effects: { stats: { happiness: -6, energy: -8 }, relationship: 6 } },
        { id: 'cut_off', text: 'Tell all three the answer is now permanently no', effects: { stats: { happiness: -4, energy: 8 }, relationship: -18, karma: { dimension: 'generosity', amount: -5, reason: 'Cut off family requests entirely' } } },
      ],
    };
  },
};

const heirAllowance: EventTemplate = {
  id: 'wealth_heir_allowance',
  category: 'relationship',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH, state => (state.family?.children?.length || 0) > 0),
  generate: state => {
    const generous = M(-60_000, 0.014);
    const modest = M(-15_000, 0.004);
    return {
      id: 'wealth_heir_allowance',
      description: 'Your eldest wants to know what their allowance is going to be. Whatever number you say becomes the number they plan a life around.',
      choices: [
        { id: 'generous', text: `Set it generously (${show(state, generous)} a year)`, effects: { ...generous, relationship: 14, stats: { happiness: 5 } } },
        { id: 'modest', text: `Set it modestly and explain why (${show(state, modest)} a year)`, effects: { ...modest, relationship: -4, stats: { happiness: 3, reputation: 5 } } },
        { id: 'earn_it', text: 'No allowance — a job at the company instead', effects: { relationship: -12, stats: { reputation: 8, happiness: -3 } } },
      ],
    };
  },
};

const relativeBusinessPlan: EventTemplate = {
  id: 'wealth_relative_business_plan',
  category: 'relationship',
  weight: 1.6,
  condition: gate(AFFLUENT_NET_WORTH, state => (state.relationships?.length || 0) > 0),
  generate: state => {
    const invest = M(-30_000, 0.012);
    const loan = M(-12_000, 0.004);
    return {
      id: 'wealth_relative_business_plan',
      description: 'A cousin has a business plan, printed and bound. It is not a good plan. They have told everyone in the family that you are considering it.',
      choices: [
        { id: 'invest', text: `Fund it properly and take equity (${show(state, invest)})`, effects: { ...invest, relationship: 15, stats: { happiness: 4 } } },
        { id: 'loan', text: `Lend a smaller sum, in writing (${show(state, loan)})`, effects: { ...loan, relationship: 4, stats: { reputation: 3 } } },
        { id: 'honest_no', text: 'Tell them honestly why the plan does not work', effects: { relationship: -12, stats: { happiness: -4 }, karma: { dimension: 'honesty', amount: 5, reason: 'Told a relative the truth about their plan' } } },
      ],
    };
  },
};

const prenupPressure: EventTemplate = {
  id: 'wealth_prenup_pressure',
  category: 'relationship',
  weight: 1.52,
  condition: gate(WEALTHY_NET_WORTH, state =>
    Boolean(state.relationships?.some(r => r.type === 'partner' || r.type === 'spouse'))),
  generate: state => {
    const settlement = M(-90_000, 0.02);
    return {
      id: 'wealth_prenup_pressure',
      description: 'Your lawyers have drafted an agreement that protects everything. Your partner has read it twice and has not said anything since.',
      choices: [
        { id: 'insist', text: 'Insist on it unchanged', effects: { relationship: -20, stats: { happiness: -8, reputation: 2 } } },
        { id: 'soften', text: `Rewrite it with a real settlement in it (${show(state, settlement)} committed)`, effects: { ...settlement, relationship: 12, stats: { happiness: 6 } } },
        { id: 'tear_up', text: 'Tear it up entirely', effects: { relationship: 20, stats: { happiness: 10, reputation: -5 } } },
      ],
    };
  },
};

const trustFundDispute: EventTemplate = {
  id: 'wealth_trust_fund_dispute',
  category: 'relationship',
  weight: 1.4,
  condition: gate(DYNASTY_NET_WORTH, state => (state.family?.children?.length || 0) > 0),
  generate: state => {
    const settle = M(-250_000, 0.05);
    return {
      id: 'wealth_trust_fund_dispute',
      description: 'Two of your children are suing each other over the trust. Their lawyers have started copying you into the letters.',
      choices: [
        { id: 'settle', text: `Fund a settlement that ends it today (${show(state, settle)})`, effects: { ...settle, relationship: 10, stats: { happiness: 4, energy: -6 } } },
        { id: 'mediate', text: 'Sit both of them down yourself, no lawyers', effects: { relationship: 6, stats: { happiness: -6, energy: -14 } } },
        { id: 'let_court', text: 'Let the court decide and stay out of it', effects: { relationship: -16, stats: { happiness: -10, reputation: -6 } } },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// H. Being a target
// ═══════════════════════════════════════════════════════════════════════════

const kidnapThreat: EventTemplate = {
  id: 'wealth_kidnap_threat',
  category: 'general',
  weight: 1.52,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const security = M(-80_000, 0.018);
    return {
      id: 'wealth_kidnap_threat',
      description: 'Your security consultant has intercepted credible planning against your family. Nothing has happened. That is the point of telling you now.',
      choices: [
        { id: 'full_detail', text: `Full close protection, drivers, the lot (${show(state, security)} a year)`, effects: { ...security, stats: { happiness: -6, health: 4, energy: -4 } } },
        { id: 'quiet_move', text: 'Move the family quietly and tell nobody', effects: { stats: { happiness: -10, energy: -12 }, relationship: -8 } },
        { id: 'ignore', text: 'Refuse to live like that', effects: { stats: { happiness: 6, health: -10 } } },
      ],
    };
  },
};

const ransomwareDemand: EventTemplate = {
  id: 'wealth_ransomware_demand',
  category: 'economy',
  weight: 1.6,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const pay = M(-70_000, 0.017);
    const rebuild = M(-110_000, 0.026);
    return {
      id: 'wealth_ransomware_demand',
      description: 'Every file in your holding company is encrypted. The note is short, the wallet address is fresh, and the deadline is 72 hours.',
      choices: [
        { id: 'pay', text: `Pay and hope (${show(state, pay)})`, effects: { ...pay, stats: { reputation: -6, happiness: -8 } } },
        { id: 'rebuild', text: `Refuse and rebuild from backups (${show(state, rebuild)} and three lost weeks)`, effects: { ...rebuild, stats: { reputation: 8, energy: -18 } } },
        { id: 'go_public', text: 'Refuse, rebuild, and publish exactly what happened', effects: { stats: { reputation: 12, happiness: -5, energy: -20 }, karma: { dimension: 'honesty', amount: 6, reason: 'Disclosed a breach openly' } } },
      ],
    };
  },
};

const estateStalker: EventTemplate = {
  id: 'wealth_estate_stalker',
  category: 'general',
  weight: 1.4,
  condition: gate(WEALTHY_NET_WORTH, state => (state.realEstate?.some(r => r.owned) ?? false)),
  generate: state => {
    const harden = M(-35_000, 0.008);
    return {
      id: 'wealth_estate_stalker',
      description: 'The same man has been found inside your grounds three times this month. He is not violent. He is convinced the house is his.',
      choices: [
        { id: 'harden', text: `Harden the perimeter properly (${show(state, harden)})`, effects: { ...harden, stats: { happiness: 3, health: 3 } } },
        { id: 'help_him', text: 'Pay for his care rather than his prosecution', effects: { stats: { reputation: 12, happiness: 6 }, karma: { dimension: 'generosity', amount: 6, reason: 'Chose care over prosecution' } } },
        { id: 'prosecute', text: 'Press charges and get an order', effects: { stats: { reputation: -4, happiness: -3 } } },
      ],
    };
  },
};

const extortionDemand: EventTemplate = {
  id: 'wealth_extortion_demand',
  category: 'general',
  weight: 1.52,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const payoff = M(-100_000, 0.023);
    return {
      id: 'wealth_extortion_demand',
      description: 'Someone has photographs from a period of your life you do not discuss. They want paying, once, and promise that will be the end of it.',
      choices: [
        { id: 'pay', text: `Pay and say nothing (${show(state, payoff)})`, effects: { ...payoff, stats: { happiness: -10, reputation: 0 }, karma: { dimension: 'honesty', amount: -3, reason: 'Paid to bury a story' } } },
        { id: 'police', text: 'Take it straight to the police', effects: { stats: { reputation: -6, happiness: -6, energy: -8 }, karma: { dimension: 'honesty', amount: 6, reason: 'Reported an extortion attempt' } } },
        { id: 'publish_first', text: 'Publish the whole story yourself', effects: { stats: { reputation: -10, happiness: 8 }, karma: { dimension: 'honesty', amount: 8, reason: 'Told the story before it could be sold' } } },
      ],
    };
  },
};

const chartererScam: EventTemplate = {
  id: 'wealth_charter_scam',
  category: 'economy',
  weight: 1.52,
  condition: gate(AFFLUENT_NET_WORTH),
  generate: state => {
    const loss = M(-20_000, 0.009);
    const chase = M(-8_000, 0.003);
    return {
      id: 'wealth_charter_scam',
      description: 'The broker who arranged your last three charters has vanished, along with the deposits of about forty other clients.',
      choices: [
        { id: 'write_off', text: `Write it off and move on (${show(state, loss)})`, effects: { ...loss, stats: { happiness: -6, energy: 4 } } },
        { id: 'chase', text: `Fund the group action to chase him (${show(state, chase)}, and everyone benefits)`, effects: { ...chase, stats: { reputation: 10, energy: -8 }, karma: { dimension: 'loyalty', amount: 4, reason: 'Funded a group action for other victims' } } },
        { id: 'private_investigator', text: 'Hire someone to find him personally', effects: { stats: { reputation: -4, energy: -10, happiness: -3 } } },
      ],
    };
  },
};

const insiderApproach: EventTemplate = {
  id: 'wealth_insider_approach',
  category: 'economy',
  weight: 1.52,
  condition: gate(WEALTHY_NET_WORTH),
  generate: state => {
    const trade = M(180_000, 0.04);
    return {
      id: 'wealth_insider_approach',
      description: 'A friend on a board tells you, over dinner and without being asked, what will be announced on Thursday morning.',
      choices: [
        { id: 'trade', text: `Take the position tonight (${show(state, trade)}, and it is a crime)`, effects: { ...trade, stats: { reputation: -14, happiness: 4 }, karma: { dimension: 'honesty', amount: -9, reason: 'Traded on inside information' } } },
        { id: 'refuse', text: 'Change the subject and forget you heard it', effects: { stats: { reputation: 4, happiness: -3 }, karma: { dimension: 'honesty', amount: 6, reason: 'Refused an inside tip' } } },
        { id: 'warn_friend', text: 'Tell them never to say that to anyone again', effects: { stats: { reputation: 6, energy: -4 }, relationship: -8, karma: { dimension: 'loyalty', amount: 4, reason: 'Warned a friend off a crime' } } },
      ],
    };
  },
};

const staffLoyaltyTest: EventTemplate = {
  id: 'wealth_staff_loyalty_test',
  category: 'relationship',
  weight: 1.4,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const bonus = M(-40_000, 0.009);
    return {
      id: 'wealth_staff_loyalty_test',
      description: 'A tabloid has been offering your household staff money for stories. Your housekeeper of eleven years came and told you about the call.',
      choices: [
        { id: 'reward', text: `Pay everyone a loyalty bonus, no conditions (${show(state, bonus)})`, effects: { ...bonus, stats: { reputation: 8, happiness: 8 }, karma: { dimension: 'loyalty', amount: 6, reason: 'Rewarded loyal staff' } } },
        { id: 'ndas', text: 'Have everyone sign a tighter NDA', effects: { stats: { reputation: -6, happiness: -4 }, karma: { dimension: 'loyalty', amount: -4, reason: 'Answered loyalty with paperwork' } } },
        { id: 'nothing', text: 'Thank her and do nothing else', effects: { stats: { happiness: 3, reputation: -2 } } },
      ],
    };
  },
};

const homelandRequest: EventTemplate = {
  id: 'wealth_homeland_request',
  category: 'general',
  weight: 1.32,
  condition: gate(DYNASTY_NET_WORTH),
  generate: state => {
    const invest = M(-300_000, 0.05);
    const modest = M(-80_000, 0.015);
    return {
      id: 'wealth_homeland_request',
      description: 'A minister from the town you grew up in asks you to build the infrastructure the state never did. He is not asking for charity. He is asking for a monument.',
      choices: [
        { id: 'build', text: `Build all of it (${show(state, invest)})`, effects: { ...invest, stats: { reputation: 22, happiness: 12 }, karma: { dimension: 'generosity', amount: 8, reason: 'Rebuilt the town you came from' } } },
        { id: 'partial', text: `Fund the school and the clinic only (${show(state, modest)})`, effects: { ...modest, stats: { reputation: 12, happiness: 7 }, karma: { dimension: 'generosity', amount: 5, reason: 'Funded a school and a clinic' } } },
        { id: 'refuse', text: 'Refuse — it is the state\'s job, not yours', effects: { stats: { reputation: -12, happiness: -5 } } },
      ],
    };
  },
};

const macroHedge: EventTemplate = {
  id: 'wealth_macro_hedge',
  category: 'economy',
  weight: 1.6,
  condition: gate(TYCOON_NET_WORTH),
  generate: state => {
    const hedge = M(-60_000, 0.014);
    const bet = M(220_000, 0.05);
    return {
      id: 'wealth_macro_hedge',
      description: 'Your risk desk says the whole portfolio is one correlated bet on a single currency. Hedging it costs real money. Doubling down costs nothing until it does.',
      choices: [
        { id: 'hedge', text: `Buy the hedge and sleep at night (${show(state, hedge)})`, effects: { ...hedge, stats: { happiness: 6, health: 4 } } },
        { id: 'double_down', text: `Double the position instead (${show(state, bet)} — this time)`, effects: { ...bet, stats: { happiness: 8, health: -6, reputation: 4 }, karma: { dimension: 'ambition', amount: 5, reason: 'Doubled down on a concentrated bet' } } },
        { id: 'diversify', text: 'Sell down and diversify slowly', effects: { stats: { happiness: 3, energy: -8, reputation: 2 } } },
      ],
    };
  },
};

const opportunityFund: EventTemplate = {
  id: 'wealth_opportunity_fund',
  category: 'economy',
  weight: 1.6,
  condition: gate(AFFLUENT_NET_WORTH),
  generate: state => {
    const anchor = M(-40_000, 0.018);
    const small = M(-12_000, 0.005);
    return {
      id: 'wealth_opportunity_fund',
      description: 'A first-time fund manager wants you as an anchor investor. The strategy is sound, the track record is one page long, and the fee is not negotiable.',
      choices: [
        { id: 'anchor', text: `Anchor the fund (${show(state, anchor)}, locked for years)`, effects: { ...anchor, stats: { reputation: 8, happiness: 3 } } },
        { id: 'small_ticket', text: `Write a small cheque and watch (${show(state, small)})`, effects: { ...small, stats: { reputation: 3 } } },
        { id: 'pass', text: 'Pass — one page is not a track record', effects: { stats: { reputation: -2, energy: 3 } } },
      ],
    };
  },
};

/**
 * The pack, in the order authored. Spread into `eventTemplates` in engine.ts.
 */
export const wealthEventTemplates: EventTemplate[] = [
  // A. Business / tycoon dealings
  hostileTakeover,
  boardCoup,
  ipoWindow,
  distressedCompetitor,
  supplyShock,
  activistInvestor,
  // B. Philanthropy
  namingGift,
  foundationLaunch,
  disasterRelief,
  scholarshipEndowment,
  givingPledge,
  // C. Tax & legal exposure
  taxAudit,
  offshoreStructure,
  wealthTaxProposal,
  estatePlanning,
  classActionSuit,
  regulatoryProbe,
  // D. Reputation & press
  richList,
  hitPiece,
  yachtPhoto,
  ghostwrittenMemoir,
  // E. Rival operators
  shortAttack,
  rivalPoaches,
  biddingWar,
  truceDinner,
  // F. Distressed-asset opportunities
  fireSalePortfolio,
  bankFailureBargain,
  bankruptSportsTeam,
  landBankPlay,
  artDeaccession,
  opportunityFund,
  macroHedge,
  // G. Family & inheritance pressure
  familyOfficeRequest,
  heirAllowance,
  relativeBusinessPlan,
  prenupPressure,
  trustFundDispute,
  // H. Being a target
  kidnapThreat,
  ransomwareDemand,
  estateStalker,
  extortionDemand,
  chartererScam,
  insiderApproach,
  staffLoyaltyTest,
  homelandRequest,
];
