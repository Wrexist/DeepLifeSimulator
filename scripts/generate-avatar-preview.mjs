/**
 * Renders the vector avatar catalogs to a PNG contact sheet so the geometry can
 * be reviewed by eye:
 *   node scripts/generate-avatar-preview.mjs
 *
 * The catalogs and palette in `lib/avatar/` are the source of truth and are
 * imported directly (transpiled on the fly), so what you see here is the real
 * authored geometry. The SVG assembly below MIRRORS `components/avatar/
 * VectorAvatar.tsx` — keep the two in step when the draw order changes.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'screenshots');
const TMP = resolve(ROOT, 'node_modules/.cache/avatar-preview');

// ── Transpile lib/avatar to ESM so this plain-JS script can import it ────────
mkdirSync(TMP, { recursive: true });
for (const file of readdirSync(resolve(ROOT, 'lib/avatar')).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(resolve(ROOT, 'lib/avatar', file), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace(/from '\.\/([a-zA-Z]+)'/g, "from './$1.mjs'");
  writeFileSync(resolve(TMP, file.replace(/\.ts$/, '.mjs')), js);
}
const load = (name) => import(pathToFileURL(resolve(TMP, name)).href);

const { FACE_SHAPES, HAIR_STYLES, BROW_SHAPES, EYE_SHAPES, NOSE_SHAPES, MOUTH_SHAPES, FACIAL_HAIR, ACCESSORIES, ANCHORS } =
  await load('features.mjs');
const { SKIN_TONES, HAIR_COLORS, EYE_COLORS, LIP_TINTS, CLOTHING, SCLERA, darken, lighten, greyRamp, lineColorFor } =
  await load('palette.mjs');
const { ageEffects, recessionOffset } = await load('aging.mjs');
const { avatarFromSeed, randomAvatar, normalizeAvatar } = await load('random.mjs');
const { inheritAvatar } = await load('inherit.mjs');
const { pickersFor } = await load('pickers.mjs');

let uidCounter = 0;

/** Mirrors VectorAvatar's draw order. */
function renderAvatar(config, sex, age = 25, px = 120, backdrop = true) {
  const safe = normalizeAvatar(config);
  const fx = ageEffects(age, sex);
  const u = `p${uidCounter++}`;
  const id = (n) => `${n}${u}`;

  const skin = SKIN_TONES[safe.skinTone];
  const hair = greyRamp(HAIR_COLORS[safe.hairColor], fx.greying);
  const iris = EYE_COLORS[safe.eyeColor];
  const lips = LIP_TINTS[safe.skinTone];
  const cloth = CLOTHING[(safe.skinTone + safe.faceShape + safe.hairStyle) % CLOTHING.length];
  const line = lineColorFor(skin);

  const face = FACE_SHAPES[safe.faceShape];
  const hairStyle = HAIR_STYLES[safe.hairStyle];
  const brow = BROW_SHAPES[safe.browShape];
  const eye = EYE_SHAPES[safe.eyeShape];
  const nose = NOSE_SHAPES[safe.noseShape];
  const mouth = MOUTH_SHAPES[safe.mouthShape];
  const beard = sex === 'male' && age >= 16 && safe.facialHair > 0 ? FACIAL_HAIR[safe.facialHair] : null;
  const acc = safe.accessory > 0 ? ACCESSORIES[safe.accessory] : null;

  const rec = recessionOffset(fx, hairStyle.coverage, hairStyle.noRecede);
  const headT = `translate(100 165) scale(${fx.headScale}) translate(-100 -165)`;
  const featT = `translate(100 ${110 + fx.babyness * 11}) scale(${1 - fx.babyness * 0.11}) translate(-100 -110)`;
  const wr = fx.wrinkles * 0.32;

  const eyeGroup = (mirrored) => {
    const t = mirrored ? ' transform="translate(200 0) scale(-1 1)"' : '';
    const clip = mirrored ? id('eyeClipR') : id('eyeClipL');
    const cx = ANCHORS.eyeLeft.x, cy = ANCHORS.eyeLeft.y;
    return `<g${t}>
      <path d="${eye.path}" fill="url(#${id('sclera')})"/>
      <g clip-path="url(#${clip})">
        <circle cx="${cx}" cy="${cy - 0.5}" r="${eye.iris}" fill="url(#${id('iris')})"/>
        <circle cx="${cx}" cy="${cy - 0.5}" r="${eye.iris}" fill="none" stroke="${darken(iris.shadow, 0.4)}" stroke-width="0.9"/>
        <circle cx="${cx}" cy="${cy - 0.5}" r="${eye.iris * 0.45}" fill="#120E14"/>
        <circle cx="${cx - eye.iris * 0.38}" cy="${cy - eye.iris * 0.55}" r="${eye.iris * 0.28}" fill="#fff" opacity="0.9"/>
        <circle cx="${cx + eye.iris * 0.3}" cy="${cy + eye.iris * 0.35}" r="${eye.iris * 0.14}" fill="#fff" opacity="0.35"/>
        <rect x="${cx - 16}" y="${cy - 14}" width="32" height="${10 + eye.lidDrop * 8}" fill="${darken(skin.shadow, 0.3)}" opacity="0.3"/>
      </g>
      <path d="${eye.path}" fill="none" stroke="${line}" stroke-width="${sex === 'female' ? 1.9 : 1.4}" stroke-linecap="round"/>
    </g>`;
  };

  return `<svg width="${px}" height="${px}" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${id('skin')}" cx="35%" cy="26%" r="82%">
      <stop offset="0" stop-color="${skin.light}"/><stop offset="0.45" stop-color="${skin.base}"/><stop offset="1" stop-color="${skin.shadow}"/>
    </radialGradient>
    <linearGradient id="${id('core')}" x1="0.15" y1="0.1" x2="0.95" y2="0.95">
      <stop offset="0.35" stop-color="${skin.shadow}" stop-opacity="0"/><stop offset="1" stop-color="${darken(skin.shadow, 0.28)}" stop-opacity="0.4"/>
    </linearGradient>
    <linearGradient id="${id('rim')}" x1="1" y1="0.9" x2="0.35" y2="0.25">
      <stop offset="0" stop-color="${lighten(skin.light, 0.45)}" stop-opacity="0.85"/><stop offset="0.55" stop-color="${lighten(skin.light, 0.3)}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id('hair')}" x1="0.18" y1="0.05" x2="0.85" y2="0.95">
      <stop offset="0" stop-color="${hair.light}"/><stop offset="0.42" stop-color="${hair.base}"/><stop offset="1" stop-color="${hair.shadow}"/>
    </linearGradient>
    <linearGradient id="${id('hairBack')}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${hair.base}"/><stop offset="1" stop-color="${hair.shadow}"/>
    </linearGradient>
    <linearGradient id="${id('hairCast')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${darken(skin.shadow, 0.35)}" stop-opacity="0.5"/><stop offset="1" stop-color="${darken(skin.shadow, 0.35)}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id('neckCast')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${darken(skin.shadow, 0.45)}" stop-opacity="0.75"/><stop offset="1" stop-color="${darken(skin.shadow, 0.45)}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id('neck')}" x1="0.2" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${skin.base}"/><stop offset="1" stop-color="${skin.shadow}"/>
    </linearGradient>
    <linearGradient id="${id('cloth')}" x1="0.2" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${cloth.light}"/><stop offset="0.45" stop-color="${cloth.base}"/><stop offset="1" stop-color="${cloth.shadow}"/>
    </linearGradient>
    <radialGradient id="${id('iris')}" cx="50%" cy="68%" r="62%">
      <stop offset="0" stop-color="${iris.light}"/><stop offset="0.6" stop-color="${iris.base}"/><stop offset="1" stop-color="${iris.shadow}"/>
    </radialGradient>
    <radialGradient id="${id('sclera')}" cx="42%" cy="30%" r="80%">
      <stop offset="0" stop-color="${SCLERA.light}"/><stop offset="0.65" stop-color="${SCLERA.base}"/><stop offset="1" stop-color="${SCLERA.shadow}"/>
    </radialGradient>
    <linearGradient id="${id('lower')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${lips.base}"/><stop offset="1" stop-color="${lips.light}"/>
    </linearGradient>
    <radialGradient id="${id('backdrop')}" cx="50%" cy="42%" r="62%">
      <stop offset="0" stop-color="#243049"/><stop offset="1" stop-color="#151C2C"/>
    </radialGradient>
    <clipPath id="${id('headClip')}"><path d="${face.path}"/></clipPath>
    <clipPath id="${id('eyeClipL')}"><path d="${eye.path}"/></clipPath>
    <clipPath id="${id('eyeClipR')}"><path d="${eye.path}"/></clipPath>
  </defs>
  ${backdrop ? `<rect x="0" y="0" width="200" height="220" fill="url(#${id('backdrop')})"/>` : ''}
  <g>
    <path d="M100 168 C128 168 152 178 164 196 C170 206 172 214 172 220 L28 220 C28 214 30 206 36 196 C48 178 72 168 100 168 Z" fill="url(#${id('cloth')})"/>
    <path d="M78 170 C86 182 92 188 100 188 C108 188 114 182 122 170 C114 176 108 178 100 178 C92 178 86 176 78 170 Z" fill="${darken(cloth.shadow, 0.35)}" opacity="0.7"/>
    <path d="M83 136 L117 136 C117 152 120 165 129 174 L71 174 C80 165 83 152 83 136 Z" fill="url(#${id('neck')})"/>
    <path d="M83 136 L117 136 L117 162 L83 162 Z" fill="url(#${id('neckCast')})"/>
  </g>
  ${hairStyle.back ? `<g transform="${headT}"><path d="${hairStyle.back}" fill="url(#${id('hairBack')})"/></g>` : ''}
  <g transform="${headT}">
    <ellipse cx="${ANCHORS.earLeft.x}" cy="${ANCHORS.earLeft.y}" rx="6.5" ry="9.5" fill="${skin.base}"/>
    <ellipse cx="${ANCHORS.earLeft.x + 1}" cy="${ANCHORS.earLeft.y}" rx="3.1" ry="4.8" fill="${skin.shadow}" opacity="0.55"/>
    <ellipse cx="${ANCHORS.earRight.x}" cy="${ANCHORS.earRight.y}" rx="6.5" ry="9.5" fill="${skin.shadow}"/>
    <ellipse cx="${ANCHORS.earRight.x - 1}" cy="${ANCHORS.earRight.y}" rx="3.1" ry="4.8" fill="${darken(skin.shadow, 0.2)}" opacity="0.5"/>
    <path d="${face.path}" fill="url(#${id('skin')})"/>
    <g clip-path="url(#${id('headClip')})">
      <rect x="0" y="0" width="200" height="220" fill="url(#${id('core')})"/>
      <rect x="0" y="0" width="200" height="220" fill="url(#${id('rim')})"/>
      ${hairStyle.front ? `<rect x="30" y="${46 + rec}" width="140" height="30" fill="url(#${id('hairCast')})"/>` : ''}
      ${wr > 0.02 ? `<g stroke="${line}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity="${wr}">
        <path d="M74 ${74 + rec} C86 ${70 + rec} 114 ${70 + rec} 126 ${74 + rec}"/>
        <path d="M78 ${81 + rec} C88 ${77 + rec} 112 ${77 + rec} 122 ${81 + rec}"/>
        <path d="M86 116 C82 124 82 132 86 138"/><path d="M114 116 C118 124 118 132 114 138"/>
        <path d="M58 92 L64 94 M58 97 L64 98 M58 102 L64 101" stroke-width="0.9"/>
        <path d="M142 92 L136 94 M142 97 L136 98 M142 102 L136 101" stroke-width="0.9"/>
        <path d="M66 108 C71 112 81 112 86 108" stroke-width="0.9"/>
        <path d="M134 108 C129 112 119 112 114 108" stroke-width="0.9"/>
      </g>` : ''}
      <g transform="${featT}">
        <g fill="${hair.shadow}" opacity="${sex === 'male' ? 0.95 : 0.82}">
          <path d="${brow.path}"/><path d="${brow.path}" transform="translate(200 0) scale(-1 1)"/>
        </g>
        ${eyeGroup(false)}${eyeGroup(true)}
        <path d="${nose.shade}" fill="${darken(skin.shadow, 0.12)}" opacity="0.85"/>
        <path d="${nose.light}" fill="${skin.light}" opacity="0.6"/>
        <path d="${nose.nostrils}" fill="${darken(skin.shadow, 0.45)}" opacity="0.75"/>
        <path d="${mouth.upper}" fill="${lips.shadow}"/>
        <path d="${mouth.lower}" fill="url(#${id('lower')})"/>
        <ellipse cx="100" cy="135" rx="6" ry="1.6" fill="#fff" opacity="0.18"/>
      </g>
      ${beard ? `<path d="${beard.path}" fill="${hair.shadow}" opacity="${beard.opacity}"/>` : ''}
    </g>
    ${hairStyle.front ? `<g${rec ? ` transform="translate(0 ${-rec})"` : ''}>
      <path d="${hairStyle.front}" fill="url(#${id('hair')})"/>
      <path d="M62 58 C74 46 92 42 108 44" fill="none" stroke="${hair.light}" stroke-width="3" stroke-linecap="round" opacity="0.22"/>
    </g>` : ''}
    ${acc ? `<g>
      ${acc.lens ? `<path d="${acc.lens}" fill="#BFD8EA" opacity="0.16"/>` : ''}
      <path d="${acc.path}" fill="none" stroke="#2B3242" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${acc.path}" fill="none" stroke="${lighten('#2B3242', 0.35)}" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/>
    </g>` : ''}
  </g>
</svg>`;
}

