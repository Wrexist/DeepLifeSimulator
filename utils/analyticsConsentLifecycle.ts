import { AppState } from 'react-native';
import { analytics } from '@/lib/analytics/AnalyticsService';
import { firebaseAnalyticsService } from '@/services/FirebaseAnalyticsService';
import { isUsageAnalyticsAllowed } from '@/utils/usageAnalyticsConsent';
import { setAnalyticsForeground } from '@/utils/analyticsForeground';

/** Mounted after first render; leaving the app suspends both measurement sinks. */
export function observeAnalyticsConsentLifecycle(nativeFirebase: boolean): () => void {
  let revision = 0;
  let disposed = false;
  let previous = AppState.currentState;

  const pause = () => {
    analytics.setConsent(false);
    if (nativeFirebase) firebaseAnalyticsService.suspendCollection();
  };
  const refresh = async (ownRevision: number) => {
    try {
      const allowed = await isUsageAnalyticsAllowed();
      if (disposed || revision !== ownRevision) return;
      if (nativeFirebase) await firebaseAnalyticsService.setConsent(allowed);
      if (disposed || revision !== ownRevision) return;
      // Re-read after the native bridge: withdrawal may have occurred while it waited.
      const stillAllowed = allowed && await isUsageAnalyticsAllowed();
      if (disposed || revision !== ownRevision) return;
      analytics.setConsent(stillAllowed);
      if (!stillAllowed && nativeFirebase) void firebaseAnalyticsService.setConsent(false);
    } catch {
      if (!disposed && revision === ownRevision) pause();
    }
  };

  setAnalyticsForeground(previous === 'active');
  if (previous !== 'active') pause();
  const subscription = AppState.addEventListener('change', next => {
    if (next === previous) return;
    previous = next;
    const ownRevision = ++revision;
    setAnalyticsForeground(next === 'active');
    pause();
    if (next === 'active') void refresh(ownRevision);
  });
  return () => {
    disposed = true;
    revision++;
    subscription.remove();
    setAnalyticsForeground(false);
    pause();
  };
}
