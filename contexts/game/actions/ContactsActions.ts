/**
 * ContactsActions — favor lifecycle + generic network reach-out.
 *
 * The contact ledger is system-agnostic; this file is the glue between the
 * pure `lib/contacts/favors.ts` helpers and React state updates.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState, Relationship } from '../types';
import {
  Favor,
  FavorLedger,
  addFavor as addFavorPure,
  emptyLedger,
  expireFavors as expireFavorsPure,
  redeemFavor as redeemFavorPure,
} from '@/lib/contacts/favors';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './MoneyActions';
import { resolveInteraction, addMemory } from '@/lib/social/npcDepth';
import { clampStatByKey } from '@/utils/statUtils';

const log = logger.scope('ContactsActions');

function ledgerOf(state: GameState): FavorLedger {
  return state.favorLedger ?? emptyLedger();
}

/**
 * Record a lightweight Contacts interaction (Call / Hang Out and friends) against
 * a relationship. This is the single source of truth for the recency signal —
 * it stamps `lastInteractionWeek` (so recency dots warm up and the Attention tab
 * clears) and bumps `weeklyInteractions` (the "This wk" fact chip), on top of the
 * relationship-score bump and optional money cost.
 *
 * Moved out of ContactsApp's inline `setGameState` so the UI never mutates state
 * directly (mechanics ground rule #3). The once-per-week gate, the affordability
 * check, the money leg, the score bump, the recency stamp and the action record
 * all happen inside ONE updater against `prev`, so a same-batch double-tap can't
 * charge or bump twice.
 */
export function recordInteraction(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  contactId: string,
  action: string,
  cost: number,
  bonus: number
): { success: boolean; message: string } {
  const rel = gameState.relationships?.find((r) => r.id === contactId);
  if (!rel) return { success: false, message: 'Contact not found.' };
  const ws = gameState.weeksLived ?? 0;
  // Pre-checks for immediate UI feedback; the authoritative re-check is inside
  // the updater below.
  if (rel.actions?.[action] === ws) {
    return { success: false, message: 'Already used this week.' };
  }
  if (cost > 0 && (gameState.stats?.money ?? 0) < cost) {
    return { success: false, message: `Need $${cost.toLocaleString()}.` };
  }

  // VARIED OUTCOME: the same action lands differently depending on the NPC's
  // mood, their memory of you, and whether it satisfies their current want.
  // Deterministic (seeded on weeksLived + id + action) so a reload can't re-roll
  // the result. With no depth fields present the delta collapses to `bonus`
  // (legacy flat behaviour) — the previewed message here matches what the
  // updater applies in the common (no concurrent change) case.
  const preview = resolveInteraction(rel, action, bonus, ws);

  let applied = false;
  setGameState((prev) => {
    const rels = prev.relationships ?? [];
    const idx = rels.findIndex((r) => r.id === contactId);
    if (idx === -1) return prev;
    const target = rels[idx];
    const prevWs = prev.weeksLived ?? 0;
    if (target.actions?.[action] === prevWs) return prev; // already used this week
    if (cost > 0 && (prev.stats?.money ?? 0) < cost) return prev; // can't afford

    // Reset the weekly counter when the last interaction was in an earlier week.
    const weeklyInteractions =
      target.lastInteractionWeek === prevWs ? (target.weeklyInteractions ?? 0) + 1 : 1;

    const outcome = resolveInteraction(target, action, bonus, prevWs);
    const updatedRel: Relationship = {
      ...target,
      relationshipScore: Math.max(0, Math.min(100, (target.relationshipScore ?? 0) + outcome.scoreDelta)),
      actions: { ...(target.actions ?? {}), [action]: prevWs },
      lastInteractionWeek: prevWs,
      weeklyInteractions,
      npcMood: outcome.npcMood ?? target.npcMood,
      // Only advance the want when this action satisfied it.
      npcWant: outcome.npcWant ?? target.npcWant,
      // Record a memory only for notable outcomes (satisfying a want).
      npcMemories: outcome.memory ? addMemory(target.npcMemories ?? [], outcome.memory) : target.npcMemories,
    };
    const newRels = [...rels];
    newRels[idx] = updatedRel;
    let next: GameState = { ...prev, relationships: newRels };
    if (cost > 0) {
      const paid = applyMoneyDelta(next, -cost, `${action} with ${target.name}`);
      if (!paid) return prev; // affordability failed inside the delta — abort
      next = { ...next, ...paid };
    }
    applied = true;
    return next;
  });

  if (!applied) return { success: false, message: 'Could not complete.' };
  return { success: true, message: preview.message };
}

