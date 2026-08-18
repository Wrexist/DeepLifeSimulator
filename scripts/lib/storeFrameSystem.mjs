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
  gold: '#FACC15', // accent.gold        — prestige, legacy, the payoff
};

/**
 * Frame key → capture basename, shared by both generators AND the claims test.
 *
 * It lived in three places — once per generator and once in the test — until a
 * frame list that added `earlyhome` and `earlywork` updated two of them and the
 * test failed on a map it had no reason to know about. One table, imported.
 *
 * Four picks deliberately do NOT use the obvious capture, and each is a claim
 * an earlier set could not back up:
 *
 * - `earlyhome` / `earlywork` are shot BEFORE any dev-tools grant lands. Every
 *   other capture here is one rich late-game save, which can only ever show the
 *   destination; these are the only way frame 01 can say "start with nothing".
 * - `education` is the **Earned** tab, not the Catalog. The Catalog lists
 *   courses NOT taken, each with a price and an Enroll button, so captioning it
 *   "PhD unlocked" described something the picture did not contain.
 * - `luxury` is the **Collection** tab after the capture buys two pieces, not
 *   the Browse shop, which read `Collection (0)` under the words "Rare collection".
 * - `contacts`, not the Family tab, for the family frame: shown large and alone
 *   the Family tab is an EMPTY STATE — a pink "Open the dating app" button
 *   under "No partner yet". Contacts carries the same idea and is full.
 */
export const CAPTURES = {
  earlyhome: '30-early-home.png',
  earlywork: '31-early-work.png',
  home: '00-home.png',
  spark: '05-app-spark.png',
  stocks: '07-app-stocks.png',
  contacts: '09-app-contacts.png',
  apps: '03-apps.png',
  company: '17-x-company.png',
  darkweb: '18-x-darkweb.png',
  crypto: '19-x-crypto.png',
  education: '28-app-education-earned.png',
  luxury: '29-x-luxury-collection.png',
  // Flank-only captures. These carry no claim — the chip always describes the
  // hero — but they are real screens of the shipping build like everything else.
  bank: '08-app-bank.png',
  pulse: '06-app-pulse.png',
  life: '11-life.png',
  market: '13-life-market.png',
  desktop: '16-desktop.png',
  politics: '23-x-politics.png',
  travel: '24-x-travel.png',
  garage: '21-x-garage.png',
  catalog: '10-app-education.png',
};

/**
 * The ten frames — ONE LIFE, in order.
 *
 * This is a story, not a feature tour, and that is the change that matters
 * most. The version this replaces was a catalogue: ten domains listed in no
 * particular order, each frame arguing on its own. A life sim's product IS the
 * arc — the distance between where you start and where you end up — so the set
 * now runs start → grind → love → study → markets → crime → empire → luxury →
 * family → legacy, and the headlines read top to bottom as sentences of one
 * story.
 *
 * The bookend is deliberate: frame 01 and frame 10 are the SAME SCREEN, the
 * home identity card, photographed at $1,500 and again at $11M. Nothing else
 * in a store listing can say "this is how far you get" as plainly as the same
 * screen twice.
 *
 * Ordering rules that came out of the research (see docs/store-screenshot-design.md):
 *
 * - **Frames 1–3 have to work alone.** iOS renders the first three in search
 *   results, before anyone opens the page, so they carry hook → mechanic →
 *   stakes on their own.
 * - **Five words or fewer per headline.** These are read at thumbnail size.
 * - **Adjacent frames never share a hue**, so the carousel reads as movement.
 *
 * Field notes:
 * - `head` — `|word|` marks the accent word.
 * - `num` / `label` — the proof chip, which sits ON the hero device rather than
 *   floating in the type block, so the number is next to the pixels that prove
 *   it. `num` must appear in the capture; `evidence` says where; `assert` is
 *   what the test looks for.
 * - `pick` is the hero capture, `support` the two flanks (which carry no claim).
 */
