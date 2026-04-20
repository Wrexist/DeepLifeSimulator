/**
 * React hook that enforces onboarding flow order.
 *
 * Call at the top of Customize and Perks screens.
 * If prerequisites are missing, redirects before the user sees the screen.
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { canAccessScreen, type OnboardingScreenName } from '@/src/features/onboarding/flowGuard';
import { logger } from '@/utils/logger';

const log = logger.scope('FlowGuard');

export function useOnboardingFlowGuard(screen: OnboardingScreenName) {
  const router = useRouter();
  const { state } = useOnboarding();

  useEffect(() => {
    const result = canAccessScreen(screen, state);
    if (!result.allowed && result.redirectTo) {
      log.warn(`Flow guard blocked ${screen}`, { reason: result.reason });
      router.replace(result.redirectTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to avoid replace loops
  }, []);
}
