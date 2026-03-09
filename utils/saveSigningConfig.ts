declare const __DEV__: boolean | undefined;

export const SAVE_SIGNING_CONFIG_ERROR_CODE = 'missing_save_hmac_key_in_production';

export class SaveSigningConfigError extends Error {
  readonly code = SAVE_SIGNING_CONFIG_ERROR_CODE;

  constructor(message = 'Save signing is required but EXPO_PUBLIC_SAVE_HMAC_KEY is missing in production') {
    super(message);
    this.name = 'SaveSigningConfigError';
  }
}

export function isSaveSigningConfigError(error: unknown): error is SaveSigningConfigError {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === SAVE_SIGNING_CONFIG_ERROR_CODE ||
    candidate.name === 'SaveSigningConfigError'
  );
}

export interface SaveSigningRuntimeConfig {
  isDev: boolean;
  requireSignedSaves: boolean;
  allowWeakSaveMigration: boolean;
  allowUnsignedLegacySaves: boolean;
  configuredHmacKey: string | null;
}

export function resolveSaveSigningRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  explicitIsDev?: boolean
): SaveSigningRuntimeConfig {
  const isDev =
    typeof explicitIsDev === 'boolean'
      ? explicitIsDev
      : ((typeof __DEV__ !== 'undefined' && __DEV__) || env.NODE_ENV !== 'production');

  const configuredRaw = env.EXPO_PUBLIC_SAVE_HMAC_KEY || env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY;
  const configuredHmacKey = typeof configuredRaw === 'string' ? configuredRaw.trim() : '';

  return {
    isDev,
    requireSignedSaves: !isDev && env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES !== 'false',
    allowWeakSaveMigration: isDev || env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION === 'true',
    allowUnsignedLegacySaves: isDev || env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES === 'true',
    configuredHmacKey: configuredHmacKey.length > 0 ? configuredHmacKey : null,
  };
}

export function resolveActiveSaveHmacKey(config: SaveSigningRuntimeConfig): string | null {
  if (config.configuredHmacKey) {
    return config.configuredHmacKey;
  }

  if (config.isDev) {
    return 'dev-local-save-hmac-key';
  }

  return null;
}

export function resolveActiveSaveHmacKeyOrThrow(config: SaveSigningRuntimeConfig): string | null {
  const activeKey = resolveActiveSaveHmacKey(config);
  if (activeKey) return activeKey;

  if (!config.requireSignedSaves || config.allowWeakSaveMigration) {
    return null;
  }

  throw new SaveSigningConfigError();
}
