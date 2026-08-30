/**
 * Dev-only analytics inspector.
 *
 * WHY IT EXISTS. Verifying instrumentation without one means reading the
 * network tab of a device that batches every 60 seconds, or trusting that a
 * `track()` call you can see in the source actually ran with the properties you
 * expect. Both are how instrumentation bugs ship: the event fires, so nobody
 * looks again, and the property that the whole funnel joins on is `undefined`.
 *
 * WHAT IT RECORDS. Events as they are ACCEPTED by `track()` — after validation,
 * after scrubbing, after de-duplication — because that is the shape that
 * actually leaves the device. Recording the call-site arguments instead would
 * show you what you meant rather than what you sent, which is the thing already
 * in the source file.
 *
 * WHY IT IS BOUNDED AND WHY IT IS `__DEV__`-ONLY. A ring buffer, so a long
 * session cannot grow it; and gated on `__DEV__`, so a production build neither
 * retains player events in memory nor exposes an inspection surface to anyone
 * who reaches the debug menu. The gate is checked on WRITE rather than at
 * module load: `__DEV__` is statically foldable, so a production bundle drops
 * the retained array entirely.
 */
import type { AnalyticsProps } from './events';

/** One accepted event, as it will be sent. */
export interface DebugEventRecord {
  name: string;
  ts: string;
  sessionId: string;
  props?: AnalyticsProps;
}

/** Ring capacity. Deep enough for a full session's funnel, shallow enough to skim. */
export const DEBUG_BUFFER_SIZE = 100;

let buffer: DebugEventRecord[] = [];

/** Record an accepted event. No-op outside `__DEV__`. */
export function recordDebugEvent(record: DebugEventRecord): void {
  if (!__DEV__) return;
  buffer.push(record);
  if (buffer.length > DEBUG_BUFFER_SIZE) {
    buffer = buffer.slice(buffer.length - DEBUG_BUFFER_SIZE);
  }
}

/** Everything recorded this session, oldest first. */
export function getDebugEvents(): readonly DebugEventRecord[] {
  return buffer;
}

/**
 * Per-event-name counts — the fastest read of "did my instrumentation fire, and
 * how often". A name at 0 is absent from the map, which is the finding.
 */
export function getDebugEventCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of buffer) {
    counts[record.name] = (counts[record.name] ?? 0) + 1;
  }
  return counts;
}

/** Clear the ring (between manual test runs, and in unit tests). */
export function clearDebugEvents(): void {
  buffer = [];
}
