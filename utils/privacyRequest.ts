import { SUPPORT_EMAIL } from '@/lib/config/appConfig';

type IdentityReader = () => Promise<string | null>;

// A native bridge that never settles must not prevent a player contacting support.
async function readIdentity(read: IdentityReader): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(read),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 4000); }),
    ]);
    return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\r\n]/.test(value)
      ? value : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Deliberately accepts no save, diagnostic log, email address or receipt. */
export async function buildPrivacyRequest(readers: { purchases: IdentityReader; analytics: IdentityReader }): Promise<string> {
  const [purchases, analytics] = await Promise.all([
    readIdentity(readers.purchases), readIdentity(readers.analytics),
  ]);
  return [
    'To Isac Molin, operator of DeepLife (Sweden)',
    '',
    'I would like to request deletion of my personal data. Please confirm the scope and any information needed to identify my records.',
    '',
    `RevenueCat App User ID: ${purchases ?? 'Unavailable on this device/session'}`,
    `Firebase app instance ID: ${analytics ?? 'Unavailable on this device/session'}`,
    '',
    'These identifiers cover this installation only. Unavailable identifiers do not mean that no data exists. I may have used other installations.',
    'This request does not itself delete local saves or cancel store subscriptions.',
    '',
    'Additional details (optional):',
  ].join('\n');
}

export function privacyRequestMailUrl(body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('DeepLife personal data deletion request')}&body=${encodeURIComponent(body)}`;
}
