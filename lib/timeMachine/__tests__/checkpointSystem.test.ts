/**
 * Time-machine checkpoint slimming.
 *
 * Checkpoints are full clones of the game state. In a long game the bulk of a
 * snapshot is cosmetic history — the event log and the Pulse feed / its
 * notification + comment caches — which previously made stored checkpoints the
 * dominant term in a large save. These tests pin that:
 *   - creation drops the heavy, re-derivable collections but keeps everything
 *     gameplay-critical, at a materially smaller serialized size;
 *   - a create → rewind round-trip preserves gameplay-critical fields and safely
 *     re-defaults the stripped ones (the rewind path runs repairGameState);
 *   - slimCheckpointSnapshot never throws on malformed input.
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  createCheckpoint,
  rewindToCheckpoint,
  slimCheckpointSnapshot,
  getRewindCost,
} from '@/lib/timeMachine/checkpointSystem';

function heavyState(): GameState {
  // createTestGameState deep-clones initialGameState, so mutating the result
  // below is safe (see the clone note in the factory).
  const base = createTestGameState();
  base.weeksLived = 52;
  base.generationNumber = 3;
  base.stats = { ...base.stats, money: 50_000, gems: 0 };
  base.relationships = [
    {
      id: 'rel_alex',
      name: 'Alex',
      type: 'friend',
      relationshipScore: 80,
      personality: 'caring',
      gender: 'female',
      age: 20,
    },
  ];

  // Heavy re-derivable collections that slimming must drop.
  base.eventLog = Array.from({ length: 400 }, (_, i) => ({
    id: `evt_${i}`,
    description: `Something notable happened in week ${i}. ${'x'.repeat(60)}`,
    choice: 'accept',
    week: i % 52,
    year: 2025 + Math.floor(i / 52),
  }));
  const sm = base.socialMedia as unknown as Record<string, unknown>;
  sm.recentPosts = Array.from({ length: 50 }, (_, i) => ({
    id: `post_${i}`,
    content: `A post body ${'y'.repeat(80)}`,
  }));
  sm.notifications = Array.from({ length: 100 }, (_, i) => ({
    id: `notif_${i}`,
    text: `notification ${'z'.repeat(40)}`,
  }));
  sm.commentThreads = { post_0: [{ id: 'c0', text: 'nice' }] };

  return base;
}

describe('checkpointSystem - slimCheckpointSnapshot', () => {
  it('drops heavy re-derivable collections, keeps gameplay-critical fields', () => {
    const snap = {
      stats: { money: 100 },
      relationships: [{ id: 'r1' }],
      eventLog: [{ id: 'e1' }],
      socialMedia: { followers: 5, recentPosts: [{ id: 'p1' }], notifications: [{ id: 'n1' }], commentThreads: { p1: [] } },
    };
    const out = slimCheckpointSnapshot(snap);
    expect(out.eventLog).toBeUndefined();
    expect(out.socialMedia.recentPosts).toBeUndefined();
    expect(out.socialMedia.notifications).toBeUndefined();
    expect(out.socialMedia.commentThreads).toBeUndefined();
    // Gameplay-critical + non-stripped social fields kept.
    expect(out.stats.money).toBe(100);
    expect(out.relationships).toHaveLength(1);
    expect(out.socialMedia.followers).toBe(5);
  });

  it('is crash-safe on malformed / non-object input', () => {
    expect(() => slimCheckpointSnapshot(null as never)).not.toThrow();
    expect(() => slimCheckpointSnapshot(undefined as never)).not.toThrow();
    expect(() => slimCheckpointSnapshot('a string' as never)).not.toThrow();
    // Object without socialMedia must not throw.
    expect(() => slimCheckpointSnapshot({ stats: {} } as never)).not.toThrow();
  });
});

describe('checkpointSystem - createCheckpoint', () => {
  it('strips heavy collections from the snapshot but keeps gameplay-critical data', () => {
    const state = heavyState();
    const cp = createCheckpoint(state, 'Age 19');
    const snap = cp.snapshot as Partial<GameState>;

    // Stripped keys absent.
    expect((snap as Record<string, unknown>).eventLog).toBeUndefined();
    const sm = snap.socialMedia as unknown as Record<string, unknown>;
    expect(sm.recentPosts).toBeUndefined();
    expect(sm.notifications).toBeUndefined();
    expect(sm.commentThreads).toBeUndefined();

    // Gameplay-critical retained.
    expect(snap.stats?.money).toBe(50_000);
    expect(snap.relationships).toHaveLength(1);
    expect(snap.banking?.creditScore?.score).toBe(650);
    // Transient fields still stripped (pre-existing behavior).
    expect((snap as Record<string, unknown>).checkpoints).toBeUndefined();
  });

  it('produces a materially smaller snapshot than a full clone of the state', () => {
    const state = heavyState();
    const fullSize = JSON.stringify(state).length;
    const cp = createCheckpoint(state, 'Age 19');
    const slimSize = JSON.stringify(cp.snapshot).length;
    expect(slimSize).toBeLessThan(fullSize);
    // The dropped event log alone is tens of KB - assert a real, large saving
    // rather than an exact byte count.
    expect(fullSize - slimSize).toBeGreaterThan(10_000);
  });

  it('deep-clones so later mutations to the live state do not leak in', () => {
    const state = heavyState();
    const cp = createCheckpoint(state, 'Test');
    (state.stats as { money: number }).money = 99_999_999;
    const snap = cp.snapshot as Partial<GameState>;
    expect(snap.stats?.money).toBe(50_000);
  });
});

describe('checkpointSystem - create → rewind round-trip', () => {
  it('preserves gameplay-critical fields and re-defaults the stripped ones', () => {
    const captured = heavyState();
    const cp = createCheckpoint(captured, 'Age 19');

    const liveGems = 100_000;
    const live = heavyState();
    live.stats = { ...live.stats, gems: liveGems };
    live.timeMachineUsesThisLife = 0;
    live.checkpoints = [cp];

    const restored = rewindToCheckpoint(live, cp.id);
    expect(restored).not.toBeNull();
    const r = restored!;

    // Gameplay-critical restored from the snapshot.
    expect(r.stats.money).toBe(50_000);
    expect(r.relationships?.[0]?.id).toBe('rel_alex');
    expect(r.banking?.creditScore?.score).toBe(650);
    // Gems deducted from the live state (not the snapshot).
    expect(r.stats.gems).toBe(liveGems - getRewindCost(0));

    // Stripped collections safely re-defaulted by the repair pass on rewind.
    expect(Array.isArray(r.eventLog)).toBe(true);
    expect(r.eventLog).toHaveLength(0);
    // Assert the repaired shapes strictly - a `?? []` fallback would pass even
    // if the repair pass never re-defaulted the field (undefined ≠ restored).
    const rsm = r.socialMedia as unknown as Record<string, unknown>;
    expect(Array.isArray(rsm.notifications)).toBe(true);
    expect(rsm.notifications as unknown[]).toHaveLength(0);
    expect(typeof rsm.commentThreads).toBe('object');
    expect(Object.keys(rsm.commentThreads as Record<string, unknown>)).toHaveLength(0);
    expect(Array.isArray(rsm.recentPosts)).toBe(true);
    expect(rsm.recentPosts as unknown[]).toHaveLength(0);
  });

  it('rejects a rewind when the player cannot afford the cost', () => {
    const cp = createCheckpoint(heavyState(), 'Age 19');
    const live = heavyState();
    live.stats = { ...live.stats, gems: 0 };
    live.checkpoints = [cp];
    expect(rewindToCheckpoint(live, cp.id)).toBeNull();
  });

  it('carries account-level purchases from the LIVE state onto the restore (F3)', () => {
    // A checkpoint captured before a real-money purchase (or a purchase landing
    // while the rewind dialog is open) must not be erased by the full-snapshot
    // restore. The account-entitlement whitelist carries them off the live
    // state, exactly as prestige/heir-continuation do.
    const captured = heavyState();
    // The snapshot predates every purchase below.
    captured.settings = { ...captured.settings, adsRemoved: false, lifetimePremium: false, privateBanking: false } as never;
    captured.goldUpgrades = {};
    const cp = createCheckpoint(captured, 'Age 19');

    const live = heavyState();
    live.stats = { ...live.stats, gems: 100_000 };
    live.checkpoints = [cp];
    // Purchases the player owns NOW (after the checkpoint).
    live.settings = {
      ...live.settings,
      adsRemoved: true,
      lifetimePremium: true,
      privateBanking: true,
    } as never;
    live.goldUpgrades = { multiplier: true, immortality: true };
    live.perks = { ...(live.perks ?? {}), workBoost: true };

    const r = rewindToCheckpoint(live, cp.id)!;

    expect(r.settings?.adsRemoved).toBe(true);
    expect(r.settings?.lifetimePremium).toBe(true);
    expect(r.settings?.privateBanking).toBe(true);
    expect(r.goldUpgrades?.multiplier).toBe(true);
    expect(r.goldUpgrades?.immortality).toBe(true);
    expect(r.perks?.workBoost).toBe(true);
  });
});

describe('checkpointSystem - getRewindCost tiers', () => {
  it('Time Machine upgrade halves the cost', () => {
    const full = getRewindCost(0, false);
    expect(getRewindCost(0, true)).toBe(Math.floor(full / 2));
  });

  it('Chronomaster makes every rewind free, overriding the Time Machine tier', () => {
    expect(getRewindCost(0, false, true)).toBe(0);
    expect(getRewindCost(3, true, true)).toBe(0); // free even at a high use count
  });

  it('lets a Chronomaster owner rewind with zero gems', () => {
    const cp = createCheckpoint(heavyState(), 'Age 19');
    const live = heavyState();
    live.stats = { ...live.stats, gems: 0 };
    live.checkpoints = [cp];
    live.goldUpgrades = { ...(live.goldUpgrades ?? {}), chronomaster: true };
    expect(rewindToCheckpoint(live, cp.id)).not.toBeNull();
  });
});

/**
 * What a snapshot must NOT carry.
 *
 * Measured on a five-year save: a snapshot is ~170 KB, five of them are 81% of
 * the whole file, and `cryptoMarket` is ~37 KB of every one - almost all of it
 * `coinMarkets[*].priceHistory`, a 100-week chart series per coin.
 *
 * Dropping it is not only a saving. `cryptoMarket` is MARKET simulation, and
 * restoring it rolled the market back along with the player: rewind to before
 * the crash, then trade a window you have already watched play out. The
 * player's actual position is `cryptos[].owned` and must survive untouched -
 * which is the half of this that a size-only fix would have got wrong.
 */
