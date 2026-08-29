import {
  BUCKET_COUNT,
  CONTROL_VARIANT,
  EXPERIMENTS,
  assignVariant,
  bucketFor,
  hashString,
  validateExperiment,
  type ExperimentDefinition,
} from '../experiments';

/** A well-formed fixture. The live registry is empty by design (see experiments.ts). */
function fixture(overrides: Partial<ExperimentDefinition> = {}): ExperimentDefinition {
  return {
    id: 'paywall_headline_test',
    hypothesis: 'A value-led headline converts better than a price-led one.',
    primaryMetric: 'purchase_succeeded',
    secondaryMetrics: ['paywall_cta_tapped'],
    guardrailMetrics: ['retention_day', 'session_end'],
    minimumSamplePerVariant: 500,
    decisionRule: 'Ship the winner at p<0.05 with no guardrail regression.',
    enabled: true,
    variants: [
      { id: 'control', weight: 50 },
      { id: 'value_led', weight: 50 },
    ],
    ...overrides,
  };
}

describe('hashString', () => {
  it('is deterministic', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
  });

  it('separates similar inputs', () => {
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('is always a non-negative 32-bit integer', () => {
    // A signed result would produce a negative bucket and silently exclude a
    // slice of the population from every experiment.
    for (const input of ['', 'a', 'zzzzzzzzzzzz', '💥', 'install-1234567890']) {
      const h = hashString(input);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('bucketFor', () => {
  it('is stable for the same install and experiment', () => {
    expect(bucketFor('install-a', 'exp-1')).toBe(bucketFor('install-a', 'exp-1'));
  });

  it('is always inside the bucket range', () => {
    for (let i = 0; i < 200; i++) {
      const b = bucketFor(`install-${i}`, 'exp-1');
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(BUCKET_COUNT);
    }
  });

  it('salts by experiment id, so concurrent experiments are independent', () => {
    // Without the salt, every experiment's treatment arm lands on the same
    // players and a second experiment can only ever measure itself plus the
    // first. Measured as a low overlap of same-arm assignment, not equality of
    // one pair, which could coincide.
    const a = fixture({ id: 'exp-a' });
    const b = fixture({ id: 'exp-b' });
    let same = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const install = `install-${i}`;
      if (assignVariant(a, install) === assignVariant(b, install)) same += 1;
    }
    // Independent 50/50 assignments agree ~50% of the time; a shared bucketing
    // would agree 100%.
    expect(same / N).toBeGreaterThan(0.4);
    expect(same / N).toBeLessThan(0.6);
  });
});

describe('assignVariant', () => {
  it('is stable across calls - the property the whole design exists for', () => {
    const def = fixture();
    const first = assignVariant(def, 'install-xyz');
    for (let i = 0; i < 20; i++) expect(assignVariant(def, 'install-xyz')).toBe(first);
  });

  it('splits roughly according to the weights', () => {
    const def = fixture({
      variants: [
        { id: 'control', weight: 80 },
        { id: 'treatment', weight: 20 },
      ],
    });
    let treatment = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      if (assignVariant(def, `install-${i}`) === 'treatment') treatment += 1;
    }
    expect(treatment / N).toBeGreaterThan(0.16);
    expect(treatment / N).toBeLessThan(0.24);
  });

  it('normalises weights that do not sum to 100', () => {
    const def = fixture({
      variants: [
        { id: 'control', weight: 1 },
        { id: 'treatment', weight: 3 },
      ],
    });
    let treatment = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      if (assignVariant(def, `install-${i}`) === 'treatment') treatment += 1;
    }
    expect(treatment / N).toBeGreaterThan(0.7);
    expect(treatment / N).toBeLessThan(0.8);
  });

  it('never returns a variant the definition does not declare', () => {
    const def = fixture();
    const declared = new Set(def.variants.map((v) => v.id));
    for (let i = 0; i < 2000; i++) {
      expect(declared.has(assignVariant(def, `install-${i}`))).toBe(true);
    }
  });

  it('resolves everyone to control when the experiment is disabled', () => {
    const def = fixture({ enabled: false });
    for (let i = 0; i < 50; i++) {
      expect(assignVariant(def, `install-${i}`)).toBe(CONTROL_VARIANT);
    }
  });

  it('degrades to control on a misconfiguration rather than throwing', () => {
    // A misconfigured experiment must show today's product, never crash and
    // never invent an arm nobody declared.
    expect(assignVariant(fixture({ variants: [] }), 'i')).toBe(CONTROL_VARIANT);
    expect(
      assignVariant(fixture({ variants: [{ id: 'control', weight: 0 }, { id: 'b', weight: 0 }] }), 'i'),
    ).toBe(CONTROL_VARIANT);
    expect(
      assignVariant(fixture({ variants: [{ id: 'control', weight: NaN }, { id: 'b', weight: -5 }] }), 'i'),
    ).toBe(CONTROL_VARIANT);
  });

  it('handles an empty install id without throwing', () => {
    expect(typeof assignVariant(fixture(), '')).toBe('string');
  });
});

describe('validateExperiment', () => {
  it('accepts a well-formed definition', () => {
    expect(validateExperiment(fixture())).toEqual([]);
  });

  it('rejects an experiment with no guardrails', () => {
    // A conversion win that cannot be checked for harm is not a win (§31).
    expect(validateExperiment(fixture({ guardrailMetrics: [] }))).toContainEqual(
      expect.stringContaining('guardrail'),
    );
  });

  it('rejects an experiment with no control arm', () => {
    const problems = validateExperiment(
      fixture({ variants: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }] }),
    );
    expect(problems.some((p) => p.includes("no 'control' variant"))).toBe(true);
  });

  it('rejects a missing hypothesis, decision rule, or sample floor', () => {
    expect(validateExperiment(fixture({ hypothesis: '  ' })).length).toBeGreaterThan(0);
    expect(validateExperiment(fixture({ decisionRule: '' })).length).toBeGreaterThan(0);
    expect(validateExperiment(fixture({ minimumSamplePerVariant: 0 })).length).toBeGreaterThan(0);
  });

  it('rejects duplicate variant ids', () => {
    const problems = validateExperiment(
      fixture({ variants: [{ id: 'control', weight: 1 }, { id: 'control', weight: 1 }] }),
    );
    expect(problems.some((p) => p.includes('duplicate variant'))).toBe(true);
  });
});

describe('the live registry', () => {
  it('every registered experiment is well formed', () => {
    // The gate that stops an unanswerable experiment reaching players: this
    // fails in CI the moment one is added without a hypothesis, a guardrail, a
    // sample floor or a control arm.
    for (const definition of EXPERIMENTS) {
      expect(validateExperiment(definition)).toEqual([]);
    }
  });

  it('has no duplicate ids', () => {
    const ids = EXPERIMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
