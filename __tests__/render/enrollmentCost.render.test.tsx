import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import EnrollModal from '@/components/education/EnrollModal';
import { createTestGameState } from '../helpers/createTestGameState';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { quoteEnrollment } from '@/contexts/game/actions/EducationActions';
import { formatMoney } from '@/utils/moneyFormatting';

const program = EDUCATION_PROGRAMS.find(p => p.id === 'business_degree')!;
const state = () => createTestGameState({ stats: { money: 60_000 }, educations: [], loans: [] });
function render(gameState = state()) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  const props = { visible: true, template: program, gameState, darkMode: true, onConfirm, onClose };
  act(() => { tree = TestRenderer.create(<EnrollModal {...props} />); });
  return { tree, props, onConfirm, onClose, text: () => JSON.stringify(tree.toJSON()) };
}

describe('enrollment cost decision', () => {
  it('shows the cash left after tuition before confirmation', () => {
    const s = render();
    expect(s.text()).toContain('Cash after tuition');
    expect(s.text()).toContain(formatMoney(12_000));
    expect(s.text()).toContain('Tuition is not refunded');
    act(() => s.tree.unmount());
  });
  it('reveals the actual payment, total cost and immediate repayment when choosing loan', () => {
    const s = render();
    act(() => s.tree.root.findByProps({ accessibilityLabel: 'Student loan' }).props.onPress());
    const q = quoteEnrollment(s.props.gameState, program).loan!;
    expect(s.text()).toContain(`~${formatMoney(q.weeklyPayment)}/wk`);
    expect(s.text()).toContain(`~${formatMoney(q.totalRepaid)}`);
    expect(s.text()).toContain('Payments start next game week');
    expect(s.text()).toContain('Pausing or withdrawing does not cancel the loan');
    act(() => s.tree.root.findByProps({ accessibilityLabel: 'Enroll with student loan' }).props.onPress());
    expect(s.onConfirm).toHaveBeenCalledWith('loan', expect.any(Array));
    act(() => s.tree.unmount());
  });
  it('allows a broke player to choose a loan, while cash confirmation is blocked', () => {
    const s = render(createTestGameState({ stats: { money: 0 }, educations: [] }));
    const cash = s.tree.root.findByProps({ accessibilityLabel: 'Pay cash' });
    expect(cash.props.accessibilityState.disabled).toBe(true);
    act(() => s.tree.root.findByProps({ accessibilityLabel: 'Enroll and pay $48K' }).props.onPress());
    expect(s.onConfirm).not.toHaveBeenCalled();
    act(() => s.tree.root.findByProps({ accessibilityLabel: 'Student loan' }).props.onPress());
    expect(s.tree.root.findByProps({ accessibilityLabel: 'Enroll with student loan' }).props.disabled).toBe(false);
    act(() => s.tree.unmount());
  });
  it('does not attribute policy/award assistance to GPA or offer unnecessary debt', () => {
    const s = render(createTestGameState({ educations: [], tuitionWaiverUSD: 48_000 }));
    expect(s.text()).toContain('Tuition fully covered by aid');
    expect(s.text()).not.toContain('your GPA earned');
    expect(s.tree.root.findByProps({ accessibilityLabel: 'Student loan' }).props.disabled).toBe(true);
    act(() => s.tree.unmount());
  });
  it('blocks a stale modal when the life ends and keeps Close available', () => {
    const s = render();
    act(() => s.tree.update(<EnrollModal {...s.props} gameState={{ ...s.props.gameState, showDeathPopup: true }} />));
    expect(s.text()).toContain('This life has ended.');
    act(() => s.tree.root.findByProps({ accessibilityLabel: 'Enroll and pay $48K' }).props.onPress());
    expect(s.onConfirm).not.toHaveBeenCalled();
    act(() => s.tree.root.findByProps({ accessibilityLabel: 'Close' }).props.onPress());
    expect(s.onClose).toHaveBeenCalledTimes(1);
    act(() => s.tree.unmount());
  });
});