export const FRAMES = [
  {
    id: '01-start-with-nothing',
    // Flanks: the job that pays for it, and the bank balance behind it.
    support: ['earlywork', 'bank'],
    head: 'Start with |nothing.|',
    sub: 'Twenty years old, unemployed, and the rent is coming.',
    num: '$1,500',
    label: 'to your name',
    hue: HUE.identity,
    pick: 'earlyhome',
    // Photographed BEFORE any dev-tools grant lands, which is the only way this
    // frame can be true — every other capture in the set is one rich late-game
    // save and can only ever show the destination.
    //
    // The game writes this frame's copy better than marketing could: the screen
    // itself carries a coaching card reading "You need work — No job means no
    // money coming in", the Job field reads Unemployed and Reputation reads
    // "0 · Unknown". Nothing here had to be dressed up.
    evidence: 'The opening home screen reads $1,500, Job: Unemployed, Reputation 0 · Unknown, over a "You need work" card.',
    assert: ['$1,500', 'Unemployed', 'You need work'],
  },
  {
    id: '02-take-any-job',
    support: ['earlyhome', 'market'],
    head: 'Take any |job.|',
    sub: 'Street work, a career ladder, or the crime jobs.',
    // The bottom rung is real and it is on this screen: under the scooter
    // rentals the list ends at "Beg for Money, $28–52".
    num: '3 ways',
    label: 'to earn this week',
    hue: HUE.market,
    pick: 'earlywork',
    // A count of the tabs on the screen, so it is checked as a count: the three
    // named things all have to be visible and there have to be three of them.
    items: ['Street Hustle', 'Career', 'Crime Jobs'],
    evidence: 'The Work screen carries exactly three earning tabs: Street Hustle, Career, Crime Jobs.',
    assert: ['Street Jobs'],
  },
  {
    id: '03-fall-for-someone',
    support: ['contacts', 'pulse'],
    head: 'Fall for |someone.|',
    sub: 'Swipe, match, fall in love — or don’t.',
    num: '30 swipes',
    label: 'left · 1 super',
    hue: HUE.romance,
    pick: 'spark',
    evidence: 'The Spark card footer reads "30 swipes left · 1 super".',
    assert: ['30 swipes left', '1 super'],
  },
  {
    id: '04-earn-the-degree',
    support: ['catalog', 'contacts'],
    head: 'Earn the |degree.|',
    sub: 'Seven credentials, from high school to a PhD.',
    num: '7 credentials',
    label: 'earned · every one on record',
    hue: HUE.mind,
    pick: 'education',
    // Was "PhD unlocked" over the Catalog tab — a list of courses NOT taken,
    // each with a price and an Enroll button. The Earned tab is the screen that
    // holds the proof: a transcript, every credential stamped Graduated.
    evidence: 'The transcript card reads "7 credentials earned"; every row below is stamped Graduated · On record.',
    assert: ['credentials earned', 'MBA', 'Graduated', 'On record'],
  },
  {
    id: '05-play-the-markets',
    support: ['bank', 'crypto'],
    head: 'Play the |markets.|',
    sub: 'Twenty-five tickers, six sectors, one call.',
    num: '25 listed',
    label: 'tickers · sector rotation live',
    hue: HUE.premium,
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
    id: '06-work-the-dark-web',
    support: ['crypto', 'desktop'],
    head: 'Work the |dark web.|',
    sub: 'High risk, higher reward. Watch your heat.',
    num: 'Opsec Lv4',
    label: 'heat cold · vendors live',
    hue: HUE.terminal,
    pick: 'darkweb',
    evidence: 'The decay line reads "(opsec Lv4)" and the threat monitor reads "band=Cold".',
    assert: ['opsec Lv4', 'Cold'],
  },
  {
    id: '07-build-the-empire',
    support: ['politics', 'apps'],
    head: 'Build the |empire.|',
    sub: 'Found companies. Set the price. Take the market.',
    num: '$8,000',
    label: 'a week in revenue',
    hue: HUE.money,
    pick: 'company',
    evidence: 'The empire snapshot reads $8,000 / wk and the company card repeats it.',
    assert: ['$8,000', 'EMPIRE SNAPSHOT'],
  },
  {
    id: '08-buy-the-impossible',
    support: ['garage', 'travel'],
    head: 'Buy the |impossible.|',
    sub: 'Watches, supercars and museum-grade pieces.',
    num: '2 of 6',
    label: 'trophies acquired',
    hue: HUE.apps,
    // Was "Rare collection" over the Browse tab, which read `Collection (0)` and
    // `0 / 6 collectibles` — the player owned nothing at all. The capture now
    // buys two pieces through the app's own Buy button and photographs the
    // Collection tab, so the caption describes something that is on screen.
    pick: 'luxury',
    evidence: 'The Luxury Life card reads "2 / 6 collectibles" after the capture buys the watch case and the diamond.',
    assert: ['2 / 6 collectibles', 'Collection (2)'],
  },
  {
    id: '09-raise-a-family',
    support: ['spark', 'life'],
    head: 'Raise a |family.|',
    sub: 'Marry, have kids, pass it all on.',
    num: '5 people',
    label: 'in your circle',
    hue: HUE.romance,
    pick: 'contacts',
    evidence: 'The relationship portfolio card counts 5 people: both parents, a spouse and two children.',
    assert: ['RELATIONSHIP PORTFOLIO', 'People', 'Strong'],
  },
  {
    id: '10-leave-a-legacy',
    support: ['stocks', 'luxury'],
    head: 'Leave a |legacy.|',
    sub: 'Eleven million later. Then prestige, and go again.',
    num: '$11M',
    label: 'net worth · age 22',
    hue: HUE.gold,
    pick: 'home',
    // The bookend. Same screen as frame 01, same character, same age — only the
    // number moved. That comparison is the whole product in one pair of images,
    // and it is the reason the set opens on a capture taken before the grants.
    evidence: 'HUD wallet chip reads $11M on the same home screen frame 01 shows at $1,500.',
    assert: ['$11M', 'Age', '22'],
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
  const devTop = Math.round(H * (tablet ? 0.286 : 0.272));
  const footer = Math.round(H * (tablet ? 0.030 : 0.028));
  const devH = H - devTop - footer;
  // The capture's own aspect: 1290×2796 phone, 2048×2732 tablet.
  const screenAspect = tablet ? 2732 / 2048 : 2796 / 1290;
  const bezel = Math.round(H * (tablet ? 0.0055 : 0.0053));
  const devW = Math.round((devH - bezel * 2) / screenAspect) + bezel * 2;

  // Flank geometry, derived from the hero so the two can never disagree about
  // proportion. Kept to the same aspect as the hero — a flank that is a
  // different SHAPE from the device beside it reads as a different product.
  // The two shelves need genuinely different flank models, because the SHAPE
  // of the canvas differs, not just its size.
  //
  // A 2.17-tall phone canvas holding a 2.17-tall device leaves no width for a
  // flank the same height, so the phone's flanks are much shorter and are
  // RAISED — the empty ground that leaves falls in the bottom corners, where
  // the vignette and the hero's contact shadow already are.
  //
  // A 1.33 tablet canvas is proportionally far wider, so the same treatment
  // left two large empty rectangles low and outboard. There the flanks are
  // near hero height and sit on the SAME baseline, and the three devices read
  // as one band.
  const sideW = Math.round(devW * (tablet ? 0.90 : 0.86));
  const sideBezel = Math.max(1, Math.round(bezel * (tablet ? 0.70 : 0.735)));
  const sideH = Math.round((sideW - sideBezel * 2) * screenAspect) + sideBezel * 2;

  return {
    W, H, kind, devW, devH, bezel, devTop,
    devR: Math.round(devW * (tablet ? 0.055 : 0.093)),
    scrR: Math.round(devW * (tablet ? 0.043 : 0.078)),

    // The type block's BOTTOM edge; extra headline lines grow upward.
    headBaseline: Math.round(H * (tablet ? 0.212 : 0.205)),
    headPad: Math.round(W * (tablet ? 0.115 : 0.068)),
    h1: Math.round(W * (tablet ? 0.075 : 0.0945)),
    h1Track: -Math.round(W * (tablet ? 0.0018 : 0.0023) * 10) / 10,
    sub: Math.round(W * (tablet ? 0.0265 : 0.0322)),
    subGap: Math.round(H * 0.0118),
    // The pill is a proof point, so it is sized to be READ, not to be tucked
    // away — the version this replaces set it at 27px on a 1320px canvas and
    // it vanished at carousel scale.
    // The proof chip, anchored to the hero device rather than centred in the
    // type block. It overhangs the device's left edge so it reads as a label ON
    // the screen, the way a callout does — the number and the pixels that prove
    // it end up in the same glance instead of 400px apart.
    chip: Math.round(W * (tablet ? 0.0185 : 0.0255)),
    chipPadX: Math.round(W * (tablet ? 0.021 : 0.030)),
    chipPadY: Math.round(W * (tablet ? 0.0105 : 0.0148)),
    chipX: Math.round(W * (tablet ? 0.070 : 0.040)),
    chipY: devTop + Math.round(H * (tablet ? 0.050 : 0.046)),

    bloomW: Math.round(W * 1.15),
    bloomH: Math.round(H * 0.55),
    bloomY: Math.round(H * (tablet ? 0.30 : 0.315)),
    shadowH: Math.round(H * 0.035),

    // ── The flanking devices ────────────────────────────────────────────────
    //
    // A second and third screen per frame, which is what the ORIGINAL store set
    // did and what this one lost when it was cut back to a single device. The
    // difference is in the four things that made the original read as a
    // template, all of which are fixed here rather than repeated:
    //
    //  - **Hierarchy.** There, the "main" phone was about a third of the frame
    //    and the two flanks were the same size as each other and nearly as
    //    large as it, so nothing led. Here the hero is ~2x the flank area and
    //    sits in front; the flanks are context, not competition.
    //  - **They were cropped to nothing.** `left:-160px` / `right:-160px` on a
    //    ~400px device is 40% of each one off the canvas. The flanks here lose
    //    a deliberate sliver at the edge and keep the rest.
    //  - **The rotations were arbitrary** — `rotateY(±24deg) rotateZ(∓9deg)`,
    //    a tilt with no optical justification, which is what made them read as
    //    stickers. These share ONE perspective origin and rotate only in Y, so
    //    the two flanks turn to face the same viewer. That is a camera, not a
    //    decoration.
    //  - **They were unreadable**, so they were texture standing in for
    //    content. These stay legible: dimmed, never blurred. A screenshot you
    //    cannot read is decoration no matter what is on it.
    sideW: sideW,
    sideH: sideH,
    sideBezel: sideBezel,
    sideR: Math.round(sideW * (tablet ? 0.055 : 0.093)),
    sideScrR: Math.round(sideW * (tablet ? 0.043 : 0.078)),
    // Raised above the hero's top edge so each flank shows its own header and
    // first cards — the part of a screen that says what it is.
    // BELOW the hero's top edge, never above it.
    //
    // The flanks used to be raised, which inverted the hierarchy — the hero was
    // no longer the tallest thing in the frame — and worse, two flanks at the
    // same raised height drew one hard horizontal line straight across the
    // composition above the hero's head. It read as a shelf. Sitting them lower
    // makes the hero the silhouette and leaves the flanks receding behind it.
    sideTop: tablet
      ? devTop + devH - sideH - Math.round(H * 0.030)
      : devTop + Math.round(H * 0.034),
    // Distance from canvas centre to each flank's centre.
    sideDx: Math.round(W * (tablet ? 0.300 : 0.330)),
    sideRotY: tablet ? 16 : 21,
    perspective: Math.round(W * 2.1),
    sideZ: Math.round(W * (tablet ? 0.13 : 0.14)),
  };
}

/** `#RRGGBB` → `"r,g,b"`, so one hue can drive both solid and alpha colours. */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}


