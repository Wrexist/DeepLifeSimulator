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

  // Metro's EXPO_PUBLIC_* inlining only rewrites direct `process.env.X` member
  // reads, so `env.X` on the default-param object is always undefined in web
  // exports. Fall back to the inlined reads — but ONLY when the caller did not
  // pass an explicit env override (tests inject bare env objects and must not
  // pick up ambient values).
  const isAmbientEnv = env === process.env;
  const configuredRaw =
    env.EXPO_PUBLIC_SAVE_HMAC_KEY ||
    env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY ||
    (isAmbientEnv
      ? process.env.EXPO_PUBLIC_SAVE_HMAC_KEY || process.env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY
      : undefined);
  const configuredHmacKey = typeof configuredRaw === 'string' ? configuredRaw.trim() : '';

  return {
    isDev,
    requireSignedSaves:
      !isDev &&
      env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES !== 'false' &&
      !(isAmbientEnv && process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES === 'false'),
    allowWeakSaveMigration:
      isDev ||
      env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION === 'true' ||
      (isAmbientEnv && process.env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION === 'true'),
    allowUnsignedLegacySaves:
      isDev ||
      env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES === 'true' ||
      (isAmbientEnv && process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES === 'true'),
    configuredHmacKey: configuredHmacKey.length > 0 ? configuredHmacKey : null,
  };
}

export function resolveActiveSaveHmacKey(config: SaveSigningRuntimeConfig): string | null {
  const [signingKey] = resolveSaveHmacKeys(config);
  return signingKey ?? null;
}

/**
 * Every key a save may be verified against — the first one signs, all of them
 * verify.
 *
 * There was exactly one key, compared with a single `!==`, and no key id in the
 * envelope. So a rotation did not degrade anything gracefully: it invalidated
 * every save on every device at once, with no in-field lever to get them back
 * (the weak-migration fallback is refused by the production preflight). And the
 * blast radius is not only saves — paid permanent entitlements are signed with
 * the same key and fail closed to `[]`, so a key change also presents a paying
 * player as never having purchased. `tasks/leaked-key-rotation-runbook.md`
 * shows rotation is a live plan. 2026-07-29 audit SEC-2 / SEC-7.
 *
 * Configure as a comma-separated list, newest first:
 *   EXPO_PUBLIC_SAVE_HMAC_KEY="new-key,previous-key"
 * New writes are signed with `new-key`; saves signed with `previous-key` keep
 * verifying and re-sign onto the current key the next time they are written.
 */
export function resolveSaveHmacKeys(config: SaveSigningRuntimeConfig): string[] {
  const keys: string[] = [];

  if (config.configuredHmacKey) {
    for (const part of config.configuredHmacKey.split(',')) {
      const trimmed = part.trim();
      if (trimmed.length > 0 && !keys.includes(trimmed)) keys.push(trimmed);
    }
  }

  if (keys.length === 0 && config.isDev) {
    keys.push('dev-local-save-hmac-key');
  }

  return keys;
}

export function resolveActiveSaveHmacKeyOrThrow(config: SaveSigningRuntimeConfig): string | null {
  const activeKey = resolveActiveSaveHmacKey(config);
  if (activeKey) return activeKey;

  if (!config.requireSignedSaves || config.allowWeakSaveMigration) {
    return null;
  }

  throw new SaveSigningConfigError();
}
