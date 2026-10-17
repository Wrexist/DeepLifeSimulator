/**
 * Favor / IOU ledger — pure helpers for tracking obligations between the
 * player and their contacts.
 *
 * Currently each system tracks its own special-case loans/debts:
 *   - DatingActions has loans-from-partner
 *   - PoliticsActions has lobbyist contracts
 *   - DarkWeb has vendor credit
 *
 * Favors generalise the idea: "X owes Y a thing of value V." The Contacts
 * remake surfaces these so the player has one place to call them in.
 *
 * Pure functions.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type FavorKind =
  | 'money'      // cash IOU
  | 'influence'  // political ask (vote, intro)
  | 'discount'   // vendor promised a future markdown
  | 'safety'    // protection / cover-up
  | 'intro';    // introduction to a third party

export type FavorDirection = 'owed-to-player' | 'owed-by-player';

export interface Favor {
  id: string;
  contactId: string;
  direction: FavorDirection;
  kind: FavorKind;
  /** Quantitative value of the favor (USD for money, abstract 1..100 for non-monetary). */
  value: number;
  /** When the favor was created (weeksLived). */
  createdWeek: number;
  /** Optional expiry (favors decay if not used). */
  expiresWeek?: number;
  /** Optional one-line note. */
  note?: string;
  status: 'open' | 'redeemed' | 'expired';
}

export interface FavorLedger {
  favors: Favor[];
}

export function emptyLedger(): FavorLedger {
  return { favors: [] };
}

/**
 * Add a favor. Returns a new ledger; safe to use with setGameState.
 */
export function addFavor(ledger: FavorLedger, favor: Omit<Favor, 'status'>): FavorLedger {
  return { favors: [...ledger.favors, { ...favor, status: 'open' }] };
}

/**
 * Redeem an open favor. No-op (but returns new ledger) if id doesn't exist or is closed.
 */
export function redeemFavor(ledger: FavorLedger, favorId: string): FavorLedger {
  return {
    favors: ledger.favors.map((f) =>
      f.id === favorId && f.status === 'open' ? { ...f, status: 'redeemed' } : f
    ),
  };
}

/**
 * Apply expiry — any open favor whose expiresWeek has passed becomes expired.
 */
export function expireFavors(ledger: FavorLedger, currentWeek: number): FavorLedger {
  // A present-but-partial ledger (CloudSync merge / hand-edit / interrupted
  // migration) can arrive with `favors` missing or non-array — `.map` on that
  // throws, and this runs unwrapped in the weekly tick, so a throw would abort
  // the whole `nextWeek` updater and soft-lock "Next Week". Return a *valid*
  // empty ledger (not the malformed input): the tick writes this back to state,
  // so it heals the shape — every downstream consumer (ContactsApp render,
  // ContactsActions, stats) then reads a well-formed `favors` array instead of
  // crashing on `.filter`/`.some`/`.map`. (Codex review, PR #63.)
  if (!ledger || !Array.isArray(ledger.favors)) return emptyLedger();
  let changed = false;
  const next = ledger.favors.map((f) => {
    if (f.status !== 'open') return f;
    if (f.expiresWeek !== undefined && currentWeek >= f.expiresWeek) {
      changed = true;
      return { ...f, status: 'expired' as const };
    }
    return f;
  });
  return changed ? { favors: next } : ledger;
}

/**
 * Filter to currently-open favors.
 */
export function openFavors(ledger: FavorLedger): Favor[] {
  return ledger.favors.filter((f) => f.status === 'open');
}

/**
 * Sum money values by direction. Helpful for header readouts.
 */
export function netMoneyPosition(ledger: FavorLedger): {
  owedToPlayer: number;
  owedByPlayer: number;
  net: number;
} {
  let toPlayer = 0;
  let byPlayer = 0;
  for (const f of ledger.favors) {
    if (f.status !== 'open' || f.kind !== 'money') continue;
    if (f.direction === 'owed-to-player') toPlayer += safe(f.value, 0);
    else byPlayer += safe(f.value, 0);
  }
  return { owedToPlayer: toPlayer, owedByPlayer: byPlayer, net: toPlayer - byPlayer };
}

/**
 * Count open favors involving a specific contact.
 */
export function favorsForContact(ledger: FavorLedger, contactId: string): Favor[] {
  return ledger.favors.filter((f) => f.contactId === contactId && f.status === 'open');
}

// ---------------------------------------------------------------------------
// Cash IOUs with personal contacts - terms
// ---------------------------------------------------------------------------
//
// Two exploits shared one cause: a cash IOU had no TERM.
//
//  - Lending: `lendMoney` booked "Sam owes you $100" with a +2 bond bump, and
//    Redeem paid it straight back the same week. Lend + redeem every week took a
//    parent's bond 50 -> 70 in ten weeks for $0.
//  - Borrowing: "Ask to borrow" paid $25 + 1.5 x bond (guaranteed after five
//    refusals) and booked a debt with no due date that nothing ever read - free
//    money from relationships, which CLAUDE.md §4.7 says they must never be.
//
// Both terms are DERIVED from `createdWeek`, which every IOU already carries, so
// no save field is added and every IOU already on disk gets the same terms.

