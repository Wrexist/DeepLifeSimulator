/**
 * Who sends the player mail.
 *
 * Senders are a fixed cast rather than strings scattered through templates, for
 * one reason that matters to the scam mechanic: a lookalike domain is only a
 * TELL if the real domain is somewhere the player has seen a hundred times.
 * `no-reply@deeplifebank.com` has to be familiar before `deeplifebank-secure.co`
 * can feel wrong.
 *
 * `verified` is the game vouching for a sender. Nothing in `lib/mail/scam.ts`
 * can set it — that is enforced by a test — so its absence is load-bearing
 * rather than decorative.
 */

export interface MailSender {
  name: string;
  email: string;
  /** Avatar tint. Gmail colours the initial circle per sender; so do we. */
  color: string;
  verified?: boolean;
}

export const SENDERS = {
  bank: {
    name: 'DeepLife Bank',
    email: 'no-reply@deeplifebank.com',
    color: '#1A73E8',
    verified: true,
  },
  payroll: {
    name: 'Payroll Services',
    email: 'payroll@deeplife-payroll.com',
    color: '#188038',
    verified: true,
  },
  revenue: {
    name: 'Revenue Service',
    email: 'notices@revenue.gov',
    color: '#5F6368',
    verified: true,
  },
  landlord: {
    name: 'Meridian Property',
    email: 'billing@meridianproperty.com',
    color: '#E37400',
    verified: true,
  },
  broker: {
    name: 'Vantage Brokerage',
    email: 'confirmations@vantagebrokerage.com',
    color: '#9334E6',
    verified: true,
  },
  registrar: {
    name: 'Registrar Office',
    email: 'records@campus.edu',
    color: '#0B8043',
    verified: true,
  },
  insurer: {
    name: 'Kestrel Insurance',
    email: 'policy@kestrelinsure.com',
    color: '#C5221F',
    verified: true,
  },
  service: {
    name: 'AutoCare Service',
    email: 'service@autocare.com',
    color: '#3C4043',
    verified: true,
  },
  security: {
    name: 'DeepMail Security',
    email: 'security@deepmail.com',
    color: '#D93025',
    verified: true,
  },
  concierge: {
    name: 'Aurum Concierge',
    email: 'clients@aurumconcierge.com',
    color: '#B06000',
    verified: true,
  },
  recruiter: {
    name: 'Beacon Recruiting',
    email: 'talent@beaconrecruiting.com',
    color: '#1967D2',
    verified: true,
  },
  marketing: {
    name: 'DeepLife Offers',
    email: 'offers@deeplife-offers.com',
    color: '#E8710A',
  },
} as const satisfies Record<string, MailSender>;

export type SenderKey = keyof typeof SENDERS;

/** The colour a list row tints its avatar circle with. */
export function senderColor(email: string): string {
  const known = Object.values(SENDERS).find((s) => s.email === email);
  if (known) return known.color;
  // Unknown sender (every scam is one) — derive a stable colour from the
  // address so the list still looks like a real inbox rather than a grey wall.
  const palette = ['#5F6368', '#7B1FA2', '#00838F', '#EF6C00', '#455A64', '#AD1457'];
  let h = 0;
  for (let i = 0; i < email.length; i += 1) h = (h * 31 + email.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

/** First letter of the sender name, for the avatar circle. */
export function senderInitial(name: string): string {
  const trimmed = (name || '?').trim();
  return (trimmed[0] || '?').toUpperCase();
}
