#!/usr/bin/env node
/**
 * Render the creator SCREEN — the real 3D head inside the studio layout.
 *
 *   node scripts/shoot-face-studio.mjs [out.png]
 *
 * ## What is and is not real here
 *
 * REAL: the head. Same GLB, same three.js, same GLTFLoader, same morph targets,
 * same materials, same lighting rig and exposure as
 * `components/identity/gl/FaceRenderer.ts`.
 *
 * NOT REAL: the chrome around it. The panel, sliders and buttons are an HTML
 * restatement of `FaceStudio.tsx`'s layout using its exact spec palette and
 * dimensions. React Native is not running. This shows how the screen READS —
 * proportions, contrast, whether the head sits right in the frame — which is
 * the thing that cannot be checked from an isolated head render or from a unit
 * test. It is not a screenshot of the app, and it cannot catch a React Native
 * layout bug.
 *
 * Anything about touch behaviour, scrolling or frame rate needs a device.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { Buffer } from 'node:buffer';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const PORT = 8932;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary', '.png': 'image/png',
};

/** FaceStudio's spec §2 palette, copied verbatim from the component. */
const C = {
  bg: '#070A10', card: '#121827', frame: '#0B111C',
  text: '#FFFFFF', sub: 'rgba(255,255,255,0.65)', muted: 'rgba(255,255,255,0.38)',
  accent: '#4C8DFF', accentSoft: 'rgba(76,141,255,0.16)', gold: '#FFD76B',
  chip: 'rgba(255,255,255,0.05)',
};

/** Mirrors GROUPS in FaceStudio.tsx. Values are the demo pose, not defaults. */
const GROUPS = [
  { title: 'Facial structure', morphs: [
    ['Jaw width', 0.72], ['Jaw angle', 0.38], ['Chin length', 0.55],
    ['Face width', 0.44], ['Cheekbones', 0.66] ] },
  { title: 'Nose', morphs: [
    ['Length', 0.48], ['Width', 0.34], ['Bridge', 0.62], ['Tip', 0.5] ] },
  { title: 'Eyes', morphs: [
    ['Size', 0.68], ['Spacing', 0.5], ['Depth', 0.42], ['Tilt', 0.58],
    ['Brow height', 0.5] ] },
];

