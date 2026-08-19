/**
 * The store-screenshot design system.
 *
 * ONE module, imported by both the iPhone and the iPad generator, so the two
 * sets cannot drift — the pair it replaces had diverged to the point of using
 * different decoration positions for the same frame.
 *
 * Three rules run through every value below.
 *
 * 1. **The frame is a picture of a LIFE, not of a phone.** Every version of
 *    this set before 2026-08 photographed a device against a drawn gradient,
 *    and the whole carousel read as ten product shots of a user interface.
 *    Each frame now sits inside one of the game's own cinematic renders (`ART`),
 *    read from `assets/images/` — art that ships in the binary, that every
 *    player sees, and that nobody deciding whether to become a player had ever
 *    been shown. The corollary is the constraint that keeps it honest: art is
 *    the room, never the product.
 *
 * 2. **The screenshot is still the subject.** `MIN_SCREEN_SHARE` is the floor
 *    the geometry is derived from, not a number checked afterwards, because the
 *    failure mode of an art-led set is a frame that is an advert with a phone
 *    in the corner — and Guideline 2.3.3 rejections cost a review cycle and
 *    take every attached IAP down with them. `docs/store-screenshot-design.md`
 *    records what the 2026-07 version did instead (40 emoji stickers, three-stop
 *    gradient type, ten palettes, fake star dust, a halo ring, three skewed
 *    phones, a gloss sweep) and why the result read as machine-made.
 *
 * 3. **Every claim on a frame is legible inside that frame.** A chip is a
 *    caption for a number the reader can find in the screenshot beside it, not
 *    a marketing line. An earlier set failed that on five of ten frames —
 *    "PhD unlocked" over a course catalogue with nothing marked earned, and
 *    "Rare collection" over a screen reading `Collection (0)` and
 *    `0 / 6 collectibles`. `__tests__/tooling/storeFrameClaims.test.ts` checks
 *    every claim against the visible text captured beside each screenshot, and
 *    `scripts/check-store-contrast.mjs` checks that the type can be READ over
 *    the plate it is printed on — a photograph has no luminance you can reason
 *    about from the CSS.
 */

import { readFileSync, existsSync } from 'fs';
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
  // The sub-line over ART. 0.70 was tuned against a drawn gradient and is not
  // enough over a photograph — the golden-hour plates ate it whole.
  subStrong: 'rgba(223,233,252,0.92)',
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
  risk: '#EF4444', // palette.danger      — stakes, decisions, the bad week
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
 * - `event` is a weekly decision photographed OPEN, before the capture's
 *   clean-up pass empties the inbox — the pipeline's first act used to be
 *   deleting all twelve of these from every capture, so the game's core loop
 *   was the one thing the page could never show.
 * - `luxury` is the **Collection** tab after the capture buys two pieces, not
 *   the Browse shop, which read `Collection (0)` under the words "Rare collection".
 * - `contacts`, not the Family tab, for the family frame: shown large and alone
 *   the Family tab is an EMPTY STATE — a pink "Open the dating app" button
 *   under "No partner yet". Contacts carries the same idea and is full.
 */
