/**
 * Premium 3D hero App Store screenshots — DeepLife Simulator.
 *
 * HTML + real CSS 3D (perspective / rotateY / translateZ), rasterized to PNG at
 * Apple's required sizes via Playwright/Chromium. Replaces the old flat SVG
 * skew with genuine depth: a tilted device, layered ambient glow, and floating
 * glass "live" chips that pop forward off the screen. The on-device UI is a
 * faithful render of the CURRENT game (dark glass, the new vitals, the
 * redesigned Liquid Glass event card).
 *
 * Run: node scripts/generate-hero-3d.mjs [frameIndex]
 * Out: screenshots/hero-3d/iphone/*.png  +  screenshots/hero-3d/ipad/*.png
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'screenshots', 'hero-3d');

// Real in-game character art, embedded as data URIs so the on-device avatar is
// the actual game illustration (not an approximation).
const ART = {};
function loadArt() {
  const uri = (p) => 'data:image/png;base64,' + readFileSync(join(ROOT, p)).toString('base64');
  ART.female = uri('assets/images/Face/Female.png');
  ART.male = uri('assets/images/Face/Male.png');
  ART.oldFemale = uri('assets/images/Face/Old_Female.png');
  ART.baby = uri('assets/images/Face/Baby.png');
}

// ─────────────────────────────────────────────────────────────────────────────
// In-device UI — a faithful HTML render of the current game screens. Rendered at
// a fixed logical size (400 × 866) and scaled into the device frame.
// ─────────────────────────────────────────────────────────────────────────────
const SCREEN_W = 400, SCREEN_H = 866;

const HEADER = `
  <div class="hdr">
    <div class="genRow">
      <span class="gen">Gen 1</span>
    </div>
    <div class="hdrTop">
      <div class="circleBtns">
        <div class="cbtn">${ic('cart')}</div>
        <div class="cbtn">${ic('help')}</div>
        <div class="cbtn">${ic('gear')}</div>
        <div class="cbtn leaf">${ic('leaf')}</div>
      </div>
      <div class="dateCard">
        <div class="dYear">2025</div>
        <div class="dMonth">January</div>
        <div class="dAge">Age 20</div>
        <div class="dDots"><i></i><i></i><i></i><i></i></div>
      </div>
    </div>
    <div class="statRows">
      <div class="statR"><span class="sIco heart">${ic('heart')}</span><div class="sBar"><i class="fill red" style="width:62%"></i></div><span class="arr down">${ic('down')}</span></div>
      <div class="statR"><span class="sIco smile">${ic('smile')}</span><div class="sBar"><i class="fill amber" style="width:48%"></i></div><span class="arr down">${ic('down')}</span></div>
      <div class="statR"><span class="sIco bolt">${ic('bolt')}</span><div class="sBar"><i class="fill blue" style="width:88%"></i></div><span class="arr up">${ic('up')}</span></div>
    </div>
    <div class="walletRow">
      <div class="pill green">${ic('wallet')}<span>$4.80M</span></div>
      <div class="pill amber">${ic('pig')}<span>0</span></div>
      <div class="pill violet">${ic('gem')}<span>3,200</span></div>
      <div class="nextBtn">${ic('arrow')}</div>
    </div>
  </div>`;

function tabBar(active) {
  const tabs = [['home', 'Home'], ['work', 'Work'], ['pc', 'Computer'], ['cart2', 'Market'], ['heart2', 'Health']];
  return `<div class="tabbar">${tabs.map(([k, l]) =>
    `<div class="tab ${k === active ? 'on' : ''}">${ic(k)}<span>${l}</span></div>`).join('')}</div>`;
}

function screenHome() {
  return `
  <div class="screen">
    ${HEADER}
    <div class="dividerRow"><span>JANUARY</span><b>·</b><span class="accent">WEEK 1</span><b>·</b><span>AGE 20</span></div>
    <div class="idCard">
      <div class="portrait">${portrait()}</div>
      <div class="idName">Deborah Lopez</div>
      <div class="idRole">Chief of Medicine</div>
      <div class="idTiles">
        <div class="idTile"><span>Age</span><b>20</b></div>
        <div class="idTile"><span>Sex</span><b>Female</b></div>
        <div class="idTile"><span>Relationship</span><b>Single</b></div>
        <div class="idTile"><span>Job</span><b>Chief of Medi…</b></div>
      </div>
      <div class="nwRow">${ic('trend')}<span>Net Worth</span><b>$4.80M</b>${ic('chev')}</div>
      <div class="miniRow"><span>${ic('dollar')} Cash Flow</span><b>$4,800</b></div>
    </div>
    ${tabBar('home')}
  </div>`;
}

function condHeader() {
  // Compact header band (used on non-home frames) — the iconic Gen 1 row + stat
  // bars + wallet, minus the big date card so the frame content gets more room.
  return `
  <div class="hdr cond">
    <div class="hdrTop">
      <span class="gen">Gen 1</span>
      <div class="circleBtns">
        <div class="cbtn">${ic('cart')}</div><div class="cbtn">${ic('help')}</div>
        <div class="cbtn">${ic('gear')}</div><div class="cbtn leaf">${ic('leaf')}</div>
      </div>
    </div>
    <div class="statRows">
      <div class="statR"><span class="sIco heart">${ic('heart')}</span><div class="sBar"><i class="fill red" style="width:62%"></i></div></div>
      <div class="statR"><span class="sIco smile">${ic('smile')}</span><div class="sBar"><i class="fill amber" style="width:48%"></i></div></div>
      <div class="statR"><span class="sIco bolt">${ic('bolt')}</span><div class="sBar"><i class="fill blue" style="width:88%"></i></div></div>
    </div>
    <div class="walletRow">
      <div class="pill green">${ic('wallet')}<span>$4.80M</span></div>
      <div class="pill amber">${ic('pig')}<span>0</span></div>
      <div class="pill violet">${ic('gem')}<span>3,200</span></div>
      <div class="nextBtn">${ic('arrow')}</div>
    </div>
  </div>`;
}

function jobCard(name, pay, desc, energy, rank) {
  return `<div class="jobCard">
    <div class="jcHead"><b>${name}</b><span class="jcPay">${pay}</span></div>
    <p class="jcDesc">${desc}</p>
    <div class="jcStats"><span class="jcs bolt">${ic('bolt')}${energy}</span><span class="jcs">★ ${rank}</span><span class="jcs risk">${ic('alert')}1 risk</span></div>
    <div class="workBtn">WORK</div>
  </div>`;
}

function screenWork() {
  return `<div class="screen">
    ${condHeader()}
    <div class="jobHero">
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,.2)" stroke-width="8"/><circle cx="50" cy="50" r="42" fill="none" stroke="#60a5fa" stroke-width="8" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="203" transform="rotate(-90 50 50)"/></svg><span class="ringPct">23<i>%</i></span><span class="ringIco">${ic('brief')}</span></div>
      <div class="jobInfo">
        <span class="jhLabel">CURRENT JOB</span>
        <span class="jhTitle">Fast Food Worker</span>
        <span class="jhStage">${ic('trend')} Working toward promotion</span>
        <span class="jhMeta">$50/wk · Lv 1/6</span>
      </div>
    </div>
    <div class="subtabs"><span class="on">Street Hustle</span><span>Career</span><span>Crime Jobs</span></div>
    ${jobCard('Beg for Money', '$70–130', '30% chance to get money, small chance to be robbed', '20 energy', 'Rank 1')}
    ${jobCard('Dumpster Dive', '$84–156', '20% chance for money, rare chance for items', '15 energy', 'Rank 1')}
    ${tabBar('work')}
  </div>`;
}

function marketItem(ico, name, desc, price, col) {
  return `<div class="mItem">
    <div class="mIco" style="color:${col};background:${col}1f;border-color:${col}55">${ic(ico)}</div>
    <div class="mBody"><b>${name}</b><span>${desc}</span></div>
    <div class="mPrice">${price}</div>
  </div>`;
}
function screenMarket() {
  return `<div class="screen">
    ${condHeader()}
    <div class="secTitle">${ic('cart2')} Market <span class="secHint">Buy gear to unlock new features</span></div>
    <div class="chipsRow"><span class="fchip on">All</span><span class="fchip">Electronics</span><span class="fchip">Lifestyle</span></div>
    ${marketItem('brief', 'Gym Membership', 'Unlocks training & fitness gains', '$300', '#34d399')}
    ${marketItem('trend', 'Passport', 'Unlocks international travel', '$500', '#60a5fa')}
    ${marketItem('gem', 'Luxury Watch', 'Boosts reputation & style', '$1,200', '#a78bfa')}
    ${marketItem('pc', 'Gaming PC', 'Stream, invest & earn online', '$2,400', '#f472b6')}
    ${marketItem('wallet', 'Penthouse', 'Prestige home · appreciates', '$1.2M', '#fbbf24')}
    ${marketItem('brief', 'Exotic Supercar', 'Turns heads · +reputation', '$480K', '#f43f5e')}
    ${tabBar('cart2')}
  </div>`;
}

function appTile(ico, name, sub, col) {
  return `<div class="appTile">
    <div class="appIco" style="background:linear-gradient(150deg,${col},${col}bb)">${ic(ico)}</div>
    <b>${name}</b><span>${sub}</span>
  </div>`;
}
function screenSocial() {
  return `<div class="screen">
    ${condHeader()}
    <div class="secTitle">${ic('pc')} Phone <span class="secHint">Your apps &amp; empire</span></div>
    <div class="appGrid">
      ${appTile('bolt', 'Spark', 'Find your match', '#f43f5e')}
      ${appTile('trend', 'Pulse', 'Go viral', '#22d3ee')}
      ${appTile('trend', 'Stocks', 'Trade & invest', '#34d399')}
      ${appTile('gem', 'Crypto', 'HODL the dip', '#a78bfa')}
      ${appTile('wallet', 'Bank', 'Loans & savings', '#60a5fa')}
      ${appTile('brief', 'Hustle', 'Build a brand', '#fbbf24')}
      ${appTile('cart2', 'Shop', 'Gear & luxury', '#f472b6')}
      ${appTile('pc', 'Stream', 'Get famous', '#8b5cf6')}
      ${appTile('help', 'Dating', 'Swipe & match', '#fb7185')}
    </div>
    <div class="viralBar"><span>${ic('trend')} Followers</span><b>842.6K</b><span class="trend">+128K this week</span></div>
    ${tabBar('pc')}
  </div>`;
}

// The redesigned Liquid Glass "Heads Up" event card, centred on a dimmed screen.
function screenEvent() {
  return `<div class="screen evtScreen">
    <div class="evtGhost">${condHeader()}<div class="evtGhostCard"></div></div>
    <div class="evtDim"></div>
    <div class="evtCard">
      <div class="evtGlow"></div>
      <div class="evtHi"></div>
      <div class="evtClose">${ic('x')}</div>
      <div class="evtHead"><div class="evtChip">${ic('alert')}</div><div class="evtTitle">Heads Up</div></div>
      <p class="evtDesc">A buzzy new restaurant is booked out for weeks — but you can lock in a table tonight if you cover the reservation fee up front.</p>
      <div class="evtPanel">
        <div class="evtPanelT">CHOICE EFFECTS</div>
        <div class="evtEff">Pay the reservation fee</div>
        <div class="evtBadges"><span class="eb neg">−$45</span><span class="eb pos">Happiness +8</span></div>
      </div>
      <div class="evtBtn primary">${ic('checkc')} Pay the reservation fee</div>
      <div class="evtBtn secondary">Skip it, cook at home</div>
    </div>
  </div>`;
}

// ── tiny inline icons (stroked, currentColor) ──
function ic(name) {
  const s = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
  switch (name) {
    case 'cart': case 'cart2': return s('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>');
    case 'help': return s('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>');
    case 'gear': return s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
    case 'leaf': return s('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>');
    case 'heart': case 'heart2': return s('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>');
    case 'smile': return s('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>');
    case 'bolt': return s('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>');
    case 'down': return s('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>');
    case 'up': return s('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>');
    case 'wallet': return s('<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>');
    case 'pig': return s('<path d="M19 7c1.5 0 3 1.5 3 3.5S20.5 14 19 14"/><path d="M5 8a5 5 0 0 0 0 8h9a5 5 0 0 0 5-5 5 5 0 0 0-5-5H8"/><path d="M9 6a3 3 0 0 1 6 0"/><path d="M6 12h.01"/>');
    case 'gem': return s('<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>');
    case 'arrow': return s('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');
    case 'trend': return s('<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>');
    case 'chev': return s('<path d="m9 18 6-6-6-6"/>');
    case 'dollar': return s('<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>');
    case 'home': return s('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>');
    case 'work': return s('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>');
    case 'pc': return s('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>');
    case 'check': return s('<path d="M20 6 9 17l-5-5"/>');
    case 'checkc': return s('<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>');
    case 'alert': return s('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>');
    case 'x': return s('<path d="M18 6 6 18M6 6l12 12"/>');
    case 'brief': return s('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>');
    default: return s('<circle cx="12" cy="12" r="9"/>');
  }
}

// Real in-game character illustration, circular-cropped to the face.
function portrait(which = 'female') {
  return `<img class="pimg" src="${ART[which] || ART.female}" alt="">`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame definitions
// ─────────────────────────────────────────────────────────────────────────────
const FRAMES = [
  {
    file: '01-live-any-life', accent: '#b98cff', accentDeep: '#7c3aed',
    eyebrow: 'DEEPLIFE SIMULATOR', h1: 'Live any', h2: 'life.',
    sub: 'Be born, make choices, and write a story that is yours.',
    screen: screenHome, tilt: -1,
    chips: [
      { side: 'right', top: 26, x: -5, ico: 'trend', k: 'NET WORTH', v: '$4.80M', col: '#34d399' },
      { side: 'left', top: 42, x: -5, ico: 'brief', k: 'CAREER', v: 'Chief of Medicine', col: '#fbbf24' },
      { side: 'left', top: 68, x: -4, ico: 'gem', k: 'GEMS', v: '3,200', col: '#a78bfa' },
    ],
  },
  {
    file: '02-hustle-and-rise', accent: '#fbbf24', accentDeep: '#d97706',
    eyebrow: 'DEEPLIFE SIMULATOR', h1: 'Hustle &', h2: 'rise.',
    sub: 'Grind side jobs or climb a career — from the streets to CEO.',
    screen: screenWork, tilt: 1,
    chips: [
      { side: 'right', top: 43, x: -5, ico: 'wallet', k: 'WEEKLY INCOME', v: '+$4,800', col: '#34d399' },
      { side: 'left', top: 82, x: -5, ico: 'brief', k: 'DOZENS OF JOBS', v: 'Street → CEO', col: '#fbbf24' },
    ],
  },
  {
    file: '03-build-the-empire', accent: '#34d399', accentDeep: '#059669',
    eyebrow: 'DEEPLIFE SIMULATOR', h1: 'Build the', h2: 'empire.',
    sub: 'Invest, spend, and turn a paycheck into a fortune.',
    screen: screenMarket, tilt: -1,
    chips: [
      { side: 'right', top: 28, x: -5, ico: 'trend', k: 'NET WORTH', v: '$4.80M', col: '#34d399' },
      { side: 'left', top: 56, x: -5, ico: 'gem', k: 'PASSIVE INCOME', v: '+$72K/mo', col: '#a78bfa' },
    ],
  },
  {
    file: '04-go-viral', accent: '#22d3ee', accentDeep: '#0891b2',
    eyebrow: 'DEEPLIFE SIMULATOR', h1: 'Go', h2: 'viral.',
    sub: 'Date, post, and invest — a whole phone in your pocket.',
    screen: screenSocial, tilt: 1,
    chips: [
      { side: 'right', top: 30, x: -5, ico: 'trend', k: 'FOLLOWERS', v: '842.6K', col: '#22d3ee' },
      { side: 'left', top: 55, x: -5, ico: 'bolt', k: 'STATUS', v: '#1 Trending', col: '#f43f5e' },
    ],
  },
  {
    file: '05-every-choice-counts', accent: '#fbbf24', accentDeep: '#d97706',
    eyebrow: 'DEEPLIFE SIMULATOR', h1: 'Every choice', h2: 'counts.',
    sub: 'Life throws curveballs. Decide — and live with it.',
    screen: screenEvent, tilt: -1,
    chips: [
      { side: 'left', top: 22, x: -4, ico: 'alert', k: 'LIFE EVENTS', v: 'React & adapt', col: '#fbbf24' },
      { side: 'right', top: 74, x: -3, ico: 'gem', k: 'LIQUID GLASS', v: 'New design', col: '#a78bfa' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composition
// ─────────────────────────────────────────────────────────────────────────────
const DEVICES = {
  iphone: { W: 1320, H: 2868, phoneW: 716, cy: 0.525, headTop: 0.038, headScale: 1, chipScale: 1 },
  ipad:   { W: 2064, H: 2752, phoneW: 884, cy: 0.525, headTop: 0.055, headScale: 1.16, chipScale: 1.18 },
};
const BEZEL = 14;

function chipHTML(c, cs = 1) {
  const horiz = c.side === 'left' ? `left:${c.x ?? -7}%` : `right:${c.x ?? -7}%`;
  return `<div class="chip" style="${horiz};top:${c.top}%;transform:translateZ(${c.z ?? 165}px) scale(${cs})">
    <span class="chipIco" style="color:${c.col};background:${c.col}22;border-color:${c.col}55">${ic(c.ico)}</span>
    <span class="chipTxt"><i>${c.k}</i><b>${c.v}</b></span>
  </div>`;
}

function composeHTML(frame, device) {
  const d = DEVICES[device];
  const phoneW = d.phoneW;
  const screenW = phoneW - 2 * BEZEL;
  const contentScale = screenW / SCREEN_W;
  const screenH = Math.round(SCREEN_H * contentScale);
  const phoneH = screenH + 2 * BEZEL;
  const radius = Math.round(phoneW * 0.108);
  const screenR = radius - BEZEL;
  const island = Math.round(phoneW * 0.17);
  const cyPx = Math.round(d.cy * d.H);
  const rotY = frame.tilt * 16;
  const rotZ = frame.tilt * -1.4;
  const chips = frame.chips.map((c) => chipHTML(c, d.chipScale)).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${d.W}px; height:${d.H}px; overflow:hidden; }
  body { font-family:-apple-system,'SF Pro Display','Segoe UI',system-ui,sans-serif; }
  .stage {
    position:relative; width:${d.W}px; height:${d.H}px; overflow:hidden;
    background:
      radial-gradient(58% 42% at 50% ${d.cy * 100}%, ${frame.accentDeep}55, transparent 72%),
      radial-gradient(120% 70% at 50% -6%, ${frame.accent}2e, transparent 58%),
      radial-gradient(90% 50% at 50% 108%, ${frame.accentDeep}22, transparent 60%),
      linear-gradient(178deg, #0c1122 0%, #080b16 55%, #05070e 100%);
  }
  .stars i { position:absolute; width:3px; height:3px; border-radius:50%; background:#fff; }
  .head { position:absolute; left:0; right:0; top:${d.headTop * 100}%; text-align:center; z-index:6; padding:0 7%; }
  .eyebrow {
    display:inline-flex; align-items:center; gap:${9 * d.headScale}px; padding:${9 * d.headScale}px ${22 * d.headScale}px;
    border:1px solid ${frame.accent}66; border-radius:999px; background:${frame.accent}1f;
    font-size:${21 * d.headScale}px; font-weight:800; letter-spacing:.16em; color:${frame.accent};
    box-shadow:0 0 40px ${frame.accent}33;
  }
  .eyebrow::before { content:''; width:${9 * d.headScale}px; height:${9 * d.headScale}px; border-radius:50%; background:${frame.accent}; box-shadow:0 0 12px ${frame.accent}; }
  h1 { margin-top:${24 * d.headScale}px; font-size:${122 * d.headScale}px; line-height:.96; font-weight:900; letter-spacing:-.035em; color:#fff; text-shadow:0 6px 40px rgba(0,0,0,.45); }
  h1 .a { background:linear-gradient(180deg, ${frame.accent}, ${frame.accentDeep}); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { margin-top:${24 * d.headScale}px; font-size:${31 * d.headScale}px; font-weight:500; color:rgba(226,232,240,.82); }
  .footer { position:absolute; left:0; right:0; bottom:2.3%; text-align:center; z-index:6; }
  .footer .fl { font-size:${32}px; font-weight:800; color:#fff; letter-spacing:.01em; }
  .footer .fs { margin-top:9px; font-size:${21}px; font-weight:700; color:rgba(148,163,184,.85); letter-spacing:.22em; }

  /* 3D scene */
  .scene { position:absolute; inset:0; perspective:2400px; z-index:3; }
  .rig {
    position:absolute; left:50%; top:${cyPx}px; transform-style:preserve-3d;
    transform:translate(-50%,-50%) rotateY(${rotY}deg) rotateX(5deg) rotateZ(${rotZ}deg);
  }
  .phone {
    position:relative; width:${phoneW}px; height:${phoneH}px; border-radius:${radius}px; padding:${BEZEL}px;
    background:linear-gradient(150deg,#333c4d,#0a0d15 62%);
    box-shadow: 0 80px 140px rgba(0,0,0,.62), 0 0 0 2px rgba(255,255,255,.07), 0 0 90px ${frame.accentDeep}44, inset 0 0 0 1.5px rgba(255,255,255,.08);
  }
  .phone::after { content:''; position:absolute; inset:${BEZEL}px; border-radius:${screenR}px; box-shadow:inset 0 2px 22px rgba(255,255,255,.10); pointer-events:none; z-index:20; }
  .island { position:absolute; top:${Math.round(BEZEL + phoneW * 0.02)}px; left:50%; transform:translateX(-50%); width:${island}px; height:${Math.round(island * 0.29)}px; background:#04060c; border-radius:${island}px; z-index:15; }
  .glare { position:absolute; inset:${BEZEL}px; border-radius:${screenR}px; background:linear-gradient(118deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 28%); z-index:14; pointer-events:none; }

  .screenWrap { position:relative; width:${screenW}px; height:${screenH}px; border-radius:${screenR}px; overflow:hidden; background:#020617; }
  .screen { position:absolute; top:0; left:0; width:${SCREEN_W}px; height:${SCREEN_H}px; transform:scale(${contentScale}); transform-origin:top left; color:#e2e8f0; }

  /* floating glass chips — pop forward in the tilted space */
  .chip {
    position:absolute; display:flex; align-items:center; gap:13px; padding:14px 20px 14px 15px;
    border-radius:22px; background:linear-gradient(145deg, rgba(32,40,66,.98), rgba(14,19,36,.98));
    border:1px solid rgba(255,255,255,.12); white-space:nowrap;
    box-shadow: 0 34px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.12);
    z-index:30; transform-origin:center;
  }
  .chip .chipIco { width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; border:1px solid; flex:none; }
  .chip .chipIco svg { width:24px; height:24px; }
  .chip .chipTxt { display:flex; flex-direction:column; line-height:1.12; }
  .chip .chipTxt i { font-style:normal; font-size:14px; font-weight:800; letter-spacing:.1em; color:rgba(148,163,184,.95); }
  .chip .chipTxt b { font-size:25px; font-weight:800; color:#fff; margin-top:2px; }

  ${screenCSS()}
  </style></head><body>
  <div class="stage">
    <div class="stars">${starDots(frame.file)}</div>
    <div class="head">
      <span class="eyebrow">${frame.eyebrow}</span>
      <h1>${frame.h1}<br><span class="a">${frame.h2}</span></h1>
      <div class="sub">${frame.sub}</div>
    </div>
    <div class="scene"><div class="rig">
      <div class="phone">
        <div class="glare"></div><div class="island"></div>
        <div class="screenWrap">${frame.screen()}</div>
      </div>
      ${chips}
    </div></div>
    <div class="footer"><div class="fl">DeepLife Simulator</div><div class="fs">LIVE · BUILD · LOVE · LEGACY</div></div>
  </div></body></html>`;
}

function starDots(seed) {
  let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let out = '';
  for (let i = 0; i < 40; i++) out += `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;opacity:${(rnd() * 0.25).toFixed(2)}"></i>`;
  return out;
}

function screenCSS() {
  return `
  .hdr { padding:14px 14px 10px; }
  .genRow { margin-bottom:8px; }
  .gen { display:inline-block; padding:5px 12px; border-radius:999px; background:rgba(30,41,59,.8); font-size:12px; font-weight:800; color:#cbd5e1; }
  .hdrTop { display:flex; justify-content:space-between; align-items:flex-start; }
  .circleBtns { display:flex; gap:9px; }
  .cbtn { width:42px; height:42px; border-radius:50%; background:#1e293b; display:flex; align-items:center; justify-content:center; color:#cbd5e1; }
  .cbtn svg { width:20px; height:20px; }
  .cbtn.leaf { background:#10b981; color:#052e1b; }
  .dateCard { width:118px; padding:12px 8px 10px; border-radius:18px; background:linear-gradient(180deg,#93c5fd,#7cb0f7); text-align:center; color:#0b3a86; }
  .dateCard .dYear { font-size:22px; font-weight:900; }
  .dateCard .dMonth { font-size:20px; font-weight:900; margin-top:-2px; }
  .dateCard .dAge { font-size:14px; font-weight:800; margin-top:2px; }
  .dateCard .dDots { display:flex; gap:5px; justify-content:center; margin-top:6px; }
  .dateCard .dDots i { width:7px; height:7px; border-radius:50%; background:#0b3a86; }
  .statRows { margin:10px 0 0; display:flex; flex-direction:column; gap:7px; }
  .statR { display:flex; align-items:center; gap:9px; }
  .sIco { width:22px; display:flex; justify-content:center; } .sIco svg { width:19px; height:19px; }
  .sIco.heart { color:#34d399; } .sIco.smile { color:#fbbf24; } .sIco.bolt { color:#60a5fa; }
  .sBar { flex:1; height:15px; border-radius:999px; background:#1e293b; overflow:hidden; }
  .sBar .fill { display:block; height:100%; border-radius:999px; }
  .fill.red { background:#ef4444; } .fill.amber { background:#f59e0b; } .fill.blue { background:#3b82f6; }
  .arr { width:20px; display:flex; justify-content:center; } .arr svg { width:17px; height:17px; }
  .arr.down { color:#f87171; } .arr.up { color:#34d399; }
  .walletRow { display:flex; align-items:center; gap:8px; margin-top:11px; }
  .pill { display:flex; align-items:center; gap:6px; padding:9px 13px; border-radius:999px; font-size:15px; font-weight:800; color:#fff; }
  .pill svg { width:16px; height:16px; }
  .pill.green { background:#10b981; } .pill.amber { background:#f59e0b; } .pill.violet { background:#6366f1; }
  .nextBtn { margin-left:auto; width:44px; height:44px; border-radius:14px; background:#10b981; display:flex; align-items:center; justify-content:center; color:#fff; }
  .nextBtn svg { width:22px; height:22px; }
  .dividerRow { display:flex; align-items:center; justify-content:center; gap:9px; padding:12px 0 6px; font-size:14px; font-weight:800; letter-spacing:.12em; color:rgba(148,163,184,.75); }
  .dividerRow .accent { color:#34d399; } .dividerRow b { color:#334155; }
  .idCard { margin:6px 14px 0; padding:18px 16px; border-radius:20px; background:rgba(15,23,42,.72); border:1px solid rgba(255,255,255,.06); text-align:center; }
  .portrait { width:98px; height:98px; margin:0 auto; border-radius:50%; overflow:hidden; border:3px solid rgba(148,163,184,.45); box-shadow:0 0 0 5px rgba(15,23,42,.55), 0 8px 22px rgba(0,0,0,.4); background:#0f172a; }
  .portrait .pimg { width:100%; height:100%; object-fit:cover; object-position:50% 40%; display:block; }
  .idName { margin-top:12px; font-size:27px; font-weight:900; color:#fff; }
  .idRole { font-size:16px; font-weight:700; color:#fbbf24; margin-top:2px; }
  .idTiles { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
  .idTile { padding:12px; border-radius:14px; background:rgba(30,41,59,.6); }
  .idTile span { display:block; font-size:12px; font-weight:700; color:rgba(148,163,184,.85); }
  .idTile b { display:block; font-size:20px; font-weight:800; color:#f1f5f9; margin-top:3px; }
  .nwRow { display:flex; align-items:center; gap:8px; margin-top:14px; padding:13px 14px; border-radius:14px; background:rgba(16,185,129,.12); border:1px solid rgba(52,211,153,.35); color:#6ee7b7; font-weight:700; font-size:16px; }
  .nwRow svg { width:17px; height:17px; } .nwRow b { color:#a7f3d0; } .nwRow span { color:rgba(167,243,208,.85); }
  .nwRow svg:last-child { margin-left:auto; width:15px; height:15px; }
  .miniRow { display:flex; align-items:center; justify-content:space-between; margin-top:9px; padding:12px 14px; border-radius:14px; background:rgba(30,41,59,.5); font-size:15px; font-weight:700; color:#cbd5e1; }
  .miniRow svg { width:15px; height:15px; }
  .tabbar { position:absolute; left:0; right:0; bottom:0; height:76px; display:flex; background:rgba(8,12,22,.92); border-top:1px solid rgba(255,255,255,.06); }
  .tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#64748b; font-size:11px; font-weight:700; }
  .tab svg { width:22px; height:22px; } .tab.on { color:#60a5fa; }

  /* condensed header */
  .hdr.cond { padding:14px 14px 12px; }
  .hdr.cond .hdrTop { justify-content:space-between; align-items:center; }
  .hdr.cond .gen { margin:0; }

  /* work — current job hero + jobs */
  .jobHero { display:flex; align-items:center; gap:14px; margin:8px 14px 0; padding:14px; border-radius:18px; background:rgba(15,23,42,.6); border:1px solid rgba(255,255,255,.06); }
  .ring { position:relative; width:70px; height:70px; flex:none; }
  .ring svg { width:100%; height:100%; }
  .ringPct { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:19px; font-weight:900; color:#fff; }
  .ringPct i { font-style:normal; font-size:11px; margin-left:1px; }
  .ringIco { position:absolute; top:-6px; right:-6px; width:26px; height:26px; border-radius:9px; background:rgba(59,130,246,.16); border:1px solid rgba(59,130,246,.4); display:flex; align-items:center; justify-content:center; color:#60a5fa; }
  .ringIco svg { width:15px; height:15px; }
  .jobInfo { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .jhLabel { font-size:11px; font-weight:800; letter-spacing:.1em; color:rgba(148,163,184,.85); }
  .jhTitle { font-size:23px; font-weight:900; color:#fff; }
  .jhStage { display:flex; align-items:center; gap:6px; font-size:14px; font-weight:700; color:#93c5fd; margin-top:2px; }
  .jhStage svg { width:14px; height:14px; }
  .jhMeta { font-size:15px; font-weight:800; color:#cbd5e1; margin-top:2px; }
  .subtabs { display:flex; gap:8px; margin:12px 14px 0; padding:5px; border-radius:14px; background:rgba(15,23,42,.5); }
  .subtabs span { flex:1; text-align:center; padding:9px 4px; border-radius:10px; font-size:14px; font-weight:800; color:#94a3b8; }
  .subtabs .on { background:rgba(59,130,246,.22); color:#dbeafe; }
  .secTitle { display:flex; align-items:center; gap:8px; margin:14px 14px 0; font-size:19px; font-weight:900; color:#f8fafc; }
  .secTitle svg { width:19px; height:19px; color:#f87171; }
  .secHint { font-size:12px; font-weight:600; color:rgba(148,163,184,.8); margin-left:2px; }
  .jobCard { margin:12px 14px 0; padding:14px; border-radius:16px; background:rgba(15,23,42,.55); border:1px solid rgba(255,255,255,.06); }
  .jcHead { display:flex; align-items:baseline; justify-content:space-between; }
  .jcHead b { font-size:19px; font-weight:900; color:#fff; }
  .jcPay { font-size:16px; font-weight:800; color:#60a5fa; }
  .jcDesc { font-size:13px; color:rgba(203,213,225,.85); margin-top:4px; line-height:1.35; }
  .jcStats { display:flex; gap:12px; margin-top:8px; font-size:13px; font-weight:700; color:#cbd5e1; }
  .jcs { display:flex; align-items:center; gap:4px; } .jcs svg { width:14px; height:14px; }
  .jcs.bolt { color:#60a5fa; } .jcs.risk { color:#fbbf24; }
  .workBtn { margin-top:11px; padding:12px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#2563eb); text-align:center; font-size:16px; font-weight:900; color:#fff; letter-spacing:.05em; }

  /* market */
  .chipsRow { display:flex; gap:8px; margin:12px 14px 0; }
  .fchip { padding:8px 15px; border-radius:999px; font-size:13px; font-weight:800; color:#94a3b8; background:rgba(30,41,59,.6); }
  .fchip.on { background:rgba(99,102,241,.25); color:#c7d2fe; }
  .mItem { display:flex; align-items:center; gap:13px; margin:11px 14px 0; padding:14px; border-radius:16px; background:rgba(15,23,42,.55); border:1px solid rgba(255,255,255,.06); }
  .mIco { width:46px; height:46px; border-radius:13px; display:flex; align-items:center; justify-content:center; border:1px solid; flex:none; }
  .mIco svg { width:23px; height:23px; }
  .mBody { flex:1; display:flex; flex-direction:column; min-width:0; }
  .mBody b { font-size:17px; font-weight:800; color:#f1f5f9; }
  .mBody span { font-size:13px; color:rgba(148,163,184,.9); }
  .mPrice { font-size:18px; font-weight:900; color:#34d399; }

  /* social / phone app grid */
  .appGrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin:14px; }
  .appTile { display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 8px; border-radius:18px; background:rgba(15,23,42,.55); border:1px solid rgba(255,255,255,.06); }
  .appIco { width:52px; height:52px; border-radius:16px; display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 8px 18px rgba(0,0,0,.35); }
  .appIco svg { width:26px; height:26px; }
  .appTile b { font-size:14px; font-weight:800; color:#f1f5f9; }
  .appTile span { font-size:11px; color:rgba(148,163,184,.85); text-align:center; }
  .viralBar { display:flex; align-items:center; gap:8px; margin:2px 14px 0; padding:14px 16px; border-radius:16px; background:rgba(34,211,238,.1); border:1px solid rgba(34,211,238,.35); font-size:15px; font-weight:800; color:#a5f3fc; }
  .viralBar svg { width:16px; height:16px; } .viralBar b { color:#fff; font-size:19px; } .viralBar .trend { margin-left:auto; color:#67e8f9; font-size:13px; }

  /* event card (Liquid Glass) */
  .evtScreen { background:#020617; }
  .evtGhost { position:absolute; inset:0; opacity:.5; }
  .evtGhostCard { margin:12px 14px; height:300px; border-radius:22px; background:rgba(15,23,42,.5); border:1px solid rgba(255,255,255,.05); }
  .evtDim { position:absolute; inset:0; background:radial-gradient(85% 55% at 50% 45%, rgba(45,32,10,.35), transparent 70%), rgba(3,7,18,.82); }
  .evtCard { position:absolute; left:22px; right:22px; top:50%; transform:translateY(-50%); border-radius:26px; border:1px solid rgba(251,191,36,.42); background:rgba(17,24,39,.96); overflow:hidden; padding:20px 18px 18px; box-shadow:0 30px 60px rgba(0,0,0,.6), 0 0 40px rgba(251,191,36,.1); }
  .evtGlow { position:absolute; top:0; left:0; right:0; height:110px; background:radial-gradient(120% 80% at 50% -20%, rgba(217,119,6,.32), transparent 70%); }
  .evtHi { position:absolute; top:0; left:22px; right:22px; height:1px; background:rgba(255,255,255,.28); }
  .evtClose { position:absolute; top:14px; right:14px; width:32px; height:32px; border-radius:16px; background:rgba(148,163,184,.14); border:1px solid rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center; color:rgba(226,232,240,.75); }
  .evtClose svg { width:17px; height:17px; }
  .evtHead { position:relative; display:flex; align-items:center; gap:12px; margin-bottom:14px; }
  .evtChip { width:48px; height:48px; border-radius:24px; background:rgba(251,191,36,.13); border:1px solid rgba(251,191,36,.36); display:flex; align-items:center; justify-content:center; color:#fbbf24; }
  .evtChip svg { width:25px; height:25px; }
  .evtTitle { position:relative; font-size:23px; font-weight:900; color:#f8fafc; }
  .evtDesc { position:relative; font-size:15.5px; line-height:1.45; color:rgba(226,232,240,.92); margin-bottom:16px; }
  .evtPanel { position:relative; background:rgba(15,23,42,.55); border:1px solid rgba(148,163,184,.22); border-radius:16px; padding:15px; margin-bottom:16px; }
  .evtPanelT { font-size:12.5px; font-weight:800; letter-spacing:.06em; color:rgba(226,232,240,.72); margin-bottom:12px; }
  .evtEff { font-size:14px; font-weight:700; color:rgba(226,232,240,.92); margin-bottom:9px; }
  .evtBadges { display:flex; gap:9px; }
  .eb { padding:7px 13px; border-radius:9px; font-size:15px; font-weight:800; color:#fff; border:1px solid; }
  .eb.pos { background:rgba(16,185,129,.18); border-color:rgba(52,211,153,.55); }
  .eb.neg { background:rgba(239,68,68,.18); border-color:rgba(248,113,113,.55); }
  .evtBtn { position:relative; display:flex; align-items:center; justify-content:center; gap:9px; border-radius:16px; padding:16px; font-size:17px; font-weight:800; margin-top:12px; }
  .evtBtn svg { width:20px; height:20px; }
  .evtBtn.primary { background:linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 6px 18px rgba(5,150,105,.4); }
  .evtBtn.secondary { background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.25); color:rgba(226,232,240,.92); }
  `;
}

// A side-by-side contact sheet of a device's frames (preview only, not for upload).
async function contactSheet(browser, device) {
  const d = DEVICES[device];
  const gap = 26, tileW = 380, tileH = Math.round(tileW * d.H / d.W);
  const tiles = FRAMES.map((f) => {
    const uri = 'data:image/png;base64,' + readFileSync(join(OUT, device, `${f.file}.png`)).toString('base64');
    return `<img src="${uri}" style="width:${tileW}px;height:${tileH}px;border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.5)">`;
  }).join('');
  const W = FRAMES.length * tileW + (FRAMES.length + 1) * gap;
  const page = await browser.newPage({ viewport: { width: W, height: tileH + 2 * gap }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><body style="margin:0;background:#0a0d16"><div style="display:flex;gap:${gap}px;padding:${gap}px">${tiles}</div></body>`, { waitUntil: 'load' });
  await page.screenshot({ path: join(OUT, `_contact-${device}.png`) });
  await page.close();
}

async function main() {
  const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  loadArt();
  mkdirSync(join(OUT, 'iphone'), { recursive: true });
  mkdirSync(join(OUT, 'ipad'), { recursive: true });
  const browser = await chromium.launch();
  const frames = only ? [FRAMES[only - 1]] : FRAMES;
  for (const device of ['iphone', 'ipad']) {
    const d = DEVICES[device];
    const page = await browser.newPage({ viewport: { width: d.W, height: d.H }, deviceScaleFactor: 1 });
    for (const frame of frames) {
      await page.setContent(composeHTML(frame, device), { waitUntil: 'load' });
      await page.screenshot({ path: join(OUT, device, `${frame.file}.png`) });
      console.log('✓', device, frame.file);
    }
    await page.close();
  }
  if (!only) {
    for (const device of ['iphone', 'ipad']) await contactSheet(browser, device);
    console.log('✓ contact sheets');
  }
  await browser.close();
  console.log('Done →', OUT);
}
main();