/**
 * Record a new IOU between the player and a contact. Caller provides the
 * Favor sans `status` — we always create with status='open'.
 *
 * Idempotent by `favor.id`: a same-batch double-fire (or a producer that runs
 * again on re-render with a stable per-week id) can't append a duplicate favor
 * row. Callers should pass a stable id (e.g. `goodwill-<contactId>-<week>`).
 */
export function recordFavor(
  setGameState: Dispatch<SetStateAction<GameState>>,
  favor: Omit<Favor, 'status'>
): void {
  setGameState((prev) => {
    const ledger = ledgerOf(prev);
    if (ledger.favors.some((f) => f.id === favor.id)) return prev; // already recorded
    return { ...prev, favorLedger: addFavorPure(ledger, favor) } as GameState;
  });
  log.info(`Favor recorded: ${favor.id} (${favor.direction}, ${favor.kind}, value ${favor.value})`);
}

/**
 * Lend cash to a contact — the natural producer of an `owed-to-player` money
 * favor (the redeem side of the ledger, which otherwise had no producers so the
 * Redeem button never rendered). Debits the player now and books an IOU the
 * contact repays later via `redeemFavor` (which credits the cash back).
 *
 * Once per week per contact. The debit, the IOU, the small goodwill bump and the
 * recency stamp all happen in ONE updater against `prev`, so a same-batch
 * double-tap can neither double-charge nor mint two IOUs (stable per-week id).
 */
export function lendMoney(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  contactId: string,
  amount: number
): { success: boolean; message: string } {
  const rel = gameState.relationships?.find((r) => r.id === contactId);
  if (!rel) return { success: false, message: 'Contact not found.' };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Invalid amount.' };
  }
  const ws = gameState.weeksLived ?? 0;
  // Pre-checks for immediate UI feedback; the authoritative re-checks are inside
  // the updater below.
  if (rel.actions?.['lendmoney'] === ws) {
    return { success: false, message: `You already lent ${rel.name} money this week.` };
  }
  if ((gameState.stats?.money ?? 0) < amount) {
    return { success: false, message: `Need $${amount.toLocaleString()} to lend.` };
  }

  let applied = false;
  setGameState((prev) => {
    const rels = prev.relationships ?? [];
    const idx = rels.findIndex((r) => r.id === contactId);
    if (idx === -1) return prev;
    const target = rels[idx];
    const prevWs = prev.weeksLived ?? 0;
    if (target.actions?.['lendmoney'] === prevWs) return prev; // already lent this week

    // Debit the loan atomically; abort if it can no longer be afforded.
    const debit = applyMoneyDelta(prev, -amount, `Lent $${amount.toLocaleString()} to ${target.name}`);
    if (!debit) return prev;

    // Book the owed-to-player money IOU (stable id → same-batch double-tap safe).
    const favorId = `loan-${contactId}-${prevWs}`;
    const ledger = ledgerOf(prev);
    const nextLedger = ledger.favors.some((f) => f.id === favorId)
      ? ledger
      : addFavorPure(ledger, {
          id: favorId,
          contactId,
          direction: 'owed-to-player',
          kind: 'money',
          value: amount,
          createdWeek: prevWs,
          note: `${target.name} owes you $${amount.toLocaleString()}`,
        });

    // Lending builds goodwill — small bond bump + recency stamp (mirrors the
    // recency bookkeeping in recordInteraction / handleAskMoney).
    const weeklyInteractions =
      target.lastInteractionWeek === prevWs ? (target.weeklyInteractions ?? 0) + 1 : 1;
    const updatedRel: Relationship = {
      ...target,
      relationshipScore: Math.max(0, Math.min(100, (target.relationshipScore ?? 0) + 2)),
      actions: { ...(target.actions ?? {}), lendmoney: prevWs },
      lastInteractionWeek: prevWs,
      weeklyInteractions,
    };
    const newRels = [...rels];
    newRels[idx] = updatedRel;
    applied = true;
    return { ...prev, ...debit, relationships: newRels, favorLedger: nextLedger };
  });

  if (!applied) return { success: false, message: 'Could not complete.' };
  return { success: true, message: `You lent ${rel.name} $${amount.toLocaleString()}. They owe you one.` };
}

