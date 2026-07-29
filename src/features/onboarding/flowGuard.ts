/**
 * Onboarding flow guard — prevents out-of-order screen navigation.
 *
 * Each screen has prerequisites. If state is missing, the user is
 * redirected to the earliest incomplete step.
 */

import type { Href } from 'expo-router';

export type OnboardingScreenName = 'Scenarios' | 'Customize' | 'Ambitions' | 'Perks';

export interface FlowGuardResult {
  allowed: boolean;
  redirectTo?: Href;
  reason?: string;
}

interface FlowGuardState {
  scenario?: unknown;
  firstName?: string;
  lastName?: string;
  /** Target save slot, 1-3. 0/undefined means the player never chose one. */
  slot?: number;
}

/**
 * A life has to know where it will be saved before it can be built. Without
 * this, any route that reached the onboarding stack without visiting the slot
 * picker — the death screen, a deep link — walked all the way to the write and
 * then had to guess a slot. It guessed 1, and players lost saves.
 *
 * Not enforced on `Scenarios` on purpose: that is the entry point, and bouncing
 * on mount would race the slot assignment the caller does immediately before
 * navigating. By `Customize` the choice has long since committed.
 */
const requiresSlot = (state: FlowGuardState): FlowGuardResult | null => {
  const slot = state.slot;
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > 3) {
    return {
      allowed: false,
      redirectTo: '/(onboarding)/SaveSlots' as Href,
      reason: 'No save slot selected',
    };
  }
  return null;
};

/**
 * Check whether the user can access a given onboarding screen
 * based on what state has been filled in so far.
 */
export function canAccessScreen(
  screen: OnboardingScreenName,
  state: FlowGuardState
): FlowGuardResult {
  // Every screen past the entry point needs a chosen slot.
  const slotIssue = requiresSlot(state);

  switch (screen) {
    case 'Scenarios':
      // Entry point — no prerequisites
      return { allowed: true };

    case 'Customize':
      if (slotIssue) return slotIssue;
      if (!state.scenario) {
        return {
          allowed: false,
          redirectTo: '/(onboarding)/Scenarios' as Href,
          reason: 'No scenario selected',
        };
      }
      return { allowed: true };

    case 'Ambitions':
      if (slotIssue) return slotIssue;
      // Ambition is chosen AFTER identity but the choice itself is optional.
      // We still require the prerequisites so the flow can't be entered early.
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

    case 'Perks':
      if (slotIssue) return slotIssue;
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
