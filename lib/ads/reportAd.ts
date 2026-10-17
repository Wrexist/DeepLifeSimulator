/**
 * "Report an ad" - the email draft behind the Settings row.
 *
 * App Review Guideline 2.5.18 (June 2023) requires an app that shows ads to let
 * the player report an inappropriate or age-inappropriate one. The game shows
 * AdMob banners and fullscreen ads but had no such control. Nothing is sent
 * automatically: the row opens a pre-filled draft the player can edit.
 */
import { SUPPORT_EMAIL } from '@/lib/config/appConfig';
import { BUILD_TAG } from '@/lib/config/buildTag';

export const REPORT_AD_SUBJECT = 'DeepLife: report an ad';

/** The draft body: what we need to find the ad in the AdMob ad review center. */
export function reportAdBody(platform: string): string {
  return [
    'What was wrong with the ad? (inappropriate, misleading, broken, other)',
    '',
    'What did it show or advertise?',
    '',
    'Where did it appear? (banner on Home, a video after a reward, year-end break)',
    '',
    'Roughly when did you see it?',
    '',
    '---',
    `App: ${BUILD_TAG} (${platform})`,
  ].join('\n');
}

export function reportAdMailUrl(platform: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(REPORT_AD_SUBJECT)}&body=${encodeURIComponent(reportAdBody(platform))}`;
}
