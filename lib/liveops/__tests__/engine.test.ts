import { claimableCount, hasSomethingToDo, resolveEvent, resolveHub } from '../engine';
import type { LiveEventDefinition } from '../types';
import type { EligibilityContext } from '../eligibility';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { instanceId } from '../schedule';

const NOW = Date.parse('2026-06-15T12:00:00Z');

const ctx = (o: Partial<EligibilityContext> = {}): EligibilityContext => ({
  weeksThisLife: 40,
  totalPrestiges: 0,
  isSubscriber: false,
  daysAway: 0,
  installId: 'install-engine',
  ...o,
});

const def = (o: Partial<LiveEventDefinition> = {}): LiveEventDefinition => ({
  id: 'e',
  schemaVersion: 1,
  kind: 'challenge',
  title: 't',
  summary: 's',
  brief: 'b',
  startsAt: '2026-06-01T00:00:00Z',
  endsAt: '2026-07-01T00:00:00Z',
  objectives: [{ objectiveId: 'reputation', target: 10 }],
  rewards: [{ kind: 'gems', amount: 100 }],
  ...o,
});

const withRep = (reputation: number, extra: Partial<GameState> = {}): GameState => {
  const base = createTestGameState(extra);
  return { ...base, stats: { ...base.stats, reputation } } as GameState;
};

describe('resolveEvent', () => {
  it('reports live progress against the save', () => {
    const resolved = resolveEvent(def(), withRep(4), ctx(), NOW);
    expect(resolved.objectives).toEqual([
      expect.objectContaining({ objectiveId: 'reputation', current: 4, target: 10, met: false }),
    ]);
    expect(resolved.complete).toBe(false);
    expect(resolved.state).toBe('active');
  });

  it('renders progress even for a CLAIMED event', () => {
    // The hub shows "3 of 3" on a claimed card; branching on state first would
    // render zeros there.
    const claimed = withRep(50, {
      liveOps: { claimedInstanceIds: [instanceId(def())] },
    } as Partial<GameState>);
    const resolved = resolveEvent(def(), claimed, ctx(), NOW);
    expect(resolved.state).toBe('claimed');
    expect(resolved.objectives[0].met).toBe(true);
  });

  it('is never vacuously complete when no objective is readable', () => {
    const broken = def({ objectives: [{ objectiveId: 'nope', target: 1 }] });
    const resolved = resolveEvent(broken, withRep(50), ctx(), NOW);
    expect(resolved.objectives).toEqual([]);
    expect(resolved.complete).toBe(false);
  });

  it('never throws on a malformed save', () => {
    expect(() => resolveEvent(def(), {} as GameState, ctx(), NOW)).not.toThrow();
  });
});

describe('resolveHub', () => {
  const claimable = def({ id: 'a', objectives: [{ objectiveId: 'reputation', target: 1 }] });
  const active = def({ id: 'b', objectives: [{ objectiveId: 'reputation', target: 999 }] });
  // Inside the announcement horizon on purpose: this block is about the
  // unavailable/expired filter, and an out-of-horizon fixture would be dropped
  // for a different reason and prove nothing about the one under test.
  const upcoming = def({ id: 'c', startsAt: '2026-06-19T00:00:00Z', endsAt: '2026-06-30T00:00:00Z' });
  const gone = def({ id: 'd', startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-02-01T00:00:00Z' });
  const locked = def({ id: 'f', eligibility: { requiresSubscription: true } });

  it('hides `unavailable` and `expired`, and leads with what can be claimed', () => {
    // A hub padded with locked cards is a wall, and listing an event that
    // closed with the player mid-way converts a missed opportunity into a
    // reproach - never guilt the player.
    const hub = resolveHub([gone, locked, upcoming, active, claimable], withRep(50), ctx(), NOW);
    expect(hub.map((r) => r.definition.id)).toEqual(['a', 'b', 'c']);
    expect(hub[0].state).toBe('claimable');
  });

  it('returns an empty hub rather than failing when nothing applies', () => {
    expect(resolveHub([gone, locked], withRep(50), ctx(), NOW)).toEqual([]);
  });

  it('returns an empty hub when the content layer supplied nothing', () => {
    // The paused kill switch and a total network failure both look like this.
    expect(resolveHub([], withRep(50), ctx(), NOW)).toEqual([]);
  });
});

describe('the badge', () => {
  it('counts ONLY what can be claimed right now', () => {
    // A badge that counts everything active is never zero, which trains the
    // player to ignore it.
    const hub = resolveHub(
      [
        def({ id: 'a', objectives: [{ objectiveId: 'reputation', target: 1 }] }),
        def({ id: 'b', objectives: [{ objectiveId: 'reputation', target: 999 }] }),
      ],
      withRep(50),
      ctx(),
      NOW,
    );
    expect(claimableCount(hub)).toBe(1);
    expect(hasSomethingToDo(hub)).toBe(true);
  });

  it('is zero when there is nothing to do', () => {
    expect(claimableCount([])).toBe(0);
    expect(hasSomethingToDo([])).toBe(false);
  });
});

describe('the upcoming horizon', () => {
  it('does NOT announce an event months away', () => {
    // Without a horizon the hub advertised a year-end event from August: 128
    // days out, 0/3 objectives, and nothing the player could do about it for
    // four months. A permanent row that never changes is worse than an empty
    // card - it teaches the player the surface has nothing for them.
    const distant = def({
      id: 'far',
      startsAt: '2026-12-14T00:00:00Z',
      endsAt: '2027-01-04T00:00:00Z',
    });
    expect(resolveHub([distant], withRep(50), ctx(), NOW)).toEqual([]);
  });

  it('DOES announce one starting within the week, so a player can plan', () => {
    // The same window the offer rotation uses for "next week's offer": both
    // answer "what is coming that I could plan around".
    const soon = def({
      id: 'soon',
      startsAt: '2026-06-19T00:00:00Z', // 3.5 days after NOW
      endsAt: '2026-06-30T00:00:00Z',
    });
    const hub = resolveHub([soon], withRep(50), ctx(), NOW);
    expect(hub.map((r) => r.definition.id)).toEqual(['soon']);
    expect(hub[0].state).toBe('upcoming');
  });

  it('never hides something the player can act on now', () => {
    const active = def({ id: 'now', objectives: [{ objectiveId: 'reputation', target: 999 }] });
    const claimable = def({ id: 'ready', objectives: [{ objectiveId: 'reputation', target: 1 }] });
    const hub = resolveHub([active, claimable], withRep(50), ctx(), NOW);
    expect(hub.map((r) => r.definition.id)).toEqual(['ready', 'now']);
  });
});
