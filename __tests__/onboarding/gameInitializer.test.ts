import {
  validateOnboardingInputs,
  initializeAndSaveGame,
  type InitializeGameDeps,
  type OnboardingInputs,
} from '@/src/features/onboarding/gameInitializer';

// ---------------------------------------------------------------------------
// validateOnboardingInputs
// ---------------------------------------------------------------------------

describe('validateOnboardingInputs', () => {
  const validInputs: OnboardingInputs = {
    scenario: { id: 'test', start: { age: 20, cash: 500 } },
    firstName: 'Jane',
    lastName: 'Doe',
    sex: 'female',
    sexuality: 'straight',
  };

  it('passes for valid inputs', () => {
    expect(validateOnboardingInputs(validInputs)).toEqual({ valid: true });
  });

  it('fails when scenario is missing', () => {
    const result = validateOnboardingInputs({ ...validInputs, scenario: undefined });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Missing Scenario');
  });

  it('fails when firstName is empty', () => {
    const result = validateOnboardingInputs({ ...validInputs, firstName: '' });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Missing First Name');
  });

  it('fails when firstName is whitespace only', () => {
    const result = validateOnboardingInputs({ ...validInputs, firstName: '   ' });
    expect(result.valid).toBe(false);
  });

  it('fails when lastName is empty', () => {
    const result = validateOnboardingInputs({ ...validInputs, lastName: '' });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Missing Last Name');
  });

  it('fails for invalid sex value', () => {
    const result = validateOnboardingInputs({ ...validInputs, sex: 'other' });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Invalid Character Sex');
  });

  it('accepts random as valid sex', () => {
    const result = validateOnboardingInputs({ ...validInputs, sex: 'random' });
    expect(result.valid).toBe(true);
  });

  it('fails for invalid sexuality', () => {
    const result = validateOnboardingInputs({ ...validInputs, sexuality: 'other' });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Invalid Sexuality');
  });

  it('fails when scenario start is missing', () => {
    const result = validateOnboardingInputs({ ...validInputs, scenario: { id: 'x', start: null as any } });
    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe('Invalid Scenario');
  });

  it('fails for age below 18', () => {
    const result = validateOnboardingInputs({ ...validInputs, scenario: { id: 'x', start: { age: 10, cash: 0 } } });
    expect(result.valid).toBe(false);
  });

  it('fails for negative cash', () => {
    const result = validateOnboardingInputs({ ...validInputs, scenario: { id: 'x', start: { age: 20, cash: -100 } } });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// initializeAndSaveGame
// ---------------------------------------------------------------------------

describe('initializeAndSaveGame', () => {
  const mockDeps = (): InitializeGameDeps => ({
    validateOnboardingState: jest.fn(() => ({ valid: true, errors: [], warnings: [] })),
    applySafeDefaults: jest.fn(() => ({ defaults: [] })),
    createBackupFromState: jest.fn(async () => {}),
    forceSave: jest.fn(async () => {}),
    loadGame: jest.fn(async () => ({ version: 12, valid: true })),
    validateGameEntry: jest.fn(() => ({ canEnter: true, errors: [], warnings: [] })),
    isSaveSigningConfigError: jest.fn(() => false),
  });

  it('succeeds on valid flow', async () => {
    const deps = mockDeps();
    const result = await initializeAndSaveGame({ version: 12 }, 1, deps);
    expect(result.success).toBe(true);
    expect(deps.forceSave).toHaveBeenCalledWith(1, expect.anything());
    expect(deps.loadGame).toHaveBeenCalledWith(1);
  });

  it('fails when validation fails and defaults do not fix it', async () => {
    const deps = mockDeps();
    (deps.validateOnboardingState as jest.Mock).mockReturnValue({ valid: false, errors: ['bad field'], warnings: [] });
    const result = await initializeAndSaveGame({}, 1, deps);
    expect(result.success).toBe(false);
    expect(result.errorTitle).toBe('Game Creation Failed');
  });

  it('recovers when defaults fix validation', async () => {
    const deps = mockDeps();
    let callCount = 0;
    (deps.validateOnboardingState as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { valid: false, errors: ['fixable'], warnings: [] };
      return { valid: true, errors: [], warnings: [] };
    });
    const result = await initializeAndSaveGame({}, 1, deps);
    expect(result.success).toBe(true);
  });

  it('fails when save throws', async () => {
    const deps = mockDeps();
    (deps.forceSave as jest.Mock).mockRejectedValue(new Error('disk full'));
    const result = await initializeAndSaveGame({}, 1, deps);
    expect(result.success).toBe(false);
    expect(result.errorTitle).toBe('Save Failed');
  });

  it('returns build config error when save signing fails', async () => {
    const deps = mockDeps();
    (deps.forceSave as jest.Mock).mockRejectedValue(new Error('signing'));
    (deps.isSaveSigningConfigError as jest.Mock).mockReturnValue(true);
    const result = await initializeAndSaveGame({}, 1, deps);
    expect(result.success).toBe(false);
    expect(result.errorTitle).toBe('Build Configuration Error');
  });

  it('fails when loadGame returns null', async () => {
    const deps = mockDeps();
    (deps.loadGame as jest.Mock).mockResolvedValue(null);
    const result = await initializeAndSaveGame({}, 1, deps);
    expect(result.success).toBe(false);
    expect(result.errorTitle).toBe('Load Failed');
  });

  it('fails when game entry validation rejects', async () => {
    const deps = mockDeps();
    (deps.validateGameEntry as jest.Mock).mockReturnValue({ canEnter: false, errors: ['version mismatch'], warnings: [], versionCompatible: false });
    const result = await initializeAndSaveGame({}, 1, deps);
    expect(result.success).toBe(false);
    expect(result.errorTitle).toBe('Version Incompatible');
  });

  it('calls createBackupFromState before save', async () => {
    const deps = mockDeps();
    const callOrder: string[] = [];
    (deps.createBackupFromState as jest.Mock).mockImplementation(async () => { callOrder.push('backup'); });
    (deps.forceSave as jest.Mock).mockImplementation(async () => { callOrder.push('save'); });
    await initializeAndSaveGame({}, 1, deps);
    expect(callOrder).toEqual(['backup', 'save']);
  });
});
