/**
 * Network contacts you can actually deal with — and a Redeem that does something.
 *
 * PLAYER REPORT (BBQ, 2026-08-11, X-2): "Contacts are vendors which you can't
 * associate with (business, political)."
 *
 * Two halves, and the second is the one that matters:
 *
 *   1. `renderNetworkDetail` offered a hero, an Overview block, Tags and a
 *      "Back to network" button. No action of any kind, while the Attention
 *      triage card openly split the population — personal contacts got "Call to
 *      reconnect · +3 bond", everything else got "View profile".
 *
 *   2. `favors.ts` declares `influence`, `discount`, `safety` and `intro`
 *      explicitly for these contacts, and NOTHING produced them — while
 *      `redeemFavor` handled a non-money favor by flipping the ledger entry and
 *      doing nothing else. So adding an "Ask" button alone would have shipped a
 *      Redeem button that changes a label and no state: a brand-new instance of
 *      the exact "UI states an outcome the code does not produce" defect this
 *      audit exists to remove.
 *
 * Hence the redemption-effect tests below carry the weight. An "ask" that books
 * a row is easy; a favor that pays out is the feature.
 */
import { createTestGameState, type TestGameStateOverrides } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import {
  askNetworkFavor,
  redeemFavor,
  applyNonMoneyFavor,
  resolveNonMoneyFavor,
  FAVOR_KIND_BY_CONTACT,
  NETWORK_FAVOR_MIN_STRENGTH,
  NETWORK_FAVOR_EXPIRY_WEEKS,
  INFLUENCE_FAVOR_REPUTATION,
  SAFETY_FAVOR_HEAT_RELIEF,
} from '@/contexts/game/actions/ContactsActions';
import { openFavors } from '@/lib/contacts/favors';
import type { Favor } from '@/lib/contacts/favors';
import type { GameState } from '@/contexts/game/types';

function requireSlice<T>(slice: T | undefined, name: string): T {
  if (!slice) throw new Error(`initialGameState ships no ${name} slice - fixture cannot be built`);
  return slice;
}

const BASE_DARK_WEB = requireSlice(initialGameState.darkWeb, 'darkWeb');

const LOBBYIST = { id: 'lob-1', name: 'Dana Reyes', kind: 'lobbyist', strength: 70 };

function base(over: TestGameStateOverrides = {}): GameState {
  return createTestGameState({
    weeksLived: 100,
    stats: { money: 10_000, reputation: 50 },
    favorLedger: { favors: [] },
    ...over,
  });
}

const favorOf = (kind: Favor['kind'], over: Partial<Favor> = {}): Favor => ({
  id: `f-${kind}`,
  contactId: 'lob-1',
  direction: 'owed-to-player',
  kind,
  value: 70,
  createdWeek: 100,
  status: 'open',
  note: 'Dana Reyes owes you a ' + kind,
  ...over,
});

