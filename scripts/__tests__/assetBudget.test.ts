/**
 * The shipped-image-payload gate.
 *
 * Measured 2026-08-04: 234.0 MB of images reach the bundle against Google Play's
 * 200 MB base-AAB limit — so a release build was already over a hard
 * distribution wall while all ten preflight sections reported green. Nothing in
 * the pipeline looked at asset weight.
 *
 * The static measurement was validated against a real `expo export`: 234.0 MB
 * predicted vs 234 MB actually bundled. It can be trusted because React Native
 * cannot resolve a dynamic asset path — every shipped image appears as a literal
 * in a `require()` somewhere.
 */
import {
  ASSET_BUDGET_MB,
  PLAY_BASE_AAB_LIMIT_MB,
  evaluateAssetBudget,
  measureAssets,
  toMB,
} from '../lib/assetBudget';

const MB = 1024 * 1024;
const measurement = (shippedMB: number) => ({
  shippedBytes: shippedMB * MB,
  shippedCount: 1,
  onDiskBytes: shippedMB * MB,
  onDiskCount: 1,
  unreferenced: [] as string[],
  byFormat: { png: shippedMB * MB },
  largest: [],
});

describe('evaluateAssetBudget', () => {
  it('blocks an Android build that exceeds the Play base-AAB limit', () => {
    // Not a warning. A single AAB over 200 MB cannot be published, so letting
    // preflight pass here would just move the failure to the upload.
    const v = evaluateAssetBudget(measurement(PLAY_BASE_AAB_LIMIT_MB + 1), 'android');
    expect(v.ok).toBe(false);
    expect(v.blocksThisPlatform).toBe(true);
    expect(v.fix).toMatch(/WebP/i);
  });

  it('treats the Play limit as Android-only, not as a universal wall', () => {
    // iOS has no equivalent limit, so blocking there would stop TestFlight builds
    // over a problem that does not apply to them.
    //
    // Asserted on `blocksThisPlatform` rather than on `ok`. Since the WebP
    // conversion the ratchet sits at 45 MB, far under the 200 MB Play limit, so
    // any payload big enough to breach the limit ALSO breaches the ratchet and
    // `ok` is false on both platforms. The platform distinction is still real and
    // still worth keeping — it is the backstop if someone ever raises the ratchet
    // — but a test that asserted `ok` here would be asserting the ordering of two
    // independent rules, and would have quietly started passing for the wrong
    // reason.
    const over = measurement(PLAY_BASE_AAB_LIMIT_MB + 1);
    expect(evaluateAssetBudget(over, 'ios').blocksThisPlatform).toBe(false);
    expect(evaluateAssetBudget(over, 'android').blocksThisPlatform).toBe(true);
    expect(evaluateAssetBudget(over, 'ios').overPlayLimit).toBe(true);
  });

  it('fails on any platform once the payload GROWS past the ratchet', () => {
    const v = evaluateAssetBudget(measurement(ASSET_BUDGET_MB + 1), 'ios');
    expect(v.ok).toBe(false);
    expect(v.overBudget).toBe(true);
  });

  it('passes a payload that fits everywhere', () => {
    const v = evaluateAssetBudget(measurement(40), 'android');
    expect(v.ok).toBe(true);
    expect(v.overPlayLimit).toBe(false);
  });

  it('keeps the ratchet above the current reality, but not far above', () => {
    // A ceiling under the measured value fails on day one and blocks every build
    // — the corrosive shape coverageRatchet.js documents. A ceiling far above it
    // stops catching anything. Both halves are asserted.
    const real = measureAssets(process.cwd());
    const shipped = toMB(real.shippedBytes);
    expect(shipped).toBeLessThanOrEqual(ASSET_BUDGET_MB);
    expect(ASSET_BUDGET_MB - shipped).toBeLessThan(30);
  });

  it('leaves real headroom under the Play limit after the conversion', () => {
    // The payload was 234.0 MB against a 200 MB wall. Re-encoding to WebP q92
    // took it to ~25 MB; this pins that the app is not sitting near the wall
    // again without anyone noticing.
    const real = measureAssets(process.cwd());
    expect(toMB(real.shippedBytes)).toBeLessThan(PLAY_BASE_AAB_LIMIT_MB / 2);
  });

  it('has not let PNG creep back in as the dominant format', () => {
    // 230 of the original 234 MB was PNG. A single 2 MB PNG landing back in the
    // bundle is the shape of the regression this file exists for.
    const real = measureAssets(process.cwd());
    const png = real.byFormat.png || 0;
    expect(toMB(png)).toBeLessThan(5);
  });
});

describe('measureAssets', () => {
  const real = measureAssets(process.cwd());

  it('counts only what a static require can reach', () => {
    // The distinction that matters: unreferenced files are repo weight, not
    // download weight. Conflating the two sends you deleting art that was never
    // the problem.
    expect(real.shippedBytes).toBeLessThanOrEqual(real.onDiskBytes);
    expect(real.shippedCount).toBeLessThanOrEqual(real.onDiskCount);
  });

  it('finds the real asset tree, so a broken walk cannot read as a pass', () => {
    // A measurement of zero must never be mistaken for a small bundle.
    expect(real.shippedCount).toBeGreaterThan(50);
    expect(real.shippedBytes).toBeGreaterThan(1024 * 1024);
    // WebP is the format the art lives in now; PNG survives only for the three
    // native-tooling icons, which are not bundled through require().
    expect(real.byFormat.webp).toBeGreaterThan(0);
  });

  it('reports the biggest offenders so the fix has somewhere to start', () => {
    expect(real.largest.length).toBeGreaterThan(0);
    expect(real.largest[0].bytes).toBeGreaterThanOrEqual(real.largest[real.largest.length - 1].bytes);
  });
});