/**
 * Redeem (close) an open favor. If it's a money IOU owed-to-player,
 * also credit the cash. Money owed-by-player should be paid via the regular
 * money flow; this function only flips the ledger state and returns the favor.
 */
export function redeemFavor(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  favorId: string
): { success: boolean; message: string; favor?: Favor } {
  const ledger = ledgerOf(gameState);
  const target = ledger.favors.find((f) => f.id === favorId);
  if (!target) return { success: false, message: 'Favor not found' };
  if (target.status !== 'open') return { success: false, message: 'Favor already closed' };

  // H-8/H-9: fold the cash credit and the ledger flip into ONE updater that
  // re-checks the favor's status against `prev`. The previous code gated on the
  // stale `gameState`, credited money in one setGameState call, then flipped the
  // ledger in a separate call — so two rapid taps both passed the outer gate and
  // both paid out (a credit never overdraft-rejects) while the ledger closed
  // once: a same-batch double-credit money printer. Re-checking `prev` here makes
  // the second tap a no-op.
  let redeemed = false;
  setGameState((prev) => {
    const prevLedger = ledgerOf(prev);
    const fresh = prevLedger.favors.find((f) => f.id === favorId);
    if (!fresh || fresh.status !== 'open') return prev; // already redeemed this batch

    /**
     * Past its expiry counts as closed even if the tick has not stamped it yet.
     *
     * `expireFavors` runs in the weekly tick, so between the expiry week
     * arriving and the next tick a favour sits `open` with `expiresWeek` behind
     * it — and this path would happily pay it out. That gap only became
     * reachable when network favours introduced expiries the player can hold
     * for weeks. Refusing here makes the deadline mean the same thing whether
     * or not a tick has run.
     */
    /**
     * Redemption keeps the `?? 0` fallback ON PURPOSE, unlike creation above.
     *
     * The two directions fail differently. An absent week counter here means
     * the deadline cannot be evaluated — and the lenient reading ("nothing has
     * expired yet") pays out a favour the player genuinely earned, while the
     * strict reading denies it because of a field that has nothing to do with
     * the favour. Creation refuses because it WRITES the bad week; redemption
     * only reads it.
     *
     * A non-finite counter is a different matter and is rejected below: `NaN`
     * is corruption rather than absence, and `nowWeek >= NaN` is false, so it
     * would skip the gate rather than fail it.
     *
     * None of this is reachable through the save pipeline — `isValidGameState`
     * requires `typeof weeksLived === 'number'` and `repairGameState` forces a
     * non-finite one back to 0 — so this is the behaviour for state that never
     * went through it.
     */
    const nowWeek = prev.weeksLived ?? 0;
    if (fresh.expiresWeek !== undefined) {
      // A non-finite bound does not compare: `nowWeek >= NaN` is false, so a
      // corrupt `expiresWeek` would sail past the gate rather than trip it —
      // the deadline would silently stop existing on exactly the saves whose
      // data is least trustworthy. Refuse instead, matching how the money path
      // below treats an unusable `value`.
      if (
        typeof fresh.expiresWeek !== 'number' ||
        !isFinite(fresh.expiresWeek) ||
        !isFinite(nowWeek)
      ) {
        log.warn(`Cannot redeem favor with an unusable expiry`, {
          favorId,
          expiresWeek: fresh.expiresWeek,
          nowWeek,
        });
        return prev;
      }
      if (nowWeek >= fresh.expiresWeek) {
        log.info(`Favor ${favorId} is past its expiry (week ${fresh.expiresWeek})`);
        return prev;
      }
    }

    // Cash IOU owed-to-player → validate the amount BEFORE flipping. If the
    // value is invalid (NaN/Infinity/≤0), keep the favor open rather than
    // closing it without paying out — a redeemed-but-unpaid IOU is unrecoverable.
    if (fresh.kind === 'money' && fresh.direction === 'owed-to-player') {
      if (
        typeof fresh.value !== 'number' ||
        !isFinite(fresh.value) ||
        fresh.value <= 0
      ) {
        log.warn(`Cannot redeem invalid money favor`, { favorId, value: fresh.value });
        return prev;
      }
      const flipped = {
        ...prev,
        favorLedger: redeemFavorPure(prevLedger, favorId),
      } as GameState;
      const credit = applyMoneyDelta(
        flipped,
        fresh.value,
        `Favor redeemed from ${fresh.contactId}`
      );
      if (!credit) return prev; // credit rejected → leave the favor open
      redeemed = true;
      return { ...flipped, ...credit };
    }

    /**
     * Non-money favor → apply its EFFECT, then flip the ledger.
     *
     * This used to flip and nothing else, which meant `influence`, `discount`,
     * `safety` and `intro` were four favor kinds whose Redeem button changed a
     * label and no state. Nothing produced them at the time, so it was
     * invisible; `askNetworkFavor` (X-2) makes them reachable, and a reachable
     * no-op is a lie the player can see.
     *
     * `applyNonMoneyFavor` returns null when the effect would be a genuine
     * no-op — reputation already at the cap, no heat to clear, an intro already
     * made. The favor still closes: the contact HAS done the thing, and leaving
     * it open would let the player farm the same IOU until the state happened
     * to move.
     */
    const effect = resolveNonMoneyFavor(prev, fresh);
    // Refused → leave the favor OPEN. A no-op still closes it (see the type doc
    // on `FavorEffect`); a refusal means the player is still owed something.
    if (effect.outcome === 'rejected') {
      log.warn(`Favor payout refused, leaving it open`, { favorId, kind: fresh.kind });
      return prev;
    }
    const withEffect = effect.outcome === 'applied' ? effect.state : prev;
    redeemed = true;
    return {
      ...withEffect,
      favorLedger: redeemFavorPure(ledgerOf(withEffect), favorId),
    } as GameState;
  });
  if (!redeemed) {
    // The updater bailed (favor already closed this batch, or an invalid/rejected
    // amount) — don't report success on a no-op.
    return { success: false, message: 'Could not redeem this favor right now.', favor: target };
  }
  log.info(`Redeemed favor ${favorId}`);
  return { success: true, message: 'Favor redeemed', favor: target };
}

