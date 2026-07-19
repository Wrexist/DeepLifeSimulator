/**
 * Phantom "Unnamed Character" save on clean installs.
 *
 * Old builds persisted the pristine boot state when the background/periodic
 * autosave fired on the main menu of a fresh install, creating a fake
 * "Unnamed Character · $200 · 18 yrs · 0 weeks" save in slot 1. These tests
 * pin the two layers of the fix: the pristine-state detector saveGame gates
 * on, and the meta pre-filter the MainMenu self-heal uses.
 */
import { isPristineUnstartedState } from '@/utils/saveValidation';
import { saveSlotMetaLooksPhantom } from '@/utils/phantomSaveCleanup';
import { initialGameState } from '@/contexts/game/initialState';

describe('isPristineUnstartedState', () => {
  it('flags the actual boot default as pristine (the regression case)', () => {
    // The REAL initial state — if someone later adds a default scenarioId or
    // firstName to it, this test forces a rethink of the guard.
    expect(isPristineUnstartedState(initialGameState)).toBe(true);
  });

  it('treats any onboarding-built state as a real game', () => {
    expect(
      isPristineUnstartedState({
        ...initialGameState,
        scenarioId: 'food_courier',
        userProfile: { ...initialGameState.userProfile, firstName: 'Ava', lastName: 'Larsson' },
      })
    ).toBe(false);
  });

  it('a name alone is enough (legacy saves without scenarioId stay saveable)', () => {
    expect(
      isPristineUnstartedState({
        ...initialGameState,
        userProfile: { ...initialGameState.userProfile, firstName: 'Ava' },
      })
    ).toBe(false);
    expect(
      isPristineUnstartedState({
        ...initialGameState,
        userProfile: { ...initialGameState.userProfile, lastName: 'Larsson' },
      })
    ).toBe(false);
  });

  it('a scenario alone is enough', () => {
    expect(isPristineUnstartedState({ ...initialGameState, scenarioId: 'trust_fund' })).toBe(false);
  });

  it('whitespace-only names do not count as a real character', () => {
    expect(
      isPristineUnstartedState({
        ...initialGameState,
        userProfile: { ...initialGameState.userProfile, firstName: '   ' },
      })
    ).toBe(true);
  });

  it('null/garbage is pristine (nothing worth persisting)', () => {
    expect(isPristineUnstartedState(null)).toBe(true);
    expect(isPristineUnstartedState(undefined)).toBe(true);
    expect(isPristineUnstartedState('x')).toBe(true);
  });
});

describe('saveSlotMetaLooksPhantom', () => {
  const base = { age: 18, money: 200, weeksLived: 0, updatedAt: 0 };

  it('matches the phantom summary (empty name, 0 weeks)', () => {
    expect(saveSlotMetaLooksPhantom({ ...base, name: '' })).toBe(true);
    expect(saveSlotMetaLooksPhantom({ ...base, name: '  ' })).toBe(true);
  });

  it('never matches a named character or a lived life', () => {
    expect(saveSlotMetaLooksPhantom({ ...base, name: 'Ava Larsson' })).toBe(false);
    expect(saveSlotMetaLooksPhantom({ ...base, name: '', weeksLived: 12 })).toBe(false);
  });
});
