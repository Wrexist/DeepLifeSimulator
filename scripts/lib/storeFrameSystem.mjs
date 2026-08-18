/**
 * The store-screenshot design system.
 *
 * ONE module, imported by both the iPhone and the iPad generator, so the two
 * sets cannot drift — the pair it replaces had diverged to the point of using
 * different decoration positions for the same frame.
 *
 * Two rules run through every value below.
 *
 * 1. **The screenshot is the subject.** Everything else exists to frame it.
 *    `docs/store-screenshot-design.md` records what the 2026-07 version did
 *    instead (40 emoji stickers, three-stop gradient type, ten palettes, fake
 *    star dust, a halo ring, three skewed phones, a gloss sweep) and why the
 *    result read as machine-made.
 *
 * 2. **Every claim on a frame is legible inside that frame.** A pill is a
 *    caption for a number the reader can find in the screenshot beside it, not
 *    a marketing line. The version this replaces failed that on five of ten
 *    frames — "PhD unlocked" over a course catalogue with nothing marked
 *    earned, and "Rare collection" over a screen that reads `Collection (0)`
 *    and `0 / 6 collectibles`. Apple's Guideline 2.3.3 is about exactly this,
 *    and a claim the picture contradicts is the easiest kind to catch.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Inter Tight, embedded.
 *
 * NOT a stack of `-apple-system, 'SF Pro Display', …`. There is no Apple font
 * and no Inter on a CI box or in this container, so that stack fell through to
 * Liberation Sans — the headline shipped in an Arial clone, and in a different
 * face depending on who ran the generator. See `fonts/README.md`.
 */
const FONT_B64 = readFileSync(join(HERE, 'fonts', 'InterTight.woff2')).toString('base64');

/**
 * ONE ground for the whole set, taken from the app's own theme.
 *
 * Deliberately DEEPER than the app's `#0F172A` chrome so the device reads as
 * lighter than the ground it sits on; an earlier pass used a ground almost
 * identical to the UI and the phone dissolved into it.
 */
export const GROUND = {
  base: '#04070E',
  high: '#0A1020',
  foot: '#02040A',
  headline: '#F4F7FF',
  sub: 'rgba(206,219,247,0.70)',
  pillLabel: 'rgba(206,219,247,0.72)',
};

/**
 * The accent hues. **Every one is a value from `lib/config/theme.ts`** — the
 * same colours the app paints its own UI with.
 *
 * This is not the "ten palettes" tell from the old set. There, each frame
 * declared its own three background glows AND its own three accent colours, so
 * ten frames shared nothing and the set had no identity. Here the ground, the
 * type, the layout, the device treatment and the bloom geometry are IDENTICAL
 * on all ten; one hue moves, it is the app's own colour for that domain
 * (money is the app's money green, dating is the app's reputation pink, the
 * darknet terminal is its own terminal green), and it appears in exactly three
 * places — the accent word, the pill, and the light the screen spills on the
 * ground. A reader scrolling the carousel sees one series whose colour tracks
 * what is on screen, which is the opposite of ten unrelated images.
 */
export const HUE = {
  identity: '#60A5FA', // palette.infoLight   — energy / primary UI
  money: '#10B981', // palette.money       — cash, revenue, net worth
  romance: '#EC4899', // palette.reputation  — dating, fame, social
  market: '#F59E0B', // palette.happiness   — markets, crypto, trading
  mind: '#8B5CF6', // palette.fitness     — education, skills
  premium: '#A855F7', // accent.purple       — luxury, prestige
  apps: '#6366F1', // palette.gems        — the phone, the app grid
  terminal: '#34D399', // palette.successLight— the darknet terminal
};

/**
 * The ten frames, in upload order.
 *
 * - `head` — `|word|` marks the accent word. Five words or fewer; these are
 *   read as thumbnails in search results long before anyone opens the page.
 * - `num` / `label` — the proof pill, split so the number can carry the accent.
 *   **`num` must appear, verbatim or unmistakably, in the capture beside it.**
 *   `evidence` records where, so the next person can re-check it in seconds
 *   rather than trusting the copy.
 * - `pick` — the capture key, resolved by each generator against its own
 *   capture directory.
 */
