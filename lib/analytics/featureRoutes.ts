/**
 * The map from what the player navigated to → which FEATURE that is.
 *
 * WHY A MAP AND NOT A CALL AT EACH SURFACE. Adoption telemetry is only worth
 * having if every feature is measured the same way; scattering
 * `trackFeatureUse('crypto', …)` through twenty screens guarantees that three
 * of them get the id wrong, two get it twice, and the ones added next quarter
 * get nothing at all. Routes and in-game app ids are data the app already has,
 * so the mapping is a lookup table with one call site per surface type rather
 * than a convention nobody can enforce.
 *
 * WHY NOT EVERY ROUTE. Several tabs are hubs rather than features — `home` is
 * the core loop, `apps` is a launcher. Recording those as adoption would put a
 * 100%-adoption row next to the real ones and make the column useless for
 * ranking. Absent from the map means "not a feature", deliberately.
 *
 * Pure and dependency-free, so the mapping is testable without a router.
 */
import type { TrackedFeature } from './featureAdoption';

/**
 * expo-router pathname → feature.
 *
 * Keys are matched against the LAST path segment, so `(tabs)` groups, leading
 * slashes and query strings cannot break the lookup — expo-router strips group
 * segments in production only (CLAUDE.md §5), and a map keyed on full paths
 * would therefore work in development and quietly stop working in the build
 * that ships.
 */
const ROUTE_FEATURES: Readonly<Record<string, TrackedFeature>> = {
  work: 'career',
  health: 'health',
  market: 'stocks',
  progression: 'prestige',
};

/**
 * In-game app id (the `computer` / `mobile` launcher grids) → feature.
 *
 * The two grids share ids and both carry the `paw`/`pet` alias, so both
 * spellings are mapped here rather than at the call sites.
 */
const APP_FEATURES: Readonly<Record<string, TrackedFeature>> = {
  bitcoin: 'crypto',
  realestate: 'real_estate',
  onion: 'darkweb',
  tinder: 'dating',
  mail: 'mail',
  social: 'social_media',
  stocks: 'stocks',
  bank: 'banking',
  education: 'education',
  company: 'business',
  paw: 'pets',
  pet: 'pets',
  travel: 'travel',
  political: 'politics',
  luxury: 'luxury',
};

/** The last non-empty path segment, with any query string removed. */
function lastSegment(pathname: string): string {
  const path = pathname.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/** The feature a route represents, or null when it is a hub rather than a feature. */
export function featureForRoute(pathname: string | null | undefined): TrackedFeature | null {
  if (!pathname) return null;
  return ROUTE_FEATURES[lastSegment(pathname)] ?? null;
}

/** The feature an in-game app id represents, or null when it is not measured. */
export function featureForAppId(appId: string | null | undefined): TrackedFeature | null {
  if (!appId) return null;
  return APP_FEATURES[appId] ?? null;
}
