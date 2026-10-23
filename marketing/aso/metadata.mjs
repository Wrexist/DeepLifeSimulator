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
  storeVersion: '1.9.0',

  /**
   * MANUAL: an approved version waits for a person to press Release in App
   * Store Connect, so App Review can run in parallel with the TestFlight
   * device checks and nothing reaches players until those pass. Read by
   * asc-release.mjs only when it CREATES a version record; an existing record
   * keeps whatever it was created with.
   */
  releaseType: 'MANUAL',

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
  whatsNew: `Fair play, all the way up: sixty more fixes, and rewards that finally do what they say.

• Legacy that counts. Inherited Legacy Bonuses now apply: extra income, faster learning and reputation for your heir.
• Weddings worth the venue. Each venue gives the happiness and reputation it advertises.
• Rest that restores. Resting no longer costs energy, and your weekly energy refill is no longer partly lost.
• Smarter banking. Mortgages and car loans come with the home or car you buy, and a matured CD drops to the savings rate.
• Family that sticks. Bonds with your children hold, marriages count toward achievements, and heirs get their own luck.
• Safer saves. Heirs can restore their own backups, and cloud restores keep purchases you just made.
• Every save carries over.`,

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
    'story', 'money', 'offline', 'wifi', 'games', 'avatar', 'rich', 'choice', 'rpg',
  ],

  /** 170 chars. The ONLY field that updates without a review cycle. */
  promotionalText:
    'New: go live and get famous. Stream, grow a following and level up your Life Skills, then build a fortune, raise a family and hand it all to an heir.',

  /**
   * 4000 chars. NOT indexed by Apple — this field is pure conversion.
   * Only the first three lines show before the "more" tap, so they carry the
   * whole hook.
   */
  description: `Every life starts the same way: no money, no job, no plan.
What happens next is entirely yours.

Deep Life Simulator is a life sim with a real economy underneath it. Wages are taxed. Loans charge interest. Rent is due whether or not you can pay. Markets move on their own and do not care that you are in them. Every choice compounds, for decades, until you die and hand what is left to an heir.

BUILD A CAREER, OR DON'T
• 20+ career ladders, from courier to surgeon to CEO
• Go to university, or skip it and start earning at 16
• Or take the other road: street work, the dark web, and the chance of prison

GO LIVE AND GET FAMOUS
• Stream live, upload videos and grow a following from zero
• Hype trains, personal bests and a recap after every broadcast
• Level up Life Skills that make every career and goal easier

MAKE REAL MONEY MOVES
• A live stock market with sectors that rotate
• Crypto you can trade or mine
• Property to rent out, businesses to found, staff to hire
• Loans, credit scores, arrears and the very real possibility of bankruptcy

LIVE AN ACTUAL LIFE
• Date, marry, argue, divorce
• Raise children who inherit your looks and your money
• Keep your health, your friends and your reputation alive
• Buy the watch, the car, the house — or don't, and retire early

THEN DO IT ALL AGAIN
When you die, your heir takes over. They keep the fortune you built, the family name you made, and the mess you left behind. Prestige across generations, unlock permanent advantages, and find out how far a dynasty can go.

WHY THIS ONE AND NOT ANOTHER LIFE SIM
Most life sims resolve a choice with a dice roll and a line of text. Here the economy keeps running between your decisions and pushes back on them. Nothing waits for you to look at it.

You can be a surgeon who never breaks the law, or a courier who ends up running a dark web operation out of a rented room. Both are real routes through the same economy, and neither is the "correct" one.

HOW IT TREATS YOU
• Plays offline — your save lives on your device
• Full-screen ads only at year-end breaks, never in your first two years, and one purchase removes them permanently
• No real-time energy bar standing between you and the next week

A life runs for decades and every week is a decision you make. Most people start a second one.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://wrexist.github.io/DeepLifeSimulator/privacy.html`,

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
        'Nuevo: sal en directo y hazte famoso. Haz streams, gana seguidores y mejora tus habilidades; luego crea una fortuna, una familia y déjaselo todo a un heredero.',
      // Mirrors APPLE.whatsNew. Kept in the register of the description above
      // — this locale is a real translation, not machine output, and a
      // machine-shaped release note next to hand-written copy reads as one.
      whatsNew: `Juego limpio de principio a fin: sesenta correcciones más y recompensas que por fin hacen lo que prometen.

• Un legado que cuenta. Las bonificaciones de legado heredadas ya se aplican: más ingresos, aprendizaje más rápido y reputación para tu heredero.
• Bodas que valen el lugar. Cada lugar da la felicidad y la reputación que anuncia.
• Descanso que repone. Descansar ya no cuesta energía y la recarga semanal de energía ya no se pierde en parte.
• Banca más sensata. Las hipotecas y los préstamos de coche vienen con la casa o el coche que compras, y un depósito a plazo vencido baja a la tasa de ahorro.
• Una familia que perdura. Los lazos con tus hijos se mantienen, los matrimonios cuentan para los logros y los herederos tienen su propia suerte.
• Partidas más seguras. Los herederos pueden restaurar sus propias copias y restaurar desde la nube conserva las compras recientes.
• Todas las partidas se conservan.`,

      description: `Toda vida empieza igual: sin dinero, sin trabajo, sin plan.
Lo que pasa después depende solo de ti.

Deep Life Simulator es un simulador de vida con una economía real por debajo. El sueldo paga impuestos. Los préstamos generan intereses. El alquiler vence puedas pagarlo o no. Los mercados se mueven solos y no les importa que estés dentro. Cada decisión se acumula durante décadas, hasta que mueres y dejas lo que quede a un heredero.

CARRERA Y ESTUDIOS
Más de 20 carreras, de repartidor a cirujano o director general. Ve a la universidad, o sáltatela y empieza a ganar dinero a los 16. O toma el otro camino: la calle, la dark web y el riesgo de acabar en la cárcel.

FAMA EN DIRECTO
Haz directos, sube vídeos y crea una comunidad desde cero, con hype trains, récords personales y un resumen tras cada emisión. Mejora tus habilidades de vida para que cada carrera y cada meta sean más fáciles.

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

Una vida dura décadas y cada semana es una decisión tuya. Casi nadie se queda en una.

Términos de uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Política de privacidad: https://wrexist.github.io/DeepLifeSimulator/privacy.html`,
      keywords: [
        'simulador', 'vida', 'millonario', 'riqueza', 'imperio', 'dinero',
        'negocio', 'bolsa', 'citas', 'familia', 'herencia', 'magnate', 'carcel',
      ],
    },
    'pt-BR': {
      // Players asked for Portuguese (a 1★ review on 1.5.5 names it), and Brazil
      // is a large life-sim market. pt-BR, fr-FR and de-DE were created on the
      // 1.6.0 record by `asc-release.mjs` (2026-10-11), which now writes the
      // whole listing for every managed locale. A future new language can be
      // marked `pending: true` until its first release run creates it. Not
      // `shipped: false`: that means reference only, never created (en-GB).
      //
      // The UI is English only, so the description says so. A Portuguese page
      // for an English game, with nothing said, is exactly how the "not in
      // Portuguese" 1★ happens. UI labels stay in English in the notes for the
      // same reason: "Next Week" is what the button says.
      // "simulador de vida" is the query this market types. The name is per
      // locale on the App Store, so it can carry it without touching en-US.
      name: 'Deep Life: Simulador de Vida',
      subtitle: 'Carreira, crime, cripto, luxo',
      promotionalText:
        'Novo: entre ao vivo e fique famoso. Faça lives, ganhe seguidores e evolua suas habilidades; depois faça fortuna, crie uma família e deixe tudo a um herdeiro.',
      whatsNew: `Jogo limpo do início ao fim: mais sessenta correções e recompensas que finalmente fazem o que prometem.

• Um legado que conta. Os bônus de legado herdados agora valem: mais renda, aprendizado mais rápido e reputação para o seu herdeiro.
• Casamentos que valem o local. Cada local dá a felicidade e a reputação que anuncia.
• Descanso que recupera. Descansar não custa mais energia, e a recarga semanal de energia não é mais perdida em parte.
• Banco mais sensato. Financiamentos de casa e carro vêm com o imóvel ou o carro que você compra, e um CDB vencido cai para a taxa da poupança.
• Uma família que dura. Os laços com seus filhos se mantêm, casamentos contam para as conquistas e os herdeiros têm a própria sorte.
• Saves mais seguros. Herdeiros podem restaurar os próprios backups, e restaurar da nuvem mantém compras recentes.
• Todos os saves continuam valendo.`,

      description: `Toda vida começa do mesmo jeito: sem dinheiro, sem emprego, sem plano.
O que acontece depois depende só de você.

Deep Life Simulator é um simulador de vida com uma economia de verdade por baixo. O salário paga imposto. Empréstimos cobram juros. O aluguel vence, dê para pagar ou não. Os mercados se mexem sozinhos e não ligam se você está dentro. Cada escolha se acumula por décadas, até você morrer e deixar o que sobrou para um herdeiro.

IDIOMA
O jogo está em inglês. Esta página está em português para você saber exatamente o que vai encontrar.

CARREIRA E ESTUDOS
Mais de 20 carreiras, de entregador a cirurgião ou CEO. Faça faculdade, ou pule essa parte e comece a ganhar dinheiro aos 16. Ou siga pelo outro caminho: a rua, a dark web e o risco de acabar na prisão.

FAMA AO VIVO
Faça lives, envie vídeos e construa uma comunidade do zero, com hype trains, recordes pessoais e um resumo depois de cada transmissão. Evolua suas habilidades de vida para deixar cada carreira e cada meta mais fáceis.

DINHEIRO DE VERDADE
Uma bolsa ao vivo com setores que giram. Cripto para negociar ou minerar. Imóveis para alugar, empresas para abrir e funcionários para contratar. Empréstimos com juros reais, score de crédito, dívidas em atraso e a possibilidade bem real de falência.

FAMÍLIA E HERANÇA
Namore, case, brigue, divorcie-se. Crie filhos que herdam seus traços e sua fortuna. Construa uma dinastia ao longo de gerações e desbloqueie vantagens permanentes para a próxima vida.

LUXO E STATUS
Superesportivos, relógios raros, coleções de museu, imóveis e reputação. Transforme um negócio em império, ou se aposente cedo e fique com o que tem.

COMO O JOGO TE TRATA
• Funciona offline: o save fica no seu aparelho
• Anúncios em tela cheia só na virada do ano, nunca nos seus dois primeiros anos, e uma compra os remove para sempre
• Sem barra de energia em tempo real entre você e a próxima semana

Uma vida dura décadas e cada semana é uma decisão sua. Quase ninguém para na primeira.

Termos de Uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Política de Privacidade: https://wrexist.github.io/DeepLifeSimulator/privacy.html`,
      // No term from the name or subtitle: Apple matches across fields.
      keywords: [
        'jogo', 'offline', 'milionario', 'dinheiro', 'negocio', 'bolsa', 'namoro',
        'familia', 'heranca', 'magnata', 'prisao', 'imperio', 'riqueza',
      ],
    },
    'fr-FR': {
      // France is the largest non-English market by new customers (RevenueCat,
      // 2026-08-28 → 09-24: 34 of 820). Same reasoning and the same manual first
      // step as pt-BR above; the name matches the live French Play listing.
      name: 'Deep Life : Simulateur de vie',
      subtitle: 'Carrière, crime, crypto, luxe',
      promotionalText:
        "Nouveau : passez en live et devenez célèbre. Streamez, gagnez des abonnés, améliorez vos compétences, puis bâtissez une fortune et léguez-la.",
      whatsNew: `Fair-play jusqu'au bout : soixante corrections de plus, et des récompenses qui font enfin ce qu'elles promettent.

• Un héritage qui compte. Les bonus d'héritage s'appliquent désormais : revenus en plus, apprentissage plus rapide et réputation pour votre héritier.
• Des mariages à la hauteur du lieu. Chaque lieu apporte le bonheur et la réputation annoncés.
• Un repos qui repose. Se reposer ne coûte plus d'énergie, et la recharge hebdomadaire d'énergie n'est plus en partie perdue.
• Une banque plus juste. Les prêts immobiliers et auto vont avec le logement ou la voiture achetés, et un dépôt à terme échu passe au taux d'épargne.
• Une famille qui tient. Les liens avec vos enfants tiennent, les mariages comptent pour les succès et les héritiers ont leur propre chance.
• Des sauvegardes plus sûres. Les héritiers peuvent restaurer leurs propres sauvegardes, et une restauration depuis le cloud garde vos achats récents.
• Toutes les sauvegardes sont conservées.`,

      description: `Toute vie commence de la même façon : sans argent, sans emploi, sans plan.
La suite ne dépend que de vous.

Deep Life Simulator est une simulation de vie avec une vraie économie en dessous. Le salaire est imposé. Les prêts coûtent des intérêts. Le loyer tombe, que vous puissiez le payer ou non. Les marchés bougent seuls et se moquent que vous y soyez. Chaque choix s'accumule pendant des décennies, jusqu'à votre mort, et ce qu'il reste passe à un héritier.

LANGUE
Le jeu est en anglais. Cette page est en français pour que vous sachiez exactement à quoi vous attendre.

CARRIÈRE ET ÉTUDES
Plus de 20 carrières, de livreur à chirurgien ou PDG. Allez à l'université, ou passez-vous-en et commencez à gagner de l'argent à 16 ans. Ou prenez l'autre route : la rue, le dark web et le risque de finir en prison.

LA GLOIRE EN LIVE
Lancez des lives, publiez des vidéos et bâtissez une communauté à partir de rien, avec hype trains, records personnels et un récap après chaque diffusion. Améliorez vos compétences de vie pour faciliter chaque carrière et chaque objectif.

DE L'ARGENT QUI SE COMPORTE COMME DE L'ARGENT
Une bourse en direct où les secteurs tournent. Des cryptos à échanger ou à miner. Des biens à louer, des entreprises à fonder et du personnel à recruter. Des prêts avec de vrais intérêts, une cote de crédit, des impayés et la possibilité bien réelle de la faillite.

FAMILLE ET HÉRITAGE
Sortez avec quelqu'un, mariez-vous, disputez-vous, divorcez. Élevez des enfants qui héritent de vos traits et de votre fortune. Bâtissez une dynastie sur plusieurs générations et débloquez des avantages permanents pour la vie suivante.

LUXE ET STATUT
Supercars, montres rares, collections dignes d'un musée, immobilier et réputation. Faites d'une entreprise un empire, ou prenez une retraite anticipée et gardez ce que vous avez.

COMMENT LE JEU VOUS TRAITE
• Fonctionne hors connexion : la partie reste sur votre appareil
• Publicités plein écran seulement en fin d'année de jeu, jamais pendant vos deux premières années, et un achat les supprime définitivement
• Pas de barre d'énergie en temps réel entre vous et la semaine suivante

Une vie dure des décennies et chaque semaine est une décision. La plupart des joueurs en commencent une deuxième.

Conditions d'utilisation (CLUF) : https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Politique de confidentialité : https://wrexist.github.io/DeepLifeSimulator/privacy.html`,
      // Accents dropped, as in es-MX and pt-BR. "hors" + "ligne" together
      // match "hors ligne" (Apple matches across the field).
      keywords: [
        'jeu', 'hors', 'ligne', 'argent', 'millionnaire', 'empire', 'bourse',
        'entreprise', 'famille', 'heritage', 'prison', 'rencontre', 'magnat',
      ],
    },
    'de-DE': {
      // Germany is the next non-English market by new customers (RevenueCat,
      // 2026-08-28 → 09-24: 20 of 820, level with Canada). Same manual first
      // step as pt-BR; the name matches the live German Play listing.
      name: 'Deep Life: Lebenssimulation',
      subtitle: 'Karriere, Verbrechen, Krypto',
      promotionalText:
        'Neu: Geh live und werde berühmt. Streame, gewinne Follower und verbessere deine Fähigkeiten, dann bau ein Vermögen und eine Familie auf und vererbe alles.',
      whatsNew: `Fair bis ganz nach oben: sechzig weitere Korrekturen und Belohnungen, die endlich halten, was sie versprechen.

• Ein Erbe, das zählt. Geerbte Vermächtnis-Boni wirken jetzt: mehr Einkommen, schnelleres Lernen und Ansehen für deinen Erben.
• Hochzeiten, die den Ort wert sind. Jeder Ort bringt das Glück und Ansehen, das er verspricht.
• Erholung, die erholt. Ausruhen kostet keine Energie mehr, und die wöchentliche Energieaufladung geht nicht mehr teilweise verloren.
• Klügere Bank. Hypotheken und Autokredite gibt es zum Haus oder Auto, das du kaufst, und ein fälliges Festgeld fällt auf den Sparzins.
• Familie, die hält. Bindungen zu deinen Kindern bleiben, Ehen zählen für Erfolge, und Erben haben ihr eigenes Glück.
• Sicherere Spielstände. Erben können ihre eigenen Backups wiederherstellen, und Wiederherstellen aus der Cloud behält frische Käufe.
• Jeder Spielstand bleibt erhalten.`,

      description: `Jedes Leben beginnt gleich: kein Geld, kein Job, kein Plan.
Was danach passiert, liegt ganz bei dir.

Deep Life Simulator ist eine Lebenssimulation mit einer echten Wirtschaft darunter. Löhne werden besteuert. Kredite kosten Zinsen. Die Miete ist fällig, ob du zahlen kannst oder nicht. Märkte bewegen sich von selbst, und es ist ihnen egal, dass du investiert bist. Jede Entscheidung summiert sich über Jahrzehnte, bis du stirbst und den Rest einem Erben hinterlässt.

SPRACHE
Das Spiel ist auf Englisch. Diese Seite ist auf Deutsch, damit du genau weißt, was dich erwartet.

KARRIERE UND AUSBILDUNG
Über 20 Karrieren, vom Kurier bis zur Chirurgin oder zum CEO. Geh an die Uni, oder lass es und verdiene schon mit 16 Geld. Oder nimm den anderen Weg: die Straße, das Darknet und das Risiko, im Gefängnis zu landen.

BERÜHMT WERDEN, LIVE
Streame live, lade Videos hoch und bau dir eine Community von null auf, mit Hype Trains, persönlichen Rekorden und einem Rückblick nach jeder Übertragung. Verbessere deine Lebensfähigkeiten, damit jede Karriere und jedes Ziel leichter wird.

GELD, DAS SICH WIE GELD VERHÄLT
Eine Live-Börse mit rotierenden Sektoren. Krypto zum Handeln oder Minen. Immobilien zum Vermieten, Firmen zum Gründen und Personal zum Einstellen. Kredite mit echten Zinsen, Bonität, Zahlungsrückstände und die sehr reale Möglichkeit der Pleite.

FAMILIE UND ERBE
Date, heirate, streite, lass dich scheiden. Zieh Kinder groß, die deine Züge und dein Vermögen erben. Bau über Generationen eine Dynastie auf und schalte dauerhafte Vorteile für das nächste Leben frei.

LUXUS UND STATUS
Supersportwagen, seltene Uhren, museumsreife Sammlungen, Immobilien und Ansehen. Mach aus einer Firma ein Imperium, oder geh früh in Rente und behalte, was du hast.

WIE DAS SPIEL DICH BEHANDELT
• Funktioniert offline: dein Spielstand bleibt auf deinem Gerät
• Vollbildwerbung nur am Ende eines Spieljahres, nie in deinen ersten zwei Jahren, und ein Kauf entfernt sie dauerhaft
• Keine Echtzeit-Energieleiste zwischen dir und der nächsten Woche

Ein Leben dauert Jahrzehnte, und jede Woche ist eine Entscheidung. Die meisten fangen ein zweites an.

Nutzungsbedingungen (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Datenschutzerklärung: https://wrexist.github.io/DeepLifeSimulator/privacy.html`,
      // Umlauts dropped (börse → borse), as accents are in the other locales.
      keywords: [
        'spiel', 'offline', 'geld', 'millionar', 'reichtum', 'imperium', 'borse',
        'firma', 'familie', 'erbe', 'gefangnis', 'magnat', 'aktien',
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
        'story', 'money', 'offline', 'wifi', 'games', 'avatar', 'rich', 'choice', 'rpg',
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
   * "What's new in this release", 500 chars per language. Sent by
   * scripts/play-release.mjs when it promotes a build, only for languages the
   * Play listing carries (the rest fall back to the listing default). The same
   * release as APPLE.whatsNew, cut to Play's limit.
   */
  releaseNotes: {
    'en-US': `Sixty more fixes, and rewards that do what they say.
• Inherited Legacy Bonuses now apply to your heir.
• Wedding venues give the happiness and reputation they advertise.
• Resting no longer costs energy, and the weekly refill is no longer lost.
• Mortgages and car loans come with the home or car you buy.
• Heirs can restore their own backups and get their own luck.
• Every save carries over.`,
    'es-419': `Sesenta correcciones más y recompensas que cumplen lo que prometen.
• Las bonificaciones de legado heredadas ya se aplican a tu heredero.
• Los lugares de boda dan la felicidad y reputación que anuncian.
• Descansar ya no cuesta energía y la recarga semanal ya no se pierde.
• Hipotecas y préstamos de coche vienen con la casa o el coche.
• Los herederos restauran sus copias y tienen su propia suerte.
• Todas las partidas se conservan.`,
    'pt-BR': `Mais sessenta correções e recompensas que cumprem o que prometem.
• Os bônus de legado herdados agora valem para o seu herdeiro.
• Locais de casamento dão a felicidade e a reputação que anunciam.
• Descansar não custa energia, e a recarga semanal não se perde mais.
• Financiamentos de casa e carro vêm com o imóvel ou o carro.
• Herdeiros restauram os próprios backups e têm a própria sorte.
• Todos os saves continuam valendo.`,
    'fr-FR': `Soixante corrections de plus, et des récompenses qui tiennent parole.
• Les bonus d'héritage s'appliquent désormais à votre héritier.
• Les lieux de mariage apportent le bonheur et la réputation annoncés.
• Se reposer ne coûte plus d'énergie, et la recharge hebdo n'est plus perdue.
• Prêts immobiliers et auto vont avec le logement ou la voiture achetés.
• Les héritiers restaurent leurs sauvegardes et ont leur propre chance.
• Toutes les sauvegardes sont conservées.`,
    'de-DE': `Sechzig weitere Korrekturen und Belohnungen, die halten, was sie versprechen.
• Geerbte Vermächtnis-Boni wirken jetzt für deinen Erben.
• Hochzeitsorte bringen das versprochene Glück und Ansehen.
• Ausruhen kostet keine Energie, die Wochenaufladung geht nicht mehr verloren.
• Hypotheken und Autokredite gibt es zum gekauften Haus oder Auto.
• Erben stellen eigene Backups wieder her und haben eigenes Glück.
• Jeder Spielstand bleibt erhalten.`,
  },

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
  { claim: 'Full-screen ads only at year-end breaks, none in the first two in-game years, removable', evidence: 'lib/ads/yearEndBreak.ts decideYearEndBreak paces both the rewarded break and the interstitial fallback (lib/ads/interstitial.ts): year boundary only, 2-year grace, session warm-up, 3-minute floor, per-session cap, never for payers or with ads removed. A home-screen banner shows after the first in-game year (components/BannerAd.tsx), also removed by Remove Ads.' },
  { claim: 'No real-time energy bar', evidence: 'Energy is a stat restored through the week loop, not a wall-clock refill timer.' },
  { claim: '20+ career ladders', evidence: 'lib/careers/careerData.ts — 30 career ids.' },
  { claim: 'Children inherit your features', evidence: 'lib/avatar/inherit.ts, wired through CharacterAvatar on every screen that renders a child.' },
  { claim: 'Live stock market with rotating sectors', evidence: 'lib/stocks/ — sector rotation is in the weekly tick.' },
  { claim: 'Stream live, upload videos, recap after every broadcast', evidence: 'components/computer/GamingStreamingApp.tsx + StreamSummaryModal, GamingApp.tsx + VideoSummaryModal, contexts/game/actions/ContentActions.ts.' },
  { claim: 'Life Skills that make careers and goals easier', evidence: 'components/SkillTreeModal.tsx, lib/skillTrees/lifeSkillEffects.ts (skill-point + money cost, effects applied in play).' },
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