/** Weeks a contact holds cash you lent them before they can pay it back. */
export const LENT_CASH_TERM_WEEKS = 4;

/** Weeks you have to pay back cash you borrowed from a contact. */
export const BORROWED_CASH_TERM_WEEKS = 8;

/** Bond a lender loses when they have to collect a debt that went past due. */
export const OVERDUE_DEBT_BOND_HIT = 15;

/** A cash IOU a contact owes the player (produced by lending). */
export const isCashOwedToPlayer = (f: Favor): boolean =>
  f.kind === 'money' && f.direction === 'owed-to-player';

/** A cash IOU the player owes a contact (produced by borrowing). */
export const isCashOwedByPlayer = (f: Favor): boolean =>
  f.kind === 'money' && f.direction === 'owed-by-player';

/** First week (`weeksLived`) a contact can pay back cash you lent them. */
export function cashLoanRepayableWeek(f: Pick<Favor, 'createdWeek'>): number {
  return safe(f.createdWeek, 0) + LENT_CASH_TERM_WEEKS;
}

/** Week (`weeksLived`) borrowed cash falls due. Overdue from this week on. */
export function cashDebtDueWeek(f: Pick<Favor, 'createdWeek'>): number {
  return safe(f.createdWeek, 0) + BORROWED_CASH_TERM_WEEKS;
}

/** True once an open borrowed-cash debt has reached its due week. */
export function isOverdueCashDebt(f: Favor, currentWeek: number): boolean {
  return f.status === 'open' && isCashOwedByPlayer(f) && safe(currentWeek, 0) >= cashDebtDueWeek(f);
}

/** The open cash debt the player owes `contactId`, if any. One at a time. */
export function openCashDebtTo(ledger: FavorLedger, contactId: string): Favor | undefined {
  return (ledger?.favors ?? []).find((f) => f.contactId === contactId && f.status === 'open' && isCashOwedByPlayer(f));
}

/** The open cash loan `contactId` owes the player, if any. One at a time. */
export function openCashLoanTo(ledger: FavorLedger, contactId: string): Favor | undefined {
  return (ledger?.favors ?? []).find((f) => f.contactId === contactId && f.status === 'open' && isCashOwedToPlayer(f));
}

/** One overdue debt as it was settled. */
export interface DebtCollection {
  favorId: string;
  contactId: string;
  /** The debt's face value. */
  owed: number;
  /** Taken from the player's cash. */
  paidFromCash: number;
  /** What cash could not cover - booked as overdue bills (`overdueBalance`). */
  toArrears: number;
}

export interface DebtCollectionPlan {
  /** The ledger with every overdue debt closed. Same reference when nothing was due. */
  ledger: FavorLedger;
  collections: DebtCollection[];
  cashCollected: number;
  toArrears: number;
}

/**
 * Settle every borrowed-cash debt that has reached its due week. PURE.
 *
 * The lender takes what `cash` covers; the rest becomes overdue bills, which
 * the weekly arrears pass collects first out of income and the canonical net
 * worth already counts as a liability. Nothing is forgiven: a debt that cannot
 * be paid moves to the bucket built for debts that cannot be paid, it does not
 * vanish. Each debt is closed, so settling twice collects once.
 *
 * Returns money and arrears as NUMBERS and leaves applying them to the caller,
 * so the same plan can be folded into an action's updater or the weekly tick's
 * locals without either having to agree on a state shape.
 */
export function planOverdueDebtCollection(
  ledger: FavorLedger | undefined,
  currentWeek: number,
  cash: number,
): DebtCollectionPlan {
  const empty: DebtCollectionPlan = {
    ledger: ledger && Array.isArray(ledger.favors) ? ledger : emptyLedger(),
    collections: [],
    cashCollected: 0,
    toArrears: 0,
  };
  if (!ledger || !Array.isArray(ledger.favors) || !isFinite(currentWeek)) return empty;
  if (!ledger.favors.some((f) => isOverdueCashDebt(f, currentWeek))) return empty;

  let cashLeft = Math.max(0, safe(cash, 0));
  const collections: DebtCollection[] = [];
  const favors = ledger.favors.map((f) => {
    if (!isOverdueCashDebt(f, currentWeek)) return f;
    // A corrupt amount is owed as nothing - close it rather than leave an
    // unsettleable debt blocking the ledger forever.
    const owed = Math.max(0, Math.round(safe(f.value, 0)));
    const paidFromCash = Math.min(cashLeft, owed);
    cashLeft -= paidFromCash;
    collections.push({ favorId: f.id, contactId: f.contactId, owed, paidFromCash, toArrears: owed - paidFromCash });
    return {
      ...f,
      status: 'redeemed' as const,
      note: `${f.note ?? 'Borrowed cash'} - collected after it fell due`,
    };
  });
  return {
    ledger: { favors },
    collections,
    cashCollected: collections.reduce((s, c) => s + c.paidFromCash, 0),
    toArrears: collections.reduce((s, c) => s + c.toArrears, 0),
  };
}