const slider = ([label, v]) => {
  // Bipolar rendering, matching MorphSlider: 0.5 is neutral, the fill grows out
  // from the centre, and the readout is signed.
  const signed = (v - 0.5) * 2;
  const frac = Math.abs(signed) / 2;
  const left = signed >= 0 ? 0.5 : 0.5 - frac;
  const txt = `${signed > 0 ? '+' : ''}${Math.round(signed * 100)}`;
  return `<div class="row">
    <div class="lbl">${label}</div>
    <div class="track">
      <div class="fill" style="left:${left * 100}%;width:${frac * 100}%"></div>
      <div class="tick"></div>
      <div class="thumb" style="left:calc(${v * 100}% - 9px)"></div>
    </div>
    <div class="val">${txt}</div>
  </div>`;
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};width:430px;
       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       padding:18px 16px 26px}
  .dashes{display:flex;gap:5px;margin-bottom:7px}
  .dash{height:3px;width:34px;border-radius:2px;background:#232C3B}
  .dash.on{background:${C.accent}}
  .steptext{font-size:11px;color:${C.muted};margin-bottom:14px}
  h1{font-size:25px;font-weight:800;letter-spacing:-0.4px}
  .sub{font-size:13px;color:${C.sub};margin-top:5px}
  .frame{margin-top:15px;background:${C.frame};border-radius:22px;
         border:1px solid rgba(255,255,255,0.06);height:330px;position:relative;
         overflow:hidden;display:flex;align-items:center;justify-content:center}
  #gl{display:block}
  .actions{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:12px}
  .act{display:flex;flex-direction:column;align-items:center;gap:4px}
  .btn{width:42px;height:42px;border-radius:21px;background:${C.chip};
       border:1px solid rgba(255,255,255,0.09);display:flex;align-items:center;
       justify-content:center;font-size:17px}
  .btn.gold{border-color:rgba(255,215,107,0.5)}
  .btn.on{border-color:${C.accent};background:${C.accentSoft}}
  .btn.off{opacity:0.4}
  .actlbl{font-size:9px;color:${C.muted}}
  .card{margin-top:14px;background:${C.card};border-radius:18px;
        border:1px solid rgba(255,255,255,0.05);padding:14px 14px 6px}
  .cardhead{display:flex;justify-content:space-between;align-items:center;
            font-size:13px;font-weight:700;margin-bottom:11px}
  .chev{color:${C.muted};font-size:11px}
  .row{display:flex;align-items:center;margin-bottom:11px}
  .lbl{width:98px;font-size:12px;color:${C.sub}}
  .track{flex:1;height:30px;position:relative;display:flex;align-items:center}
  .track::before{content:'';position:absolute;left:0;right:0;height:5px;
                 border-radius:3px;background:#1B2331}
  .fill{position:absolute;height:5px;border-radius:3px;background:${C.accent};
        box-shadow:0 0 7px ${C.accent}}
  .tick{position:absolute;left:50%;width:1px;height:11px;
        background:${C.sub};opacity:0.45}
  .thumb{position:absolute;width:18px;height:18px;border-radius:9px;
         background:${C.accent};border:2px solid ${C.bg}}
  .val{width:34px;text-align:right;font-size:12px;font-weight:700;
       color:${C.sub};font-variant-numeric:tabular-nums;margin-left:8px}
  .swatches{display:flex;gap:9px;margin-bottom:12px}
  .sw{width:30px;height:30px;border-radius:15px;border:2px solid transparent}
  .sw.on{border-color:${C.accent}}
  .done{margin-top:18px;background:${C.accent};border-radius:15px;padding:15px;
        text-align:center;font-weight:800;font-size:15px}
</style>
<script type="importmap">
{"imports":{"three":"/node_modules/three/build/three.module.js",
            "three/addons/":"/node_modules/three/examples/jsm/"}}
</script></head><body>
  <div class="dashes"><div class="dash on"></div><div class="dash on"></div><div class="dash"></div></div>
  <div class="steptext">Step 2 of 3</div>
  <h1>Build your face</h1>
  <div class="sub">Create a face that's uniquely yours.</div>
  <div class="frame"><canvas id="gl"></canvas>
    <div class="actions">
      <div class="act"><div class="btn gold">&#9860;</div><div class="actlbl">Randomize</div></div>
      <div class="act"><div class="btn">&#8630;</div><div class="actlbl">Undo</div></div>
      <div class="act"><div class="btn on">&#128065;</div><div class="actlbl">Compare</div></div>
      <div class="act"><div class="btn">&#8635;</div><div class="actlbl">Reset</div></div>
    </div>
  </div>
  <div class="card">
    <div class="cardhead"><span>Skin &amp; colour</span></div>
    <div class="swatches">
      <div class="sw" style="background:#F6D9C6"></div><div class="sw" style="background:#E3B08B"></div>
      <div class="sw on" style="background:#C07E4F"></div><div class="sw" style="background:#8A4F2E"></div>
      <div class="sw" style="background:#4E2A18"></div>
    </div>
  </div>
  ${GROUPS.map((g, i) => `<div class="card">
    <div class="cardhead"><span>${g.title}</span><span class="chev">${i === 0 ? '&#9650;' : '&#9660;'}</span></div>
    ${i === 0 ? g.morphs.map(slider).join('') : ''}
  </div>`).join('')}
  <div class="done">Use this face</div>

<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 398, H = 330;
const canvas = document.getElementById('gl');
canvas.width = W * 2; canvas.height = H * 2;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(W * 2, H * 2, false);
renderer.setClearColor(new THREE.Color('${C.frame}'), 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
camera.position.set(0, 0.05, 6.2);
camera.lookAt(0, -0.02, 0);

const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x101521);
const panel = (c, i, x, y, z, w, h) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1),
    new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }));
  m.material.color.multiplyScalar(i); m.position.set(x, y, z); m.lookAt(0, 0, 0);
  envScene.add(m);
};
panel(0xfff2e2, 3.4, -4, 3, 4, 6, 6);
panel(0xd6e6ff, 1.5, 5, 0, 2, 5, 6);
panel(0xffffff, 2.2, 0, 2, -5, 7, 5);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.04).texture;

const key = new THREE.DirectionalLight(0xfff4e8, 0.85); key.position.set(-2.2, 2.6, 3.4);
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.3); fill.position.set(2.8, -0.4, 2.0);
const rim = new THREE.DirectionalLight(0xffffff, 0.45); rim.position.set(0.6, 1.2, -3.2);
scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.26));

