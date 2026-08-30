/**
 * Feature adoption — discovery, trial, repeat use, abandonment.
 *
 * THE QUESTION. This game ships ~59 `lib/` domains. Some of them are load-
 * bearing and some are almost certainly dead, and today there is no way to tell
 * which: a feature nobody has ever opened and a feature everybody loves emit
 * exactly the same telemetry, namely none. That makes every "should we improve
 * or remove this?" conversation a matter of taste. Three counts settle it —
 * how many installs ever touched it, how many came back to it, and how many
 * touched it once and never again (§16, §17).
 *
 * THE TWO EVENTS, AND WHY BOTH.
 *  - `feature_first_used` fires ONCE per install, ever. It is the DISCOVERY
 *    number: the denominator for "of everyone who found this, how many stayed".
 *    Persisted, because "ever" has to survive a relaunch — an in-memory set
 *    would re-fire it on every cold start and make discovery look like
 *    engagement.
 *  - `feature_used` fires at most once per feature per SESSION. That is the
 *    RETURN number. Per-session rather than per-interaction on purpose: a
 *    player who taps a screen forty times in one sitting is one returning
 *    player, and counting taps would let a single fidgety session outweigh
 *    forty distinct ones. It also keeps the event budget bounded — the queue
 *    holds 200 events, and per-interaction firing would evict the funnel.
 *
 * WHAT IS NOT COLLECTED. No content, no free text, no per-item detail — just
 * the feature id from the fixed catalogue below. A feature id is a fact about
 * the PRODUCT; what a player did inside it is a fact about the player.
 *
 * NEVER THROWS. Every path swallows its own errors; a telemetry write failing
 * must cost one data point, never a player's session.
 */
import { logger } from '@/utils/logger';
import { analyticsStorage, readJsonRecord } from './storage';

/** AsyncStorage key. Versioned — a shape change is a new key. */
export const FEATURE_ADOPTION_KEY = 'analytics_feature_adoption_v1';

/**
 * The catalogue of measurable features.
 *
 * A CLOSED list, and that is the point: an open string parameter would produce
 * `darkweb`, `dark_web` and `darkWeb` as three features within a month, and
 * every adoption number would be wrong by an amount nobody could see. Adding a
 * feature is a one-line change here; misspelling one is a type error.
 *
 * Scoped to player-facing DOMAINS, not screens. `screen_view` already records
 * navigation; this records that a player engaged with a system.
 */
export const TRACKED_FEATURES = [
  'career',
  'education',
  'business',
  'stocks',
  'crypto',
  'real_estate',
  'banking',
  'dating',
  'family',
  'social_media',
  'crime',
  'darkweb',
  'gambling',
  'travel',
  'luxury',
  'health',
  'politics',
  'prestige',
  'dynasty',
  'legacy_shop',
  'time_machine',
  'mail',
  'pets',
  'hustle',
  'skill_tree',
  'achievements',
  'scenarios',
  'ambitions',
] as const;

export type TrackedFeature = (typeof TRACKED_FEATURES)[number];

const FEATURE_SET: ReadonlySet<string> = new Set<string>(TRACKED_FEATURES);

export function isTrackedFeature(value: string): value is TrackedFeature {
  return FEATURE_SET.has(value);
}

/** featureId → weeksLived (in the player's own clock) at first use. */
export type AdoptionRecord = Record<string, number>;

/**
 * Parse the persisted record, dropping anything not `feature → finite number`.
 *
 * A corrupt entry that survived would either re-fire discovery forever (if it
 * read as absent) or suppress it forever (if it read as present); dropping it
 * costs one player's discovery row and keeps the rest of the column meaningful.
 */
export function parseAdoptionRecord(raw: Record<string, unknown> | null): AdoptionRecord {
  if (!raw) return {};
  const out: AdoptionRecord = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isTrackedFeature(key)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

type FeatureEmitter = (
  name: 'feature_first_used' | 'feature_used',
  props: { feature: string; weeksLived: number; weeksSinceFirstUse?: number },
) => void;

class FeatureAdoptionServiceImpl {
  private firstUse: AdoptionRecord = {};
  private usedThisSession = new Set<string>();
  private loaded = false;
  private emit: FeatureEmitter | null = null;

  /** Load the persisted first-use record. Called from `AnalyticsService.init()`. */
  async init(emit: FeatureEmitter): Promise<void> {
    this.emit = emit;
    if (this.loaded) return;
    try {
      this.firstUse = parseAdoptionRecord(await readJsonRecord(FEATURE_ADOPTION_KEY));
    } catch (error) {
      logger.debug('[adoption] init failed (non-fatal)', { error });
    } finally {
      this.loaded = true;
    }
  }

  /**
   * Record that the player engaged with `feature`.
   *
   * `weeksLived` is the player's own progression clock, carried so that
   * "how far in do players discover this?" is answerable — a feature first
   * touched at week 200 has a discovery problem regardless of how many
   * eventually find it.
   *
   * An unknown feature id is dropped rather than sent: see the catalogue note.
   */
  record(feature: string, weeksLived: number): void {
    try {
      if (!isTrackedFeature(feature)) {
        if (__DEV__) console.warn(`[adoption] unknown feature "${feature}"`);
        return;
      }
      const weeks = Number.isFinite(weeksLived) ? Math.max(0, Math.trunc(weeksLived)) : 0;

      const previouslyFirstUsed = this.firstUse[feature];
      if (previouslyFirstUsed === undefined) {
        this.firstUse[feature] = weeks;
        void this.persist();
        this.emit?.('feature_first_used', { feature, weeksLived: weeks });
        // A first use is also a use. Marking the session here means the same
        // player is not counted again by the `feature_used` branch below on the
        // very same interaction, which would double their return rate.
        this.usedThisSession.add(feature);
        return;
      }

      if (this.usedThisSession.has(feature)) return;
      this.usedThisSession.add(feature);
      this.emit?.('feature_used', {
        feature,
        weeksLived: weeks,
        // How much of the player's life has passed since they found it. This is
        // what separates "came back the next week" from "rediscovered it a year
        // later", which are different products even at the same return rate.
        weeksSinceFirstUse: Math.max(0, weeks - previouslyFirstUsed),
      });
    } catch (error) {
      logger.debug('[adoption] record failed (non-fatal)', { error });
    }
  }

  /** Called when a new session begins, so per-session counting restarts. */
  startSession(): void {
    this.usedThisSession.clear();
  }

  /** The first-use record, for tests and the debug snapshot. */
  getFirstUse(): AdoptionRecord {
    return { ...this.firstUse };
  }

  /** Test hook — mirrors the `configure` shape used elsewhere in this module. */
  configure(override: { firstUse?: AdoptionRecord; emit?: FeatureEmitter }): void {
    if (override.firstUse !== undefined) this.firstUse = { ...override.firstUse };
    if (override.emit !== undefined) this.emit = override.emit;
    this.usedThisSession.clear();
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await analyticsStorage.setItem(FEATURE_ADOPTION_KEY, JSON.stringify(this.firstUse));
  }
}

export const featureAdoption = new FeatureAdoptionServiceImpl();

/** Convenience free function — the primary call-site API. */
export function trackFeatureUse(feature: TrackedFeature, weeksLived: number): void {
  featureAdoption.record(feature, weeksLived);
}
