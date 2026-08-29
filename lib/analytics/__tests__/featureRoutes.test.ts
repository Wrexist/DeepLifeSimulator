import { featureForAppId, featureForRoute } from '../featureRoutes';
import { isTrackedFeature } from '../featureAdoption';

describe('featureForRoute', () => {
  it('matches on the LAST segment, so a group prefix cannot break it', () => {
    // expo-router strips `(group)` segments in PRODUCTION ONLY (CLAUDE.md §5),
    // so a map keyed on full paths would work in development and quietly stop
    // working in the build that ships.
    expect(featureForRoute('/work')).toBe('career');
    expect(featureForRoute('/(tabs)/work')).toBe('career');
    expect(featureForRoute('(tabs)/work')).toBe('career');
    expect(featureForRoute('/work?tab=jobs')).toBe('career');
  });

  it('returns null for hubs rather than recording them as features', () => {
    // A permanent 100%-adoption row next to the real ones makes the column
    // useless for ranking.
    expect(featureForRoute('/home')).toBeNull();
    expect(featureForRoute('/apps')).toBeNull();
  });

  it('handles empty and missing paths', () => {
    expect(featureForRoute('')).toBeNull();
    expect(featureForRoute(null)).toBeNull();
    expect(featureForRoute(undefined)).toBeNull();
    expect(featureForRoute('/')).toBeNull();
  });
});

describe('featureForAppId', () => {
  it('maps the launcher grid ids', () => {
    expect(featureForAppId('bitcoin')).toBe('crypto');
    expect(featureForAppId('onion')).toBe('darkweb');
    expect(featureForAppId('tinder')).toBe('dating');
    expect(featureForAppId('realestate')).toBe('real_estate');
  });

  it('accepts BOTH spellings of the pet app alias', () => {
    // The desktop grid calls it `paw` and the phone grid `pet`; mapping only
    // one would halve that feature's adoption for no reason a reader could see.
    expect(featureForAppId('paw')).toBe('pets');
    expect(featureForAppId('pet')).toBe('pets');
  });

  it('returns null for an unmapped or missing id', () => {
    expect(featureForAppId('contacts')).toBeNull();
    expect(featureForAppId(null)).toBeNull();
    expect(featureForAppId('')).toBeNull();
  });
});

describe('the map only ever yields catalogued features', () => {
  it('every mapped value is a real tracked feature', () => {
    // A route or app id mapped to an uncatalogued string would be dropped
    // silently by `record()`, producing a feature that looks instrumented and
    // measures nothing.
    const routes = ['/work', '/health', '/market', '/progression'];
    const appIds = [
      'bitcoin', 'realestate', 'onion', 'tinder', 'mail', 'social', 'stocks',
      'bank', 'education', 'company', 'paw', 'pet', 'travel', 'political', 'luxury',
    ];
    for (const route of routes) {
      const feature = featureForRoute(route);
      expect(feature).not.toBeNull();
      expect(isTrackedFeature(feature as string)).toBe(true);
    }
    for (const id of appIds) {
      const feature = featureForAppId(id);
      expect(feature).not.toBeNull();
      expect(isTrackedFeature(feature as string)).toBe(true);
    }
  });
});