const root = new THREE.Group(); root.position.y = 0.12; scene.add(root);
window.__ok = false;

const gltf = await new GLTFLoader().loadAsync('/assets/models/head_ict.glb');
const parts = {}; const meshes = [];
gltf.scene.traverse((o) => { if (o.isMesh) { meshes.push(o); parts[o.material?.name ?? '?'] = o; } });

const tex = new THREE.TextureLoader();
const load = (p, srgb) => new Promise((r) => tex.load(p, (t) => {
  t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; r(t);
}, undefined, () => r(null)));
const [albedo, roughMap, normalMap] = await Promise.all([
  load('/assets/textures/face_albedo.png', true),
  load('/assets/textures/face_roughness.png', false),
  load('/assets/textures/face_normal.png', false),
]);

parts.skin.material = (() => {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xC07E4F, map: albedo, roughnessMap: roughMap, normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22), roughness: 1, metalness: 0,
    clearcoat: 0.05, clearcoatRoughness: 0.7, envMapIntensity: 0.45,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\\n' +
      'float sss = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\\n' +
      'gl_FragColor.rgb += vec3(0.15, 0.045, 0.022) * sss;');
  };
  return m;
})();
parts.sclera.material = (() => {
  // The pupil is drawn on the SCLERA, not the iris: ICT's iris is an annulus
  // with a hole where the pupil belongs, so a bright sclera showed through it.
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xdedbd6, roughness: 0.18, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.75 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\\nattribute float _irisr;\\nvarying float vR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\\nvR = _irisr;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\\nvarying float vR;')
      .replace('#include <color_fragment>', '#include <color_fragment>\\n' +
        'diffuseColor.rgb = mix(vec3(0.015), diffuseColor.rgb, smoothstep(0.60, 0.74, vR));');
  };
  return m;
})();
parts.iris.material = (() => {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x5b4630, roughness: 0.12, metalness: 0,
    // 0.85, not 2.4: at full strength the environment mirrored as a blown white
    // blob over the whole pupil. A catchlight is a glint, not a headlight.
    clearcoat: 1, clearcoatRoughness: 0.10, envMapIntensity: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\\nattribute float _irisr;\\nvarying float vR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\\nvR = _irisr;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\\nvarying float vR;')
      .replace('#include <color_fragment>', '#include <color_fragment>\\n' +
        'float limbal = 1.0 - smoothstep(0.86, 1.0, vR);\\n' +
        'float fibre = 0.86 + 0.14 * sin(vR * 42.0);\\n' +
        'diffuseColor.rgb *= limbal * fibre;');
  };
  return m;
})();

// Hair, same shader patch as FaceRenderer.
const hairU = { uThickness: { value: 0.2 }, uLow: { value: 0.30 } };
const hairMat = new THREE.MeshStandardMaterial({
  color: 0x2C1B12, roughness: 0.86, metalness: 0, transparent: true, depthWrite: true });
hairMat.onBeforeCompile = (sh) => {
  sh.uniforms.uThickness = hairU.uThickness; sh.uniforms.uLow = hairU.uLow;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\\nattribute float _scalp;\\nvarying float vScalp;\\nuniform float uThickness;\\nuniform float uLow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\\nvScalp = _scalp;\\ntransformed += normalize(objectNormal) * uThickness * smoothstep(uLow, 1.0, _scalp);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\\nvarying float vScalp;\\nuniform float uLow;')
    .replace('#include <color_fragment>', '#include <color_fragment>\\n' +
      'float a = smoothstep(uLow, uLow + 0.16, vScalp);\\n' +
      'diffuseColor.a *= a;\\n' +
      'diffuseColor.rgb *= 0.72 + 0.42 * a;');
};
const hair = new THREE.Mesh(parts.skin.geometry, hairMat);
hair.renderOrder = 1;
parts.skin.parent.add(hair); meshes.push(hair);

const holder = new THREE.Group();
holder.add(gltf.scene);
gltf.scene.updateWorldMatrix(true, true);
const box = new THREE.Box3()
  .setFromBufferAttribute(parts.skin.geometry.getAttribute('position'))
  .applyMatrix4(parts.skin.matrixWorld);
const size = box.getSize(new THREE.Vector3());
const centre = box.getCenter(new THREE.Vector3());
const extent = Math.max(size.x, size.y, size.z);
const s = 2.35 / extent;
holder.scale.setScalar(s);
holder.position.set(-centre.x * s, -centre.y * s + 0.30, -centre.z * s);
root.add(holder);

