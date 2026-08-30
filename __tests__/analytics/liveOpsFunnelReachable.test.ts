/**
 * Every declared live-ops event must have an emitter.
 *
 * WHY THIS IS PINNED. Three of these seven steps shipped with no caller at all
 * in the first pass of this system - `progressed`, `completed` and `expired` -
 * and nothing about that fails a build, throws, or looks wrong in review. It is
 * the same failure this repo has recorded twice: `session_end` was in the
 * catalogue and emitted by nothing, and the entire weekly-challenge system was
 * built and never rendered. A declared-but-unemitted event is invisible in
 * every way that matters, and the funnel it belongs to silently reports a cliff
 * where the instrumentation simply stops.
 *
 * This is a static scan rather than a runtime assertion on purpose: the whole
 * point is to catch a step that NOTHING calls, which by definition no runtime
 * test would ever exercise.
 */
import fs from 'fs';
import path from 'path';
import { ANALYTICS_EVENT_NAME_LIST } from '@/lib/analytics/events';

const ROOT = path.resolve(__dirname, '..', '..');
const SEARCH_DIRS = ['lib', 'hooks', 'components', 'contexts', 'app', 'utils', 'services', 'src'];

/** Files that DECLARE the catalogue rather than emit from it. */
const DECLARATION_FILES = new Set([
  path.join('lib', 'analytics', 'events.ts'),
  path.join('lib', 'analytics', 'validation.ts'),
]);

function* walk(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

const sources: { rel: string; text: string }[] = [];
for (const dir of SEARCH_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    if (DECLARATION_FILES.has(rel)) continue;
    sources.push({ rel, text: fs.readFileSync(file, 'utf-8') });
  }
}

const emitters = (name: string): string[] =>
  sources.filter((s) => s.text.includes(`'${name}'`)).map((s) => s.rel);

describe('live-ops funnel instrumentation is reachable', () => {
  const liveOpsEvents = ANALYTICS_EVENT_NAME_LIST.filter(
    (n) => n.startsWith('live_event_') || n.startsWith('liveops_'),
  );

  it('covers the whole funnel, so no step can be quietly dropped', () => {
    expect(liveOpsEvents.length).toBeGreaterThanOrEqual(8);
  });

  it.each(liveOpsEvents)('%s is emitted by production code', (name) => {
    expect({ name, emitters: emitters(name) }).toEqual({
      name,
      emitters: expect.arrayContaining([expect.any(String)]),
    });
    expect(emitters(name).length).toBeGreaterThan(0);
  });

  it('the funnel can be assembled end to end', () => {
    // Each step answers a different failure. `shown` vs `opened` separates a
    // discovery problem from a design one; `completed` vs `claimed` is the
    // "did the work, never got paid" gap; `expired` is the drop-off the hub
    // deliberately hides from the player and so nothing else can see.
    for (const step of [
      'live_event_shown',
      'live_event_opened',
      'live_event_progressed',
      'live_event_completed',
      'live_event_claimed',
      'live_event_expired',
    ]) {
      expect(emitters(step).length).toBeGreaterThan(0);
    }
  });
});
