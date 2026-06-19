/**
 * H3 — per-phase weekly-tick profiler.
 *
 * Turns the opaque "nextWeek mean ~85ms / p95 ~104ms" into a per-phase breakdown so the
 * tick-decomposition work optimizes the genuinely hot phases with data, not guesses.
 *
 * Design:
 *   - **No-op unless enabled** (default OFF) → zero production cost and zero behaviour
 *     change. Enabled by `EXPO_PUBLIC_PROFILE_TICK=true` at boot, or `setEnabled(true)`
 *     at runtime (debug overlay) / in tests.
 *   - `beginTick()` at the top of the tick, `mark(label)` after each phase, `endTick()`
 *     at the end. Each `mark` records the elapsed time since the previous mark/beginTick
 *     under `label`; durations accumulate into a rolling window (mean / p95 / max).
 *   - Uses `performance.now()` (Hermes + jest provide it) with a `Date.now()` fallback.
 *
 * NOTE: the tick updater is a pure function that React StrictMode invokes twice in dev.
 * With the profiler enabled under StrictMode each phase is sampled twice per tick — the
 * absolute counts double but the RELATIVE breakdown (which phase is hot) is unaffected.
 */
import { logger } from '@/utils/logger';

export interface PhaseSummary {
  phase: string;
  count: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface TickProfileSummary {
  ticks: number;
  /** Phases sorted hottest-first by p95. */
  phases: PhaseSummary[];
  /** Sum of per-phase means — approximate mean total tick cost. */
  totalMeanMs: number;
}

const MAX_SAMPLES = 120;
const log = logger.scope('tickProfiler');

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

interface PhaseAcc {
  count: number;
  samples: number[]; // rolling window, newest appended
  max: number;
}

class TickProfiler {
  private enabled = process.env.EXPO_PUBLIC_PROFILE_TICK === 'true';
  private lastMark = 0;
  private started = false;
  private tickCount = 0;
  private logEvery = 25;
  private phases = new Map<string, PhaseAcc>();
  private summarySink: ((s: TickProfileSummary) => void) | null = null;

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Divert the periodic summary (default: logger in __DEV__). Used by tests to stay quiet. */
  setSummarySink(sink: ((s: TickProfileSummary) => void) | null): void {
    this.summarySink = sink;
  }

  beginTick(): void {
    if (!this.enabled) return;
    this.lastMark = nowMs();
    this.started = true;
  }

  mark(label: string): void {
    if (!this.enabled || !this.started) return;
    const t = nowMs();
    this.record(label, t - this.lastMark);
    this.lastMark = t;
  }

  endTick(): void {
    if (!this.enabled || !this.started) return;
    this.started = false;
    this.tickCount += 1;
    if (this.logEvery > 0 && this.tickCount % this.logEvery === 0) {
      this.emitSummary();
    }
  }

  getSummary(): TickProfileSummary {
    const phases: PhaseSummary[] = [];
    let totalMeanMs = 0;
    for (const [phase, acc] of this.phases) {
      const sorted = [...acc.samples].sort((a, b) => a - b);
      const mean = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
      phases.push({
        phase,
        count: acc.count,
        meanMs: round2(mean),
        p95Ms: round2(percentile(sorted, 95)),
        maxMs: round2(acc.max),
      });
      totalMeanMs += mean;
    }
    phases.sort((a, b) => b.p95Ms - a.p95Ms); // hottest first
    return { ticks: this.tickCount, phases, totalMeanMs: round2(totalMeanMs) };
  }

  reset(): void {
    this.phases.clear();
    this.tickCount = 0;
    this.started = false;
  }

  private record(label: string, durationMs: number): void {
    if (!(durationMs >= 0) || !isFinite(durationMs)) return;
    let acc = this.phases.get(label);
    if (!acc) {
      acc = { count: 0, samples: [], max: 0 };
      this.phases.set(label, acc);
    }
    acc.count += 1;
    if (durationMs > acc.max) acc.max = durationMs;
    acc.samples.push(durationMs);
    if (acc.samples.length > MAX_SAMPLES) acc.samples.shift();
  }

  private emitSummary(): void {
    const summary = this.getSummary();
    if (this.summarySink) {
      this.summarySink(summary);
      return;
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      log.info('weekly-tick phase profile', summary);
    }
  }
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Process-wide singleton — the tick runs in one place, so one instance is enough. */
export const tickProfiler = new TickProfiler();
