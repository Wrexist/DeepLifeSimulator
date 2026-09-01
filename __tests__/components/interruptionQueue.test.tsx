/**
 * One queue, one winner.
 *
 * Before `InterruptionContext`, four independent popup chains could not see each
 * other, and a single "Next Week" press could stack up to seven concurrent
 * surfaces — three of them RN Modals with independent backdrops — in an order
 * nobody had defined. These tests pin the two properties that make the queue
 * worth having: exactly one surface shows, and it is the one the player most
 * needs to deal with.
 */

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import {
  InterruptionProvider,
  useInterruptionSlot,
  INTERRUPTION_PRIORITY,
  MAX_INTERRUPTIONS_PER_WEEK,
  type InterruptionSlotOptions,
} from '@/contexts/InterruptionContext';
import { GameStoreContext, type GameStore } from '@/contexts/game/useGameSelector';

function Surface({
  id,
  priority,
  wants,
  options,
}: {
  id: string;
  priority: number;
  wants: boolean;
  options?: InterruptionSlotOptions;
}) {
  const canShow = useInterruptionSlot(id, priority, wants, options);
  return canShow ? <Text>{`SHOWING:${id}`}</Text> : null;
}

/**
 * The repo renders with react-test-renderer against string-tag host components
 * (see jest.setup.js), so presence is asserted against the serialized tree
 * rather than a query API.
 */
function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return {
    renderer,
    tree: () => JSON.stringify(renderer.toJSON()),
    update: (next: React.ReactElement) => act(() => renderer.update(next)),
  };
}

const shown = (tree: string, id: string) => tree.includes(`SHOWING:${id}`);

