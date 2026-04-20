describe('save signing configuration errors', () => {
  const {
    resolveSaveSigningRuntimeConfig,
    resolveActiveSaveHmacKeyOrThrow,
    SaveSigningConfigError,
    isSaveSigningConfigError,
    SAVE_SIGNING_CONFIG_ERROR_CODE,
  } = require('@/utils/saveSigningConfig');

  it('throws deterministic config error when strict production signing is enabled without HMAC key', () => {
    const config = resolveSaveSigningRuntimeConfig(
      {
        NODE_ENV: 'production',
        EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: 'true',
        EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: 'false',
      },
      false
    );

    let thrownError: unknown = null;
    try {
      resolveActiveSaveHmacKeyOrThrow(config);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeTruthy();
    expect(thrownError).toBeInstanceOf(SaveSigningConfigError);
    expect(isSaveSigningConfigError(thrownError)).toBe(true);
    expect((thrownError as { code?: string }).code).toBe(SAVE_SIGNING_CONFIG_ERROR_CODE);
  });

  it('returns active HMAC key when strict production signing has key configured', () => {
    const config = resolveSaveSigningRuntimeConfig(
      {
        NODE_ENV: 'production',
        EXPO_PUBLIC_SAVE_HMAC_KEY: 'test-production-signing-key',
        EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: 'true',
        EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: 'false',
      },
      false
    );

    const key = resolveActiveSaveHmacKeyOrThrow(config);
    expect(key).toBe('test-production-signing-key');
  });
});