/**
 * Repay an owed-by-player money IOU. Debits the player's cash and flips the
 * favor to `redeemed`. A pure money sink — the borrowed cash was already granted
 * when the IOU was created, so repaying only returns money to zero-out the debt
 * (no printing).
 *
 * Same double-tap guard as `redeemFavor`: the debit + ledger flip happen in ONE
 * updater that re-checks the favor's status against `prev`, so two rapid taps
 * only debit once. `applyMoneyDelta`'s overdraft reject keeps an unaffordable
 * repay from ever closing the debt.
 */
export function repayFavor(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  favorId: string
): { success: boolean; message: string; favor?: Favor } {
  const ledger = ledgerOf(gameState);
  const target = ledger.favors.find((f) => f.id === favorId);
  if (!target) return { success: false, message: 'Favor not found' };
  if (target.status !== 'open') return { success: false, message: 'Favor already closed' };
  if (target.direction !== 'owed-by-player' || target.kind !== 'money') {
    return { success: false, message: 'Only cash debts you owe can be repaid.' };
  }
  if (typeof target.value !== 'number' || !isFinite(target.value) || target.value <= 0) {
    return { success: false, message: 'This debt has an invalid amount.' };
  }
  if ((gameState.stats?.money ?? 0) < target.value) {
    return { success: false, message: `Need $${target.value.toLocaleString()} to repay.` };
  }

  let paid = false;
  setGameState((prev) => {
    const prevLedger = ledgerOf(prev);
    const fresh = prevLedger.favors.find((f) => f.id === favorId);
    if (!fresh || fresh.status !== 'open') return prev; // already repaid this batch
    if (fresh.direction !== 'owed-by-player' || fresh.kind !== 'money') return prev;
    if (typeof fresh.value !== 'number' || !isFinite(fresh.value) || fresh.value <= 0) {
      return prev;
    }
    // Debit BEFORE flipping; if unaffordable, keep the debt open.
    const debit = applyMoneyDelta(prev, -fresh.value, `Repaid loan to ${fresh.contactId}`);
    if (!debit) return prev;
    paid = true;
    return {
      ...prev,
      ...debit,
      favorLedger: redeemFavorPure(prevLedger, favorId),
    } as GameState;
  });

  if (!paid) return { success: false, message: `Need $${target.value.toLocaleString()} to repay.` };
  log.info(`Repaid favor ${favorId} ($${target.value})`);
  return { success: true, message: 'Debt repaid.', favor: target };
}

