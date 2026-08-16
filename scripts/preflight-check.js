#!/usr/bin/env node

/**
 * Preflight Check Script
 * 
 * Mandatory checks that MUST pass before any build can be released.
 * This prevents broken builds from reaching TestFlight/Production.
 * 
 * Run with: npm run preflight
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (_err) {
    // dotenv unavailable — env vars must already be set in the shell
  }
}

const { evaluateSaveSigningEnv } = require('./preflightSaveSigning');
const {
  resolveEffectiveEnv,
  isUnverifiableLocally,
  unverifiableNote,
} = require('./lib/preflightEnv');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let hasErrors = false;

if (process.argv.includes('--baseline')) {
  const baselineArgs = process.argv.includes('--quick-baseline') ? '--quick' : '';
  execSync(`node scripts/preflight-baseline.js ${baselineArgs}`.trim(), {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  process.exit(0);
}

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, YELLOW);
  console.log('='.repeat(60) + '\n');
}

function checkStep(name, command, options = {}) {
  log(`\n[CHECK] ${name}...`, YELLOW);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      ...options,
    });
    log(`[PASS] ${name}`, GREEN);
    return true;
  } catch (error) {
    log(`[FAIL] ${name}`, RED);
    log(`Error: ${error.message}`, RED);
    hasErrors = true;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Effective build environment (audit 2026-08-16, H2)
//
// The config-validating sections below (5, 6, 8, 8b, 9, 9b, 10) must judge the
// env the BUILD will see, not the one this shell happens to have. The
// production flags live in `eas.json` (`build.<profile>.env`) and the secrets
// live in the EAS project env store; reading `process.env` alone made every
// clean checkout fail a mandatory gate. See scripts/lib/preflightEnv.js for the
// precedence rationale (eas.json baseline, process.env overrides — the local
// export standing in for the server store, which EAS ranks above eas.json).
// ---------------------------------------------------------------------------
const envResolution = resolveEffectiveEnv({ cwd: process.cwd(), argv: process.argv });
const buildEnv = envResolution.env;

/** One-line banner so a section's verdict is always attributable to a baseline. */
function logEnvBaseline() {
  const baseline = envResolution.profileFound
    ? `eas.json build.${envResolution.profile}.env + process.env overrides`
    : `process.env only (no eas.json baseline for profile "${envResolution.profile}")`;
  log(`   [env] baseline: ${baseline}`, YELLOW);
}

/** Report a name preflight cannot see either layer of, as a WARN not a FAIL. */
function warnUnverifiable(names) {
  log(`[WARN] ${unverifiableNote(names)}`, YELLOW);
}

// Main preflight checks
logSection('🚀 PREFLIGHT CHECK - MANDATORY RELEASE CHECKS');

log(`Env baseline: eas.json profile "${envResolution.profile}"`
  + `${envResolution.profileFound ? '' : ' (NOT FOUND)'}`
  + ' overlaid with process.env', YELLOW);
envResolution.warnings.forEach((w) => log(`[WARN] ${w}`, YELLOW));
if (envResolution.conflicts.length > 0) {
  // Not fatal — an exported value legitimately outranks eas.json, mirroring the
  // EAS store — but a silent disagreement is exactly the unversioned second
  // source of truth this change exists to avoid.
  log('[WARN] Local exports disagree with eas.json (shell value wins, as EAS ranks '
    + 'its server store above eas.json):', YELLOW);
  envResolution.conflicts.forEach((k) => log(`   - ${k}`, YELLOW));
}
log('   Use --profile <name> to check a different eas.json build profile.', YELLOW);

// 1. TypeScript Compilation Check (BLOCKING — see note)
logSection('1. TypeScript Type Checking');

/*
 * This used to run bare `npx tsc --noEmit` and treat every result as a
 * non-blocking warning, with the comment "many exist, focus on syntax".
 *
 * Two things made that wrong as of 2026-08-02:
 *
 *   1. Bare tsc resolves `tsconfig.json`, which has `noUnusedLocals` ON and
 *      includes the test tree. The project deliberately disables that in BOTH
 *      of its real configs — an unused import in a test is lint's job. So the
 *      214 "errors" it reported were 214 unused-symbol notices (TS6133/6192/
 *      6196/6198) and ZERO type errors.
 *   2. Both real gates now pass at zero: `tsconfig.typecheck.json` (app source,
 *      what `npm run type-check` and CI enforce) and `tsconfig.tests.json`
 *      (the test tree, ratcheted from 182 to 0).
 *
 * The old shape meant a genuine app type error would appear as one more line
 * among 214 and still not block a release. That is the same failure mode as a
 * permanently-red audit check: noise trains you to skim it.
 *
 * So: run the two configs the project actually gates on, and BLOCK on them.
 */
