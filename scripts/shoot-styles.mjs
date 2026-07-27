#!/usr/bin/env node
/**
 * Contact sheet of every hair and facial-hair style.
 *
 *   node scripts/shoot-styles.mjs out.png [--beards]
 *
 * Both are grown from the SKIN geometry — hair from the baked `_scalp` weight,
 * facial hair from the baked `_beard` weights — so they share the head's buffers
 * and its 21 morph targets and follow the face as the sliders move it.
 *
 * The point of a sheet rather than one render: a style set is only as good as
 * its worst member, and styles that differ only in thickness look like the same
 * haircut at four lengths. Seeing them together is the only way to tell whether
 * "fourteen styles" is really fourteen choices.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { Buffer } from 'node:buffer';
import { chromium } from '@playwright/test';
import { loadTs } from './lib/loadTs.mjs';

const ROOT = process.cwd();
const PORT = 8933;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };

const PAGE = readFileSync(new URL(process.env.HARNESS ?? './styles-harness.html', import.meta.url), 'utf8');

/** Composite the shots into a labelled contact sheet and write it out. */
async function writeSheet(page, shots, cols, W, H, out) {
  const strip = await page.evaluate(async ([imgs, labels, cols, W, H]) => {
    const rows = Math.ceil(imgs.length / cols);
    const c = document.createElement('canvas');
    c.width = W * cols; c.height = H * rows;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0B111C'; ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < imgs.length; i++) {
      const im = new Image();
      await new Promise((r) => { im.onload = r; im.src = imgs[i]; });
      const x = (i % cols) * W, y = Math.floor(i / cols) * H;
      ctx.drawImage(im, x, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(labels[i], x + 16, y + 34);
    }
    return c.toDataURL('image/png');
  }, [shots.map((s) => `data:image/png;base64,${s.png.toString('base64')}`), shots.map((s) => s.name), cols, W, H]);
  writeFileSync(out, Buffer.from(strip.split(',')[1], 'base64'));
  console.log(`\nWrote ${out}`);
}

