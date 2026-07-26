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

const ROOT = process.cwd();
const PORT = 8933;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };

const PAGE = readFileSync(new URL(process.env.HARNESS ?? './styles-harness.html', import.meta.url), 'utf8');

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

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 480 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ok, { timeout: 60000 }).catch(() => {});

  if (!(await page.evaluate(() => window.__ok))) {
    console.error('FAILED'); for (const e of errors) console.error('  ' + e);
    await browser.close(); server.close(); process.exit(1);
  }

  const names = await page.evaluate((b) => (b ? window.__beardNames : window.__hairNames), beards);
  console.log(`${names.length} ${beards ? 'facial-hair' : 'hair'} styles`);

  if (process.env.HAIR_ONLY) await page.evaluate(() => window.__debugHairOnly(true));
  const shots = [];
  for (const name of names) {
    await page.evaluate(([n, b]) => (b ? window.__setBeard(n) : window.__setHair(n)), [name, beards]);
    shots.push({ name, png: await page.locator('canvas').screenshot() });
    console.log(`  ${name}`);
  }

  const cols = beards ? 5 : 5;
  const strip = await page.evaluate(async ([imgs, labels, cols]) => {
    const W = 420, H = 480;
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
  }, [shots.map((s) => `data:image/png;base64,${s.png.toString('base64')}`), shots.map((s) => s.name), cols]);

  writeFileSync(out, Buffer.from(strip.split(',')[1], 'base64'));
  console.log(`\nWrote ${out}`);
  if (errors.length) { console.error('Console errors:'); for (const e of errors) console.error('  ' + e); }
  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
