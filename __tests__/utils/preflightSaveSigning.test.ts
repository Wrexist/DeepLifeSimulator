describe('preflight save signing guardrails', () => {
  const { evaluateSaveSigningEnv } = require('@/scripts/preflightSaveSigning');

  it('fails when signed saves are enforced and HMAC key is missing', () => {
    const result = evaluateSaveSigningEnv({
      EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: 'true',
      EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: 'false',
      EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES: 'false',
    });

    expect(result.valid).toBe(false);
    expect(result.keySource).toBe('missing');
    expect(result.errors.some((error: string) => error.includes('EXPO_PUBLIC_SAVE_HMAC_KEY'))).toBe(true);
  });

  it('fails when weak migration flags are enabled under strict signed saves', () => {
    const result = evaluateSaveSigningEnv({
      EXPO_PUBLIC_SAVE_HMAC_KEY: 'test-production-signing-key',
      EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: 'true',
      EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: 'true',
      EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES: 'true',
    });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error: string) => error.includes('EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION'))
    ).toBe(true);
    expect(
      result.errors.some((error: string) => error.includes('EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES'))
    ).toBe(true);
  });

  it('passes when strict signed saves are configured correctly', () => {
    const result = evaluateSaveSigningEnv({
      EXPO_PUBLIC_SAVE_HMAC_KEY: 'test-production-signing-key',
      EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: 'true',
      EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: 'false',
      EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES: 'false',
    });

    expect(result.valid).toBe(true);
    expect(result.keySource).toBe('hmac');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes with legacy alias key and warns for migration', () => {
    const result = evaluateSaveSigningEnv({
      EXPO_PUBLIC_SAVE_SIGNATURE_KEY: 'legacy-test-signing-key',
      EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: 'true',
      EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: 'false',
      EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES: 'false',
    });

    expect(result.valid).toBe(true);
    expect(result.keySource).toBe('legacy_alias');
    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.some((warning: string) => warning.includes('EXPO_PUBLIC_SAVE_SIGNATURE_KEY'))
    ).toBe(true);
  });
});
