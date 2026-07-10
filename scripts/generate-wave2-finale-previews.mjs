/**
 * generate-wave2-finale-previews.mjs
 *
 * Wave-2 finale: (1) Onion terminal before/after — the biggest aesthetic
 * break of the project; (2) a 5-up "every app its own body" strip of the
 * other wave-2 apps in their after-state.
 *
 *   node scripts/generate-wave2-finale-previews.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:14px;box-shadow:0 3px 14px rgba(0,0,0,0.28);`;
const MONO = `font-family:'Menlo','SFMono-Regular','Courier New',monospace;`;
const PHOS = '#22C55E';
const PURP = '#A855F7';
const asset = (rel) => `data:image/png;base64,${readFileSync(resolve(ROOT, 'assets/images', rel)).toString('base64')}`;
const FORTNITE = asset('Games/Fortnite.png');
const MINECRAFT = asset('Games/Minecraft.png');
const icon = (stroke, path, size = 16, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;
const ring = (pct, color, size = 46, label, track = T.surface2) => {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${track}" stroke-width="5" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"
      stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${label ? `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="${T.text}" font-size="${size * 0.24}" font-weight="800" font-family="-apple-system,system-ui">${label}</text>` : ''}
  </svg>`;
};
const spark = (pts, color, w = 50, h = 16) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const topBar = (title, chipTxt, rgb) => `<div style="display:flex;align-items:center;padding:8px 14px;flex:0 0 auto;">
  <div style="width:36px;height:40px;display:flex;align-items:center;color:${T.text};font-size:20px;">‹</div>
  <div style="flex:1;color:${T.text};font-size:15px;font-weight:700;">${title}</div>
  <div style="background:rgba(${rgb},0.14);border:1px solid rgba(${rgb},0.30);border-radius:999px;padding:3px 8px;color:${T.text};font-size:11px;font-weight:700;${tnum}">${chipTxt}</div></div>`;
const scroll = (inner, gap = 10) => `<div style="flex:1;overflow:hidden;padding:12px 14px;display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;

// ═════════ ONION — before (slate glass) ═════════
function onionBefore() {
  const O = { rgb: '168,85,247', hex: PURP };
  const row = (name, sub, tag) => `<div style="${L1}padding:12px 14px;display:flex;align-items:center;gap:11px;">
    <div style="width:36px;height:36px;border-radius:18px;background:rgba(${O.rgb},0.15);border:1px solid rgba(${O.rgb},0.30);display:flex;align-items:center;justify-content:center;">${icon(O.hex, '<path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z"/>', 16)}</div>
    <div style="flex:1;"><div style="color:${T.text};font-size:13px;font-weight:700;">${name}</div><div style="color:${T.muted};font-size:10px;">${sub}</div></div>
    <span style="border:1px solid ${O.hex};color:${O.hex};font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;">${tag}</span></div>`;
  return topBar('Onion', '0.842 BTC', O.rgb) + scroll(`
    <div style="${L1}position:relative;border-radius:20px;"><div style="position:relative;border-radius:20px;overflow:hidden;padding:14px;">
      <div style="position:absolute;inset:0;background:rgba(${O.rgb},0.14);"></div>
      <div style="color:${T.muted};font-size:9px;font-weight:700;letter-spacing:1.2px;">MARKET</div>
      <div style="color:${T.text};font-size:20px;font-weight:800;margin-top:4px;">Hidden</div>
      <div style="color:${T.text2};font-size:10px;">anonymity 74 · heat low</div>
    </div></div>
    ${row('Silkroad_Vex', 'Vendor · 4.7★ · 128 reviews', 'browse')}
    ${row('NightCourier', 'Vendor · 4.2★ · 61 reviews', 'browse')}
    ${row('Job board', '2 gigs open', 'view')}
  `);
}
// ═════════ ONION — after (terminal) ═════════
function onionAfter() {
  const line = (prompt, text, color = PHOS) => `<div style="${MONO}font-size:10px;line-height:16px;color:${color};">${prompt ? `<span style="color:${PURP};">onion@darknet</span><span style="color:${T.muted};">:~$</span> ` : ''}${text}</div>`;
  const panel = (title, inner) => `<div style="background:#050807;border:1px solid rgba(34,197,94,0.25);border-radius:8px;overflow:hidden;">
    <div style="display:flex;align-items:center;gap:5px;padding:6px 9px;border-bottom:1px solid rgba(34,197,94,0.18);">
      <span style="width:7px;height:7px;border-radius:4px;background:#EF4444;"></span><span style="width:7px;height:7px;border-radius:4px;background:#F59E0B;"></span><span style="width:7px;height:7px;border-radius:4px;background:#22C55E;"></span>
      <span style="${MONO}color:${T.muted};font-size:9px;margin-left:5px;">${title}</span></div>
    <div style="padding:9px 11px;display:flex;flex-direction:column;gap:3px;">${inner}</div></div>`;
  const bracket = (label) => `<span style="${MONO}display:inline-block;border:1px solid ${PHOS};color:${PHOS};font-size:9.5px;font-weight:700;padding:4px 9px;border-radius:4px;">[ ${label} ]</span>`;
  return `<div style="display:flex;align-items:center;padding:8px 14px;flex:0 0 auto;background:#030504;">
    <div style="width:36px;height:40px;display:flex;align-items:center;color:${PHOS};font-size:20px;">‹</div>
    <div style="flex:1;${MONO}color:${PHOS};font-size:13px;font-weight:700;">onion://market</div>
    <span style="${MONO}color:${T.muted};font-size:10px;${tnum}">0.842 BTC</span></div>
  <div style="flex:1;overflow:hidden;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:#030504;">
    ${panel('session — tor circuit', `
      ${line(true, 'status --anonymity')}
      ${line(false, '&gt; anonymity: 74/100 ██████████████░░░░░░', PHOS)}
      ${line(false, '&gt; heat: LOW · circuit: 3 hops · id: 7f…c2', '#86EFAC')}
      ${line(true, 'ls /market/vendors<span style="color:' + PURP + ';">▊</span>')}
    `)}
    ${panel('vendors — 2 online', `
      ${line(false, '[01] Silkroad_Vex    ★4.7  128 rx  <span style="color:#86EFAC;">online</span>')}
      ${line(false, '[02] NightCourier    ★4.2   61 rx  <span style="color:#86EFAC;">online</span>')}
      <div style="display:flex;gap:6px;margin-top:5px;">${bracket('BROWSE 01')}${bracket('BROWSE 02')}</div>
    `)}
    ${panel('jobs — 2 gigs open', `
      ${line(false, '[J1] package run      2.1 BTC   risk: ██░░░')}
      ${line(false, '[J2] data scrape      0.8 BTC   risk: █░░░░')}
      <div style="display:flex;gap:6px;margin-top:5px;">${bracket('ACCEPT J1')}${bracket('DETAILS')}</div>
    `)}
    ${panel('wallet — ledger tail -3', `
      ${line(false, 'w204  +0.120 BTC  job: courier          ok', '#86EFAC')}
      ${line(false, 'w203  -0.040 BTC  buy: vpn-rotation     ok', '#FCA5A5')}
      ${line(false, 'w201  +0.310 BTC  job: data scrape      ok', '#86EFAC')}
    `)}
  </div>`;
}

// ═════════ finale strip minis (after-only) ═════════
function miniTravel() {
  const A = { rgb: '20,184,166', hex: '#14B8A6' };
  return topBar('Travel', '$12.3k', A.rgb) + scroll(`
    <div style="${L1}padding:0;overflow:hidden;">
      <div style="padding:12px 14px;background:rgba(${A.rgb},0.12);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="color:${T.muted};font-size:8px;font-weight:700;letter-spacing:1px;">FROM</div><div style="color:${T.text};font-size:19px;font-weight:800;">HOME</div></div>
          <div style="color:${A.hex};font-size:15px;">✈</div>
          <div style="text-align:right;"><div style="color:${T.muted};font-size:8px;font-weight:700;letter-spacing:1px;">TO</div><div style="color:${T.text};font-size:19px;font-weight:800;">TOKYO</div></div>
        </div>
        <div style="display:flex;gap:5px;margin-top:7px;">${['departs w214', '$2,400', '2 weeks'].map((c) => `<span style="background:rgba(255,255,255,0.09);color:${T.text2};font-size:8.5px;font-weight:600;padding:2px 7px;border-radius:5px;${tnum}">${c}</span>`).join('')}</div>
      </div>
      <div style="border-top:2px dashed ${T.border};position:relative;">
        <span style="position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:7px;background:#0a1120;"></span>
        <span style="position:absolute;right:-7px;top:-7px;width:14px;height:14px;border-radius:7px;background:#0a1120;"></span></div>
      <div style="padding:9px 14px;display:flex;justify-content:space-between;align-items:center;">
        <svg width="120" height="18" viewBox="0 0 120 18">${Array.from({ length: 30 }, (_, i) => `<rect x="${i * 4}" y="0" width="${(i * 7) % 3 + 1}" height="18" fill="${T.text2}" opacity="0.7"/>`).join('')}</svg>
        <span style="color:${T.muted};${MONO}font-size:8.5px;">BOARDING W214</span></div>
    </div>
    <span style="color:${T.text};font-size:12px;font-weight:700;">Passport</span>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${['PARIS w180', 'ROME w142', 'BALI w96'].map((s) => `<span style="border:1.5px solid rgba(${A.rgb},0.5);color:${A.hex};font-size:9px;font-weight:800;padding:5px 9px;border-radius:8px;transform:rotate(-2deg);letter-spacing:0.5px;">✓ ${s}</span>`).join('')}
    </div>
  `);
}
function miniCrypto() {
  const A = { rgb: '245,158,11', hex: '#F59E0B' };
  return topBar('CryptoMine', '$12.3k', A.rgb) + scroll(`
    <div style="${L1}padding:13px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><div style="color:${T.muted};font-size:8px;font-weight:700;letter-spacing:1px;">WALLET</div>
        <div style="color:${T.text};font-size:21px;font-weight:800;${tnum}">0.842 BTC</div>
        <div style="color:${T.text2};font-size:10px;${tnum}">≈ $36,180 · <span style="color:${T.success};">+2.4%</span></div></div>
        ${spark('0,14 8,12 16,13 24,9 32,10 40,6 50,4', A.hex, 50, 22)}
      </div></div>
    <div style="display:flex;gap:8px;align-items:center;">
      <div style="${L1}flex:1;padding:10px;display:flex;align-items:center;gap:9px;">
        ${ring(76, A.hex, 44, '186')}
        <div><div style="color:${T.text};font-size:10px;font-weight:700;">MH/s total</div><div style="color:${T.muted};font-size:8.5px;">3 rigs · 76% util</div></div>
      </div>
    </div>
    ${[['Rig A', '62 MH/s', T.success, 'OK'], ['Rig B', '78 MH/s', T.success, 'OK'], ['Rig C', '46 MH/s', T.warning, 'HOT']].map(([n, h, c, s]) => `
      <div style="${L1}padding:9px 13px;display:flex;align-items:center;gap:9px;">
        <span style="width:8px;height:8px;border-radius:4px;background:${c};box-shadow:0 0 6px ${c};"></span>
        <span style="color:${T.text};font-size:11px;font-weight:700;flex:1;">${n}</span>
        <span style="color:${T.text2};font-size:10px;${tnum}">${h}</span>
        <span style="color:${c};font-size:9px;font-weight:800;">${s}</span></div>`).join('')}
  `);
}
function miniStats() {
  const A = { rgb: '59,130,246', hex: '#3B82F6' };
  return topBar('Statistics', 'wk 204', A.rgb) + scroll(`
    <div style="${L1}padding:12px;display:flex;justify-content:space-around;align-items:center;">
      <div style="text-align:center;">${ring(82, T.success, 52, '82')}<div style="color:${T.muted};font-size:8px;margin-top:3px;">HEALTH</div></div>
      <div style="text-align:center;">${ring(64, '#EC4899', 52, '64')}<div style="color:${T.muted};font-size:8px;margin-top:3px;">HAPPY</div></div>
      <div style="text-align:center;">${ring(71, A.hex, 52, '71')}<div style="color:${T.muted};font-size:8px;margin-top:3px;">SMARTS</div></div>
    </div>
    ${[['Net worth', '$186,400', '0,15 10,13 20,12 30,9 40,7 50,4', T.success], ['Happiness', '64 · 4wk ↑', '0,12 10,13 20,11 30,10 40,8 50,7', '#EC4899']].map(([n, v, pts, c]) => `
      <div style="${L1}padding:10px 13px;display:flex;align-items:center;gap:10px;">
        <div style="flex:1;"><div style="color:${T.text};font-size:11px;font-weight:700;">${n}</div>
        <div style="color:${T.text2};font-size:10px;${tnum}">${v}</div></div>
        ${spark(pts, c)}</div>`).join('')}
    <div style="display:flex;gap:5px;flex-wrap:wrap;">
      ${['🏆 First $100k · w168', '🎓 Degree · w150'].map((s) => `<span style="background:${T.surface};border:1px solid ${T.border};color:${T.text2};font-size:9px;font-weight:600;padding:4px 8px;border-radius:7px;">${s}</span>`).join('')}
    </div>
  `);
}
function miniYouVideo() {
  const A = { rgb: '139,92,246', hex: '#8B5CF6' };
  return topBar('YouVideo', '$12.3k', A.rgb) + scroll(`
    <div style="display:flex;align-items:center;gap:9px;">
      <div style="width:38px;height:38px;border-radius:10px;background:${A.hex};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;">Y</div>
      <div><div style="color:${T.text};font-size:13px;font-weight:800;">@youvideo <span style="background:rgba(${A.rgb},0.2);color:${A.hex};font-size:8px;font-weight:800;padding:1px 5px;border-radius:4px;">LV 7</span></div>
      <div style="color:${T.muted};font-size:9px;${tnum}">48.2K subs · 214 videos · 1.2M views</div></div></div>
    <div style="${L1}padding:0;overflow:hidden;">
      <div style="position:relative;height:96px;">
        <img src="${FORTNITE}" style="width:100%;height:100%;object-fit:cover;"/>
        <span style="position:absolute;right:7px;bottom:7px;background:rgba(0,0,0,0.75);color:#fff;font-size:8.5px;font-weight:700;padding:2px 6px;border-radius:4px;">12:41</span>
        <div style="position:absolute;left:0;right:0;bottom:0;height:44%;background:rgba(0,0,0,0.45);"></div>
        <div style="position:absolute;left:9px;bottom:6px;color:#fff;font-size:11px;font-weight:800;">Unboxing my new rig</div>
      </div>
      <div style="padding:8px 12px;display:flex;gap:6px;">${['12K views', '+214 subs', '$86'].map((c) => `<span style="background:${T.surface2};color:${T.text2};font-size:8.5px;font-weight:600;padding:2px 7px;border-radius:5px;${tnum}">${c}</span>`).join('')}</div>
    </div>
    <div style="${L1}padding:9px 12px;display:flex;gap:9px;align-items:center;">
      <img src="${MINECRAFT}" style="width:64px;height:38px;object-fit:cover;border-radius:6px;"/>
      <div style="flex:1;"><div style="color:${T.text};font-size:10.5px;font-weight:700;">Minecraft mega-base tour</div>
      <div style="color:${T.muted};font-size:8.5px;${tnum}">8.1K views · 2w ago</div></div></div>
  `);
}
function miniPolitics() {
  const A = { rgb: '96,165,250', hex: '#60A5FA' };
  return topBar('Politics', 'appr 54%', A.rgb) + scroll(`
    <div style="${L1}padding:12px;display:flex;align-items:center;gap:12px;">
      ${ring(54, A.hex, 56, '54%')}
      <div><div style="color:${T.text};font-size:13px;font-weight:800;">City Council</div>
      <div style="color:${T.muted};font-size:9px;">influence 61 · 2 lobbyists</div>
      <div style="display:flex;gap:4px;margin-top:5px;"><span style="color:${T.muted};font-size:8px;">Mayor →</span><span style="color:${A.hex};font-size:8px;font-weight:700;">next: 8k influence</span></div></div>
    </div>
    <div style="${L1}padding:11px 13px;">
      <div style="display:flex;justify-content:space-between;"><span style="color:${T.text};font-size:11px;font-weight:700;">Transit Levy</span><span style="color:${T.muted};font-size:9px;">vote w206</span></div>
      <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:7px;">
        <div style="width:58%;background:${T.success};"></div><div style="width:42%;background:${T.danger};"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:${T.success};font-size:8.5px;font-weight:700;">FOR 58%</span><span style="color:${T.danger};font-size:8.5px;font-weight:700;">AGAINST 42%</span></div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <span style="background:${A.hex};color:#fff;font-size:9px;font-weight:800;padding:5px 12px;border-radius:8px;">Back bill</span>
        <span style="border:1px solid ${T.border};color:${T.text2};font-size:9px;font-weight:700;padding:5px 12px;border-radius:8px;">Oppose</span></div>
    </div>
    <div style="${L1}padding:9px 13px;display:flex;align-items:center;gap:9px;">
      <div style="width:30px;height:30px;border-radius:15px;background:rgba(${A.rgb},0.15);border:1px solid rgba(${A.rgb},0.3);display:flex;align-items:center;justify-content:center;color:${A.hex};font-size:11px;font-weight:800;">MW</div>
      <div style="flex:1;"><div style="color:${T.text};font-size:10.5px;font-weight:700;">Marcus Webb</div>
      <div style="height:4px;background:${T.surface2};border-radius:2px;margin-top:4px;overflow:hidden;"><div style="width:68%;height:100%;background:${A.hex};"></div></div></div>
      <span style="color:${T.muted};font-size:8.5px;${tnum}">34 inf</span></div>
  `);
}

// ── pages ────────────────────────────────────────────────────────────────────
const onionPage = pageShell({
  title: 'Onion — a terminal, not an app',
  subtitle: 'The dark-web market now looks the part: monospace console, phosphor green, bracket commands.',
  body: `<div style="display:flex;justify-content:center;gap:64px;margin-top:34px;">
    ${phone(onionBefore(), { caption: 'Before — same template as every app', captionColor: T.muted })}
    ${phone(onionAfter(), { caption: 'After — terminal DNA', captionColor: PHOS })}
  </div>
  <div style="display:flex;justify-content:center;gap:44px;margin-top:48px;flex-wrap:wrap;max-width:1050px;margin-left:auto;margin-right:auto;">
    ${legendItem(PHOS, 'A real console', 'Terminal-window chrome, a live onion@darknet prompt with a purple cursor glint, and log-style vendor/job/ledger panels.')}
    ${legendItem(PURP, 'Bracket commands', 'Every action is a visible [ BUY ]-style button; five sub-pages (listings, vendors, vendor, job, ledger) via prompt navigation.')}
    ${legendItem(T.text2, 'Still crash-safe', 'Same tokens and primitives under the phosphor — no new dependencies, all decorative layers inert.')}
  </div>`,
});

const finalePage = pageShell({
  title: 'Wave 2 — five more apps, five more bodies',
  subtitle: 'Travel tickets, a mining dashboard, Health-style rings, YouTube thumbnails, a campaign HQ.',
  body: `<div style="display:flex;justify-content:center;gap:26px;margin-top:32px;">
    ${phone(miniTravel(), { caption: 'Travel — boarding pass', captionColor: '#14B8A6', w: 246, h: 500 })}
    ${phone(miniCrypto(), { caption: 'Crypto — mining rig', captionColor: '#F59E0B', w: 246, h: 500 })}
    ${phone(miniStats(), { caption: 'Statistics — health rings', captionColor: '#3B82F6', w: 246, h: 500 })}
    ${phone(miniYouVideo(), { caption: 'YouVideo — thumbnails', captionColor: '#8B5CF6', w: 246, h: 500 })}
    ${phone(miniPolitics(), { caption: 'Politics — campaign HQ', captionColor: '#60A5FA', w: 246, h: 500 })}
  </div>
  <div style="display:flex;justify-content:center;gap:44px;margin-top:44px;flex-wrap:wrap;">
    ${legendItem(T.success, 'Every silhouette is distinct', 'Ticket perforations, LED rig rows, ring clusters, 16:9 thumbnails, vote-split bars — no shared skeleton anywhere.')}
    ${legendItem(T.text2, 'Denser, not louder', 'Each app surfaces state its old UI ignored (passport stamps, rig utilization, milestones, RPM, influence meters).')}
  </div>`,
});

const OUT = resolve(ROOT, 'screenshots');
await renderToPng(chromium, onionPage, resolve(OUT, 'dna-onion-terminal.png'), 1160);
console.log('wrote dna-onion-terminal.png');
await renderToPng(chromium, finalePage, resolve(OUT, 'dna-wave2-finale.png'), 1560);
console.log('wrote dna-wave2-finale.png');
console.log('done');
