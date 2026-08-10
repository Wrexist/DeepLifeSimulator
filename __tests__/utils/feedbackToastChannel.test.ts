/**
 * The feedback channel must be REACHABLE, not merely present.
 *
 * `feedbackSystem.{success,error,warning,info}(message)` used to call
 * `showAchievementToast(message, category, 0)`. That helper gates on
 * `reward > 0` — deliberately, so tips and warnings can't hijack the branded
 * "ACHIEVEMENT UNLOCKED!" popup — and the reward was hard-coded 0 at all four
 * call sites. So every message handed to `useFeedback()` was silently dropped:
 * the phone buzzed, nothing rendered, and a refused action looked exactly like
 * a successful one.
 *
 * This is the failure mode `tasks/lessons.md` records twice ("is it called?" is
 * a different question from "does it work?"): the leaf helpers were all fine in
 * isolation. Only the wiring was wrong, and nothing asserted the wiring.
 *
 * These tests assert the ROUTE, not the rendering.
 */

import fs from 'fs';
import path from 'path';
import { setToastHandler, showGlobalToast, hasToastHandler } from '@/utils/toastBridge';
import { FeedbackSystem } from '@/utils/feedbackSystem';
import * as feedbackModule from '@/utils/feedbackSystem';

describe('toastBridge', () => {
  afterEach(() => setToastHandler(null));

  it('drops calls when no provider is mounted instead of throwing', () => {
    setToastHandler(null);
    expect(hasToastHandler()).toBe(false);
    expect(() => showGlobalToast('nobody is listening')).not.toThrow();
  });

  it('forwards message and severity to the registered handler', () => {
    const handler = jest.fn();
    setToastHandler(handler);

    showGlobalToast('Need $12 to grab a healthy meal', 'warning');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe('Need $12 to grab a healthy meal');
    expect(handler.mock.calls[0][1]).toBe('warning');
  });

  it('drops blank messages so an undefined result?.message never renders an empty pill', () => {
    const handler = jest.fn();
    setToastHandler(handler);

    showGlobalToast('');
    showGlobalToast('   ');

    expect(handler).not.toHaveBeenCalled();
  });

  it('clears the handler on unregister so a torn-down provider is not retained', () => {
    const handler = jest.fn();
    setToastHandler(handler);
    setToastHandler(null);

    showGlobalToast('after teardown');

    expect(handler).not.toHaveBeenCalled();
    expect(hasToastHandler()).toBe(false);
  });
});

describe('feedbackSystem routes messages to the toast channel', () => {
  // NB: no jest.resetModules() here. The bridge holds its handler in module
  // scope, so resetting the registry would hand feedbackSystem a *different*
  // toastBridge instance than the one this file registered on — and the test
  // would fail for a reason that has nothing to do with the wiring under test.
  afterEach(() => setToastHandler(null));

  // Each of the four helpers must reach the toast channel. Parameterised so a
  // new helper added without wiring fails here rather than shipping mute.
  const cases: ['success' | 'error' | 'warning' | 'info', string][] = [
    ['success', 'You rest up — +14 energy'],
    ['error', 'Something went wrong'],
    ['warning', 'Already done that this week'],
    ['info', 'Market opens Monday'],
  ];

  it.each(cases)('%s() forwards its message to the bridge', (method, message) => {
    const handler = jest.fn();
    setToastHandler(handler);

    // The singleton is reached via getInstance() — there is no exported
    // `feedbackSystem` const; `useFeedback()` builds its facade from this.
    (FeedbackSystem.getInstance() as any)[method](message);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe(message);
    expect(handler.mock.calls[0][1]).toBe(method);
  });

  it('sends nothing when called with no message', () => {
    const handler = jest.fn();
    setToastHandler(handler);

    expect(() => FeedbackSystem.getInstance().success()).not.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT route generic feedback through the achievement popup', () => {
    // The regression guard. `showAchievementToast` is reserved for real
    // achievements (reward > 0); routing generic feedback back through it is
    // what made this channel mute in the first place. Matches a CALL or an
    // IMPORT, so the explanatory comment naming the helper doesn't trip it.
    const source = fs.readFileSync(
      path.join(__dirname, '../../utils/feedbackSystem.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/showAchievementToast\s*\(/);
    expect(source).not.toMatch(/import[^;]*showAchievementToast/);
  });

  it('exports no second useToast that would shadow the real channel', () => {
    // A local-state `useToast` used to live in this file with the same name as
    // the context hook and zero importers — a trap pointing at a dead channel.
    expect((feedbackModule as Record<string, unknown>).useToast).toBeUndefined();
  });
});