const chip = (svg, label) =>
  `<div style="text-align:center"><div style="width:120px;height:120px;border-radius:60px;overflow:hidden;background:#111827">${svg}</div>` +
  `<div style="color:#94A3B8;font:600 10px system-ui;margin-top:6px">${label}</div></div>`;

const section = (title, chips) =>
  `<h2 style="color:#fff;font:800 20px system-ui;margin:32px 0 14px">${title}</h2>` +
  `<div style="display:flex;flex-wrap:wrap;gap:18px">${chips}</div>`;

// ── The sheets ──────────────────────────────────────────────────────────────
const cast = Array.from({ length: 12 }, (_, i) => {
  const sex = i % 2 === 0 ? 'female' : 'male';
  return chip(renderAvatar(avatarFromSeed(`cast-${i}`, sex), sex, 28), `seed ${i}`);
}).join('');

const skins = SKIN_TONES.map((_, i) =>
  chip(renderAvatar({ ...avatarFromSeed('tone', 'female'), skinTone: i }, 'female', 28), `skin ${i}`)
).join('');

const hairs = HAIR_STYLES.map((h, i) =>
  chip(renderAvatar({ ...avatarFromSeed('hair', 'female'), hairStyle: i, hairColor: 3 }, 'female', 28), h.name)
).join('');

