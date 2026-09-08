import React from 'react';
import IdentityCard from '@/components/IdentityCard';
import { Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { LUXURY_CATALOG } from '@/lib/luxury/catalog';
import { getTotalLuxuryUpkeep } from '@/lib/luxury/operations';
import { paidWeeklyCareerSalary } from '@/lib/careers/weeklySalary';
import { formatMoney } from '@/utils/moneyFormatting';

let mockState: GameState;
jest.mock('@/contexts/game/useGameSelector', () => ({
  useGameSelector: (selector: (s: GameState) => unknown) => selector(mockState),
  shallowEqual: jest.fn(),
}));
jest.mock('@/components/avatar/CharacterAvatar', () => () => null);

function render(initial = createTestGameState({ educations: [], loans: [], realEstate: [] })) {
  mockState = initial;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<IdentityCard />); });
  const details = tree.root.findByProps({ accessibilityLabel: 'Details' });
  if (!details.props.accessibilityState.expanded) act(() => details.props.onPress());
  const cashButton = tree.root.findAllByType(TouchableOpacity).find(node =>
    node.findAllByType(Text).some(t => t.children.some(c => typeof c === 'string' && /cash flow/i.test(c)))
  );
  if (!cashButton) throw new Error('Cash-flow entry not reachable');
  act(() => cashButton.props.onPress());
  const text = () => {
    const walk = (node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | string | null): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(walk).join('');
      return node?.children?.map(walk).join('') ?? '';
    };
    return walk(tree.toJSON());
  };
  return { text, update: (s: GameState) => { mockState = s; act(() => tree.update(<IdentityCard onOpenPrestigeShop={() => {}} />)); }, close: () => act(() => tree.unmount()) };
}

describe('cash flow receives and refreshes its real state inputs', () => {
  it('shows a newly added luxury upkeep even if no other property changes', () => {
    const initial = createTestGameState({ luxuryItems: [] });
    const s = render(initial);
    const ids = [LUXURY_CATALOG[0].id];
    s.update({ ...initial, luxuryItems: ids });
    expect(s.text()).toContain(`Luxury Upkeep: ${formatMoney(getTotalLuxuryUpkeep(ids))}`);
    s.close();
  });
  it('includes the rented home in the cash-flow bill', () => {
    const s = render(createTestGameState({ rental: { tierId: 'shared-room', startedWeek: 0 }, realEstate: [] }));
    expect(s.text()).toContain('Rent:');
    s.close();
  });
  it('recomputes subscription charges at prepaid expiry without replacing the subscription', () => {
    const initial = createTestGameState({ weeksLived: 198 });
    initial.socialMedia = { ...initial.socialMedia!, verifiedPro: { active: true, weeklyPrice: 250, plan: 'annual', paidThroughWeek: 200, perksUnlocked: { blueCheckmark: true, postBoostMultiplier: 1.25, analyticsUnlocked: true, noAdsInFeed: true, longerPosts: true } } };
    const s = render(initial);
    expect(s.text()).not.toContain('Subscriptions: $250');
    s.update({ ...initial, weeksLived: 199 });
    expect(s.text()).toContain('Subscriptions: $250');
    s.close();
  });
  it('refreshes diet costs when a plan is activated', () => {
    const initial = createTestGameState();
    const s = render(initial);
    s.update({ ...initial, dietPlans: initial.dietPlans.map((p, i) => ({ ...p, active: i === 0 })) });
    expect(s.text()).toContain(`Diet Plan: ${formatMoney(initial.dietPlans[0].dailyCost * 7)}`);
    s.close();
  });
  it('reports distinct balances and APRs for loans that share the same name', () => {
    const base = { name: 'Student Loan', type: 'personal' as const, principal: 1000, rateAPR: 0.06, termWeeks: 52, weeksRemaining: 52, weeklyPayment: 100, autoPay: true, startWeek: 0 };
    const s = render(createTestGameState({ loans: [
      { ...base, id: 'first', remaining: 5, interestRate: 0.06 },
      { ...base, id: 'second', remaining: 50, interestRate: 12 },
    ] }));
    expect(s.text()).toContain('Student Loan: $5/week');
    expect(s.text()).toContain('Remaining balance: $50');
    expect(s.text()).toContain('Interest rate: 6.00% APR');
    expect(s.text()).toContain('Interest rate: 12.00% APR');
    s.close();
  });
  it('includes the frozen pension and refreshes it on retirement', () => {
    const initial = createTestGameState({ isRetired: false });
    const s = render(initial);
    expect(s.text()).not.toContain('Retirement Pension:');
    s.update({ ...initial, isRetired: true, pensionWeekly: 500 });
    expect(s.text()).toContain('Retirement Pension: $500');
    s.close();
  });

  it('uses the paid work boost and withholds payroll while jailed', () => {
    const initial = createTestGameState();
    const job = initial.careers.find(c => c.id !== 'political' && c.levels[0]?.salary > 0)!;
    expect(job).toBeDefined();
    initial.currentJob = job.id;
    initial.careers = [{ ...job, accepted: true, level: 0 }];
    const s = render(initial);
    const boosted = { ...initial, goldUpgrades: { ...initial.goldUpgrades, work_boost: true } };
    expect(paidWeeklyCareerSalary(boosted).total).toBeGreaterThan(paidWeeklyCareerSalary(initial).total);
    s.update(boosted);
    expect(s.text()).toContain(`Job Income: ${formatMoney(paidWeeklyCareerSalary(boosted).total)}`);
    s.update({ ...boosted, jailWeeks: 3 });
    expect(s.text()).toContain('Job Income: $0');
    s.close();
  });

});
