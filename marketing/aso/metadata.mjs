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
   * The App Store Connect VERSION RECORD — the number on the product page.
   *
   * This is NOT `package.json`'s version. That one is the binary
   * (`CFBundleShortVersionString`, 2.9.0 today) and the two have deliberately
   * differed since 1.2.7: 1.2.7 shipped on a 2.2.7 binary, 1.3.1 on 2.5.0,
   * 1.3.5 on 2.5.x. Apple never compares them — the only rule is that each
   * store version beats the last RELEASED one. Raising this to match the
   * binary is a one-way door that permanently abandons the 1.x line, because
   * store numbers can only ever climb. See CLAUDE.md §9.
   *
   * `scripts/asc-release.mjs` reads this as the record to create and fill.
   */
  storeVersion: '1.5.0',

  /**
   * The "What's New" for `storeVersion`, 4000 chars max.
   *
   * Lives here rather than only in WHATS_NEW.md so there is ONE copy that
   * `check:aso` validates and `asc-release.mjs` sends to Apple verbatim.
   * Retyping it into App Store Connect is what that script exists to remove.
   * When it changes, change `lib/config/changelog.ts` (the in-app feed) and
   * WHATS_NEW.md (the prose) in the same commit — they are the same release
   * described for three audiences, and a reader who finds them disagreeing
   * cannot tell which one is the lie.
   */
  whatsNew: `New faces, real conversations, and nothing left locked.

• Character creation, rebuilt. Your face is now built from features you choose rather than picked from a gallery of portraits, and it ages with you instead of being swapped for a stranger's at each age band. Children look like children, and they inherit their parents' features.
• Spark chats are a real conversation. Break the ice, compliment, joke, flirt, ask them out for coffee, dinner or something reckless, or ask them to go steady. Every match keeps its own rapport, so a relationship is built rather than announced — and any match you'd rather not date can become a friend instead.
• Fixed a trap that could lock you out of the game. Buying a house or a company could take away the very app that manages it, and two life chapters asked for apps those same chapters were the only way to unlock. Progress only ever goes up now.
• Your starting age no longer breaks the early game. Beginner luck, the early grace period, the first-month events and the week-count goals were all measured against your age instead of your life, so anyone who didn't start at 18 lost them — and Chapter 1 opened two-thirds done.
• The dark web sells gear. The tool shop had no way in, which left 18 of the 19 street jobs locked behind tools nobody could buy. Deliveries now hand over the item you paid for, and listings rotate instead of freezing for weeks.
• The money you're shown is the money you're charged. Weekly Expenses and the Budget tab left out rent, income tax and student loan payments; the Net Worth breakdown didn't add up to the Net Worth above it. Both add up now.
• Friends are real. Only your first Spark match could ever become a contact, network contacts had no action at all, and neglecting people cost nothing. All three are fixed — and a neglected friend can now drift out of your life.
• Six more money fixes: a false "Need $10,000" on family business actions, a double-tap that could buy a vehicle twice or duplicate coins in a swap, savings with no way to pay into it, buy-outs that added no revenue, ad rewards that offered a property millionaire $50, and a poverty scholarship that promised free education and delivered respect.
• Faster and clearer. About six seconds off a cold start, a death screen that scrolls, food/gym/housing cards that show what they do to each stat, a Life Goals list that fits on a page, and a Contacts app that stays smooth in a long life.`,

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
   *
   * MEASURED, not reasoned. The first version of this field was chosen by
   * argument about the game, and Apple Ads' keyword popularity index (the
   * 5-dot scale in the Add Keywords panel, ads.apple.com) said five of the
   * fourteen picks were 1/5 — effectively unsearched:
   *
   *   billionaire 1 · dynasty 1 · property 1 · wealth 1 · rich 1
   *   mafia 3 · prison 3 · stock 3 · invest 3 · empire 3 · family 3 · story 3
   *   dating 4 · money 4
   *
   * That is 41 of 99 characters — 41% of the highest-leverage field there is —
   * ranking for terms nobody types. `dynasty` had been argued for as "winnable";
   * it is winnable because there is nothing there to win. Volume is not a thing
   * to have opinions about when the console reports it for free.
   *
   * `offline`, `wifi` and `games` are the additions, and they are the one place
   * a measured term also happens to be a true product claim: Apple rates the
   * phrases "offline games" and "no wifi games" 4/5, and this game genuinely
   * runs with no network (see CLAIMS). Ranking for a phrase needs every token
   * in it indexed, which is why `games` had to come off the wasted list.
   *
   * 16 characters are deliberately left unspent rather than filled with more
   * guesses — that is the habit that produced the five dead terms. Next
   * candidates to price in the same panel before spending them: business,
   * tycoon, gangster, jail, casino, boss.
   *
   * Popularity is a moving number. Re-check it at each release; treat these
   * scores as of 2026-08-14, US storefront.
   */
  keywords: [
    'mafia', 'prison', 'stock', 'invest', 'empire', 'dating', 'family',
    'story', 'money', 'offline', 'wifi', 'games', 'avatar',
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
      // Mirrors APPLE.whatsNew. Kept in the register of the description above
      // — this locale is a real translation, not machine output, and a
      // machine-shaped release note next to hand-written copy reads as one.
      whatsNew: `Caras nuevas, conversaciones de verdad y nada que te deje fuera.

• Creación de personaje, rehecha. Tu cara se construye a partir de rasgos que eliges, en vez de elegirse en una galería de retratos, y envejece contigo en lugar de cambiarse por la de un desconocido en cada etapa. Los niños parecen niños y heredan los rasgos de sus padres.
• Los chats de Spark son una conversación real. Rompe el hielo, halaga, bromea, coquetea, invita a un café, a cenar o a algo temerario, o pide formalizar. Cada match tiene su propia complicidad, así que una relación se construye en vez de anunciarse; y con quien no quieras salir, puedes quedar como amigos.
• Arreglado un fallo que podía dejarte fuera del juego. Comprar una casa o una empresa podía quitarte la app que la gestiona, y dos capítulos pedían apps que solo esos mismos capítulos desbloqueaban. Ahora el progreso solo sube.
• Tu edad inicial ya no rompe el principio. La suerte de novato, el periodo de gracia, los eventos del primer mes y las metas por semanas se medían contra tu edad y no contra tu vida, así que quien no empezaba a los 18 los perdía. El capítulo 1 empezaba con dos tercios hechos.
• La dark web ya vende equipo. La tienda de herramientas no tenía puerta de entrada, lo que dejaba 18 de los 19 trabajos callejeros bloqueados. Los envíos entregan lo que pagaste y los anuncios rotan en vez de congelarse durante semanas.
• El dinero que ves es el que te cobran. Los gastos semanales y la pestaña de presupuesto omitían el alquiler, los impuestos y los préstamos estudiantiles; el desglose de patrimonio no cuadraba con la cifra de arriba. Ya cuadran.
• Las amistades son reales. Solo tu primer match de Spark podía volverse contacto, los contactos de red no tenían ninguna acción y descuidar a la gente no costaba nada. Las tres cosas están arregladas, y a un amigo desatendido puedes perderlo.
• Seis arreglos más de dinero: un falso "Necesitas $10,000" en el negocio familiar, un doble toque que podía comprar un vehículo dos veces o duplicar monedas en un intercambio, ahorros sin forma de ingresar dinero, adquisiciones que no sumaban ingresos, recompensas por anuncio que ofrecían $50 a un millonario y una beca que prometía estudios gratis y daba reputación.
• Más rápido y más claro. Unos seis segundos menos al abrir, una pantalla de muerte que se desplaza bien, tarjetas de comida, gimnasio y vivienda que muestran su efecto en cada estadística, una lista de metas que cabe en una pantalla y una app de contactos fluida en vidas largas.`,

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
      // Reference only — NOT a localisation to create in App Store Connect.
      // `check:aso --emit` skips unshipped locales for exactly this reason: a
      // paste-ready block is an instruction, and pasting this one would create
      // a listing identical to the one those storefronts already fall back to.
      shipped: false,
      subtitle: 'Careers, crime, crypto, heirs',
      // Mirrors en-US exactly — that identity is the entire reason this locale
      // is not worth creating, so it has to be kept in step when en-US moves.
      keywords: [
        'mafia', 'prison', 'stock', 'invest', 'empire', 'dating', 'family',
        'story', 'money', 'offline', 'wifi', 'games', 'avatar',
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
• Plays offline — no wifi needed, your save lives on your device
• Full-screen ads only at year-end breaks, never in your first two in-game years, and one purchase removes them permanently
• No real-time energy bar between you and the next week
• Build your character: an avatar you design, who ages with you and whose face your children inherit

If you like offline games, life simulators, tycoon games, business simulators, dating sims or story games where your choices actually compound, this one is built for you.

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
  // 'game' / 'games' used to sit here on the standard advice that the category
  // makes it redundant. Apple does not index the category as a keyword, and its
  // own popularity panel rates "games", "offline games" and "no wifi games" 4/5
  // — so the word was buying nothing only because it was never bought. `games`
  // is now in the field to complete the offline phrases, which are also true of
  // the build. Kept here as a record so the advice is not re-applied blindly.
  { term: 'free', reason: 'Apple explicitly indexes price separately; also a rejection trigger in names.' },
  { term: 'best/new/top', reason: 'Superlatives are not searched and read as spam.' },
];