export const FRAMES = [
  {
    id: '01-live-any-life',
    head: 'Live any |life.|',
    sub: 'Hustle, love, get rich, leave a legacy.',
    num: '$11M',
    label: 'net worth · age 22',
    hue: HUE.identity,
    pick: 'home',
    evidence: 'HUD wallet chip reads $11M; the identity card reads Age 22.',
    assert: ['$11M', 'Age', '22'],
  },
  {
    id: '02-find-your-person',
    head: 'Find your |person.|',
    sub: 'Swipe, match, fall in love — or don’t.',
    num: '30 swipes',
    label: 'left · 1 super',
    hue: HUE.romance,
    pick: 'spark',
    evidence: 'The Spark card footer reads "30 swipes left · 1 super".',
    assert: ['30 swipes left', '1 super'],
  },
  {
    id: '03-build-an-empire',
    head: 'Build an |empire.|',
    sub: 'Found companies. Set the price. Take the market.',
    num: '$8,000',
    label: 'a week in revenue',
    hue: HUE.money,
    pick: 'company',
    evidence: 'The empire snapshot reads $8,000 / wk and the company card repeats it.',
    assert: ['$8,000', 'EMPIRE SNAPSHOT'],
  },
  {
    id: '04-ride-the-bull-run',
    head: 'Ride the |bull run.|',
    sub: 'Trade crypto, mine it, time the market.',
    num: '2.000 BTC',
    label: 'held · bull regime',
    hue: HUE.market,
    pick: 'crypto',
    // The dollar value of that holding was in this pill until it was checked:
    // coin prices move every run, so "$61,911" was true of ONE capture and
    // would have quietly gone stale at the next one. The BTC amount is granted
    // flat by the darkweb setup, so it is the half that stays true.
    evidence: 'Holdings row reads "2.000 BTC" under a Bull Run banner; Bitcoin is in a bull regime.',
    assert: ['2.000', 'Bull Run', 'Bull regime'],
  },
  {
    id: '05-work-the-market',
    head: 'Work the |market.|',
    sub: 'Twenty-five tickers, six sectors, one call.',
    num: '25 listed',
    label: 'tickers · sector rotation live',
    hue: HUE.identity,
    // "eleven sectors" is what the first draft of the sub-line said, and
    // "15 advancing · 10 declining" is what this label said. `ALL_SECTORS` in
    // `lib/stocks/sectors.ts` has SIX, and the advancing/declining split is
    // re-rolled every run — it was true of one capture only. Copy written from
    // memory is exactly how a set ends up claiming things the game does not do.
    pick: 'stocks',
    evidence: 'Header counter reads 25 Listed; lib/stocks/sectors.ts holds 25 tickers over 6 sectors.',
    assert: ['25', 'Listed', 'Sector rotation'],
  },
  {
    id: '06-enter-the-dark-web',
    head: 'Enter the |dark web.|',
    sub: 'High risk, higher reward. Watch your heat.',
    num: 'Opsec Lv4',
    label: 'heat cold · vendors live',
    hue: HUE.terminal,
    pick: 'darkweb',
    evidence: 'The decay line reads "(opsec Lv4)" and the threat monitor reads "band=Cold".',
    assert: ['opsec Lv4', 'Cold'],
  },
  {
    id: '07-phone-full-of-lives',
    head: 'A phone full of |lives.|',
    sub: 'Dating, trading, banking, fame — all in game.',
    num: '6 apps',
    label: 'on the phone · ten more on desktop',
    // The one frame whose proof is genuinely different per device, so it is the
    // one frame that overrides it.
    //
    // The old caption here was "Every app unlocked" over a grid of six tiles.
    // Six is the number in the iPhone picture — but the iPad grid is three
    // columns wide and fits NINE without scrolling, so a single shared "6 apps"
    // would have been false on the tablet shelf in the same way the original
    // was false on both. Anything shared and count-free ("every app", "a phone
    // full") is how this went wrong the first time, so the count stays and the
    // shelf that shows more says so.
    //
    // `items` is what makes the count checkable. The other nine frames quote a
    // number the UI PRINTS, so the test can look for it; a count of tiles is
    // not printed anywhere, so the frame lists the tiles instead and the test
    // asserts both that each one is visible and that there are as many of them
    // as the pill claims.
    items: ['Spark', 'Contacts', 'DeepMail', 'Pulse', 'Stocks', 'Bank'],
    byKind: {
      tablet: {
        num: '9 apps',
        label: 'on the phone · ten more on desktop',
        items: ['Spark', 'Contacts', 'DeepMail', 'Pulse', 'Stocks', 'Bank', 'Education', 'Hustle', 'Pets'],
      },
    },
    hue: HUE.apps,
    pick: 'apps',
    evidence: 'The Mobile Apps grid shows six tiles at phone width and nine at tablet width; the desktop launcher adds ten more.',
    assert: ['Mobile Apps'],
  },
  {
    id: '08-train-your-mind',
    head: 'Train your |mind.|',
    sub: 'Degrees, skills and smarter choices.',
    num: '7 credentials',
    label: 'earned · every one on record',
    hue: HUE.mind,
    pick: 'education',
    // Was "PhD unlocked" over the Catalog tab — a list of courses NOT taken,
    // each with a price and an Enroll button. The Earned tab is the screen
    // that holds the proof: a transcript, and every credential stamped
    // "Graduated · On record".
    //
    // The label deliberately does not name the degrees. Naming them ("MBA, law,
    // medicine") reads better and is false on one shelf: the phone fits six
    // rows down to Law School, the iPad's taller rows stop at Medical School.
    // A caption has to hold on both shelves or it is a caption for one of them.
    evidence: 'The transcript card reads "7 credentials earned"; every row below it is stamped Graduated · On record on both shelves.',
    assert: ['credentials earned', 'MBA', 'Graduated', 'On record'],
  },
  {
    id: '09-live-the-luxury',
    head: 'Live the |luxury.|',
    sub: 'Watches, supercars and museum-grade pieces.',
    num: '2 of 6',
    label: 'trophies acquired',
    hue: HUE.premium,
    pick: 'luxury',
    // Was "Rare collection" over the Browse tab, which read `Collection (0)`
    // and `0 / 6 collectibles` — the player owned nothing at all. The capture
    // now buys two pieces through the app's own Buy button and photographs the
    // Collection tab, so the caption describes something that is on screen.
    evidence: 'The Luxury Life card reads "2 / 6 collectibles" after the capture buys the watch case and the diamond.',
    assert: ['2 / 6 collectibles', 'Collection (2)'],
  },
  {
    id: '10-raise-a-family',
    head: 'Raise a |family.|',
    sub: 'Marry, have kids, pass it all on.',
    num: '5 people',
    label: 'in your circle',
    hue: HUE.romance,
    pick: 'contacts',
    evidence: 'The relationship portfolio card counts 5 people: both parents, a spouse and two children.',
    assert: ['RELATIONSHIP PORTFOLIO', 'People', 'Strong'],
  },
];