const faces = FACE_SHAPES.map((f, i) =>
  chip(renderAvatar({ ...avatarFromSeed('face', 'male'), faceShape: i, hairStyle: 3 }, 'male', 30), f.name)
).join('');

const eyes = EYE_SHAPES.map((e, i) =>
  chip(renderAvatar({ ...avatarFromSeed('eye', 'female'), eyeShape: i, eyeColor: 6 }, 'female', 26), e.name)
).join('');

const beards = FACIAL_HAIR.map((b, i) =>
  chip(renderAvatar({ ...avatarFromSeed('beard', 'male'), facialHair: i, hairStyle: 3 }, 'male', 34), b.name)
).join('');

const glasses = ACCESSORIES.map((a, i) =>
  chip(renderAvatar({ ...avatarFromSeed('acc', 'male'), accessory: i, hairStyle: 4 }, 'male', 30), a.name)
).join('');

// One character, aged. This is the headline claim of the whole system.
const agingCfg = avatarFromSeed('aging-hero', 'male');
const agingF = avatarFromSeed('aging-heroine', 'female');
const ages = [2, 8, 16, 25, 40, 55, 70, 85];
const agingM = ages.map((a) => chip(renderAvatar(agingCfg, 'male', a), `${a}y`)).join('');
const agingFem = ages.map((a) => chip(renderAvatar(agingF, 'female', a), `${a}y`)).join('');

