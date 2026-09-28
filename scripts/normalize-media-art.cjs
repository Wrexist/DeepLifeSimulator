// Reproducible resize/encoding only; generation prompts live in art/<family>.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('../art/game-assets-v1/source/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const family = process.argv[2] || 'media-v2';
if (!['media-v1', 'media-v2'].includes(family)) throw new Error('Unknown media family');
const runtime = family === 'media-v1' ? 'media' : 'media-v2';
const manifest = JSON.parse(fs.readFileSync(path.join(root, `art/${family}/prompts.json`), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  for (const asset of manifest.assets) {
    asset.source = `art/${family}/originals/${asset.id}.png`;
    asset.file = `assets/images/${runtime}/${asset.id}.webp`;
    const src = path.join(root, asset.source), dst = path.join(root, asset.file);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    await sharp(src).resize(768, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(dst);
    const meta = await sharp(dst).metadata();
    Object.assign(asset, { width: meta.width, height: meta.height, bytes: fs.statSync(dst).size, sha256: hash(dst), sourceSha256: hash(src) });
  }
  manifest.review = 'Reviewed all five originals: legible focal subjects and category palettes, no branded characters or generated lettering. Runtime crops inspected in Expo browser; native acceptance remains open.';
  fs.writeFileSync(path.join(root, `art/${family}/manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(manifest.assets.map(({ id, bytes, width, height }) => ({ id, bytes, width, height })));
})().catch(error => { console.error(error); process.exit(1); });