/**
 * Derives every layout number from the canvas.
 *
 * The set this replaces rendered ONE 1320×2868 canvas and scaled it to 6.5"
 * with `scale(sx, sy)` where `sx !== sy` — 0.9727 across, 0.9686 down — so the
 * whole 6.5" set was squashed 0.4% anamorphically. Every size now derives its
 * own numbers from its own canvas and renders natively, which costs nothing
 * and cannot distort.
 *
 * `kind` is `'phone'` or `'tablet'`: a tablet canvas is far wider relative to
 * its height, so the device takes a smaller share of the width and the margins
 * grow. The numbers differ; the design does not.
 */
export function layoutFor(W, H, kind = 'phone') {
  const tablet = kind === 'tablet';

  // The device is derived from the HEIGHT it is given, not from a share of the
  // width, and it is fully CONTAINED. Sizing it by width instead is how the
  // first attempt ended up running the phone 54px past the bottom edge — a
  // 2% bleed, too small to read as a deliberate crop and too big to read as a
  // margin, and it sliced the tab bar in half. The tab bar is product; a
  // screenshot that eats it looks like a mistake, because it is one.
  const devTop = Math.round(H * (tablet ? 0.268 : 0.255));
  const footer = Math.round(H * (tablet ? 0.030 : 0.024));
  const devH = H - devTop - footer;
  // The capture's own aspect: 1290×2796 phone, 2048×2732 tablet.
  const screenAspect = tablet ? 2732 / 2048 : 2796 / 1290;
  const bezel = Math.round(H * (tablet ? 0.0055 : 0.0053));
  const devW = Math.round((devH - bezel * 2) / screenAspect) + bezel * 2;

  return {
    W, H, kind, devW, devH, bezel, devTop,
    devR: Math.round(devW * (tablet ? 0.055 : 0.093)),
    scrR: Math.round(devW * (tablet ? 0.043 : 0.078)),

    // The type block's BOTTOM edge; extra headline lines grow upward.
    headBaseline: Math.round(H * (tablet ? 0.205 : 0.195)),
    headPad: Math.round(W * (tablet ? 0.115 : 0.068)),
    h1: Math.round(W * (tablet ? 0.075 : 0.0945)),
    h1Track: -Math.round(W * (tablet ? 0.0018 : 0.0023) * 10) / 10,
    sub: Math.round(W * (tablet ? 0.0265 : 0.0322)),
    subGap: Math.round(H * 0.0118),
    // The pill is a proof point, so it is sized to be READ, not to be tucked
    // away — the version this replaces set it at 27px on a 1320px canvas and
    // it vanished at carousel scale.
    pill: Math.round(W * (tablet ? 0.0185 : 0.0242)),
    pillGap: Math.round(H * 0.0145),
    pillPadX: Math.round(W * (tablet ? 0.021 : 0.028)),
    pillPadY: Math.round(W * (tablet ? 0.0105 : 0.0142)),

    bloomW: Math.round(W * 1.15),
    bloomH: Math.round(H * 0.55),
    bloomY: Math.round(H * (tablet ? 0.30 : 0.315)),
    shadowH: Math.round(H * 0.035),
  };
}

