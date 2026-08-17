#!/usr/bin/env node
// scripts/asc-release.mjs
//
// Creates the App Store Connect version record for a release and fills its
// "What's New" from marketing/aso/metadata.mjs — so the store copy is written
// once, in the repo, validated by `npm run check:aso`, and sent to Apple
// verbatim. Retyping it into the App Store Connect UI is what this replaces.
//
//   npm run asc:status                  what Apple currently has
//   npm run asc:release                 plan the release (writes NOTHING)
//   npm run asc:release:apply           perform the plan
//   node scripts/asc-release.mjs --apply --submit    ...and submit for review
//
// Flags:
//   --version <x.y.z>  store version record to create/fill. Default: STORE_VERSION.
//   --apply            actually write. Without it every mutation is printed only.
//   --submit           submit for review. Requires --apply. See the note below.
//   --build <number>   attach this CFBundleVersion to the version record.
//   --platform <IOS>   default IOS.
//   --json             machine-readable plan on stdout.
//
// Two numbers, deliberately different (CLAUDE.md §9): the STORE version record
// is the 1.x line users see; package.json's version is the BINARY. This script
// only ever touches the store record and refuses to read one for the other.
//
// Why --submit is separate from --apply: creating a record and filling copy is
// reversible in the App Store Connect UI. Submitting puts the app in front of
// Apple, and a metadata rejection returns every attached IAP marked "Rejected"
// too. That is a different class of action, so it takes a different flag.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AscClient,
  AscApiError,
  loadCredentials,
  missingCredentialNames,
} from './lib/ascClient.mjs';
import {
  planVersionRecord,
  planLocalizations,
  versionCreatePayload,
  localizationCreatePayload,
  localizationUpdatePayload,
  attachBuildPayload,
  reviewSubmissionCreatePayload,
  reviewSubmissionItemCreatePayload,
  reviewSubmissionSubmitPayload,
} from './lib/ascRelease.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);

const has = (flag) => ARGS.includes(flag);
const valueOf = (flag, fallback = null) => {
  const i = ARGS.indexOf(flag);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith('--') ? ARGS[i + 1] : fallback;
};

const JSON_OUT = has('--json');
// In --json mode the report is the stdout contract, so narration goes to stderr.
const say = (...a) => (JSON_OUT ? console.error(...a) : console.log(...a));

const C = process.stdout.isTTY && !JSON_OUT
  ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { dim: '', red: '', green: '', yellow: '', bold: '', off: '' };

function die(message) {
  console.error(`${C.red}✖ ${message}${C.off}`);
  process.exit(1);
}

async function loadMetadata() {
  const mod = await import(path.join(ROOT, 'marketing/aso/metadata.mjs'));
  return mod;
}

function readAscAppId() {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  return eas?.submit?.production?.ios?.ascAppId ?? null;
}

/**
 * The locales this repo actually ships, mapped to their What's New text.
 * `shipped: false` locales (en-GB) are reference-only and deliberately not
 * created — those storefronts fall back to en-US already.
 */
function whatsNewByLocale(APPLE) {
  const out = {};
  if (APPLE.whatsNew) out['en-US'] = APPLE.whatsNew;
  for (const [locale, loc] of Object.entries(APPLE.localized ?? {})) {
    if (loc?.shipped === false) continue;
    if (loc?.whatsNew) out[locale] = loc.whatsNew;
  }
  return out;
}

function preview(text, width = 88) {
  const firstLine = String(text).split('\n').find((l) => l.trim()) ?? '';
  return firstLine.length > width ? `${firstLine.slice(0, width - 1)}…` : firstLine;
}

