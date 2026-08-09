/**
 * The 3D scene that sits behind the app.
 *
 * Returned as a source string and injected with `addInitScript`, so it has to
 * be self-contained — no imports, no bundler, no outbound network.
 *
 * It renders a perspective-projected dust field plus a few slow volumetric
 * light blobs onto a canvas that lives *underneath* `#root`. The app is opaque,
 * so none of it is visible until the camera pulls back or the app fades for the
 * end card — which is exactly the point: the depth only appears at the moments
 * that are meant to feel cinematic.
 *
 * Two deliberate choices:
 *   - The canvas backing store is small (480x854) and stretched by CSS. Every
 *     element in the scene is a soft gradient or a blurred dot, so resolution
 *     buys nothing, and at a 2160x3840 capture a full-size backing store would
 *     cost far more per frame than the whole rest of the render.
 *   - The particle field is seeded, not random. Re-running the capture has to
 *     produce the same footage, or the rig stops being a rig.
 */
export const SCENE_SOURCE = String.raw`
(function () {
  var W = 480, H = 854;

  // Mulberry32 — small, seeded, good enough for dust placement. A seeded field
  // means two captures of the same Short are frame-identical.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var canvas = document.createElement('canvas');
  canvas.id = '__shorts_bg';
  canvas.width = W; canvas.height = H;
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';

  var ctx = canvas.getContext('2d');
  var r = rng(20470118);

  // Dust in a unit box with depth. Perspective divide gives real parallax:
  // near motes are larger, brighter and sweep faster than far ones.
  var N = 110, pts = [];
  for (var i = 0; i < N; i++) {
    pts.push({
      x: r() * 2 - 1,
      y: r() * 2 - 1,
      z: 0.15 + r() * 0.85,
      s: 0.35 + r() * 0.9,
      tw: r() * Math.PI * 2
    });
  }

  // Slow volumetric blobs — the colour and the sense of a lit space.
  var blobs = [
    { hue: '79,142,247',  rx: 0.24, ry: 0.30, rad: 0.78, spd: 0.055, ph: 0.0, a: 0.46 },
    { hue: '33,192,139',  rx: 0.76, ry: 0.24, rad: 0.64, spd: 0.041, ph: 2.1, a: 0.34 },
    { hue: '124,92,255',  rx: 0.50, ry: 0.78, rad: 0.92, spd: 0.032, ph: 4.0, a: 0.40 },
    { hue: '255,176,72',  rx: 0.22, ry: 0.80, rad: 0.48, spd: 0.048, ph: 1.2, a: 0.20 }
  ];

  var t0 = null;

  function frame(now) {
    if (t0 === null) t0 = now;
    var t = (now - t0) / 1000;

    // Base gradient — the "room".
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1122');
    g.addColorStop(0.45, '#121d35');
    g.addColorStop(1, '#05080f');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Light blobs, added rather than painted over, so overlaps bloom.
    ctx.globalCompositeOperation = 'lighter';
    for (var b = 0; b < blobs.length; b++) {
      var o = blobs[b];
      var cx = (o.rx + Math.sin(t * o.spd * 2 + o.ph) * 0.10) * W;
      var cy = (o.ry + Math.cos(t * o.spd * 1.6 + o.ph) * 0.08) * H;
      var rad = o.rad * W;
      var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, 'rgba(' + o.hue + ',' + o.a + ')');
      rg.addColorStop(0.5, 'rgba(' + o.hue + ',' + (o.a * 0.28).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(' + o.hue + ',0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // Dust field. z shrinks toward the camera and wraps, so the field drifts
    // forward forever without a visible seam.
    var fov = 0.55, cx0 = W / 2, cy0 = H / 2;
    for (var i = 0; i < N; i++) {
      var p = pts[i];
      p.z -= 0.012 * (1 / 60) * 60 * 0.016;
      if (p.z <= 0.12) { p.z = 1.0; p.x = r() * 2 - 1; p.y = r() * 2 - 1; }
      var k = fov / p.z;
      var sx = cx0 + p.x * k * W * 0.9;
      var sy = cy0 + (p.y + Math.sin(t * 0.25 + p.tw) * 0.05) * k * H * 0.62;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      var rr = Math.max(0.4, p.s * k * 1.5);
      var near = Math.min(1, (1 - p.z) * 1.25);
      var a = (0.14 + near * 0.60) * (0.65 + 0.35 * Math.sin(t * 1.1 + p.tw));
      var dg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 3.2);
      dg.addColorStop(0, 'rgba(200,224,255,' + a.toFixed(3) + ')');
      dg.addColorStop(1, 'rgba(200,224,255,0)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(sx, sy, rr * 3.2, 0, 6.2832);
      ctx.fill();
    }

    // Vignette to seat the subject.
    ctx.globalCompositeOperation = 'source-over';
    var vg = ctx.createRadialGradient(W / 2, H * 0.44, W * 0.20, W / 2, H * 0.5, W * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(frame);
  }

  function mount() {
    if (document.getElementById('__shorts_bg')) return;
    var body = document.body;
    if (!body) return;
    body.insertBefore(canvas, body.firstChild);
    // The app paints an opaque background; it has to sit above the scene and
    // establish its own stacking context so the camera transform composites
    // against the canvas rather than the page background.
    var root = document.getElementById('root');
    if (root) {
      root.style.position = 'relative';
      root.style.zIndex = '1';
      root.style.transformOrigin = '50% 46%';
      root.style.willChange = 'transform, opacity';
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  setInterval(mount, 500);
})();
`;
