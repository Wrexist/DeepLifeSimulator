/**
 * Minimal onboarding funnel signals (structured logs).
 * Wire to a real analytics provider when available; today these go through `logger`.
 */

import { logger } from '@/utils/logger';

const log = logger.scope('OnboardingFunnel');

export type OnboardingFunnelStep =
  | 'MainMenu'
  | 'SaveSlots'
  | 'Scenarios'
  | 'Customize'
  | 'Perks';

export function logOnboardingStepView(step: OnboardingFunnelStep, meta?: Record<string, unknown>): void {
  log.info('onboarding_step_view', { step, ...meta });
}

export function logOnboardingStepComplete(step: OnboardingFunnelStep, meta?: Record<string, unknown>): void {
  log.info('onboarding_step_complete', { step, ...meta });
}

export function logOnboardingValidationError(
  step: OnboardingFunnelStep,
  reason: string,
  meta?: Record<string, unknown>
): void {
  log.warn('onboarding_validation_error', { step, reason, ...meta });
}
