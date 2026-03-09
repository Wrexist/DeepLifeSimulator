/**
 * Save-signing release guardrails for production builds.
 */
function evaluateSaveSigningEnv(env = process.env) {
  const requireSignedSaves = env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES !== 'false';
  const hmacKey = typeof env.EXPO_PUBLIC_SAVE_HMAC_KEY === 'string'
    ? env.EXPO_PUBLIC_SAVE_HMAC_KEY.trim()
    : '';
  const allowWeakMigration = env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION === 'true';
  const allowUnsignedLegacySaves = env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES === 'true';
  const errors = [];

  if (requireSignedSaves) {
    if (!hmacKey) {
      errors.push('EXPO_PUBLIC_SAVE_HMAC_KEY is required when signed saves are enforced.');
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
  };
}

module.exports = {
  evaluateSaveSigningEnv,
};