// Inheritance.
const mum = avatarFromSeed('mum', 'female');
const dad = avatarFromSeed('dad', 'male');
const kids = Array.from({ length: 6 }, (_, i) => {
  const s = i % 2 === 0 ? 'female' : 'male';
  return chip(renderAvatar(inheritAvatar(mum, dad, `kid-${i}`, s), s, 10), `child ${i}`);
}).join('');
const family =
  chip(renderAvatar(mum, 'female', 38), 'mother') + chip(renderAvatar(dad, 'male', 40), 'father') + kids;

// Large, uncropped, so the geometry can actually be judged.
const detail = [
  [{ ...avatarFromSeed('cast-3', 'female'), hairStyle: 8 }, 'female', 26],
  [{ ...avatarFromSeed('cast-1', 'male'), hairStyle: 2, facialHair: 0 }, 'male', 30],
  [{ ...avatarFromSeed('cast-5', 'male'), hairStyle: 6, facialHair: 5 }, 'male', 45],
  [{ ...avatarFromSeed('cast-2', 'female'), hairStyle: 7, accessory: 2 }, 'female', 34],
]
  .map(
    ([c, s, a]) =>
      `<div style="width:300px;height:330px;background:#111827;border-radius:12px;overflow:hidden">${renderAvatar(c, s, a, 300)}</div>`
  )
  .join('');

