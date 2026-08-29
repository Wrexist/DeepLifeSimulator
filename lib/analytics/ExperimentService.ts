/**
 * ExperimentService — assignment, pinning, and exposure.
 *
 * Three responsibilities, and the distinction between the second and third is
 * the one that decides whether an experiment can be read at all.
 *
 * **Assignment** is pure (see `experiments.ts`): a hash of install id and
 * experiment id. This service does not draw it; it looks it up.
 *
 * **Pinning** is the narrow job persistence actually does. The hash is already
 * stable across launches and storage clears, so nothing needs saving to keep a
 * player on one arm — *until the weights change*. Widening a 50/50 to 80/20
 * mid-flight would re-bucket a slice of the population, and a player who moves
 * from control to treatment halfway through contaminates both arms in a way no
 * downstream analysis can unpick. So the first resolved variant is written
 * down, and afterwards the stored value WINS over a fresh hash. A cleared cache
 * falls back to the hash, which is the same answer in every case except the one
 * where the weights moved — exactly the failure mode pinning exists for.
 *
 * **Exposure** is not assignment (§29). Every install is assigned to every
 * running experiment the moment the registry loads, whether or not they ever
 * reach the thing being tested. Counting assignment as exposure buries the
 * effect under the majority who never saw either arm — a paywall experiment
 * measured over everyone who opened the app rather than everyone who opened the
 * paywall. `exposure()` is therefore called at the point the player actually
 * encounters the varied surface, and it is what the analysis denominates on.
 *
 * Never throws. An experiment system that can crash the app is worse than no
 * experiment system, because it fails on the players you were measuring.
 */
import { logger } from '@/utils/logger';
import {
  assignVariant,
  CONTROL_VARIANT,
  EXPERIMENTS,
  findExperiment,
  type ExperimentDefinition,
} from './experiments';
import { analyticsStorage, readJsonRecord } from './storage';
import { MAX_STRING_LENGTH } from './validation';

/** AsyncStorage key. Versioned so a shape change is a new key, not a reinterpretation. */
export const EXPERIMENT_ASSIGNMENTS_KEY = 'analytics_experiment_assignments_v1';

/** experimentId → pinned variant id. */
export type AssignmentMap = Record<string, string>;

/**
 * Parse a stored assignment map, keeping only string→string entries.
 *
 * Strict on purpose: a malformed entry that survived would pin a player to a
 * variant that does not exist, and every read of it would silently fall back to
 * control while the analysis still counted them as pinned.
 */
export function parseAssignments(raw: Record<string, unknown> | null): AssignmentMap {
  if (!raw) return {};
  const out: AssignmentMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === 'string' && key && typeof value === 'string' && value) out[key] = value;
  }
  return out;
}

type ExposureEmitter = (experimentId: string, variantId: string) => void;

class ExperimentServiceImpl {
  private installId = '';
  private assignments: AssignmentMap = {};
  private registry: readonly ExperimentDefinition[] = EXPERIMENTS;
  private loaded = false;
  private dirty = false;
  /** Experiments already exposed THIS session — exposure is once per session. */
  private exposed = new Set<string>();
  private emit: ExposureEmitter | null = null;
  /** Memoised envelope value; `undefined` means "not computed yet". */
  private assignmentsProperty: string | undefined = undefined;

  /**
   * Load pinned assignments and resolve every enabled experiment.
   *
   * Called from `AnalyticsService.init()` with the install id it has just
   * resolved, so assignment and the event envelope agree on one identity.
   */
  async init(installId: string, emit: ExposureEmitter): Promise<void> {
    this.installId = installId || '';
    this.emit = emit;
    if (this.loaded) return;
    try {
      this.assignments = parseAssignments(await readJsonRecord(EXPERIMENT_ASSIGNMENTS_KEY));
      this.assignmentsProperty = undefined;
      // Resolve (and pin) everything enabled now, so `getAssignments()` can be a
      // synchronous read for the event envelope — `track()` must never await.
      for (const definition of this.registry) {
        if (definition.enabled) this.resolve(definition);
      }
      if (this.dirty) await this.persist();
    } catch (error) {
      logger.debug('[experiments] init failed (non-fatal)', { error });
    } finally {
      this.loaded = true;
    }
  }

  /**
   * The variant this install is in, pinning it on first resolution.
   *
   * A stored pin wins over a fresh hash — see the header. An UNKNOWN experiment
   * id resolves to control rather than throwing: a call site left behind after
   * an experiment was removed should render today's product, not crash.
   */
  private resolve(definition: ExperimentDefinition): string {
    const pinned = this.assignments[definition.id];
    if (pinned) {
      if (definition.variants.some((v) => v.id === pinned)) return pinned;
      // A pin naming a variant the definition no longer declares is stale — the
      // arm was removed mid-flight. Control, and NOT a fresh hash: re-assigning
      // would move the player into one of the surviving arms partway through
      // the experiment, which is precisely the mid-flight re-bucketing pinning
      // exists to prevent. Their arm is gone, so they see today's product and
      // are labelled as such.
      //
      // Deliberately not re-pinned. If the arm is restored — a rollback, or a
      // publish that dropped it by mistake — the original pin is still on disk
      // and the player returns to the arm they were in, rather than having been
      // silently rewritten to control by an outage.
      return CONTROL_VARIANT;
    }
    const variant = assignVariant(definition, this.installId);
    this.assignments[definition.id] = variant;
    this.dirty = true;
    this.assignmentsProperty = undefined; // a new arm changes the envelope
    return variant;
  }