/** `#RRGGBB` → `"r,g,b"`, so one hue can drive both solid and alpha colours. */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * Builds one frame's HTML.
 *
 * `L` carries the per-canvas layout from `layoutFor`; everything else is
 * shared, so the iPad set differs from the iPhone set only in proportion.
 */
export function frameHtml(frame, shot, L) {
  const head = frame.head.replace('|', '<span class="acc">').replace('|', '</span>');
  const A = frame.hue;
  const a = rgb(A);
  const G = GROUND;
  // A frame may override its proof pill for a device class whose layout shows
  // genuinely different content — see frame 07. Everything else is shared.
  const { num, label } = { num: frame.num, label: frame.label, ...(frame.byKind?.[L.kind] || {}) };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @font-face {
    font-family:'Inter Tight';
    src:url(data:font/woff2;base64,${FONT_B64}) format('woff2');
    font-weight:100 900; font-style:normal; font-display:block;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${L.W}px; height:${L.H}px; overflow:hidden; }
  body {
    font-family:'Inter Tight',-apple-system,'Segoe UI',sans-serif;
    background:${G.base};
    -webkit-font-smoothing:antialiased;
    text-rendering:geometricPrecision;
  }
  .canvas { position:relative; width:${L.W}px; height:${L.H}px; overflow:hidden; }

  /* GROUND — identical geometry on all ten frames. Only the hue moves, and it
     is the app's own colour for what is on screen. */
  .bg {
    position:absolute; inset:0;
    background:
      radial-gradient(${L.bloomW}px ${L.bloomH}px at 50% ${L.bloomY}px, rgba(${a},0.17), transparent 68%),
      radial-gradient(${Math.round(L.W * 1.35)}px ${Math.round(L.H * 0.30)}px at 50% ${Math.round(L.H * 0.06)}px, rgba(${a},0.085), transparent 70%),
      linear-gradient(180deg, ${G.high} 0%, ${G.base} 54%, ${G.foot} 100%);
  }
  .vig {
    position:absolute; inset:0;
    background:radial-gradient(118% 76% at 50% 40%, transparent 50%, rgba(0,0,0,0.48) 100%);
  }

  /* TYPE — anchored by its BOTTOM edge, not its top. A headline that wraps to
     two lines grows UPWARD into the top margin instead of pushing the device
     down, so the device sits at exactly the same height in all ten frames. A
     phone that jumps between frames reads as "generated" even when no single
     frame looks wrong. */
  .head {
    position:absolute; bottom:${L.H - L.headBaseline}px; left:0; right:0;
    text-align:center; padding:0 ${L.headPad}px; z-index:4;
  }
  h1 {
    font-size:${L.h1}px; line-height:1.02; font-weight:800;
    letter-spacing:${L.h1Track}px; color:${G.headline};
  }
  /* ONE accent colour, flat. The version this replaces ran a three-stop
     rainbow gradient through this word. */
  h1 .acc { color:${A}; }
  .sub {
    margin-top:${L.subGap}px; font-size:${L.sub}px; font-weight:500;
    line-height:1.3; color:${G.sub}; letter-spacing:0.1px;
  }
  /* The proof pill. Two-tone so the NUMBER leads: it is the part that has to
     be findable in the screenshot below. */
  .stat {
    display:inline-flex; align-items:baseline; gap:${Math.round(L.pill * 0.42)}px;
    margin-top:${L.pillGap}px;
    padding:${L.pillPadY}px ${L.pillPadX}px; border-radius:999px;
    font-size:${L.pill}px; letter-spacing:0.2px;
    background:rgba(${a},0.085);
    border:1px solid rgba(${a},0.26);
  }
  .stat .n { font-weight:700; color:${A}; }
  .stat .l { font-weight:500; color:${G.pillLabel}; }

  /* DEVICE — one, straight on, centred. Near-black so it reads as hardware
     against the ground rather than as a grey card; the rim highlight is the
     only "shine", and it sits on the BEZEL, never across the screen, because a
     gloss sweep over the UI hides the product. */
  .device {
    position:absolute; left:50%; top:${L.devTop}px;
    width:${L.devW}px; height:${L.devH}px;
    transform:translateX(-50%); z-index:3;
    padding:${L.bezel}px; border-radius:${L.devR}px;
    /* Brushed titanium read from a lit top-left. Pure near-black loses the
       silhouette entirely against this ground — the phone stops looking like
       hardware and starts looking like a screenshot with a rounded corner. */
    background:linear-gradient(152deg, #7D8697 0%, #39404E 22%, #1B1F28 48%, #262C37 74%, #6A7383 100%);
    box-shadow:
      0 ${Math.round(L.devW * 0.075)}px ${Math.round(L.devW * 0.17)}px rgba(0,0,0,0.66),
      0 ${Math.round(L.devW * 0.02)}px ${Math.round(L.devW * 0.05)}px rgba(0,0,0,0.52),
      0 0 ${Math.round(L.devW * 0.16)}px rgba(${a},0.16),
      inset 0 0 0 1px rgba(255,255,255,0.07);
  }
  /* A hairline inner edge where the bezel meets the glass — the only "shine"
     on the device, and it sits on the BEZEL. A gloss sweep across the UI, which
     is what the old set drew, hides the product it is meant to sell. */
  .device::after {
    content:''; position:absolute; inset:${Math.round(L.bezel * 0.34)}px;
    border-radius:${L.devR - Math.round(L.bezel * 0.34)}px;
    border:1px solid rgba(255,255,255,0.14); pointer-events:none;
  }
  .screen {
    position:relative; height:100%; border-radius:${L.scrR}px;
    overflow:hidden; background:#0B1220;
  }
  .screen img { display:block; width:100%; }

  /* The light the screen spills on the ground, and the shadow that sits the
     device on it. Both are physical: a lit rectangle in a dark room throws
     colour, and an object above a surface casts a contact shadow. Neither is
     decoration hung off the composition. */
  .spill {
    position:absolute; left:50%; transform:translateX(-50%);
    top:${L.devTop - Math.round(L.H * 0.075)}px;
    width:${Math.round(L.devW * 1.55)}px; height:${Math.round(L.H * 0.18)}px;
    background:radial-gradient(closest-side, rgba(${a},0.30), transparent 74%);
    filter:blur(${Math.round(L.W * 0.035)}px); z-index:2;
  }
  .contact {
    position:absolute; left:50%; transform:translateX(-50%);
    top:${L.devTop - Math.round(L.shadowH * 0.55)}px;
    width:${Math.round(L.devW * 0.9)}px; height:${L.shadowH}px;
    background:radial-gradient(closest-side, rgba(0,0,0,0.72), transparent 76%);
    filter:blur(${Math.round(L.shadowH * 0.28)}px); z-index:2;
  }
  </style></head><body><div class="canvas">
    <div class="bg"></div>
    <div class="vig"></div>
    <div class="head">
      <h1>${head}</h1>
      <div class="sub">${frame.sub}</div>
      <div><span class="stat"><span class="n">${num}</span><span class="l">${label}</span></span></div>
    </div>
    <div class="spill"></div>
    <div class="contact"></div>
    <div class="device"><div class="screen"><img src="${shot}"></div></div>
  </div></body></html>`;
}
