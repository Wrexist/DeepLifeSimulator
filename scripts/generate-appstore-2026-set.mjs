/**
 * Generate the full 10-image App Store set (style C — "Life in Motion")
 * at 1320x2868 from real gameplay captures.
 *
 * Prereq: screenshots/appstore-2026/rich-captures/ (see capture-rich-state.mjs)
 * Run:    node scripts/generate-appstore-2026-set.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures');
const OUT = join(ROOT, 'screenshots', 'appstore-2026', 'iphone-6.9');
mkdirSync(OUT, { recursive: true });

const img = (f) => 'data:image/png;base64,' + readFileSync(join(CAP, f)).toString('base64');
const W = 1320, H = 2868;

const S = {
  home: img('13-home-final.png'),
  homeGoals: img('01-home-goals.png'),
  work: img('02-work.png'),
  apps: img('03-apps.png'),
  apps2: img('04-apps-2.png'),
  spark: img('05-app-spark.png'),
  pulse: img('06-app-pulse.png'),
  stocks: img('07-app-stocks.png'),
  bank: img('08-app-bank.png'),
  contacts: img('09-app-contacts.png'),
  education: img('10-app-education.png'),
  life: img('11-life.png'),
  life2: img('12-life-2.png'),
};

/** Frame definitions — headline `|word|` marks the gradient-accent word. */
const FRAMES = [
  {
    id: '01-live-any-life', head: 'Live any |life.|', sub: 'Hustle. Love. Get rich. Leave a legacy.',
    main: S.home, left: S.spark, right: S.stocks,
    glow: ['244,114,182', '34,211,238', '124,92,255'], acc: ['#f472b6', '#a78bfa', '#22d3ee'],
    badge: '$11M NET WORTH', badgeC: ['#fbbf24', '#f59e0b'],
    ems: [['💍', 'top:760px; left:90px', -12], ['🚀', 'top:700px; right:110px', 10], ['🏝️', 'bottom:180px; left:120px', 8], ['💎', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '02-find-your-person', head: 'Find your |person.|', sub: 'Swipe, match, fall in love — or don’t.',
    main: S.spark, left: S.contacts, right: S.pulse,
    glow: ['244,114,182', '251,113,133', '168,85,247'], acc: ['#fb7185', '#f472b6', '#c084fc'],
    badge: '9+ LIKES WAITING', badgeC: ['#fb7185', '#e11d48'],
    ems: [['💘', 'top:760px; left:90px', -12], ['🌹', 'top:700px; right:110px', 10], ['💍', 'bottom:180px; left:120px', 8], ['✨', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '03-build-the-empire', head: 'Build the |empire.|', sub: 'Stocks, companies and passive income.',
    main: S.stocks, left: S.bank, right: S.homeGoals,
    glow: ['52,211,153', '34,211,238', '124,92,255'], acc: ['#34d399', '#2dd4bf', '#22d3ee'],
    badge: '+2.75% THIS WEEK', badgeC: ['#34d399', '#059669'],
    ems: [['📈', 'top:760px; left:90px', -12], ['💼', 'top:700px; right:110px', 10], ['🏦', 'bottom:180px; left:120px', 8], ['💎', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '04-hustle-your-way-up', head: '|Hustle| your way up.', sub: 'Street jobs to CEO — every path is open.',
    main: S.work, left: S.apps, right: S.bank,
    glow: ['96,165,250', '124,92,255', '34,211,238'], acc: ['#60a5fa', '#818cf8', '#22d3ee'],
    badge: '$13,000/WK SALARY', badgeC: ['#60a5fa', '#2563eb'],
    ems: [['💪', 'top:760px; left:90px', -12], ['🧰', 'top:700px; right:110px', 10], ['🚀', 'bottom:180px; left:120px', 8], ['👑', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '05-go-viral', head: 'Go |viral.|', sub: 'Post, trend, and grow your following.',
    main: S.pulse, left: S.spark, right: S.contacts,
    glow: ['232,121,249', '244,114,182', '124,92,255'], acc: ['#e879f9', '#f472b6', '#a78bfa'],
    badge: 'TRENDING NOW', badgeC: ['#e879f9', '#c026d3'],
    ems: [['🔥', 'top:760px; left:90px', -12], ['📣', 'top:700px; right:110px', 10], ['⭐', 'bottom:180px; left:120px', 8], ['💬', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '06-master-your-money', head: 'Master your |money.|', sub: 'Save, borrow, invest — make it grow.',
    main: S.bank, left: S.stocks, right: S.home,
    glow: ['52,211,153', '251,191,36', '34,211,238'], acc: ['#34d399', '#a3e635', '#fbbf24'],
    badge: '$11M BALANCE', badgeC: ['#34d399', '#16a34a'],
    ems: [['💵', 'top:760px; left:90px', -12], ['🏦', 'top:700px; right:110px', 10], ['💳', 'bottom:180px; left:120px', 8], ['🪙', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '07-phone-full-of-lives', head: 'A phone full of |lives.|', sub: 'Dating, trading, banking, fame — all in-game.',
    main: S.apps, left: S.apps2, right: S.pulse,
    glow: ['34,211,238', '124,92,255', '244,114,182'], acc: ['#22d3ee', '#818cf8', '#a78bfa'],
    badge: 'EVERY APP UNLOCKED', badgeC: ['#22d3ee', '#0891b2'],
    ems: [['📱', 'top:760px; left:90px', -12], ['🔥', 'top:700px; right:110px', 10], ['📇', 'bottom:180px; left:120px', 8], ['🎓', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '08-train-your-mind', head: 'Train your |mind.|', sub: 'Degrees, skills and smarter choices.',
    main: S.education, left: S.work, right: S.homeGoals,
    glow: ['45,212,191', '34,211,238', '96,165,250'], acc: ['#2dd4bf', '#22d3ee', '#60a5fa'],
    badge: 'PhD UNLOCKED', badgeC: ['#2dd4bf', '#0d9488'],
    ems: [['🎓', 'top:760px; left:90px', -12], ['📚', 'top:700px; right:110px', 10], ['🧠', 'bottom:180px; left:120px', 8], ['✍️', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '09-leave-a-legacy', head: 'Leave a |legacy.|', sub: 'Family, generations, prestige.',
    main: S.life, left: S.life2, right: S.contacts,
    glow: ['251,191,36', '244,114,182', '124,92,255'], acc: ['#fbbf24', '#f59e0b', '#f472b6'],
    badge: 'GEN 1 → ∞', badgeC: ['#fbbf24', '#d97706'],
    ems: [['👑', 'top:760px; left:90px', -12], ['🏡', 'top:700px; right:110px', 10], ['🕰️', 'bottom:180px; left:120px', 8], ['🌳', 'bottom:220px; right:130px', -8]],
  },
  {
    id: '10-your-story-your-rules', head: 'Your story, your |rules.|', sub: 'Every choice writes the next chapter.',
    main: S.homeGoals, left: S.spark, right: S.work,
    glow: ['167,139,250', '244,114,182', '34,211,238'], acc: ['#a78bfa', '#c084fc', '#f472b6'],
    badge: 'CHAPTER 3: ON THE RISE', badgeC: ['#a78bfa', '#7c3aed'],
    ems: [['✨', 'top:760px; left:90px', -12], ['🧭', 'top:700px; right:110px', 10], ['🎯', 'bottom:180px; left:120px', 8], ['🃏', 'bottom:220px; right:130px', -8]],
  },
];

function frameHtml(f) {
  const head = f.head.replace('|', '<span class="acc">').replace('|', '</span>');
  const ems = f.ems.map(([e, pos, rot]) =>
    `<div class="em" style="${pos}; font-size:118px; transform:rotate(${rot}deg);">${e}</div>`).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; overflow:hidden; }
  body { font-family:-apple-system,'SF Pro Display','Segoe UI',Roboto,sans-serif; background:#04060f; }
  .canvas { position:relative; width:${W}px; height:${H}px; overflow:hidden; }
  .bg { position:absolute; inset:0; background:
      radial-gradient(1300px 900px at 12% 10%, rgba(${f.glow[0]},.30), transparent 60%),
      radial-gradient(1300px 1000px at 92% 22%, rgba(${f.glow[1]},.26), transparent 60%),
      radial-gradient(1500px 1200px at 50% 108%, rgba(${f.glow[2]},.42), transparent 62%),
      linear-gradient(160deg,#0b0e22 0%, #070a18 60%, #05070f 100%); }
  .head { position:absolute; top:150px; left:0; right:0; text-align:center; z-index:8; padding:0 40px; }
  .kicker { font-size:34px; font-weight:800; letter-spacing:10px; color:#9fb0d6; text-transform:uppercase; margin-bottom:36px; }
  h1 { font-size:158px; line-height:1.04; font-weight:900; letter-spacing:-5px; color:#f4f6ff; }
  h1 .acc { background:linear-gradient(90deg,${f.acc.join(',')}); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { margin-top:36px; font-size:44px; font-weight:600; color:#b6c0dd; }
  .ph { position:absolute; border-radius:92px; padding:16px; background:linear-gradient(160deg,#454b5a,#20232c 45%,#383d4c);
      box-shadow:0 80px 160px rgba(0,0,0,.72); }
  .ph img { display:block; width:100%; border-radius:78px; }
  .phMain { width:760px; left:50%; transform:translateX(-50%); top:880px; z-index:5;
      box-shadow:0 90px 200px rgba(0,0,0,.8), 0 0 200px rgba(${f.glow[2]},.28); }
  .phL { width:560px; left:-150px; top:1240px; transform:rotate(-9deg); z-index:3; }
  .phR { width:560px; right:-150px; top:1180px; transform:rotate(9deg); z-index:3; }
  .em { position:absolute; z-index:7; filter:drop-shadow(0 24px 40px rgba(0,0,0,.55)); }
  .badge { position:absolute; z-index:9; top:940px; left:110px; padding:22px 38px; border-radius:56px;
      font-size:40px; font-weight:900; color:#04060f; transform:rotate(-4deg);
      background:linear-gradient(90deg,${f.badgeC.join(',')}); box-shadow:0 30px 70px rgba(0,0,0,.5); }
  </style></head><body><div class="canvas">
  <div class="bg"></div>
  <div class="head"><div class="kicker">DEEP LIFE SIMULATOR</div><h1>${head}</h1><div class="sub">${f.sub}</div></div>
  <div class="ph phL"><img src="${f.left}"></div>
  <div class="ph phR"><img src="${f.right}"></div>
  <div class="ph phMain"><img src="${f.main}"></div>
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
  console.log('✓', f.id);
}
await browser.close();
console.log('Done →', OUT);
