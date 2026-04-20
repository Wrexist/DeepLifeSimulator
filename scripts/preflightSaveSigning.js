/**
 * Save-signing release guardrails for production builds.
 */
function evaluateSaveSigningEnv(env = process.env) {
  const requireSignedSaves = env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES !== 'false';
  const hmacKey = typeof env.EXPO_PUBLIC_SAVE_HMAC_KEY === 'string'
    ? env.EXPO_PUBLIC_SAVE_HMAC_KEY.trim()
    : '';
  const legacyAliasKey = typeof env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY === 'string'
    ? env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY.trim()
    : '';
  const allowWeakMigration = env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION === 'true';
  const allowUnsignedLegacySaves = env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES === 'true';
  const errors = [];
  const warnings = [];
  const keySource = hmacKey
    ? 'hmac'
    : legacyAliasKey
      ? 'legacy_alias'
      : 'missing';
  const activeKey = hmacKey || legacyAliasKey;

  if (requireSignedSaves) {
    if (!activeKey) {
      errors.push('EXPO_PUBLIC_SAVE_HMAC_KEY is required when signed saves are enforced.');
    } else if (!hmacKey && legacyAliasKey) {
      warnings.push(
        'Using deprecated EXPO_PUBLIC_SAVE_SIGNATURE_KEY fallback; migrate to EXPO_PUBLIC_SAVE_HMAC_KEY.'
      );
    }
    if (allowWeakMigration) {
      errors.push('EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION must be false for production signed saves.');
    }
    if (allowUnsignedLegacySaves) {
      errors.push('EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES must be false for production signed saves.');
    }
  }

  return {
    valid: errors.length === 0,
    requireSignedSaves,
    errors,
    warnings,
    keySource,
  };
}

module.exports = {
  evaluateSaveSigningEnv,
};
