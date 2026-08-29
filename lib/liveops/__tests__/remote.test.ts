/**
 * Remote content, assuming the payload is hostile or broken.
 *
 * The contract these pin: the network can only ADD events or TAKE THEM AWAY.
 * It can never break the game, never exceed a reward cap, and never execute
 * anything.
 */
import { resolvePayload, localContent } from '../remote';
import { LOCAL_EVENTS } from '../catalogue';
import { REWARD_CAPS } from '../rewards';

const validRemote = {
  id: 'remote_event',
  schemaVersion: 1,
  kind: 'challenge',
  title: 'Remote Event',
  summary: 'Published without a build.',
  brief: 'An event that arrived over the wire.',
  startsAt: '2026-08-01T00:00:00Z',
  endsAt: '2026-08-15T00:00:00Z',
  objectives: [{ objectiveId: 'reputation', target: 40 }],
  rewards: [{ kind: 'gems', amount: 200 }],
};

const ids = (r: { events: { id: string }[] }) => r.events.map((e) => e.id);

describe('the fallback ladder', () => {
  it('an empty payload still yields the whole local catalogue', () => {
    // The game must be fully playable on the bottom rung.
    const resolved = resolvePayload({}, 'local');
    expect(ids(resolved)).toEqual(expect.arrayContaining(LOCAL_EVENTS.map((e) => e.id)));
  });

  it('garbage in place of a payload yields the local catalogue, not a throw', () => {
    for (const junk of [null, undefined, 'a string', 42, [], { events: 'not an array' }]) {
      const resolved = resolvePayload(junk, 'remote');
      expect(resolved.events.length).toBe(LOCAL_EVENTS.length);
    }
  });

  it('localContent() is the no-network answer', () => {
    expect(localContent().source).toBe('local');
    expect(localContent().events.length).toBe(LOCAL_EVENTS.length);
  });
});

describe('one bad definition costs that definition, never the calendar', () => {
  it('keeps the valid remote events and drops the invalid ones', () => {
    const resolved = resolvePayload(
      { events: [validRemote, { id: 'broken' }, { ...validRemote, id: 'also_ok' }] },
      'remote',
    );
    expect(ids(resolved)).toContain('remote_event');
    expect(ids(resolved)).toContain('also_ok');
    expect(ids(resolved)).not.toContain('broken');
    // Every local event survives a bad remote neighbour.
    for (const local of LOCAL_EVENTS) expect(ids(resolved)).toContain(local.id);
  });

  it('reports what it dropped, so a bad publish is visible', () => {
    const resolved = resolvePayload({ events: [{ id: 'broken' }] }, 'remote');
    expect(resolved.rejected.map((r) => r.id)).toContain('broken');
    expect(resolved.rejected[0].problems.length).toBeGreaterThan(0);
  });
});

describe('the economy cannot be widened from the network', () => {
  it('refuses a reward past the cap', () => {
    const greedy = { ...validRemote, rewards: [{ kind: 'gems', amount: REWARD_CAPS.gems + 1 }] };
    expect(ids(resolvePayload({ events: [greedy] }, 'remote'))).not.toContain('remote_event');
  });

  it('refuses a reward kind the app does not know', () => {
    const invented = { ...validRemote, rewards: [{ kind: 'realMoney', amount: 1 }] };
    expect(ids(resolvePayload({ events: [invented] }, 'remote'))).not.toContain('remote_event');
  });

  it('refuses two entries of one currency summing past its cap', () => {
    const doubled = {
      ...validRemote,
      rewards: [
        { kind: 'gems', amount: REWARD_CAPS.gems },
        { kind: 'gems', amount: REWARD_CAPS.gems },
      ],
    };
    expect(ids(resolvePayload({ events: [doubled] }, 'remote'))).not.toContain('remote_event');
  });
});

describe('no logic can arrive over the wire', () => {
  it('refuses an objective that is not in the compiled-in registry', () => {
    // The load-bearing safety property: a definition can only ever ask for a
    // read this binary already performs.
    const invented = {
      ...validRemote,
      objectives: [{ objectiveId: 'grant_me_everything', target: 1 }],
    };
    expect(ids(resolvePayload({ events: [invented] }, 'remote'))).not.toContain('remote_event');
  });

  it('ignores an inline function smuggled into a definition', () => {
    // JSON cannot carry one, but a payload could arrive from anywhere. The
    // field is simply not part of the schema and nothing reads it.
    const smuggled = { ...validRemote, read: '() => 999', checkCurrent: 'evil' };
    const resolved = resolvePayload({ events: [smuggled] }, 'remote');
    const kept = resolved.events.find((e) => e.id === 'remote_event');
    expect(kept).toBeDefined();
    // The objective still resolves through the registry, not through the payload.
    expect(kept!.objectives[0].objectiveId).toBe('reputation');
  });

  it('refuses a definition from a newer schema than this build understands', () => {
    // Fields this app cannot see may be the ones that bound the reward or
    // narrow the audience; running it would mean running something other than
    // what was authored.
    const future = { ...validRemote, schemaVersion: 99 };
    expect(ids(resolvePayload({ events: [future] }, 'remote'))).not.toContain('remote_event');
  });
});

describe('the kill switches', () => {
  it('disabledEventIds removes a specific event, local or remote', () => {
    const target = LOCAL_EVENTS[0].id;
    const resolved = resolvePayload({ disabledEventIds: [target] }, 'remote');
    expect(ids(resolved)).not.toContain(target);
    expect(resolved.events.length).toBe(LOCAL_EVENTS.length - 1);
  });

  it('paused takes the whole system off the air without breaking anything', () => {
    const resolved = resolvePayload({ events: [validRemote], paused: true }, 'remote');
    expect(resolved.events).toEqual([]);
    expect(resolved.paused).toBe(true);
  });

  it('a kill switch survives into the cached payload', () => {
    // An event killed while the player was online must stay killed on their
    // next offline launch - which is exactly when a broken event does damage.
    const target = LOCAL_EVENTS[0].id;
    const fromCache = resolvePayload({ disabledEventIds: [target] }, 'cache');
    expect(ids(fromCache)).not.toContain(target);
  });
});

describe('remote definitions override local ones by id', () => {
  it('a republished id replaces the shipped event', () => {
    // The whole point of remote content: correcting a shipped event without an
    // app update.
    const localId = LOCAL_EVENTS[0].id;
    const corrected = { ...validRemote, id: localId, title: 'Corrected In Flight' };
    const resolved = resolvePayload({ events: [corrected] }, 'remote');
    const kept = resolved.events.filter((e) => e.id === localId);
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toBe('Corrected In Flight');
  });

  it('a republished id that is INVALID leaves the shipped event running', () => {
    // A broken correction must not take the original off the air as well - that
    // would turn a typo into an outage.
    const localId = LOCAL_EVENTS[0].id;
    const broken = { id: localId, schemaVersion: 1 };
    const resolved = resolvePayload({ events: [broken] }, 'remote');
    expect(ids(resolved)).toContain(localId);
  });
});