/**
 * Mark every favor whose expiresWeek has passed as expired. Called from the
 * weekly tick.
 */
export function tickFavors(
  setGameState: Dispatch<SetStateAction<GameState>>,
  currentWeek: number
): void {
  setGameState((prev) => {
    const before = ledgerOf(prev);
    const after = expireFavorsPure(before, currentWeek);
    if (after === before) return prev;
    return { ...prev, favorLedger: after } as GameState;
  });
}

// ---------------------------------------------------------------------------
// X-2 — network contacts you can actually deal with
// ---------------------------------------------------------------------------

/**
 * PLAYER REPORT (BBQ, 2026-08-11): "Contacts are vendors which you can't
 * associate with (business, political)."
 *
 * He was right, and the gap was wider than the missing button. `favors.ts`
 * declares four non-money favor kinds — `influence`, `discount`, `safety`,
 * `intro` — explicitly for political and vendor contacts, and NOTHING in the
 * game produced any of them. `ContactsApp` only ever created `money` favors,
 * from personal contacts. So the network half of the Contacts app was a
 * read-only directory: hero, Overview, Tags, "Back to network".
 *
 * The button alone would not have fixed it. `redeemFavor` handles a non-money
 * favor by flipping the ledger entry and doing nothing else, so shipping an
 * "Ask a favor" action on its own would have produced a Redeem button that
 * changes a label and no state — the same "UI names an outcome the code does
 * not produce" defect this whole audit is about, freshly minted. So the ask and
 * the payoff land together.
 *
 * Everything here rides on state that already exists. No new field, no
 * migration: the cooldown IS the ledger (one open favor per contact), and each
 * payoff routes through a system already in the save.
 */

/** How long an unredeemed network favor stays callable. */
export const NETWORK_FAVOR_EXPIRY_WEEKS = 12;

/** Standing a network contact needs before they will owe you anything. */
export const NETWORK_FAVOR_MIN_STRENGTH = 40;

/** Reputation granted by an `influence` favor. */
export const INFLUENCE_FAVOR_REPUTATION = 6;

/** Dark-web heat cleared by a `safety` favor. */
export const SAFETY_FAVOR_HEAT_RELIEF = 20;

