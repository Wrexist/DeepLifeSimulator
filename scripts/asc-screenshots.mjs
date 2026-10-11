#!/usr/bin/env node
/**
 * Replace the App Store screenshot sets on the editable version record.
 *
 *   node scripts/asc-screenshots.mjs --dir screenshots/appstore-2026-10/final          # PLAN
 *   node scripts/asc-screenshots.mjs --dir screenshots/appstore-2026-10/final --apply  # write
 *
 * Layout of --dir: one folder per device, files uploaded in name order
 * (01-…png, 02-…png …, at most ten):
 *   iphone-6.9/  -> APP_IPHONE_67   (1320 x 2868)
 *   iphone-6.5/  -> APP_IPHONE_65   (1284 x 2778)
 *   ipad-13/     -> APP_IPAD_PRO_3GEN_129 (2064 x 2752)
 *
 * Screenshots belong to a VERSION record, and Apple only lets them change while
 * that version is editable. This never creates a version - that is a release
 * decision `scripts/asc-release.mjs` owns - it refuses instead.
 *
 * Every locale on the version gets the same set unless --locales narrows it.
 * A set is replaced, not merged: Apple caps a set at ten, so the old images
 * have to go before the new ones can be added.
 *
 * Credentials: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the repo secrets the
 * release workflows already use). Without --apply nothing is written; the plan
 * still reads App Store Connect so it shows what WOULD change.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AscClient, loadCredentials, missingCredentialNames } from './lib/ascClient.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const has = (f) => ARGS.includes(f);
const valueOf = (f, fb = null) => {
  const i = ARGS.indexOf(f);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith('--') ? ARGS[i + 1] : fb;
};

export const DISPLAY_TYPES = {
  'iphone-6.9': { type: 'APP_IPHONE_67', w: 1320, h: 2868 },
  'iphone-6.5': { type: 'APP_IPHONE_65', w: 1284, h: 2778 },
  'ipad-13': { type: 'APP_IPAD_PRO_3GEN_129', w: 2064, h: 2752 },
};

const EDITABLE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

function die(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/** PNG width/height from the IHDR chunk - no image library needed. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** The files to upload for one device folder, validated against Apple's sizes. */
export function collectSet(dir, device) {
  const spec = DISPLAY_TYPES[device];
  const folder = path.join(dir, device);
  if (!fs.existsSync(folder)) return [];
  const files = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  if (files.length > 10) throw new Error(`${device}: ${files.length} screenshots - Apple allows at most 10`);
  return files.map((name) => {
    const file = path.join(folder, name);
    const buf = fs.readFileSync(file);
    const { w, h } = pngSize(buf);
    if (w !== spec.w || h !== spec.h) {
      throw new Error(`${device}/${name} is ${w}x${h}; ${spec.type} needs ${spec.w}x${spec.h}`);
    }
    return { name, file, size: buf.length, md5: crypto.createHash('md5').update(buf).digest('hex') };
  });
}

function readAscAppId() {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  return eas?.submit?.production?.ios?.ascAppId ?? null;
}

async function uploadOne(client, setId, shot) {
  const created = await client.post('/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: shot.name, fileSize: shot.size },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });
  const id = created.data.id;
  const bytes = fs.readFileSync(shot.file);
  for (const op of created.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, {
      method: op.method,
      headers,
      body: bytes.subarray(op.offset, op.offset + op.length),
    });
    if (!res.ok) throw new Error(`upload part failed for ${shot.name}: HTTP ${res.status}`);
  }
  await client.patch(`/v1/appScreenshots/${id}`, {
    data: { type: 'appScreenshots', id, attributes: { uploaded: true, sourceFileChecksum: shot.md5 } },
  });
  // Apple processes the asset asynchronously; wait so a failure is reported
  // here rather than discovered later as a broken image in the set.
  for (let i = 0; i < 40; i++) {
    const s = await client.get(`/v1/appScreenshots/${id}`);
    const state = s?.data?.attributes?.assetDeliveryState?.state;
    if (state === 'COMPLETE') return;
    if (state === 'FAILED') {
      throw new Error(`${shot.name} failed processing: ${JSON.stringify(s.data.attributes.assetDeliveryState.errors)}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${shot.name} did not finish processing in time`);
}

async function main() {
  const dir = path.resolve(ROOT, valueOf('--dir', 'screenshots/appstore-2026-10/final'));
  const apply = has('--apply');
  const onlyLocales = valueOf('--locales')?.split(',');

  const sets = Object.fromEntries(Object.keys(DISPLAY_TYPES).map((d) => [d, collectSet(dir, d)]));
  const devices = Object.keys(sets).filter((d) => sets[d].length > 0);
  if (devices.length === 0) die(`No screenshots under ${dir}`);
  for (const d of devices) console.log(`${d}: ${sets[d].length} screenshots (${DISPLAY_TYPES[d].type})`);

  const credentials = loadCredentials();
  if (!credentials) die(`App Store Connect credentials missing: ${missingCredentialNames().join(', ')}`);
  const appId = readAscAppId();
  if (!appId) die('No ascAppId in eas.json and ASC_APP_ID is unset.');

  // Reads always run; writes only with --apply.
  const client = new AscClient({ credentials, dryRun: !apply });
  const versions = await client.getAll(`/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=50`);
  const editable = versions.filter((v) => EDITABLE_STATES.has(v.attributes.appStoreState ?? v.attributes.appVersionState));
  if (editable.length === 0) {
    const states = versions.slice(0, 5).map((v) => `${v.attributes.versionString}: ${v.attributes.appStoreState}`).join(', ');
    die(`No editable App Store version (latest: ${states}). Create the next version first (npm run asc:release:apply).`);
  }
  const version = editable[0];
  console.log(`\nVersion ${version.attributes.versionString} (${version.attributes.appStoreState}) · ${apply ? 'APPLY' : 'PLAN - nothing will be written'}`);

  const locs = (await client.getAll(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`))
    .filter((l) => !onlyLocales || onlyLocales.includes(l.attributes.locale));

  for (const loc of locs) {
    const existingSets = await client.getAll(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
    for (const device of devices) {
      const type = DISPLAY_TYPES[device].type;
      let set = existingSets.find((s) => s.attributes.screenshotDisplayType === type);
      const old = set ? await client.getAll(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`) : [];
      console.log(`  ${loc.attributes.locale} ${type}: replace ${old.length} -> ${sets[device].length}`);
      if (!apply) continue;
      if (!set) {
        const created = await client.post('/v1/appScreenshotSets', {
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: type },
            relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
          },
        });
        set = created.data;
      }
      for (const s of old) await client.request('DELETE', `/v1/appScreenshots/${s.id}`);
      for (const shot of sets[device]) {
        await uploadOne(client, set.id, shot);
        console.log(`    uploaded ${shot.name}`);
      }
    }
  }
  console.log(apply ? '\nDone - screenshots replaced.' : '\nPlan only. Re-run with --apply to write.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => die(e?.stack || String(e)));
}
