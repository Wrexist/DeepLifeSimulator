import { addWorker, removeWorker } from '@/contexts/game/company';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';
import { businessState } from '../helpers/businessFixture';
import { launchIPO, quoteIPO, hireCandidate, acceptAcquisition } from '@/contexts/game/actions/HustleActions';
import { MONEY_CEILING } from '@/lib/economy/moneyDelta';

function capture() {
  let apply!: (s: GameState) => GameState;
  const set: Dispatch<SetStateAction<GameState>> = update => { if (typeof update === 'function') apply = update; };
  return { set, run: (s: GameState) => apply(s) };
}
it.each([NaN, Infinity, -10, 0, 9, 41, 100])('rejects invalid IPO float %s without dispatch', value => {
  const set = jest.fn();
  expect(launchIPO(set, businessState(), 'factory', value).success).toBe(false);
  expect(set).not.toHaveBeenCalled();
});
it.each(['sold', 'revenue', 'scandal', 'public', 'ceiling'] as const)('IPO rejects a fresh %s state without losing ownership or granting cash', race => {
  const snapshot = businessState(); const c = capture();
  expect(launchIPO(c.set, snapshot, 'factory', 25).success).toBe(true);
  const fresh = businessState();
  if (race === 'sold') fresh.companies = [];
  if (race === 'revenue') fresh.companies![0].weeklyIncome = 9999;
  if (race === 'scandal') fresh.hustleApp!.companies.factory.activeScandal = { id: 's', kind: 'pr_disaster', severity: 50, startedWeek: 104, weeksRemaining: 4, headline: 'Scandal', revenueDragPercent: 10 } as NonNullable<GameState['hustleApp']>['companies'][string]['activeScandal'];
  if (race === 'public') fresh.hustleApp!.companies.factory.ipo.status = 'public';
  if (race === 'ceiling') fresh.stats.money = MONEY_CEILING;
  expect(c.run(fresh)).toBe(fresh);
});
it('IPO uses the latest eligible valuation and lists once without mutating the prior state', () => {
  const snapshot = businessState(); const c = capture(); launchIPO(c.set, snapshot, 'factory', 25);
  const fresh = businessState(); fresh.companies![0].weeklyIncome = 40000; fresh.weeksLived = 105;
  const before = JSON.stringify(fresh); const quote = quoteIPO(fresh, 'factory', 25); const next = c.run(fresh);
  expect(next.stats.money).toBe(fresh.stats.money + quote.cashRaised);
  expect(next.hustleApp!.companies.factory.ipo).toMatchObject({ status: 'public', sharePrice: quote.sharePrice, ownershipPercent: 75, listedWeek: 105 });
  expect(JSON.stringify(fresh)).toBe(before);
  expect(c.run(next)).toBe(next);
});
it.each([[NaN, 0], [Infinity, 0], [0, 0], [-1, 0], [1000, NaN], [1000, -1]])('rejects invalid salary/bonus %s/%s', (salary, bonus) => {
  const set = jest.fn(); expect(hireCandidate(set, businessState(), 'factory', 'candidate', salary, bonus).success).toBe(false); expect(set).not.toHaveBeenCalled();
});
it('preserves cents and cannot hire into a sold company', () => {
  const s = businessState(); const c = capture(); hireCandidate(c.set, s, 'factory', 'candidate', 2000.75, 100.25);
  const next = c.run(s); expect(next.stats.money).toBe(999899.75); expect(next.hustleApp!.companies.factory.hiringPipeline.namedHires[0].salary).toBe(2000.75);
  const sold = { ...s, companies: [] }; expect(c.run(sold)).toBe(sold);
});
it.each([-1, NaN, Infinity, 0])('rejects invalid acquisition price %s', price => {
  const s = businessState(); s.hustleApp!.companies.factory.pendingAcquisitions[0].askingPrice = price;
  const set = jest.fn(); expect(acceptAcquisition(set, s, 'factory', 'offer').success).toBe(false); expect(set).not.toHaveBeenCalled();
});
it('acquisition charges its latest pending quote once and rejects missing companies', () => {
  const snapshot = businessState(); const c = capture(); acceptAcquisition(c.set, snapshot, 'factory', 'offer');
  const fresh = businessState(); fresh.hustleApp!.companies.factory.pendingAcquisitions[0].askingPrice = 300000;
  const next = c.run(fresh); expect(next.stats.money).toBe(700000); expect(next.companies![0].baseWeeklyIncome).toBe(21000); expect(c.run(next)).toBe(next);
  const sold = { ...fresh, companies: [] }; expect(c.run(sold)).toBe(sold);
});

it.each([addWorker, removeWorker])('staff actions find the latest company by id and reject a sold company', action => {
  const snapshot = businessState(); snapshot.companies![0].employees = 2;
  const c = capture(); action(snapshot, c.set, 'factory');
  const other = { ...snapshot.companies![0], id: 'other', employees: 4 };
  const reordered = { ...snapshot, companies: [other, snapshot.companies![0]] };
  const next = c.run(reordered);
  expect(next.companies![0]).toBe(other);
  expect(next.companies![1].employees).toBe(action === addWorker ? 3 : 1);
  const sold = { ...snapshot, companies: [other] };
  expect(c.run(sold)).toBe(sold);
});
it('generic removal cannot remove named hires or bypass severance', () => {
  const s = businessState(); s.companies![0].employees = 1;
  s.hustleApp!.companies.factory.hiringPipeline.namedHires = [{ candidateId: 'hired', hiredWeek: 104, role: 'engineer', salary: 2000, morale: 80, performance: 80 }];
  const c = capture(); removeWorker(s, c.set, 'factory'); expect(c.run(s)).toBe(s);
  const withGeneric = { ...s, companies: [{ ...s.companies![0], employees: 2 }] };
  const next = c.run(withGeneric); expect(next.companies![0].employees).toBe(1); expect(next.hustleApp).toBe(s.hustleApp); expect(c.run(next)).toBe(next);
});
