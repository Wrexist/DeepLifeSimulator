/**
 * Cross-system statistics summary — pulls per-system data from every remade
 * app into a single dashboard shape.
 *
 * The old StatisticsApp only read `lifetimeStatistics`, `achievements`, and
 * `previousLives`. Every other system silo (banking, crypto, dark web,
 * politics, etc.) generated data the dashboard never surfaced. This module
 * aggregates the gap.
 *
 * Pure functions.
 */

import { GameState } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface SystemCard {
  /** App / system identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Lead metric — usually a $ value or count. */
  lead: { label: string; value: string };
  /** Up to 3 supporting metrics. */
  details: { label: string; value: string }[];
  /** Optional warning tag (e.g. "credit score dropping", "heat high"). */
  warning?: string;
}

export interface CrossSystemSummary {
  cards: SystemCard[];
  /** Total open IOU money owed to player (positive net) or by player (negative). */
  netFavorMoney: number;
  /** Aggregate contact count by kind. */
  contactsByKind: Record<string, number>;
}

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function bankingCard(state: GameState): SystemCard | null {
  const banking = state.banking;
  if (!banking) return null;
  // These all read stale/imagined field names under the old `as any`: the real
  // BankingState nests the score under creditScore.score and names the totals
  // total*; open loans live on state.loans, not banking.loans. So every detail
  // here previously rendered 0 / '-'.
  const credit = safe(banking.creditScore?.score, 0);
  const lateFees = safe(banking.totalLateFeesPaid, 0);
  const interestPaid = safe(banking.totalInterestPaid, 0);
  const interestEarned = safe(banking.totalInterestEarned, 0);
  const loans = Array.isArray(state.loans) ? state.loans.length : 0;
  const warning =
    credit > 0 && credit < 600 ? 'Credit score below 600' :
    lateFees > 1000 ? 'High late-fee history' : undefined;
  return {
    id: 'banking',
    label: 'Banking',
    lead: { label: 'Credit score', value: credit > 0 ? String(credit) : '-' },
    details: [
      { label: 'Interest paid', value: fmtMoney(interestPaid) },
      { label: 'Interest earned', value: fmtMoney(interestEarned) },
      { label: 'Open loans', value: String(loans) },
    ],
    warning,
  };
}

function cryptoCard(state: GameState): SystemCard | null {
  const ct = state.cryptoMarket ?? state.cryptos;
  if (!ct) return null;
  // Field is `totalRealizedGains` (lifetime); `realizedGains` does not exist on
  // CryptoMarketState, so under the old `as any` this detail was always $0.
  const realized = safe(state.cryptoMarket?.totalRealizedGains, 0);
  const cryptos = state.cryptos ?? [];
  const totalOwnedUSD = cryptos.reduce((s, c) => s + safe(c.owned, 0) * safe(c.price, 0), 0);
  const dirty = safe(state.darkWeb?.dirtyBtc, 0);
  return {
    id: 'crypto',
    label: 'Crypto',
    lead: { label: 'Portfolio', value: fmtMoney(totalOwnedUSD) },
    details: [
      { label: 'Realized gains', value: fmtMoney(realized) },
      { label: 'Dirty BTC', value: dirty > 0 ? dirty.toFixed(3) : '-' },
    ],
    warning: dirty > 0 ? 'Tainted crypto needs laundering' : undefined,
  };
}

function stocksCard(state: GameState): SystemCard | null {
  const stocks = state.stocks;
  if (!stocks) return null;
  const holdings = stocks.holdings ?? [];
  // Field is `totalDividends`; `lifetimeDividends` does not exist, so under the
  // old `as any` this detail was always $0.
  const dividends = safe(stocks.totalDividends, 0);
  const realized = safe(stocks.realizedGains, 0);
  return {
    id: 'stocks',
    label: 'Stocks',
    lead: { label: 'Positions', value: String(holdings.length) },
    details: [
      { label: 'Dividends', value: fmtMoney(dividends) },
      { label: 'Realized gains', value: fmtMoney(realized) },
    ],
  };
}

function realEstateCard(state: GameState): SystemCard | null {
  // `state.realEstate` is the RealEstate[] holdings array. The previous code read
  // `state.realEstate?.properties` - a stale schema where realEstate was an object -
  // so `props` always resolved to [] and this card never rendered. Read the array
  // directly and count owned properties (matching lib/economy/expenses.ts).
  const props = (state.realEstate ?? []).filter((p) => p.owned);
  if (props.length === 0) return null;
  const totalValue = props.reduce((s, p) => s + safe(p.currentValue ?? p.price, 0), 0);
  return {
    id: 'realEstate',
    label: 'Real estate',
    lead: { label: 'Properties', value: String(props.length) },
    details: [{ label: 'Value', value: fmtMoney(totalValue) }],
  };
}