describe('a network contact can be asked for a favour', () => {
  it('books an open favour of the kind that contact deals in', () => {
    const stub = createSetGameStateStub(base());
    const r = askNetworkFavor(base(), stub.setGameState, LOBBYIST);

    expect(r.success).toBe(true);
    const open = openFavors(stub.current().favorLedger!);
    expect(open).toHaveLength(1);
    expect(open[0].kind).toBe('influence');
    expect(open[0].direction).toBe('owed-to-player');
    expect(open[0].expiresWeek).toBe(100 + NETWORK_FAVOR_EXPIRY_WEEKS);
  });

  it('every network contact kind maps to a favour kind (no dead category)', () => {
    // The whole complaint was that some categories had nothing to do. A kind
    // in the aggregator with no entry here is that bug returning.
    for (const kind of ['lobbyist', 'alliance', 'vendor', 'business', 'employee']) {
      expect(`${kind}: ${FAVOR_KIND_BY_CONTACT[kind] ?? 'MISSING'}`).not.toContain('MISSING');
    }
  });

  it('and every declared favour kind has a producer (the other direction)', () => {
    // `influence` / `discount` / `safety` / `intro` were declared for these
    // contacts and created by nothing. Both directions must hold or one of them
    // is scaffolding again.
    const produced = new Set(Object.values(FAVOR_KIND_BY_CONTACT));
    for (const kind of ['influence', 'discount', 'safety', 'intro'] as const) {
      expect(`${kind} produced: ${produced.has(kind)}`).toBe(`${kind} produced: true`);
    }
  });

  it('refuses a contact who barely knows you', () => {
    const stub = createSetGameStateStub(base());
    const r = askNetworkFavor(base(), stub.setGameState, {
      ...LOBBYIST,
      strength: NETWORK_FAVOR_MIN_STRENGTH - 1,
    });

    expect(r.success).toBe(false);
    expect(openFavors(stub.current().favorLedger!)).toHaveLength(0);
  });

  it('refuses a personal contact - they have Call and lend instead', () => {
    const stub = createSetGameStateStub(base());
    const r = askNetworkFavor(base(), stub.setGameState, { ...LOBBYIST, kind: 'friend' });

    expect(r.success).toBe(false);
    expect(openFavors(stub.current().favorLedger!)).toHaveLength(0);
  });

  it('one open favour per contact - the cooldown IS the ledger', () => {
    // No new save field: "you cannot call in a second favour while the first is
    // outstanding" is both the natural rule and already recorded.
    const start = base();
    const stub = createSetGameStateStub(start);
    askNetworkFavor(start, stub.setGameState, LOBBYIST);

    const after = stub.current();
    const second = askNetworkFavor(after, stub.setGameState, LOBBYIST);

    expect(second.success).toBe(false);
    expect(openFavors(stub.current().favorLedger!)).toHaveLength(1);
  });

  it('a same-batch double-tap cannot mint two', () => {
    // Both calls read the SAME stale snapshot - the updater must re-check prev.
    const start = base();
    const stub = createSetGameStateStub(start);
    askNetworkFavor(start, stub.setGameState, LOBBYIST);
    askNetworkFavor(start, stub.setGameState, LOBBYIST);

    expect(stub.current().favorLedger!.favors).toHaveLength(1);
  });
});

