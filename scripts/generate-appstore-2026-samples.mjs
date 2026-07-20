/**
 * Generate 3 style samples of App Store image #1 at 1320x2868 (iPhone 6.9").
 * All three use REAL gameplay captures from rich-captures/.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SP = 'screenshots/appstore-2026';
const CAP = join(SP, 'rich-captures');
const OUT = join(SP, 'style-samples');
mkdirSync(OUT, { recursive: true });

const img = (f) => 'data:image/png;base64,' + readFileSync(join(CAP, f)).toString('base64');
const W = 1320, H = 2868;

function page(body, extraCss = '') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; overflow:hidden; }
  body { font-family: -apple-system, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; background:#04060f; }
  .canvas { position:relative; width:${W}px; height:${H}px; overflow:hidden; }
  ${extraCss}
  </style></head><body><div class="canvas">${body}</div></body></html>`;
}

// ---------------------------------------------------------------- Style A
function styleA(shotMain) {
  const css = `
  .bg { position:absolute; inset:0; background:
      radial-gradient(1400px 1100px at 18% 6%, rgba(124,92,255,.42), transparent 60%),
      radial-gradient(1200px 1000px at 88% 88%, rgba(34,211,238,.20), transparent 60%),
      radial-gradient(900px 700px at 80% 30%, rgba(236,72,153,.12), transparent 60%),
      linear-gradient(175deg, #0a0d1f 0%, #04060f 55%, #03040a 100%); }
  .grain { position:absolute; inset:0; opacity:.5; background:
      repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 2px, transparent 2px 4px); }
  .head { position:absolute; top:150px; left:0; right:0; text-align:center; z-index:5; }
  .kicker { display:inline-block; font-size:34px; font-weight:800; letter-spacing:10px; color:#8ea0c8;
      text-transform:uppercase; margin-bottom:34px; }
  .kicker b { color:#a78bfa; }
  h1 { font-size:172px; line-height:1.02; font-weight:900; letter-spacing:-5px; color:#f4f6ff; }
  h1 .acc { background:linear-gradient(90deg,#a78bfa,#22d3ee); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { margin-top:38px; font-size:44px; font-weight:600; color:#aab6d4; }
  .phoneWrap { position:absolute; top:760px; left:50%; transform:translateX(-50%); z-index:3; }
  .phone { width:960px; padding:22px; border-radius:130px;
      background:linear-gradient(160deg,#4a5060,#23262f 40%,#3c4150);
      box-shadow: 0 90px 180px rgba(0,0,0,.75), 0 0 220px rgba(124,92,255,.25); }
  .screen { display:block; width:100%; border-radius:108px; }
  .chip { position:absolute; z-index:6; display:flex; align-items:center; gap:18px;
      padding:26px 40px; border-radius:60px; font-weight:800; color:#fff;
      background:rgba(20,26,48,.55); border:1.5px solid rgba(255,255,255,.16);
      backdrop-filter: blur(22px); box-shadow:0 40px 80px rgba(0,0,0,.55); }
  .chip .em { font-size:52px; } .chip .tx { font-size:44px; } .chip small { display:block; font-size:28px; font-weight:600; color:#9fb0d6; }
  .cGreen { border-color:rgba(52,211,153,.5); } .cGreen .tx { color:#34d399; }
  .cPink  { border-color:rgba(244,114,182,.5); } .cPink .tx { color:#f472b6; }
  .cGold  { border-color:rgba(251,191,36,.5); } .cGold .tx { color:#fbbf24; }
  .cBlue  { border-color:rgba(96,165,250,.5); } .cBlue .tx { color:#60a5fa; }`;
  const body = `
  <div class="bg"></div><div class="grain"></div>
  <div class="head">
    <div class="kicker">DEEP LIFE <b>SIMULATOR</b></div>
    <h1>Live any <span class="acc">life.</span></h1>
    <div class="sub">Every choice writes your story.</div>
  </div>
  <div class="phoneWrap"><div class="phone"><img class="screen" src="${shotMain}"></div></div>
  <div class="chip cGreen" style="top:1010px; left:64px;"><span class="em">💰</span><span><span class="tx">$11.0M</span><small>Net worth</small></span></div>
  <div class="chip cPink" style="top:1330px; right:56px;"><span class="em">💍</span><span><span class="tx">Married</span><small>2 kids</small></span></div>
  <div class="chip cBlue" style="top:1980px; left:48px;"><span class="em">📈</span><span><span class="tx">+2.75%</span><small>AAPL this week</small></span></div>
  <div class="chip cGold" style="top:2420px; right:72px;"><span class="em">👑</span><span><span class="tx">Level 6</span><small>Top of the ladder</small></span></div>`;
  return page(body, css);
}

// ---------------------------------------------------------------- Style B
function styleB(shotMain) {
  const css = `
  .shot { position:absolute; inset:0; width:${W}px; height:${H}px; object-fit:cover; }
  .scrimTop { position:absolute; left:0; right:0; top:0; height:1050px;
      background:linear-gradient(180deg, rgba(2,6,23,.97) 0%, rgba(2,6,23,.88) 38%, rgba(2,6,23,0) 100%); }
  .scrimBot { position:absolute; left:0; right:0; bottom:0; height:420px;
      background:linear-gradient(0deg, rgba(2,6,23,.9), rgba(2,6,23,0)); }
  .glow { position:absolute; top:-350px; left:50%; transform:translateX(-50%); width:1800px; height:900px;
      background:radial-gradient(closest-side, rgba(124,92,255,.5), transparent); }
  .head { position:absolute; top:170px; left:0; right:0; text-align:center; }
  .kicker { font-size:34px; font-weight:800; letter-spacing:10px; color:#9fb0d6; text-transform:uppercase; margin-bottom:40px; }
  h1 { font-size:190px; line-height:1.0; font-weight:900; letter-spacing:-6px; color:#ffffff;
      text-shadow:0 8px 60px rgba(0,0,0,.6); }
  h1 .acc { background:linear-gradient(90deg,#a78bfa,#f472b6); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .rule { width:220px; height:10px; border-radius:5px; margin:52px auto 0;
      background:linear-gradient(90deg,#a78bfa,#f472b6); }
  .feet { position:absolute; bottom:96px; left:0; right:0; display:flex; justify-content:center; gap:34px; }
  .pill { padding:24px 44px; border-radius:60px; font-size:40px; font-weight:800; color:#eef1ff;
      background:rgba(15,20,40,.72); border:1.5px solid rgba(255,255,255,.2); backdrop-filter:blur(18px); }`;
  const body = `
  <img class="shot" src="${shotMain}">
  <div class="scrimTop"></div><div class="scrimBot"></div><div class="glow"></div>
  <div class="head">
    <div class="kicker">DEEP LIFE SIMULATOR</div>
    <h1>Live any<br><span class="acc">life.</span></h1>
    <div class="rule"></div>
  </div>
  <div class="feet">
    <div class="pill">💼 Careers</div><div class="pill">❤️ Love</div><div class="pill">📈 Empires</div>
  </div>`;
  return page(body, css);
}

// ---------------------------------------------------------------- Style C
function styleC(shotMain, shotLeft, shotRight) {
  const css = `
  .bg { position:absolute; inset:0; background:
      radial-gradient(1300px 900px at 12% 10%, rgba(244,114,182,.30), transparent 60%),
      radial-gradient(1300px 1000px at 92% 22%, rgba(34,211,238,.26), transparent 60%),
      radial-gradient(1500px 1200px at 50% 108%, rgba(124,92,255,.42), transparent 62%),
      linear-gradient(160deg,#0b0e22 0%, #070a18 60%, #05070f 100%); }
  .head { position:absolute; top:150px; left:0; right:0; text-align:center; z-index:8; }
  .kicker { font-size:34px; font-weight:800; letter-spacing:10px; color:#9fb0d6; text-transform:uppercase; margin-bottom:36px; }
  h1 { font-size:168px; line-height:1.02; font-weight:900; letter-spacing:-5px; color:#f4f6ff; }
  h1 .acc { background:linear-gradient(90deg,#f472b6,#a78bfa,#22d3ee); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { margin-top:36px; font-size:44px; font-weight:600; color:#b6c0dd; }
  .ph { position:absolute; border-radius:92px; padding:16px; background:linear-gradient(160deg,#454b5a,#20232c 45%,#383d4c);
      box-shadow:0 80px 160px rgba(0,0,0,.72); }
  .ph img { display:block; width:100%; border-radius:78px; }
  .phMain { width:760px; left:50%; transform:translateX(-50%); top:880px; z-index:5;
      box-shadow:0 90px 200px rgba(0,0,0,.8), 0 0 200px rgba(124,92,255,.28); }
  .phL { width:560px; left:-150px; top:1240px; transform:rotate(-9deg); z-index:3; }
  .phR { width:560px; right:-150px; top:1180px; transform:rotate(9deg); z-index:3; }
  .em { position:absolute; z-index:7; filter:drop-shadow(0 24px 40px rgba(0,0,0,.55)); }
  .badge { position:absolute; z-index:9; padding:22px 38px; border-radius:56px; font-size:40px; font-weight:900;
      color:#04060f; background:linear-gradient(90deg,#fbbf24,#f59e0b); transform:rotate(-4deg);
      box-shadow:0 30px 70px rgba(0,0,0,.5); }`;
  const body = `
  <div class="bg"></div>
  <div class="head">
    <div class="kicker">DEEP LIFE SIMULATOR</div>
    <h1>Live any <span class="acc">life.</span></h1>
    <div class="sub">Hustle. Love. Get rich. Leave a legacy.</div>
  </div>
  <div class="ph phL"><img src="${shotLeft}"></div>
  <div class="ph phR"><img src="${shotRight}"></div>
  <div class="ph phMain"><img src="${shotMain}"></div>
  <div class="em" style="top:760px; left:90px; font-size:120px; transform:rotate(-12deg);">💍</div>
  <div class="em" style="top:700px; right:110px; font-size:110px; transform:rotate(10deg);">🚀</div>
  <div class="em" style="bottom:180px; left:120px; font-size:120px; transform:rotate(8deg);">🏝️</div>
  <div class="em" style="bottom:220px; right:130px; font-size:120px; transform:rotate(-8deg);">💎</div>
  <div class="badge" style="top:940px; left:120px;">$11M NET WORTH</div>`;
  return page(body, css);
}

const main = img('27-home-final.png');
const spark = img('05-app-spark.png');
const stocks = img('07-app-stocks.png');

const samples = [
  ['sample-A-cinematic', styleA(main)],
  ['sample-B-fullbleed', styleB(spark)],
  ['sample-C-collage', styleC(main, spark, stocks)],
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const [name, html] of samples) {
  const f = join(OUT, name + '.html');
  writeFileSync(f, html);
  await pg.goto('file://' + f, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 600));
  await pg.screenshot({ path: join(OUT, name + '.png') });
  console.log('✓', name);
}
await browser.close();
