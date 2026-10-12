// scripts/lib/ascCreative.mjs
//
// Product Page creative assets (the "Header and Search Results" tab, live in
// App Store Connect since 2026-10-05). Unlike screenshots they are not uploaded
// to a version: an image goes into the app's Asset Library once, and is then
// PLACED on each localization of the editable version.
//
// The endpoint names are not in a reference this repo could verify when this
// was written; they follow two public implementations (a fastlane uploader and
// a Ruby workflow). So the plan run prints Apple's own reference data - the
// placement types, their groups and the image specs each group accepts - and
// every decision below is driven by that data rather than hard-coded sizes.
//
//   <dir>/header/*.png  -> PRODUCT_PAGE_HEADER_ASSET
//   <dir>/search/*.png  -> APP_STORE_SEARCH_RESULTS_ASSET
import fs from 'node:fs';
import path from 'node:path';

export const CREATIVE_FOLDERS = {
  header: 'PRODUCT_PAGE_HEADER_ASSET',
  search: 'APP_STORE_SEARCH_RESULTS_ASSET',
};

/** The one image per placement in `dir` (first by name), or none. */
export function collectCreative(dir, pngSize) {
  const out = [];
  for (const [folder, placementType] of Object.entries(CREATIVE_FOLDERS)) {
    const d = path.join(dir, folder);
    if (!fs.existsSync(d)) continue;
    const name = fs.readdirSync(d).filter((f) => f.toLowerCase().endsWith('.png')).sort()[0];
    if (!name) continue;
    const file = path.join(d, name);
    const buf = fs.readFileSync(file);
    out.push({ placementType, name, file, buf, size: buf.length, ...pngSize(buf) });
  }
  return out;
}

const inRange = (v, lo, hi) => (lo == null || v >= lo) && (hi == null || v <= hi);

/** Image specs Apple says can carry this file in this placement. */
export function matchingSpecs(ref, asset) {
  return (ref?.imageSpecs ?? []).filter((s) => {
    const b = s.dimensions ?? s.bounds ?? s;
    const extOk = !s.fileExtensions || s.fileExtensions.map((e) => e.toLowerCase().replace(/^\./, '')).includes('png');
    return (s.compatiblePlacementTypes ?? []).includes(asset.placementType)
      && extOk
      && (!s.maxFileSize || asset.size <= s.maxFileSize)
      && inRange(asset.w, b.minWidth, b.maxWidth) && inRange(asset.h, b.minHeight, b.maxHeight);
  });
}

/** Placement groups of `placementType` whose spec list includes `specId`. */
export function groupsFor(ref, placementType, specId) {
  const type = (ref?.placementTypes ?? []).find((t) => t.placementTypeId === placementType);
  return (type?.specMappings ?? []).filter((m) => (m.specs ?? []).includes(specId)).map((m) => m.placementGroupId);
}

const first = (d) => (Array.isArray(d) ? d[0] : d);

