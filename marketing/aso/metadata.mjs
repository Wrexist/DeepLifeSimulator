/**
 * App Store and Google Play metadata — the single source of truth.
 *
 * The paste-ready document and every character count are GENERATED from this
 * file by `scripts/check-aso.mjs`. That is deliberate: the previous version
 * carried counts written by hand next to the copy, and hand-written counts go
 * stale the first time someone edits a word. Apple truncates silently, so a
 * subtitle one character over is a subtitle that ends mid-word in front of
 * every visitor.
 *
 * ── What Apple actually indexes ───────────────────────────────────────────
 * Search matches against the union of: app NAME, SUBTITLE, the KEYWORD field,
 * the IAP display names, and the category. It does NOT index the description
 * (that is Google Play). Apple also matches ACROSS fields, so "life" in the
 * name plus "story" in the keywords already covers the phrase "life story" —
 * which is why no term below appears in two fields. Every duplicate is a
 * wasted slot, and `check-aso.mjs` fails the build on one.
 */

export const APPLE = {
  /**
   * 30 chars. The highest-weighted field there is.
   *
   * `Deep Life Simulator` used only 19 of 30 and left the most valuable
   * characters in the listing unused. The suffix keeps the brand intact and
   * spends the remainder on the one highest-volume term in this genre that
   * the name does not already carry.
   */
  name: 'Deep Life Simulator: Tycoon',

  /**
   * 30 chars, second-highest weight.
   *
   * The previous subtitle was `Rags to riches money life sim`, which spent
   * eight of its thirty characters on "life" and "sim" — both already in the
   * name, therefore already indexed, therefore thrown away. This one shares
   * no term with the name or the keyword field.
   */
  subtitle: 'Careers, crime, crypto, heirs',

  /**
   * 100 chars. Comma-separated, NO spaces after the commas (a space costs a
   * character and buys nothing), singular forms only (Apple stems plurals).
   */
  keywords: [
    'billionaire', 'dynasty', 'mafia', 'prison', 'stock', 'invest', 'property',
    'empire', 'wealth', 'dating', 'family', 'story', 'rich', 'money',
  ],

  /** 170 chars. The ONLY field that updates without a review cycle. */
  promotionalText:
    'Start with nothing. Take a job, a loan, a risk. Build a fortune in stocks, '
    + 'property and crime — then die and hand it to an heir who inherits your '
    + 'mistakes too.',

  /**
   * 4000 chars. NOT indexed by Apple — this field is pure conversion.
   * Only the first three lines show before the "more" tap, so they carry the
   * whole hook.
   */
  description: `Every life starts the same way: no money, no job, no plan.
What happens next is entirely yours.

Deep Life Simulator is a life sim with a real economy underneath it. Wages are taxed. Loans charge interest. Rent is due whether or not you can pay. Markets move on their own and do not care that you are in them. Every choice compounds, for decades, until you die and hand what is left to an heir.

━━━━━━━━━━━━━━━━━━━━
BUILD A CAREER, OR DON'T
━━━━━━━━━━━━━━━━━━━━
• 20+ career ladders, from courier to surgeon to CEO
• Go to university, or skip it and start earning at 16
• Or take the other road: street work, the dark web, and the chance of prison

━━━━━━━━━━━━━━━━━━━━
MAKE REAL MONEY MOVES
━━━━━━━━━━━━━━━━━━━━
• A live stock market with sectors that rotate
• Crypto you can trade or mine
• Property to rent out, businesses to found, staff to hire
• Loans, credit scores, arrears and the very real possibility of bankruptcy

━━━━━━━━━━━━━━━━━━━━
LIVE AN ACTUAL LIFE
━━━━━━━━━━━━━━━━━━━━
• Date, marry, argue, divorce
• Raise children who inherit your looks and your money
• Keep your health, your friends and your reputation alive
• Buy the watch, the car, the house — or don't, and retire early

━━━━━━━━━━━━━━━━━━━━
THEN DO IT ALL AGAIN
━━━━━━━━━━━━━━━━━━━━
When you die, your heir takes over. They keep the fortune you built, the family name you made, and the mess you left behind. Prestige across generations, unlock permanent advantages, and find out how far a dynasty can go.

━━━━━━━━━━━━━━━━━━━━
WHY THIS ONE AND NOT ANOTHER LIFE SIM
━━━━━━━━━━━━━━━━━━━━
Most life sims resolve a choice with a dice roll and a line of text. Here the economy keeps running between your decisions and pushes back on them. Nothing waits for you to look at it.

You can be a surgeon who never breaks the law, or a courier who ends up running a dark web operation out of a rented room. Both are real routes through the same economy, and neither is the "correct" one.

━━━━━━━━━━━━━━━━━━━━
HOW IT TREATS YOU
━━━━━━━━━━━━━━━━━━━━
• Plays offline — your save lives on your device
• Full-screen ads only at year-end breaks, never in your first two years, and one purchase removes them permanently
• No real-time energy bar standing between you and the next week

A life runs for decades and every week is a decision you make. Most people start a second one.`,

  /**
   * A SECOND keyword field, indexed in the same storefront.
   *
   * The US storefront indexes an app's English (U.S.) metadata AND its
   * Spanish (Mexico) metadata. Adding the es-MX localisation therefore buys
   * another 100 characters of keywords that US searchers can match against,
   * on top of serving actual Spanish-speaking users. It is the largest piece
   * of unused capacity in this listing by a distance — the equivalent of
   * doubling the keyword field.
   *
   * Two honest caveats. Apple does not document this, so treat it as a
   * well-established practice rather than a guarantee, and confirm with a
   * before/after on impressions rather than assuming. And the localisation
   * must be a REAL one: a Spanish keyword field alongside an English
   * description is a poor experience for anyone it actually reaches, so the
   * description and subtitle below are translated properly, not left English.
   *
   * en-GB is listed for completeness. UK, Australian, Canadian and Irish
   * storefronts fall back to en-US when it is absent, so unlike es-MX it adds
   * reach only if the terms genuinely differ for those markets. Included so
   * the next person does not have to work out why it was skipped.
   */
  localized: {
    'es-MX': {
      subtitle: 'Carrera, crimen, cripto, lujo',
      promotionalText:
        'Empieza sin nada. Un trabajo, un préstamo, un riesgo. Construye una '
        + 'fortuna en la bolsa, la propiedad y el crimen; después muere y déjaselo '
        + 'todo a un heredero.',
      description: `Toda vida empieza igual: sin dinero, sin trabajo, sin plan.
Lo que pasa después depende solo de ti.

Deep Life Simulator es un simulador de vida con una economía real por debajo. El sueldo paga impuestos. Los préstamos generan intereses. El alquiler vence puedas pagarlo o no. Los mercados se mueven solos y no les importa que estés dentro. Cada decisión se acumula durante décadas, hasta que mueres y dejas lo que quede a un heredero.

CARRERA Y ESTUDIOS
Más de 20 carreras, de repartidor a cirujano o director general. Ve a la universidad, o sáltatela y empieza a ganar dinero a los 16. O toma el otro camino: la calle, la dark web y el riesgo de acabar en la cárcel.

DINERO DE VERDAD
Una bolsa en vivo con sectores que rotan. Cripto para intercambiar o minar. Propiedades para alquilar, negocios que fundar y personal que contratar. Préstamos con intereses reales, historial crediticio, deudas atrasadas y la posibilidad muy real de la quiebra.

FAMILIA Y HERENCIA
Sal con alguien, cásate, discute, divórciate. Cría hijos que heredan tus rasgos y tu fortuna. Construye una dinastía a lo largo de generaciones y desbloquea ventajas permanentes para la siguiente vida.

LUJO Y ESTATUS
Superdeportivos, relojes raros, colecciones de museo, inmuebles y reputación. Haz crecer un negocio hasta convertirlo en un imperio, o retírate pronto y conserva lo que tienes.

CÓMO TE TRATA
• Funciona sin conexión: la partida vive en tu dispositivo
• Anuncios a pantalla completa solo al cerrar un año, nunca en tus dos primeros años, y una compra los quita para siempre
• Sin barra de energía en tiempo real entre tú y la semana siguiente

Una vida dura décadas y cada semana es una decisión tuya. Casi nadie se queda en una.`,
      keywords: [
        'simulador', 'vida', 'millonario', 'riqueza', 'imperio', 'dinero',
        'negocio', 'bolsa', 'citas', 'familia', 'herencia', 'magnate', 'carcel',
      ],
    },
    'en-GB': {
      subtitle: 'Careers, crime, crypto, heirs',
      keywords: [
        'billionaire', 'dynasty', 'mafia', 'prison', 'stock', 'invest', 'property',
        'empire', 'wealth', 'dating', 'family', 'story', 'rich', 'money',
      ],
    },
  },

  /**
   * Apple indexes IAP DISPLAY NAMES. Today every one of them is a pure
   * label — "100 Gems", "Starter Pack" — carrying no search value at all.
   * These are the renames worth making; each still describes its item
   * accurately, which Apple requires.
   */
  iapRenames: [
    { from: 'Starter Pack', to: 'Millionaire Starter Pack' },
    { from: 'Premium Pack', to: 'Tycoon Premium Pack' },
    { from: 'Ultimate Pack', to: 'Empire Ultimate Pack' },
    { from: 'Mega Pack', to: 'Billionaire Mega Pack' },
    { from: 'Lifetime Premium', to: 'DeepLife+ Lifetime' },
  ],
};

