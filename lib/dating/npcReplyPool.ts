/**
 * NPC reply pools — content backing Spark chat auto-replies.
 *
 * "Content is data": the reply lines live here (not hardcoded inside the
 * action) so the catalog personalities and their reply archetypes stay in one
 * place and can be coverage-tested against DATING_PROFILES.
 *
 * PREREQ BUG FIX (see audit — SparkActions generateNpcReply): the pool used to
 * key only the 8 abstract tones (adventurous, extroverted, …) while the
 * 51-profile catalog uses ~27 concrete personality slugs (analytical, caring,
 * zen, tech-savvy, …). All but three fell through to the generic `friendly`
 * pool. Every distinct DATING_PROFILES personality now has a dedicated entry —
 * `npcReplyPool.test.ts` fails if a new catalog personality is added without
 * one.
 *
 * VARIETY PASS: each personality now carries 9–12 in-voice lines (was 3, so a
 * short chat looped the same three replies). `pickNpcReply` additionally avoids
 * repeating the line the NPC last sent, so consecutive replies never duplicate.
 */

/** Reply lines keyed by profile personality. `friendly` is the safe fallback. */
export const NPC_REPLY_POOL: Record<string, string[]> = {
  // ── original abstract tones (kept + expanded) ──
  adventurous: [
    'Sounds amazing!', 'Let\'s plan something soon 🏔', 'What\'s the wildest thing you\'ve done?',
    'I booked a spontaneous trip last month — no regrets', 'Ever been cliff jumping? We should.',
    'My passport is basically my diary 🌍', 'Say the word and I\'m packed', 'Comfort zones are overrated',
    'I know a trail with the best sunrise', 'Let\'s get a little lost this weekend',
  ],
  ambitious: [
    'Always grinding. You?', 'Coffee soon?', 'I respect that.',
    'I\'m building something big — tell you over dinner', 'Goals first, then celebrate',
    'What are you working toward?', 'I love people with a plan', 'Momentum is everything',
    'Let\'s hold each other accountable', 'Rest is just prep for the next push',
  ],
  romantic: [
    'You seem sweet 💌', 'I\'d love to know more about you', 'Tell me about your dreams.',
    'I\'ve been smiling at my phone all day', 'Slow dances in the kitchen — that\'s my love language',
    'You\'d look good in candlelight', 'I still believe in the old-fashioned kind of love',
    'Write me a letter sometime?', 'I saved you a spot in my daydreams', 'Rainy days feel warmer talking to you',
  ],
  creative: [
    'I love that perspective', 'You\'d like the gallery downtown', 'I\'ve been writing again — finally',
    'My apartment is 60% unfinished projects', 'Let\'s make something together', 'What inspires you lately?',
    'I hear music in the strangest places', 'I sketched an idea you gave me', 'Color outside the lines with me',
    'A blank page is my favorite kind of trouble',
  ],
  introverted: [
    'Same energy honestly.', 'Quiet night sounds perfect', 'I like that you said that.',
    'A book and good company — that\'s my ideal', 'I recharge in the quiet, not the crowd',
    'Small talk is hard, real talk is easy with you', 'Let\'s just be, no agenda', 'I noticed the little thing you said',
    'Cozy beats loud any day', 'I\'m better in a two-person room',
  ],
  extroverted: [
    'When are you free?? 🎉', 'Friends are coming over Saturday — wanna join?', 'omg yes',
    'Let\'s make plans and MORE plans', 'I already told everyone about you 😅', 'Karaoke? Please say karaoke',
    'The more the merrier, always', 'You bring the stories, I\'ll bring the crowd', 'Life\'s a party, come dance',
    'I texted back before I finished reading 😄',
  ],
  friendly: [
    'That made my day 🙂', 'You\'re fun to talk to', 'I was hoping you\'d message.',
    'Okay you\'re officially my favorite chat', 'How\'s your day treating you?', 'I like your energy',
    'This is easy, in a good way', 'Tell me something good that happened', 'You seem genuinely kind',
    'I\'m glad we matched',
  ],
  professional: [
    'Interesting take.', 'Let\'s grab dinner this week.', 'Networking event Thursday — interested?',
    'I keep my calendar tight but I\'ll make room', 'I appreciate someone who follows through',
    'Coffee meeting that turns into something more?', 'I value clarity — I like that in you',
    'Let\'s be efficient about seeing each other 😄', 'First impressions matter; yours landed', 'Shall we set a time?',
  ],
  // ── catalog personalities (expanded) ──
  active: [
    'Just got back from a run 🏃', 'Wanna hit the trails this weekend?', 'Movement is medicine!',
    'Leg day today, brunch tomorrow?', 'I\'ll race you to the coffee shop', 'Fresh air fixes everything',
    'My step count says hi 👟', 'Let\'s do something that gets the heart rate up', 'Rest day = plotting the next adventure',
    'Sweat now, milkshakes later',
  ],
  analytical: [
    'Interesting — what\'s your reasoning?', 'I\'ve been overthinking this too 😅', 'Let\'s break it down.',
    'I made a pros-and-cons list about you (all pros)', 'Correlation isn\'t causation, but I\'m intrigued',
    'Give me the data and I\'ll give you a plan', 'I like problems with elegant solutions', 'What\'s your hypothesis?',
    'Details tell the real story', 'I ran the numbers — we should get dinner',
  ],
  artistic: [
    'That\'s so poetic', 'I painted something today — it\'s messy but honest', 'You have great taste.',
    'Beauty is everywhere if you slow down', 'I\'d love to sketch you sometime', 'What moves you?',
    'My hands are always covered in something', 'Let\'s wander a museum and make up the backstories',
    'I turned our chat into a little poem', 'Imperfect things are the most beautiful',
  ],
  caring: [
    'How are you REALLY doing?', 'I hope you ate today 🥺', 'I\'m here if you need to talk.',
    'Text me when you get home safe', 'Did you drink water? Be honest', 'Your feelings are valid, always',
    'I saved you the last good thing', 'Lean on me, I don\'t mind', 'Let me take care of dinner this time',
    'You matter more than you let yourself believe',
  ],
  cheerful: [
    'This literally made me grin 😄', 'You\'re such a mood-lifter', 'Best message all day!',
    'Okay that\'s the serotonin I needed ✨', 'Everything\'s better with a little laughter', 'You + good vibes = yes',
    'I\'m doing a happy dance rn', 'Let\'s go find something to smile about', 'Sunshine energy, honestly',
    'You make ordinary days sparkle',
  ],
  compassionate: [
    'That\'s really thoughtful of you', 'I feel that deeply', 'Be gentle with yourself.',
    'The world needs more softness like yours', 'I hear you, and I\'m not going anywhere', 'It\'s okay to not be okay',
    'Kindness is never wasted', 'Take the time you need', 'I\'ll hold space for you', 'Your heart is in the right place',
  ],
  curious: [
    'Ooh tell me more!', 'What got you into that?', 'I have a million questions now.',
    'Wait, how does that even work?', 'I fell down a research rabbit hole because of you', 'What\'s a hill you\'d die on?',
    'Teach me something weird', 'I want to know the whole story', 'Why is that? No, really — why?',
    'You\'re a delightful mystery',
  ],
  dedicated: [
    'I\'m all in when I care about something', 'Consistency > everything', 'I don\'t half-do things.',
    'If I say I\'ll be there, I\'ll be there', 'Slow and steady, but I never quit', 'I show up, rain or shine',
    'Give me a reason and I\'ll give you my best', 'Loyalty is underrated', 'I finish what I start — including this chat',
    'Steady beats flashy',
  ],
  environmentalist: [
    'Did you catch that climate piece?', 'Reusable everything ♻️', 'Nature dates > bar dates.',
    'I compost, judge me later 😄', 'Let\'s go plant something', 'The ocean has my whole heart',
    'Thrifted fits hit different', 'Ever tried a zero-waste week?', 'A hike counts as a date, right?',
    'Leave it better than you found it',
  ],
  expressive: [
    'I FEEL that 🙌', 'Say more, I love this energy', 'You get me.',
    'My emotions have emotions and that\'s fine', 'I\'ll always tell you exactly how I feel', 'This chat is giving 💯',
    'I talk with my whole hands 😄', 'Let it all out, I can take it', 'Big feelings, bigger hugs',
    'You just unlocked a whole monologue',
  ],
  handy: [
    'I could build that, honestly', 'Fixed my bike this morning 🔧', 'Give me a project and I\'m happy.',
    'My toolbox is my love language', 'Broken? I\'ll have it working by dinner', 'Let\'s build a bookshelf together',
    'I measure twice, text once 😄', 'There\'s nothing duct tape and I can\'t solve', 'I made that, actually',
    'Bring me your broken things',
  ],
  heroic: [
    'I\'d have your back, no question', 'Someone had to step up', 'Doing the right thing matters.',
    'I\'ll walk you to your door, every time', 'Courage is just caring out loud', 'Point me at the problem',
    'I don\'t look away when it\'s hard', 'You\'re safe with me', 'I\'d do it again in a heartbeat',
    'Stand for something, always',
  ],
  intellectual: [
    'Have you read anything good lately?', 'That\'s a fascinating take', 'Let\'s debate this over coffee.',
    'I collect ideas like other people collect shoes', 'Give me a good documentary and I\'m yours', 'What\'s your favorite unsolved question?',
    'I love a mind that changes when the facts do', 'Let\'s argue kindly and learn something', 'Books are just portable friends',
    'Tell me a theory that keeps you up at night',
  ],
  intelligent: [
    'Sharp — I like how you think', 'Good point, I hadn\'t considered that', 'You keep me on my toes.',
    'Okay, that was clever 😏', 'I love a conversation I have to keep up with', 'You caught the nuance — most miss it',
    'Say the smart thing again', 'We\'d have great arguments, the fun kind', 'Wit is my weakness, apparently',
    'You make me want to be sharper',
  ],
  leadership: [
    'I\'ll organize it, don\'t worry', 'Let\'s make a plan and commit', 'People count on me — I like that.',
    'I\'ll handle the details, you just show up', 'Decisions don\'t scare me', 'I lead, but I listen first',
    'Let\'s set a goal and go get it', 'I\'ve got us covered', 'Follow me, I know a shortcut 😄', 'Vision without action is just a wish',
  ],
  motivational: [
    'You\'ve totally got this 💪', 'Small steps still count!', 'Let\'s be each other\'s hype crew.',
    'Bad day? Tomorrow\'s a fresh start', 'I believe in you, no notes', 'Progress over perfection, always',
    'You\'re closer than you think', 'Let\'s turn that maybe into a yes', 'I\'ll cheer the loudest, promise',
    'One percent better every day',
  ],
  passionate: [
    'I go all-in on what I love ❤️‍🔥', 'Tell me what lights you up', 'Life\'s too short to be lukewarm.',
    'I don\'t do halfway, ever', 'When I care, you\'ll know it', 'Let\'s chase something with our whole hearts',
    'Intensity is just love with the volume up', 'I want the real thing or nothing', 'Feel it all the way, why not',
    'You stir something up in me',
  ],
  patient: [
    'No rush at all 🙂', 'Good things take time', 'I\'m happy to just talk.',
    'We can go as slow as you like', 'I\'ll be here when you\'re ready', 'The best things are worth the wait',
    'No pressure, only pace', 'I\'m not going anywhere', 'Take a breath, I\'ve got time', 'Let it unfold naturally',
  ],
  social: [
    'My friends would adore you', 'There\'s a thing Friday — come!', 'I know everyone, honestly 😅',
    'Let me introduce you to my people', 'I collect friends like plants', 'Group hangs are my cardio',
    'You\'d be the hit of the dinner party', 'I\'ve got us on three guest lists already', 'Come be my plus-one',
    'Everyone\'s better in good company',
  ],
  sophisticated: [
    'There\'s a wine bar I think you\'d like', 'Charmed, truly', 'Let\'s make it an occasion.',
    'I dress for dinner even when it\'s takeout', 'A little jazz, a little candlelight?', 'Taste is timeless',
    'I know a place with the perfect nightcap', 'Let\'s be effortlessly extravagant', 'Elegance is a mood, not a price',
    'Shall we, then?',
  ],
  stylish: [
    'Okay your vibe is immaculate ✨', 'We\'d take great photos', 'Fashion is self-expression, right?',
    'I dress for the plot, always', 'Tell me the fit and I\'ll tell you the mood', 'Let\'s go somewhere worth dressing up for',
    'Details are everything, darling', 'Your aesthetic? Chef\'s kiss', 'I\'d raid your closet, respectfully',
    'Confidence is the best accessory',
  ],
  'tech-savvy': [
    'Automating my whole apartment lol 🤖', 'Have you tried the new build? It\'s slick', 'I\'ll debug your day, just say the word 😄',
    'My smart fridge just judged my snacks', 'Let\'s over-engineer date night', 'I wrote a script for that, obviously',
    'Ping me anytime, I\'m basically always online', 'Gadgets are my love language', 'I\'ll optimize us into the perfect match',
    'There\'s an app for this, but talking\'s better',
  ],
  thoughtful: [
    'I\'ve been thinking about what you said', 'Here\'s a little something I noticed about you', 'You matter to me already.',
    'I remembered the small detail you mentioned', 'I got you the thing you didn\'t know you needed', 'Your words stayed with me',
    'I like to sit with an idea before I speak', 'Let me really consider that', 'I planned something with you in mind',
    'The little things aren\'t little to me',
  ],
  zen: [
    'Breathe — it\'s all unfolding 🧘', 'I like slow mornings and honest talks', 'Peace over drama, always.',
    'Let\'s not force it, let\'s flow', 'Tea, silence, good company — bliss', 'The present moment is enough',
    'I left my worries on the mat today', 'Stillness says a lot', 'We can just be here, together',
    'Calm is a superpower',
  ],
};

/** Resolve the reply pool for a personality, falling back to `friendly`. */
export function getNpcReplyPool(personality: string): string[] {
  return NPC_REPLY_POOL[personality] ?? NPC_REPLY_POOL.friendly;
}

/**
 * Pick a reply line, avoiding an immediate repeat of `lastText` (the line the
 * NPC last sent in this chat) so a match never says the same thing twice in a
 * row. `roll` is a 0..1 value — live callers pass `Math.random()`; tests pass a
 * fixed roll for determinism. Falls back to the full pool when de-duping would
 * leave nothing (e.g. a single-line pool).
 */
export function pickNpcReply(pool: string[], lastText: string | undefined, roll: number): string {
  const source = Array.isArray(pool) && pool.length > 0 ? pool : NPC_REPLY_POOL.friendly;
  const candidates = lastText != null ? source.filter((l) => l !== lastText) : source;
  const list = candidates.length > 0 ? candidates : source;
  const r = Math.max(0, Math.min(0.999999, typeof roll === 'number' && isFinite(roll) ? roll : 0));
  return list[Math.floor(r * list.length)] ?? list[0];
}
