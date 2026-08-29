import { LOCAL_EVENTS } from '../catalogue';
import { validateEventDefinition } from '../validation';
import { instanceId, windowFor } from '../schedule';
import { bundleValueInGems, WEEKLY_BUDGET_GEMS } from '../rewards';

describe('the shipped catalogue', () => {
  it('every event passes the SAME validator remote content goes through', () => {
    // A local catalogue that skipped the caps would be a hole in the economy
    // safety that no reviewer would think to look for.
    for (const event of LOCAL_EVENTS) {
      expect({ id: event.id, problems: validateEventDefinition(event) }).toEqual({
        id: event.id,
        problems: [],
      });
    }
  });

  it('has no duplicate ids or duplicate instances', () => {
    const ids = LOCAL_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const instances = LOCAL_EVENTS.map(instanceId);
    expect(new Set(instances).size).toBe(instances.length);
  });

  it('every window parses and runs forward in time', () => {
    for (const event of LOCAL_EVENTS) {
      const window = windowFor(event);
      expect(window).not.toBeNull();
      expect(window!.endsAt).toBeGreaterThan(window!.startsAt);
      expect(window!.claimUntil).toBeGreaterThanOrEqual(window!.endsAt);
    }
  });

  it('no single player can be owed more in one week than the budget will pay', () => {
    // The budget REFUSES an overspend at claim time, so this is not a
    // correctness risk - it is a DESIGN risk. An event the player completed and
    // then cannot claim is a broken promise, and the calendar should never be
    // authored into that corner in the first place.
    //
    // Overlapping WINDOWS are not the test: two events can share a month
    // without one player being able to take both. What matters is what a SINGLE
    // player could have claimable at one instant, so this walks every window
    // boundary and groups by progression stage.
    const stages = ['new', 'early', 'mid', 'late', 'endgame'];
    const instants = LOCAL_EVENTS.flatMap((e) => {
      const w = windowFor(e)!;
      return [w.startsAt, w.endsAt - 1, w.claimUntil - 1];
    });

    for (const stage of stages) {
      for (const at of instants) {
        const claimableNow = LOCAL_EVENTS.filter((e) => {
          const w = windowFor(e)!;
          if (at < w.startsAt || at >= w.claimUntil) return false;
          const targeted = e.eligibility?.stages;
          return !targeted || targeted.includes(stage);
        });
        const total = claimableNow.reduce((sum, e) => sum + bundleValueInGems(e.rewards), 0);
        expect({ stage, at, ids: claimableNow.map((e) => e.id), total }).toEqual({
          stage,
          at,
          ids: expect.any(Array),
          total: expect.any(Number),
        });
        expect(total).toBeLessThanOrEqual(WEEKLY_BUDGET_GEMS);
      }
    }
  });

  it('targets more than one progression stage across the calendar', () => {
    // An events programme that only ever speaks to late-game players teaches
    // everyone else that the hub is not for them.
    const stages = new Set<string>();
    for (const event of LOCAL_EVENTS) {
      for (const stage of event.eligibility?.stages ?? ['<all>']) stages.add(stage);
    }
    expect(stages.size).toBeGreaterThanOrEqual(3);
  });

  it('includes a returning-player event that asks almost nothing', () => {
    // Coming back must be acknowledged and immediately worth something; an
    // event that greets a returning player with a wall is worse than none.
    const returning = LOCAL_EVENTS.filter((e) => e.kind === 'returning');
    expect(returning.length).toBeGreaterThan(0);
    for (const event of returning) {
      expect(event.eligibility?.minDaysAway).toBeGreaterThan(0);
      // A long grace, because the whole point is that it waits for them.
      expect(event.claimGraceDays ?? 0).toBeGreaterThanOrEqual(7);
    }
  });

  it('pays Legacy Points sparingly, since they cross a life boundary', () => {
    const paying = LOCAL_EVENTS.filter((e) => e.rewards.some((r) => r.kind === 'legacyPoints'));
    expect(paying.length).toBeLessThanOrEqual(2);
  });
});
