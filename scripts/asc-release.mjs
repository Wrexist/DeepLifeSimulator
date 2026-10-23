#!/usr/bin/env node
// scripts/asc-release.mjs
//
// Creates the App Store Connect version record for a release and fills its
// listing — What's New, description, keywords and promotional text on the
// version, name and subtitle on App Information, for every managed language
// (creating languages marked `pending`) — from marketing/aso/metadata.mjs — so the store copy is written
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
//   --release          release a PENDING_DEVELOPER_RELEASE version. Requires --apply.
//   --status           print the existing versions and their states, then exit.
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
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AscClient,
  AscApiError,
  loadCredentials,
  missingCredentialNames,
} from './lib/ascClient.mjs';
import {
  planVersionRecord,
  findVersion,
  fetchAppStoreVersions,
  stateOf,
  listingByLocale,
  planFieldLocalizations,
  pickEditableAppInfo,
  inheritUrlsFromPrimary,
  versionCreatePayload,
  versionLocalizationCreatePayload,
  versionLocalizationUpdatePayload,
  infoLocalizationCreatePayload,
  infoLocalizationUpdatePayload,
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
  const mod = await import(pathToFileURL(path.join(ROOT, 'marketing/aso/metadata.mjs')).href);
  return mod;
}

function readAscAppId() {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  return eas?.submit?.production?.ios?.ascAppId ?? null;
}

