import fs from 'fs';
import path from 'path';
import { isPristineUnstartedState } from '@/utils/saveValidation';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

/**
 * VIS-1: GameStateProvider lives inside the ROOT route. When the root route
 * re-mounts (web: React Navigation's resetRoot on browser Back/Forward to an
 * entry it did not create; native: a root reset), the provider comes back on
 * `initialGameState` while the router stays on the tabs, and the player sees a
 * stranger ('Player', 18, $200) whose weeks are never saved. The tab layout
 * now refuses to run on that template state and returns to the main menu.
 */
describe('tab layout refuses the unstarted template state (VIS-1)', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/_layout.tsx'), 'utf8');

  it('the provider template is what the guard detects, and a real life is not', () => {
    expect(isPristineUnstartedState(initialGameState)).toBe(true);
    // Onboarding always stamps a scenario and a name.
    const base = createTestGameState();
    const started = createTestGameState({
      scenarioId: 'food_courier',
      userProfile: { ...base.userProfile, firstName: 'Elena', lastName: 'Anderson' },
    });
    expect(isPristineUnstartedState(started)).toBe(false);
  });

  it('subscribes to the pristine check and replaces the route with the main menu', () => {
    expect(source).toMatch(/useGameSelector\(\(s\) => isPristineUnstartedState\(s\)\)/);
    const effect = source.slice(source.indexOf('const isTemplateState'));
    expect(effect.slice(0, 600)).toMatch(/router\.replace\('\/\(onboarding\)\/MainMenu'\)/);
  });
});