  /**
   * The variant for `experimentId`, or `'control'` when it is unknown or off.
   *
   * Synchronous by design: it is called from render paths that decide which
   * surface to show, and an async gate there would flash the control arm before
   * the treatment resolved — which is itself an exposure of the wrong variant.
   */
  getVariant(experimentId: string): string {
    try {
      const definition = findExperiment(experimentId, this.registry);
      if (!definition || !definition.enabled) return CONTROL_VARIANT;
      return this.resolve(definition);
    } catch (error) {
      logger.debug('[experiments] getVariant failed (non-fatal)', { error });
      return CONTROL_VARIANT;
    }
  }

  /**
   * Record that the player ACTUALLY encountered the varied surface.
   *
   * Once per experiment per session: an exposure is "this install saw the arm",
   * and firing it on every render of a paywall would make one indecisive player
   * look like twenty. The session grain (rather than once ever) keeps the
   * denominator recomputable per day without a device-side lifetime flag that
   * could be lost.
   *
   * No-op for unknown or disabled experiments — nobody is exposed to an
   * experiment that is not running, and counting them would dilute the arm.
   */
  exposure(experimentId: string): void {
    try {
      const definition = findExperiment(experimentId, this.registry);
      if (!definition || !definition.enabled) return;
      if (this.exposed.has(experimentId)) return;
      this.exposed.add(experimentId);
      const variant = this.resolve(definition);
      if (this.dirty) void this.persist();
      this.emit?.(experimentId, variant);
    } catch (error) {
      logger.debug('[experiments] exposure failed (non-fatal)', { error });
    }
  }

  /**
   * Assignments for the event envelope, as a compact `id:variant` list.
   *
   * A string rather than an object because `AnalyticsProps` is flat by design
   * (transport safety), and one column that a query can `LIKE`-match beats N
   * columns that change shape every time an experiment starts or stops.
   *
   * Returns `undefined` — not an empty string — when nothing is running, so the
   * key is absent from the event rather than present and empty.
   */
  getAssignmentsProperty(): string | undefined {
    try {
      if (this.assignmentsProperty !== undefined) return this.assignmentsProperty || undefined;

      const entries = this.registry
        .filter((d) => d.enabled && this.assignments[d.id])
        .map((d) => `${d.id}:${this.assignments[d.id]}`)
        .sort();

      // Truncate at a PAIR boundary, never mid-pair. The value rides in a
      // Firebase parameter, which is capped at MAX_STRING_LENGTH and enforced
      // by truncation — a blind cut would leave a half-written experiment id
      // that silently reads as a different experiment, and a half-written
      // variant that reads as a different arm. Dropping whole pairs loses
      // experiments from the envelope; cutting inside one INVENTS them.
      let joined = '';
      for (const entry of entries) {
        const next = joined ? `${joined},${entry}` : entry;
        if (next.length > MAX_STRING_LENGTH) break;
        joined = next;
      }

      // Cached because it cannot change without an assignment changing, and it
      // is read on EVERY tracked event — re-filtering and re-sorting the
      // registry per event is work with a constant answer.
      this.assignmentsProperty = joined;
      return joined || undefined;
    } catch {
      return undefined;
    }
  }

  /** The raw pinned map, for tests and the debug snapshot. */
  getAssignments(): AssignmentMap {
    return { ...this.assignments };
  }

  /**
   * Test/override hook. Swaps the registry and identity without AsyncStorage.
   *
   * Mirrors `AnalyticsService.configure()` so both halves of the system are
   * testable the same way.
   */
  configure(override: {
    installId?: string;
    registry?: readonly ExperimentDefinition[];
    assignments?: AssignmentMap;
    emit?: ExposureEmitter;
  }): void {
    if (override.installId !== undefined) this.installId = override.installId;
    if (override.registry !== undefined) this.registry = override.registry;
    if (override.assignments !== undefined) this.assignments = { ...override.assignments };
    if (override.emit !== undefined) this.emit = override.emit;
    this.assignmentsProperty = undefined;
    this.exposed.clear();
    this.loaded = true;
    this.dirty = false;
  }

  private async persist(): Promise<void> {
    this.dirty = false;
    await analyticsStorage.setItem(EXPERIMENT_ASSIGNMENTS_KEY, JSON.stringify(this.assignments));
  }
}

export const experiments = new ExperimentServiceImpl();

/** Convenience free functions — the primary call-site API. */
export function getVariant(experimentId: string): string {
  return experiments.getVariant(experimentId);
}

export function trackExposure(experimentId: string): void {
  experiments.exposure(experimentId);
}
