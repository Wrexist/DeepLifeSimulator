/**
 * Experiments — the registry and the pure assignment maths.
 *
 * WHY THE SHAPE IS THE ENFORCEMENT. "Do not run experiments without a question"
 * is easy to write in a doc and impossible to enforce there. So the fields that
 * make an experiment answerable — hypothesis, primary metric, guardrails,
 * minimum sample, decision rule — are REQUIRED members of
 * `ExperimentDefinition`. An experiment with no hypothesis does not fail review;
 * it fails `tsc`. That is the whole reason this type is as wide as it is.
 *
 * WHY ASSIGNMENT IS A HASH AND NOT A COIN FLIP. A player must see the same
 * variant on every launch, forever, on a device that may have cleared storage
 * and in a process that may have failed to read it. Persisting a random draw
 * gives you a variant that survives exactly as long as the storage does — and a
 * player who flips from control to treatment mid-experiment poisons BOTH arms,
 * silently, in a direction no analysis can undo. Hashing `installId:experimentId`
 * makes the assignment a pure function of two stable strings: the same inputs
 * give the same bucket on every device, in every process, with no storage at
 * all. Persistence (see `ExperimentService`) then exists for one narrower job —
 * pinning an in-flight assignment against a later change to the WEIGHTS — not
 * as the source of truth.
 *
 * WHY THE EXPERIMENT ID IS IN THE HASH. Hashing the install id alone would put
 * every experiment's treatment arm on the same players, so a second experiment
 * could only ever measure itself plus the first. Salting with the experiment id
 * re-shuffles the population per experiment, which is what makes concurrent
 * experiments independent.
 */

/** One arm of an experiment. */
export interface ExperimentVariant {
  /** Stable id. Exactly one variant per experiment must be `'control'`. */
  id: string;
  /**
   * Relative weight. Not required to sum to 100 — weights are normalised — so
   * a 1:1:2 split can be written as `1, 1, 2` without arithmetic at the call
   * site getting it wrong.
   */
  weight: number;
}

/**
 * A registered experiment.
 *
 * Every metric field is a plain string naming an EVENT (or an event-derived
 * metric) from the catalogue in `events.ts`, so a reader can go from the
 * definition to the data without a translation step.
 */
export interface ExperimentDefinition {
  id: string;
  /** What we believe, and why. Required — see the header. */
  hypothesis: string;
  /** The single metric the decision is made on. */
  primaryMetric: string;
  /** Read to understand the result; never to declare a win on their own. */
  secondaryMetrics: readonly string[];
  /**
   * Metrics that can only LOSE. A conversion win that moves one of these the
   * wrong way is not a win (§31) — retention, crashes and economy health are
   * the usual three.
   */
  guardrailMetrics: readonly string[];
  /** Exposed installs per arm below which the result is not read. */
  minimumSamplePerVariant: number;
  /** What we will do with each possible outcome, written BEFORE the run. */
  decisionRule: string;
  /**
   * Off means everyone resolves to control and NOTHING is exposed — the kill
   * switch. Kept separate from deleting the definition so a stopped experiment
   * still documents what was run.
   */
  enabled: boolean;
  variants: readonly ExperimentVariant[];
}

export const CONTROL_VARIANT = 'control';

/**
 * The live registry.
 *
 * Deliberately EMPTY at the point this lands. Shipping the infrastructure and
 * shipping a running experiment are different decisions, and inventing an
 * experiment to prove the plumbing works would put a real behaviour change in
 * front of real players to serve a demo. The first entry is a product call.
 * `__tests__` exercise the machinery against fixture definitions instead.
 *
 * To add one, append a definition here — the required fields are the checklist.
 */
export const EXPERIMENTS: readonly ExperimentDefinition[] = [];

/** Look one up by id. */
export function findExperiment(
  id: string,
  registry: readonly ExperimentDefinition[] = EXPERIMENTS,
): ExperimentDefinition | undefined {
  return registry.find((e) => e.id === id);
}

