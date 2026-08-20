/**
 * The funnel must actually be ARMED in a production build.
 *
 * WHY THIS IS PINNED SEPARATELY FROM `analyticsFanout.test.ts`
 * -----------------------------------------------------------
 * That test proves `track()` forwards to Firebase with `telemetry: false` —
 * two independent sinks, exactly as designed. It passes by calling
 * `analytics.configure({ consent: true })` directly, which is what let a real
 * bug hide underneath it for as long as it existed:
 *
 *   `analytics.init()` and `analytics.setConsent()` had exactly ONE production
 *   call site, inside `if (enableTelemetry)` in `app/_layout.tsx`. The
 *   `production` EAS profile sets EXPO_PUBLIC_ENABLE_FIREBASE=true but NOT
 *   EXPO_PUBLIC_ENABLE_ANALYTICS, so `telemetry` was false, the block never
 *   ran, `consent` stayed false forever, and `track()` dropped every custom
 *   event at its very first branch — Firebase included.
 *
 * Firebase still collected its own automatic events, so the dashboard looked
 * alive while the entire product funnel reached nothing. Unit-testing the sink
 * could never catch that; the defect was one level up, in the wiring.
 *
 * These are source-level assertions for the same reason
 * `__tests__/tooling/nativeSdkFlagDefaults.test.ts` reads `eas.json`: the thing
 * being protected is a configuration relationship between two files, and it
 * cannot be observed by importing either one.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const layout = readFileSync(join(ROOT, 'app', '_layout.tsx'), 'utf8');

/**
 * The source with comments removed.
 *
 * The negative assertions below must read CODE, not prose: the comment that
 * explains why `track('session_start', …)` is wrong contains that very string,
 * so matching raw source made the guard fail on its own documentation. Any
 * source-level ban needs this — otherwise the fix is "stop explaining
 * yourself", which is the wrong lesson to teach the next reader.
 */
const layoutCode = layout
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const easJson = JSON.parse(readFileSync(join(ROOT, 'eas.json'), 'utf8'));

describe('the analytics funnel is armed wherever a sink exists', () => {
  it('gates init/consent on EITHER sink, never on telemetry alone', () => {
    // The specific regression: narrowing this back to `if (enableTelemetry)`
    // silently un-measures the business in every profile that runs Firebase
    // without a self-hosted endpoint — which is the shipping configuration.
    expect(layoutCode).toContain('if (enableTelemetry || enableFirebase) {');
    expect(layoutCode).not.toMatch(/if \(enableTelemetry\) \{/);
  });

  it('still initialises and consents inside that block', () => {
    // The control: the guard above is worthless if the calls move out from
    // under it.
    const start = layoutCode.indexOf('if (enableTelemetry || enableFirebase) {');
    expect(start).toBeGreaterThan(-1);
    const block = layoutCode.slice(start, start + 600);
    expect(block).toContain('await analytics.init()');
    expect(block).toContain('analytics.setConsent(');
  });

  it('emits the session through trackSessionStart, so it carries a cohort', () => {
    // A bare `track('session_start', …)` here compiles and ships, and produces
    // a session with no day index — the exact state that made D1/D7/D30
    // uncomputable. See `lib/analytics/retentionCohort.ts`.
    expect(layoutCode).toContain('analytics.trackSessionStart(');
    expect(layoutCode).not.toMatch(/(?<!Session)track\(\s*'session_start'/);
  });

  it('the production profile really does enable a sink (the control)', () => {
    // Without this, the assertions above could hold while production enabled
    // neither sink, and the funnel would still reach nothing.
    const env = easJson?.build?.production?.env ?? {};
    const hasSink =
      env.EXPO_PUBLIC_ENABLE_FIREBASE === 'true' ||
      env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true';
    expect(hasSink).toBe(true);
    // Boring Build hard-disables both flags, so it must be off in production.
    expect(env.EXPO_PUBLIC_BORING_BUILD).toBe('false');
  });
});