describe('redeeming a non-money favour actually does something', () => {
  it('influence pays reputation', () => {
    const start = base({ favorLedger: { favors: [favorOf('influence')] } });
    const stub = createSetGameStateStub(start);
    const r = redeemFavor(start, stub.setGameState, 'f-influence');

    expect(r.success).toBe(true);
    expect(stub.current().stats.reputation).toBe(50 + INFLUENCE_FAVOR_REPUTATION);
  });

  it('safety clears dark-web heat', () => {
    const start = base({
      darkWeb: { ...BASE_DARK_WEB, heat: 60, cleanBtc: 0, dirtyBtc: 0 },
      favorLedger: { favors: [favorOf('safety')] },
    });
    const stub = createSetGameStateStub(start);
    redeemFavor(start, stub.setGameState, 'f-safety');

    expect(stub.current().darkWeb!.heat).toBe(60 - SAFETY_FAVOR_HEAT_RELIEF);
  });

  it('discount pays the markdown as cash', () => {
    const start = base({ favorLedger: { favors: [favorOf('discount')] } });
    const stub = createSetGameStateStub(start);
    redeemFavor(start, stub.setGameState, 'f-discount');

    expect(stub.current().stats.money).toBeGreaterThan(10_000);
  });

  it('intro produces an actual person', () => {
    const start = base({ favorLedger: { favors: [favorOf('intro')] } });
    const stub = createSetGameStateStub(start);
    redeemFavor(start, stub.setGameState, 'f-intro');

    const friends = (stub.current().relationships ?? []).filter((r) => r.type === 'friend');
    expect(friends).toHaveLength(1);
    expect(friends[0].relationshipScore).toBeGreaterThan(25); // not born "at risk"
  });

  it('the favour closes either way, so it cannot be farmed', () => {
    // Reputation already at the ceiling → the effect is a genuine no-op, but the
    // contact HAS done the thing. Leaving it open would let the player re-redeem
    // the same IOU until the state happened to move.
    const start = base({
      stats: { money: 10_000, reputation: 100 },
      favorLedger: { favors: [favorOf('influence')] },
    });
    const stub = createSetGameStateStub(start);
    redeemFavor(start, stub.setGameState, 'f-influence');

    expect(openFavors(stub.current().favorLedger!)).toHaveLength(0);
  });

  it('refuses a favour that is past its expiry, even if the tick has not stamped it', () => {
    /**
     * `expireFavors` runs in the weekly tick, so between the expiry week
     * arriving and the next tick a favour sits `open` with `expiresWeek` behind
     * it. Without this guard the payout still landed - a deadline that only
     * binds if a tick happened to run is not a deadline. Only reachable at all
     * because network favours introduced expiries the player holds for weeks.
     */
    const start = base({
      weeksLived: 200, // well past the favour's expiry
      favorLedger: { favors: [favorOf('influence', { expiresWeek: 112 })] },
    });
    const stub = createSetGameStateStub(start);
    const r = redeemFavor(start, stub.setGameState, 'f-influence');

    expect(r.success).toBe(false);
    expect(stub.current().stats.reputation).toBe(50); // no payout
    expect(openFavors(stub.current().favorLedger!)).toHaveLength(1); // still open, not consumed
  });

  it('a favour still inside its window redeems normally (the control)', () => {
    const start = base({
      weeksLived: 105,
      favorLedger: { favors: [favorOf('influence', { expiresWeek: 112 })] },
    });
    const stub = createSetGameStateStub(start);

    expect(redeemFavor(start, stub.setGameState, 'f-influence').success).toBe(true);
    expect(stub.current().stats.reputation).toBe(50 + INFLUENCE_FAVOR_REPUTATION);
  });

  it('an introduced contact is a COMPLETE relationship, not a partial cast', () => {
    // `personality`, `gender` and `age` are required by the contract and were
    // omitted behind an `as Relationship`. This record is persisted and read by
    // the weekly health pass, Contacts and the family tree.
    const start = base({ favorLedger: { favors: [favorOf('intro')] } });
    const stub = createSetGameStateStub(start);
    redeemFavor(start, stub.setGameState, 'f-intro');

    const made = (stub.current().relationships ?? []).find((r) => r.id.startsWith('intro-'));
    expect(made).toBeDefined();
    for (const field of ['personality', 'gender', 'age'] as const) {
      expect(`${field}: ${made?.[field] !== undefined}`).toBe(`${field}: true`);
    }
    expect(['male', 'female']).toContain(made!.gender);
    expect(made!.age).toBeGreaterThan(17);
  });

  it('the same introduction is the same person on every load', () => {
    // Derived from the favour, not rolled - `Math.random()` here would give the
    // player a different friend each time the state was rebuilt.
    const once = applyNonMoneyFavor(base(), favorOf('intro'));
    const twice = applyNonMoneyFavor(base(), favorOf('intro'));
    const a = (once?.relationships ?? []).at(-1);
    const b = (twice?.relationships ?? []).at(-1);

    expect(a).toEqual(b);
  });

  it('a double-tap redeem pays once', () => {
    const start = base({ favorLedger: { favors: [favorOf('influence')] } });
    const stub = createSetGameStateStub(start);
    redeemFavor(start, stub.setGameState, 'f-influence');
    redeemFavor(start, stub.setGameState, 'f-influence'); // same stale snapshot

    expect(stub.current().stats.reputation).toBe(50 + INFLUENCE_FAVOR_REPUTATION);
  });
});

describe('the payoff degrades instead of throwing', () => {
  it('safety on a save with no dark web is a no-op, not a crash', () => {
    expect(applyNonMoneyFavor(base({ darkWeb: undefined }), favorOf('safety'))).toBeNull();
  });

  it('a malformed value cannot mint money through discount', () => {
    for (const bad of [NaN, Infinity, -50, 0]) {
      const next = applyNonMoneyFavor(base(), favorOf('discount', { value: bad as number }));
      const money = next?.stats?.money ?? 10_000;
      expect(`${String(bad)} → money ${money}`).toBe(`${String(bad)} → money 10000`);
    }
  });

  it('the same intro cannot be made twice', () => {
    const once = applyNonMoneyFavor(base(), favorOf('intro'));
    expect(once).not.toBeNull();
    expect(applyNonMoneyFavor(once!, favorOf('intro'))).toBeNull();
  });
});