/**
 * What each kind of network contact can be asked for.
 *
 * Personal kinds (`family`, `partner`, `friend`) are absent on purpose — they
 * already have Call / Hang Out / lend, and `money` is their favor.
 */
export const FAVOR_KIND_BY_CONTACT: Record<string, Favor['kind']> = {
  lobbyist: 'influence',
  alliance: 'influence',
  vendor: 'discount',
  business: 'intro',
  employee: 'safety',
};

/**
 * One stable id per contact per week, so a double-tap cannot mint two.
 *
 * @param contactId - the aggregated contact's id
 * @param week - `weeksLived` at the moment of asking
 * @returns a deterministic favour id
 */
export const networkFavorId = (contactId: string, week: number): string =>
  `network-favor-${contactId}-${week}`;

/** The minimum a caller must know about a contact to ask it for a favour. */
export interface NetworkFavorContact {
  id: string;
  name: string;
  /** `ContactKind` from the aggregator — matched against FAVOR_KIND_BY_CONTACT. */
  kind: string;
  /** 0..100, derived per source system by `aggregateContacts`. */
  strength: number;
}

export interface AskFavorResult {
  success: boolean;
  message: string;
  favorId?: string;
}

/**
 * Ask a network contact to owe you one.
 *
 * Scarcity without a new save field: a contact can carry only ONE open favor at
 * a time, and it expires. "You cannot call in a second favor while the first is
 * outstanding" is both the natural rule and, conveniently, already recorded in
 * the ledger — so the cooldown needs nowhere to live.
 *
 * `strength` is passed in rather than read here because it is DERIVED per
 * source system (lobbyist retainer, vendor reputation, company headcount) and
 * has no single home on `GameState`; `aggregateContacts` is what knows it.
 */
export function askNetworkFavor(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  contact: NetworkFavorContact
): AskFavorResult {
  const kind = FAVOR_KIND_BY_CONTACT[contact.kind];
  if (!kind) {
    return { success: false, message: 'This contact is not part of your network.' };
  }
  if (!isFinite(contact.strength) || contact.strength < NETWORK_FAVOR_MIN_STRENGTH) {
    return {
      success: false,
      message: `${contact.name} does not know you well enough yet.`,
    };
  }

  // Snapshot pre-check, for immediate UI feedback only. The authoritative
  // version runs against `prev` inside the updater below.
  const ledger = ledgerOf(gameState);
  if (ledger.favors.some((f) => f.contactId === contact.id && f.status === 'open')) {
    return { success: false, message: `${contact.name} already owes you one.` };
  }

  // Pessimistic capture: the authoritative checks are re-run against `prev`
  // inside the updater, so a second tap in the same React batch reports the
  // refusal rather than a success it did not get (C-9).
  let outcome: AskFavorResult = { success: false, message: 'Could not ask right now.' };

  setGameState((prev) => {
    if (prev.showDeathPopup) return prev;
    const prevLedger = ledgerOf(prev);

    /**
     * REFUSE rather than fall back to week 0.
     *
     * Creation is the asymmetric half. `prevWeek` is written into three durable
     * places — the id, `createdWeek` and `expiresWeek` — so a `?? 0` fallback on
     * a save whose real week is 500 books a favour stamped week 0 that expires
     * at week 12, i.e. one that is already dead the moment the field is
     * repaired. Refusing the ask costs the player one tap; booking that favour
     * costs them the favour, silently and unrecoverably.
     *
     * Redemption deliberately does NOT mirror this — see the note there.
     */
    const prevWeek = prev.weeksLived;
    if (typeof prevWeek !== 'number' || !isFinite(prevWeek) || prevWeek < 0) {
      log.warn(`Cannot ask a favor without a usable week counter`, { weeksLived: prev.weeksLived });
      return prev;
    }
    // The id is derived from `prev`, NOT from the snapshot read above. It encodes
    // the week deliberately — that encoding is half the double-tap guard — so
    // building it from a stale snapshot would let a favor carry an id saying one
    // week while `createdWeek` and `expiresWeek` said the next, if a tick landed
    // between render and commit. Worse, the stale id could collide with a
    // already-closed favor from that earlier week and refuse a legitimate ask.
    const id = networkFavorId(contact.id, prevWeek);
    if (prevLedger.favors.some((f) => f.id === id)) return prev;
    if (prevLedger.favors.some((f) => f.contactId === contact.id && f.status === 'open')) {
      return prev;
    }
    const favor: Omit<Favor, 'status'> = {
      id,
      contactId: contact.id,
      direction: 'owed-to-player',
      kind,
      // Scales with standing, so a stronger contact is worth more to know.
      // Clamped to the 0..100 the `strength` field documents: every producer in
      // `lib/contacts/aggregator.ts` already clamps, but this function is
      // exported and a future caller has no such guarantee.
      value: Math.max(1, Math.min(100, Math.round(contact.strength))),
      createdWeek: prevWeek,
      expiresWeek: prevWeek + NETWORK_FAVOR_EXPIRY_WEEKS,
      note: `${contact.name} owes you a ${kind}`,
    };
    outcome = { success: true, message: `${contact.name} owes you a ${kind}.`, favorId: id };
    return { ...prev, favorLedger: addFavorPure(prevLedger, favor) } as GameState;
  });

  if (outcome.success) log.info(`Network favor asked: ${outcome.favorId} (${kind})`);
  return outcome;
}

