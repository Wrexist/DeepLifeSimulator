import { featureAdoption, isTrackedFeature, parseAdoptionRecord, TRACKED_FEATURES } from '../featureAdoption';

type Emitted = { name: string; props: { feature: string; weeksLived: number; weeksSinceFirstUse?: number } };

function setup(firstUse: Record<string, number> = {}) {
  const seen: Emitted[] = [];
  featureAdoption.configure({ firstUse, emit: (name, props) => seen.push({ name, props }) });
  return seen;
}

describe('the feature catalogue', () => {
  it('is a closed list, so a typo cannot become a third spelling of one feature', () => {
    expect(isTrackedFeature('darkweb')).toBe(true);
    expect(isTrackedFeature('dark_web')).toBe(false);
    expect(isTrackedFeature('DarkWeb')).toBe(false);
  });

  it('has no duplicates', () => {
    expect(new Set(TRACKED_FEATURES).size).toBe(TRACKED_FEATURES.length);
  });

  it('uses one naming convention throughout - lower snake_case', () => {
    for (const feature of TRACKED_FEATURES) expect(feature).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe('parseAdoptionRecord', () => {
  it('drops entries that are not a known feature mapped to a finite number', () => {
    expect(
      parseAdoptionRecord({ career: 10, bogus: 3, crypto: 'nope', dating: NaN } as Record<string, unknown>),
    ).toEqual({ career: 10 });
  });

  it('returns an empty record for a missing or corrupt store', () => {
    expect(parseAdoptionRecord(null)).toEqual({});
  });
});

describe('record', () => {
  it('emits DISCOVERY once, ever', () => {
    const seen = setup();
    featureAdoption.record('crypto', 12);
    expect(seen).toEqual([{ name: 'feature_first_used', props: { feature: 'crypto', weeksLived: 12 } }]);
    expect(featureAdoption.getFirstUse().crypto).toBe(12);
  });

  it('does NOT re-emit discovery for a feature already recorded on disk', () => {
    // An in-memory-only set would re-fire on every cold start and make
    // discovery look like engagement.
    const seen = setup({ crypto: 5 });
    featureAdoption.record('crypto', 40);
    expect(seen.map((e) => e.name)).toEqual(['feature_used']);
  });

  it('does not count the first use twice', () => {
    // The first use is also a use; emitting both on one interaction would
    // double the feature's return rate.
    const seen = setup();
    featureAdoption.record('stocks', 3);
    featureAdoption.record('stocks', 3);
    expect(seen.map((e) => e.name)).toEqual(['feature_first_used']);
  });

  it('emits RETURN at most once per session', () => {
    // Forty taps in one sitting is one returning player.
    const seen = setup({ dating: 2 });
    for (let i = 0; i < 40; i++) featureAdoption.record('dating', 30);
    expect(seen).toHaveLength(1);
    expect(seen[0].name).toBe('feature_used');
  });

  it('emits again in a new session', () => {
    const seen = setup({ dating: 2 });
    featureAdoption.record('dating', 30);
    featureAdoption.startSession();
    featureAdoption.record('dating', 31);
    expect(seen.map((e) => e.name)).toEqual(['feature_used', 'feature_used']);
  });

  it('carries how much of the life has passed since discovery', () => {
    // Separates "came back next week" from "rediscovered it a year later" —
    // different products even at the same return rate.
    const seen = setup({ politics: 100 });
    featureAdoption.record('politics', 160);
    expect(seen[0].props.weeksSinceFirstUse).toBe(60);
  });

  it('never reports a negative time since discovery after a life reset', () => {
    const seen = setup({ politics: 500 });
    featureAdoption.record('politics', 4);
    expect(seen[0].props.weeksSinceFirstUse).toBe(0);
  });

  it('drops an unknown feature id rather than emitting it', () => {
    const seen = setup();
    featureAdoption.record('not_a_feature', 1);
    expect(seen).toHaveLength(0);
  });

  it('normalises a non-finite or negative week', () => {
    const seen = setup();
    featureAdoption.record('pets', NaN);
    expect(seen[0].props.weeksLived).toBe(0);
    featureAdoption.startSession();
    featureAdoption.configure({ firstUse: {}, emit: seen.push.bind(seen) as never });
    featureAdoption.record('travel', -12);
    expect(featureAdoption.getFirstUse().travel).toBe(0);
  });

  it('never throws even when the emitter does', () => {
    // Telemetry must never take down a player's session.
    featureAdoption.configure({
      firstUse: {},
      emit: () => {
        throw new Error('sink exploded');
      },
    });
    expect(() => featureAdoption.record('luxury', 3)).not.toThrow();
  });
});