describe('review round: a refusal is not a no-op', () => {
  /**
   * `applyNonMoneyFavor` used to answer `GameState | null`, and `null` had to
   * mean both "the effect was a genuine no-op" and "the payout was REFUSED".
   * Those want opposite handling: a no-op still closes the favour, a refusal
   * must leave it open or the player loses the IOU and gets nothing.
   *
   * Not reachable today - `favorPayout` cannot produce a non-finite number and
   * `applyMoneyDelta` CLAMPS at `MONEY_CEILING` rather than refusing - so this
   * pins the distinction rather than a live bug.
   */
  it('a no-op reports noop, not rejected', () => {
    const capped = base({ stats: { money: 10_000, reputation: 100 } });
    expect(resolveNonMoneyFavor(capped, favorOf('influence')).outcome).toBe('noop');
  });

  it('a real payoff reports applied', () => {
    expect(resolveNonMoneyFavor(base(), favorOf('influence')).outcome).toBe('applied');
  });

  it('a discount worth nothing is a no-op - the favour is spent, not stuck', () => {
    // Refusing here would leave an unredeemable entry open on the board forever.
    for (const bad of [NaN, Infinity, -50, 0]) {
      const r = resolveNonMoneyFavor(base(), favorOf('discount', { value: bad as number }));
      expect(`${String(bad)} → ${r.outcome}`).toBe(`${String(bad)} → noop`);
    }
  });

  it('the money ceiling CLAMPS rather than refusing, so it is not a refusal', () => {
    // Worth pinning because the reviewed claim was the opposite. If
    // `applyMoneyDelta` ever starts refusing at the ceiling, the discount favour
    // must start staying open - and this test is what will say so.
    const rich = base({ stats: { money: Number.MAX_SAFE_INTEGER, reputation: 50 } });
    expect(resolveNonMoneyFavor(rich, favorOf('discount')).outcome).not.toBe('rejected');
  });
});

describe('review round: the expiry gate cannot be walked past', () => {
  it('a non-finite expiry refuses instead of sailing through', () => {
    // `nowWeek >= NaN` is false, so a corrupt bound would silently mean "no
    // deadline" on exactly the saves whose data is least trustworthy.
    for (const bad of [NaN, Infinity, -Infinity]) {
      const start = base({
        favorLedger: { favors: [favorOf('influence', { expiresWeek: bad as number })] },
      });
      const stub = createSetGameStateStub(start);
      const r = redeemFavor(start, stub.setGameState, 'f-influence');

      expect(`${String(bad)} → success ${r.success}`).toBe(`${String(bad)} → success false`);
      expect(`${String(bad)} → still open ${openFavors(stub.current().favorLedger!).length}`)
        .toBe(`${String(bad)} → still open 1`);
    }
  });

  it('a finite expiry in the future still redeems (the control)', () => {
    const start = base({
      weeksLived: 105,
      favorLedger: { favors: [favorOf('influence', { expiresWeek: 112 })] },
    });
    const stub = createSetGameStateStub(start);
    expect(redeemFavor(start, stub.setGameState, 'f-influence').success).toBe(true);
  });
});