async function main() {
  const out = process.argv[2] ?? 'styles.png';
  const beards = process.argv.includes('--beards');

  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(PAGE); return; }
    const path = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(ROOT) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  await new Promise((r) => server.listen(PORT, r));

  // VIEW=w,h,rot renders bigger tiles or a different yaw; the defaults are the
  // contact sheet's.
  const [vw, vh, rot, zoom, ty] = (process.env.VIEW ?? '420,480,-0.62,1,-0.02').split(',').map(Number);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const query = new URLSearchParams({
    w: String(vw), h: String(vh), rot: String(rot),
    zoom: String(zoom || 1), ty: String(Number.isFinite(ty) ? ty : -0.02),
  });
  if (process.env.HAIRCOL) query.set('haircol', process.env.HAIRCOL);
  if (process.env.BLEMISH) query.set('blemish', process.env.BLEMISH);
  if (process.env.EYECOL) query.set('eyecol', process.env.EYECOL);
  if (process.env.SKIN) query.set('skin', process.env.SKIN);
  await page.goto(`http://127.0.0.1:${PORT}/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ok, { timeout: 60000 }).catch(() => {});

  if (!(await page.evaluate(() => window.__ok))) {
    console.error('FAILED'); for (const e of errors) console.error('  ' + e);
    await browser.close(); server.close(); process.exit(1);
  }

  if (process.env.HAIR_ONLY) await page.evaluate(() => window.__debugHairOnly(true));
  // ONLY_PART=sclera|iris|skin isolates one primitive.
  if (process.env.ONLY_PART) {
    await page.evaluate((p) => window.__onlyPart(p), process.env.ONLY_PART);
  }

  // SEX=male|female renders n randomised characters of that sex through the
  // app's own randomiser, hair pool and all. `randomizeFace` lists its styles
  // by name, so this is also the check that a newly added style is reachable.
  if (process.env.SEX) {
    const genomeMod = loadTs('lib/identity/faceGenome.ts');
    const bindMod = loadTs('lib/identity/morphBinding.ts');
    const types = loadTs('lib/identity/types.ts');
    const names = await page.evaluate(() => window.__morphNames);
    const binding = bindMod.bindGenomeToRig(names);
    const count = Number(process.env.COUNT ?? 6);
    const shots = [];
    for (let i = 0; i < count; i++) {
      const g = genomeMod.randomizeFace(`${process.env.SEX}-${i}`, { sex: process.env.SEX, spread: 0.6 });
      const { influences } = bindMod.genomeToInfluences(g, binding, { signed: true });
      await page.evaluate((c) => window.__applyCharacter(c), {
        influences,
        hairColor: types.HAIR_COLORS[g.hairColor],
        eyeColor: types.EYE_COLORS[g.eyeColor],
        blemish: g.blemishes,
        hairStyle: g.hairStyle,
        facialHair: g.facialHair,
      });
      shots.push({ name: `${g.hairStyle}`, png: await page.locator('canvas').screenshot() });
    }
    await writeSheet(page, shots, Math.min(6, count), vw, vh, out);
    await browser.close();
    server.close();
    return;
  }

  // AGE=8,25,45,65,85 renders one character across a lifetime, driven by the
  // app's OWN `applyAging`. It rewrites eleven morphs, greys the hair and lifts
  // the hairline, it is numerically tested, and until this switch existed
  // nobody had ever looked at a character at sixty.
  if (process.env.AGE) {
    const genomeMod = loadTs('lib/identity/faceGenome.ts');
    const bindMod = loadTs('lib/identity/morphBinding.ts');
    const types = loadTs('lib/identity/types.ts');
    const names = await page.evaluate(() => window.__morphNames);
    const binding = bindMod.bindGenomeToRig(names);
    const base = genomeMod.randomizeFace(process.env.SEED ?? 'age-sweep', { spread: 0.7 });
    const shots = [];
    for (const age of process.env.AGE.split(',').map(Number)) {
      const aged = genomeMod.applyAging(base, age);
      const { influences } = bindMod.genomeToInfluences(aged, binding, { signed: true });
      await page.evaluate((c) => window.__applyCharacter(c), {
        influences,
        hairColor: types.HAIR_COLORS[aged.hairColor],
        eyeColor: types.EYE_COLORS[aged.eyeColor],
        blemish: aged.blemishes,
        hairStyle: aged.hairStyle,
        facialHair: aged.facialHair,
      });
      shots.push({ name: `age ${age}`, png: await page.locator('canvas').screenshot() });
    }
    await writeSheet(page, shots, Math.min(5, shots.length), vw, vh, out);
    await browser.close();
    server.close();
    return;
  }

  // SWEEP=hex,hex,... renders the same head once per colour. Palettes are
  // where "it looked fine" hides: the default entry is checked constantly and
  // the ends of the range almost never.
  if (process.env.SWEEP) {
    const colours = process.env.SWEEP.split(',');
    const kind = process.env.SWEEP_KIND ?? 'skin';
    const shots = [];
    for (const hex of colours) {
      await page.evaluate(([k, c]) => {
        if (k === 'skin') window.__setSkin(c);
        else if (k === 'eye') window.__setEyeColor(c);
        else window.__setHairColor(c);
      }, [kind, hex]);
      shots.push({ name: hex, png: await page.locator('canvas').screenshot() });
    }
    await writeSheet(page, shots, Math.min(5, colours.length), vw, vh, out);
    await browser.close();
    server.close();
    return;
  }

  // RANDOM=n renders n randomised faces. The randomiser spans 24 axes and
  // "still looks like a person" is not a property any assertion can check — the
  // basis guarantees every face is ON the manifold, not that every corner of it
  // is one you would want to be handed.
  if (process.env.RANDOM) {
    const count = Number(process.env.RANDOM) || 8;
    const spread = Number(process.env.SPREAD ?? 1);
    const shots = [];
    for (let i = 0; i < count; i++) {
      await page.evaluate(([seed, sp]) => window.__randomFace(seed, sp), [i, spread]);
      shots.push({ name: `#${i}`, png: await page.locator('canvas').screenshot() });
    }
    await writeSheet(page, shots, Math.min(4, count), vw, vh, out);
    await browser.close();
    server.close();
    return;
  }

  // MORPH=name renders that morph at -1 / 0 / +1 instead of the style sheet.
  // Numbers say a derived axis moved its own measurement; only a picture says it
  // moved the right part of the face, which is the whole reason this exists.
  if (process.env.MORPH) {
    const morphs = process.env.MORPH.split(',');
    const shots = [];
    for (const m of morphs) {
      for (const v of [-1, 0, 1]) {
        await page.evaluate(([n, val]) => window.__setMorph(n, val), [m, v]);
        shots.push({ name: `${m} ${v > 0 ? '+1' : v < 0 ? '-1' : '0'}`, png: await page.locator('canvas').screenshot() });
      }
    }
    await writeSheet(page, shots, 3, vw, vh, out);
    if (errors.length) { console.error('Console errors:'); for (const e of errors) console.error('  ' + e); }
    await browser.close();
    server.close();
    return;
  }

  let names = await page.evaluate((b) => (b ? window.__beardNames : window.__hairNames), beards);
  // ONLY=a,b,c narrows the sheet to the styles under investigation.
  if (process.env.ONLY) {
    const want = new Set(process.env.ONLY.split(','));
    names = names.filter((n) => want.has(n));
  }
  console.log(`${names.length} ${beards ? 'facial-hair' : 'hair'} styles`);

  const shots = [];
  for (const name of names) {
    await page.evaluate(([n, b]) => (b ? window.__setBeard(n) : window.__setHair(n)), [name, beards]);
    shots.push({ name, png: await page.locator('canvas').screenshot() });
    console.log(`  ${name}`);
  }

  await writeSheet(page, shots, Math.min(5, names.length), vw, vh, out);
  if (errors.length) { console.error('Console errors:'); for (const e of errors) console.error('  ' + e); }
  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
