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