describe('review round: the favour id comes from the committed week', () => {
  it('the STORED id agrees with the createdWeek it is stored beside', () => {
    /**
     * The id ENCODES the week - that encoding is half the double-tap guard - so
     * building it from the stale snapshot could store an id naming one week next
     * to a `createdWeek` naming the next, if a tick landed between render and
     * commit. It could also collide with a closed favour from that earlier week
     * and refuse a legitimate ask.
     *
     * That property is about what is WRITTEN, and it still holds: the commit
     * runs against `prev`, so both the id and `createdWeek` come from week 101.
     *
     * The RETURNED `favorId` is a different question, and this test used to
     * conflate them. It was satisfied by a `let outcome` assigned inside the
     * updater and read after - a capture, which is only readable for the FIRST
     * functional update of a React batch, and which reported "Could not ask
     * right now." for favours it had booked whenever it was not (2026-08-15).
     *
     * With the outcome derived from the caller's snapshot, the reported id is
     * the snapshot's. It can only differ in exactly this scenario - a tick
     * landing between render and commit - and no caller reads it (`ContactsApp`
     * uses `success` and `message` only). Reporting a snapshot-derived id is
     * honest about what is knowable synchronously; promising the committed one
     * was not.
     */
    const snapshot = base({ weeksLived: 100 });
    const stub = createSetGameStateStub(base({ weeksLived: 101 })); // a tick landed
    const r = askNetworkFavor(snapshot, stub.setGameState, LOBBYIST);

    expect(r.success).toBe(true);
    const [booked] = openFavors(stub.current().favorLedger!);
    expect(booked.createdWeek).toBe(101);
    expect(booked.id).toContain('101');
  });

  it('and with no tick in between, the reported id IS the stored one', () => {
    // The ordinary case, which is every tap that is not racing a week boundary.
    const snapshot = base({ weeksLived: 100 });
    const stub = createSetGameStateStub(base({ weeksLived: 100 }));
    const r = askNetworkFavor(snapshot, stub.setGameState, LOBBYIST);

    expect(r.success).toBe(true);
    const [booked] = openFavors(stub.current().favorLedger!);
    expect(r.favorId).toBe(booked.id);
  });

  it('caps the stored value at the documented 0..100 standing', () => {
    // Every producer in the aggregator clamps, but this function is exported and
    // a future caller carries no such guarantee.
    const stub = createSetGameStateStub(base());
    askNetworkFavor(base(), stub.setGameState, { ...LOBBYIST, strength: 5_000 });

    expect(openFavors(stub.current().favorLedger!)[0].value).toBe(100);
  });
});

describe('review round: an unusable week counter refuses the ASK but not the REDEEM', () => {
  /**
   * The two directions fail differently, so they are guarded differently.
   *
   * Creation writes `prevWeek` into three durable places - the id,
   * `createdWeek` and `expiresWeek` - so a `?? 0` fallback on a save whose real
   * week is 500 books a favour stamped week 0 that expires at week 12: already
   * dead the moment the field is repaired. Redemption only READS the counter,
   * and refusing there would deny a legitimately earned payout because of a
   * field with nothing to do with the favour.
   *
   * Neither is reachable through the save pipeline (`isValidGameState` requires
   * a numeric `weeksLived`), so these pin the intent for state that bypassed it.
   */
  // No cast: `weeksLived` is optional on the override type, so both the absent
  // and the NaN case go through the factory like any other fixture. An
  // `as GameState` here would be the drift Hard Rule #3 exists to stop - and
  // the weekly audit flags it, which is how the first draft of this block got
  // caught.
  const noWeek = (over: TestGameStateOverrides = {}): GameState =>
    base({ ...over, weeksLived: undefined });

  it('refuses to BOOK a favour it cannot date', () => {
    const start = noWeek();
    const stub = createSetGameStateStub(start);
    const r = askNetworkFavor(start, stub.setGameState, LOBBYIST);

    expect(r.success).toBe(false);
    expect(openFavors(stub.current().favorLedger ?? { favors: [] })).toHaveLength(0);
  });

  it('and refuses a NaN counter too', () => {
    const start = base({ weeksLived: NaN });
    const stub = createSetGameStateStub(start);

    expect(askNetworkFavor(start, stub.setGameState, LOBBYIST).success).toBe(false);
  });

  it('but still PAYS a favour already earned', () => {
    // The lenient direction, deliberately: the contact owes this and the
    // deadline simply cannot be evaluated.
    const start = noWeek({ favorLedger: { favors: [favorOf('influence', { expiresWeek: 112 })] } });
    const stub = createSetGameStateStub(start);

    expect(redeemFavor(start, stub.setGameState, 'f-influence').success).toBe(true);
    expect(stub.current().stats.reputation).toBe(50 + INFLUENCE_FAVOR_REPUTATION);
  });
});
