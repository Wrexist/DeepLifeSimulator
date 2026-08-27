/**
 * The gameAlert host STACK - the mechanism behind nested AlertHosts.
 *
 * iOS presents an RN Modal from the view controller nearest its mount point,
 * so the root AlertHost's dialog is silently refused while another full-screen
 * Modal (death screen, gem shop) is presented. Those surfaces mount their own
 * AlertHost INSIDE their Modal; it must take the alerts while mounted and hand
 * back to the root host when it unmounts - including out-of-order unmounts
 * (the death Modal suppresses itself, and its nested host, mid store-bridge).
 *
 * This suite pins that dispatch order. A regression here re-creates the dead
 * "Start New Life" button: the confirm dialog goes to a host that cannot
 * present, and the tap looks like it did nothing.
 */
import { Alert } from 'react-native';
import { gameAlert, hasAlertHandler, registerAlertHandler } from '@/utils/gameAlert';

describe('gameAlert host stack', () => {
  beforeEach(() => {
    (Alert.alert as jest.Mock).mockClear();
  });

  it('dispatches to the most recently registered host (the nested one)', () => {
    const root = jest.fn();
    const nested = jest.fn();
    const unregisterRoot = registerAlertHandler(root);
    const unregisterNested = registerAlertHandler(nested);

    gameAlert('Start a completely new life?', 'This is a fresh start.');

    expect(nested).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    unregisterNested();
    unregisterRoot();
  });

  it('falls back to the previous host when the top host unregisters', () => {
    const root = jest.fn();
    const nested = jest.fn();
    const unregisterRoot = registerAlertHandler(root);
    const unregisterNested = registerAlertHandler(nested);

    unregisterNested();
    gameAlert('Rewind Time');

    expect(root).toHaveBeenCalledTimes(1);
    expect(nested).not.toHaveBeenCalled();

    unregisterRoot();
  });

  it('removes by identity, so hosts can unmount out of order', () => {
    const root = jest.fn();
    const nested = jest.fn();
    const unregisterRoot = registerAlertHandler(root);
    const unregisterNested = registerAlertHandler(nested);

    // Root goes first (unmount order is not guaranteed); nested must still win.
    unregisterRoot();
    gameAlert('No Heir Selected');

    expect(nested).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveBeenCalled();

    unregisterNested();
  });

  it('unregistering twice is harmless and cannot evict another host', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unregisterFirst = registerAlertHandler(first);
    unregisterFirst();
    const unregisterSecond = registerAlertHandler(second);
    // A stale double-unregister must not remove the newly registered host.
    unregisterFirst();

    gameAlert('Confirm Purchase');
    expect(second).toHaveBeenCalledTimes(1);

    unregisterSecond();
  });

  it('with no host mounted, never swallows the decision - native dialog', () => {
    expect(hasAlertHandler()).toBe(false);

    gameAlert('Error', 'Something went wrong.');

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Error');
    expect(message).toBe('Something went wrong.');
    expect(buttons).toEqual([expect.objectContaining({ text: 'OK' })]);
  });

  it('each request carries a unique id (the queue key)', () => {
    const seen: number[] = [];
    const unregister = registerAlertHandler((request) => seen.push(request.id));

    gameAlert('One');
    gameAlert('Two');

    expect(new Set(seen).size).toBe(2);
    unregister();
  });
});