/**
 * What a non-money favor's payoff did.
 *
 * THREE outcomes, not two. `applyNonMoneyFavor` originally answered with
 * `GameState | null`, and `null` had to mean both "the effect was a genuine
 * no-op" (reputation already at the cap, no heat to clear, an intro already
 * made) and "the payout was REFUSED". Those want opposite handling: a no-op
 * still closes the favor, because the contact has done the thing and leaving it
 * open would let the player farm the same IOU until the state moved — but a
 * refusal must leave it open, or the player loses the favor and gets nothing.
 *
 * Only the `discount` branch can refuse, and only via `applyMoneyDelta`. That
 * path is not reachable today: `favorPayout` returns a finite non-negative
 * number, and `applyMoneyDelta` refuses only a non-finite amount or an
 * overdrafting debit — at `MONEY_CEILING` it CLAMPS and succeeds. So this is a
 * latent conflation rather than a live bug. It is separated anyway, because
 * "safe only because a helper three calls away happens to never produce NaN" is
 * exactly the kind of coupling that stops being true without anyone noticing.
 */
export type FavorEffect =
  | { outcome: 'applied'; state: GameState }
  | { outcome: 'noop' }
  | { outcome: 'rejected' };

/**
 * The payoff for a non-money favor.
 *
 * Pure and exported so the redeem path and any preview read ONE definition —
 * the thing that keeps a button's promise and its result from drifting (the
 * lesson from the acquisition modal).
 *
 *   influence → reputation. A political ask cashed in as standing.
 *   safety    → dark-web heat relief. Protection, which is what `safety` means.
 *   discount  → the markdown, paid as cash. The vendor owed you a better price;
 *               you are collecting it after the fact.
 *   intro     → a new friend. An introduction that produces a person is the
 *               only honest reading, and relationship creation already exists
 *               (X-3's `promoteMatchToFriend` built the same shape).
 */