async function uploadImage(client, libraryId, asset, log) {
  const created = await client.post('/v1/appAssetLibraryImages', {
    data: {
      type: 'appAssetLibraryImages',
      attributes: {
        fileName: asset.name,
        fileSize: asset.size,
        category: 'CREATIVE_ASSETS',
        referenceName: asset.name.replace(/\.png$/i, ''),
      },
      relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: libraryId } } },
    },
  });
  const id = created.data.id;
  for (const op of created.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: asset.buf.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload part failed for ${asset.name}: HTTP ${res.status}`);
  }
  await client.patch(`/v1/appAssetLibraryImages/${id}`, { data: { type: 'appAssetLibraryImages', id, attributes: { uploaded: true } } });
  const end = Date.now() + 15 * 60_000;
  for (;;) {
    const img = (await client.get(`/v1/appAssetLibraryImages/${id}`)).data;
    const state = img?.attributes?.state;
    if (state && !['AWAITING_UPLOAD', 'UPLOAD_COMPLETE'].includes(state)) {
      if (/FAIL/i.test(state)) throw new Error(`${asset.name} failed processing: ${JSON.stringify(img.attributes)}`);
      log(`    ${asset.name}: ${state} (spec ${img.attributes.specId ?? '?'})`);
      return img;
    }
    if (Date.now() > end) throw new Error(`${asset.name} still ${state} after 15 min`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

/**
 * Plan prints Apple's reference data and what would be placed where; apply
 * uploads each image and places it on every localization, replacing whatever
 * occupied that placement group. Returns the number of failed placements.
 */
export async function syncCreative({ client, appId, locs, assets, apply, log = console.log }) {
  log(`\nCreative assets: ${assets.map((a) => `${a.placementType} <- ${a.name} (${a.w}x${a.h})`).join(', ')}`);
  const library = first((await client.get(`/v1/apps/${appId}/assetLibrary`)).data);
  const ref = first((await client.get('/v1/appAssetLibraryRefData')).data)?.attributes ?? {};
  log(`  asset library: ${library?.id}`);
  for (const t of ref.placementTypes ?? []) {
    if (!Object.values(CREATIVE_FOLDERS).includes(t.placementTypeId)) continue;
    log(`  placement ${t.placementTypeId}: ${(t.specMappings ?? []).map((m) => `${m.placementGroupId}[${(m.specs ?? []).join('|')}]`).join(', ')}`);
  }
  for (const s of ref.imageSpecs ?? []) {
    if (!(s.compatiblePlacementTypes ?? []).some((p) => Object.values(CREATIVE_FOLDERS).includes(p))) continue;
    log(`  spec ${JSON.stringify(s)}`);
  }

  const plan = assets.map((a) => {
    const specs = matchingSpecs(ref, a);
    const groups = [...new Set(specs.flatMap((s) => groupsFor(ref, a.placementType, s.specId)))];
    log(`  ${a.name}: specs [${specs.map((s) => s.specId).join(', ') || 'NONE'}] -> groups [${groups.join(', ') || 'NONE'}]`);
    return { asset: a, specs, groups };
  });

  for (const loc of locs) {
    try {
      const existing = await client.getAll(`/v1/appStoreVersionLocalizations/${loc.id}/placements?limit=50`);
      const counts = {};
      for (const p of existing) {
        const k = `${p.attributes?.placementType}/${p.attributes?.placementGroup}`;
        counts[k] = (counts[k] ?? 0) + 1;
      }
      log(`  ${loc.attributes.locale}: ${Object.entries(counts).map(([k, n]) => `${k} x${n}`).join(', ') || 'no placements'}`);
    } catch (e) {
      log(`  ${loc.attributes.locale}: could not read placements (${e.message.split('\n')[0]})`);
    }
  }
  if (!apply) return 0;

  let failed = 0;
  for (const { asset, groups: planned } of plan) {
    const img = await uploadImage(client, library.id, asset, log);
    // Apple assigns the spec on processing; trust that over the local match.
    const groups = img.attributes?.specId ? groupsFor(ref, asset.placementType, img.attributes.specId) : planned;
    if (groups.length === 0) {
      log(`  ✖ ${asset.name}: no ${asset.placementType} group accepts spec ${img.attributes?.specId}`);
      failed++;
      continue;
    }
    for (const loc of locs) {
      for (const group of groups) {
        try {
          const existing = (await client.getAll(`/v1/appStoreVersionLocalizations/${loc.id}/placements?limit=50`))
            .filter((p) => p.attributes?.placementType === asset.placementType && p.attributes?.placementGroup === group);
          for (const p of existing) await client.request('DELETE', `/v1/appAssetLibraryPlacements/${p.id}`);
          const placed = await client.post('/v1/appAssetLibraryPlacements', {
            data: {
              type: 'appAssetLibraryPlacements',
              attributes: { placementType: asset.placementType, placementGroup: group },
              relationships: {
                image: { data: { type: 'appAssetLibraryImages', id: img.id } },
                appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } },
              },
            },
          });
          log(`  ✓ ${loc.attributes.locale} ${asset.placementType}/${group}: ${placed?.data?.attributes?.state ?? 'placed'}${existing.length ? ` (replaced ${existing.length})` : ''}`);
        } catch (e) {
          failed++;
          log(`  ✖ ${loc.attributes.locale} ${asset.placementType}/${group}: ${e.message.split('\n').slice(-1)[0].slice(0, 300)}`);
        }
      }
    }
  }
  return failed;
}
