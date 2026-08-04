/**
 * The negotiated raise premium had FOUR different opinions about one number.
 *
 * `career.raiseMultiplier` is written by `requestRaise`, which caps it at
 * `RAISE_CAP = 2.0` (+100%). Every site that READ it back disagreed about what
 * the bound was:
 *
 *   JobActions.ts (promotion payout)      `?? 1`, no clamp at all
 *   applyCareerSalaryAndPenalty.ts        Math.max(1, Math.min(3, …))
 *   CareerPathCard.tsx                    Math.max(1, Math.min(3, …)) — twice
 *   work.tsx (premium %)                  `?? 1`, no clamp
 *
 * On a save inside the design range all four agree, which is why this survived:
 * it is invisible until the value leaves that range. And it CAN leave it —
 * `repairGameState` preserves `raiseMultiplier` verbatim (saveValidation.ts:761
 * lists it among the dynamic fields carried through a ladder repair), so a
 * legacy, hand-edited or corrupt save carries whatever it carries.
 *
 * At that point the weekly salary pays a 3× ceiling, the promotion payout pays
 * the raw value with NO ceiling, and the work screen advertises a percentage
 * matching neither. That is the same shape as the hustle bug fixed earlier
 * today — the UI and the payout computing the same quantity independently —
 * one layer up, and this suite pins the single definition that replaces it.
 */
import {
  RAISE_PREMIUM_CAP,
  RAISE_PREMIUM_FLOOR,
  RAISE_PREMIUM_STEP,
  applyRaisePremium,
  raisePremiumPct,
  resolveRaisePremium,
} from '@/lib/careers/raisePremium';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('one definition of the raise premium', () => {
  it('an absent or unset premium is exactly base pay', () => {
    expect(resolveRaisePremium(undefined)).toBe(1);
    expect(resolveRaisePremium(null)).toBe(1);
    expect(applyRaisePremium(1000, undefined)).toBe(1000);
  });

  it('a normal negotiated premium passes through untouched', () => {
    // The overwhelmingly common case: everything inside the design range must
    // behave exactly as it did before, or this is a nerf and not a fix.
    expect(resolveRaisePremium(1.08)).toBe(1.08);
    expect(resolveRaisePremium(1.6)).toBe(1.6);
    expect(applyRaisePremium(1000, 1.5)).toBe(1500);
  });

  it('the ceiling is the writer\'s cap, not a second opinion', () => {
    // requestRaise caps at RAISE_CAP. A reader that allowed 3 was promising a
    // premium the game will never grant.
    expect(RAISE_PREMIUM_CAP).toBe(2.0);
    expect(resolveRaisePremium(3)).toBe(RAISE_PREMIUM_CAP);
    expect(resolveRaisePremium(50)).toBe(RAISE_PREMIUM_CAP);
  });

  it('clamps UP to the floor — a premium never cuts base pay', () => {
    expect(resolveRaisePremium(0)).toBe(RAISE_PREMIUM_FLOOR);
    expect(resolveRaisePremium(-5)).toBe(RAISE_PREMIUM_FLOOR);
    expect(RAISE_PREMIUM_FLOOR).toBe(1);
  });

  it('a corrupt value cannot pay out, and cannot be displayed either', () => {
    // The reachable case. Repair carries raiseMultiplier through verbatim, so
    // the readers are the only thing standing between a bad value and payroll.
    for (const bad of [NaN, Infinity, -Infinity, '2' as unknown, {} as unknown]) {
      expect(resolveRaisePremium(bad)).toBeGreaterThanOrEqual(RAISE_PREMIUM_FLOOR);
      expect(resolveRaisePremium(bad)).toBeLessThanOrEqual(RAISE_PREMIUM_CAP);
    }
    // Note the direction: a non-finite value collapses to the FLOOR, not the
    // cap. Garbage should pay base salary, never the maximum premium — the
    // conservative reading is the only safe one on a payroll path.
    expect(applyRaisePremium(1000, Infinity)).toBe(1000);
    expect(applyRaisePremium(1000, NaN)).toBe(1000);
    // An in-range-but-too-large number IS a number, so it clamps to the cap.
    expect(applyRaisePremium(1000, 50)).toBe(2000);
  });

  it('reports the premium as a percentage the payout would actually honour', () => {
    expect(raisePremiumPct(1)).toBe(0);
    expect(raisePremiumPct(1.24)).toBe(24);
    // Not 4900%. The screen must not advertise what payroll will not pay.
    expect(raisePremiumPct(50)).toBe(100);
  });

  it('the step still reaches the cap in whole raises (the control)', () => {
    // 1 + n*0.08 == 2.0 exactly at n = 12.5 — i.e. it does NOT land cleanly,
    // so the writer's Math.min is load-bearing and must stay.
    expect(RAISE_PREMIUM_STEP).toBe(0.08);
    expect(1 + Math.floor((RAISE_PREMIUM_CAP - 1) / RAISE_PREMIUM_STEP) * RAISE_PREMIUM_STEP)
      .toBeLessThan(RAISE_PREMIUM_CAP);
  });
});

describe('every reader goes through it — no site keeps its own clamp', () => {
  const SITES: Array<[string, RegExp]> = [
    ['contexts/game/actions/JobActions.ts', /resolveRaisePremium|applyRaisePremium/],
    ['contexts/game/actions/weekly/applyCareerSalaryAndPenalty.ts', /resolveRaisePremium|applyRaisePremium/],
    ['components/CareerPathCard.tsx', /resolveRaisePremium|applyRaisePremium/],
    ['app/(tabs)/work.tsx', /raisePremiumPct/],
  ];

  it.each(SITES)('%s reads the shared helper', (rel, want) => {
    expect(code(rel)).toMatch(want);
  });

  it.each(SITES.map(([rel]) => rel))('%s no longer inlines a clamp', (rel) => {
    // The specific literal that encoded the phantom 3× ceiling. Its absence is
    // the whole point — a site that kept it would silently diverge again.
    expect(code(rel)).not.toMatch(/Math\.min\(3,\s*\w*[Cc]areer\.raiseMultiplier/);
    expect(code(rel)).not.toMatch(/Math\.max\(1,\s*Math\.min\(3,/);
  });

  it('the writer still owns the cap, sourced from the same constant', () => {
    // The writer must not keep a private 2.0 either — that is the same drift
    // with the numbers currently agreeing.
    const src = code('contexts/game/actions/JobActions.ts');
    expect(src).toMatch(/from '@\/lib\/careers\/raisePremium'/);
    // No private ceiling of its own, under any name. Two constants that happen
    // to agree today are the same drift with the bug not yet triggered.
    expect(src).not.toMatch(/const RAISE_CAP\s*=/);
    expect(src).not.toMatch(/const RAISE_STEP\s*=/);
  });
});
