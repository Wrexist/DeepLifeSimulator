/**
 * Apple's upload-validation rules for `expo.ios.privacyManifests`.
 *
 * ## Why this is a module and not twenty lines inside the preflight script
 *
 * Because of what it costs to be wrong. These rules are checked by Apple AFTER
 * the build succeeds and AFTER the upload is accepted, so a mistake here is not
 * a failed build — it is a full build plus TestFlight processing, and then the
 * version sits in "Invalid Binary" (which is how builds 161 and 162 died). The
 * guard against that lived only in a script that a human has to remember to
 * run, and nothing tested the guard itself.
 *
 * Pulled out here so the test suite can check two separate things: that the
 * RULES are right, against every shape Apple rejects, and that THIS REPO'S
 * `app.config.js` satisfies them — the second of which turns the landmine from
 * something discovered on a round trip into a red test.
 *
 * Returns findings rather than logging or exiting, so the caller keeps its own
 * output format and its own notion of what is fatal.
 */

/**
 * @param {any} manifest The `expo.ios.privacyManifests` object.
 * @returns {{
 *   errors: { message: string, details: string[] }[],
 *   warnings: { message: string, details: string[] }[],
 *   tracking: boolean,
 *   domainCount: number,
 *   apiCount: number,
 * }}
 */
function validatePrivacyManifest(manifest) {
  const errors = [];
  const warnings = [];

  const tracking = manifest?.NSPrivacyTracking === true;
  const domains = manifest?.NSPrivacyTrackingDomains;
  const hasDomains = Array.isArray(domains) && domains.length > 0;

  // ITMS-91064, both directions. Apple's docs: when NSPrivacyTracking is true
  // "you need to provide a list of internet domains in NSPrivacyTrackingDomains";
  // conversely the domain list may only be present when tracking is declared.
  // An empty array satisfies neither.
  if (tracking && !hasDomains) {
    errors.push({
      message: '[FAIL] NSPrivacyTracking is true but NSPrivacyTrackingDomains is empty/absent',
      details: [
        '   Apple rejects this at upload with ITMS-91064 (Invalid tracking information)',
        '   → Either set NSPrivacyTracking: false and let the AdMob/Firebase SDK',
        '     manifests declare tracking (preferred — see app.config.js), or list the',
        '     real tracking domains. Note: domains listed here are BLOCKED by iOS when',
        '     ATT is denied, which stops ad serving for those users.',
      ],
    });
  } else if (!tracking && hasDomains) {
    errors.push({
      message: '[FAIL] NSPrivacyTrackingDomains is non-empty but NSPrivacyTracking is not true',
      details: ['   Apple rejects this at upload with ITMS-91064 (Invalid tracking information)'],
    });
  } else if (!tracking && Array.isArray(domains)) {
    // Not a hard reject, but an empty array with tracking false is noise that
    // reads like a half-applied fix — drop the key instead.
    warnings.push({
      message: '[WARN] NSPrivacyTrackingDomains is present but empty with NSPrivacyTracking false',
      details: ['   Remove the key entirely; an empty array is not a fix for ITMS-91064.'],
    });
  }

  // ITMS-91053/91055: every required-reason API entry needs a type and at least
  // one reason code, or the upload is rejected the same way.
  const apiTypes = manifest?.NSPrivacyAccessedAPITypes;
  if (apiTypes !== undefined) {
    if (!Array.isArray(apiTypes)) {
      errors.push({ message: '[FAIL] NSPrivacyAccessedAPITypes must be an array', details: [] });
    } else {
      apiTypes.forEach((entry, index) => {
        const type = entry && entry.NSPrivacyAccessedAPIType;
        const reasons = entry && entry.NSPrivacyAccessedAPITypeReasons;
        if (!type || typeof type !== 'string') {
          errors.push({
            message: `[FAIL] NSPrivacyAccessedAPITypes[${index}] is missing NSPrivacyAccessedAPIType`,
            details: [],
          });
        }
        if (!Array.isArray(reasons) || reasons.length === 0) {
          errors.push({
            message: `[FAIL] NSPrivacyAccessedAPITypes[${index}] (${type || 'unknown'}) has no reason codes`,
            details: [
              '   Apple rejects an accessed-API entry with an empty NSPrivacyAccessedAPITypeReasons',
            ],
          });
        }
      });
    }
  }

  return {
    errors,
    warnings,
    tracking,
    domainCount: Array.isArray(domains) ? domains.length : 0,
    apiCount: Array.isArray(apiTypes) ? apiTypes.length : 0,
  };
}

module.exports = { validatePrivacyManifest };
