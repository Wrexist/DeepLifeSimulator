#!/usr/bin/env node
/**
 * Screenshot the head as three.js actually renders it.
 *
 *   node scripts/shoot-face-canvas.mjs [out.png]
 *
 * ## Why this and not the software rasteriser
 *
 * `preview-ict-head.mjs` proves the GEOMETRY is right — it reads the GLB with
 * gltf-transform and draws flat-shaded triangles. It says nothing about the
 * things that actually decide whether the creator looks premium: whether
 * three's GLTFLoader can parse our quantized + sparse-encoded morph targets at
 * all, whether `morphTargetInfluences` drives them, and how the face reads
 * under the app's real studio environment, ACES tone mapping and exposure.
 *
 * Those are exactly the properties that a unit test cannot express and that
 * were wrong last time: an earlier luxury asset framed on the origin and
 * rendered cropped, and the first face render at exposure 1.1 crushed deep skin
 * tones to black. Both were found by looking at a real render.
 *
 * So this runs the REAL three.js, the REAL GLB and the same lighting rig as
 * `components/identity/gl/FaceRenderer.ts`, in headless Chromium, and writes a
 * PNG. It is not the phone — expo-gl is a different GL implementation — but it
 * is the same renderer, loader and material graph, which is where the
 * interesting failures live.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { Buffer } from 'node:buffer';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const PORT = 8931;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#0F172A}canvas{display:block}</style>
<script type="importmap">
{"imports":{
  "three":"/node_modules/three/build/three.module.js",
  "three/addons/":"/node_modules/three/examples/jsm/"
}}
</script></head><body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 520, H = 660;
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(W, H, false);
renderer.setClearColor(new THREE.Color('#0F172A'), 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Matches FaceRenderer's SCANNED-head value. The procedural head needed 1.45 to
// keep deep skin tones off black; this mesh has real normals, catches far more
// light, and blows out at that setting.
renderer.toneMappingExposure = 0.8;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
camera.position.set(0, 0.05, 6.2);
camera.lookAt(0, -0.02, 0);

// Stand-in for createStudioEnvironment: emissive boxes through PMREM. Same
// idea, same purpose — skin is a dielectric with a real specular sheen and
// without something to reflect it renders matte and plastic.
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x101521);
const panel = (c, i, x, y, z, w, h) => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.1),
    new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }),
  );
  m.material.color.multiplyScalar(i);
  m.position.set(x, y, z);
  m.lookAt(0, 0, 0);
  envScene.add(m);
};
panel(0xfff2e2, 3.4, -4, 3, 4, 6, 6);
panel(0xd6e6ff, 1.5, 5, 0, 2, 5, 6);
panel(0xffffff, 2.2, 0, 2, -5, 7, 5);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(envScene, 0.04).texture;

const key = new THREE.DirectionalLight(0xfff4e8, 0.85); key.position.set(-2.2, 2.6, 3.4);
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.3); fill.position.set(2.8, -0.4, 2.0);
const rim = new THREE.DirectionalLight(0xffffff, 0.45); rim.position.set(0.6, 1.2, -3.2);
scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.26));

const root = new THREE.Group();
root.position.y = 0.12;
scene.add(root);

window.__result = { ok: false };

const gltf = await new GLTFLoader().loadAsync('/assets/models/head_ict.glb');

// The head is one glTF mesh with three primitives, so GLTFLoader hands back
// three Meshes. Keyed by material name — the build script's contract.
const parts = {};
const allMeshes = [];
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  allMeshes.push(o);
  parts[o.material?.name ?? '?'] = o;
});
let mesh = parts.skin ?? allMeshes[0];
if (!mesh) { window.__result = { ok: false, error: 'no mesh' }; throw new Error('no mesh'); }

const tex = new THREE.TextureLoader();
const load = (p, srgb) => new Promise((res) => tex.load(p, (t) => {
  t.flipY = false;                   // glTF UV convention, opposite to three's default
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  res(t);
}, undefined, () => res(null)));

const [albedo, roughMap, normalMap] = await Promise.all([
  load('/assets/textures/face_albedo.png', true),
  load('/assets/textures/face_roughness.png', false),
  load('/assets/textures/face_normal.png', false),
]);

if (parts.skin) {
  parts.skin.material = new THREE.MeshPhysicalMaterial({
    color: 0xd8a887,
    map: albedo,                     // near-neutral detail; colour multiplies through
    roughnessMap: roughMap,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 1, metalness: 0,      // roughness 1 so the MAP is the value, not a scale-down
    clearcoat: 0.05, clearcoatRoughness: 0.7,
    envMapIntensity: 0.45,
  });
}
// Eyes. The wet specular is the cheapest large win in a portrait: a sclera at
// skin roughness has no catchlight and the face reads dead, however good the
// geometry underneath it is.
if (parts.sclera) {
  parts.sclera.material = new THREE.MeshPhysicalMaterial({
    color: 0xe9e7e4, roughness: 0.14, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6,
  });
}
if (parts.iris) {
  parts.iris.material = new THREE.MeshPhysicalMaterial({
    color: 0x4a6b8a, roughness: 0.08, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4,
  });
}

// Hair: a second mesh over the SAME geometry, grown outward along the normal by
// the baked _scalp weight. Sharing the buffer means it inherits all 21 morph
// targets automatically and follows the face as the sliders move it.
const hairUniforms = {
  uThickness: { value: 0.55 },
  uLow: { value: 0.30 },
  uColor: { value: new THREE.Color(0x2c1b12) },
};
let hairMesh = null;
if (parts.skin && parts.skin.geometry.getAttribute('_scalp')) {
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x2c1b12, roughness: 0.86, metalness: 0,
    transparent: true, depthWrite: true,
  });
  hairMat.onBeforeCompile = (sh) => {
    sh.uniforms.uThickness = hairUniforms.uThickness;
    sh.uniforms.uLow = hairUniforms.uLow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\\nattribute float _scalp;\\nvarying float vScalp;\\nuniform float uThickness;\\nuniform float uLow;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\\nvScalp = _scalp;\\ntransformed += normalize(objectNormal) * uThickness * smoothstep(uLow, 1.0, _scalp);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\\nvarying float vScalp;\\nuniform float uLow;')
      .replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\\n' +
        // Discard the bare fringe outright so it never darkens the skin beneath;
        // fade the rest so the hairline is soft rather than a hard cap edge.
        'if (vScalp < uLow) discard;\\ngl_FragColor.a *= smoothstep(uLow, uLow + 0.22, vScalp);');
  };
  hairMesh = new THREE.Mesh(parts.skin.geometry, hairMat);
  parts.skin.parent.add(hairMesh);
  allMeshes.push(hairMesh);
}
// Thickness arrives as a FRACTION of head size, never an absolute distance.
// The geometry sits in KHR_mesh_quantization's local space (extent ~3.6, not
// the model's 36), so absolute values were ~15% of the head: the shell tore
// into spikes as adjacent vertices with diverging normals were pushed apart.
const geomExtent = (() => {
  parts.skin.geometry.computeBoundingBox();
  const b = parts.skin.geometry.boundingBox;
  return Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) || 1;
})();
window.__setHair = (o) => {
  if (!hairMesh) return false;
  hairMesh.visible = o.style !== 'bald';
  hairUniforms.uThickness.value = (o.frac ?? 0.05) * geomExtent;
  hairUniforms.uLow.value = o.low ?? 0.30;
  if (o.color) hairMesh.material.color.set(o.color);
  renderer.render(scene, camera);
  return true;
};

// WORLD-space box via setFromObject, not geometry.boundingBox.
//
// KHR_mesh_quantization stores positions as integers and compensates with a
// scale on the NODE. Reading the geometry box gives the pre-compensation
// numbers (3.63 units rather than 33.81) and setting mesh.scale on top of the
// node's scale applies both — the head came out a fraction of its intended
// size, sitting tiny in the middle of the frame.
const holder = new THREE.Group();
holder.add(gltf.scene);
// Frame on the SKIN, not the whole scene. The hair shell stands off the scalp,
// so including it expanded the box and shrank the head in frame — and it would
// shrink further for longer styles, making the framing depend on the haircut.
// Framed from the NEUTRAL position attribute, not setFromObject.
//
// Box3.setFromObject expands the box to cover every morph target at full
// influence, so the frame was sized for the most extreme face the rig can
// reach (61 units against the neutral head's 36) and every character rendered
// small and off-centre to leave room for a face nobody had chosen.
gltf.scene.updateWorldMatrix(true, true);
const framedOn = parts.skin ?? allMeshes[0];
const box = new THREE.Box3()
  .setFromBufferAttribute(framedOn.geometry.getAttribute('position'))
  .applyMatrix4(framedOn.matrixWorld);
const size = box.getSize(new THREE.Vector3());
const centre = box.getCenter(new THREE.Vector3());
const extent = Math.max(size.x, size.y, size.z);
const scale = 2.35 / extent;
holder.scale.setScalar(scale);
holder.position.set(-centre.x * scale, -centre.y * scale + 0.30, -centre.z * scale);
root.add(holder);

const dict = mesh.morphTargetDictionary || {};
const names = [];
for (const [n, i] of Object.entries(dict)) names[i] = n;

window.__apply = (morphName, value) => {
  // Every primitive carries the full morph set, and all of them must be driven.
  // Driving only the skin would widen the face and leave the eyeballs behind.
  for (const m of allMeshes) {
    const inf = m.morphTargetInfluences;
    if (!inf) continue;
    inf.fill(0);
    if (morphName) {
      const i = (m.morphTargetDictionary || {})[morphName];
      if (i !== undefined) inf[i] = value;
    }
  }
  renderer.render(scene, camera);
  return true;
};
window.__setYaw = (y) => { root.rotation.y = y; renderer.render(scene, camera); };
// Lighting sweep seam. The intensities were tuned against the procedural head;
// a scan-derived mesh has real normals and catches far more light, so they have
// to be re-derived by looking rather than carried over.
window.__setMaps = (o) => {
  const m = parts.skin.material;
  m.map = o.albedo ? albedo : null;
  m.roughnessMap = o.rough ? roughMap : null;
  m.normalMap = o.normal ? normalMap : null;
  m.roughness = o.rough ? 1 : 0.72;
  m.needsUpdate = true;
  renderer.render(scene, camera);
};
window.__setLighting = (o) => {
  if (o.exposure !== undefined) renderer.toneMappingExposure = o.exposure;
  if (o.key !== undefined) key.intensity = o.key;
  if (o.fill !== undefined) fill.intensity = o.fill;
  if (o.rim !== undefined) rim.intensity = o.rim;
  if (o.env !== undefined) mesh.material.envMapIntensity = o.env;
  if (o.normalScale !== undefined && mesh.material.normalScale) mesh.material.normalScale.setScalar(o.normalScale);
  if (o.roughness !== undefined) mesh.material.roughness = o.roughness;
  if (o.color !== undefined) mesh.material.color.set(o.color);
  renderer.render(scene, camera);
};

renderer.render(scene, camera);
window.__result = {
  ok: true,
  morphCount: mesh.morphTargetInfluences ? mesh.morphTargetInfluences.length : 0,
  names,
  verts: allMeshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0),
  parts: Object.keys(parts),
  textures: { albedo: !!albedo, rough: !!roughMap, normal: !!normalMap },
  extent,
};
</script></body></html>`;

async function main() {
  const out = process.argv[2] ?? 'face-canvas.png';
  if (!existsSync('assets/models/head_ict.glb')) {
    console.error('assets/models/head_ict.glb not found — run npm run ict:build first');
    process.exit(2);
  }

  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
      return;
    }
    // Confine to the repo: this serves node_modules, so a traversal would hand
    // out arbitrary files from the machine.
    const path = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(ROOT) || !existsSync(path)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 520, height: 660 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__result && window.__result.ok, { timeout: 60000 }).catch(() => {});
  const result = await page.evaluate(() => window.__result);

  if (!result?.ok) {
    console.error('FAILED to render.');
    for (const e of errors) console.error('  ' + e);
    console.error('  result:', JSON.stringify(result));
    await browser.close();
    server.close();
    process.exit(1);
  }

  console.log(`\nthree.js loaded the head: ${result.verts} verts, ${result.morphCount} morph targets`);
  console.log(`  extent ${result.extent.toFixed(2)} units`);
  console.log(`  primitives by material name: ${JSON.stringify(result.parts)}`);
  console.log(`  textures: ${JSON.stringify(result.textures)}`);
  console.log(`  morphs: ${result.names.join(', ')}\n`);

  // `--sweep` renders one lighting variant per cell instead of one morph per
  // cell, which is how the exposure gets chosen by looking rather than guessed.
  const sweep = process.argv.includes('--sweep');
  const tones = process.argv.includes('--tones');
  const maps = process.argv.includes('--maps');
  const signed = process.argv.includes('--signed');
  const hair = process.argv.includes('--hair');
  const TUNED = { exposure: 0.8, key: 0.85, fill: 0.3, rim: 0.45, env: 0.45 };
  const shots = hair
    ? [
        ['bald', { style: 'bald' }],
        ['buzz', { style: 'buzz', frac: 0.035, low: 0.34, color: '#2c1b12' }],
        ['short', { style: 'short', frac: 0.055, low: 0.30, color: '#4A2E1C' }],
        ['medium', { style: 'medium', frac: 0.080, low: 0.24, color: '#0E0B0A' }],
      ]
    : signed
    ? [
        ['jawWidth -1', ['jawWidth', -1]],
        ['jawWidth 0', ['jawWidth', 0]],
        ['jawWidth +1', ['jawWidth', 1]],
        ['noseWidth -1', ['noseWidth', -1]],
      ]
    : maps
    ? [
        ['no maps', { albedo: false, rough: false, normal: false }],
        ['albedo only', { albedo: true, rough: false, normal: false }],
        ['+ roughness', { albedo: true, rough: true, normal: false }],
        ['+ normal', { albedo: true, rough: true, normal: true }],
      ]
    : tones
    ? [
        // The palette's extremes at the chosen exposure. Lowering exposure is
        // exactly what crushed deep tones to black on the procedural head, so
        // the darkest swatch is the one that decides whether 0.8 is shippable.
        ['#F6D9C6 lightest', { ...TUNED, color: '#F6D9C6' }],
        ['#C07E4F mid', { ...TUNED, color: '#C07E4F' }],
        ['#6B3A21 deep', { ...TUNED, color: '#6B3A21' }],
        ['#3A1F12 darkest', { ...TUNED, color: '#3A1F12' }],
      ]
    : sweep
    ? [
        ['exp1.45 key1.7 (current)', { exposure: 1.45, key: 1.7, fill: 0.6, rim: 0.65, env: 0.7 }],
        ['exp1.0 key1.1', { exposure: 1.0, key: 1.1, fill: 0.4, rim: 0.5, env: 0.55 }],
        ['exp0.8 key0.85', { exposure: 0.8, key: 0.85, fill: 0.3, rim: 0.45, env: 0.45 }],
        ['exp0.65 key0.7', { exposure: 0.65, key: 0.7, fill: 0.25, rim: 0.4, env: 0.4 }],
      ]
    : [
        ['neutral', null],
        ['jawWidth', 'jawWidth'],
        ['noseWidth', 'noseWidth'],
        ['eyeSize', 'eyeSize'],
      ];

  const buffers = [];
  for (const [label, arg] of shots) {
    if (hair) await page.evaluate((o) => window.__setHair(o), arg);
    else if (signed) await page.evaluate(([m, v]) => window.__apply(m, v), arg);
    else if (maps) await page.evaluate((o) => window.__setMaps(o), arg);
    else if (sweep || tones) await page.evaluate((o) => window.__setLighting(o), arg);
    else await page.evaluate((m) => { window.__apply(m, 1); window.__setYaw(0); }, arg);
    buffers.push({ label, png: await page.locator('canvas').screenshot() });
    console.log(`  shot ${label}`);
  }

  // Single strip so the four are directly comparable rather than four files.
  const strip = await page.evaluate(async (imgs) => {
    const c = document.createElement('canvas');
    c.width = 520 * imgs.length; c.height = 660;
    const ctx = c.getContext('2d');
    for (let i = 0; i < imgs.length; i++) {
      const im = new Image();
      await new Promise((r) => { im.onload = r; im.src = imgs[i]; });
      ctx.drawImage(im, i * 520, 0);
    }
    return c.toDataURL('image/png');
  }, buffers.map((b) => `data:image/png;base64,${b.png.toString('base64')}`));

  writeFileSync(out, Buffer.from(strip.split(',')[1], 'base64'));
  console.log(`\nWrote ${out}  (${shots.map((s) => s[0]).join(" | ")})\n`);

  if (errors.length) {
    console.error('Console errors during render:');
    for (const e of errors) console.error('  ' + e);
  }

  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
