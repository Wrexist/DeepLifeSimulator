/**
 * Deep Life Simulator — Beta Hub content.
 *
 * Every line of copy here describes something the game ACTUALLY does. The
 * numbers are read out of the repo, not invented:
 *
 *   35 career tracks   lib/careers/careerData.ts (30) + advancedCareers.ts (5)
 *   $110 → $2,600/wk   MIN_ENTRY_WEEKLY_SALARY / TOP_WEEKLY_SALARY_CEILING
 *   23 starting lives  lib/scenarios/scenarioDefinitions.ts
 *
 * If a feature is not in `lib/`, it does not belong in this file. A landing
 * page that promises gameplay the build does not have converts a visitor into
 * a disappointed tester, which is worse than not converting them.
 */
window.DLS_CONTENT = {

  // ── Gameplay pillars (landing page cards) ────────────────────────────────
  pillars: [
    { key: 'career',        icon: '💼', title: 'CAREER',        blurb: '35 career tracks with real ladders — fast food at $110 a week up to a surgeon, a CEO, or the President. Promotions gate on performance, not patience.' },
    { key: 'money',         icon: '💰', title: 'MONEY',         blurb: 'Income tax, rent, student loans, interest. Bills you cannot pay become arrears you carry — the money axis has a failure state.' },
    { key: 'relationships', icon: '❤️', title: 'RELATIONSHIPS', blurb: 'Spark matches with their own rapport. Break the ice, joke, flirt, ask them out, go steady. Marriage, children, and a family tree that outlives you.' },
    { key: 'property',      icon: '🏠', title: 'PROPERTY',      blurb: 'Rent a place or take a mortgage. Buy, let, set the asking rent, deal with the tenants and the market you bought into.' },
    { key: 'business',      icon: '🏢', title: 'BUSINESSES',    blurb: 'Side hustles that scale into a company, subsidiaries, employees, buy-outs — and a family business the next generation inherits.' },
    { key: 'invest',        icon: '📈', title: 'INVESTMENTS',   blurb: 'Stocks, crypto, mining, savings. Prices move on their own; so does your nerve.' },
    { key: 'choices',       icon: '🎭', title: 'CHOICES',       blurb: 'One decision a week. Education, health, karma, reputation, the people you keep — every one of them compounds.' },
    { key: 'risk',          icon: '🎲', title: 'RISK',          blurb: 'Crime, the dark web, politics, gambling on a market you do not understand. Every shortcut has a bill attached.' },
  ],

  // ── Example life paths (only routes the game actually supports) ──────────
  paths: [
    { tag: 'THE GRIND',    steps: ['Broke at 18', 'Fast food, $110/wk', 'Degree, on loans', 'Software career', 'First apartment', 'Mortgage'], note: 'The default road. Slow, and it works.' },
    { tag: 'THE FOUNDER',  steps: ['Side hustle', 'First employee', 'Registered company', 'Subsidiaries', 'Buy-out offer'], note: 'Scenario: Entrepreneur.' },
    { tag: 'THE LANDLORD', steps: ['Save a deposit', 'First mortgage', 'Let it out', 'Set the rent', 'Second property', 'Portfolio'], note: 'Scenario: Real Estate Tycoon.' },
    { tag: 'THE SHORTCUT', steps: ['Rent overdue', 'A job that pays cash', 'The dark web', 'A crew', 'Prison — or a kingpin'], note: 'Scenario: Criminal Empire. It really can end badly.' },
    { tag: 'THE OFFICE',   steps: ['Local politics', 'A campaign', 'Election night', 'Office', 'Voted out'], note: 'Scenario: Political Dynasty.' },
    { tag: 'THE DYNASTY',  steps: ['Marry', 'Children', 'Teach them well', 'Die', 'Play your heir', 'Grandchildren'], note: 'Traits and money pass down. So do your mistakes.' },
  ],

  // ── Screenshot gallery (real captures, shared with the support site) ─────
  shots: [
    { src: '../assets/shot1.png', caption: 'Live any life' },
    { src: '../assets/g2.png',    caption: 'Climb the career ladder' },
    { src: '../assets/shot3.png', caption: 'Build the empire' },
    { src: '../assets/g4.png',    caption: 'Trade & invest' },
    { src: '../assets/shot2.png', caption: 'Hustle & rise' },
    { src: '../assets/g1.png',    caption: 'Your life, at a glance' },
    { src: '../assets/shot4.png', caption: 'Go viral' },
    { src: '../assets/g5.png',    caption: 'Mind your health' },
    { src: '../assets/shot5.png', caption: 'Live well' },
    { src: '../assets/g3.png',    caption: 'Stay connected' },
    { src: '../assets/g0.png',    caption: 'Begin your story' },
    { src: '../assets/g6.png',    caption: 'A life well lived' },
  ],

  // ── FAQ ──────────────────────────────────────────────────────────────────
  faq: [
    { q: 'Is it free?', a: 'Yes. The beta is free and every tester gets the full game. There are in-app purchases in the shipping build, but nothing is charged to you during the test — and Android launches without ads.' },
    { q: 'What do I need?', a: 'An Android phone (Android 7.0 / API 24 or newer) signed into the Google account you want to test with. That account has to be the one on your phone, because Google matches the tester list against it.' },
    { q: 'How long is the beta?', a: 'Google requires testers to stay opted in for 14 continuous days before the game can go public. Play as much or as little as you like in that window — just do not leave the tester programme early, because that resets the clock for everyone.' },
    { q: 'How do I join?', a: 'Fill in the short form on this page, then tap "Join Google Play beta". You will be opted in and installing inside a minute.' },
    { q: 'Do you need my Google password?', a: 'No. Never. Nobody legitimate will ever ask for it. Google Play handles the opt-in itself — this site only records that you told us you did it.' },
    { q: 'What happens after the beta?', a: 'The game goes to the public Play Store. Testers keep their save, their badges and their place in the community, and the Ideas board carries straight over.' },
    { q: 'Can I report bugs?', a: 'Please do — it is the entire point. There is a bug form built into your dashboard with the device fields pre-filled.' },
    { q: 'How do I leave the beta?', a: 'Open the Google Play opt-in link and choose "Leave the programme", then uninstall. If you can, wait until the 14 days are up. You can also delete everything this site holds about you from your dashboard, in one tap.' },
    { q: 'What data do you keep?', a: 'A nickname, whatever contact method you chose to give, and optionally your country and phone model. No passwords, no Google credentials, no tracking across other sites. You can wipe all of it yourself from your dashboard.' },
  ],

  // ── Rotating beta missions ───────────────────────────────────────────────
  // Each one maps to a system that exists in the shipped build.
  missions: [
    { id: 'first-career',  title: 'Take any job and work it for 10 weeks',        detail: 'Then tell us whether the pay felt worth the weeks.' },
    { id: 'switch-career', title: 'Quit and start a completely different career', detail: 'We want to know if changing track feels punishing or freeing.' },
    { id: 'buy-something', title: 'Buy something you cannot really afford',       detail: 'A vehicle, a luxury item, a place to live. Watch what it does to your weekly bills.' },
    { id: 'go-on-a-date',  title: 'Match with someone on Spark and get to a date', detail: 'Rapport has to reach 45. Tell us if getting there felt like a conversation.' },
    { id: 'save-money',    title: 'Get to $10,000 in savings without a loan',     detail: 'Is the early economy too tight, too loose, or about right?' },
    { id: 'risky-choice',  title: 'Make one genuinely risky decision',            detail: 'Crime, the dark web, a leveraged trade. Did the game make the risk legible before you took it?' },
    { id: 'market',        title: 'Buy a stock or a crypto and hold it 20 weeks', detail: 'Did the price movement feel like a market or like a coin flip?' },
    { id: 'start-business',title: 'Turn a side hustle into a real business',      detail: 'Where exactly did it stop being obvious what to do next?' },
    { id: 'education',     title: 'Enrol in a programme and finish it',           detail: 'Did the payoff justify the weeks and the tuition?' },
    { id: 'random-event',  title: 'Play until a random event genuinely surprises you', detail: 'Send us the one that got you.' },
    { id: 'property',      title: 'Buy a property and rent it out',               detail: 'Setting the asking rent — clear or confusing?' },
    { id: 'one-full-life', title: 'Play a life all the way to the obituary',      detail: 'The big one. Was the ending worth the road?' },
  ],

  // ── Tester badges (community achievements — nothing Play Store related) ──
  badges: [
    { id: 'early',    icon: '🧪', name: 'Early Tester',    rule: 'Joined the closed beta.',            check: (t) => Boolean(t) },
    { id: 'first20',  icon: '🔥', name: 'First 20',        rule: 'One of the first 20 testers in.',    check: (t, ctx) => ctx.rank > 0 && ctx.rank <= 20 },
    { id: 'installed',icon: '📲', name: 'Boots On',        rule: 'Confirmed the install.',             check: (t) => t.installed },
    { id: 'player',   icon: '🎮', name: 'Actually Played', rule: 'Played the game, not just installed it.', check: (t) => t.played },
    { id: 'voice',    icon: '🗣️', name: 'Voice Heard',     rule: 'Sent feedback at least once.',       check: (t, ctx) => ctx.feedbackCount > 0 },
    { id: 'hunter',   icon: '🐛', name: 'Bug Hunter',      rule: 'Filed a bug report.',                check: (t, ctx) => ctx.bugCount > 0 },
    { id: 'ideas',    icon: '💡', name: 'Idea Machine',    rule: 'Proposed a feature.',                check: (t, ctx) => ctx.ideaCount > 0 },
    { id: 'scout',    icon: '🤝', name: 'Scout',           rule: 'Brought another tester in.',         check: (t, ctx) => ctx.referralCount > 0 },
    { id: 'grinder',  icon: '🏅', name: 'Mission Runner',  rule: 'Completed 5 beta missions.',         check: (t) => (t.missionsDone || []).length >= 5 },
    { id: 'founding', icon: '🏆', name: 'Founding Player', rule: 'Installed, played, and sent feedback.', check: (t, ctx) => t.installed && t.played && ctx.feedbackCount > 0 },
  ],

  /** Tester levels. Purely a community ladder — it buys nothing in the game. */
  levels: [0, 60, 150, 280, 450, 700, 1000, 1400, 1900, 2500],

  feedbackCategories: [
    'FUN', 'UI', 'PROGRESSION', 'ECONOMY', 'JOBS',
    'RELATIONSHIPS', 'EVENTS', 'PERFORMANCE',
  ],

  bugCategories: [
    'crash', 'gameplay', 'ui', 'save', 'economy',
    'performance', 'audio', 'ads', 'iap', 'other',
  ],

  // ── Shareable card lines (drawn from real mechanics) ─────────────────────
  cards: [
    { line: 'Start with $500.',                sub: 'Rent is due in four weeks.' },
    { line: 'Could you survive your first year?', sub: '35 careers. One choice a week.' },
    { line: 'Your choices have consequences.', sub: 'And an interest rate.' },
    { line: 'Become a CEO. Or a cautionary tale.', sub: 'Both are supported.' },
    { line: 'How rich can you get before you die?', sub: 'Then play your heir.' },
    { line: 'Every shortcut has a bill attached.', sub: 'The dark web sends invoices.' },
  ],

  // ── Marketing centre: per-platform, per-goal post templates ──────────────
  // Written to be posted BY A HUMAN, in their own voice, on communities that
  // welcome them. No false claims, no rewards we do not actually give, no
  // bulk-sending. `{{link}}` is replaced with the tracked recruitment link.
  marketing: [
    {
      platform: 'Reddit',
      key: 'reddit',
      note: 'r/AlphaandBetaUsers, r/playtesters, r/androidapps, r/lifesimulators. Read each sub\'s rules first — most want a screenshot and no bare links. Offer to test theirs back; it is the currency there.',
      posts: [
        {
          goal: 'GET TESTERS',
          headline: '[Android] Life sim with an economy that actually simulates — need closed testers (14 days), happy to test yours back',
          short: 'I built a life simulator where the economy is real: you start broke, take loans with real interest, work one of 35 careers, invest, build a family. Live on iOS, Android needs 20 closed testers for Google\'s 14-day rule. Free, no ads on Android, everything unlocked. I\'ll opt into your test too — link yours and I\'ll join.\n\n{{link}}',
          long: 'I\'ve been building Deep Life Simulator for a while — it\'s a life sim, but the money side is the point. You start at 18 with almost nothing. Rent, income tax and student loan payments come out weekly, and a bill you can\'t pay becomes arrears you carry instead of quietly vanishing. There are 35 career tracks from fast food at $110/wk up to surgeon, CEO or President, and promotions gate on performance rather than time served.\n\nAround that: property with mortgages and tenants, stocks and crypto, side hustles that scale into companies, dating with per-match rapport, kids who inherit your traits, and a dark web track if you want the game to go badly on purpose.\n\nIt\'s live on iOS. Android is the last step and Google requires 20 testers opted in for 14 continuous days before I can publish. Free, everything unlocked, no ads on the Android build.\n\nWhat I actually want back: the moment you got confused, and the moment you got bored. Those two sentences are worth more than a rating.\n\nSign-up (takes under a minute, no Google password ever asked for): {{link}}\n\nI\'ll test yours back — drop your link and I\'ll opt in today.',
          cta: 'Comment your test link and I\'ll join it too.',
          image: 'A single gameplay screenshot — the career or market screen reads best on Reddit.',
        },
        {
          goal: 'SHOW GAMEPLAY',
          headline: 'The weekly bill screen in my life sim adds up now — it didn\'t before, and that was the bug report that hurt most',
          short: 'Weekly Expenses left out rent, income tax and student loan payments, so the number I showed players was not the number I charged them. Fixed in 2.9.0. Screenshot of the new breakdown below. Android beta is open if you want to poke at it: {{link}}',
          long: 'Devlog-flavoured post: for months the Budget tab in Deep Life Simulator showed a weekly expenses figure that excluded rent, income tax and student loan repayments — three of the largest lines. The Net Worth breakdown didn\'t sum to the Net Worth above it either. Players noticed the money "disappearing" and I kept looking in the wrong place.\n\nBoth add up now. The lesson I keep relearning: if a number is displayed and also used in arithmetic, those have to be the same number, computed once.\n\nAndroid closed beta is open if you want to try to break the new one: {{link}}',
          cta: 'Try to break the economy and tell me where it gives.',
          image: 'The Budget / Net Worth breakdown screen.',
        },
      ],
    },
    {
      platform: 'Discord',
      key: 'discord',
      note: 'Your own server first — it is the warmest list you have. Then indie-game and Android-testing servers, in their designated self-promo channels only.',
      posts: [
        {
          goal: 'GET TESTERS',
          headline: '📱 Deep Life Simulator is coming to Android — I need 20 testers',
          short: '**📱 Android beta is open**\nGoogle needs 20 people opted in for 14 straight days before I can publish. If you have an Android phone and a minute, you would genuinely unblock the launch.\n\n**What you get:** the full game, free, everything unlocked, before anyone else.\n**What I want back:** the bit that confused you and the bit that bored you.\n\nSign up here → {{link}}',
          long: '**📱 Deep Life Simulator — Android closed beta**\n\nThe Android build is ready. Google requires **20 testers opted in continuously for 14 days** before the game is allowed on the public Play Store, so this is the actual gate between here and launch.\n\n**How it works**\n1. Open {{link}} and fill in the 30-second form.\n2. Tap **Join Google Play beta** — that opts you in on the Google account your phone is signed into.\n3. Install and play whenever you feel like it.\n4. Please stay opted in for the full 14 days. Dropping out early breaks the streak for everyone.\n\n**What you get:** the whole game free, everything unlocked, a Founding Player badge, and a real say — the Ideas board on the hub is where the next features come from.\n\n**What I need back:** bugs and "this bit made no sense" notes. Those beat compliments every time.\n\nNo Google password is ever asked for. Play handles the opt-in itself.',
          cta: 'React ✅ here and I\'ll follow up with anything you get stuck on.',
          image: 'The hero screenshot, or a 15-second screen recording of a week tick.',
        },
        {
          goal: 'COMMUNITY ENGAGEMENT',
          headline: 'What should go in the game next? The board is open.',
          short: 'The Ideas board on the beta hub is live — post what you want built, vote on everyone else\'s. Top-voted items are what I look at first. {{link}}',
          long: 'I want the next set of features to come from the people playing rather than from my own todo list.\n\nThe Ideas board on the beta hub is open: post a feature, say why you want it, and vote on everyone else\'s. Trending and Most Requested are both real orderings of real votes — one vote per tester, no way to stack them.\n\nI\'ll move things onto the public roadmap from that board and mark them Building when I start.\n\n{{link}}',
          cta: 'Post one idea. Vote on three.',
          image: 'A screenshot of the Ideas board.',
        },
      ],
    },
    {
      platform: 'TikTok',
      key: 'tiktok',
      note: 'Vertical screen recording, face-free is fine. Hook in the first 1.5 seconds. Link in bio — TikTok buries in-caption links.',
      posts: [
        {
          goal: 'BUILD CURIOSITY',
          headline: 'POV: you start your life with $500 and rent is due in four weeks',
          short: 'POV: you start your life with $500 and rent is due in four weeks 💀\n\n#lifesim #simulationgame #androidgames #indiegame #mobilegame',
          long: 'SCRIPT (0:00–0:22)\n\n0:00 — On screen: "$500. Rent in 4 weeks." Show the money HUD.\n0:03 — "So I took the only job that would have me." Cut to fast food, $110/wk.\n0:07 — "Four weeks of that is $440. Rent is $520."\n0:11 — Show the arrears line appearing. "Turns out the game doesn\'t forgive the bill. It remembers it."\n0:16 — Fast cuts: career screen, market screen, the property you cannot afford.\n0:20 — "Android beta is open. Link in bio."\n\nCAPTION: POV: you start your life with $500 and rent is due in four weeks 💀 Android beta open, link in bio.',
          cta: 'Link in bio → join the Android beta.',
          image: 'Screen recording: money HUD → job list → the arrears line.',
        },
        {
          goal: 'SHOW GAMEPLAY',
          headline: 'I let the game decide my whole life for 60 seconds',
          short: 'Every week, one choice. 60 seconds of a life. #lifesim #androidgames #mobilegaming #indiedev',
          long: 'SCRIPT (0:00–0:35)\n\n0:00 — "One choice a week. That\'s the whole game."\n0:04 — Speed through 10 week-ticks, calling out each choice in one word.\n0:15 — Land on a real fork: the dark web offer, or the night class.\n0:20 — "I picked wrong."\n0:26 — Show the consequence — the arrest, or the tuition bill.\n0:32 — "Android beta open. Link in bio."',
          cta: 'Link in bio.',
          image: 'Screen recording of consecutive week ticks with events.',
        },
      ],
    },
    {
      platform: 'Instagram',
      key: 'instagram',
      note: 'Reels reuse the TikTok cuts. Carousels work well for the "life paths" section — one path per slide.',
      posts: [
        {
          goal: 'BUILD CURIOSITY',
          headline: 'Your choices decide your life. Then they decide your kid\'s.',
          short: 'Your choices decide your life.\nThen they decide your kid\'s.\n\nDeep Life Simulator — Android beta now open. Link in bio.\n\n#lifesimulator #simulationgame #androidgaming #indiegame #mobilegames',
          long: 'CAROUSEL — 6 slides, one per life path.\n\n1. "Broke at 18." → the starting HUD\n2. "Fast food. $110 a week." → the job screen\n3. "A degree, on loans." → education\n4. "A career. An apartment. A mortgage." → property\n5. "A family." → the family tree\n6. "Then you die, and you play your heir." → the obituary\n\nCAPTION: Deep Life Simulator. 35 careers, a real economy, and a family tree that outlives you. Android beta is open — link in bio.',
          cta: 'Link in bio → Android beta.',
          image: 'Six gameplay screenshots as a carousel.',
        },
      ],
    },
    {
      platform: 'X',
      key: 'x',
      note: 'Short, one image, no thread unless the devlog earns it. #buildinpublic and #indiedev find the right people.',
      posts: [
        {
          goal: 'GET TESTERS',
          headline: 'Android closed beta open — 20 testers needed',
          short: 'Deep Life Simulator is coming to Android.\n\nGoogle needs 20 testers opted in for 14 days before I can publish. Free, everything unlocked, no ads on Android.\n\nIf you have an Android phone and 60 seconds:\n{{link}}\n\n#indiedev #androidgames #buildinpublic',
          long: 'THREAD\n\n1/ Deep Life Simulator has been live on iOS for a while. Android is the last step — and Google requires 20 testers opted in for 14 continuous days before I\'m allowed to publish.\n\n2/ It\'s a life sim where the economy is the point. Rent, income tax and student loans come out weekly, and an unpayable bill becomes arrears you carry rather than quietly vanishing.\n\n3/ 35 career tracks, $110/wk to $2,600/wk. Property with mortgages and tenants. Stocks, crypto, businesses, a dark web track for when you want it to go badly.\n\n4/ Free, everything unlocked, no ads on the Android build. What I want back is the moment you got confused and the moment you got bored.\n\n5/ {{link}}',
          cta: 'Reply if you want in and I\'ll help you through the opt-in.',
          image: 'One gameplay screenshot — the career ladder reads best small.',
        },
      ],
    },
    {
      platform: 'YouTube',
      key: 'youtube',
      note: 'Shorts convert best for recruitment. A long devlog converts a smaller number of much better testers.',
      posts: [
        {
          goal: 'SHOW FEATURES',
          headline: 'I built a life sim where you can go bankrupt',
          short: 'Most life sims forgive the bill. Mine doesn\'t — it remembers it. Short walkthrough of the arrears system, and how the Android beta works. {{link}}',
          long: 'OUTLINE (6–8 min devlog)\n\n0:00 The bug that started it — weekly expenses that left out rent, tax and loans\n1:00 What "the money axis has a failure state" actually means\n2:30 Arrears: the bill you can\'t pay follows you\n4:00 What that does to the career loop\n5:30 The Android closed beta — what Google requires and why I need 20 people\n6:30 How to join: {{link}}',
          cta: 'Beta link in the description.',
          image: 'Screen capture of the budget breakdown and the arrears line.',
        },
      ],
    },
    {
      platform: 'Facebook',
      key: 'facebook',
      note: 'Android beta-testing groups and life-sim fan groups. Post as a person, not a page.',
      posts: [
        {
          goal: 'GET TESTERS',
          headline: 'Looking for Android testers for my life simulator',
          short: 'I\'ve built a life simulator — careers, money, property, family, and a dark web track if you want it to go badly. It\'s on iOS already; Android needs 20 closed testers for Google\'s 14-day requirement.\n\nFree, everything unlocked, no ads. Takes under a minute to join: {{link}}',
          long: 'Hi all — I\'m the developer of Deep Life Simulator. It\'s a life sim where the economy is genuinely simulated: rent, income tax and student loan payments come out every week, and a bill you can\'t pay becomes debt you carry.\n\n35 career tracks, property with mortgages and tenants, stocks and crypto, businesses, dating and children who inherit your traits.\n\nIt\'s live on iOS. For Android, Google requires 20 testers opted in for 14 continuous days before the game can be published, so I\'m recruiting genuine players rather than numbers.\n\nFree, everything unlocked, no ads on the Android build. The sign-up takes under a minute and never asks for a Google password: {{link}}\n\nHappy to answer anything.',
          cta: 'Comment or message me if you get stuck on the opt-in.',
          image: 'Two or three gameplay screenshots.',
        },
      ],
    },
    {
      platform: 'App communities',
      key: 'app-communities',
      note: 'Mutual-testing groups (Telegram/Discord "closed testing exchange"). Reliable for numbers, weak for feedback. Use them to top up, never as the whole list — Google has denied production access when testing looks purchased and unengaged.',
      posts: [
        {
          goal: 'GET TESTERS',
          headline: 'Test-for-test: Deep Life Simulator (Android, life sim)',
          short: 'Offering a straight test-for-test. Mine: Deep Life Simulator, a life sim (careers, economy, property, family). Free, no ads, everything unlocked.\n\nJoin here: {{link}}\n\nDrop yours and I\'ll opt in the same day and actually open it — I\'d rather trade real usage than opt-ins.',
          long: 'Test-for-test, straight swap.\n\n**Mine:** Deep Life Simulator — Android life simulator. 35 careers, a simulated weekly economy (rent, tax, student loans, arrears), property with mortgages and tenants, markets, businesses, family and inheritance. Free, no ads on Android, everything unlocked for testers.\n\n**Join:** {{link}}\n\n**Yours:** drop the link and I\'ll opt in the same day. I open the apps I opt into and I\'ll send you at least one real piece of feedback — Google looks at whether testing was genuine, and a wall of installed-and-never-opened accounts is what gets production access denied. Happy to hold up my end properly.',
          cta: 'Reply with your link.',
          image: 'One screenshot.',
        },
      ],
    },
    {
      platform: 'Direct outreach',
      key: 'direct',
      note: 'Your highest-yield channel by far: existing iOS TestFlight testers who own an Android phone, then friends and family. Send it one at a time, personally.',
      posts: [
        {
          goal: 'GET TESTERS',
          headline: 'Personal DM',
          short: 'Hey [name] — Deep Life Simulator is going to Android, and Google makes you run a 14-day test with 20 people before you\'re allowed to publish. Would you be one of them?\n\nIt\'s about a minute: {{link}} → fill in the form → tap the Play link → install. Then just play whenever, and stay opted in for two weeks.\n\nCompletely free, no charges of any kind. It would genuinely help.',
          long: 'Hey [name],\n\nYou tested Deep Life Simulator on iOS (thank you again). It\'s going to Android now, and Google requires 20 people opted into a closed test for 14 continuous days before I\'m allowed to publish it. Do you have an Android phone, or a spare one?\n\nWhat it takes: open {{link}}, fill in a 30-second form, tap "Join Google Play beta", install. That\'s it. Play whenever you feel like it — the only thing that matters is staying opted in for the two weeks.\n\nFree, everything unlocked, no ads on the Android build. And if you spot something broken, there\'s a bug form built into the page that fills in your device details for you.\n\nThanks either way.',
          cta: 'Just reply "in" and I\'ll walk you through it.',
          image: 'None — a plain personal message outperforms a pitch here.',
        },
      ],
    },
  ],

  // ── Social content generator dimensions ──────────────────────────────────
  generator: {
    goals: ['GET TESTERS', 'SHOW GAMEPLAY', 'BUILD CURIOSITY', 'SHOW FEATURES', 'TEASE UPDATE', 'ANNOUNCE UPDATE', 'COMMUNITY ENGAGEMENT'],
    tones: ['Direct', 'Curious', 'Dry', 'Hyped'],
    topics: {
      CAREER:        { hook: '35 career tracks, from $110 a week to $2,600.', detail: 'Promotions gate on performance, not on time served — so a bad quarter actually costs you the raise.' },
      MONEY:         { hook: 'Rent, income tax and student loans come out every week.', detail: 'A bill you cannot pay becomes arrears you carry. The money axis has a failure state.' },
      RELATIONSHIPS: { hook: 'Every Spark match keeps its own rapport.', detail: 'Break the ice, joke, flirt, ask them out, ask them to go steady. A relationship is built, not announced.' },
      BUSINESSES:    { hook: 'A side hustle becomes a company becomes subsidiaries.', detail: 'Employees, buy-out offers, and a family business the next generation inherits.' },
      PROPERTY:      { hook: 'Rent a place, or take on a mortgage you probably should not.', detail: 'Buy, let, set the asking rent, and live with the market you bought into.' },
      'LIFE EVENTS': { hook: 'One choice a week, and the game keeps score.', detail: 'Health, karma, reputation and the people you neglected all come back around.' },
      RISK:          { hook: 'Crime, the dark web, politics, a leveraged trade.', detail: 'Every shortcut has a bill attached, and the game sends it.' },
      FAILURE:       { hook: 'You can genuinely lose.', detail: 'Arrears, prison, a career you cannot re-enter, a family that stops calling.' },
      SUCCESS:       { hook: 'Or you die rich and your heir inherits the lot.', detail: 'Traits, money and a dynasty that spans generations.' },
    },
  },

  // ── Tester communication templates ───────────────────────────────────────
  // Sent BY the operator, one at a time, to people who opted in. Nothing here
  // is bulk-sent and nothing is sent to anyone who did not ask for it.
  comms: [
    { id: 'welcome',   day: 0,  subject: 'You\'re in — here are the three steps',
      body: 'You\'re added! Three steps:\n\n1. On your Android phone, make sure the Play Store is signed into the account you gave me.\n2. Open the beta link and tap "Become a tester".\n3. Tap "Download it on Google Play" on the same page and install.\n\nIf it says "item not found", wait about 15 minutes and try again — that\'s Google propagating, not you.\n\nAnything you notice — crashes, confusing screens, prices that look wrong, anything boring — send it to me or use the bug form on your dashboard. Screenshots welcome.' },
    { id: 'day1',      day: 1,  subject: 'Did the install work?',
      body: 'Quick check — did it install OK? If the Play page gave you an error, tell me what it said and I\'ll fix it on my end. If it worked, you\'re all set; play whenever you feel like it.' },
    { id: 'day3',      day: 3,  subject: 'Try a different career',
      body: 'If you\'ve started a life: try quitting and taking a completely different job. I want to know whether switching track feels punishing or freeing — it\'s the thing I\'m least sure about.' },
    { id: 'day5',      day: 5,  subject: 'How does the progression feel?',
      body: 'Five days in. One question: does getting from week 1 to week 50 feel like progress, or like waiting? Either answer is useful, and "I stopped playing at week X" is the most useful of all.' },
    { id: 'day8',      day: 8,  subject: 'What\'s confusing?',
      body: 'The single most valuable thing you can send me: the first moment you didn\'t know what to do next. Screenshot it if you can. I can\'t see it from in here.' },
    { id: 'day12',     day: 12, subject: 'Final beta feedback',
      body: 'Two days left on the test window. If you\'ve got 3 minutes, the feedback form on your dashboard is the version of this that actually gets acted on: what was best, what was confusing, what would you change.' },
    { id: 'day14',     day: 14, subject: 'Thank you — you unblocked the launch',
      body: 'That\'s the 14 days. You can leave the tester programme any time now; it won\'t affect anything.\n\nThank you, genuinely — the test requirement is the one gate I couldn\'t get past alone. Everything you reported is on the board, and I\'ll tell you when the fixes ship.\n\nIf you want to keep playing, nothing changes; your save carries into the public release.' },
    { id: 'nudge',     day: null, subject: 'Still opted in?',
      body: 'Quick one — are you still opted in? (Play Store → the app → it should still show under the tester programme.) The count has to hold continuously, so a drop resets things on my side. No pressure to play; just don\'t leave the programme yet.' },
    { id: 'bugask',    day: null, subject: 'Can you reproduce this?',
      body: 'You mentioned something odd — can you tell me the exact steps that led to it, and what you expected to happen instead? Even a rough sequence narrows it down enormously.' },
    { id: 'newbuild',  day: null, subject: 'New build is up',
      body: 'A new build just went out on the beta track. Play should update it automatically, but you can force it from the app\'s Play Store page.\n\nWhat changed:\n- [fill in]\n\nIf something that used to work is now broken, that\'s the most urgent thing you can tell me.' },
    { id: 'launch',    day: null, subject: 'We\'re live on Google Play',
      body: 'Deep Life Simulator is live on the public Play Store — the closed test is what got it there.\n\nYour save carries over and your badges stay. If you\'d leave a review, it genuinely moves the needle at this size, but no obligation at all.\n\nThank you for the two weeks.' },
  ],
};