describe('checkpointSystem - the market is not part of the rewind', () => {
  const withMarket = () => {
    const state = createTestGameState({});
    (state as unknown as Record<string, unknown>).cryptoMarket = {
      coinMarkets: {
        btc: {
          cryptoId: 'btc',
          regime: 'bull',
          regimeWeeksRemaining: 4,
          bidAskSpread: 0.01,
          priceHistory: Array.from({ length: 100 }, (_, i) => ({ weeksLived: i, price: 1000 + i })),
        },
      },
    };
    (state as unknown as Record<string, unknown>).cryptos = [
      { id: 'btc', name: 'Bitcoin', price: 1100, owned: 2.5 },
    ];
    return state;
  };

  it('leaves cryptoMarket out of the snapshot', () => {
    const cp = createCheckpoint(withMarket(), 'Age 20');
    expect((cp.snapshot as Record<string, unknown>).cryptoMarket).toBeUndefined();
  });

  it('KEEPS the player position, which lives on cryptos[].owned', () => {
    // The half a size-only fix gets wrong. Stripping the market must not cost
    // the player their coins.
    const cp = createCheckpoint(withMarket(), 'Age 20');
    const coins = (cp.snapshot as Record<string, unknown>).cryptos as { owned: number }[];
    expect(coins).toHaveLength(1);
    expect(coins[0].owned).toBe(2.5);
  });

  it('does not mutate the live state it snapshots', () => {
    // `slimCheckpointSnapshot` deletes keys, and it runs on a shallow copy for
    // exactly this reason - a miss here would wipe the live market mid-tick.
    const state = withMarket();
    createCheckpoint(state, 'Age 20');
    expect((state as unknown as Record<string, unknown>).cryptoMarket).toBeDefined();
  });

  it('measurably shrinks the snapshot', () => {
    const state = withMarket();
    const withoutMarket = createTestGameState({});
    (withoutMarket as unknown as Record<string, unknown>).cryptos = [
      { id: 'btc', name: 'Bitcoin', price: 1100, owned: 2.5 },
    ];
    const a = JSON.stringify(createCheckpoint(state, 'Age 20').snapshot).length;
    const b = JSON.stringify(createCheckpoint(withoutMarket, 'Age 20').snapshot).length;
    // Same size either way - the market never makes it in.
    expect(Math.abs(a - b)).toBeLessThan(50);
  });
});

