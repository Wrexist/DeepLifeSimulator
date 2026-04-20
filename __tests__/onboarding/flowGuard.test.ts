import { canAccessScreen } from '@/src/features/onboarding/flowGuard';

describe('canAccessScreen', () => {
  describe('Scenarios', () => {
    it('always allows access', () => {
      expect(canAccessScreen('Scenarios', {})).toEqual({ allowed: true });
    });
  });

  describe('Customize', () => {
    it('allows when scenario is set', () => {
      expect(canAccessScreen('Customize', { scenario: { id: 'test' } })).toEqual({ allowed: true });
    });

    it('blocks when scenario is missing', () => {
      const result = canAccessScreen('Customize', {});
      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/(onboarding)/Scenarios');
    });
  });

  describe('Perks', () => {
    it('allows when scenario and identity are set', () => {
      const result = canAccessScreen('Perks', {
        scenario: { id: 'test' },
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks when scenario is missing', () => {
      const result = canAccessScreen('Perks', { firstName: 'Jane', lastName: 'Doe' });
      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/(onboarding)/Scenarios');
    });

    it('blocks when firstName is empty', () => {
      const result = canAccessScreen('Perks', { scenario: { id: 'x' }, firstName: '', lastName: 'Doe' });
      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/(onboarding)/Customize');
    });

    it('blocks when lastName is empty', () => {
      const result = canAccessScreen('Perks', { scenario: { id: 'x' }, firstName: 'Jane', lastName: '' });
      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/(onboarding)/Customize');
    });

    it('blocks when firstName is whitespace only', () => {
      const result = canAccessScreen('Perks', { scenario: { id: 'x' }, firstName: '   ', lastName: 'Doe' });
      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/(onboarding)/Customize');
    });
  });
});
