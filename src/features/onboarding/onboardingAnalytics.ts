/**
 * Onboarding funnel signals.
 *
 * These go to TWO places on purpose:
 *
 *   1. `logger`, for reading a local run in a dev console.
 *   2. `track()`, which batches to the analytics transport.
 *
 * (2) was missing for the whole life of this file, and it is the half that
 * matters. Every one of the six onboarding screens already calls in here, so
 * the funnel was being recorded perfectly and then thrown away at the device
 * boundary — the shape of a system built and then not connected, the same as
 * the scholarship event that never fired.
 *
 * It cost something concrete. "Play" (2026-08-10) cut a first-time player's
 * route to a live game from six taps to two, aimed squarely at a Day-1
 * retention figure sitting below the 25th percentile of the peer set, and
 * there was no way to tell whether it worked: `screen_view` fires on route
 * change, so it can show that `Customize` was SEEN, but never that it was
 * COMPLETED, and never why someone stopped.
 *
 * `track()` is itself a no-op unless telemetry is enabled and consented, so
 * this is inert in a default build.
 */

import { track } from '@/lib/analytics';
import { logger } from '@/utils/logger';

const log = logger.scope('OnboardingFunnel');

export type OnboardingFunnelStep =
  | 'MainMenu'
  | 'SaveSlots'
  | 'Scenarios'
  | 'Customize'
  | 'Perks';

/**
 * `action` is what separates a view from a completion on the wire — one event
 * name carrying the funnel stage, so a drop-off is `view` without the matching
 * `complete` rather than a join across two event names.
 */
type OnboardingFunnelAction = 'view' | 'complete' | 'validation_error';

function emit(
  step: OnboardingFunnelStep,
  action: OnboardingFunnelAction,
  meta?: Record<string, unknown>
): void {
  // The meta bags at the call sites carry primitives (slot numbers, ids), but
  // they are typed `unknown`, and the transport only accepts scalars. Drop
  // anything else rather than letting an object reach the queue — an
  // unserialisable prop would take the whole event with it.
  const props: Record<string, string | number | boolean> = { step, action };
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      props[key] = value;
    }
  }
  track('onboarding_step', props);
}

export function logOnboardingStepView(step: OnboardingFunnelStep, meta?: Record<string, unknown>): void {
  log.info('onboarding_step_view', { step, ...meta });
  emit(step, 'view', meta);
}

export function logOnboardingStepComplete(step: OnboardingFunnelStep, meta?: Record<string, unknown>): void {
  log.info('onboarding_step_complete', { step, ...meta });
  emit(step, 'complete', meta);
}

export function logOnboardingValidationError(
  step: OnboardingFunnelStep,
  reason: string,
  meta?: Record<string, unknown>
): void {
  log.warn('onboarding_validation_error', { step, reason, ...meta });
  emit(step, 'validation_error', { ...meta, reason });
}
