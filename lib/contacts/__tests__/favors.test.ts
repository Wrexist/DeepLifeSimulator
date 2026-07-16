import {
  addFavor,
  emptyLedger,
  expireFavors,
  favorsForContact,
  netMoneyPosition,
  openFavors,
  redeemFavor,
} from '../favors';

describe('favors ledger', () => {
  it('emptyLedger has zero favors', () => {
    expect(emptyLedger().favors).toEqual([]);
  });

  it('addFavor appends with open status', () => {
    const l = addFavor(emptyLedger(), {
      id: 'f1',
      contactId: 'c1',
      direction: 'owed-to-player',
      kind: 'money',
      value: 500,
      createdWeek: 10,
    });
    expect(l.favors.length).toBe(1);
    expect(l.favors[0].status).toBe('open');
  });

  it('redeemFavor flips status to redeemed', () => {
    let l = addFavor(emptyLedger(), {
      id: 'f1', contactId: 'c1', direction: 'owed-by-player', kind: 'influence', value: 50, createdWeek: 5,
    });
    l = redeemFavor(l, 'f1');
    expect(l.favors[0].status).toBe('redeemed');
  });

  it('redeemFavor is a no-op for unknown ids', () => {
    const l = addFavor(emptyLedger(), {
      id: 'f1', contactId: 'c1', direction: 'owed-by-player', kind: 'money', value: 100, createdWeek: 1,
    });
    expect(redeemFavor(l, 'nope').favors[0].status).toBe('open');
  });

  // Regression (weekly-audit 2026-07-16): expireFavors runs in the weekly tick.
  // A present-but-partial ledger (CloudSync merge / hand-edit / interrupted
  // migration) with a missing/non-array `favors` used to throw inside `.map`,
  // and — being called unwrapped in the nextWeek updater — that soft-locked
  // "Next Week" permanently. It must now normalise to a VALID empty ledger (not
  // return the malformed input), so the tick heals the shape and downstream
  // consumers (ContactsApp `.filter`/`.some`) don't crash. (Codex review, PR #63.)
  it('expireFavors heals a partial ledger with no favors array into a valid ledger', () => {
    const partial = {} as any; // e.g. `{ }` merged from a stale cloud save
    expect(() => expireFavors(partial, 10)).not.toThrow();
    expect(expireFavors(partial, 10)).toEqual({ favors: [] });
    expect(Array.isArray(expireFavors(partial, 10).favors)).toBe(true);

    const nullFavors = { favors: null } as any;
    expect(() => expireFavors(nullFavors, 10)).not.toThrow();
    expect(expireFavors(nullFavors, 10)).toEqual({ favors: [] });
  });

  it('expireFavors flags past expiresWeek entries', () => {
    let l = addFavor(emptyLedger(), {
      id: 'f1', contactId: 'c1', direction: 'owed-to-player', kind: 'discount', value: 20, createdWeek: 1, expiresWeek: 5,
    });
    l = addFavor(l, {
      id: 'f2', contactId: 'c1', direction: 'owed-to-player', kind: 'discount', value: 30, createdWeek: 1, expiresWeek: 100,
    });
    const after = expireFavors(l, 10);
    expect(after.favors.find((f) => f.id === 'f1')?.status).toBe('expired');
    expect(after.favors.find((f) => f.id === 'f2')?.status).toBe('open');
  });

  it('openFavors filters to status open', () => {
    let l = addFavor(emptyLedger(), { id: 'f1', contactId: 'c', direction: 'owed-to-player', kind: 'money', value: 100, createdWeek: 1 });
    l = addFavor(l, { id: 'f2', contactId: 'c', direction: 'owed-to-player', kind: 'money', value: 200, createdWeek: 1 });
    l = redeemFavor(l, 'f1');
    expect(openFavors(l).length).toBe(1);
    expect(openFavors(l)[0].id).toBe('f2');
  });

  it('netMoneyPosition sums correctly', () => {
    let l = addFavor(emptyLedger(), { id: 'f1', contactId: 'c1', direction: 'owed-to-player', kind: 'money', value: 1000, createdWeek: 1 });
    l = addFavor(l, { id: 'f2', contactId: 'c2', direction: 'owed-by-player', kind: 'money', value: 300, createdWeek: 1 });
    l = addFavor(l, { id: 'f3', contactId: 'c3', direction: 'owed-to-player', kind: 'influence', value: 50, createdWeek: 1 });
    const pos = netMoneyPosition(l);
    expect(pos.owedToPlayer).toBe(1000);
    expect(pos.owedByPlayer).toBe(300);
    expect(pos.net).toBe(700);
  });

  it('favorsForContact only returns open for that contact', () => {
    let l = addFavor(emptyLedger(), { id: 'f1', contactId: 'alice', direction: 'owed-to-player', kind: 'money', value: 100, createdWeek: 1 });
    l = addFavor(l, { id: 'f2', contactId: 'bob', direction: 'owed-to-player', kind: 'money', value: 200, createdWeek: 1 });
    l = addFavor(l, { id: 'f3', contactId: 'alice', direction: 'owed-by-player', kind: 'safety', value: 70, createdWeek: 1 });
    l = redeemFavor(l, 'f1');
    const forAlice = favorsForContact(l, 'alice');
    expect(forAlice.length).toBe(1);
    expect(forAlice[0].id).toBe('f3');
  });
});