const gb = parts.skin.geometry.boundingBox;
const geomExtent = Math.max(gb.max.x - gb.min.x, gb.max.y - gb.min.y, gb.max.z - gb.min.z);
hairU.uThickness.value = 0.038 * geomExtent;

window.__pose = (morphs, yaw) => {
  for (const m of meshes) {
    const inf = m.morphTargetInfluences, dict = m.morphTargetDictionary;
    if (!inf || !dict) continue;
    inf.fill(0);
    for (const [k, v] of Object.entries(morphs)) if (dict[k] !== undefined) inf[dict[k]] = v;
  }
  root.rotation.y = yaw ?? 0;
  renderer.render(scene, camera);
};
window.__skin = (hex, hairHex, irisHex) => {
  parts.skin.material.color.set(hex);
  hairMat.color.set(hairHex);
  parts.iris.material.color.set(irisHex);
  renderer.render(scene, camera);
};
// The demo pose, matching the slider values drawn in the panel above.
window.__pose({ jawWidth: 0.44, jawAngle: -0.24, chinLength: 0.10, faceWidth: -0.12,
                cheekboneHeight: 0.32, noseWidth: -0.32, noseBridge: 0.24, eyeSize: 0.36,
                eyeTilt: 0.16 }, 0);
window.__ok = true;
</script></body></html>`;

async function main() {
  const out = process.argv[2] ?? 'face-studio.png';
  for (const f of ['assets/models/head_ict.glb', 'assets/textures/face_albedo.png']) {
    if (!existsSync(f)) {
      console.error(`${f} missing — run npm run ict:build / ict:textures first`);
      process.exit(2);
    }
  }
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
  const page = await browser.newPage({ viewport: { width: 430, height: 1200 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ok, { timeout: 60000 }).catch(() => {});

  const ok = await page.evaluate(() => window.__ok);
  if (!ok) {
    console.error('FAILED:'); for (const e of errors) console.error('  ' + e);
    await browser.close(); server.close(); process.exit(1);
  }

  const variants = process.argv.includes('--variants');
  if (variants) {
    // Four different characters through the same screen, which is the question
    // a single screenshot cannot answer: does the creator hold up across the
    // range, or only for the one face it was tuned on?
    const poses = [
      [{ jawWidth: 0.44, cheekboneHeight: 0.32, noseWidth: -0.32, eyeSize: 0.36 }, '#C07E4F', '#2C1B12', '#5b4630'],
      [{ jawWidth: -0.5, faceWidth: -0.35, noseWidth: -0.2, lipFullness: 0.5, eyeSize: 0.5 }, '#F0C8AA', '#B58A50', '#4a6b8a'],
      [{ jawWidth: 0.7, jawAngle: 0.4, chinProtrusion: 0.4, noseBridge: 0.5, browProtrusion: 0.45 }, '#6B3A21', '#0E0B0A', '#2f2118'],
      [{ faceLength: 0.5, noseLength: 0.4, chinLength: 0.45, eyeSpacing: -0.3, mouthWidth: -0.3 }, '#E3B08B', '#8C3B1E', '#3d6b4a'],
    ];
    const shots = [];
    for (const [pose, skin, hair, iris] of poses) {
      await page.evaluate(([p, s, h, i]) => { window.__skin(s, h, i); window.__pose(p, 0); },
        [pose, skin, hair, iris]);
      shots.push(await page.locator('.frame').screenshot());
    }
    const strip = await page.evaluate(async (imgs) => {
      const c = document.createElement('canvas');
      c.width = 796 * imgs.length; c.height = 660;
      const ctx = c.getContext('2d');
      for (let i = 0; i < imgs.length; i++) {
        const im = new Image();
        await new Promise((r) => { im.onload = r; im.src = imgs[i]; });
        ctx.drawImage(im, i * 796, 0);
      }
      return c.toDataURL('image/png');
    }, shots.map((b) => `data:image/png;base64,${b.toString('base64')}`));
    writeFileSync(out, Buffer.from(strip.split(',')[1], 'base64'));
  } else {
    await page.screenshot({ path: out, fullPage: true });
  }
  console.log(`Wrote ${out}`);
  if (errors.length) { console.error('Console errors:'); for (const e of errors) console.error('  ' + e); }
  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