/**
 * Mail is stripped, and the decision it was carrying is not lost with it.
 *
 * Mail is ~39 KB of a 170 KB snapshot, the largest single field, and it is a
 * paper trail about weeks the rewind is undoing anyway. But it also carries
 * DECISIONS with deadlines, and `pendingEvents` is NOT stripped - so a routed
 * letter-event would come back with no inbox to render it in, invisible in
 * both surfaces until it lapsed. Stripping mail without handing those events
 * back would have traded 39 KB for a decision the player can never make.
 */
describe('checkpointSystem - stripping mail must not strand its decisions', () => {
  const routed = () => {
    const state = createTestGameState({});
    (state as unknown as Record<string, unknown>).mail = {
      messages: [
        {
          id: 'mail-letter-jury_duty',
          senderName: 'Revenue Service',
          senderEmail: 'notices@revenue.gov',
          subject: 'Jury service',
          preview: '',
          body: '',
          atWeek: 100,
          read: false,
          starred: false,
          folder: 'inbox',
          category: 'primary',
        },
      ],
      lastGeneratedWeek: 100,
    };
    state.pendingEvents = [
      {
        id: 'jury_duty',
        description: 'A summons arrives.',
        choices: [{ id: 'serve', text: 'Serve', effects: {} }],
        channel: 'mail',
        expiresAtWeek: 104,
      },
      { id: 'office_gossip', description: 'Gossip.', choices: [{ id: 'a', text: 'A', effects: {} }] },
    ] as never;
    state.stats = { ...state.stats, gems: 50_000 };
    return state;
  };

  it('leaves mail out of the snapshot', () => {
    const cp = createCheckpoint(routed(), 'Age 20');
    expect((cp.snapshot as Record<string, unknown>).mail).toBeUndefined();
  });

  it('hands a restored mail-routed event back to the blocking modal', () => {
    // Without this the decision exists, has no letter, and nothing shows it.
    const state = routed();
    const cp = createCheckpoint(state, 'Age 20');
    state.checkpoints = [cp];

    const restored = rewindToCheckpoint(state, cp.id)!;
    expect(restored).not.toBeNull();

    const summons = restored.pendingEvents!.find((e) => e.id === 'jury_duty')!;
    expect(summons.channel).toBe('modal');
    // The deadline goes too - a letter's expiry is meaningless with no letter,
    // and leaving it would let the lapse pass re-settle a visible decision.
    expect(summons.expiresAtWeek).toBeUndefined();
  });

  it('leaves ordinary events alone', () => {
    const state = routed();
    const cp = createCheckpoint(state, 'Age 20');
    state.checkpoints = [cp];

    const restored = rewindToCheckpoint(state, cp.id)!;
    const gossip = restored.pendingEvents!.find((e) => e.id === 'office_gossip')!;
    expect(gossip.channel).toBeUndefined();
  });
});