export const CAPTURES = {
  earlyhome: '30-early-home.png',
  earlywork: '31-early-work.png',
  event: '32-event-decision.png',
  home: '00-home.png',
  spark: '05-app-spark.png',
  stocks: '07-app-stocks.png',
  contacts: '09-app-contacts.png',
  apps: '03-apps.png',
  company: '17-x-company.png',
  darkweb: '18-x-darkweb.png',
  crypto: '19-x-crypto.png',
  luxury: '29-x-luxury-collection.png',
  // The real-estate PORTFOLIO after the capture buys property, not the empty
  // one the app opens on. Same reason as `luxury` above: `RealEstate` is an
  // 8-keyword ad group whose only available picture used to be of owning
  // nothing (`Portfolio equity $0`, `0 properties`).
  realestate: '33-x-realestate-portfolio.png',
  // No longer on the main page (education has no search-demand ad group), but
  // kept: CPP-Career in marketing/apple-ads/04-custom-product-pages.md wants
  // the Earned transcript for its "Study, qualify, get promoted" slot.
  education: '28-app-education-earned.png',
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
 * The scenes.
 *
 * This is the change the 2026-08 rebuild is actually about. Every previous
 * version of this set photographed a PHONE against a gradient — ten product
 * shots of a user interface, when what is being sold is a life you gamble with
 * and can lose. Meanwhile the binary ships forty-plus cinematic renders that
 * every player sees inside the game and nobody deciding whether to become a
 * player ever had: `assets/images/luxury/`, `Real Estate/`, `Vehicles/`,
 * `Main_Menu/`. They were the largest unused asset in the repository.
 *
 * Two rules govern what is in this table, both learned the expensive way.
 *
 * 1. **The scene has to carry its own light.** A side-by-side test of three
 *    frames found the golden-hour yacht and the neon-lit tower transformed
 *    their frames while the main-menu plate — which is nearly black — barely
 *    improved on the flat gradient it replaced. So every entry declares a
 *    relight (`bright`/`contrast`/`sat`) and is checked against the headline
 *    contrast floor in `__tests__/tooling/storeFrameClaims.test.ts`.
 *
 * 2. **The art is the room, never the product.** Guideline 2.3.3 asks that a
 *    screenshot represent the app in use, so the real capture stays the
 *    loudest object in every frame and never drops below `MIN_SCREEN_SHARE` of
 *    the canvas height. A yacht behind a spreadsheet is a room; a yacht INSTEAD
 *    of a spreadsheet is a different game.
 *
 * `focus` is `object-position` — these are 16:9-ish renders being cropped to a
 * 1:2.17 phone canvas, so which part survives the crop is a real decision and
 * not a default. `Mainmenu_1` is the extreme case: its whole subject is one
 * small figure under a light shaft, and centring the crop loses him.
 */
export const ART = {
  apartment: { file: 'Real Estate/City Apartment.webp', focus: '50% 42%', bright: 1.10, contrast: 1.05, sat: 1.04 },
  // A lit cabin against a mountain at night. Chosen over the app icon's own
  // main-menu plate (a lone figure under a light shaft), which was tried first
  // and rejected on the evidence: at full size it is atmospheric, and at the
  // ~141px a carousel actually gets it resolves to black. That is precisely the
  // failure the relight rule exists to catch, and no amount of lift fixed it —
  // a plate whose subject is small and unlit has nothing to lift. This one is
  // lit from inside, so it survives the shrink.
  cabin: { file: 'Real Estate/Mountain Cabin.webp', focus: '50% 42%', bright: 1.20, contrast: 1.06, sat: 1.08 },
  yacht: { file: 'luxury/mega_yacht.jpg', focus: '50% 38%', bright: 1.06, contrast: 1.07, sat: 1.08 },
  tower: { file: 'Real Estate/Office Tower.webp', focus: '50% 40%', bright: 1.12, contrast: 1.06, sat: 1.06 },
  // A dark interior looking out over a city at night. It sits behind the dark
  // web because it is the only plate in the library that reads as a ROOM
  // somebody is working in late, rather than a building seen from outside.
  backroom: { file: 'luxury/trophy_penthouse.webp', focus: '58% 46%', bright: 1.30, contrast: 1.08, sat: 1.02 },
  // The most monumental plate available, which is what "empire" needs; it is
  // also the only vertical subject here, so it breaks a run of low, wide
  // buildings that was starting to read as one location.
  spire: { file: 'Real Estate/Sky Castle.webp', focus: '50% 42%', bright: 1.30, contrast: 1.06, sat: 1.06 },
  // Cropped hard LEFT rather than centred. In `edge` mode the device covers the
  // right of the canvas, so a centred crop puts the building behind it and
  // leaves the visible corner as empty dark wall — which is what the first
  // render did. The crop has to be chosen against the composition that uses it,
  // not against the picture on its own.
  mansion: { file: 'Real Estate/Modern Mansion.webp', focus: '30% 46%', bright: 1.08, contrast: 1.05, sat: 1.05 },
  // Sunset over an island. Warm and unpopulated where the frames either side of
  // it are neon and architectural — the dating frame is the one place in the
  // set that should not look like real estate.
  island: { file: 'luxury/private_island.jpg', focus: '50% 52%', bright: 1.04, contrast: 1.06, sat: 1.06 },
  suburb: { file: 'Real Estate/Suburaban House.webp', focus: '50% 48%', bright: 1.10, contrast: 1.04, sat: 1.03 },
  // Golden hour over an estate — the warmest plate in the library, and the only
  // one that reads as an ending rather than an acquisition.
  // The brightest plate in the set, and the only one that needed its own type
  // ground: measured at the default scrim it put the headline at 5.7:1, over
  // the 4.5:1 failure floor but under the 7:1 target this set is built to. The
  // crop drops so the sky takes less of the type zone, and `shade` deepens the
  // band under the type for this frame only. Both numbers came off
  // scripts/check-store-contrast.mjs, not off a look at it.
  vineyard: { file: 'luxury/vineyard_estate.jpg', focus: '50% 62%', bright: 0.98, contrast: 1.08, sat: 1.06, shade: 0.16 },
};

/** Art lives beside the app, not beside this script. */
const ASSETS = join(HERE, '..', '..', 'assets', 'images');

const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

/**
 * One art plate as a data URI.
 *
 * Reads from `assets/images/` — the SAME files the app renders, not a marketing
 * copy of them. A separate copy would drift the moment one of them is retouched
 * in the product, and then the store page would advertise art the game does not
 * contain, which is the 2.3.3 problem wearing a different hat.
 */
export function artDataUri(key) {
  const entry = ART[key];
  if (!entry) throw new Error(`No art registered under "${key}" — see ART in storeFrameSystem.mjs.`);
  const p = join(ASSETS, entry.file);
  if (!existsSync(p)) {
    throw new Error(`Art plate missing: assets/images/${entry.file}. It ships in the app, so a missing file means it was moved or removed — update ART rather than dropping the scene.`);
  }
  const ext = entry.file.slice(entry.file.lastIndexOf('.')).toLowerCase();
  return `data:${MIME[ext] || 'image/png'};base64,` + readFileSync(p).toString('base64');
}

/**
 * The three acts.
 *
 * The set this replaces was ten features in roughly the order they were built.
 * This one is an arc with a shape — you have nothing, every week you choose,
 * you end up owning things people photograph — and the whole of it lands inside
 * the FIRST THREE frames, because three screenshots is all a search result
 * shows. Everything after frame 3 exists to prove there is a game underneath
 * the fantasy.
 *
 * The acts are also what makes the panorama survive photographic art. The
 * previous set ran ONE continuous background across all ten cards; ten
 * different photographs cannot do that. So the continuity device — the hue
 * sweep and the horizon line — runs per ACT, and the two seams fall exactly on
 * the act breaks. The structure is visible instead of decorative, and a
 * carousel still pulls sideways within each act.
 */
export const ACTS = [
  { id: 'hook', title: 'The hook', size: 3 },
  { id: 'systems', title: 'The systems', size: 4 },
  { id: 'life', title: 'The life', size: 3 },
];

/**
 * The floor under Guideline 2.3.3, as a share of canvas height.
 *
 * Art-led frames have one failure mode that matters more than looking bad:
 * shrinking the real screenshot until the frame is an advert rather than a
 * screenshot. This is the number that stops that happening by construction,
 * and the claims test asserts every mode clears it.
 */
export const MIN_SCREEN_SHARE = 0.55;

/**
 * The ten frames — ONE LIFE, in order.
 *
 * This is a story, not a feature tour, and that is the change that matters
 * most. The version this replaces was a catalogue: ten domains listed in no
 * particular order, each frame arguing on its own. A life sim's product IS the
 * arc — the distance between where you start and where you end up — so the set
 * now runs start → grind → choices → love → markets → crime → empire → luxury →
 * family → legacy, and the headlines read top to bottom as sentences of one
 * story.
 *
 * WHICH screens hold the ten slots is a demand decision, not a taste one. The
 * Apple Ads account (marketing/apple-ads/) ranks the search themes people
 * actually arrive through: LifeSim-Core (18 keywords), Money-Wealth (13),
 * Investing-Stocks (12), Crime-Underground (10), Business-Tycoon (10),
 * RealEstate (8), Choices-Story (8), Career-Job (8) — and education has NO ad
 * group at all, which is why the Earned-transcript frame gave its slot to the
 * open weekly decision (frame 03). Real estate also has a group and no frame;
 * its capture is an empty portfolio ($0, 0 properties), so featuring it waits
 * on a capture that buys a property first — see the note in
 * docs/store-screenshot-design.md.
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
  // ── ACT I · THE HOOK ────────────────────────────────────────────────────────
  // The only three frames a search result shows, so the whole arc lives here:
  // you have nothing, every week you choose, you end up owning things people
  // photograph. Frames 4-10 are seen only by somebody who already scrolled the
  // product page, i.e. by somebody already half sold.
  {
    id: '01-start-with-nothing',
    act: 'hook',
    // Solo. This is the first thing anyone sees at ~141px wide, and the frame's
    // whole argument is a set of small numbers on one card ($1,500, Unemployed,
    // Reputation 0). Flanks would take a third of the width away from the only
    // thing here that has to be read.
    mode: 'solo',
    art: 'apartment',
    support: [],
    head: 'Start with |nothing.|',
    sub: 'Twenty years old. Unemployed. Rent due.',
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
    id: '02-every-week-one-choice',
    act: 'hook',
    // Solo, for the same reason: a decision modal is dense text, and a frame
    // that shows the loop without letting anyone read it shows nothing.
    mode: 'solo',
    art: 'cabin',
    support: [],
    head: 'Every week, one |choice.|',
    sub: 'Good news, bad news — your call either way.',
    num: 'Your call',
    label: 'consequences included',
    hue: HUE.risk,
    pick: 'event',
    // The one frame whose subject is not a screen but the LOOP. The keyword
    // account has a whole Choices-Story ad group ("choices game" is flagged as
    // large volume), CPP-LifeSim's slot 2 asks for exactly this shot, and the
    // capture pipeline's first act used to be deleting all twelve queued
    // decisions from every capture — the core loop was the one thing the page
    // could never show. The event's TEXT varies per run, so the claim rests on
    // the modal's unconditional chrome: the "Choice Effects" panel that prices
    // every option before you commit. No digits on this chip on purpose — a
    // number here would be quoting an event that the next capture re-rolls.
    evidence: 'The weekly event modal is open, with its Choice Effects panel pricing each option.',
    assert: ['Choice Effects'],
  },
  {
    id: '03-buy-the-impossible',
    act: 'hook',
    // Edge. The payoff frame is the one place the scene should out-argue the
    // screen, so the device steps aside and the yacht gets the canvas — while
    // still clearing MIN_SCREEN_SHARE, because a payoff nobody can trace back
    // to the product is an advert.
    mode: 'edge',
    art: 'yacht',
    support: [],
    head: 'Buy the |impossible.|',
    sub: 'Watches, supercars and museum-grade pieces.',
    num: '2 of 6',
    label: 'trophies acquired',
    hue: HUE.gold,
    // Promoted from slot 8, where nothing but a page-scroller ever saw it.
    // Money-Wealth is 13 of the 87 category-exact keywords and the single
    // largest money-shaped intent group in the account; leaving its frame past
    // the fold was the clearest mis-allocation in the old order.
    //
    // Was "Rare collection" over the Browse tab, which read `Collection (0)` and
    // `0 / 6 collectibles` — the player owned nothing at all. The capture now
    // buys two pieces through the app's own Buy button and photographs the
    // Collection tab, so the caption describes something that is on screen.
    pick: 'luxury',
    evidence: 'The Luxury Life card reads "2 / 6 collectibles" after the capture buys the watch case and the diamond.',
    assert: ['2 / 6 collectibles', 'Collection (2)'],
  },

  // ── ACT II · THE SYSTEMS ────────────────────────────────────────────────────
  // Four frames whose only job is to prove there is a game under the fantasy
  // Act I sells. Ordered by the size of the ad group each one answers:
  // Investing-Stocks 12, Crime-Underground 10, Business-Tycoon 10, RealEstate 8.
  {
    id: '04-play-the-markets',
    act: 'systems',
    mode: 'trio',
    art: 'tower',
    support: ['bank', 'crypto'],
    head: 'Play the |markets.|',
    sub: 'Twenty-five tickers, six sectors, one call.',
    num: '25 listed',
    label: 'tickers · sector rotation live',
    hue: HUE.apps,
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
    id: '05-work-the-dark-web',
    act: 'systems',
    // Solo. A terminal is the densest screen in the app and the least
    // survivable at flank scale.
    mode: 'solo',
    art: 'backroom',
    support: [],
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
    id: '06-found-the-company',
    act: 'systems',
    mode: 'trio',
    art: 'spire',
    support: ['politics', 'apps'],
    head: 'Found the |company.|',
    sub: 'Set the price. Take the market. Hire.',
    num: '$8,000',
    label: 'a week in revenue',
    hue: HUE.market,
    pick: 'company',
    evidence: 'The empire snapshot reads $8,000 / wk and the company card repeats it.',
    assert: ['$8,000', 'EMPIRE SNAPSHOT'],
  },
  {
    id: '07-own-the-block',
    act: 'systems',
    mode: 'edge',
    art: 'mansion',
    support: [],
    head: 'Own the |block.|',
    sub: 'Studio to penthouse. Rent it out, or move in.',
    hue: HUE.premium,
    // The frame this set did not have. `RealEstate` carries 8 category-exact
    // keywords and had no slot for one reason only: the app opens on an empty
    // portfolio reading `Portfolio equity $0`, `0 properties`, "You don't own
    // any property yet" — a capture gap that had been read as a content
    // decision for the whole life of the set. `buyPropertyAndShowPortfolio` in
    // the capture script now buys through the app's own listing CTA, with cash
    // rather than a mortgage so the equity printed is simply what the
    // properties are worth.
    pick: 'realestate',
    // Written FROM the capture rather than at it. The first draft of this frame
    // claimed "Portfolio equity", which is on the screen but above the fold —
    // the claims test rejected it, which is the whole reason that test exists.
    // What the shot actually holds is better anyway: three owned properties,
    // each with its own art, its price and its equity, which is a ladder rather
    // than a total.
    evidence: 'The portfolio lists three owned properties — Studio Apartment $95K, Duplex $320K, Luxury Condo $850K — each with its equity.',
    assert: ['Your properties', '$850K', 'equity'],
    num: '3 owned',
    label: 'studio · duplex · condo',
    // Counted, not quoted: nothing on the screen prints "3", so checking for the
    // digit would check nothing. Every counted thing has to be visible and there
    // have to be exactly as many as the chip says.
    items: ['Studio Apartment', 'Duplex', 'Luxury Condo'],
  },

  // ── ACT III · THE LIFE ──────────────────────────────────────────────────────
  // Why anyone starts a second life. Dating leads the act rather than the page:
  // it has ZERO keywords in the category-exact file, so it earns a frame on
  // retention grounds and not a slot a scanner ever reaches. It is also the only
  // human face in the set, which is why the act that holds it is where the
  // character appears at all.
  {
    id: '08-fall-for-someone',
    act: 'life',
    mode: 'solo',
    art: 'island',
    support: [],
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
    id: '09-raise-a-family',
    act: 'life',
    mode: 'trio',
    art: 'suburb',
    support: ['spark', 'life'],
    head: 'Raise a |family.|',
    sub: 'Marry, have kids, pass it all on.',
    num: '5 people',
    label: 'in your circle',
    hue: HUE.identity,
    pick: 'contacts',
    evidence: 'The relationship portfolio card counts 5 people: both parents, a spouse and two children.',
    assert: ['RELATIONSHIP PORTFOLIO', 'People', 'Strong'],
  },
  {
    id: '10-then-do-it-again',
    act: 'life',
    mode: 'edge',
    art: 'vineyard',
    support: [],
    head: 'Then do it |again.|',
    sub: 'Eleven million later. Prestige, and start over.',
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
    // it end up in the same glance instead of 400px apart. Its X and Y are
    // derived in `frameHtml` from where the device actually ends up, because
    // `edge` mode moves the device and a fixed offset would leave the chip
    // floating in open art.
    chip: Math.round(W * (tablet ? 0.0185 : 0.0255)),
    chipPadX: Math.round(W * (tablet ? 0.021 : 0.030)),
    chipPadY: Math.round(W * (tablet ? 0.0105 : 0.0148)),

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

    // ── EDGE mode ───────────────────────────────────────────────────────────
    //
    // The device steps off centre and turns, so the scene behind it gets a
    // corner of the canvas to itself instead of two thin margins. Used on the
    // three frames whose art is the argument (the yacht, the mansion, the
    // vineyard) and nowhere else — a composition used on every frame is the
    // template problem again in a different pose.
    //
    // `edgeH` is what keeps this honest: it is derived so the screen still
    // clears MIN_SCREEN_SHARE of the canvas height. Shrinking the real
    // screenshot until the frame is an advert is the one failure mode that
    // costs a 2.3.3 rejection rather than an install, so the floor is
    // computed, not chosen.
    edgeDx: Math.round(W * (tablet ? 0.150 : 0.175)),
    edgeH: Math.max(Math.round(H * MIN_SCREEN_SHARE), Math.round(devH * 0.90)),
    edgeTop: devTop + Math.round(H * (tablet ? 0.028 : 0.030)),
    edgeRotY: tablet ? 8 : 10,
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
  // `shots` is { hero, left, right, art } — data URIs. A string is still
  // accepted so a caller with one screen does not have to build an object.
  const S = typeof shots === 'string' ? { hero: shots } : shots;
  const head = frame.head.replace('|', '<span class="acc">').replace('|', '</span>');
  const A = frame.hue;
  const a = rgb(A);
  const G = GROUND;
  const { num, label } = { num: frame.num, label: frame.label, ...(frame.byKind?.[L.kind] || {}) };
  const mode = frame.mode || 'trio';
  const plate = ART[frame.art] || {};

  // ── The panorama, per ACT ───────────────────────────────────────────────────
  //
  // The version this replaces ran ONE continuous hue field across all ten
  // cards. That works when every card's background is a gradient this file
  // draws; it cannot work when each card is a different photograph. So the
  // continuity device runs per act instead — the hue sweep and the horizon
  // line are continuous across an act's frames and CUT at the act breaks.
  //
  // The gutter maths is the same and matters for the same reason: the App Store
  // shows a gap between screenshots, so slicing a field into equal pieces and
  // ignoring that gap means the halves do not meet, and the effect reads as
  // misalignment rather than as one place. The virtual canvas is
  // `n·W + (n-1)·GUTTER` wide and each frame is a window into it.
  const idx = Math.max(0, FRAMES.indexOf(frame));
  const act = ACTS.find((x) => x.id === frame.act) || ACTS[0];
  const actStart = FRAMES.findIndex((f) => f.act === act.id);
  const actFrames = FRAMES.filter((f) => f.act === act.id);
  const n = actFrames.length;
  const i = idx - actStart;
  const gut = Math.round(L.W * GUTTER);
  const stride = L.W + gut;
  const panoW = n * L.W + (n - 1) * gut;
  const originX = i * stride;
  const washes = actFrames.map((f, j) => {
    const cx = j * stride + L.W / 2;
    return `radial-gradient(${Math.round(L.W * 1.05)}px ${Math.round(L.H * 0.86)}px at ${Math.round(cx)}px ${Math.round(L.H * 0.30)}px, rgba(${rgb(f.hue)},0.40), transparent 74%)`;
  }).join(',\n      ');

  // Where the device sits, which every light in the frame is derived from so
  // the shadow and the spill cannot drift away from the object casting them.
  const dx = mode === 'edge' ? L.edgeDx : 0;
  const devH = mode === 'edge' ? L.edgeH : L.devH;
  const devTop = mode === 'edge' ? L.edgeTop : L.devTop;
  const screenAspect = L.kind === 'tablet' ? 2732 / 2048 : 2796 / 1290;
  const bez = Math.round(L.bezel * 0.62);
  const devW = Math.round((devH - bez * 2) / screenAspect) + bez * 2;
  const devR = Math.round(devW * (L.kind === 'tablet' ? 0.055 : 0.093));

  const alignLeft = mode === 'edge';

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

  /* ── THE SCENE ─────────────────────────────────────────────────────────────
     The game's own art, full bleed. object-position is per-plate because
     these are wide renders being cropped to a 1:2.17 canvas and the subject is
     rarely dead centre. The filter is the relight: measured per plate, because
     a plate that cannot carry its own light drags the whole frame back to
     where this redesign started. */
  .art { position:absolute; inset:0; z-index:0; }
  .art img {
    width:100%; height:100%; object-fit:cover;
    object-position:${plate.focus || '50% 45%'};
    filter:brightness(${plate.bright ?? 1}) contrast(${plate.contrast ?? 1}) saturate(${plate.sat ?? 1});
  }
  /* One hue over the whole plate, at low strength. This is what keeps ten
     different photographs reading as one series: the accent that colours the
     headline word and the chip is also the light in the room. */
  .tone {
    position:absolute; inset:0; z-index:1; mix-blend-mode:soft-light;
    background:linear-gradient(168deg, rgba(${a},0.34) 0%, transparent 48%, rgba(${a},0.20) 100%);
  }
  /* The scrim. Heavy at the top so the headline has a ground, light through the
     middle where the art actually is, heavy again at the foot so the device
     sits on something. */
  .scrim {
    position:absolute; inset:0; z-index:1;
    background:linear-gradient(180deg,
      rgba(3,6,13,0.90) 0%,
      rgba(3,6,13,0.72) ${(L.headBaseline / L.H * 100 * 0.55).toFixed(1)}%,
      rgba(3,6,13,0.22) ${(L.headBaseline / L.H * 100 + 4).toFixed(1)}%,
      rgba(3,6,13,0.18) 52%,
      rgba(3,6,13,0.58) 86%,
      rgba(3,6,13,0.86) 100%);
  }
  /* GROUND — a window onto a panorama as wide as this frame's ACT. */
  .pano {
    position:absolute; top:0; left:${-originX}px;
    width:${panoW}px; height:${L.H}px; z-index:1;
    mix-blend-mode:screen; opacity:0.50;
    background:${washes};
  }
  /* The horizon the devices stand on. Continuous across the act, so the frames
     within one act read as one place and the act break reads as a cut. */
  .horizon {
    position:absolute; top:0; left:${-originX}px;
    width:${panoW}px; height:${L.H}px; z-index:2;
    background:linear-gradient(180deg,
      transparent ${(devTop / L.H * 100 - 6).toFixed(1)}%,
      rgba(${a},0.22) ${(devTop / L.H * 100).toFixed(1)}%,
      transparent ${(devTop / L.H * 100 + 10).toFixed(1)}%);
  }
  /* Film grain. Two jobs: it kills the banding that big soft gradients show on
     an OLED phone, and it marries the compressed art to the drawn layers over
     it — without it the scrim reads as a flat sheet laid on a photograph. */
  .grain {
    position:absolute; inset:0; z-index:2; opacity:0.22; mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .vig {
    position:absolute; inset:0; z-index:2;
    background:radial-gradient(130% 88% at 50% 38%, transparent 50%, rgba(0,0,0,0.46) 100%);
  }

  /* The type's own ground.
     The scrim below is tuned for the WHOLE canvas and cannot also guarantee a
     headline set over a golden-hour sky. This band exists only under the type
     block, and it is why the contrast check in scripts/check-store-contrast.mjs
     passes on the bright plates (the yacht, the island, the vineyard) as well
     as the dark ones. Without it the sub-line loses against the art at exactly
     the sizes that matter. */
  .headshade {
    position:absolute; top:0; left:0; right:0; z-index:5;
    height:${L.headBaseline + Math.round(L.H * 0.05)}px;
    background:linear-gradient(180deg,
      rgba(3,6,13,${(0.80 + (plate.shade ?? 0)).toFixed(2)}) 0%,
      rgba(3,6,13,${(0.70 + (plate.shade ?? 0)).toFixed(2)}) 46%,
      rgba(3,6,13,${(0.40 + (plate.shade ?? 0)).toFixed(2)}) 78%,
      rgba(3,6,13,0) 100%);
  }

  /* TYPE — anchored by its BOTTOM edge, so a headline that wraps grows UPWARD
     into the top margin and the devices sit at the same height throughout an
     act. A phone that jumps between frames reads as "generated" even when no
     single frame looks wrong. */
  .head {
    position:absolute; bottom:${L.H - L.headBaseline}px; left:0; right:0;
    text-align:${alignLeft ? 'left' : 'center'}; padding:0 ${L.headPad}px; z-index:6;
  }
  h1 {
    font-size:${L.h1}px; line-height:1.02; font-weight:800;
    letter-spacing:${L.h1Track}px; color:${G.headline};
    text-shadow:0 ${Math.round(L.H * 0.004)}px ${Math.round(L.H * 0.018)}px rgba(0,0,0,0.72);
  }
  /* ONE accent colour, flat. The version this replaces ran a three-stop rainbow
     gradient through this word. */
  h1 .acc { color:${A}; }
  .sub {
    margin-top:${L.subGap}px; font-size:${L.sub}px; font-weight:600;
    line-height:1.3; color:${G.subStrong}; letter-spacing:0.1px;
    text-shadow:0 ${Math.round(L.H * 0.002)}px ${Math.round(L.H * 0.012)}px rgba(0,0,0,0.8);
  }

  /* THE PROOF CHIP — on the device, not floating in the type block.
     It used to be a pill centred under the sub-line, which put the number as
     far from the pixels that prove it as the frame allows. Sitting it on the
     hero's edge makes it a label on the thing it describes, and it is the one
     element that reads as pointing INTO the product. */
  .chip {
    position:absolute; z-index:7;
    left:${Math.max(Math.round(L.W * 0.035), Math.round(L.W / 2 + dx - devW / 2 - L.W * 0.02))}px;
    top:${devTop + Math.round(L.H * (L.kind === 'tablet' ? 0.050 : 0.046))}px;
    display:inline-flex; align-items:baseline; gap:${Math.round(L.chip * 0.4)}px;
    padding:${L.chipPadY}px ${L.chipPadX}px; border-radius:999px;
    font-size:${L.chip}px; font-weight:800; letter-spacing:${(L.chip * 0.035).toFixed(2)}px;
    text-transform:uppercase; white-space:nowrap;
    color:#07101C; background:${A};
    box-shadow:0 ${Math.round(L.chip * 0.5)}px ${Math.round(L.chip * 1.4)}px rgba(0,0,0,0.6),
               0 0 ${Math.round(L.chip * 2.2)}px rgba(${a},0.55);
  }
  .chip .l { font-weight:700; opacity:0.70; }

  /* The stage. ONE perspective origin for every device in the frame, so a turned
     screen faces the same viewer instead of tilting independently. */
  .stage {
    position:absolute; inset:0; z-index:3;
    perspective:${L.perspective}px; perspective-origin:50% ${devTop + Math.round(devH * 0.35)}px;
    transform-style:preserve-3d;
  }
  /* The device. No metallic bezel and no notch — a dark rim and a hairline.
     The chrome the old set drew was ~12% of the canvas spent on a picture of a
     phone, which is the thing this redesign is trying to stop being about; with
     a real scene behind it the screen separates on contrast alone. */
  .device {
    position:absolute; left:50%; top:${devTop}px;
    width:${devW}px; height:${devH}px;
    transform:translateX(-50%) translateX(${dx}px)${mode === 'edge' ? ` rotateY(-${L.edgeRotY}deg)` : ''} translateZ(0);
    padding:${bez}px; border-radius:${devR}px;
    background:#080C15;
    box-shadow:
      0 ${Math.round(devW * 0.075)}px ${Math.round(devW * 0.19)}px rgba(0,0,0,0.72),
      0 ${Math.round(devW * 0.02)}px ${Math.round(devW * 0.05)}px rgba(0,0,0,0.58),
      0 0 ${Math.round(devW * 0.24)}px rgba(${a},0.34),
      inset 0 0 0 1px rgba(255,255,255,0.10);
  }
  .device::after {
    content:''; position:absolute; inset:0;
    border-radius:${devR}px;
    border:1px solid rgba(255,255,255,0.16); pointer-events:none;
  }
  .screen {
    position:relative; height:100%; border-radius:${Math.round(devR - bez)}px;
    overflow:hidden; background:#0B1220;
  }
  .screen img { display:block; width:100%; }

  /* FLANKS — smaller, further back, dimmed, behind the hero. Dimmed, never
     BLURRED: blur is the lazy way to say "background" and it turns a real
     screenshot into texture. A reader can still tell what these two screens
     are; they simply are not the one being read. */
  .side {
    position:absolute; top:${L.sideTop}px;
    width:${L.sideW}px; height:${L.sideH}px;
    padding:${Math.max(1, Math.round(bez * 0.75))}px; border-radius:${L.sideR}px;
    background:#070A12;
    box-shadow:
      0 ${Math.round(L.sideW * 0.06)}px ${Math.round(L.sideW * 0.15)}px rgba(0,0,0,0.66),
      0 0 ${Math.round(L.sideW * 0.14)}px rgba(${a},0.18),
      inset 0 0 0 1px rgba(255,255,255,0.08);
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
  .side .screen::after {
    content:''; position:absolute; inset:0; border-radius:inherit;
    background:linear-gradient(180deg, rgba(4,7,14,0.20), rgba(4,7,14,0.38));
  }
  .side .screen img { filter:saturate(0.92) brightness(0.96); }

  /* The light the screen spills into the room, and the shadow that sits the
     device on it. Both are physical: a lit rectangle in a dark space throws
     colour, and an object above a surface casts a contact shadow. With a real
     photograph behind them they are also what stops the device reading as a
     sticker pasted onto a stock image. */
  .spill {
    position:absolute; left:50%; transform:translateX(-50%) translateX(${dx}px);
    top:${devTop - Math.round(L.H * 0.075)}px;
    width:${Math.round(devW * 1.6)}px; height:${Math.round(L.H * 0.19)}px;
    background:radial-gradient(closest-side, rgba(${a},0.34), transparent 72%);
    filter:blur(${Math.round(L.W * 0.035)}px); z-index:2;
  }
  .contact {
    position:absolute; left:50%; transform:translateX(-50%) translateX(${dx}px);
    top:${devTop - Math.round(L.shadowH * 0.55)}px;
    width:${Math.round(devW * 0.9)}px; height:${L.shadowH}px;
    background:radial-gradient(closest-side, rgba(0,0,0,0.78), transparent 76%);
    filter:blur(${Math.round(L.shadowH * 0.28)}px); z-index:2;
  }
  </style></head><body><div class="canvas">
    <div class="art"><img src="${S.art}"></div>
    <div class="tone"></div>
    <div class="scrim"></div>
    <div class="pano"></div>
    <div class="horizon"></div>
    <div class="vig"></div>
    <div class="grain"></div>
    <div class="headshade"></div>
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
