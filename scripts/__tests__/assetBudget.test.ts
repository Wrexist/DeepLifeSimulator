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

  it('warns but does not block iOS at the same size', () => {
    // iOS has no equivalent wall, so blocking there would stop TestFlight builds
    // over a problem that does not apply to them.
    const v = evaluateAssetBudget(measurement(PLAY_BASE_AAB_LIMIT_MB + 1), 'ios');
    expect(v.ok).toBe(true);
    expect(v.overPlayLimit).toBe(true);
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

  it('keeps the ratchet above the current reality, not below it', () => {
    // A ceiling set under the measured value fails on day one and blocks every
    // build — the corrosive shape coverageRatchet.js documents. A ceiling set far
    // above it stops catching anything.
    const real = measureAssets(process.cwd());
    const shipped = toMB(real.shippedBytes);
    expect(shipped).toBeLessThanOrEqual(ASSET_BUDGET_MB);
    expect(shipped).toBeGreaterThan(ASSET_BUDGET_MB - 60);
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
    expect(real.shippedCount).toBeGreaterThan(50);
    expect(real.byFormat.png).toBeGreaterThan(0);
  });

  it('reports the biggest offenders so the fix has somewhere to start', () => {
    expect(real.largest.length).toBeGreaterThan(0);
    expect(real.largest[0].bytes).toBeGreaterThanOrEqual(real.largest[real.largest.length - 1].bytes);
  });
});
