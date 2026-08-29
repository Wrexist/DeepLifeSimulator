import { experiments, parseAssignments } from '../ExperimentService';
import { CONTROL_VARIANT, type ExperimentDefinition } from '../experiments';

function fixture(overrides: Partial<ExperimentDefinition> = {}): ExperimentDefinition {
  return {
    id: 'exp_a',
    hypothesis: 'h',
    primaryMetric: 'purchase_succeeded',
    secondaryMetrics: [],
    guardrailMetrics: ['retention_day'],
    minimumSamplePerVariant: 100,
    decisionRule: 'ship on win',
    enabled: true,
    variants: [
      { id: 'control', weight: 50 },
      { id: 'treatment', weight: 50 },
    ],
    ...overrides,
  };
}

type Exposure = { experimentId: string; variantId: string };

function setup(registry: readonly ExperimentDefinition[], installId = 'install-1', assignments = {}) {
  const seen: Exposure[] = [];
  experiments.configure({
    installId,
    registry,
    assignments,
    emit: (experimentId, variantId) => seen.push({ experimentId, variantId }),
  });
  return seen;
}

describe('parseAssignments', () => {
  it('keeps only string→string entries', () => {
    expect(parseAssignments({ a: 'x', b: 2, c: null, d: 'y' } as Record<string, unknown>)).toEqual({
      a: 'x',
      d: 'y',
    });
  });

  it('returns an empty map for a missing or corrupt record', () => {
    expect(parseAssignments(null)).toEqual({});
  });
});

describe('getVariant', () => {
  it('returns a declared variant for an enabled experiment', () => {
    setup([fixture()]);
    expect(['control', 'treatment']).toContain(experiments.getVariant('exp_a'));
  });

  it('returns control for an UNKNOWN experiment rather than throwing', () => {
    // A call site left behind after an experiment is removed must render
    // today's product, not crash.
    setup([fixture()]);
    expect(experiments.getVariant('never_registered')).toBe(CONTROL_VARIANT);
  });

  it('returns control for a disabled experiment', () => {
    setup([fixture({ enabled: false })]);
    expect(experiments.getVariant('exp_a')).toBe(CONTROL_VARIANT);
  });

  it('is stable across repeated reads', () => {
    setup([fixture()]);
    const first = experiments.getVariant('exp_a');
    for (let i = 0; i < 10; i++) expect(experiments.getVariant('exp_a')).toBe(first);
  });
});

describe('pinning', () => {
  it('a stored assignment WINS over a fresh hash', () => {
    // The one job persistence does. Without it, changing the weights mid-flight
    // re-buckets a slice of the population and contaminates both arms.
    setup([fixture()], 'install-1', { exp_a: 'treatment' });
    expect(experiments.getVariant('exp_a')).toBe('treatment');

    // Same install, weights moved hard toward control — the pin must hold.
    setup(
      [fixture({ variants: [{ id: 'control', weight: 99 }, { id: 'treatment', weight: 1 }] })],
      'install-1',
      { exp_a: 'treatment' },
    );
    expect(experiments.getVariant('exp_a')).toBe('treatment');
  });

  it('a pin naming a variant that no longer exists falls back to control', () => {
    // The arm was removed mid-flight. Continuing to LABEL the player with it
    // would attribute control behaviour to a treatment that is not running.
    setup([fixture()], 'install-1', { exp_a: 'removed_arm' });
    expect(experiments.getVariant('exp_a')).toBe(CONTROL_VARIANT);
  });

  it('falls back to the hash when there is no pin, giving the same answer', () => {
    setup([fixture()], 'install-7');
    const fromHash = experiments.getVariant('exp_a');
    // Simulate a cleared cache: same install, no stored assignments.
    setup([fixture()], 'install-7');
    expect(experiments.getVariant('exp_a')).toBe(fromHash);
  });
});

describe('exposure', () => {
  it('emits once per experiment per session, not per call', () => {
    // An indecisive player opening the paywall twenty times is one exposure.
    const seen = setup([fixture()]);
    experiments.exposure('exp_a');
    experiments.exposure('exp_a');
    experiments.exposure('exp_a');
    expect(seen).toHaveLength(1);
    expect(seen[0].experimentId).toBe('exp_a');
  });

  it('emits the variant the player is actually in', () => {
    const seen = setup([fixture()], 'install-1', { exp_a: 'treatment' });
    experiments.exposure('exp_a');
    expect(seen[0].variantId).toBe('treatment');
  });

  it('does NOT emit for a disabled or unknown experiment', () => {
    // Nobody is exposed to an experiment that is not running; counting them
    // would dilute the arm.
    const seen = setup([fixture({ enabled: false })]);
    experiments.exposure('exp_a');
    experiments.exposure('not_registered');
    expect(seen).toHaveLength(0);
  });

  it('assignment alone does NOT count as exposure', () => {
    // The §29 distinction. Reading the variant to decide what to render is not
    // evidence the player ever saw it.
    const seen = setup([fixture()]);
    experiments.getVariant('exp_a');
    experiments.getVariant('exp_a');
    expect(seen).toHaveLength(0);
  });
});

describe('getAssignmentsProperty', () => {
  it('is undefined when nothing is running, so the key is absent from events', () => {
    setup([]);
    expect(experiments.getAssignmentsProperty()).toBeUndefined();
  });

  it('lists enabled experiments as sorted id:variant pairs', () => {
    setup([fixture({ id: 'b_exp' }), fixture({ id: 'a_exp' })], 'install-1', {
      a_exp: 'control',
      b_exp: 'treatment',
    });
    expect(experiments.getAssignmentsProperty()).toBe('a_exp:control,b_exp:treatment');
  });

  it('omits disabled experiments', () => {
    setup([fixture({ id: 'on' }), fixture({ id: 'off', enabled: false })], 'install-1', {
      on: 'control',
      off: 'treatment',
    });
    expect(experiments.getAssignmentsProperty()).toBe('on:control');
  });
});