export const PLAY = {
  /** 30 chars. */
  title: 'Deep Life Simulator: Tycoon',

  /** 80 chars. Shown under the title; indexed. */
  shortDescription: 'Career, crime, stocks and property. Build a fortune, then pass it on.',

  /**
   * 4000 chars. UNLIKE Apple, Google Play DOES index this, so it repeats the
   * target terms naturally rather than being pure conversion copy.
   */
  longDescription: `Deep Life Simulator is a life simulator with a real economy underneath it.

Start with nothing — no money, no job, no plan — and build a life one decision at a time. Take a career or take the criminal route. Invest in stocks, trade crypto, buy property, found a business. Marry, raise a family, and when you die, hand everything you built to an heir.

CAREERS AND EDUCATION
Choose from 20+ career ladders, from food courier to surgeon to CEO. Go to university for the qualifications, or skip school and start earning early. Every job has a wage, a ladder and a boss.

MONEY THAT BEHAVES LIKE MONEY
A live stock market with rotating sectors. Crypto to trade or mine. Property to rent out. Businesses to found and staff to hire. Loans with real interest, credit scores that matter, arrears that follow you, and bankruptcy if you get it badly wrong.

CRIME, THE MAFIA AND THE DARK WEB
Take the other road. Street work, mafia contacts, a dark web marketplace, heat, opsec and the constant risk of prison. High risk, higher reward — and a criminal record that follows you into every job interview for the rest of your life.

DATING, FAMILY AND LEGACY
Date, marry, argue, divorce. Raise children who inherit your features and your fortune. Build a dynasty across generations, earn prestige, and unlock permanent advantages for the next life. Wealth compounds across a family the way it does in life: slowly, then all at once.

LUXURY, STATUS AND THE ROAD TO BILLIONAIRE
Supercars, rare watches, museum-grade collections, property and reputation. Grow a business into an empire, or retire early and keep what you have. Getting rich is one ending. It is not the only one.

WHAT MAKES IT DIFFERENT
Most life simulators resolve a choice with a dice roll and a line of text. This one runs an economy underneath and lets it push back. The stock market moves whether or not you are watching. Interest compounds weekly on what you borrowed. Unpaid bills become arrears that follow you into next year. A career has a ladder, a wage and a ceiling, and quitting costs you something.

You can be a surgeon who never breaks the law, or a courier who ends up running a dark web operation from a rented room. Both are real routes through the same economy.

HOW IT TREATS YOU
• Plays offline — your save lives on your device
• Full-screen ads only at year-end breaks, never in your first two in-game years, and one purchase removes them permanently
• No real-time energy bar between you and the next week

If you like life simulators, tycoon games, business simulators, dating sims or story games where your choices actually compound, this one is built for you.

A life runs for decades and every week is a decision you make. Most people start a second one.`,
};