/**
 * What must NEVER be stripped, and why the field name does not tell you.
 *
 * `streetJobs` and `darkWebItems` sit in `repairGameState`'s `catalogArrays`
 * list, which restores them WHOLESALE from defaults when absent. They read as
 * static catalogues. They are not: one carries rank `progress`, the other
 * carries `owned`. Stripping either would reset the player's crime progress or
 * repossess their purchases on every rewind - and report it as a repair.
 */
describe('checkpointSystem - player state survives the snapshot', () => {
  it('keeps street-job progress and dark-web purchases', () => {
    const state = createTestGameState({});
    (state as unknown as Record<string, unknown>).streetJobs = [
      { id: 'pickpocket', name: 'Pickpocket', description: '', energyCost: 10, baseSuccessRate: 0.5, basePayment: 40, rank: 2, progress: 73 },
    ];
    (state as unknown as Record<string, unknown>).darkWebItems = [
      { id: 'vpn', name: 'VPN', costBtc: 0.1, owned: true },
    ];

    const snap = createCheckpoint(state, 'Age 20').snapshot as Record<string, unknown>;
    expect((snap.streetJobs as { progress: number }[])[0].progress).toBe(73);
    expect((snap.darkWebItems as { owned: boolean }[])[0].owned).toBe(true);
  });

  it('drops jailActivities, which genuinely is catalogue-only', () => {
    const state = createTestGameState({});
    const snap = createCheckpoint(state, 'Age 20').snapshot as Record<string, unknown>;
    expect(snap.jailActivities).toBeUndefined();
  });
});
