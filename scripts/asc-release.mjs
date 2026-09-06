#!/usr/bin/env node
// scripts/asc-release.mjs
//
// Writes the WHOLE App Store product page from marketing/aso/metadata.mjs —
// name, subtitle, keyword field, description, promotional text, What's New and
// the support / marketing / privacy links — for every locale the repo ships.
// The copy is written once, in the repo, validated by `npm run check:aso`, and
// sent to Apple verbatim. Retyping any of it into the App Store Connect UI is
// what this replaces.
//
//   npm run asc:status                  what Apple has now, field by field
//   npm run asc:release                 plan the release (writes NOTHING)
//   npm run asc:release:apply           perform the plan
//   node scripts/asc-release.mjs --apply --submit    ...and submit for review
//
// Flags:
//   --version <x.y.z>  store version record to create/fill. Default: STORE_VERSION.
//   --apply            actually write. Without it every mutation is printed only.
//   --submit           submit for review. Requires --apply. See the note below.
//   --retarget         renumber an existing editable draft to --version.
//   --only <fields>    write only these fields, e.g. --only whatsNew
//   --build <number>   attach this CFBundleVersion to the version record.
//   --platform <IOS>   default IOS.
//   --json             machine-readable plan on stdout.
//
// A listing is split across two resources and the split is not where you would
// guess: description, keywords, promotional text, What's New and the support
// and marketing URLs belong to the VERSION, while the name, subtitle and
// privacy policy URL belong to the APP. Both are planned here, and the plan
// names which resource each write lands on.
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
  EDITABLE_STATES,
  MANAGED_APP_INFO_FIELDS,
  appInfoStateOf,
  MANAGED_VERSION_FIELDS,
  appInfoLocalizationCreatePayload,
  appInfoLocalizationUpdatePayload,
  attachBuildPayload,
  desiredListing,
  planAppInfo,
  planLocalizations,
  planVersionRecord,
  restrictListing,
  versionStateOf,
  reviewSubmissionCreatePayload,
  reviewSubmissionItemCreatePayload,
  reviewSubmissionSubmitPayload,
  versionCreatePayload,
  versionLocalizationCreatePayload,
  versionLocalizationUpdatePayload,
  versionRenumberPayload,
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
 * Fields long enough that printing them whole would bury the plan. For these
 * the diff reports the length and the opening line; for everything else it
 * reports the values, because a wrong subtitle is only visible as a subtitle.
 */
const LONG_FIELDS = new Set(['description', 'whatsNew']);

function preview(text, width = 72) {
  const firstLine = String(text ?? '').split('\n').find((l) => l.trim()) ?? '';
  return firstLine.length > width ? `${firstLine.slice(0, width - 1)}…` : firstLine;
}

function renderChange({ field, from, to }) {
  if (LONG_FIELDS.has(field)) {
    const was = from === null ? 'unset' : `${[...String(from)].length} chars`;
    return `${field}: ${was} → ${[...String(to)].length} chars · ${preview(to)}`;
  }
  const was = from === null || from === '' ? '(unset)' : String(from);
  return from === null || from === '' ? `${field}: ${to}` : `${field}: ${was} → ${to}`;
}

function reportOps(label, ops, resource) {
  say(`\n${C.bold}${label}${C.off} ${C.dim}(${resource})${C.off}`);
  for (const op of ops) {
    if (op.op === 'unchanged') {
      say(`  ${C.dim}UNCHANGED${C.off} ${op.locale}`);
      continue;
    }
    if (op.op === 'skip-unmanaged') {
      say(`  ${C.yellow}SKIP${C.off}      ${op.locale} ${C.dim}— present on the listing, not declared in metadata.mjs${C.off}`);
      continue;
    }
    say(`  ${C.green}${op.op === 'create' ? 'CREATE' : 'UPDATE'}${C.off}    ${op.locale}`);
    for (const change of op.changes) say(`      ${C.dim}${renderChange(change)}${C.off}`);
  }
}