async function main() {
  const { APPLE } = await loadMetadata();

  const versionString = valueOf('--version', APPLE.storeVersion);
  const platform = valueOf('--platform', 'IOS');
  const buildNumber = valueOf('--build');
  const apply = has('--apply');
  const submit = has('--submit');

  if (!versionString) {
    die('No version given and marketing/aso/metadata.mjs declares no storeVersion. Pass --version <x.y.z>.');
  }
  if (submit && !apply) {
    die('--submit requires --apply. Submitting for review is a real submission, not a plan.');
  }

  const credentials = loadCredentials();
  if (!credentials) {
    die(
      `App Store Connect credentials missing: ${missingCredentialNames().join(', ')}.\n` +
        '  Create an API key (App Store Connect → Users and Access → Integrations → App Store Connect API)\n' +
        '  with the App Manager role, then export ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8.',
    );
  }

  const appId = readAscAppId();
  if (!appId) die('No ascAppId in eas.json (submit.production.ios.ascAppId) and ASC_APP_ID is unset.');

  const client = new AscClient({ credentials, dryRun: !apply });

  const copy = whatsNewByLocale(APPLE);
  if (Object.keys(copy).length === 0) {
    die('marketing/aso/metadata.mjs declares no whatsNew copy for any shipped locale — nothing to publish.');
  }

  say(`${C.bold}App Store Connect · app ${appId} · version record ${versionString} (${platform})${C.off}`);
  say(`${C.dim}Mode: ${apply ? 'APPLY — writes will be performed' : 'PLAN — nothing will be written'}${C.off}\n`);

  // ---- 1 · what Apple has now -------------------------------------------
  const versions = await client.getAll(
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=${encodeURIComponent(platform)}` +
      '&fields[appStoreVersions]=versionString,appStoreVersionState,createdDate&limit=200',
  );
  say(`${C.bold}Existing versions${C.off} (${versions.length})`);
  for (const v of versions.slice(0, 8)) {
    say(`  ${String(v.attributes?.versionString).padEnd(10)} ${v.attributes?.appStoreVersionState ?? '?'}`);
  }
  if (versions.length > 8) say(`  ${C.dim}… and ${versions.length - 8} more${C.off}`);
  say('');

  if (has('--status')) {
    process.exit(0);
  }

  // ---- 2 · the version record -------------------------------------------
  const versionPlan = planVersionRecord({ versions, versionString });
  if (versionPlan.action === 'refuse') {
    die(versionPlan.reason);
  }

  let versionId = versionPlan.version?.id ?? null;
  if (versionPlan.action === 'create') {
    say(`${C.green}CREATE${C.off} version record ${versionString}` +
      (versionPlan.highestReleased ? ` ${C.dim}(beats released ${versionPlan.highestReleased})${C.off}` : ''));
    const payload = versionCreatePayload({
      appId,
      versionString,
      platform,
      copyright: APPLE.copyright,
      releaseType: APPLE.releaseType,
    });
    const created = await client.post('/v1/appStoreVersions', payload);
    versionId = created?.data?.id ?? null;
  } else {
    say(`${C.dim}REUSE${C.off}  version record ${versionString} (state ${versionPlan.state})`);
  }

  // ---- 3 · What's New, per shipped locale --------------------------------
  // In a plan run against a not-yet-created version there is nothing to read,
  // so every managed locale is reported as a create. That is the truth of what
  // would happen, not a guess.
  const existingLocalizations = versionId
    ? await client.getAll(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations` +
          '?fields[appStoreVersionLocalizations]=locale,whatsNew&limit=200',
      )
    : [];

  const localizationOps = planLocalizations({ existingLocalizations, whatsNewByLocale: copy });

  say(`\n${C.bold}What's New${C.off}`);
  for (const op of localizationOps) {
    if (op.op === 'unchanged') {
      say(`  ${C.dim}UNCHANGED${C.off} ${op.locale}`);
      continue;
    }
    if (op.op === 'skip-unmanaged') {
      say(`  ${C.yellow}SKIP${C.off}      ${op.locale} ${C.dim}— present on the version, not declared in metadata.mjs${C.off}`);
      continue;
    }
    say(`  ${C.green}${op.op === 'create' ? 'CREATE' : 'UPDATE'}${C.off}    ${op.locale}  ${C.dim}${preview(op.whatsNew)}${C.off}`);

    if (op.op === 'create') {
      // Planning a version that does not exist yet: there is no id to
      // reference, but the write still HAPPENS on apply, so it is recorded
      // against a placeholder. Dropping it would make the plan claim one write
      // and then perform three — a plan that under-reports is worse than none.
      await client.post(
        '/v1/appStoreVersionLocalizations',
        localizationCreatePayload({
          versionId: versionId ?? '<id of the version created above>',
          locale: op.locale,
          whatsNew: op.whatsNew,
        }),
      );
    } else {
      await client.patch(
        `/v1/appStoreVersionLocalizations/${op.id}`,
        localizationUpdatePayload({ id: op.id, whatsNew: op.whatsNew }),
      );
    }
  }

  // ---- 4 · optional build attachment -------------------------------------
  if (buildNumber) {
    const builds = await client.getAll(
      `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(buildNumber)}` +
        '&fields[builds]=version,processingState&limit=10',
    );
    const build = builds[0];
    if (!build) {
      die(`No build with CFBundleVersion ${buildNumber} found on App Store Connect. Has it finished processing?`);
    }
    say(`\n${C.bold}Build${C.off}\n  ${C.green}ATTACH${C.off}    build ${buildNumber} (${build.attributes?.processingState})`);
    if (versionId) {
      await client.patch(`/v1/appStoreVersions/${versionId}`, attachBuildPayload({ versionId, buildId: build.id }));
    }
  }

  // ---- 5 · optional submission -------------------------------------------
  if (submit) {
    say(`\n${C.bold}Review submission${C.off}`);
    const created = await client.post('/v1/reviewSubmissions', reviewSubmissionCreatePayload({ appId, platform }));
    const submissionId = created?.data?.id;
    if (submissionId) {
      await client.post(
        '/v1/reviewSubmissionItems',
        reviewSubmissionItemCreatePayload({ submissionId, versionId }),
      );
      await client.patch(
        `/v1/reviewSubmissions/${submissionId}`,
        reviewSubmissionSubmitPayload({ submissionId }),
      );
      say(`  ${C.green}SUBMITTED${C.off} for review (submission ${submissionId})`);
    }
  }

  // ---- 6 · report ---------------------------------------------------------
  if (!apply) {
    say(`\n${C.bold}Planned writes${C.off} (${client.plannedWrites.length})`);
    for (const w of client.plannedWrites) say(`  ${w.method} ${w.path}`);
    say(`\n${C.yellow}Nothing was written.${C.off} Re-run with --apply to perform this plan.`);
  } else {
    say(`\n${C.green}Done.${C.off}` + (submit ? '' : ` Review it in App Store Connect, then submit when ready.`));
  }

  if (JSON_OUT) {
    process.stdout.write(
      `${JSON.stringify(
        {
          appId,
          versionString,
          platform,
          applied: apply,
          submitted: submit,
          versionAction: versionPlan.action,
          localizations: localizationOps.map(({ whatsNew, previous, ...rest }) => rest),
          plannedWrites: client.plannedWrites.map(({ method, path: p }) => ({ method, path: p })),
        },
        null,
        2,
      )}\n`,
    );
  }
}

main().catch((error) => {
  if (error instanceof AscApiError) die(error.message);
  die(error?.stack || error?.message || String(error));
});
