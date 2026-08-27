import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import AlertHost from '@/components/ui/AlertHost';
import { gameAlert } from '@/utils/gameAlert';

/**
 * An alert button's handler must not run until the alert's own Modal has gone.
 *
 * PR #170 nested an AlertHost INSIDE the death screen and the gem shop so their
 * dialogs would present at all on iOS. That made a new hazard reachable: those
 * dialogs' handlers are exactly the ones that tear down the Modal HOSTING them
 * ("Erase and start over" clears showDeathPopup; the shop's receipt closes the
 * sheet). Running the handler in the same commit as the alert's own teardown
 * unmounts a presenting view controller while its presented child is still
 * dismissing, and iOS strands a transparent full-screen presentation that
 * swallows every touch - the app freezes with the previous screen visible.
 * Reported from TestFlight after buying the Revival Pack.
 *
 * These cases pin the defer-and-settle that fixes it, and the two ways it must
 * NOT lose the player's choice.
 */
const pressButton = (renderer: any, label: string) => {
  const node = renderer.root
    .findAll((n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function')
    .pop();
  if (!node) throw new Error(`no pressable labelled "${label}" in the tree`);
  act(() => {
    node.props.onPress();
  });
};

describe('AlertHost defers a button handler until its Modal has dismissed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('does NOT run the handler in the same commit as the dismissal', () => {
    const onPress = jest.fn();
    const { renderer, unmount } = renderWithProviders(<AlertHost />);

    act(() => {
      gameAlert('Start a completely new life?', 'This erases your dynasty.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase and start over', style: 'destructive', onPress },
      ]);
    });

    pressButton(renderer, 'Erase and start over');
    // The teardown is in flight; running now is what froze the app.
    expect(onPress).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('runs it exactly once, not once per settle signal', () => {
    const onPress = jest.fn();
    const { renderer, unmount } = renderWithProviders(<AlertHost />);
    act(() => {
      gameAlert('Confirm Purchase', 'Buy the Revival Pack?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Buy', onPress },
      ]);
    });

    pressButton(renderer, 'Buy');
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('runs it IMMEDIATELY when another alert is queued behind it', () => {
    // With a second alert waiting, the Modal stays presented and simply swaps
    // content - nothing dismisses, so `onDismiss` would never arrive and a
    // deferred action would be lost.
    const onPress = jest.fn();
    const { renderer, unmount } = renderWithProviders(<AlertHost />);
    act(() => {
      gameAlert('First', 'one', [{ text: 'Go', onPress }]);
      gameAlert('Second', 'two', [{ text: 'OK' }]);
    });

    pressButton(renderer, 'Go');
    expect(onPress).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('still runs a pending handler if the host is unmounted first', () => {
    // A choice must never be silently dropped - that is the same "button did
    // nothing" failure this change exists to remove.
    const onPress = jest.fn();
    const { renderer, unmount } = renderWithProviders(<AlertHost />);
    act(() => {
      gameAlert('Rewind Time', 'Spend gems?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rewind', onPress },
      ]);
    });

    pressButton(renderer, 'Rewind');
    expect(onPress).not.toHaveBeenCalled();
    unmount();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a plain acknowledgement with no handler still closes the alert', () => {
    const { renderer, unmount } = renderWithProviders(<AlertHost />);
    act(() => {
      gameAlert('Purchase Successful!', 'Your items have been added.');
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Purchase Successful!');

    pressButton(renderer, 'OK');
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(JSON.stringify(renderer.toJSON() ?? '')).not.toContain('Purchase Successful!');
    unmount();
  });
});