function darkWebCard(state: GameState): SystemCard | null {
  const dw = state.darkWeb;
  if (!dw) return null;
  const heat = safe(dw.heat, 0);
  const jobs = (dw.jobHistory ?? []).length + (dw.activeJobs ?? []).length;
  const rep = safe(dw.playerReputation, 0);
  const warning =
    heat >= 80 ? 'Heat critical - lay low' :
    heat >= 60 ? 'Heat high' : undefined;
  if (heat === 0 && jobs === 0 && rep === 0) return null;
  return {
    id: 'darkweb',
    label: 'Dark web',
    lead: { label: 'Heat', value: `${Math.round(heat)}/100` },
    details: [
      { label: 'Jobs', value: String(jobs) },
      { label: 'Buyer rep', value: String(Math.round(rep)) },
      { label: 'Clean BTC', value: safe(dw.cleanBtc, 0).toFixed(3) },
    ],
    warning,
  };
}

function politicsCard(state: GameState): SystemCard | null {
  const pol = state.politics;
  if (!pol || safe(pol.careerLevel, 0) === 0) return null;
  const approval = safe(pol.approvalRating, 50);
  const elections = safe(pol.electionsWon, 0);
  const policies = (pol.policiesEnacted ?? []).length;
  const scandals = (pol.scandals ?? []).filter((s) => s.active).length;
  return {
    id: 'politics',
    label: 'Politics',
    lead: { label: 'Approval', value: fmtPct(approval) },
    details: [
      { label: 'Elections won', value: String(elections) },
      { label: 'Policies enacted', value: String(policies) },
      { label: 'Active scandals', value: String(scandals) },
    ],
    warning: scandals > 0 ? 'Active scandal' : undefined,
  };
}

function contentCard(state: GameState): SystemCard | null {
  const ch = state.gamingStreaming;
  if (!ch) return null;
  const totalViews = safe(ch.totalViews, 0);
  const subs = safe(ch.subscribers, 0);
  const followers = safe(ch.followers, 0);
  const earned = safe(ch.totalEarnings, 0);
  if (totalViews === 0 && subs === 0 && earned === 0) return null;
  return {
    id: 'content',
    label: 'Content',
    lead: { label: 'Lifetime $', value: fmtMoney(earned) },
    details: [
      { label: 'Subscribers', value: subs.toLocaleString() },
      { label: 'Followers', value: followers.toLocaleString() },
      { label: 'Total views', value: totalViews.toLocaleString() },
    ],
  };
}

function petsCard(state: GameState): SystemCard | null {
  const pets = state.pets ?? [];
  if (pets.length === 0) return null;
  const alive = pets.filter((p) => !p.isDead);
  const wins = pets.reduce((s, p) => s + safe(p.competitionWins, 0), 0);
  return {
    id: 'pets',
    label: 'Pets',
    lead: { label: 'Alive', value: String(alive.length) },
    details: [
      { label: 'Lifetime', value: String(pets.length) },
      { label: 'Competition wins', value: String(wins) },
    ],
  };
}

function vehiclesCard(state: GameState): SystemCard | null {
  const v = state.vehicles ?? [];
  if (!Array.isArray(v) || v.length === 0) return null;
  // Vehicle has no `accidentCount` (the old `as any` read a field that never
  // existed → always 0). Surface average condition, a real field instead.
  const avgCondition = Math.round(v.reduce((s, x) => s + safe(x.condition, 0), 0) / v.length);
  return {
    id: 'vehicles',
    label: 'Vehicles',
    lead: { label: 'Owned', value: String(v.length) },
    details: [
      { label: 'Avg condition', value: `${avgCondition}/100` },
    ],
  };
}

function travelCard(state: GameState): SystemCard | null {
  const t = state.travel;
  if (!t) return null;
  const visited = (t.visitedDestinations ?? []).length;
  const opps = Object.values(t.businessOpportunities ?? {});
  const partners = opps.filter((o) => o.invested).length;
  if (visited === 0 && partners === 0) return null;
  return {
    id: 'travel',
    label: 'Travel',
    lead: { label: 'Destinations', value: String(visited) },
    details: [
      { label: 'Biz partners', value: String(partners) },
      { label: 'Prospects', value: String(opps.length - partners) },
    ],
  };
}

function contactsCard(_state: GameState, contactsByKind: Record<string, number>): SystemCard | null {
  const total = Object.values(contactsByKind).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const top3 = Object.entries(contactsByKind)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return {
    id: 'contacts',
    label: 'Contacts',
    lead: { label: 'Network', value: String(total) },
    details: top3.map(([k, n]) => ({ label: k, value: String(n) })),
  };
}

/**
 * Build a SystemCard for every system that has any data, skip the rest.
 */
export function buildCrossSystemSummary(
  state: GameState,
  contactsByKind: Record<string, number> = {}
): CrossSystemSummary {
  const ledger = state.favorLedger;
  let netFavorMoney = 0;
  if (ledger?.favors) {
    for (const f of ledger.favors) {
      if (f.status !== 'open' || f.kind !== 'money') continue;
      netFavorMoney += f.direction === 'owed-to-player' ? safe(f.value, 0) : -safe(f.value, 0);
    }
  }

  const cards = [
    bankingCard(state),
    cryptoCard(state),
    stocksCard(state),
    realEstateCard(state),
    darkWebCard(state),
    politicsCard(state),
    contentCard(state),
    travelCard(state),
    petsCard(state),
    vehiclesCard(state),
    contactsCard(state, contactsByKind),
  ].filter((c): c is SystemCard => c !== null);

  return { cards, netFavorMoney, contactsByKind };
}