/**
 * Claims the copy makes, each with the thing in the build that backs it.
 *
 * This list exists because an audit of the previous copy found two claims that
 * were simply not true of the app, and both were the kind that costs more than
 * a rejection:
 *
 *   - "No forced ads." The build shows full-screen interstitials at in-game
 *     year boundaries (`lib/ads/interstitial.ts`). Capped and grace-periodded,
 *     but unavoidable, and therefore forced.
 *   - "No pay-to-win — everything can be earned." `utils/iapConfig.ts` sells
 *     Work Pay Boost (+50% earnings, $1.99), Mindset (50% faster promotions),
 *     Fast Learner, and Unlock All Perks ($6.99); DeepLife+ adds +25% career
 *     income. Those are permanent gameplay advantages bought with money.
 *
 * Metadata that oversells is an App Store Review 2.3.1 problem, but the
 * expensive part is what happens after it passes: a player who installed on
 * "no forced ads" meets one at the second year boundary and leaves a one-star
 * review. Rating is an input to the ranking this whole file exists to raise,
 * so a false claim does not trade honesty for installs — it trades honesty for
 * fewer installs, slightly later.
 *
 * Anything added to the description that sounds like a promise belongs here
 * with its evidence, and `check-aso.mjs` fails on the phrases already known to
 * be untrue.
 */
