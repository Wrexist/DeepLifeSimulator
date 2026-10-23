import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import ConfirmDialog from '@/components/ConfirmDialog';

// useReducedMotion reads AccessibilityInfo, which the jest react-native mock
// omits — stub it (as CureSuccessModal stubs useGame/useFeedback) so the render
// exercises the real dialog instead of a provider crash screen.
jest.mock('@/hooks/useReducedMotion', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  default: () => false,
}));

/**
 * Render smoke test for the redesigned purchase/confirm popup. It reads the
 * theme via useGameState, so it must mount inside the real provider tree.
 * Proves the visible card surfaces the title, the (money-formatted) message and
 * both actions, that the destructive/danger variant still renders, and that a
 * hidden dialog mounts without throwing.
 */
describe('render - ConfirmDialog', () => {
  it('mounts (visible) and shows the title, message, and both actions', () => {
    const { renderer, json, unmount } = renderWithProviders(
      <ConfirmDialog
        visible
        title="Purchase Laptop?"
        message="This will cost $1,200. You'll have $100M remaining."
        confirmText="Purchase"
        cancelText="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(renderer.toJSON()).not.toBeNull();
    expect(json).toContain('Purchase Laptop?');
    expect(json).toContain("You'll have $100M remaining");
    expect(json).toContain('Purchase');
    expect(json).toContain('Cancel');
    unmount();
  });

  it('mounts the destructive/danger variant without throwing', () => {
    const { json, unmount } = renderWithProviders(
      <ConfirmDialog
        visible
        type="danger"
        destructive
        title="Delete Save Slot?"
        message="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(json).toContain('Delete Save Slot?');
    expect(json).toContain('Delete');
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <ConfirmDialog
        visible={false}
        title="Hidden"
        message="Nothing to see."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    unmount();
  });

  it('answers a double tap in one batch once, and re-arms for a later tap', () => {
    // A cloud restore or a slot delete must not run twice because both taps
    // landed before `visible={false}` committed (CLAUDE.md 4.4).
    jest.useFakeTimers();
    const onConfirm = jest.fn();
    const { renderer, unmount } = renderWithProviders(
      <ConfirmDialog
        visible
        title="Restore From Cloud?"
        message="This replaces the game."
        confirmText="Restore"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    const press = () => renderer.root
      .findAll((n: any) => n.props?.accessibilityLabel === 'Restore' && typeof n.props?.onPress === 'function')
      .pop()
      .props.onPress();
    act(() => {
      press();
      press();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      press();
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    unmount();
    jest.useRealTimers();
  });
});