/** Prints one planned op; returns true when there is nothing to write. */
function reportOp(op) {
  if (op.op === 'unchanged') {
    say(`  ${C.dim}UNCHANGED${C.off} ${op.locale}`);
    return true;
  }
  if (op.op === 'skip-unmanaged') {
    say(`  ${C.yellow}SKIP${C.off}      ${op.locale} ${C.dim}— present on Apple's record, not declared in metadata.mjs${C.off}`);
    return true;
  }
  const fields = Object.keys(op.attributes).join(', ');
  say(`  ${C.green}${op.op === 'create' ? 'CREATE' : 'UPDATE'}${C.off}    ${op.locale.padEnd(6)} ${C.dim}${fields}${C.off}`);
  if (op.attributes.whatsNew) say(`            ${C.dim}${preview(op.attributes.whatsNew)}${C.off}`);
  return false;
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

  const listing = listingByLocale(APPLE);
  const versionCopy = Object.fromEntries(Object.entries(listing).map(([l, c]) => [l, c.version]));
  const infoCopy = Object.fromEntries(Object.entries(listing).map(([l, c]) => [l, c.info]));
  if (!Object.values(versionCopy).some((c) => c.whatsNew)) {
    die('marketing/aso/metadata.mjs declares no whatsNew copy for any shipped locale — nothing to publish.');
  }

  say(`${C.bold}App Store Connect · app ${appId} · version record ${versionString} (${platform})${C.off}`);
  say(`${C.dim}Mode: ${apply ? 'APPLY — writes will be performed' : 'PLAN — nothing will be written'}${C.off}\n`);

  // ---- 1 · what Apple has now -------------------------------------------
  const versions = await fetchAppStoreVersions(client, appId, platform);
  say(`${C.bold}Existing versions${C.off} (${versions.length})`);
  for (const v of versions.slice(0, 8)) {
    say(`  ${String(v.attributes?.versionString).padEnd(10)} ${stateOf(v) ?? '?'}`);
  }
  if (versions.length > 8) say(`  ${C.dim}… and ${versions.length - 8} more${C.off}`);
  say('');

  if (has('--status')) {
    process.exit(0);
  }

  // ---- 1b · legal links, read-only ---------------------------------------
  // Guideline 3.1.2: an app with an auto-renewing subscription needs a working
  // Privacy Policy URL AND a Terms of Use (EULA) link in its metadata. This
  // prints what Apple holds for the target version, whatever its state, so a
  // submitted version can be checked without being editable.
  const target = versions.find((v) => v.attributes?.versionString === versionString);
  if (target) {
    const vlocs = await client.getAll(
      `/v1/appStoreVersions/${target.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,description,supportUrl,marketingUrl&limit=50`,
    );
    const infos = await client.getAll(`/v1/apps/${appId}/appInfos?limit=10`);
    const privacy = new Map();
    for (const info of infos) {
      for (const l of await client.getAll(`/v1/appInfos/${info.id}/appInfoLocalizations?fields[appInfoLocalizations]=locale,privacyPolicyUrl&limit=50`)) {
        privacy.set(`${info.attributes?.state ?? info.attributes?.appStoreState}:${l.attributes.locale}`, l.attributes.privacyPolicyUrl ?? '-');
      }
    }
    say(`${C.bold}Legal links on ${versionString}${C.off}`);
    for (const l of vlocs) {
      const d = l.attributes.description ?? '';
      say(`  ${l.attributes.locale.padEnd(6)} EULA-in-description:${/stdeula|terms of use|eula/i.test(d) ? 'yes' : 'NO'} privacy-in-description:${/privacy/i.test(d) ? 'yes' : 'NO'} support:${l.attributes.supportUrl ?? '-'}`);
    }
    for (const [k, u] of privacy) say(`  privacyPolicyUrl ${k} ${u}`);
    say('');
  }

  // ---- 1b2 · release an approved version ----------------------------------
  // The listing uses releaseType MANUAL, so an approved version waits in
  // PENDING_DEVELOPER_RELEASE until somebody presses Release. This is that
  // press. Nothing else is written, and any other state is refused: releasing
  // is the step that puts the build in front of every player.
  if (has('--release')) {
    if (!apply) die('--release requires --apply.');
    const state = target ? stateOf(target) : null;
    if (state !== 'PENDING_DEVELOPER_RELEASE') die(`Version ${versionString} is ${state ?? 'missing'}; only PENDING_DEVELOPER_RELEASE can be released here.`);
    await client.post('/v1/appStoreVersionReleaseRequests', {
      data: { type: 'appStoreVersionReleaseRequests', relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: target.id } } } },
    });
    say(`  ${C.green}RELEASED${C.off} ${versionString}`);
    process.exit(0);
  }

  // ---- 1c · pull a version out of review ---------------------------------
  // Only while it is WAITING_FOR_REVIEW: the version then returns to an
  // editable state (DEVELOPER_REJECTED) with its copy, build and screenshots
  // intact, and the next --submit creates a fresh submission.
  if (has('--cancel-review')) {
    if (!apply) die('--cancel-review requires --apply.');
    const state = target ? stateOf(target) : null;
    if (state !== 'WAITING_FOR_REVIEW') die(`Version ${versionString} is ${state ?? 'missing'}; only WAITING_FOR_REVIEW can be pulled from review here.`);
    const subs = await client.getAll(`/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=${platform}&filter[state]=WAITING_FOR_REVIEW&limit=5`);
    if (!subs.length) die('No WAITING_FOR_REVIEW submission found for this app.');
    for (const sub of subs) {
      await client.patch(`/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } } });
      say(`  ${C.green}CANCELED${C.off} submission ${sub.id}`);
    }
    for (let i = 0; i < 30; i++) {
      const now = stateOf(findVersion(await fetchAppStoreVersions(client, appId, platform), versionString));
      if (now !== 'WAITING_FOR_REVIEW') { say(`  ${versionString} is now ${now}`); process.exit(0); }
      await new Promise((r) => setTimeout(r, 10_000));
    }
    die(`${versionString} is still WAITING_FOR_REVIEW 5 minutes after cancelling - check App Store Connect.`);
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

  // ---- 3 · the version's copy, per managed locale ------------------------
  // In a plan run against a not-yet-created version there is nothing to read,
  // so every managed locale is reported as a create. That is the truth of what
  // would happen, not a guess. (On apply, Apple copies the previous version's
  // localizations onto a new record, so most of these become updates.)
  const readVersionLocs = () => (versionId
    ? client.getAll(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations` +
          '?fields[appStoreVersionLocalizations]=locale,whatsNew,description,keywords,promotionalText,supportUrl,marketingUrl&limit=200',
      )
    : Promise.resolve([]));

  const existingVersionLocs = await readVersionLocs();
  inheritUrlsFromPrimary(versionCopy, existingVersionLocs, ['supportUrl', 'marketingUrl']);
  const localizationOps = planFieldLocalizations({ existing: existingVersionLocs, desired: versionCopy });
  say(`\n${C.bold}Version copy${C.off} ${C.dim}(What's New, description, keywords, promotional text)${C.off}`);
  for (const op of localizationOps) {
    if (reportOp(op)) continue;
    if (op.op === 'create') {
      // Planning a version that does not exist yet: there is no id to
      // reference, but the write still HAPPENS on apply, so it is recorded
      // against a placeholder. A plan that under-reports is worse than none.
      await client.post(
        '/v1/appStoreVersionLocalizations',
        versionLocalizationCreatePayload({
          versionId: versionId ?? '<id of the version created above>',
          locale: op.locale,
          attributes: op.attributes,
        }),
      );
    } else {
      await client.patch(
        `/v1/appStoreVersionLocalizations/${op.id}`,
        versionLocalizationUpdatePayload({ id: op.id, attributes: op.attributes }),
      );
    }
  }

  // ---- 3b · name and subtitle on App Information --------------------------
  // Only the App Information record attached to the version being prepared is
  // editable. Read AFTER the version localizations are written, because adding
  // a language to the version can create its App Information row too.
  const appInfos = await client.getAll(`/v1/apps/${appId}/appInfos?limit=10`);
  const appInfo = pickEditableAppInfo(appInfos);
  const infoLocs = appInfo
    ? await client.getAll(`/v1/appInfos/${appInfo.id}/appInfoLocalizations?fields[appInfoLocalizations]=locale,name,subtitle,privacyPolicyUrl&limit=200`)
    : [];
  inheritUrlsFromPrimary(infoCopy, infoLocs, ['privacyPolicyUrl']);
  const infoOps = planFieldLocalizations({ existing: infoLocs, desired: infoCopy });
  say(`\n${C.bold}App Information${C.off} ${C.dim}(name, subtitle)${C.off}`);
  if (!appInfo && versionPlan.action !== 'create') {
    say(`  ${C.yellow}SKIP${C.off}      no editable App Information record — name and subtitle are locked while a version is in review or live`);
  } else {
    for (const op of infoOps) {
      if (reportOp(op)) continue;
      if (op.op === 'create') {
        await client.post(
          '/v1/appInfoLocalizations',
          infoLocalizationCreatePayload({
            appInfoId: appInfo?.id ?? '<id of the App Information record for the new version>',
            locale: op.locale,
            attributes: op.attributes,
          }),
        );
      } else {
        await client.patch(
          `/v1/appInfoLocalizations/${op.id}`,
          infoLocalizationUpdatePayload({ id: op.id, attributes: op.attributes }),
        );
      }
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
    // Apple allows one open submission per platform. A run that failed after
    // step 1 leaves an empty READY_FOR_REVIEW draft behind; reuse it rather
    // than creating a second one Apple will refuse.
    const open = await client.getAll(
      `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=${platform}&filter[state]=READY_FOR_REVIEW&limit=5`,
    );
    const submissionId = open[0]?.id
      ?? (await client.post('/v1/reviewSubmissions', reviewSubmissionCreatePayload({ appId, platform })))?.data?.id;
    if (open[0]) say(`  ${C.dim}REUSE${C.off}     open draft submission ${submissionId}`);
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
          localizations: localizationOps.map(({ attributes, ...rest }) => ({ ...rest, fields: Object.keys(attributes ?? {}) })),
          appInfoLocalizations: infoOps.map(({ attributes, ...rest }) => ({ ...rest, fields: Object.keys(attributes ?? {}) })),
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
