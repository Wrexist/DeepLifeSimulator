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
 */

/** Reply lines keyed by profile personality. `friendly` is the safe fallback. */
export const NPC_REPLY_POOL: Record<string, string[]> = {
  // ── original abstract tones (kept) ──
  adventurous: ['Sounds amazing!', 'Let\'s plan something soon 🏔', 'What\'s the wildest thing you\'ve done?'],
  ambitious: ['Always grinding. You?', 'Coffee soon?', 'I respect that.'],
  romantic: ['You seem sweet 💌', 'I\'d love to know more about you', 'Tell me about your dreams.'],
  creative: ['I love that perspective', 'You\'d like the gallery downtown', 'I\'ve been writing again — finally'],
  introverted: ['Same energy honestly.', 'Quiet night sounds perfect', 'I like that you said that.'],
  extroverted: ['When are you free?? 🎉', 'Friends are coming over Saturday — wanna join?', 'omg yes'],
  friendly: ['That made my day 🙂', 'You\'re fun to talk to', 'I was hoping you\'d message.'],
  professional: ['Interesting take.', 'Let\'s grab dinner this week.', 'Networking event Thursday — interested?'],
  // ── catalog personalities ──
  active: ['Just got back from a run 🏃', 'Wanna hit the trails this weekend?', 'Movement is medicine!'],
  analytical: ['Interesting — what\'s your reasoning?', 'I\'ve been overthinking this too 😅', 'Let\'s break it down.'],
  artistic: ['That\'s so poetic', 'I painted something today — it\'s messy but honest', 'You have great taste.'],
  caring: ['How are you REALLY doing?', 'I hope you ate today 🥺', 'I\'m here if you need to talk.'],
  cheerful: ['This literally made me grin 😄', 'You\'re such a mood-lifter', 'Best message all day!'],
  compassionate: ['That\'s really thoughtful of you', 'I feel that deeply', 'Be gentle with yourself.'],
  curious: ['Ooh tell me more!', 'What got you into that?', 'I have a million questions now.'],
  dedicated: ['I\'m all in when I care about something', 'Consistency > everything', 'I don\'t half-do things.'],
  environmentalist: ['Did you catch that climate piece?', 'Reusable everything ♻️', 'Nature dates > bar dates.'],
  expressive: ['I FEEL that 🙌', 'Say more, I love this energy', 'You get me.'],
  handy: ['I could build that, honestly', 'Fixed my bike this morning 🔧', 'Give me a project and I\'m happy.'],
  heroic: ['I\'d have your back, no question', 'Someone had to step up', 'Doing the right thing matters.'],
  intellectual: ['Have you read anything good lately?', 'That\'s a fascinating take', 'Let\'s debate this over coffee.'],
  intelligent: ['Sharp — I like how you think', 'Good point, I hadn\'t considered that', 'You keep me on my toes.'],
  leadership: ['I\'ll organize it, don\'t worry', 'Let\'s make a plan and commit', 'People count on me — I like that.'],
  motivational: ['You\'ve totally got this 💪', 'Small steps still count!', 'Let\'s be each other\'s hype crew.'],
  passionate: ['I go all-in on what I love ❤️‍🔥', 'Tell me what lights you up', 'Life\'s too short to be lukewarm.'],
  patient: ['No rush at all 🙂', 'Good things take time', 'I\'m happy to just talk.'],
  social: ['My friends would adore you', 'There\'s a thing Friday — come!', 'I know everyone, honestly 😅'],
  sophisticated: ['There\'s a wine bar I think you\'d like', 'Charmed, truly', 'Let\'s make it an occasion.'],
  stylish: ['Okay your vibe is immaculate ✨', 'We\'d take great photos', 'Fashion is self-expression, right?'],
  'tech-savvy': ['Automating my whole apartment lol 🤖', 'Have you tried the new build? It\'s slick', 'I\'ll debug your day, just say the word 😄'],
  thoughtful: ['I\'ve been thinking about what you said', 'Here\'s a little something I noticed about you', 'You matter to me already.'],
  zen: ['Breathe — it\'s all unfolding 🧘', 'I like slow mornings and honest talks', 'Peace over drama, always.'],
};

/** Resolve the reply pool for a personality, falling back to `friendly`. */
export function getNpcReplyPool(personality: string): string[] {
  return NPC_REPLY_POOL[personality] ?? NPC_REPLY_POOL.friendly;
}
