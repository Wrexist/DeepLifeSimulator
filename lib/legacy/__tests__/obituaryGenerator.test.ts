import { generateObituary } from '@/lib/legacy/obituaryGenerator';
import { APP_STORE_URL } from '@/lib/config/appConfig';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('generateObituary', () => {
  it('returns a headline, body, and shareText', () => {
    const state = createTestGameState();
    const obit = generateObituary(state);
    expect(typeof obit.headline).toBe('string');
    expect(typeof obit.body).toBe('string');
    expect(typeof obit.shareText).toBe('string');
    expect(obit.shareText.length).toBeGreaterThan(0);
  });

  it('includes the App Store install link so shares convert to installs', () => {
    const state = createTestGameState();
    const obit = generateObituary(state);
    // The install link is the growth lever — a shared obituary with no link is a
    // dead end. Guard it so a future refactor can't silently drop it.
    expect(obit.shareText).toContain(APP_STORE_URL);
  });

  it('keeps the #DeepLifeSim hashtag for discoverability', () => {
    const state = createTestGameState();
    const obit = generateObituary(state);
    expect(obit.shareText).toContain('#DeepLifeSim');
  });

  it('never throws on a minimal / sparse state', () => {
    const state = createTestGameState();
    // Strip optional life facts to exercise the "lived a quiet life" path.
    const sparse = {
      ...state,
      careers: [],
      educations: [],
      family: { ...state.family, spouse: undefined, children: [] },
      companies: [],
      realEstate: [],
    } as typeof state;
    expect(() => generateObituary(sparse)).not.toThrow();
  });
});