/**
 * FNV-1a, 32-bit. Small, dependency-free, well-distributed for short strings.
 *
 * Not a cryptographic hash and does not need to be: it decides a bucket, not a
 * secret. What it DOES need is to be identical on every platform and stable
 * forever — a change here re-buckets every in-flight experiment — which rules
 * out anything from a native module or a library that could be upgraded.
 *
 * `>>> 0` keeps the value unsigned; JS bitwise operators otherwise produce a
 * signed 32-bit int and a negative bucket.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime (16777619) via shifts — `hash * 16777619` loses precision
    // past 2^53 and would make the hash platform-dependent.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** Buckets are 0..9999 — fine-grained enough for a 1% arm. */
export const BUCKET_COUNT = 10_000;

/**
 * The stable bucket for one install in one experiment.
 *
 * Pure and total: any pair of strings yields a bucket, so a missing install id
 * degrades to a consistent (if not independent) assignment rather than an error.
 */
export function bucketFor(installId: string, experimentId: string): number {
  return hashString(`${installId}:${experimentId}`) % BUCKET_COUNT;
}

/**
 * Resolve an install to a variant id.
 *
 * Returns `CONTROL_VARIANT` for every degenerate case — a disabled experiment,
 * no variants, all-zero or negative weights, a missing control. Never throws
 * and never returns a variant that is not in the definition: an experiment
 * misconfiguration must degrade to "the player sees today's product", never to
 * a crash and never to an arm nobody declared.
 */
export function assignVariant(definition: ExperimentDefinition, installId: string): string {
  if (!definition.enabled) return CONTROL_VARIANT;

  const usable = definition.variants.filter(
    (v) => !!v.id && Number.isFinite(v.weight) && v.weight > 0,
  );
  if (usable.length === 0) return CONTROL_VARIANT;

  const totalWeight = usable.reduce((sum, v) => sum + v.weight, 0);
  if (!(totalWeight > 0)) return CONTROL_VARIANT;

  const bucket = bucketFor(installId, definition.id);
  // Map the bucket onto the weight line. Using the bucket (not the raw hash)
  // keeps the arithmetic in a small integer range and makes the split
  // reproducible by hand from the bucket alone when auditing an assignment.
  const point = (bucket / BUCKET_COUNT) * totalWeight;

  let cumulative = 0;
  for (const variant of usable) {
    cumulative += variant.weight;
    if (point < cumulative) return variant.id;
  }
  // Floating-point residue at the very top of the line. The last usable variant
  // is the correct answer; falling through to control would quietly over-weight
  // the control arm by a hair on every experiment.
  return usable[usable.length - 1].id;
}

/** Problems found in a definition. Empty means well-formed. */
export function validateExperiment(definition: ExperimentDefinition): string[] {
  const problems: string[] = [];
  if (!definition.id) problems.push('missing id');
  if (!definition.hypothesis.trim()) problems.push(`${definition.id}: empty hypothesis`);
  if (!definition.primaryMetric.trim()) problems.push(`${definition.id}: no primary metric`);
  if (definition.guardrailMetrics.length === 0) {
    problems.push(`${definition.id}: no guardrail metrics - a win here cannot be checked for harm`);
  }
  if (!(definition.minimumSamplePerVariant > 0)) {
    problems.push(`${definition.id}: minimumSamplePerVariant must be > 0`);
  }
  if (!definition.decisionRule.trim()) problems.push(`${definition.id}: no decision rule`);
  if (definition.variants.length < 2) problems.push(`${definition.id}: needs at least 2 variants`);
  if (!definition.variants.some((v) => v.id === CONTROL_VARIANT)) {
    problems.push(`${definition.id}: no '${CONTROL_VARIANT}' variant`);
  }
  const ids = new Set<string>();
  for (const variant of definition.variants) {
    if (ids.has(variant.id)) problems.push(`${definition.id}: duplicate variant '${variant.id}'`);
    ids.add(variant.id);
    if (!Number.isFinite(variant.weight) || variant.weight < 0) {
      problems.push(`${definition.id}: variant '${variant.id}' has invalid weight`);
    }
  }
  if (!definition.variants.some((v) => Number.isFinite(v.weight) && v.weight > 0)) {
    problems.push(`${definition.id}: all weights are zero - nobody can be assigned`);
  }
  return problems;
}