describe('InterruptionContext', () => {
  it('grants the slot to the highest-priority claimant', () => {
    const { tree } = mount(
      <InterruptionProvider>
        <Surface id="orb" priority={INTERRUPTION_PRIORITY.AD_ORB} wants />
        <Surface id="death" priority={INTERRUPTION_PRIORITY.DEATH} wants />
        <Surface id="promo" priority={INTERRUPTION_PRIORITY.PROMO} wants />
      </InterruptionProvider>
    );

    expect(shown(tree(), 'death')).toBe(true);
    expect(shown(tree(), 'orb')).toBe(false);
    expect(shown(tree(), 'promo')).toBe(false);
  });

  it('shows exactly one surface even when everything wants to show at once', () => {
    // The worst realistic "Next Week" press from the audit.
    const all = [
      ['death', INTERRUPTION_PRIORITY.DEATH],
      ['wedding', INTERRUPTION_PRIORITY.WEDDING],
      ['life-moment', INTERRUPTION_PRIORITY.LIFE_MOMENT],
      ['inbox', INTERRUPTION_PRIORITY.EVENT_INBOX],
      ['daily', INTERRUPTION_PRIORITY.DAILY_REWARD],
      ['community', INTERRUPTION_PRIORITY.COMMUNITY_REWARD],
      ['promo', INTERRUPTION_PRIORITY.PROMO],
      ['orb', INTERRUPTION_PRIORITY.AD_ORB],
    ] as const;

    const { tree } = mount(
      <InterruptionProvider>
        {all.map(([id, p]) => (
          <Surface key={id} id={id} priority={p} wants />
        ))}
      </InterruptionProvider>
    );

    const rendered = tree();
    const visible = all.filter(([id]) => shown(rendered, id));
    expect(visible).toHaveLength(1);
    expect(visible[0][0]).toBe('death');
  });

  it('passes the slot down when the winner stops wanting to show', () => {
    const harness = (deathWants: boolean) => (
      <InterruptionProvider>
        <Surface id="death" priority={INTERRUPTION_PRIORITY.DEATH} wants={deathWants} />
        <Surface id="daily" priority={INTERRUPTION_PRIORITY.DAILY_REWARD} wants />
      </InterruptionProvider>
    );

    const { tree, update } = mount(harness(true));
    expect(shown(tree(), 'death')).toBe(true);
    expect(shown(tree(), 'daily')).toBe(false);

    update(harness(false));

    expect(shown(tree(), 'death')).toBe(false);
    expect(shown(tree(), 'daily')).toBe(true);
  });

  it('releases the slot when the winning surface unmounts', () => {
    // The robustness property: a claim is derived from `wants`, so there is no
    // imperative release that can be skipped and no way to wedge the queue.
    const harness = (mountDeath: boolean) => (
      <InterruptionProvider>
        {mountDeath ? (
          <Surface id="death" priority={INTERRUPTION_PRIORITY.DEATH} wants />
        ) : null}
        <Surface id="promo" priority={INTERRUPTION_PRIORITY.PROMO} wants />
      </InterruptionProvider>
    );

    const { tree, update } = mount(harness(true));
    expect(shown(tree(), 'promo')).toBe(false);

    update(harness(false));

    expect(shown(tree(), 'promo')).toBe(true);
  });

  it('shows nothing when no surface wants the slot', () => {
    const { tree } = mount(
      <InterruptionProvider>
        <Surface id="promo" priority={INTERRUPTION_PRIORITY.PROMO} wants={false} />
        <Surface id="orb" priority={INTERRUPTION_PRIORITY.AD_ORB} wants={false} />
      </InterruptionProvider>
    );

    expect(shown(tree(), 'promo')).toBe(false);
    expect(shown(tree(), 'orb')).toBe(false);
  });

  it('falls back to the surface own flag when no provider is mounted', () => {
    // A surface rendered in isolation (test harness, screenshot tooling) must
    // behave exactly as it did before the queue existed rather than vanish.
    const { tree } = mount(
      <Surface id="lonely" priority={INTERRUPTION_PRIORITY.PROMO} wants />
    );
    expect(shown(tree(), 'lonely')).toBe(true);
  });

  it('ranks monetization below everything the player must act on', () => {
    // Guards the ordering itself, which is the whole editorial point.
    const { PROMO, AD_ORB, ...mustAct } = INTERRUPTION_PRIORITY;
    for (const [name, priority] of Object.entries(mustAct)) {
      expect(`${name}:${priority > PROMO}`).toBe(`${name}:true`);
      expect(`${name}:${priority > AD_ORB}`).toBe(`${name}:true`);
    }
    expect(AD_ORB).toBeLessThan(PROMO);
  });

  it('defers budgeted surfaces past MAX_INTERRUPTIONS_PER_WEEK', () => {
    // Three budgeted claimants dismissed one after another: the third must NOT
    // present this week - the budget is the fix for "one Next Week press,
    // eight dismissals in a row".
    const harness = (aWants: boolean, bWants: boolean) => (
      <InterruptionProvider>
        <Surface id="a" priority={INTERRUPTION_PRIORITY.WELCOME_BACK} wants={aWants} />
        <Surface id="b" priority={INTERRUPTION_PRIORITY.DAILY_REWARD} wants={bWants} />
        <Surface id="c" priority={INTERRUPTION_PRIORITY.COMMUNITY_REWARD} wants />
      </InterruptionProvider>
    );

    const { tree, update } = mount(harness(true, true));
    expect(shown(tree(), 'a')).toBe(true);

    update(harness(false, true)); // dismiss a -> second grant goes to b
    expect(shown(tree(), 'b')).toBe(true);

    update(harness(false, false)); // dismiss b -> budget (2) is spent
    expect(shown(tree(), 'c')).toBe(false);
    expect(MAX_INTERRUPTIONS_PER_WEEK).toBe(2);
  });

  it('never defers a player-initiated (countsTowardBudget: false) surface', () => {
    const harness = (aWants: boolean, bWants: boolean, inboxWants: boolean) => (
      <InterruptionProvider>
        <Surface id="a" priority={INTERRUPTION_PRIORITY.WELCOME_BACK} wants={aWants} />
        <Surface id="b" priority={INTERRUPTION_PRIORITY.DAILY_REWARD} wants={bWants} />
        <Surface
          id="inbox"
          priority={INTERRUPTION_PRIORITY.EVENT_INBOX}
          wants={inboxWants}
          options={{ countsTowardBudget: false }}
        />
      </InterruptionProvider>
    );

    const { tree, update } = mount(harness(true, true, false));
    update(harness(false, true, false)); // spend grant 1, then grant 2
    expect(shown(tree(), 'b')).toBe(true);
    update(harness(false, false, true)); // budget spent; player taps the pill
    expect(shown(tree(), 'inbox')).toBe(true);
  });

  it('resets the budget when the game week advances', () => {
    // A minimal GameStore stub: the provider only reads `weeksLived` and
    // subscribes for changes.
    let week = 100;
    const listeners = new Set<() => void>();
    const store: GameStore = {
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      getSnapshot: () => ({ weeksLived: week } as any),
      setGameState: () => {},
    };
    const advanceWeek = () => {
      week += 1;
      listeners.forEach((fn) => fn());
    };

    const harness = (aWants: boolean, bWants: boolean) => (
      <GameStoreContext.Provider value={store}>
        <InterruptionProvider>
          <Surface id="a" priority={INTERRUPTION_PRIORITY.WELCOME_BACK} wants={aWants} />
          <Surface id="b" priority={INTERRUPTION_PRIORITY.DAILY_REWARD} wants={bWants} />
          <Surface id="c" priority={INTERRUPTION_PRIORITY.COMMUNITY_REWARD} wants />
        </InterruptionProvider>
      </GameStoreContext.Provider>
    );

    const { tree, update, renderer } = mount(harness(true, true));
    update(harness(false, true));
    update(harness(false, false));
    expect(shown(tree(), 'c')).toBe(false); // budget spent this week

    act(() => advanceWeek());
    act(() => renderer.update(harness(false, false)));
    expect(shown(tree(), 'c')).toBe(true); // fresh week, fresh budget
  });
});
