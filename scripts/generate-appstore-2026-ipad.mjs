/**
 * Generate the 10-image iPad App Store set (style C — "Life in Motion")
 * at 2064x2752 (13" iPad Pro; auto-scales to 12.9" 2048x2732) from real
 * iPad-viewport gameplay captures (1024x1366 @2x).
 *
 * Prereq: screenshots/appstore-2026/rich-captures-ipad/
 *         (capture-rich-state.mjs run with VIEW_W=1024 VIEW_H=1366 DSF=2)
 * Run:    node scripts/generate-appstore-2026-ipad.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures-ipad');
const OUT = join(ROOT, 'screenshots', 'appstore-2026', 'ipad-13');
mkdirSync(OUT, { recursive: true });

const img = (f) => 'data:image/png;base64,' + readFileSync(join(CAP, f)).toString('base64');
const W = 2064, H = 2752;

const S = {
  home: img('27-home-final.png'),
  homeGoals: img('01-home-goals.png'),
  work: img('02-work.png'),
  apps: img('03-apps.png'),
  spark: img('05-app-spark.png'),
  pulse: img('06-app-pulse.png'),
  stocks: img('07-app-stocks.png'),
  bank: img('08-app-bank.png'),
  contacts: img('09-app-contacts.png'),
  education: img('10-app-education.png'),
  family: img('14-life-family.png'),
  company: img('17-x-company.png'),
  darkweb: img('18-x-darkweb.png'),
  crypto: img('19-x-crypto.png'),
  garage: img('21-x-garage.png'),
  luxury: img('22-x-luxury.png'),
};

/** Same narrative/palette as the iPhone set. `|word|` = accent word. */
const FRAMES = [
  {
    id: '01-live-any-life', head: 'Live any |life.|', sub: 'Hustle. Love. Get rich. Leave a legacy.',
    main: S.home, left: S.spark, right: S.stocks,
    glow: ['244,114,182', '34,211,238', '124,92,255'], acc: ['#f472b6', '#a78bfa', '#22d3ee'],
    badge: '$11M NET WORTH', badgeC: ['#fbbf24', '#f59e0b'],
    ems: [['💍', 'top:660px; left:150px', -12], ['🚀', 'top:600px; right:170px', 10], ['🏝️', 'bottom:150px; left:190px', 8], ['💎', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '02-find-your-person', head: 'Find your |person.|', sub: 'Swipe, match, fall in love — or don’t.',
    main: S.spark, left: S.contacts, right: S.pulse,
    glow: ['244,114,182', '251,113,133', '168,85,247'], acc: ['#fb7185', '#f472b6', '#c084fc'],
    badge: '9+ LIKES WAITING', badgeC: ['#fb7185', '#e11d48'],
    ems: [['💘', 'top:660px; left:150px', -12], ['🌹', 'top:600px; right:170px', 10], ['💍', 'bottom:150px; left:190px', 8], ['✨', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '03-build-your-companies', head: 'Build the |empire.|', sub: 'Found companies. Hire. Scale. Dominate.',
    main: S.company, left: S.stocks, right: S.bank,
    glow: ['129,140,248', '52,211,153', '124,92,255'], acc: ['#818cf8', '#a78bfa', '#34d399'],
    badge: '$8,000/WK REVENUE', badgeC: ['#818cf8', '#4f46e5'],
    ems: [['🏢', 'top:660px; left:150px', -12], ['📈', 'top:600px; right:170px', 10], ['🤝', 'bottom:150px; left:190px', 8], ['👑', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '04-ride-the-bull-run', head: 'Ride the |bull run.|', sub: 'Trade crypto. Mine it. Time the market.',
    main: S.crypto, left: S.bank, right: S.stocks,
    glow: ['52,211,153', '251,191,36', '34,211,238'], acc: ['#34d399', '#2dd4bf', '#fbbf24'],
    badge: '2.0 BTC HELD', badgeC: ['#f59e0b', '#d97706'],
    ems: [['🪙', 'top:660px; left:150px', -12], ['⛏️', 'top:600px; right:170px', 10], ['📊', 'bottom:150px; left:190px', 8], ['💰', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '05-go-viral', head: 'Go |viral.|', sub: 'Post, trend, and grow your following.',
    main: S.pulse, left: S.spark, right: S.contacts,
    glow: ['232,121,249', '244,114,182', '124,92,255'], acc: ['#e879f9', '#f472b6', '#a78bfa'],
    badge: 'TRENDING NOW', badgeC: ['#e879f9', '#c026d3'],
    ems: [['🔥', 'top:660px; left:150px', -12], ['📣', 'top:600px; right:170px', 10], ['⭐', 'bottom:150px; left:190px', 8], ['💬', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '06-enter-the-dark-web', head: 'Enter the |dark web.|', sub: 'High risk. Higher reward. Watch your heat.',
    main: S.darkweb, left: S.crypto, right: S.work,
    glow: ['52,211,153', '168,85,247', '16,185,129'], acc: ['#34d399', '#a855f7', '#22d3ee'],
    badge: 'OPSEC LV 4', badgeC: ['#34d399', '#059669'],
    ems: [['🕶️', 'top:660px; left:150px', -12], ['💻', 'top:600px; right:170px', 10], ['🔓', 'bottom:150px; left:190px', 8], ['₿', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '07-phone-full-of-lives', head: 'A world of |apps.|', sub: 'Dating, trading, banking, fame — all in-game.',
    main: S.apps, left: S.education, right: S.pulse,
    glow: ['34,211,238', '124,92,255', '244,114,182'], acc: ['#22d3ee', '#818cf8', '#a78bfa'],
    badge: 'EVERY APP UNLOCKED', badgeC: ['#22d3ee', '#0891b2'],
    ems: [['📱', 'top:660px; left:150px', -12], ['🔥', 'top:600px; right:170px', 10], ['📇', 'bottom:150px; left:190px', 8], ['🎓', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '08-train-your-mind', head: 'Train your |mind.|', sub: 'Degrees, skills and smarter choices.',
    main: S.education, left: S.work, right: S.homeGoals,
    glow: ['45,212,191', '34,211,238', '96,165,250'], acc: ['#2dd4bf', '#22d3ee', '#60a5fa'],
    badge: 'PhD UNLOCKED', badgeC: ['#2dd4bf', '#0d9488'],
    ems: [['🎓', 'top:660px; left:150px', -12], ['📚', 'top:600px; right:170px', 10], ['🧠', 'bottom:150px; left:190px', 8], ['✍️', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '09-live-the-luxury', head: 'Live the |luxury.|', sub: 'Supercars, diamonds and rare collections.',
    main: S.garage, left: S.luxury, right: S.bank,
    glow: ['251,191,36', '249,115,22', '244,114,182'], acc: ['#fbbf24', '#f97316', '#f472b6'],
    badge: '14 MODELS IN STOCK', badgeC: ['#fbbf24', '#d97706'],
    ems: [['🏎️', 'top:660px; left:150px', -12], ['💎', 'top:600px; right:170px', 10], ['⌚', 'bottom:150px; left:190px', 8], ['🛥️', 'bottom:190px; right:200px', -8]],
  },
  {
    id: '10-your-story-your-rules', head: 'Your story, your |rules.|', sub: 'Every choice writes the next chapter.',
    main: S.homeGoals, left: S.family, right: S.work,
    glow: ['167,139,250', '244,114,182', '34,211,238'], acc: ['#a78bfa', '#c084fc', '#f472b6'],
    badge: 'CHAPTER 3: ON THE RISE', badgeC: ['#a78bfa', '#7c3aed'],
    ems: [['✨', 'top:660px; left:150px', -12], ['🧭', 'top:600px; right:170px', 10], ['🎯', 'bottom:150px; left:190px', 8], ['👨‍👩‍👧', 'bottom:190px; right:200px', -8]],
  },
];

function frameHtml(f) {
  const head = f.head.replace('|', '<span class="acc">').replace('|', '</span>');
  const ems = f.ems.map(([e, pos, rot]) =>
    `<div class="em" style="${pos}; font-size:150px; transform:rotate(${rot}deg);">${e}</div>`).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; overflow:hidden; }
  body { font-family:-apple-system,'SF Pro Display','Segoe UI',Roboto,sans-serif; background:#04060f; }
  .canvas { position:relative; width:${W}px; height:${H}px; overflow:hidden; }
  .bg { position:absolute; inset:0; background:
      radial-gradient(1900px 1300px at 12% 10%, rgba(${f.glow[0]},.32), transparent 60%),
      radial-gradient(1900px 1400px at 92% 22%, rgba(${f.glow[1]},.28), transparent 60%),
      radial-gradient(2200px 1700px at 50% 108%, rgba(${f.glow[2]},.45), transparent 62%),
      linear-gradient(160deg,#0b0e22 0%, #070a18 60%, #05070f 100%); }
  .dust { position:absolute; inset:0; background-image:
      radial-gradient(4px 4px at 8% 32%, rgba(255,255,255,.28), transparent 60%),
      radial-gradient(3px 3px at 22% 66%, rgba(255,255,255,.18), transparent 60%),
      radial-gradient(4px 4px at 41% 21%, rgba(255,255,255,.22), transparent 60%),
      radial-gradient(3px 3px at 63% 74%, rgba(255,255,255,.16), transparent 60%),
      radial-gradient(4px 4px at 78% 40%, rgba(255,255,255,.25), transparent 60%),
      radial-gradient(3px 3px at 91% 82%, rgba(255,255,255,.18), transparent 60%),
      radial-gradient(3px 3px at 34% 88%, rgba(255,255,255,.15), transparent 60%),
      radial-gradient(4px 4px at 55% 30%, rgba(255,255,255,.14), transparent 60%); }
  .ring { position:absolute; top:900px; left:50%; transform:translateX(-50%); width:1500px; height:1500px;
      border-radius:50%; border:2px solid rgba(255,255,255,.07);
      box-shadow: inset 0 0 160px rgba(${f.glow[2]},.15), 0 0 260px rgba(${f.glow[2]},.10); }
  .head { position:absolute; top:130px; left:0; right:0; text-align:center; z-index:8; padding:0 60px; }
  .kicker { font-size:44px; font-weight:800; letter-spacing:14px; color:#9fb0d6; text-transform:uppercase; margin-bottom:40px; }
  h1 { font-size:180px; line-height:1.04; font-weight:900; letter-spacing:-6px; color:#f4f6ff; }
  h1 .acc { background:linear-gradient(90deg,${f.acc.join(',')}); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { margin-top:38px; font-size:56px; font-weight:600; color:#b6c0dd; }
  .stage { position:absolute; inset:0; perspective:3400px; perspective-origin:50% 44%; }
  .pad { position:absolute; border-radius:64px; padding:20px;
      background:linear-gradient(160deg,#565d70,#22252e 42%,#3c4150 88%,#5a6174);
      box-shadow:0 90px 180px rgba(0,0,0,.72); }
  .pad .frameEdge { position:absolute; inset:7px; border-radius:58px; border:2px solid rgba(255,255,255,.09); pointer-events:none; }
  .pad .scr { position:relative; border-radius:48px; overflow:hidden; }
  .pad img { display:block; width:100%; }
  .pad .gloss { position:absolute; inset:0; border-radius:48px;
      background:linear-gradient(115deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.05) 18%, transparent 34%); }
  .padMain { width:1150px; left:50%; top:800px; z-index:5;
      transform:translateX(-50%) rotateX(5deg) rotateY(-6deg) rotateZ(1deg);
      box-shadow:0 120px 240px rgba(0,0,0,.82), 0 0 280px rgba(${f.glow[2]},.30); }
  .padL { width:840px; left:-270px; top:1130px; z-index:3;
      transform:rotateY(26deg) rotateZ(-8deg); box-shadow:0 80px 170px rgba(0,0,0,.7); }
  .padR { width:840px; right:-270px; top:1080px; z-index:3;
      transform:rotateY(-26deg) rotateZ(8deg); box-shadow:0 80px 170px rgba(0,0,0,.7); }
  .ground { position:absolute; left:50%; transform:translateX(-50%); top:2470px; width:1400px; height:150px;
      background:radial-gradient(closest-side, rgba(0,0,0,.65), transparent); filter:blur(22px); z-index:2; }
  .em { position:absolute; z-index:7; filter:drop-shadow(0 28px 48px rgba(0,0,0,.55)); }
  .badge { position:absolute; z-index:9; top:840px; left:170px; padding:28px 48px; border-radius:64px;
      font-size:50px; font-weight:900; color:#04060f; transform:rotate(-4deg);
      background:linear-gradient(90deg,${f.badgeC.join(',')}); box-shadow:0 36px 84px rgba(0,0,0,.5); }
  </style></head><body><div class="canvas">
  <div class="bg"></div><div class="dust"></div><div class="ring"></div>
  <div class="head"><div class="kicker">DEEP LIFE SIMULATOR</div><h1>${head}</h1><div class="sub">${f.sub}</div></div>
  <div class="ground"></div>
  <div class="stage">
    <div class="pad padL"><div class="scr"><img src="${f.left}"><div class="gloss"></div></div><div class="frameEdge"></div></div>
    <div class="pad padR"><div class="scr"><img src="${f.right}"><div class="gloss"></div></div><div class="frameEdge"></div></div>
    <div class="pad padMain"><div class="scr"><img src="${f.main}"><div class="gloss"></div></div><div class="frameEdge"></div></div>
  </div>
  ${ems}
  <div class="badge">${f.badge}</div>
  </div></body></html>`;
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const f of FRAMES) {
  const file = join(OUT, f.id + '.html');
  writeFileSync(file, frameHtml(f));
  await pg.goto('file://' + file, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 500));
  await pg.screenshot({ path: join(OUT, f.id + '.png') });
  rmSync(file);
  console.log('✓', f.id);
}
await browser.close();
console.log('Done →', OUT);
