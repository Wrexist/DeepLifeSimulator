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
  // The hair table comes from the app, not from the page. It used to be a
  // literal in the harness — a third copy of numbers that also live in the
  // renderer and in the procedural head — which meant this sheet certified the
  // harness's opinion of a haircut rather than the app's.
  await page.addInitScript(
    (spec) => { window.__HAIR_SPEC = spec; },
    loadTs('lib/identity/hairSpec.ts').HAIR_SPEC,
  );
  // Childhood proportions: the GLSL and the pivot fraction, from the app and
  // from the bake. The page keeps no copy of either — see the note in the
  // harness, and `lib/identity/faceProportions.ts`.
  const child = loadTs('lib/identity/faceProportions.ts');
  const statsFrame = JSON.parse(readFileSync('assets/models/face-measure-stats.json', 'utf8')).frame;
  await page.addInitScript(
    (c) => {
      window.__CHILD_GLSL = c.glsl;
      window.__BODY_GLSL = c.body;
      window.__CHILD_UNIFORMS = c.uniforms;
      window.__BROW_FRAC = c.browFrac;
      window.__CHIN_FRAC = c.chinFrac;
    },
    {
      glsl: child.CHILD_PROPORTION_GLSL,
      body: child.BODY_PROPORTION_GLSL,
      uniforms: child.CHILD_PROPORTION_UNIFORMS,
      browFrac: statsFrame?.browFrac ?? 0.746,
      chinFrac: statsFrame?.chinFrac ?? 0.347,
    },
  );
  // The iris coordinate: the app's GLSL, and the fit produced by the app's own
  // `deriveEyeAxes`. The fit needs the asset's attributes, which live in the
  // browser, so it is injected after a first load and the page is reloaded — a
  // page that computed the fit itself would be certifying its own arithmetic.
  const axisMod = loadTs('components/identity/gl/eyeAxis.ts');
  await page.addInitScript(
    (g) => {
      window.__IRIS_VERT_COMMON = g.vc;
      window.__IRIS_VERT_BODY = g.vb;
      window.__IRIS_FRAG_COMMON = g.fc;
    },
    {
      vc: axisMod.IRIS_COORD_VERT_COMMON,
      vb: axisMod.IRIS_COORD_VERT_BODY,
      fc: axisMod.IRIS_COORD_FRAG_COMMON,
    },
  );
  await page.goto(`http://127.0.0.1:${PORT}/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ok, { timeout: 60000 }).catch(() => {});
  // Guarded on the probe existing: the PROCEDURAL harness has no scanned asset
  // and no `_irisr` to refit, and running this against it unconditionally broke
  // every `HARNESS=./procedural-harness.html` shot the moment the refit landed.
  if (await page.evaluate(() => typeof window.__probeEyes === 'function')) {
    const probe = await page.evaluate(() => window.__probeEyes());
    const d = probe?.sclera;
    const fit = d && typeof d === 'object' ? axisMod.deriveEyeAxes(d.irisR, d.positions) : null;
    if (fit && fit.residual <= axisMod.IRIS_FIT_TOLERANCE) {
      await page.evaluate((a) => window.__setEyeAxes(a), fit);
    } else {
      console.warn(`iris refit unusable (residual ${fit ? fit.residual.toFixed(4) : 'none'})`);
    }
  }
  await page.waitForFunction(() => window.__ok, { timeout: 60000 }).catch(() => {});

  if (!(await page.evaluate(() => window.__ok))) {
    console.error('FAILED'); for (const e of errors) console.error('  ' + e);
    await browser.close(); server.close(); process.exit(1);
  }

  // PROC=<seed>,<seed>… renders the PROCEDURAL head with the app's own
  // materials. Everything else in this file shoots the scanned head; that one is
  // drawn by a software rasteriser in `preview.render.ts` which reimplements the
  // shading, so the GLSL the app installs on that path had never been compiled.
  //
  //   HARNESS=./procedural-harness.html PROC=a,b,c node scripts/shoot-styles.mjs out.png
  if (process.env.PROC) {
    const head = loadTs('lib/identity/headMesh.ts');
    const genomeMod = loadTs('lib/identity/faceGenome.ts');
    const types = loadTs('lib/identity/types.ts');
    const shaderSrc = loadTs('components/identity/gl/proceduralSkinShader.ts');
    const framing = loadTs('components/identity/gl/headFraming.ts');
    await page.evaluate((src) => {
      window.__SKIN_VERT_COMMON = src.vc;
      window.__SKIN_VERT_BODY = src.vb;
      window.__SKIN_FRAG_COMMON = src.fc;
      window.__SKIN_FRAG_BODY = src.fb;
    }, {
      vc: shaderSrc.SKIN_VERT_COMMON, vb: shaderSrc.SKIN_VERT_BODY,
      fc: shaderSrc.SKIN_FRAG_COMMON, fb: shaderSrc.SKIN_FRAG_BODY,
    });

    const age = Number(process.env.AGE ?? 30);
    const blemish = process.env.BLEMISH === undefined ? undefined : Number(process.env.BLEMISH);
    /**
     * GROOM=<field>:<a,b,c> sweeps one grooming control across one face.
     *
     * The controls it covers are material properties, so a sweep is the only way
     * to see them: a single render says nothing about whether a slider is wired,
     * and every one of them looks plausible at any value. PROC supplies the
     * seeds; this overrides one field per shot, so what changes between frames
     * is exactly the control and nothing else.
     */
     const groom = process.env.GROOM ? (() => {
       const [field, list] = process.env.GROOM.split(':');
       return { field, values: (list ?? '0,0.5,1').split(',').map(Number) };
     })() : null;
    const shots = [];
    const passes = groom ? groom.values : [null];
    for (const seed of process.env.PROC.split(',')) {
     for (const sweep of passes) {
      const g = genomeMod.randomizeFace(seed, { sex: process.env.SEX ?? undefined, spread: 0.7 });
      const aged = genomeMod.applyAging(g, age);
      if (blemish !== undefined) aged.blemishes = blemish;
      if (groom && sweep !== null) {
        aged[groom.field] = sweep;
        g[groom.field] = sweep;
      }
      const mesh = head.buildHeadMesh(g, { age });
      // HAIR=<style> pins the cut, so a style can be looked at on this head
      // without rerolling seeds until the randomiser hands it over.
      const hairMesh = head.buildHairMesh(mesh, process.env.HAIR ?? aged.hairStyle, age);
      const eyes = head.eyePlacement(mesh, g, age);
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < mesh.positions.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], mesh.positions[i + k]);
          hi[k] = Math.max(hi[k], mesh.positions[i + k]);
        }
      }
      const hairHex = types.HAIR_COLORS[aged.hairColor];
      await page.evaluate((d) => window.__setHead(d), {
        positions: Array.from(mesh.positions), normals: Array.from(mesh.normals),
        indices: Array.from(mesh.indices), brow: Array.from(mesh.brow),
        // Framed by the app's own `frameHead`, evaluated here rather than
        // shipped as source: injecting a transpiled function is a way to end
        // up verifying a copy of it.
        framing: framing.frameHead({ min: lo, max: hi }, 0.12),
        skin: types.SKIN_TONES[aged.skinTone],
        hairColor: hairHex,
        browColor: typeof aged.browColor === 'number' ? types.HAIR_COLORS[aged.browColor] : hairHex,
        eyeColor: types.EYE_COLORS[aged.eyeColor],
        blemish: aged.blemishes,
        browThickness: aged.browThickness,
        undertone: aged.skinUndertone,
        shells: { ...head.EYE_SHELLS },
        segments: { ...head.EYE_SEGMENTS },
        eyes: [eyes.left, eyes.right].map((e) => ({ x: e.x, y: e.y, z: e.z, radius: e.radius })),
        hair: hairMesh ? {
          positions: Array.from(hairMesh.positions), normals: Array.from(hairMesh.normals),
          indices: Array.from(hairMesh.indices), coverage: Array.from(hairMesh.coverage),
        } : null,
      });
      shots.push({
        name: groom ? `${groom.field}=${sweep}` : seed,
        png: await page.locator('canvas').screenshot(),
      });
     }
    }
    await writeSheet(page, shots, Math.min(5, shots.length), vw, vh, out);
    await browser.close();
    server.close();
    return;
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
        browThickness: g.browThickness,
        undertone: g.skinUndertone,
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

  // BODY=8,18,28,40,55 sweeps body fat, or BODY=fat:muscle pairs. The body
  // simulation's whole point is to be visible on the face, and until this switch
  // existed the scanned head ignored `body` entirely — it reached the procedural
  // builder and nowhere else.
  if (process.env.BODY) {
    const bodyMod = loadTs('lib/identity/body.ts');
    const shots = [];
    for (const spec of process.env.BODY.split(',')) {
      const [fat, muscle] = spec.split(':').map(Number);
      const b = bodyMod.normalizeBody({ bodyFatPct: fat, muscle: Number.isFinite(muscle) ? muscle : 45 });
      await page.evaluate(
        ([a, mu]) => window.__setBody(a, mu),
        [
          Math.max(-1, Math.min(1, (b.bodyFatPct - 22) / 22)),
          Math.max(-1, Math.min(1, (b.muscle - 35) / 55)),
        ],
      );
      shots.push({ name: spec, png: await page.locator('canvas').screenshot() });
    }
    await writeSheet(page, shots, Math.min(5, shots.length), vw, vh, out);
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
      // A child is not a small adult, and the morphs cannot say so. Evaluated
      // from the app's own curve rather than restated in the page.
      await page.evaluate((v) => window.__setChildness(v), child.childnessAt(age));
      const { influences } = bindMod.genomeToInfluences(aged, binding, { signed: true });
      await page.evaluate((c) => window.__applyCharacter(c), {
        influences,
        hairColor: types.HAIR_COLORS[aged.hairColor],
        eyeColor: types.EYE_COLORS[aged.eyeColor],
        blemish: aged.blemishes,
        browThickness: aged.browThickness,
        undertone: aged.skinUndertone,
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

  // SEXES=male,,female renders ONE seed under each sex bias, hair and beard
  // held fixed. An empty entry is "unstated", which is the unbiased centre.
  //
  // The existing SEX mode rolls a different seed per shot, so it can only ever
  // answer "do female characters look female" by eye across two different sets
  // of faces. What `MALE_BIAS` claims is narrower and comparable: that the same
  // character shifts. That is what this shoots.
  if (process.env.SEXES) {
    const genomeMod = loadTs('lib/identity/faceGenome.ts');
    const bindMod = loadTs('lib/identity/morphBinding.ts');
    const types = loadTs('lib/identity/types.ts');
    const names = await page.evaluate(() => window.__morphNames);
    const binding = bindMod.bindGenomeToRig(names);
    const shots = [];
    for (const sex of process.env.SEXES.split(',')) {
      const g = genomeMod.randomizeFace(process.env.SEED ?? 'sex-sweep', {
        sex: sex || undefined,
        spread: Number(process.env.SPREAD ?? 0.7),
      });
      const { influences } = bindMod.genomeToInfluences(g, binding, { signed: true });
      await page.evaluate((c) => window.__applyCharacter(c), {
        influences,
        hairColor: types.HAIR_COLORS[g.hairColor],
        eyeColor: types.EYE_COLORS[g.eyeColor],
        blemish: g.blemishes,
        browThickness: g.browThickness,
        undertone: g.skinUndertone,
        // Held fixed on purpose: hair and a beard are what a viewer reads sex
        // from first, and letting them vary would hide whether the FACE moved.
        hairStyle: 'short',
        facialHair: 'none',
      });
      shots.push({ name: sex || 'unstated', png: await page.locator('canvas').screenshot() });
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

  // MORPH_STATS=1 prints how far each morph target actually moves the scanned
  // mesh, as a fraction of head height, instead of shooting anything.
  //
  // The procedural head has a movement floor asserted for all twenty-four of its
  // morphs, added after four separate sliders turned out to move the mesh by
  // less than half a percent of its height — one of them by exactly nothing.
  // The scanned head had no equivalent, because its morphs live in the GLB and
  // are applied by the GPU, so nothing on the CPU side could see them. This is
  // the measurement that closes that gap; it is a script rather than a test
  // because it needs a browser to decode the quantized morph attributes.
  if (process.env.MORPH_STATS) {
    const stats = await page.evaluate(() => {
      const geom = window.__probeGeometry();
      const rows = [];
      for (const [name, index] of Object.entries(geom.dict)) {
        rows.push({ name, ...geom.magnitude(index) });
      }
      return { height: geom.height, rows };
    });
    stats.rows.sort((a, b) => a.max - b.max);
    console.log(`head height ${stats.height.toFixed(4)}, ${stats.rows.length} morphs`);
    for (const r of stats.rows) {
      console.log(
        `  ${r.name.padEnd(22)} max=${(r.max / stats.height * 100).toFixed(2)}%`
        + ` mean=${(r.mean / stats.height * 100).toFixed(3)}%`
        + ` moved=${(r.moved * 100).toFixed(1)}% of verts`,
      );
    }
    await browser.close();
    server.close();
    return;
  }

  if (process.env.VISIBLE_AIM) {
    const probe = await page.evaluate(() => window.__probeEyes());
    const fit = axisMod.deriveEyeAxes(probe.sclera.irisR, probe.sclera.positions);
    const seen = await page.evaluate(() => window.__measureVisibleEyes());
    for (let i = 0; i < 2; i++) {
      const s = seen[i];
      if (!s) { console.log(`${i ? 'R' : 'L'}: nothing visible`); continue; }
      // With no yaw, +x is screen-right, so the RIGHT half of the frame holds the
      // character's right eye. Getting this backwards asks for the gaze toward
      // the other eye's screen position, and the ray simply misses the eyeball —
      // which is the only reason it was caught.
      const right = i === 1;
      const want = await page.evaluate(
        ([a, n, r]) => window.__gazeToward(a, n, r), [fit, s.ndc, right],
      );
      console.log(
        `${right ? 'R' : 'L'}: ${s.pixels} px  centre=[${s.ndc.map((v) => v.toFixed(4)).join(', ')}]`
        + `  wantGaze=[${want ? want.map((v) => v.toFixed(4)).join(', ') : 'miss'}]`
        + `  have=[${(right ? fit.gazeRight : fit.gazeLeft).map((v) => v.toFixed(4)).join(', ')}]`,
      );
    }
    await browser.close();
    server.close();
    return;
  }

  if (process.env.EYE_STATS) {
    const eyes = await page.evaluate(() => window.__probeEyes());
    const axisMod = loadTs('components/identity/gl/eyeAxis.ts');
    for (const [name, d] of Object.entries(eyes)) {
      if (!d || typeof d !== 'object') { console.log(`${name}: ${d}`); continue; }
      console.log(
        `${name}: ${d.verts} verts, ${d.inIris} inside the rim, ${d.inPupil} inside the pupil`,
      );
      if (!d.normals) { console.log('  no normals'); continue; }
      const fit = axisMod.deriveEyeAxes(d.irisR, d.positions);
      if (!fit) { console.log('  no fit'); continue; }
      console.log(
        `  halfAngle=${fit.halfAngle.toFixed(5)} rad (${(fit.halfAngle * 57.2958).toFixed(2)} deg)`
        + ` midX=${fit.midX.toFixed(4)} residual=${fit.residual.toFixed(4)}`,
      );
      console.log(`  gazeR=[${fit.gazeRight.map((v) => v.toFixed(4))}] centreR=[${fit.centreRight.map((v) => v.toFixed(4))}]`);
      console.log(`  gazeL=[${fit.gazeLeft.map((v) => v.toFixed(4))}] centreL=[${fit.centreLeft.map((v) => v.toFixed(4))}]`);
    }
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