export const CLAIMS = [
  { claim: 'Plays offline', evidence: 'Saves are local AsyncStorage; the week loop needs no network. Ads and IAP need one, gameplay does not.' },
  { claim: 'Ads only at year-end breaks, none in the first two in-game years, removable', evidence: 'lib/ads/interstitial.ts — year-boundary gate, GRACE_WEEKS = 2 years, 3-minute floor, and the ads-removed IAP gate.' },
  { claim: 'No real-time energy bar', evidence: 'Energy is a stat restored through the week loop, not a wall-clock refill timer.' },
  { claim: '20+ career ladders', evidence: 'lib/careers/careerData.ts — 30 career ids.' },
  { claim: 'Children inherit your features', evidence: 'lib/avatar/inherit.ts, wired through CharacterAvatar on every screen that renders a child.' },
  { claim: 'Live stock market with rotating sectors', evidence: 'lib/stocks/ — sector rotation is in the weekly tick.' },
  { claim: 'Interest, arrears and bankruptcy', evidence: 'overdueBalance (STATE_VERSION 31) and the weekly cash line.' },
];

/**
 * Terms deliberately NOT used, and why. Kept in code so the reasoning
 * survives the next person who wonders where the obvious ones went.
 */
export const EXCLUSIONS = [
  { term: 'bitlife', reason: 'Competitor trademark. App Store Review 5.2.5 / Play policy — a known rejection and takedown risk, for traffic that would arrive expecting a different game.' },
  { term: 'idle', reason: 'Not an idle game. It would rank, then convert badly and drag the conversion rate that ranking depends on.' },
  { term: 'simulation', reason: 'The category is indexed automatically. Spending characters on it buys nothing.' },
  { term: 'game', reason: 'Every app in Games is already in Games. Wasted characters.' },
  { term: 'free', reason: 'Apple explicitly indexes price separately; also a rejection trigger in names.' },
  { term: 'best/new/top', reason: 'Superlatives are not searched and read as spam.' },
];
