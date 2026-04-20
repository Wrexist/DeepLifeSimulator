/**
 * Game initialization orchestrator for onboarding.
 *
 * Extracted from Perks.tsx lines 209-663 — handles validation,
 * saving, loading, and entry validation for new game creation.
 */

import { logger } from '@/utils/logger';
import {
  logOnboardingStepComplete,
  logOnboardingValidationError,
} from '@/src/features/onboarding/onboardingAnalytics';

const log = logger.scope('GameInitializer');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingInputs {
  scenario: { id: string; start: { age: number; cash: number; [k: string]: any } } | undefined;
  firstName: string;
  lastName: string;
  sex: string;
  sexuality: string;
}

export interface InputValidationResult {
  valid: boolean;
  /** Human-readable error title for Alert. */
  errorTitle?: string;
  /** Human-readable error message for Alert. */
  errorMessage?: string;
}

export interface InitializeGameResult {
  success: boolean;
  errorTitle?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Input validation (pre-build checks)
// ---------------------------------------------------------------------------

/** Validate that all onboarding inputs are present and sane before building game state. */
export function validateOnboardingInputs(inputs: OnboardingInputs): InputValidationResult {
  if (!inputs.scenario) {
    return { valid: false, errorTitle: 'Missing Scenario', errorMessage: 'Please select a scenario before starting your life.' };
  }

  if (!inputs.firstName || !inputs.firstName.trim()) {
    return { valid: false, errorTitle: 'Missing First Name', errorMessage: 'Please enter a first name for your character.' };
  }

  if (!inputs.lastName || !inputs.lastName.trim()) {
    return { valid: false, errorTitle: 'Missing Last Name', errorMessage: 'Please enter a last name for your character.' };
  }

  if (!inputs.sex || !['male', 'female', 'random'].includes(inputs.sex)) {
    return { valid: false, errorTitle: 'Invalid Character Sex', errorMessage: 'Please select a valid character sex.' };
  }

  if (!inputs.sexuality || !['straight', 'gay', 'bi'].includes(inputs.sexuality)) {
    return { valid: false, errorTitle: 'Invalid Sexuality', errorMessage: 'Please select a valid sexuality.' };
  }

  const scenario = inputs.scenario;
  if (!scenario.start || typeof scenario.start !== 'object') {
    return { valid: false, errorTitle: 'Invalid Scenario', errorMessage: 'The selected scenario is invalid. Please go back and select a different scenario.' };
  }

  if (typeof scenario.start.age !== 'number' || scenario.start.age < 18 || scenario.start.age > 150) {
    return { valid: false, errorTitle: 'Invalid Scenario', errorMessage: 'The selected scenario has an invalid starting age. Please try again.' };
  }

  if (typeof scenario.start.cash !== 'number' || scenario.start.cash < 0) {
    return { valid: false, errorTitle: 'Invalid Scenario', errorMessage: 'The selected scenario has invalid starting cash. Please try again.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Post-build validation + save + load orchestration
// ---------------------------------------------------------------------------

export interface InitializeGameDeps {
  /** Validate the constructed game state (from onboardingValidation). */
  validateOnboardingState: (state: any) => { valid: boolean; errors: string[]; warnings: string[]; missingFields?: string[]; invalidFields?: string[] };
  /** Apply safe defaults for missing fields. */
  applySafeDefaults: (state: any) => { defaults: string[] };
  /** Create a pre-save backup. */
  createBackupFromState: (slot: number, state: any, tag: string) => Promise<void>;
  /** Force-save to a slot. */
  forceSave: (slot: number, state: any) => Promise<void>;
  /** Load game from a slot. */
  loadGame: (slot: number) => Promise<any>;
  /** Validate that a loaded state is safe to enter gameplay. */
  validateGameEntry: (state: any) => {
    canEnter: boolean;
    reason?: string;
    errors: string[];
    warnings: string[];
    versionCompatible?: boolean;
    stateComplete?: boolean;
  };
  /** Check if error is a save-signing config error. */
  isSaveSigningConfigError: (error: unknown) => boolean;
}

/**
 * Validate, save, load, and re-validate a newly constructed game state.
 *
 * All side-effects (save, load, backup) are injected via `deps` for testability.
 */
export async function initializeAndSaveGame(
  newState: any,
  slot: number,
  deps: InitializeGameDeps
): Promise<InitializeGameResult> {
  // Step 1: Validate the constructed state
  const validation = deps.validateOnboardingState(newState);

  if (!validation.valid) {
    log.error('Onboarding validation failed', {
      errors: validation.errors,
      warnings: validation.warnings,
      missingFields: validation.missingFields,
      invalidFields: validation.invalidFields,
    });

    const defaultsResult = deps.applySafeDefaults(newState);
    const revalidation = deps.validateOnboardingState(newState);

    if (!revalidation.valid) {
      const errorMessage = [
        'Failed to create valid game state:',
        ...validation.errors.slice(0, 5),
        validation.errors.length > 5 ? `... and ${validation.errors.length - 5} more errors` : '',
      ]
        .filter(Boolean)
        .join('\n');

      log.error('Game state validation failed even after applying defaults', {
        originalErrors: validation.errors,
        revalidationErrors: revalidation.errors,
        defaultsApplied: defaultsResult.defaults,
      });

      logOnboardingValidationError('Perks', 'onboarding_state_invalid_after_defaults', {
        errorCount: revalidation.errors.length,
      });
      return { success: false, errorTitle: 'Game Creation Failed', errorMessage: errorMessage + '\n\nPlease try again or contact support if this persists.' };
    }

    log.warn('Applied defaults to fix validation issues', {
      defaultsApplied: defaultsResult.defaults,
      remainingWarnings: revalidation.warnings,
    });
  } else if (validation.warnings.length > 0) {
    log.warn('Onboarding validation passed with warnings', { warnings: validation.warnings });
  } else {
    log.info('Onboarding validation passed successfully');
  }

  // Step 2: Backup + save
  try {
    await deps.createBackupFromState(slot, newState, 'before_onboarding').catch((err) => {
      log.warn('Backup creation failed during onboarding (non-critical):', err);
    });

    await deps.forceSave(slot, newState);
    log.info('Game state saved successfully', { slot });
  } catch (error) {
    log.error('Failed to save game state', error);

    if (deps.isSaveSigningConfigError(error)) {
      logOnboardingValidationError('Perks', 'save_signing_config', {});
      return {
        success: false,
        errorTitle: 'Build Configuration Error',
        errorMessage: 'This app build is missing required save security configuration. Please update to the latest version.',
      };
    }

    logOnboardingValidationError('Perks', 'save_failed', {});
    return { success: false, errorTitle: 'Save Failed', errorMessage: 'Failed to save your game. Please try again.' };
  }

  // Step 3: Load and re-validate
  let loadedState;
  try {
    loadedState = await deps.loadGame(slot);
  } catch (loadError) {
    log.error('loadGame failed:', loadError);
    logOnboardingValidationError('Perks', 'load_after_save_exception', {});
    return { success: false, errorTitle: 'Load Failed', errorMessage: 'Failed to load your game after saving. Please try again.' };
  }

  if (!loadedState) {
    log.error('loadGame returned null');
    logOnboardingValidationError('Perks', 'load_after_save_null', {});
    return {
      success: false,
      errorTitle: 'Load Failed',
      errorMessage: 'Failed to load your game after saving. The save file may not have been created properly. Please try again.',
    };
  }

  // Step 4: Entry validation
  try {
    const entryValidation = deps.validateGameEntry(loadedState);

    if (!entryValidation.canEnter) {
      log.error('Game entry validation failed after onboarding', {
        reason: entryValidation.reason,
        errors: entryValidation.errors,
        warnings: entryValidation.warnings,
      });

      if (!entryValidation.versionCompatible) {
        logOnboardingValidationError('Perks', 'game_entry_version_incompatible', {
          reason: entryValidation.reason,
        });
        return { success: false, errorTitle: 'Version Incompatible', errorMessage: 'The game state created is incompatible. Please try again.' };
      }
      if (!entryValidation.stateComplete) {
        logOnboardingValidationError('Perks', 'game_entry_incomplete', { reason: entryValidation.reason });
        return { success: false, errorTitle: 'Incomplete State', errorMessage: 'The game state is incomplete. Please try again.' };
      }
      logOnboardingValidationError('Perks', 'game_entry_invalid', { reason: entryValidation.reason });
      return {
        success: false,
        errorTitle: 'Invalid State',
        errorMessage: entryValidation.errors[0] || 'The game state is invalid. Please try again.',
      };
    }

    if (entryValidation.warnings.length > 0) {
      log.warn('Game entry validation warnings after onboarding', entryValidation.warnings);
    }

    log.info('Game entry validation passed after onboarding, ready for gameplay');
    logOnboardingStepComplete('Perks', { slot });
    return { success: true };
  } catch (validationError) {
    log.error('Error during post-load validation:', validationError);
    logOnboardingValidationError('Perks', 'post_load_validation_exception', {});
    return { success: false, errorTitle: 'Validation Error', errorMessage: 'An error occurred while validating your game. Please try again.' };
  }
}
