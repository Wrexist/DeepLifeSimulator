/**
 * MON-10 (owner decision 2026-10-22): upsell entry points (crown, banner,
 * badge, ad-sheet pill) show "PREMIUM" while subscription health is unknown,
 * and drop the free-trial claim when the store product reports no intro offer.
 * They used to print "7-DAY FREE" from a constant for every player whose
 * health had not been observed, and the paywall then withdrew it.
 */
import fs from 'fs';
import path from 'path';
import { entryPointTrialDays } from '@/lib/subscription/entryPointTrial';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS } from '@/lib/subscription/deepLifePlus';
import type { SubscriptionHealth } from '@/lib/subscription/subscriptionHealth';

const NEVER: SubscriptionHealth = { phase: 'none' };
const C = DEEP_LIFE_PLUS_FREE_TRIAL_DAYS;

describe('MON-10 - what an entry point may say about the trial', () => {
  it('premise: the configured trial is on', () => {
    expect(C).toBeGreaterThan(0);
  });

  it('unknown health shows PREMIUM (0), even with a store trial in hand', () => {
    expect(entryPointTrialDays({ health: null, storeTrialDays: null, configuredTrialDays: C })).toBe(0);
    expect(entryPointTrialDays({ health: null, storeTrialDays: 7, configuredTrialDays: C })).toBe(0);
  });

  it('a store product with no intro offer drops the trial', () => {
    expect(entryPointTrialDays({ health: NEVER, storeTrialDays: 0, configuredTrialDays: C })).toBe(0);
  });

  it('a current or prior subscriber has used the offer', () => {
    for (const phase of ['lapsed', 'renewing', 'trial', 'cancelling', 'lifetime'] as const) {
      expect(`${phase}:${entryPointTrialDays({ health: { phase }, storeTrialDays: 7, configuredTrialDays: C })}`)
        .toBe(`${phase}:0`);
    }
  });

  it('a never-subscribed player sees the store length, else the configured one', () => {
    expect(entryPointTrialDays({ health: NEVER, storeTrialDays: 3, configuredTrialDays: C })).toBe(3);
    expect(entryPointTrialDays({ health: NEVER, storeTrialDays: null, configuredTrialDays: C })).toBe(C);
  });

  it('the configured kill switch silences every claim', () => {
    expect(entryPointTrialDays({ health: NEVER, storeTrialDays: 7, configuredTrialDays: 0 })).toBe(0);
  });

  it('the upsell reads the rule, not the constant', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'DeepLifePlusUpsell.tsx'), 'utf8');
    expect(src).toContain('useEntryPointTrialDays()');
    expect(src).not.toContain('DEEP_LIFE_PLUS_FREE_TRIAL_DAYS');
    expect(src).not.toContain('free for a week');
  });
});