const html = `<html><body style="margin:0;padding:40px;background:#0B1220;font-family:system-ui">
<h1 style="color:#fff;font:800 30px system-ui;margin:0">Vector avatars — 2.5D</h1>
<p style="color:#94A3B8;font:400 14px system-ui;max-width:760px">Authored geometry, gradient-shaded from one upper-left key light, with contact shadows and a rim light. No generated art, no baked backgrounds.</p>
${section('Detail — full frame, 300px', detail)}
${section('The cast — 12 seeded faces', cast)}
${section('Skin range (12)', skins)}
${section('Hair styles (16)', hairs)}
${section('Face shapes (6)', faces)}
${section('Eye shapes (7)', eyes)}
${section('Facial hair (7)', beards)}
${section('Glasses (5)', glasses)}
${section('One man, aged 2 → 85 (same config)', agingM)}
${section('One woman, aged 2 → 85 (same config)', agingFem)}
${section('Inheritance — two parents, six children', family)}
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: resolve(OUT_DIR, 'avatar-vector-preview.png'), fullPage: true });

// A second, tighter sheet of just the large frames — the contact sheet is too
// small to judge geometry on, which cost a review round the first time.
await page.setContent(
  `<html><body style="margin:0;padding:20px;background:#0B1220;display:flex;gap:16px">${detail}</body></html>`
);
await page.screenshot({ path: resolve(OUT_DIR, 'avatar-vector-detail.png'), fullPage: true });

// ── Mock of the rebuilt Create Your Character screen ────────────────────────
// Layout mirrors app/(onboarding)/Customize.tsx so the screen can be reviewed
// without a simulator. Categories and swatches come from lib/avatar/pickers.
const screenCfg = { ...avatarFromSeed('hero-screen', 'female'), hairStyle: 9, hairColor: 4, skinTone: 3 };
const cats = pickersFor('female');
const activeCat = cats[0];

const catChips = cats
  .map((c, i) => {
    const on = i === 0;
    return `<div style="flex:0 0 auto;padding:8px 14px;border-radius:999px;border:1px solid ${on ? 'rgba(96,165,250,0.85)' : 'rgba(255,255,255,0.1)'};background:${on ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'};color:${on ? '#fff' : '#CBD5E1'};font:700 12px system-ui">${c.label}</div>`;
  })
  .join('');

const swatchGrid = activeCat.options
  .map((o, i) => {
    const on = i === screenCfg[activeCat.field];
    return `<div style="width:42px;height:42px;border-radius:21px;border:${on ? '2px solid #60A5FA' : '1px solid rgba(255,255,255,0.18)'};padding:3px;box-sizing:border-box"><div style="width:100%;height:100%;border-radius:18px;background:${o.color}"></div></div>`;
  })
  .join('');

const card = (inner) =>
  `<div style="border-radius:16px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.8));padding:20px;box-shadow:0 8px 16px rgba(0,0,0,0.3)">${inner}</div>`;

const screenHtml = `<div style="width:390px;background:#0B1220;border-radius:38px;padding:14px;font-family:system-ui;border:1px solid #1e293b">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px 14px">
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)"></div>
    <div style="color:#fff;font:800 19px system-ui">Create Your Character</div>
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)"></div>
  </div>
  <div style="display:flex;gap:6px;padding:0 4px 16px">
    <div style="flex:1;height:4px;border-radius:2px;background:#3B82F6"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:#3B82F6"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.12)"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.12)"></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    ${card(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="border-radius:96px;border:1px solid rgba(96,165,250,0.35);padding:5px;background:rgba(15,23,42,0.55)">
        <div style="width:168px;height:168px;border-radius:84px;overflow:hidden">${renderAvatar(screenCfg, 'female', 18, 168)}</div>
      </div>
      <div style="color:#fff;font:800 20px system-ui;margin-top:8px">Maya Okonkwo</div>
      <div style="color:#94A3B8;font:600 11px system-ui">Ages with you · passed to your children</div>
      <div style="display:flex;gap:10px;margin-top:10px">
        <div style="padding:9px 16px;border-radius:999px;background:rgba(59,130,246,0.28);border:1px solid rgba(96,165,250,0.85);color:#fff;font:800 12px system-ui">⚄ Randomize</div>
        <div style="padding:9px 16px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#60A5FA;font:700 12px system-ui">⤫ New name</div>
      </div>
    </div>`)}
    ${card(`<div style="color:#fff;font:800 19px system-ui;margin-bottom:12px">Appearance</div>
      <div style="display:flex;gap:6px;overflow:hidden;margin-bottom:14px">${catChips}</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">${swatchGrid}</div>`)}
    ${card(`<div style="color:#fff;font:800 19px system-ui;margin-bottom:12px">Identity</div>
      <div style="color:#94A3B8;font:600 11px system-ui;margin-bottom:6px">First Name</div>
      <div style="border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);padding:12px;color:#fff;font:600 14px system-ui;margin-bottom:12px">Maya</div>
      <div style="color:#94A3B8;font:700 11px system-ui;letter-spacing:0.4px;margin-bottom:8px">SEX</div>
      <div style="display:flex;gap:10px">
        <div style="flex:1;text-align:center;padding:11px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#CBD5E1;font:700 12px system-ui">Male</div>
        <div style="flex:1;text-align:center;padding:11px;border-radius:999px;background:rgba(59,130,246,0.18);border:1px solid rgba(96,165,250,0.85);color:#fff;font:700 12px system-ui">Female</div>
      </div>`)}
    <div style="margin-top:4px;padding:16px;border-radius:999px;background:linear-gradient(90deg,#3B82F6,#2563EB);color:#fff;font:800 15px system-ui;text-align:center">▶  Continue To Ambitions</div>
  </div>
</div>`;

await page.setContent(
  `<html><body style="margin:0;padding:28px;background:#070C15;display:flex;gap:28px;align-items:flex-start">${screenHtml}</body></html>`
);
await page.screenshot({ path: resolve(OUT_DIR, 'onboarding-customize-v2.png'), fullPage: true });

await browser.close();
console.log('wrote screenshots/avatar-vector-preview.png, avatar-vector-detail.png, onboarding-customize-v2.png');
