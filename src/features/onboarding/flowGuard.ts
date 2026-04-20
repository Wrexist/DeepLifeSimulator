/**
 * Onboarding flow guard — prevents out-of-order screen navigation.
 *
 * Each screen has prerequisites. If state is missing, the user is
 * redirected to the earliest incomplete step.
 */

import type { Href } from 'expo-router';

export type OnboardingScreenName = 'Scenarios' | 'Customize' | 'Perks';

export interface FlowGuardResult {
  allowed: boolean;
  redirectTo?: Href;
  reason?: string;
}

interface FlowGuardState {
  scenario?: unknown;
  firstName?: string;
  lastName?: string;
}

/**
 * Check whether the user can access a given onboarding screen
 * based on what state has been filled in so far.
 */
export function canAccessScreen(
  screen: OnboardingScreenName,
  state: FlowGuardState
): FlowGuardResult {
  switch (screen) {
    case 'Scenarios':
      // Entry point — no prerequisites
      return { allowed: true };

    case 'Customize':
      if (!state.scenario) {
        return {
          allowed: false,
          redirectTo: '/(onboarding)/Scenarios' as Href,
          reason: 'No scenario selected',
        };
      }
      return { allowed: true };

    case 'Perks':
      if (!state.scenario) {
        return {
          allowed: false,
          redirectTo: '/(onboarding)/Scenarios' as Href,
          reason: 'No scenario selected',
        };
      }
      if (!state.firstName || !state.firstName.trim() || !state.lastName || !state.lastName.trim()) {
        return {
          allowed: false,
          redirectTo: '/(onboarding)/Customize' as Href,
          reason: 'Identity not set',
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}
