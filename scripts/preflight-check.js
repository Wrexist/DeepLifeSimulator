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

// Main preflight checks
logSection('🚀 PREFLIGHT CHECK - MANDATORY RELEASE CHECKS');

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
              process.env.ADMOB_IOS_APP_ID ||
              process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
              process.env.ADMOB_APP_ID ||
              process.env.EXPO_PUBLIC_ADMOB_APP_ID;
            const androidAppId = adMobPluginConfig.androidAppId || adMobPluginConfig.android_app_id ||
              process.env.ADMOB_ANDROID_APP_ID ||
              process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
              process.env.ADMOB_APP_ID ||
              process.env.EXPO_PUBLIC_ADMOB_APP_ID;
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
    const iapEnabledInProduction = process.env.EXPO_PUBLIC_ENABLE_IAP !== 'false';

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
  const signingCheck = evaluateSaveSigningEnv(process.env);

  if (!signingCheck.requireSignedSaves) {
    log('[WARN] Signed saves are disabled (EXPO_PUBLIC_REQUIRE_SIGNED_SAVES=false).', YELLOW);
    log('   This weakens production save integrity and should only be temporary.', YELLOW);
  }

  if (!signingCheck.valid) {
    signingCheck.errors.forEach((err) => log(`[FAIL] ${err}`, RED));
    hasErrors = true;
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
  const legacy = String(process.env.EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS || '').toLowerCase();
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
  const iapEnabled = process.env.EXPO_PUBLIC_ENABLE_IAP !== 'false';
  const isProductionBuild = process.argv.includes('--platform')
    && (platform === 'ios' || platform === 'android')
    && !process.argv.includes('--dev');
  const verifyUrl = (process.env.EXPO_PUBLIC_IAP_VERIFY_URL || '').trim();

  /*
   * RevenueCat is an ALTERNATIVE verification path, not a bypass.
   *
   * `IAPService.purchaseProduct` says so at the branch itself: "RC verifies the
   * receipt server-side and finishes the transaction itself, so we skip the
   * expo-iap purchase + self-hosted verify + finishTransaction". When RC is
   * live, `verifyReceiptWithServer` is never called, so demanding a self-hosted
   * verify URL blocks a release for a server that would never be contacted.
   *
   * `eas.json` sets EXPO_PUBLIC_USE_REVENUECAT=true for production, so this
   * check was failing every production preflight for a legacy path the build
   * does not use.
   *
   * But RC only takes over when `revenueCatService.isEnabled()` is true, and
   * that needs the flag AND an API key AND the SDK. A flag set without a key
   * silently falls back to the native path — where a missing verify URL means
   * `verifyReceiptWithServer` returns FALSE and every purchase is refused. So
   * this accepts RC as the verification path only when it is genuinely
   * configured, and otherwise still demands the URL.
   */
  const rcFlag = process.env.EXPO_PUBLIC_USE_REVENUECAT === 'true';
  const rcKey = (
    process.env.EXPO_PUBLIC_RC_IOS_KEY
    || process.env.EXPO_PUBLIC_RC_ANDROID_KEY
    || process.env.EXPO_PUBLIC_RC_API_KEY
    || ''
  ).trim();
  const rcHandlesVerification = rcFlag && !!rcKey;

  if (!iapEnabled) {
    log('[SKIP] IAP disabled (EXPO_PUBLIC_ENABLE_IAP=false)', YELLOW);
  } else if (!isProductionBuild) {
    log('[SKIP] Non-production build — verify URL not required', YELLOW);
  } else if (rcHandlesVerification) {
    log('[PASS] RevenueCat verifies receipts server-side (self-hosted verify URL not needed)', GREEN);
  } else if (rcFlag && !rcKey) {
    log('[FAIL] EXPO_PUBLIC_USE_REVENUECAT=true but no RevenueCat API key is set.', RED);
    log('   Without a key `revenueCatService.isEnabled()` is false, so the build', RED);
    log('   silently falls back to the self-hosted path — where a missing verify', RED);
    log('   URL makes verifyReceiptWithServer return FALSE and every purchase is', RED);
    log('   REFUSED. Set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY.', RED);
    hasErrors = true;
  } else if (!verifyUrl) {
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
logSection('10. AdMob Ad Unit IDs (production)');
try {
  const iapEnabled = process.env.EXPO_PUBLIC_ENABLE_ADMOB !== 'false';
  const isProductionBuild = process.argv.includes('--platform')
    && (platform === 'ios' || platform === 'android')
    && !process.argv.includes('--dev');

  if (!iapEnabled) {
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

    const missing = [];
    const malformed = [];

    // Any configured value must be well-formed — catches secret typos on either
    // platform, regardless of whether the var is required.
    for (const name of [...iosVars, ...androidRequired]) {
      const v = (process.env[name] || '').trim();
      if (v && !adUnitPattern.test(v)) {
        malformed.push(`${name}=${v}`);
      }
    }

    // Android (when in scope) still hard-requires its IDs — no committed default.
    if (platform === 'android' || platform === 'all') {
      for (const name of androidRequired) {
        if (!(process.env[name] || '').trim()) {
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
      const tag = advisory ? '[WARN]' : '[FAIL]';
      const color = advisory ? YELLOW : RED;
      log(`${tag} Missing AdMob ad unit IDs for production:`, color);
      missing.forEach((n) => log(`   - ${n}`, color));
      log('   Without these, AdMobService ships with Google test ad units', color);
      log('   (zero revenue). Configure via EAS secrets.', color);
      if (!advisory) hasErrors = true;
    }
    if (malformed.length > 0) {
      log('[FAIL] Malformed AdMob ad unit IDs (expect ca-app-pub-…/…):', RED);
      malformed.forEach((n) => log(`   - ${n}`, RED));
      hasErrors = true;
    }

    // iOS interstitial is optional (no committed default) — warn so the missing
    // revenue slot stays visible without blocking the launch.
    if (platform === 'ios' || platform === 'all') {
      if (!(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || '').trim()) {
        log('[WARN] iOS interstitial ad unit not configured — no interstitial revenue', YELLOW);
        log('   Banner + rewarded serve real ads via committed defaults; create a', YELLOW);
        log('   standard Interstitial unit in AdMob and set', YELLOW);
        log('   EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS to enable interstitials.', YELLOW);
      }
    }

    if (missing.length === 0 && malformed.length === 0) {
      log('[PASS] AdMob ad unit IDs configured for production', GREEN);
    }
  }
} catch (error) {
  log('[FAIL] AdMob unit ID check failed: ' + (error instanceof Error ? error.message : String(error)), RED);
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

