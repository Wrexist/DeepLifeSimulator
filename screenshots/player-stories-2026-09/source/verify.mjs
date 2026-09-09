/** Validate deliverables, source provenance and render freshness. */
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(root,'../..');
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'anchor.js') : join(root,'../appstore-2026/source/build.mjs'));
const sharp=require('sharp');
const frames=JSON.parse(readFileSync(join(root,'source/storyboard.json')));
const manifest=JSON.parse(readFileSync(join(root,'source/manifest.json')));
const hash=data=>createHash('sha256').update(data).digest('hex');
const sizes={'iphone-6.9':[1320,2868],'iphone-6.5':[1284,2778],'ipad-13':[2064,2752]};
assert.equal(frames.length,10);
assert.equal(new Set(frames.map(f=>f.id)).size,10);
assert.equal(manifest.length,30);
assert.equal(new Set(manifest.map(m=>m.file)).size,30);
const fingerprints=new Set();
for(const [device,dimensions] of Object.entries(sizes)){
  const files=readdirSync(join(root,device)).filter(f=>f.endsWith('.png')).sort();
  assert.deepEqual(files,frames.map(f=>f.id+'.png').sort());
  for(const f of frames){
    const file=device+'/'+f.id+'.png';
    const record=manifest.find(m=>m.file===file);
    assert.ok(record,`Missing manifest record: ${file}`);
    assert.equal(record.headline,f.title.join(' '));
    assert.equal(record.frameSha256,hash(JSON.stringify(f)),`Stale storyboard: ${file}`);
    const bytes=readFileSync(join(root,file));
    const md=await sharp(bytes).metadata();
    assert.deepEqual([md.width,md.height],dimensions,file);
    assert.equal(md.format,'png');assert.equal(md.channels,3);assert.equal(md.hasAlpha,false);
    await sharp(bytes,{failOn:'warning'}).raw().toBuffer();
    const digest=hash(bytes);assert.equal(digest,record.pngSha256,file);
    assert.ok(!fingerprints.has(digest),`Duplicate image: ${file}`);fingerprints.add(digest);
    assert.equal(hash(readFileSync(join(repo,record.art))),record.artSha256,`Stale art: ${file}`);
    for(const capture of record.captures) assert.equal(hash(readFileSync(join(repo,capture.file))),capture.sha256,`Stale capture: ${file}`);
  }
}
console.log('PASS: 30 unique RGB PNGs, 10 per size, fully decoded; dimensions, source hashes and storyboard freshness verified.');