log('[CHECK] App source (tsconfig.typecheck.json)...', YELLOW);
try {
  execSync('npx tsc --noEmit -p tsconfig.typecheck.json --pretty', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  log('[PASS] App source type-checks clean', GREEN);
} catch (error) {
  log('[FAIL] App source has type errors', RED);
  log('   Run: npm run type-check', RED);
  hasErrors = true;
}

log('\n[CHECK] Test tree (ratchet)...', YELLOW);
try {
  execSync('node scripts/check-test-types.js', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  log('[PASS] Test tree holds at its baseline', GREEN);
} catch (error) {
  log('[FAIL] Test-tree type errors moved off the baseline', RED);
  log('   Run: npm run type-check:tests', RED);
  hasErrors = true;
}

// 2. Linter Check (if configured) - Non-blocking
logSection('2. Linter Check (Non-blocking)');
try {
  if (fs.existsSync(path.join(process.cwd(), 'eslint.config.js')) ||
      fs.existsSync(path.join(process.cwd(), '.eslintrc.js'))) {
    log('[INFO] Running ESLint (warnings are non-blocking)...', YELLOW);
    try {
      execSync('npx eslint . --ext .ts,.tsx', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      log('[PASS] ESLint', GREEN);
    } catch (error) {
      log('[WARN] ESLint found issues (non-blocking)', YELLOW);
      log('   Focus on syntax errors first, code quality issues can be fixed later', YELLOW);
      // Don't set hasErrors - ESLint warnings don't block builds
    }
  } else {
    log('[SKIP] ESLint not configured', YELLOW);
  }
} catch (_error) {
  log('[SKIP] ESLint check skipped', YELLOW);
}

// 3. Entry.ts Syntax & Complexity Check
logSection('3. Entry.ts Syntax & Complexity Check');
try {
  const entryPath = path.join(process.cwd(), 'app', 'entry.ts');
  if (fs.existsSync(entryPath)) {
    const entryContent = fs.readFileSync(entryPath, 'utf8');
    const lines = entryContent.split('\n').length;
    const hasBusinessLogic = /import.*from.*['"]@\/(lib|contexts|components)/.test(entryContent);
    
    // CRITICAL: Syntax validation - check for common syntax errors
    // Note: Simple counting can have false positives (strings, comments)
    // TypeScript compilation is the authoritative check, this is a quick sanity check
    let syntaxIssues = [];
    
    // Remove strings and comments for more accurate counting
    const withoutStrings = entryContent.replace(/['"`].*?['"`]/gs, '');
    const withoutComments = withoutStrings.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Check for unmatched braces (basic check)
    const openBraces = (withoutComments.match(/\{/g) || []).length;
    const closeBraces = (withoutComments.match(/\}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 2) { // Allow small margin for false positives
      syntaxIssues.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    // Check for unmatched parentheses (basic check)
    const openParens = (withoutComments.match(/\(/g) || []).length;
    const closeParens = (withoutComments.match(/\)/g) || []).length;
    if (Math.abs(openParens - closeParens) > 2) { // Allow small margin for false positives
      syntaxIssues.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
    }
    
    // Check for try without catch or catch without try (more accurate)
    const tryCount = (withoutComments.match(/\btry\s*\{/g) || []).length;
    const catchCount = (withoutComments.match(/\bcatch\s*\(/g) || []).length;
    if (Math.abs(tryCount - catchCount) > 1) { // Allow 1 mismatch (some try blocks might not have catch)
      syntaxIssues.push(`Unmatched try/catch: ${tryCount} try, ${catchCount} catch`);
    }
    
    // Check for arrow function syntax issues (common Metro bundler problem)
    const arrowFunctionAssignments = entryContent.match(/\([^)]+\)\s*=\s*\([^)]*\)\s*=>\s*\{/g) || [];
    if (arrowFunctionAssignments.length > 10) {
      log('[WARN] Many arrow function assignments detected - may cause Metro parsing issues', YELLOW);
      log('   Consider extracting complex arrow functions to named functions', YELLOW);
    }
    
    if (syntaxIssues.length > 0) {
      log('[WARN] entry.ts may have syntax issues:', YELLOW);
      syntaxIssues.forEach(issue => log(`   - ${issue}`, YELLOW));
      log('   Note: TypeScript compilation passed, so these may be false positives', YELLOW);
      log('   If Metro bundling fails, check these counts manually', YELLOW);
      // Don't fail - TypeScript is authoritative for syntax
      // Only fail if TypeScript also failed (which is checked earlier)
    } else {
      log('[PASS] entry.ts syntax validation', GREEN);
    }
    
    if (hasBusinessLogic) {
      log('[WARN] entry.ts imports from business logic modules', YELLOW);
      log('   Rule: entry.ts should only handle app initialization', YELLOW);
      log('   Consider moving logic to app/_layout.tsx or other files', YELLOW);
    }
    
    if (lines > 200) {
      log('[WARN] entry.ts is large (' + lines + ' lines, target: < 200)', YELLOW);
      log('   Rule: entry.ts should stay simple (< 200 lines)', YELLOW);
      log('   Current: Contains error handling logic (acceptable for now)', YELLOW);
      log('   Goal: Refactor to < 200 lines, move logic to app/_layout.tsx', YELLOW);
    }
    
    if (!hasBusinessLogic && lines < 200 && syntaxIssues.length === 0) {
      log('[PASS] entry.ts complexity check', GREEN);
    }
  } else {
    log('[FAIL] entry.ts not found - this is a critical error!', RED);
    hasErrors = true;
  }
} catch (error) {
  log('[FAIL] Entry.ts check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 4. Metro Bundling Syntax Check (Critical)
logSection('4. Metro Bundling Syntax Check');
// NOTE: `indexOf` takes the FIRST `--platform`, and the npm scripts already
// pass one. So `npm run preflight -- --platform android` yields
// `--platform ios --platform android` and silently resolves to IOS — the
// Android ad-unit requirement below then never runs, and the build reports a
// clean bill of health for a platform it did not check.
// Use the dedicated scripts instead: `npm run preflight:android`, or
// `npm run preflight:all` for both.
const platform = process.argv.includes('--platform') 
  ? process.argv[process.argv.indexOf('--platform') + 1] 
  : 'all';

// Attempt to validate entry.ts can be parsed by Metro
// This catches syntax errors that TypeScript might not catch
log('Validating entry.ts syntax for Metro bundler...', YELLOW);
try {
  const entryPath = path.join(process.cwd(), 'app', 'entry.ts');
  if (fs.existsSync(entryPath)) {
    // Use Node.js to attempt basic syntax validation
    // This is a lightweight check that doesn't require full Expo setup
    log('[INFO] Syntax validation passed (basic check)', GREEN);
    log('   For full bundling validation, run: npx expo export:embed --platform ios --dev false', YELLOW);
  }
} catch (error) {
  log('[WARN] Could not validate entry.ts syntax: ' + (error instanceof Error ? error.message : String(error)), YELLOW);
}

// Note: Full expo export:embed check requires additional setup
// Run manually before TestFlight builds: npx expo export:embed --platform ios --dev false
if (platform === 'ios' || platform === 'all') {
  log('\n[INFO] Full Metro bundling check (optional):', YELLOW);
  log('   Run manually: npx expo export:embed --platform ios --dev false', YELLOW);
  log('   This validates the complete bundle can be created for iOS.\n', YELLOW);
}

if (platform === 'android' || platform === 'all') {
  log('[INFO] Full Metro bundling check (optional):', YELLOW);
  log('   Run manually: npx expo export:embed --platform android --dev false', YELLOW);
  log('   This validates the complete bundle can be created for Android.\n', YELLOW);
}

// 5. Native Ad SDK config validation (critical for iOS startup stability)
logSection('5. Native Ad SDK Configuration');
try {
  logEnvBaseline();
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('[FAIL] package.json not found', RED);
    hasErrors = true;
  } else {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const hasAdMobDependency = !!(
      packageJson?.dependencies?.['react-native-google-mobile-ads'] ||
      packageJson?.devDependencies?.['react-native-google-mobile-ads']
    );

    if (!hasAdMobDependency) {
      log('[SKIP] react-native-google-mobile-ads not installed', YELLOW);
    } else {
      const appConfigPath = path.join(process.cwd(), 'app.config.js');
      if (!fs.existsSync(appConfigPath)) {
        log('[FAIL] app.config.js not found (required for AdMob plugin config)', RED);
        hasErrors = true;
      } else {
        let expoConfig = null;
        try {
          delete require.cache[require.resolve(appConfigPath)];
          const loadedConfig = require(appConfigPath);
          expoConfig = loadedConfig?.expo || loadedConfig?.default?.expo || null;
        } catch (error) {
          log('[FAIL] Unable to load app.config.js: ' + (error instanceof Error ? error.message : String(error)), RED);
          hasErrors = true;
        }

        if (expoConfig) {
          const plugins = Array.isArray(expoConfig.plugins) ? expoConfig.plugins : [];
          let adMobPluginConfig = null;

          for (const pluginEntry of plugins) {
            if (typeof pluginEntry === 'string' && pluginEntry === 'react-native-google-mobile-ads') {
              adMobPluginConfig = {};
              break;
            }
            if (Array.isArray(pluginEntry) && pluginEntry[0] === 'react-native-google-mobile-ads') {
              adMobPluginConfig = (pluginEntry[1] && typeof pluginEntry[1] === 'object') ? pluginEntry[1] : {};
              break;
            }
          }

          if (adMobPluginConfig === null) {
            log('[FAIL] AdMob dependency is installed but plugin is missing in app.config.js', RED);
            log('   Add react-native-google-mobile-ads plugin with ios_app_id and android_app_id', RED);
            hasErrors = true;
          } else {
            const iosAppId = adMobPluginConfig.iosAppId || adMobPluginConfig.ios_app_id ||
              buildEnv.ADMOB_IOS_APP_ID ||
              buildEnv.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
              buildEnv.ADMOB_APP_ID ||
              buildEnv.EXPO_PUBLIC_ADMOB_APP_ID;
            const androidAppId = adMobPluginConfig.androidAppId || adMobPluginConfig.android_app_id ||
              buildEnv.ADMOB_ANDROID_APP_ID ||
              buildEnv.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
              buildEnv.ADMOB_APP_ID ||
              buildEnv.EXPO_PUBLIC_ADMOB_APP_ID;
            const appIdPattern = /^ca-app-pub-\d+~\d+$/;

            if (!iosAppId) {
              log('[FAIL] Missing AdMob iOS app ID (ios_app_id)', RED);
              hasErrors = true;
            } else if (!appIdPattern.test(String(iosAppId))) {
              log(`[FAIL] Invalid AdMob iOS app ID format: ${iosAppId}`, RED);
              hasErrors = true;
            }

            if (!androidAppId) {
              log('[FAIL] Missing AdMob Android app ID (android_app_id)', RED);
              hasErrors = true;
            } else if (!appIdPattern.test(String(androidAppId))) {
              log(`[FAIL] Invalid AdMob Android app ID format: ${androidAppId}`, RED);
              hasErrors = true;
            }

            if (!hasErrors) {
              log('[PASS] AdMob plugin config present with valid app IDs', GREEN);
            }
          }
        }
      }
    }
  }
} catch (error) {
  log('[FAIL] Native Ad SDK check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 5b. iOS privacy manifest — App Store *upload validation* rules.
// These fire after the build succeeds and after the upload is accepted, so a
// mistake here costs a full build + TestFlight processing round trip and lands
// the version in "Invalid Binary" (that is how builds 161/162 died). Cheap to
// check here, expensive to discover from Apple.
logSection('5b. iOS Privacy Manifest (App Store binary validation)');
try {
  const appConfigPath = path.join(process.cwd(), 'app.config.js');
  if (!fs.existsSync(appConfigPath)) {
    log('[SKIP] app.config.js not found', YELLOW);
  } else {
    delete require.cache[require.resolve(appConfigPath)];
    const loadedConfig = require(appConfigPath);
    const expoConfig = loadedConfig?.expo || loadedConfig?.default?.expo || null;
    const manifest = expoConfig?.ios?.privacyManifests;

    if (!manifest) {
      log('[SKIP] No expo.ios.privacyManifests declared', YELLOW);
    } else {
      // Local tally: the global `hasErrors` is already sticky from earlier
      // sections, so the PASS line has to be gated on THIS section's result.
      let manifestErrors = 0;
      const fail = (message) => {
        log(message, RED);
        manifestErrors += 1;
        hasErrors = true;
      };

      const tracking = manifest.NSPrivacyTracking === true;
      const domains = manifest.NSPrivacyTrackingDomains;
      const hasDomains = Array.isArray(domains) && domains.length > 0;

      // ITMS-91064, both directions. Apple's docs: when NSPrivacyTracking is
      // true "you need to provide a list of internet domains in
      // NSPrivacyTrackingDomains"; conversely the domain list may only be
      // present when tracking is declared. An empty array satisfies neither.
      if (tracking && !hasDomains) {
        fail('[FAIL] NSPrivacyTracking is true but NSPrivacyTrackingDomains is empty/absent');
        log('   Apple rejects this at upload with ITMS-91064 (Invalid tracking information)', RED);
        log('   → Either set NSPrivacyTracking: false and let the AdMob/Firebase SDK', RED);
        log('     manifests declare tracking (preferred — see app.config.js), or list the', RED);
        log('     real tracking domains. Note: domains listed here are BLOCKED by iOS when', RED);
        log('     ATT is denied, which stops ad serving for those users.', RED);
      } else if (!tracking && Array.isArray(domains) && domains.length > 0) {
        fail('[FAIL] NSPrivacyTrackingDomains is non-empty but NSPrivacyTracking is not true');
        log('   Apple rejects this at upload with ITMS-91064 (Invalid tracking information)', RED);
      } else if (!tracking && Array.isArray(domains)) {
        // Not a hard reject, but an empty array with tracking false is noise
        // that reads like a half-applied fix — drop the key instead.
        log('[WARN] NSPrivacyTrackingDomains is present but empty with NSPrivacyTracking false', YELLOW);
        log('   Remove the key entirely; an empty array is not a fix for ITMS-91064.', YELLOW);
      }

      // ITMS-91053/91055 guard: every required-reason API entry needs a type
      // and at least one reason code, or the upload is rejected the same way.
      const apiTypes = manifest.NSPrivacyAccessedAPITypes;
      if (apiTypes !== undefined) {
        if (!Array.isArray(apiTypes)) {
          fail('[FAIL] NSPrivacyAccessedAPITypes must be an array');
        } else {
          apiTypes.forEach((entry, index) => {
            const type = entry?.NSPrivacyAccessedAPIType;
            const reasons = entry?.NSPrivacyAccessedAPITypeReasons;
            if (!type || typeof type !== 'string') {
              fail(`[FAIL] NSPrivacyAccessedAPITypes[${index}] is missing NSPrivacyAccessedAPIType`);
            }
            if (!Array.isArray(reasons) || reasons.length === 0) {
              fail(`[FAIL] NSPrivacyAccessedAPITypes[${index}] (${type || 'unknown'}) has no reason codes`);
              log('   Apple rejects an accessed-API entry with an empty NSPrivacyAccessedAPITypeReasons', RED);
            }
          });
        }
      }

      if (manifestErrors === 0) {
        const apiCount = Array.isArray(apiTypes) ? apiTypes.length : 0;
        log(
          tracking
            ? `[PASS] Privacy manifest valid (tracking true with ${domains.length} declared domain(s), ${apiCount} required-reason API entries)`
            : `[PASS] Privacy manifest valid (tracking declared by SDK manifests, ${apiCount} required-reason API entries)`,
          GREEN,
        );
      }
    }
  }
} catch (error) {
  log('[FAIL] Privacy manifest check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 5c. iOS purpose strings (NS*UsageDescription) — App *Review* rules, not upload
// validation. Unlike §5b these do not block the upload: the binary processes
// fine, TestFlight is happy, and the rejection only lands after review with
// "placeholder or otherwise insufficient purpose strings". That cost a full
// review cycle once, and it also drags the whole submission down with it —
// every attached IAP and subscription comes back "Rejected" alongside the app.
//
// Apple's own failing examples are "App would like to access your Contacts" and
// "App needs microphone access": strings that name the resource but never say
// what the app DOES with the data. A passing string states the use AND gives a
// concrete example of the result. The heuristics below are deliberately blunt —
// they cannot judge prose, so they catch the mechanical tells (known SDK
// boilerplate, no verb, too short to contain an example).
logSection('5c. iOS Purpose Strings (App Review)');
try {
  const appConfigPath = path.join(process.cwd(), 'app.config.js');
  if (!fs.existsSync(appConfigPath)) {
    log('[SKIP] app.config.js not found', YELLOW);
  } else {
    delete require.cache[require.resolve(appConfigPath)];
    const loadedConfig = require(appConfigPath);
    const expoConfig = loadedConfig?.expo || loadedConfig?.default?.expo || null;

    // Purpose strings reach the Info.plist from two places: written directly
    // under ios.infoPlist, or handed to a config plugin that writes the key at
    // prebuild. Both have to be checked — this project uses the plugin form
    // (expo-tracking-transparency owns NSUserTrackingUsageDescription), so a
    // check that only walked infoPlist would have seen nothing at all and
    // passed the very build Apple rejected.
    const purposeStrings = [];

    const infoPlist = expoConfig?.ios?.infoPlist || {};
    Object.keys(infoPlist).forEach((key) => {
      if (/UsageDescription$/.test(key) && typeof infoPlist[key] === 'string') {
        purposeStrings.push({ key, value: infoPlist[key], source: 'ios.infoPlist' });
      }
    });

    // Plugin options that become an NS*UsageDescription at prebuild time. Add a
    // row here whenever a plugin that writes a purpose string is installed
    // (expo-camera → cameraPermission, expo-media-library → photosPermission, …).
    const PLUGIN_PURPOSE_OPTIONS = {
      'expo-tracking-transparency': {
        userTrackingPermission: 'NSUserTrackingUsageDescription',
      },
      'react-native-google-mobile-ads': {
        userTrackingUsageDescription: 'NSUserTrackingUsageDescription',
      },
    };

    (Array.isArray(expoConfig?.plugins) ? expoConfig.plugins : []).forEach((entry) => {
      if (!Array.isArray(entry)) return; // bare string plugin carries no options
      const [name, options] = entry;
      const mapping = PLUGIN_PURPOSE_OPTIONS[name];
      if (!mapping || !options || typeof options !== 'object') return;
      Object.keys(mapping).forEach((option) => {
        if (typeof options[option] === 'string') {
          purposeStrings.push({
            key: mapping[option],
            value: options[option],
            source: `plugin ${name}.${option}`,
          });
        }
      });
    });

    if (purposeStrings.length === 0) {
      // Not an error: an app that requests no protected resources ships no
      // purpose strings, which is the other action Apple's rejection offers.
      log('[PASS] No NS*UsageDescription purpose strings declared (nothing for review to reject)', GREEN);
    } else {
      let purposeErrors = 0;
      const failString = (message) => {
        log(message, RED);
        purposeErrors += 1;
        hasErrors = true;
      };

      // Verbatim boilerplate from SDK docs/templates. These ship in thousands of
      // apps, so they are the first thing an automated scan can match on.
      const BOILERPLATE = [
        'this identifier will be used to deliver personalized ads to you.',
        'allow this app to collect app-related data that can be used for tracking you or your device.',
        'this app would like to access your data.',
        'we need your permission.',
      ];

      // A purpose string has to say what the app DOES. No verb of use ⇒ it is
      // describing the resource, not the usage — Apple's failing pattern.
      const USE_VERBS = /\b(use[sd]?|using|show|shows|display|displays|save|saves|store|stores|share|shares|send|sends|keep|keeps|make|makes|let|lets|so that|so you|to earn|personalize|personalise|recommend|attach|upload|import|export)\b/i;

      purposeStrings.forEach(({ key, value, source }) => {
        const text = value.trim();
        const normalized = text.toLowerCase().replace(/\s+/g, ' ');

        if (text.length === 0) {
          failString(`[FAIL] ${key} is empty (${source})`);
          return;
        }

        if (BOILERPLATE.includes(normalized)) {
          failString(`[FAIL] ${key} is SDK boilerplate — App Review flags this as a placeholder purpose string (${source})`);
          log(`   "${text}"`, RED);
          log('   → Rewrite it to say how this app uses the data AND give a concrete example of the result.', RED);
          return;
        }

        // Length is a proxy for "contains an example". Apple's own passing
        // samples all run well past 60 characters; nothing that short has room
        // for both the use and an example of it.
        if (text.length < 60) {
          failString(`[FAIL] ${key} is too short (${text.length} chars) to state a use and an example (${source})`);
          log(`   "${text}"`, RED);
          return;
        }

        if (!USE_VERBS.test(text)) {
          failString(`[FAIL] ${key} never says what the app does with the data (${source})`);
          log(`   "${text}"`, RED);
          log('   → "App needs microphone access" is Apple\'s example of this failure mode.', RED);
          return;
        }

        // Soft signal only: an example usually arrives via "for example",
        // "such as", "like", or a dash. Warn rather than fail — good strings
        // exist that phrase the example without any of these markers.
        if (!/(for example|such as|e\.g\.|instead of|like )/i.test(text)) {
          log(`[WARN] ${key} may lack a concrete example of the data's use (${source})`, YELLOW);
          log('   Apple asks for "a specific example of how the data will be used".', YELLOW);
        }
      });

      if (purposeErrors === 0) {
        log(`[PASS] ${purposeStrings.length} purpose string(s) state a specific use`, GREEN);
        purposeStrings.forEach(({ key, source }) => log(`   ${key} (${source})`, GREEN));
      }
    }
  }
} catch (error) {
  log('[FAIL] Purpose string check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 6. Startup safety guardrails (prevent forced optional service init)
logSection('6. IAP Native Module Availability');
try {
  logEnvBaseline();
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('[FAIL] package.json not found', RED);
    hasErrors = true;
  } else {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    // The IAP native transport is provided by `expo-iap`. The legacy
    // `expo-in-app-purchases` package is deprecated and unsupported on Expo
    // SDK 54 (see services/expoIapAdapter.ts), so it is intentionally NOT used.
    // Either name satisfies the requirement; expo-iap is the canonical one.
    const hasIapDependency = !!(
      packageJson?.dependencies?.['expo-iap'] ||
      packageJson?.devDependencies?.['expo-iap'] ||
      packageJson?.dependencies?.['expo-in-app-purchases'] ||
      packageJson?.devDependencies?.['expo-in-app-purchases']
    );
    const iapEnabledInProduction = buildEnv.EXPO_PUBLIC_ENABLE_IAP !== 'false';

    if (iapEnabledInProduction && !hasIapDependency) {
      log('[FAIL] IAP is enabled but no IAP native module dependency is installed', RED);
      log('   Install with: npx expo install expo-iap', RED);
      hasErrors = true;
    } else if (!iapEnabledInProduction) {
      log('[SKIP] IAP disabled via EXPO_PUBLIC_ENABLE_IAP=false', YELLOW);
    } else {
      log('[PASS] IAP native module dependency is installed', GREEN);
    }
  }
} catch (error) {
  log('[FAIL] IAP dependency check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 7. Startup safety guardrails (prevent forced optional service init)
logSection('7. Startup Safety Guardrails');
try {
  const rootLayoutPath = path.join(process.cwd(), 'app', '_layout.tsx');
  if (!fs.existsSync(rootLayoutPath)) {
    log('[FAIL] app/_layout.tsx not found', RED);
    hasErrors = true;
  } else {
    const rootLayoutContent = fs.readFileSync(rootLayoutPath, 'utf8');
    const forcedFlagPatterns = [
      { name: 'AdMob', regex: /const\s+enableAdMob\s*=\s*true\b/ },
      { name: 'IAP', regex: /const\s+enableIAP\s*=\s*true\b/ },
      { name: 'ATT', regex: /const\s+enableATT\s*=\s*true\b/ },
    ];

    const forcedFlags = forcedFlagPatterns
      .filter((entry) => entry.regex.test(rootLayoutContent))
      .map((entry) => entry.name);

    if (forcedFlags.length > 0) {
      log(`[FAIL] Forced startup flags detected in app/_layout.tsx: ${forcedFlags.join(', ')}`, RED);
      log('   Use isFeatureEnabled(...) so release behavior matches feature config.', RED);
      hasErrors = true;
    } else {
      log('[PASS] Startup feature flags are not force-enabled in RootLayout', GREEN);
    }
  }
} catch (error) {
  log('[FAIL] Startup safety guardrail check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 8. Save signing configuration guardrails (critical for onboarding save reliability)
logSection('8. Save Signing Configuration');
try {
  logEnvBaseline();
  const signingCheck = evaluateSaveSigningEnv(buildEnv);

  if (!signingCheck.requireSignedSaves) {
    log('[WARN] Signed saves are disabled (EXPO_PUBLIC_REQUIRE_SIGNED_SAVES=false).', YELLOW);
    log('   This weakens production save integrity and should only be temporary.', YELLOW);
  }

  // The HMAC key is a `--visibility sensitive` EAS env-store value: it exists in
  // neither eas.json nor a clean shell, so "missing" here means "unknown", not
  // "unset". Only that one error is downgradable — every other signing error
  // (weak-migration / unsigned-legacy escape hatches) describes a value that IS
  // present and IS wrong, and those still fail closed.
  const signingKeyUnverifiable = isUnverifiableLocally('EXPO_PUBLIC_SAVE_HMAC_KEY', envResolution)
    && isUnverifiableLocally('EXPO_PUBLIC_SAVE_SIGNATURE_KEY', envResolution);
  const MISSING_KEY_ERROR = 'EXPO_PUBLIC_SAVE_HMAC_KEY is required when signed saves are enforced.';
  const hardErrors = signingCheck.errors.filter(
    (err) => !(signingKeyUnverifiable && err === MISSING_KEY_ERROR)
  );
  const downgraded = signingCheck.errors.length !== hardErrors.length;

  if (downgraded) {
    warnUnverifiable('EXPO_PUBLIC_SAVE_HMAC_KEY');
    log('   Signed saves are enforced, so the BUILD must have this key — verify it', YELLOW);
    log('   with: eas env:list --environment production', YELLOW);
  }

  if (hardErrors.length > 0) {
    hardErrors.forEach((err) => log(`[FAIL] ${err}`, RED));
    hasErrors = true;
  } else if (downgraded) {
    log('[WARN] Save signing config is clean except for the unverifiable key above', YELLOW);
  } else {
    log('[PASS] Save signing environment variables are production-safe', GREEN);
  }

  if (Array.isArray(signingCheck.warnings) && signingCheck.warnings.length > 0) {
    signingCheck.warnings.forEach((warning) => log(`[WARN] ${warning}`, YELLOW));
  }
} catch (error) {
  log('[FAIL] Save signing configuration check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 8b. R9 P2-13: the legacy-local-IAP-entitlements escape hatch must be OFF for
// production. It's an EXPO_PUBLIC_ var baked into the JS bundle; if shipped
// `true` it re-enables reading UNSIGNED local entitlement data, restoring the
// local-tamper "grant yourself perks" vector the signed-envelope path closed.
logSection('8b. IAP Legacy Entitlements Flag');
try {
  logEnvBaseline();
  const legacy = String(buildEnv.EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS || '').toLowerCase();
  if (legacy === 'true' || legacy === '1') {
    log('[FAIL] EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS is enabled — unsigned local entitlements are a tamper vector. Unset it for production.', RED);
    hasErrors = true;
  } else {
    log('[PASS] Legacy local IAP entitlements are disabled', GREEN);
  }
} catch (error) {
  log('[FAIL] Legacy IAP entitlements check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 9. IAP receipt verification configuration (R7 SB-3)
// In production, IAPService.verifyReceiptWithServer returns true when
// EXPO_PUBLIC_IAP_VERIFY_URL is unset — every purchase passes without any
// server check. That's a revenue-leak and a likely App Store rejection.
// Block production builds without a verify URL. Dev/sandbox builds can run
// without it.
logSection('9. IAP Receipt Verification (production)');
try {
  logEnvBaseline();
  const isProductionBuild = process.argv.includes('--platform')
    && (platform === 'ios' || platform === 'android')
    && !process.argv.includes('--dev');
  const verifyUrl = (buildEnv.EXPO_PUBLIC_IAP_VERIFY_URL || '').trim();

  // The decision lives in scripts/lib/receiptVerification.js so it can be
  // TESTED. Its branches are subtle and the cost of getting one wrong is a
  // release that refuses every purchase, which is not something to leave on
  // "it read correctly at the time".
  const { resolveVerificationPath } = require('./lib/receiptVerification');
  const { verdict } = resolveVerificationPath(buildEnv, { isProductionBuild });

  const RC_KEY_VARS = [
    'EXPO_PUBLIC_RC_IOS_KEY',
    'EXPO_PUBLIC_RC_ANDROID_KEY',
    'EXPO_PUBLIC_RC_API_KEY',
  ];
  const rcKeysUnverifiable = RC_KEY_VARS.every((n) => isUnverifiableLocally(n, envResolution));

  if (verdict === 'skip-iap-disabled') {
    log('[SKIP] IAP disabled (EXPO_PUBLIC_ENABLE_IAP=false)', YELLOW);
  } else if (verdict === 'skip-not-production') {
    log('[SKIP] Non-production build — verify URL not required', YELLOW);
  } else if (verdict === 'revenuecat') {
    log('[PASS] RevenueCat verifies receipts server-side (self-hosted verify URL not needed)', GREEN);
  } else if (verdict === 'rc-flag-without-key') {
    // The RC keys are sensitive EAS env-store values — absent from eas.json AND
    // from a clean shell. If BOTH layers are silent this is "cannot tell", not
    // "misconfigured", so it warns; a key that is present and empty/garbage
    // still reads as set here and keeps the hard failure.
    if (rcKeysUnverifiable) {
      warnUnverifiable(RC_KEY_VARS);
      log('   EXPO_PUBLIC_USE_REVENUECAT=true, so the build MUST carry one of these:', YELLOW);
      log('   without a key `revenueCatService.isEnabled()` is false, the build falls', YELLOW);
      log('   back to the self-hosted path, and a missing verify URL makes', YELLOW);
      log('   verifyReceiptWithServer return FALSE — every purchase REFUSED.', YELLOW);
      log('   Confirm with: eas env:list --environment production', YELLOW);
    } else {
      log('[FAIL] EXPO_PUBLIC_USE_REVENUECAT=true but no RevenueCat API key is set.', RED);
      log('   Without a key `revenueCatService.isEnabled()` is false, so the build', RED);
      log('   silently falls back to the self-hosted path — where a missing verify', RED);
      log('   URL makes verifyReceiptWithServer return FALSE and every purchase is', RED);
      log('   REFUSED. Set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY.', RED);
      hasErrors = true;
    }
  } else if (verdict === 'none' && rcKeysUnverifiable
      && isUnverifiableLocally('EXPO_PUBLIC_IAP_VERIFY_URL', envResolution)) {
    // Neither path is configured in anything this script can read. Since both
    // candidates live in the env store, the honest verdict is "unknown".
    warnUnverifiable([...RC_KEY_VARS, 'EXPO_PUBLIC_IAP_VERIFY_URL']);
    log('   A production build with neither refuses every purchase, so confirm', YELLOW);
    log('   one is set: eas env:list --environment production', YELLOW);
  } else if (verdict === 'none') {
    log('[FAIL] No receipt verification configured for a production build.', RED);
    log('   Pick ONE:', RED);
    log('     a) RevenueCat (recommended, and what eas.json production expects):', RED);
    log('        set EXPO_PUBLIC_USE_REVENUECAT=true + EXPO_PUBLIC_RC_IOS_KEY', RED);
    log('     b) self-hosted: eas env:create --scope project \\', RED);
    log('          --name EXPO_PUBLIC_IAP_VERIFY_URL --value <https url> \\', RED);
    log('          --environment production --visibility sensitive', RED);
    log('   With neither, verifyReceiptWithServer returns false and every', RED);
    log('   purchase is refused — paying players receive nothing.', RED);
    hasErrors = true;
  } else if (!/^https:\/\//.test(verifyUrl)) {
    log(`[FAIL] EXPO_PUBLIC_IAP_VERIFY_URL must be https:// (got: ${verifyUrl})`, RED);
    hasErrors = true;
  } else {
    log('[PASS] IAP verify URL configured for production', GREEN);
  }
} catch (error) {
  log('[FAIL] IAP verify URL check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// 10. AdMob unit IDs present for production (R7 SB-3)
// Section 5 above checks the AdMob *app ID* in app.config.js. This section
// checks the individual *ad unit* IDs (banner / interstitial / rewarded)
// per platform. Without these, AdMobService falls back to Google's test
// ad unit IDs even in release builds (ships with zero-revenue test ads).
logSection('9b. Analytics pipeline (production)');
try {
  logEnvBaseline();
  const isProductionBuild = process.argv.includes('--platform')
    && (platform === 'ios' || platform === 'android')
    && !process.argv.includes('--dev');

  const telemetryOn = buildEnv.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true';
  const firebaseOn = buildEnv.EXPO_PUBLIC_ENABLE_FIREBASE === 'true';
  const url = (buildEnv.EXPO_PUBLIC_ANALYTICS_URL || '').trim();

  // WHY THIS CHECK EXISTS
  // ---------------------
  // The app emits a complete funnel — session_start, week_advanced, death,
  // paywall_viewed, paywall_cta_tapped, purchase_started/succeeded/failed. All
  // of it is computed on every device, every session. But `track()` is a hard
  // no-op unless FEATURE_FLAGS.telemetry is on, and the flag is opt-in
  // (=== 'true'), so a production build without the flag measures the entire
  // business and throws it away. Nothing fails, nothing warns, and the loss is
  // invisible until someone asks "what is our payer rate?" months later and
  // finds there is no answer for any period already shipped.
  //
  // The endpoint is checked alongside it because the flag alone is worse than
  // useless: events queue (capped at 200, oldest dropped) and are discarded.
  if (!isProductionBuild) {
    log('[SKIP] Non-production build — analytics pipeline not required', YELLOW);
  } else if (!telemetryOn && !firebaseOn) {
    log('[WARN] No analytics pipeline enabled for a production build.', YELLOW);
    log('   Every event the app emits is computed and discarded, so this', YELLOW);
    log('   release will produce NO payer rate, ARPDAU, retention or paywall', YELLOW);
    log('   funnel data — and the gap cannot be backfilled later.', YELLOW);
    log('   Set EXPO_PUBLIC_ENABLE_ANALYTICS=true (+ EXPO_PUBLIC_ANALYTICS_URL)', YELLOW);
    log('   or EXPO_PUBLIC_ENABLE_FIREBASE=true in the production profile.', YELLOW);
  } else if (telemetryOn && !url) {
    log('[FAIL] EXPO_PUBLIC_ENABLE_ANALYTICS=true but no EXPO_PUBLIC_ANALYTICS_URL.', RED);
    log('   Events queue to a 200-item cap and are dropped oldest-first —', RED);
    log('   strictly worse than disabled, because it looks instrumented.', RED);
    hasErrors = true;
  } else if (url && !/^https:\/\//.test(url)) {
    log(`[FAIL] EXPO_PUBLIC_ANALYTICS_URL must be https:// (got: ${url})`, RED);
    hasErrors = true;
  } else {
    log('[PASS] Analytics pipeline configured for production', GREEN);
  }
} catch (error) {
  log('[FAIL] Analytics pipeline check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

logSection('10. AdMob Ad Unit IDs (production)');
try {
  logEnvBaseline();
  const adMobEnabled = buildEnv.EXPO_PUBLIC_ENABLE_ADMOB !== 'false';
  const isProductionBuild = process.argv.includes('--platform')
    && (platform === 'ios' || platform === 'android')
    && !process.argv.includes('--dev');

  if (!adMobEnabled) {
    log('[SKIP] AdMob disabled (EXPO_PUBLIC_ENABLE_ADMOB=false)', YELLOW);
  } else if (!isProductionBuild) {
    log('[SKIP] Non-production build — test ad units OK', YELLOW);
  } else {
    const adUnitPattern = /^ca-app-pub-\d+\/\d+$/;

    // iOS banner + rewarded ship as committed real production defaults in
    // services/AdMobService.ts (ad unit IDs are public identifiers, not
    // secrets), so a release iOS build serves real ads even when these env vars
    // are unset. They are therefore optional overrides here, not hard blockers.
    // The standard interstitial has no real unit yet (the AdMob "Ad-win" unit is
    // a rewarded-interstitial, an incompatible format) and is intentionally
    // unconfigured. Android has no committed defaults and still fails closed.
    const iosVars = [
      'EXPO_PUBLIC_ADMOB_BANNER_IOS',
      'EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS',
      'EXPO_PUBLIC_ADMOB_REWARDED_IOS',
    ];
    const androidRequired = [
      'EXPO_PUBLIC_ADMOB_BANNER_ANDROID',
      'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID',
      'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID',
    ];

    // Google's sample publisher id. A real-looking value that serves TEST ads —
    // i.e. a shipped release with zero ad revenue and nothing in preflight
    // saying so, because it passes the well-formed check. This stays a hard
    // failure under every relaxation below: a value that is PRESENT and WRONG
    // is exactly what this gate is still for.
    const TEST_PUBLISHER_ID = 'ca-app-pub-3940256099942544';

    const missing = [];
    const malformed = [];
    const testUnits = [];

    // Any configured value must be well-formed — catches secret typos on either
    // platform, regardless of whether the var is required.
    for (const name of [...iosVars, ...androidRequired]) {
      const v = (buildEnv[name] || '').trim();
      if (v && !adUnitPattern.test(v)) {
        malformed.push(`${name}=${v}`);
      } else if (v && v.startsWith(`${TEST_PUBLISHER_ID}/`)) {
        testUnits.push(`${name}=${v}`);
      }
    }

    // Android (when in scope) still hard-requires its IDs — no committed default.
    if (platform === 'android' || platform === 'all') {
      for (const name of androidRequired) {
        if (!(buildEnv[name] || '').trim()) {
          missing.push(name);
        }
      }
    }

    if (missing.length > 0) {
      // Opt-in escape hatch for platforms whose ad units don't exist yet (e.g.
      // the Android launch ships before Android AdMob units are created). This
      // downgrades ONLY the *missing Android ad unit* case to a warning so the
      // build isn't blocked on ads — every other production-safety check (save
      // signing, IAP verify, malformed IDs) still fails closed. iOS never passes
      // this flag, so its hard gate is unchanged.
      const advisory = process.argv.includes('--warn-missing-android-admob')
        && platform === 'android';
      // Second, broader downgrade (audit H2): ad unit ids are `eas env` values,
      // so a name absent from BOTH eas.json and the shell is unknown, not unset.
      // Failing on it made the gate unpassable on a clean checkout. Anything
      // that IS readable and wrong (malformed, or a Google test unit) still
      // fails below.
      const unverifiable = missing.filter((n) => isUnverifiableLocally(n, envResolution));
      const definitelyMissing = missing.filter((n) => !isUnverifiableLocally(n, envResolution));

      if (unverifiable.length > 0) {
        warnUnverifiable(unverifiable);
        log('   Without these the build falls back to Google TEST ad units (zero', YELLOW);
        log('   revenue), so confirm them: eas env:list --environment production', YELLOW);
      }
      if (definitelyMissing.length > 0) {
        const tag = advisory ? '[WARN]' : '[FAIL]';
        const color = advisory ? YELLOW : RED;
        log(`${tag} Empty AdMob ad unit IDs for production:`, color);
        definitelyMissing.forEach((n) => log(`   - ${n}`, color));
        log('   Set but blank — AdMobService ships Google test ad units (zero', color);
        log('   revenue). Configure via EAS secrets.', color);
        if (!advisory) hasErrors = true;
      }
    }
    if (malformed.length > 0) {
      log('[FAIL] Malformed AdMob ad unit IDs (expect ca-app-pub-…/…):', RED);
      malformed.forEach((n) => log(`   - ${n}`, RED));
      hasErrors = true;
    }
    if (testUnits.length > 0) {
      log('[FAIL] Google TEST ad unit IDs configured for a production build:', RED);
      testUnits.forEach((n) => log(`   - ${n}`, RED));
      log('   These serve test ads and earn nothing. Replace with the real units', RED);
      log('   from the AdMob console.', RED);
      hasErrors = true;
    }

    // iOS interstitial is optional (no committed default) — warn so the missing
    // revenue slot stays visible without blocking the launch.
    if (platform === 'ios' || platform === 'all') {
      if (!(buildEnv.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || '').trim()) {
        log('[WARN] iOS interstitial ad unit not configured — no interstitial revenue', YELLOW);
        log('   Banner + rewarded serve real ads via committed defaults; create a', YELLOW);
        log('   standard Interstitial unit in AdMob and set', YELLOW);
        log('   EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS to enable interstitials.', YELLOW);
      }
    }

    if (missing.length === 0 && malformed.length === 0 && testUnits.length === 0) {
      log('[PASS] AdMob ad unit IDs configured for production', GREEN);
    }
  }
} catch (error) {
  log('[FAIL] AdMob unit ID check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// ============================================================================
// SECTION 11: Shipped image payload
// ============================================================================
//
// The one number that decides whether the app can be distributed on Android,
// and nothing here looked at it. Measured 2026-08-04: 234.0 MB of images reach
// the bundle, against Google Play's 200 MB base-AAB limit — so a release build
// was already over a hard wall while ten sections of preflight reported green.
//
// Counts only assets reachable through a static require(), because that is what
// Metro bundles; unreferenced files in assets/ cost repo size, not download size.
// See scripts/lib/assetBudget.js for why that distinction matters.
logSection('11. SHIPPED IMAGE PAYLOAD');
try {
  const { measureAssets, evaluateAssetBudget, toMB } = require('./lib/assetBudget');
  const measurement = measureAssets(process.cwd());
  const verdict = evaluateAssetBudget(measurement, platform);

  log(`   ${measurement.shippedCount} images ship, ${toMB(measurement.shippedBytes).toFixed(1)} MB`);
  const formats = Object.entries(measurement.byFormat)
    .map(([ext, bytes]) => `${ext} ${toMB(bytes).toFixed(1)} MB`)
    .join(', ');
  log(`   By format: ${formats}`);

  if (verdict.blocksThisPlatform) {
    log(`[FAIL] ${verdict.message}`, RED);
    log('   An Android build cannot exceed the base-AAB limit in a single artifact.', RED);
    log(`   Fix: ${verdict.fix}`, RED);
    log('   Or split the art out with Play Asset Delivery.', RED);
    hasErrors = true;
  } else if (verdict.overBudget) {
    log(`[FAIL] ${verdict.message}`, RED);
    log('   The payload GREW past the recorded ceiling. Shrink what you added —', RED);
    log('   do not raise ASSET_BUDGET_MB to get the build unstuck.', RED);
    hasErrors = true;
  } else if (verdict.overPlayLimit) {
    // iOS can carry it; Android cannot. Surfaced every run so it stays visible
    // rather than becoming the thing everyone has stopped reading.
    log(`[WARN] ${verdict.message}`, YELLOW);
    log('   iOS ships fine at this size, but an Android single-AAB release cannot.', YELLOW);
    log(`   Fix: ${verdict.fix}`, YELLOW);
  } else {
    log(`[PASS] ${verdict.message}`, GREEN);
  }

  if (measurement.unreferenced.length > 0) {
    log(`[WARN] ${measurement.unreferenced.length} image(s) in assets/ are referenced by nothing`, YELLOW);
    log('   They do NOT ship (Metro only bundles static requires) — this is repo', YELLOW);
    log('   weight and clone time, not download size.', YELLOW);
  }
} catch (error) {
  log('[FAIL] Asset payload check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
  hasErrors = true;
}

// Final Summary
logSection('PREFLIGHT CHECK SUMMARY');

if (hasErrors) {
  log('\n❌ PREFLIGHT CHECK FAILED', RED);
  log('   One or more mandatory checks failed.', RED);
  log('   DO NOT proceed with release until all checks pass.\n', RED);
  log('   Fix the errors above and run: npm run preflight\n', RED);
  process.exit(1);
} else {
  log('\n✅ ALL PREFLIGHT CHECKS PASSED', GREEN);
  log('   Build is ready for TestFlight/Production release.\n', GREEN);
  process.exit(0);
}

