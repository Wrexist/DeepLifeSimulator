import { entryArtwork, challengeArtwork, perkArtwork, mindsetArtwork } from '@/lib/config/entryArtwork';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { perks } from '@/src/features/onboarding/perksData';
import { SCENARIOS } from '@/lib/scenarios/scenarioDefinitions';
import { MINDSET_TRAITS } from '@/lib/mindset/config';

describe('entry catalogue artwork coverage', () => {
  it.each([
    ['life paths', scenarios, entryArtwork],
    ['challenges', SCENARIOS, challengeArtwork],
    ['perks', perks, perkArtwork],
    ['mindsets', MINDSET_TRAITS, mindsetArtwork],
  ] as const)('provides grounded art for every current %s option', (_name, catalogue, artwork) => {
    expect(catalogue.filter(item => !artwork[item.id]).map(item => item.id)).toEqual([]);
    expect(Object.keys(artwork).filter(id => !catalogue.some(item => item.id === id))).toEqual([]);
  });
});
