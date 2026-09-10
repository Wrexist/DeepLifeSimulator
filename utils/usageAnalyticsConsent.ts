import { isTrackingAllowed } from '@/utils/trackingTransparency';

const KEY = 'deeplife_usage_analytics_consent_v1';
let deniedForSession = false;
let revision = 0;
let writes = Promise.resolve();

/** A separate opt-in: ATT and ad consent cannot create this permission. */
export async function hasUsageAnalyticsConsent(): Promise<boolean> {
  if (deniedForSession) return false;
  try {
    const { default: storage } = await import('@react-native-async-storage/async-storage');
    const stored = await storage.getItem(KEY);
    return !deniedForSession && stored === 'granted';
  } catch {
    return false;
  }
}

export async function isUsageAnalyticsAllowed(): Promise<boolean> {
  if (!await hasUsageAnalyticsConsent()) return false;
  const allowed = await isTrackingAllowed().catch(() => false);
  return !deniedForSession && allowed;
}

/** Persist before granting. A failed withdrawal still denies this session. */
export async function saveUsageAnalyticsConsent(granted: boolean): Promise<void> {
  deniedForSession = true;
  const ownRevision = ++revision;
  const write = writes.then(async () => {
    const { default: storage } = await import('@react-native-async-storage/async-storage');
    await storage.setItem(KEY, granted ? 'granted' : 'denied');
    if (revision === ownRevision) deniedForSession = !granted;
  });
  writes = write.catch(() => {});
  await write;
}
