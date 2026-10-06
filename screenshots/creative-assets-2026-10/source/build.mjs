// App Store creative assets (iOS 27 product page): Header + Search Results.
// Renders HTML in Chromium, then flattens to RGB PNG (Apple rejects alpha).
//   node screenshots/creative-assets-2026-10/source/build.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const globalRoot = execFileSync('npm', ['root', '-g']).toString().trim();
const { chromium } = require(path.join(globalRoot, 'playwright'));

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const out = path.resolve(here, '..');
// setContent pages are about:blank and cannot read file:// URLs — inline everything.
const url = (p) => {
  const ext = path.extname(p).slice(1);
  const mime = ext === 'ttf' ? 'font/ttf' : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(path.join(root, p)).toString('base64')}`;
};
const cap = (n) => url(`screenshots/appstore-2026/rich-captures/${n}.png`);
const font = (w) => url(`screenshots/appstore-2026/source/assets/DLS${w}.ttf`);

// Palette from lib/config/theme.ts and the player-stories screenshot set.
const css = `
@font-face { font-family: DLS; font-weight: 800; src: url('${font(800)}'); }
@font-face { font-family: DLS; font-weight: 500; src: url('${font(500)}'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: var(--w); height: var(--h); overflow: hidden; background: #070C17; }
body { font-family: DLS, sans-serif; color: #fff; position: relative; }
.ground { position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 42% 60% at 50% 38%, rgba(22,139,255,.30), transparent 70%),
    radial-gradient(ellipse 70% 80% at 50% 110%, rgba(8,100,200,.35), transparent 70%),
    linear-gradient(180deg, #0B1428 0%, #070C17 100%); }
.headline { position: absolute; left: 0; right: 0; text-align: center; font-weight: 800; }
.headline span { display: block; }
.headline .accent { color: #62B4FF; }
.sub { position: absolute; left: 0; right: 0; text-align: center; font-weight: 500; color: #B7C3D9; }
.row { position: absolute; left: 50%; display: flex; align-items: flex-start; transform: translateX(-50%); }
.phone { flex: none; background: #1A2233; border-radius: var(--r); padding: var(--b);
  box-shadow: 0 40px 120px rgba(0,0,0,.55), 0 0 0 3px rgba(255,255,255,.08) inset; }
.phone img { display: block; width: 100%; border-radius: calc(var(--r) - var(--b)); }
.fade { position: absolute; left: 0; right: 0; bottom: 0;
  background: linear-gradient(180deg, rgba(7,12,23,0) 0%, #070C17 92%); }
.tags { position: absolute; left: 0; right: 0; display: flex; justify-content: center; }
.tag { font-weight: 500; color: #E6ECF7; border: 3px solid rgba(98,180,255,.35);
  background: rgba(22,139,255,.12); border-radius: 999px; }
`;

const phone = (n, w) => `<div class="phone" style="width:${w}px"><img src="${cap(n)}"></div>`;

function header() {
  // 21:9. Key content stays inside the centre ~2000px so a narrower crop on
  // iPhone keeps the whole headline; the lower band fades out because the
  // system draws the app name / Get button over the bottom of the header.
  const W = 3840, H = 1646, pw = 600;
  const shots = ['33-x-realestate-portfolio', '17-x-company', '27-home-final', '34-x-garage-owned', '24-x-travel'];
  return { W, H, html: `
  <div class="ground"></div>
  <div class="row" style="top:640px; gap:120px; --r:84px; --b:18px">
    ${shots.map((s, i) => `<div style="opacity:${i === 2 ? 1 : i === 1 || i === 3 ? .9 : .6}; margin-top:${[220, 90, 0, 90, 220][i]}px">${phone(s, pw)}</div>`).join('')}
  </div>
  <div class="fade" style="height:420px"></div>
  <div class="headline" style="top:150px; font-size:200px; line-height:1; letter-spacing:-2px">
    <span>Small start. <span class="accent" style="display:inline">Big life.</span></span>
  </div>
  <div class="sub" style="top:410px; font-size:76px">Build a career, a fortune and a family — one week at a time.</div>
  ` };
}

function search() {
  // 3:2. Read at thumbnail size in search results, so: one short headline,
  // big type, three straight-on gameplay screens that say what the game is.
  const W = 3840, H = 2560, pw = 860;
  const shots = ['17-x-company', '27-home-final', '34-x-garage-owned'];
  const tags = ['Career', 'Wealth', 'Family', 'Property'];
  return { W, H, html: `
  <div class="ground"></div>
  <div class="headline" style="top:170px; font-size:250px; line-height:1.02; letter-spacing:-3px">
    <span>Live your life.</span><span class="accent">Your way.</span>
  </div>
  <div class="tags" style="top:740px; gap:36px">
    ${tags.map((t) => `<div class="tag" style="font-size:68px; padding:22px 60px">${t}</div>`).join('')}
  </div>
  <div class="row" style="top:1010px; gap:150px; --r:118px; --b:24px">
    ${shots.map((s, i) => `<div style="margin-top:${i === 1 ? 0 : 110}px">${phone(s, pw)}</div>`).join('')}
  </div>
  <div class="fade" style="height:520px"></div>
  ` };
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(() => chromium.launch());
for (const [name, build] of [['header-3840x1646', header], ['search-results-3840x2560', search]]) {
  const { W, H, html } = build();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html style="--w:${W}px;--h:${H}px"><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const tmp = path.join(out, `.${name}.png`);
  await page.screenshot({ path: tmp, type: 'png' });
  await page.close();
  // Flatten to 8-bit RGB with no alpha channel.
  execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],optimize=True)', tmp, path.join(out, `${name}.png`)]);
  fs.unlinkSync(tmp);
  console.log('wrote', `${name}.png`);
}
await browser.close();