/**
 * The carousel gutter, as a fraction of one card's width.
 *
 * The panoramic background below is one wide image sliced into ten cards, and
 * this number is the whole reason it lines up. The App Store shows screenshots
 * with a gap between them; slice a panorama into ten EQUAL pieces and ignore
 * that gap and the halves do not meet — the effect reads as ten misaligned
 * images rather than one continuous field, which is worse than not attempting
 * it. So the virtual canvas is `10·W + 9·GUTTER` wide and each frame is a
 * window into it at `i·(W + GUTTER)`.
 */
export const GUTTER = 0.045;

/**
 * Builds one frame's HTML.
 *
 * `L` carries the per-canvas layout from `layoutFor`; everything else is
 * shared, so the iPad set differs from the iPhone set only in proportion.
 */
export function frameHtml(frame, shots, L) {
  // `shots` is { hero, left, right } — data URIs. A string is still accepted so
  // a caller with one screen does not have to build an object.
  const S = typeof shots === 'string' ? { hero: shots } : shots;
  const head = frame.head.replace('|', '<span class="acc">').replace('|', '</span>');
  const A = frame.hue;
  const a = rgb(A);
  const G = GROUND;
  const { num, label } = { num: frame.num, label: frame.label, ...(frame.byKind?.[L.kind] || {}) };

  // ── The panorama ────────────────────────────────────────────────────────────
  // Each frame contributes a wash of its own hue, centred on its own card. A
  // frame therefore carries its neighbours' colour bleeding in from both edges,
  // which is what makes ten separate uploads read as one continuous field when
  // the carousel is scrolled — and what stops the set looking like ten palettes,
  // which is the tell this design has been fighting since the beginning.
  const n = FRAMES.length;
  const i = Math.max(0, FRAMES.indexOf(frame));
  const gut = Math.round(L.W * GUTTER);
  const stride = L.W + gut;
  const panoW = n * L.W + (n - 1) * gut;
  const originX = i * stride;
  const washes = FRAMES.map((f, j) => {
    const cx = j * stride + L.W / 2;
    return `radial-gradient(${Math.round(L.W * 1.05)}px ${Math.round(L.H * 0.90)}px at ${Math.round(cx)}px ${Math.round(L.H * 0.34)}px, rgba(${rgb(f.hue)},0.72), transparent 72%)`;
  }).join(',\n      ');
  // A second, slower band low down, offset by half a card so its crests fall
  // between the washes above — the two together stop the field reading as ten
  // evenly spaced blobs.
  const lows = FRAMES.map((f, j) => {
    const cx = j * stride + L.W;
    return `radial-gradient(${Math.round(L.W * 0.9)}px ${Math.round(L.H * 0.46)}px at ${Math.round(cx)}px ${Math.round(L.H * 0.86)}px, rgba(${rgb(f.hue)},0.38), transparent 74%)`;
  }).join(',\n      ');

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

  /* GROUND — a window onto a panorama ten cards wide. */
  .pano {
    position:absolute; top:0; left:${-originX}px;
    width:${panoW}px; height:${L.H}px;
    background:
      ${washes},
      ${lows},
      linear-gradient(180deg, ${G.high} 0%, ${G.base} 56%, ${G.foot} 100%);
  }
  /* The horizon the devices stand on. Continuous across the panorama, so it is
     the same line in every frame — the strongest single cue that these ten
     images are one place. */
  .horizon {
    position:absolute; top:0; left:${-originX}px;
    width:${panoW}px; height:${L.H}px;
    background:linear-gradient(180deg,
      transparent ${(L.devTop / L.H * 100 - 6).toFixed(1)}%,
      rgba(${a},0.20) ${(L.devTop / L.H * 100).toFixed(1)}%,
      transparent ${(L.devTop / L.H * 100 + 10).toFixed(1)}%);
  }
  /* Film grain. Two jobs: it kills the banding that big soft gradients show on
     an OLED phone, and it gives the ground a surface. Without it the washes
     read as flat vector fill, which is most of what "template" looks like. */
  .grain {
    position:absolute; inset:0; opacity:0.30; mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .vig {
    position:absolute; inset:0;
    background:radial-gradient(128% 86% at 50% 40%, transparent 52%, rgba(0,0,0,0.44) 100%);
  }

  /* TYPE — anchored by its BOTTOM edge, so a headline that wraps grows UPWARD
     into the top margin and the devices sit at the same height in all ten. A
     phone that jumps between frames reads as "generated" even when no single
     frame looks wrong. */
  .head {
    position:absolute; bottom:${L.H - L.headBaseline}px; left:0; right:0;
    text-align:center; padding:0 ${L.headPad}px; z-index:6;
  }
  h1 {
    font-size:${L.h1}px; line-height:1.02; font-weight:800;
    letter-spacing:${L.h1Track}px; color:${G.headline};
    text-shadow:0 ${Math.round(L.H * 0.004)}px ${Math.round(L.H * 0.016)}px rgba(0,0,0,0.45);
  }
  /* ONE accent colour, flat. The version this replaces ran a three-stop rainbow
     gradient through this word. */
  h1 .acc { color:${A}; }
  .sub {
    margin-top:${L.subGap}px; font-size:${L.sub}px; font-weight:500;
    line-height:1.3; color:${G.sub}; letter-spacing:0.1px;
    text-shadow:0 ${Math.round(L.H * 0.002)}px ${Math.round(L.H * 0.010)}px rgba(0,0,0,0.5);
  }

  /* THE PROOF CHIP — on the device, not floating in the type block.
     It used to be a pill centred under the sub-line, which put the number as
     far from the pixels that prove it as the frame allows. Sitting it on the
     hero's edge makes it a label on the thing it describes, and it is the one
     element that reads as pointing INTO the product. */
  .chip {
    position:absolute; z-index:7;
    left:${L.chipX}px; top:${L.chipY}px;
    display:inline-flex; align-items:baseline; gap:${Math.round(L.chip * 0.4)}px;
    padding:${L.chipPadY}px ${L.chipPadX}px; border-radius:999px;
    font-size:${L.chip}px; font-weight:800; letter-spacing:${(L.chip * 0.035).toFixed(2)}px;
    text-transform:uppercase; white-space:nowrap;
    color:#07101C; background:${A};
    box-shadow:0 ${Math.round(L.chip * 0.5)}px ${Math.round(L.chip * 1.4)}px rgba(0,0,0,0.55),
               0 0 ${Math.round(L.chip * 2.2)}px rgba(${a},0.55);
  }
  .chip .l { font-weight:700; opacity:0.70; }

  /* The stage. ONE perspective origin for all three devices, so the flanks turn
     to face the same viewer instead of tilting independently. */
  .stage {
    position:absolute; inset:0; z-index:3;
    perspective:${L.perspective}px; perspective-origin:50% ${L.devTop + Math.round(L.devH * 0.35)}px;
    transform-style:preserve-3d;
  }
  .device {
    position:absolute; left:50%; top:${L.devTop}px;
    width:${L.devW}px; height:${L.devH}px;
    transform:translateX(-50%) translateZ(0); z-index:3;
    padding:${L.bezel}px; border-radius:${L.devR}px;
    background:linear-gradient(152deg, #7D8697 0%, #39404E 22%, #1B1F28 48%, #262C37 74%, #6A7383 100%);
    box-shadow:
      0 ${Math.round(L.devW * 0.075)}px ${Math.round(L.devW * 0.17)}px rgba(0,0,0,0.66),
      0 ${Math.round(L.devW * 0.02)}px ${Math.round(L.devW * 0.05)}px rgba(0,0,0,0.52),
      0 0 ${Math.round(L.devW * 0.22)}px rgba(${a},0.30),
      inset 0 0 0 1px rgba(255,255,255,0.07);
  }
  /* A hairline where the bezel meets the glass — the only "shine" on the
     device, and it sits on the BEZEL. A gloss sweep across the UI, which the
     old set drew, hides the product it is meant to sell. */
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

  /* FLANKS — smaller, further back, dimmed, behind the hero. */
  .side {
    position:absolute; top:${L.sideTop}px;
    width:${L.sideW}px; height:${L.sideH}px;
    padding:${L.sideBezel}px; border-radius:${L.sideR}px;
    background:linear-gradient(152deg, #666F7E 0%, #2F3641 24%, #171B23 52%, #212732 76%, #58606E 100%);
    box-shadow:
      0 ${Math.round(L.sideW * 0.06)}px ${Math.round(L.sideW * 0.15)}px rgba(0,0,0,0.60),
      0 0 ${Math.round(L.sideW * 0.14)}px rgba(${a},0.16);
  }
  .side .screen { border-radius:${L.sideScrR}px; }
  /* Pushed BACK in 3D, not merely given a lower z-index.
     transform-style:preserve-3d makes z-index INERT: children are painted by
     their position in 3D space, so a flank carrying a rotateY and no translateZ
     sorted IN FRONT of the un-transformed hero and clipped its left column —
     the identity card read "Age 2" and "ried". Depth here has to be real depth.
     It earns its keep twice over: a device further from the camera also
     projects smaller, so the size falloff is the perspective doing it rather
     than another number to keep in sync.
     (Comments inside this template literal must not use backticks.) */
  .side.l { left:50%; transform:translateX(-50%) translateX(-${L.sideDx}px) translateZ(-${L.sideZ}px) rotateY(${L.sideRotY}deg); }
  .side.r { left:50%; transform:translateX(-50%) translateX(${L.sideDx}px) translateZ(-${L.sideZ}px) rotateY(-${L.sideRotY}deg); }
  /* Dimmed, never BLURRED. Blur is the lazy way to say "background" and it
     turns a real screenshot into texture — which is what made the 2026-07
     flanks decoration rather than product. A reader can still tell what these
     two screens are; they simply are not the one being read. */
  .side .screen::after {
    content:''; position:absolute; inset:0; border-radius:inherit;
    background:linear-gradient(180deg, rgba(4,7,14,0.30), rgba(4,7,14,0.48));
  }
  .side .screen img { filter:saturate(0.92) brightness(0.96); }

  /* The light the screen spills on the ground, and the shadow that sits the
     device on it. Both are physical: a lit rectangle in a dark room throws
     colour, and an object above a surface casts a contact shadow. */
  .spill {
    position:absolute; left:50%; transform:translateX(-50%);
    top:${L.devTop - Math.round(L.H * 0.075)}px;
    width:${Math.round(L.devW * 1.6)}px; height:${Math.round(L.H * 0.19)}px;
    background:radial-gradient(closest-side, rgba(${a},0.38), transparent 72%);
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
    <div class="pano"></div>
    <div class="horizon"></div>
    <div class="vig"></div>
    <div class="grain"></div>
    <div class="head">
      <h1>${head}</h1>
      <div class="sub">${frame.sub}</div>
    </div>
    <div class="spill"></div>
    <div class="contact"></div>
    <div class="stage">
      ${S.left ? `<div class="side l"><div class="screen"><img src="${S.left}"></div></div>` : ''}
      ${S.right ? `<div class="side r"><div class="screen"><img src="${S.right}"></div></div>` : ''}
      <div class="device"><div class="screen"><img src="${S.hero}"></div></div>
    </div>
    <span class="chip">${num}<span class="l">${label}</span></span>
  </div></body></html>`;
}