/** Reads every localization of a resource, with only the fields this repo owns. */
async function readLocalizations(client, { parentType, parentId, childType, fields }) {
  if (!parentId) return [];
  return client.getAll(
    `/v1/${parentType}/${parentId}/${childType}` +
      `?fields[${childType}]=locale,${fields.join(',')}&limit=200`,
  );
}

async function main() {
  const { APPLE } = await loadMetadata();

  const versionString = valueOf('--version', APPLE.storeVersion);
  const platform = valueOf('--platform', 'IOS');
  const buildNumber = valueOf('--build');
  const apply = has('--apply');
  const submit = has('--submit');
  const retarget = has('--retarget');
  const only = (valueOf('--only') ?? '').split(',').map((f) => f.trim()).filter(Boolean);
  const statusOnly = has('--status');

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

  const full = desiredListing(APPLE);
  if (Object.keys(full.versionLocalizations).length === 0) {
    die('marketing/aso/metadata.mjs declares no shipped locale — there is no listing to publish.');
  }

  // --only narrows what is written. Not every change is a release: release
  // notes ship with every build, while the app NAME costs a review cycle, so
  // sending both because you wanted one is how an unrelated decision rides
  // along with a routine push.
  const { listing: desired, unknown } = restrictListing(full, only);
  if (unknown.length) {
    die(
      `--only names ${unknown.length === 1 ? 'a field that does' : 'fields that do'} not exist: ${unknown.join(', ')}.\n` +
        `  Valid: ${[...MANAGED_VERSION_FIELDS, ...MANAGED_APP_INFO_FIELDS].join(', ')}`,
    );
  }
  const locales = Object.keys(desired.versionLocalizations);
  if (locales.length === 0 && Object.keys(desired.appInfoLocalizations).length === 0) {
    die(`--only ${only.join(',')} matched no field the metadata declares — nothing to write.`);
  }

  say(`${C.bold}App Store Connect · app ${appId} · version record ${versionString} (${platform})${C.off}`);
  say(`${C.dim}Mode: ${apply ? 'APPLY — writes will be performed' : 'PLAN — nothing will be written'}${C.off}`);
  say(`${C.dim}Locales: ${locales.join(', ')}${C.off}`);
  if (only.length) say(`${C.yellow}Fields: ${only.join(', ')} only — every other field is left as Apple has it${C.off}`);
  say('');

  // ---- 1 · what Apple has now -------------------------------------------
  // No `fields[appStoreVersions]` on purpose. A sparse fieldset names Apple's
  // attributes, and Apple renames them: asking for `appStoreVersionState` — the
  // deprecated ENUM's name, which was never an attribute — answered every run
  // with `HTTP 400: not a valid field name` before the plan printed a line.
  // Taking the default attribute set costs a few hundred bytes and cannot be
  // invalidated by a rename.
  const versions = await client.getAll(
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=${encodeURIComponent(platform)}&limit=200`,
  );
  say(`${C.bold}Existing versions${C.off} (${versions.length})`);
  for (const v of versions.slice(0, 8)) {
    say(`  ${String(v.attributes?.versionString).padEnd(10)} ${versionStateOf(v) ?? '?'}`);
  }
  if (versions.length > 8) say(`  ${C.dim}… and ${versions.length - 8} more${C.off}`);

  if (statusOnly) {
    // Status answers the question the release runbook used to answer by
    // opening a browser: what does the store page SAY right now, and how does
    // it differ from the repo? So it reads both resources and diffs them.
    const target = versions.find((v) => v.attributes?.versionString === versionString)
      ?? versions.find((v) => EDITABLE_STATES.has(versionStateOf(v)));
    const appInfos = await client.getAll(`/v1/apps/${appId}/appInfos?limit=50`);
    const appInfoPlan = planAppInfo(appInfos);

    const versionLocs = await readLocalizations(client, {
      parentType: 'appStoreVersions',
      parentId: target?.id,
      childType: 'appStoreVersionLocalizations',
      fields: MANAGED_VERSION_FIELDS,
    });
    // When nothing is editable there is still a LIVE app record, and reading it
    // is the whole point of a status run: the name and subtitle on the store
    // page right now are what a keyword decision turns on — a term already in
    // the name is a slot the keyword field is wasting. Read-only either way.
    const appInfoForRead = appInfoPlan.action === 'use' ? appInfoPlan.appInfo : appInfos[0] ?? null;
    const appInfoLocs = await readLocalizations(client, {
      parentType: 'appInfos',
      parentId: appInfoForRead?.id ?? null,
      childType: 'appInfoLocalizations',
      fields: MANAGED_APP_INFO_FIELDS,
    });

    say(`\n${C.bold}Live listing${C.off}`);
    say(`  version record read: ${target ? `${target.attributes?.versionString} (${versionStateOf(target)})` : C.yellow + 'none editable' + C.off}`);
    // A diff against a version Apple already has reads like a to-do list, and
    // it is not one: none of it can be written until the version comes back.
    if (target && !EDITABLE_STATES.has(versionStateOf(target))) {
      say(`  ${C.yellow}NOT EDITABLE${C.off} — ${versionStateOf(target)}. The differences below are what the repo would say, not what is about to happen.`);
    }
    say(`  app record read:     ${appInfoPlan.action === 'use'
      ? appInfoPlan.state
      : `${C.yellow}${appInfoStateOf(appInfoForRead) ?? 'none'} (live, not editable)${C.off} — ${appInfoPlan.reason}`}`);
    for (const l of appInfoLocs) {
      say(`    ${C.dim}on the store now · ${l.attributes?.locale}: "${l.attributes?.name}" / "${l.attributes?.subtitle ?? ''}"${C.off}`);
    }

    reportOps('Would change on the version', planLocalizations({
      existingLocalizations: versionLocs, desiredByLocale: desired.versionLocalizations,
    }), 'appStoreVersionLocalizations');
    reportOps('Would change on the app', planLocalizations({
      existingLocalizations: appInfoLocs, desiredByLocale: desired.appInfoLocalizations,
    }), 'appInfoLocalizations');
    say(`\n${C.dim}Read-only. Run \`npm run asc:release\` for the full plan.${C.off}`);
    process.exit(0);
  }
  say('');

  // ---- 2 · the version record -------------------------------------------
  const versionPlan = planVersionRecord({ versions, versionString, retarget });
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
  } else if (versionPlan.action === 'retarget') {
    say(`${C.green}RENUMBER${C.off} the open draft ${versionPlan.from} → ${versionString} ${C.dim}(state ${versionPlan.state})${C.off}`);
    await client.patch(`/v1/appStoreVersions/${versionId}`, versionRenumberPayload({ versionId, versionString }));
  } else {
    say(`${C.dim}REUSE${C.off}  version record ${versionString} (state ${versionPlan.state})`);
  }

  // ---- 3 · the copy that belongs to the VERSION --------------------------
  // In a plan run against a not-yet-created version there is nothing to read,
  // so every managed locale is reported as a create. That is the truth of what
  // would happen, not a guess.
  const existingVersionLocs = await readLocalizations(client, {
    parentType: 'appStoreVersions',
    parentId: versionId,
    childType: 'appStoreVersionLocalizations',
    fields: MANAGED_VERSION_FIELDS,
  });

  const versionOps = planLocalizations({
    existingLocalizations: existingVersionLocs,
    desiredByLocale: desired.versionLocalizations,
  });
  reportOps('Description · keywords · promo · What\'s New · URLs', versionOps, 'appStoreVersionLocalizations');

  for (const op of versionOps) {
    if (op.op === 'create') {
      // Planning a version that does not exist yet: there is no id to
      // reference, but the write still HAPPENS on apply, so it is recorded
      // against a placeholder. Dropping it would make the plan claim one write
      // and then perform several — a plan that under-reports is worse than none.
      await client.post(
        '/v1/appStoreVersionLocalizations',
        versionLocalizationCreatePayload({
          versionId: versionId ?? '<id of the version created above>',
          locale: op.locale,
          attributes: op.attributes,
        }),
      );
    } else if (op.op === 'update') {
      await client.patch(
        `/v1/appStoreVersionLocalizations/${op.id}`,
        versionLocalizationUpdatePayload({ id: op.id, attributes: op.attributes }),
      );
    }
  }

  // ---- 4 · the copy that belongs to the APP ------------------------------
  // Name, subtitle and privacy policy URL are not version fields. They live on
  // the app's editable appInfo record, which only exists while a version is
  // being prepared — so this is read AFTER the version record above, not
  // alongside it.
  const appInfos = Object.keys(desired.appInfoLocalizations).length > 0
    ? await client.getAll(`/v1/apps/${appId}/appInfos?limit=50`)
    : null;
  const appInfoPlan = appInfos === null
    // --only left nothing for the app record. Reading it anyway would report a
    // refusal ("no editable appInfo") for work nobody asked to do.
    ? { action: 'skip' }
    : planAppInfo(appInfos);
  if (appInfoPlan.action === 'skip') {
    say(`\n${C.bold}Name · subtitle · privacy URL${C.off} ${C.dim}(appInfoLocalizations)${C.off}`);
    say(`  ${C.dim}NOT IN SCOPE — excluded by --only${C.off}`);
  } else if (appInfoPlan.action === 'refuse') {
    if (!apply && versionPlan.action === 'create') {
      // Dry run against a version that does not exist yet: Apple opens the
      // editable app record together with the version, so there is genuinely
      // nothing to read. Say so rather than inventing a diff.
      say(`\n${C.bold}Name · subtitle · privacy URL${C.off} ${C.dim}(appInfoLocalizations)${C.off}`);
      say(`  ${C.yellow}DEFERRED${C.off}  ${appInfoPlan.reason}`);
      say(`  ${C.dim}These are planned against the editable app record that appears with the version.${C.off}`);
    } else {
      die(appInfoPlan.reason);
    }
  } else {
    const existingAppInfoLocs = await readLocalizations(client, {
      parentType: 'appInfos',
      parentId: appInfoPlan.appInfo.id,
      childType: 'appInfoLocalizations',
      fields: MANAGED_APP_INFO_FIELDS,
    });
    const appInfoOps = planLocalizations({
      existingLocalizations: existingAppInfoLocs,
      desiredByLocale: desired.appInfoLocalizations,
    });
    reportOps('Name · subtitle · privacy URL', appInfoOps, 'appInfoLocalizations');

    for (const op of appInfoOps) {
      if (op.op === 'create') {
        await client.post(
          '/v1/appInfoLocalizations',
          appInfoLocalizationCreatePayload({
            appInfoId: appInfoPlan.appInfo.id,
            locale: op.locale,
            attributes: op.attributes,
          }),
        );
      } else if (op.op === 'update') {
        await client.patch(
          `/v1/appInfoLocalizations/${op.id}`,
          appInfoLocalizationUpdatePayload({ id: op.id, attributes: op.attributes }),
        );
      }
    }
  }

  // ---- 5 · optional build attachment -------------------------------------
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

  // ---- 6 · optional submission -------------------------------------------
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

  // ---- 7 · report ---------------------------------------------------------
  if (!apply) {
    say(`\n${C.bold}Planned writes${C.off} (${client.plannedWrites.length})`);
    for (const w of client.plannedWrites) say(`  ${w.method} ${w.path}`);
    say(`\n${C.yellow}Nothing was written.${C.off} Re-run with --apply to perform this plan.`);
  } else {
    say(`\n${C.green}Done.${C.off}` + (submit ? '' : ` Review it in App Store Connect, then submit when ready.`));
  }

  if (JSON_OUT) {
    const strip = (ops) => ops.map(({ attributes, changes, ...rest }) => ({
      ...rest,
      fields: (changes ?? []).map((c) => c.field),
    }));
    process.stdout.write(
      `${JSON.stringify(
        {
          appId,
          versionString,
          platform,
          applied: apply,
          submitted: submit,
          versionAction: versionPlan.action,
          localizations: strip(versionOps),
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