export function resolveNonMoneyFavor(prev: GameState, favor: Favor): FavorEffect {
  switch (favor.kind) {
    case 'influence': {
      const current = prev.stats?.reputation ?? 0;
      const next = clampStatByKey('reputation', current + INFLUENCE_FAVOR_REPUTATION);
      if (next === current) return { outcome: 'noop' };
      return { outcome: 'applied', state: { ...prev, stats: { ...prev.stats, reputation: next } } };
    }
    case 'safety': {
      const dw = prev.darkWeb;
      if (!dw) return { outcome: 'noop' };
      const heat = typeof dw.heat === 'number' && isFinite(dw.heat) ? dw.heat : 0;
      const next = Math.max(0, heat - SAFETY_FAVOR_HEAT_RELIEF);
      if (next === heat) return { outcome: 'noop' };
      return { outcome: 'applied', state: { ...prev, darkWeb: { ...dw, heat: next } } };
    }
    case 'discount': {
      // Routed through applyMoneyDelta so it respects MONEY_CEILING and lands
      // in dailySummary like every other credit.
      const payout = favorPayout(favor);
      // A malformed stored value prices at 0 — nothing is owed, so the favor is
      // spent rather than refused. Refusing would leave an unredeemable entry
      // open on the board forever.
      if (payout <= 0) return { outcome: 'noop' };
      const credit = applyMoneyDelta(prev, payout, `Vendor discount from ${favor.contactId}`);
      // Refused, NOT a no-op: the player is owed this money, so the favor stays
      // open for another attempt.
      if (!credit) return { outcome: 'rejected' };
      return { outcome: 'applied', state: { ...prev, ...credit } };
    }
    case 'intro': {
      const id = `intro-${favor.contactId}-${favor.createdWeek}`;
      if ((prev.relationships ?? []).some((r) => r.id === id)) return { outcome: 'noop' };
      /**
       * A COMPLETE record. The first cut supplied four fields and reached for
       * `as Relationship` to silence the rest — but `personality`, `gender` and
       * `age` are required, and this object is persisted into `relationships`
       * where the weekly health pass, the Contacts app and the family tree all
       * read it. A cast that makes a partial record compile does not make the
       * consumers safe; it just moves the failure to whoever reads it first.
       *
       * The traits are derived from the favour rather than rolled, so the same
       * introduction is the same person on every load — `Math.random()` here
       * would re-roll them on a reload.
       */
      const seed = hashString(`${favor.contactId}:${favor.createdWeek}`);
      const introduced: Relationship = {
        id,
        name: introNameFor(favor),
        type: 'friend',
        // Same starting score as a Spark-promoted friend: known, not close, and
        // comfortably clear of the neglect threshold.
        relationshipScore: 45,
        personality: INTRO_PERSONALITIES[seed % INTRO_PERSONALITIES.length],
        gender: seed % 2 === 0 ? 'male' : 'female',
        // A professional introduction is a working adult, not a classmate.
        age: 28 + (seed % 22),
      };
      return { outcome: 'applied', state: { ...prev, relationships: [...(prev.relationships ?? []), introduced] } };
    }
    default:
      return { outcome: 'noop' };
  }
}

/**
 * The state delta alone, or `null` for anything that did not apply.
 *
 * Fine for a PREVIEW, which only needs to know whether a payoff would land. The
 * redeem path calls `resolveNonMoneyFavor` directly, because it is the one
 * caller that has to tell a refusal from a no-op.
 */
export function applyNonMoneyFavor(prev: GameState, favor: Favor): GameState | null {
  const effect = resolveNonMoneyFavor(prev, favor);
  return effect.outcome === 'applied' ? effect.state : null;
}

/** Personalities an introduced contact can have. Indexed deterministically. */
const INTRO_PERSONALITIES = ['ambitious', 'friendly', 'analytical', 'charming', 'reserved'] as const;

/** Stable non-cryptographic hash, so an introduction is the same person on every load. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Cash a `discount` favor is worth — its value, validated. */
function favorPayout(favor: Favor): number {
  const v = Number(favor.value);
  if (!isFinite(v) || v <= 0) return 0;
  // The stored value is standing (1..100); a discount is worth real money, so
  // scale it into a sum that reads as a markdown rather than pocket change.
  return Math.round(Math.min(100, v) * 250);
}

/** A name for someone introduced through the network. */
function introNameFor(favor: Favor): string {
  const from = favor.note?.replace(/ owes you a .*$/, '') ?? 'A contact';
  return `${from}'s associate`;
}
