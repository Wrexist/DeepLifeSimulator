/**
 * Spark conversation CONTENT — tone map, affinity tables and reply pools.
 *
 * "Content is data": every line the choice-driven chat can put in the thread
 * lives here rather than inside an action, so the copy can be coverage-tested
 * against `DATING_PROFILES` the same way `lib/dating/npcReplyPool.ts` is.
 *
 * Why a TONE layer instead of one pool per personality: the catalog carries 27
 * concrete personality slugs, and the conversation has 7 options × 2 outcomes.
 * A per-personality table would be 378 pools, most of them near-duplicates, and
 * a new catalog personality would silently fall through. Instead every
 * personality maps to one of 10 conversational TONES, pools are keyed by tone,
 * and every pool carries a `default` entry — so an unmapped personality still
 * resolves a real, in-voice-enough line instead of an empty array.
 * `__tests__/dating/sparkConversation.test.ts` asserts the resolution is
 * non-empty for every catalog personality × option × outcome.
 *
 * NO EMOJI anywhere in this file: these strings are rendered as chat bubbles
 * and can be read back weeks later in a match preview.
 */

/** The conversational register a personality answers in. */
export type SparkTone =
  | 'bold'      // charges at things — active, adventurous, heroic
  | 'driven'    // goal-shaped — ambitious, dedicated, leadership, motivational
  | 'cerebral'  // wants the reasoning — analytical, curious, intellectual, tech-savvy
  | 'poetic'    // feeling-first — artistic, creative, passionate
  | 'warm'      // caretaking — caring, compassionate, thoughtful
  | 'playful'   // teasing — cheerful, expressive
  | 'grounded'  // practical — environmentalist, handy
  | 'calm'      // unhurried — patient, zen
  | 'social'    // crowd-shaped — social
  | 'refined';  // taste-shaped — sophisticated, stylish

export const DEFAULT_TONE: SparkTone = 'warm';

/**
 * Every personality string in `lib/dating/datingProfiles.ts`, mapped to a tone.
 *
 * A missing entry is not a crash — `resolveTone` falls back to DEFAULT_TONE —
 * but the test suite fails on it, because a new catalog personality quietly
 * inheriting "warm" is exactly the drift the npcReplyPool comment warns about.
 */
export const PERSONALITY_TONE: Record<string, SparkTone> = {
  active: 'bold',
  adventurous: 'bold',
  heroic: 'bold',
  ambitious: 'driven',
  dedicated: 'driven',
  leadership: 'driven',
  motivational: 'driven',
  analytical: 'cerebral',
  curious: 'cerebral',
  intellectual: 'cerebral',
  intelligent: 'cerebral',
  'tech-savvy': 'cerebral',
  artistic: 'poetic',
  creative: 'poetic',
  passionate: 'poetic',
  caring: 'warm',
  compassionate: 'warm',
  thoughtful: 'warm',
  cheerful: 'playful',
  expressive: 'playful',
  environmentalist: 'grounded',
  handy: 'grounded',
  patient: 'calm',
  zen: 'calm',
  social: 'social',
  sophisticated: 'refined',
  stylish: 'refined',
};

export function resolveTone(personality: string | undefined): SparkTone {
  if (!personality) return DEFAULT_TONE;
  return PERSONALITY_TONE[personality] ?? DEFAULT_TONE;
}

// ─────────────────────────────────────────────────────────────────────
// Affinity — how well each move lands on each tone
// ─────────────────────────────────────────────────────────────────────

/** Additive success-chance modifier, roughly -0.06 … +0.12. */
type ToneAffinity = Partial<Record<SparkTone, number>> & { default: number };

export const OPTION_TONE_AFFINITY: Record<string, ToneAffinity> = {
  // An opener is low-stakes for everyone; the crowd-shaped tones enjoy it most.
  break_ice: { default: 0.02, social: 0.08, playful: 0.06, calm: -0.02, cerebral: -0.02 },
  // Asking about what someone actually cares about is the safest move in the game.
  ask_interests: { default: 0.04, cerebral: 0.1, grounded: 0.06, poetic: 0.05, calm: 0.04 },
  // Compliments land on people who trade in warmth and presentation.
  compliment: { default: 0.02, warm: 0.08, refined: 0.07, playful: 0.05, cerebral: -0.04 },
  // Jokes are the highest-variance social move: great with playful, flat with driven.
  joke: { default: 0, playful: 0.12, social: 0.08, poetic: 0.04, calm: -0.02, refined: -0.04, driven: -0.05 },
  // Flirting rewards nerve and punishes the unhurried.
  flirt: { default: 0, bold: 0.1, playful: 0.08, poetic: 0.06, refined: 0.04, grounded: -0.03, cerebral: -0.05, calm: -0.06 },
  // A concrete plan beats vibes for the people who live by a calendar.
  ask_date: { default: 0.02, social: 0.08, bold: 0.06, driven: 0.04, calm: -0.03 },
  // Commitment is a warmth question, not a nerve question.
  go_steady: { default: 0.02, warm: 0.08, calm: 0.06, poetic: 0.05, bold: -0.02 },
};

/** Venue-specific affinity, layered on top of `ask_date`'s. Makes the sub-choice matter. */
export const VENUE_TONE_AFFINITY: Record<string, ToneAffinity> = {
  coffee: { default: 0.04, calm: 0.1, cerebral: 0.08, warm: 0.06, bold: -0.05, social: -0.03 },
  dinner: { default: 0.03, refined: 0.12, warm: 0.07, poetic: 0.05, grounded: -0.03, bold: -0.02 },
  adventure: { default: -0.02, bold: 0.14, playful: 0.08, grounded: 0.06, social: 0.04, refined: -0.07, calm: -0.06 },
};

export function toneAffinity(table: ToneAffinity | undefined, tone: SparkTone): number {
  if (!table) return 0;
  const v = table[tone];
  return typeof v === 'number' ? v : table.default;
}

// ─────────────────────────────────────────────────────────────────────
// Lines
// ─────────────────────────────────────────────────────────────────────

/**
 * Tokens available to every line:
 *   {first}     the match's first name
 *   {name}      their full name
 *   {interest}  one of their profile interests, lower-cased
 *   {venue}     the chosen date venue, as a noun phrase
 */
export function fillLine(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : whole,
  );
}

/** What the PLAYER says. Keyed by option id; `ask_date` is keyed by venue instead. */
export const PLAYER_LINES: Record<string, string[]> = {
  break_ice: [
    'Okay, opening line, no pressure: what is the best thing that happened to you this week?',
    'Hi {first}. I am told the first message is the hardest, so I am getting it out of the way.',
    'Two truths and a lie, {first}. You go first, I need to see how you play.',
    'I have decided we are skipping small talk entirely. What are you obsessed with right now?',
  ],
  ask_interests: [
    'So, {interest}. How did that start for you?',
    'Your profile says {interest} and I have questions. Mostly good ones.',
    'Talk to me about {interest} like I know nothing, because I know nothing.',
    'If I wanted to get into {interest}, where would you tell me to start?',
  ],
  compliment: [
    'For the record, you are much funnier than your profile lets on.',
    'You have a way of saying things that makes me want to keep reading.',
    'I have talked to a lot of people on here. You are the one I keep coming back to.',
    'Whatever you are doing with your life, it clearly suits you.',
  ],
  joke: [
    'I told my bank I wanted to invest in this conversation. They said the returns were emotional only.',
    'My hobby is starting hobbies. I am currently three weeks into becoming a person who owns a plant.',
    'I would make a joke about commitment, but I would never finish it.',
    'I put your name in my phone with a heart. Autocorrect made it a hyphen. We are working through it.',
  ],
  flirt: [
    'I should warn you that I have been rereading your messages. Twice. Maybe more.',
    'You are dangerously easy to talk to, {first}, and I do not think that is an accident.',
    'I keep drafting something clever and deleting it. You are doing that to me.',
    'If I said I was thinking about you, would that be too much this early?',
  ],
  go_steady: [
    'I want to stop pretending this is casual. Be with me, {first}. Properly.',
    'I am asking the unsubtle question: will you make this official?',
    'No games, no maybe. I want to be yours, and I want everyone to know it.',
    'I have thought about this more than I will admit. Let us make it real.',
  ],
};

/** What the player says when asking someone out, keyed by venue. */
export const VENUE_PLAYER_LINES: Record<string, string[]> = {
  coffee: [
    'There is a place near me that does the coffee properly. Saturday morning, you and me?',
    'Coffee. Low stakes, good light, one hour, and I get to hear you talk. Yes?',
    'Let me buy you a coffee, {first}. Worst case we get a good story out of it.',
  ],
  dinner: [
    'Dinner. A real one, with a tablecloth and everything. Say when and I will book it.',
    'I want a whole evening with you, {first}, not a coffee-length slice of one. Dinner?',
    'Let me take you somewhere that makes you dress up a little. Dinner this week?',
  ],
  adventure: [
    'Radical proposal: we skip the restaurant and go do something we will still be talking about in a year.',
    'I know a trail, a boat and a very questionable idea. Pick one and I will handle the rest.',
    'Dinner is fine, but I would rather see what you are like at altitude. Come with me?',
  ],
};

export const VENUE_LABELS: Record<string, string> = {
  coffee: 'coffee',
  dinner: 'dinner',
  adventure: 'something reckless',
};

type OutcomePools = Record<string, string[]>;

/**
 * What the NPC says back. `optionId -> outcome -> tone (or 'default')`.
 * Every option/outcome pair carries a `default`, so resolution can never be empty.
 */
export const NPC_LINES: Record<string, Record<'success' | 'miss', OutcomePools>> = {
  break_ice: {
    success: {
      default: [
        'Okay, that is a much better opener than the six I deleted.',
        'You went first. I respect that more than I should.',
        'Fine, you have my attention. Keep going.',
      ],
      bold: ['Straight in, no warm-up. I like that.', 'Good. I was about to unmatch out of boredom, and now I am not.'],
      cerebral: ['Interesting choice of opener. Deliberate, or lucky?', 'You skipped the weather. Already ahead of ninety percent of this app.'],
      playful: ['Oh, we are doing this properly. Buckle up.', 'You get one more good line before I start grading.'],
      calm: ['No rush from me, but yes, I am glad you said something.', 'That was gentle. I like gentle.'],
      social: ['I already screenshotted this for my group chat. They approve.', 'You are going to get along with my friends, I can tell.'],
      refined: ['Well phrased. That is rarer here than you would think.', 'A promising start. Continue.'],
    },
    miss: {
      default: [
        'Hm. I am not sure how to answer that one.',
        'That is a lot for a first message, but okay.',
        'Sorry, I got distracted. What were you saying?',
      ],
      cerebral: ['I read that three times and I still am not sure what you meant.', 'Was that a question? Genuinely asking.'],
      calm: ['I might need a minute with that one.', 'That landed a little sideways, but no harm done.'],
      refined: ['That is one way to open, certainly.', 'I will pretend I did not read that and you can try again.'],
    },
  },
  ask_interests: {
    success: {
      default: [
        'Nobody asks me about {interest}. I could talk about it for an hour, fair warning.',
        'Okay, you actually read my profile. That is a low bar and you cleared it beautifully.',
        '{interest} started as a distraction and became the whole personality. No regrets.',
      ],
      cerebral: ['Right, so the interesting part of {interest} is the part everyone skips. Let me explain.', 'Good question. I have a whole theory about {interest} and you are about to hear it.'],
      poetic: ['{interest} is the closest thing I have to a religion, honestly.', 'It is the one place my brain goes quiet. That is why I keep going back.'],
      grounded: ['I got into {interest} because something broke and nobody was coming to fix it.', 'It is practical, it is mine, and it keeps my hands busy. That is the whole story.'],
      calm: ['{interest} is how I slow the week down. I would show you sometime.', 'It is less a hobby and more a way of breathing, if that is not too much.'],
      driven: ['I am competitive about {interest}, which my friends find exhausting.', 'I want to be genuinely good at it, not just fond of it. There is a difference.'],
    },
    miss: {
      default: [
        'Honestly I put {interest} on there to fill space. I am not that deep into it.',
        'That is a whole conversation and I am half asleep. Ask me again another time.',
        'Ha, you found the one thing on my profile I cannot defend.',
      ],
      playful: ['Wow, straight to the interview questions.', 'Do I get to see your CV after this?'],
      refined: ['That is a rather direct way to ask. Charming, in a blunt sort of way.'],
    },
  },
  compliment: {
    success: {
      default: [
        'That is going in the mental scrapbook, thank you.',
        'You cannot just say things like that and expect me to be normal about it.',
        'Okay, that got me. Genuinely.',
      ],
      warm: ['That was kind, and I needed kind today. Thank you.', 'You have no idea how much I needed to hear that this week.'],
      refined: ['Well said. You have taste, which is the real compliment here.', 'I will accept that graciously and think about it all evening.'],
      playful: ['Careful, I will start believing you.', 'Say it again, I was not recording.'],
      driven: ['I do not get told that often. I usually just get told to keep going.', 'That means more than the professional version of the same sentence.'],
      poetic: ['You said that like you meant it, and it landed somewhere soft.', 'People are careless with words. You were not.'],
      bold: ['Good. Now say something braver.', 'I like that you just said it instead of hinting at it.'],
    },
    miss: {
      default: [
        'That is very smooth. Do you use that one a lot?',
        'Thanks, I think.',
        'Mm. That felt a bit rehearsed, if I am honest.',
      ],
      cerebral: ['That is a compliment about a thing you cannot possibly know yet.', 'Flattering, but you are describing a version of me you invented.'],
      calm: ['That is sweet, but you do not have to try so hard.'],
      grounded: ['I would rather you said something true than something nice.'],
    },
  },
  joke: {
    success: {
      default: [
        'I laughed out loud and now the person next to me is looking at me. Thanks.',
        'That is stupid and I loved it.',
        'Okay that was genuinely good. Do you have more or was that the one?',
      ],
      playful: ['Absolutely unhinged. We are going to get on famously.', 'I am stealing that and I will not credit you.'],
      social: ['I am reading that out at dinner on Friday. You are coming, obviously.', 'My friends are going to love you and it is annoying.'],
      poetic: ['There is something lovely about a person who is willing to be silly first.', 'You made me laugh in a week where that was hard. Noted.'],
      cerebral: ['The setup was longer than it needed to be and I still laughed. Impressive.'],
      bold: ['Ha. Okay, you are not boring. That was the main risk.'],
    },
    miss: {
      default: [
        'I think I missed the joke there.',
        'Ha. Ha. Okay.',
        'Was that the punchline, or is there more coming?',
      ],
      driven: ['I have about four minutes between meetings and I spent one on that.'],
      refined: ['I will smile politely and we can both move on.'],
      calm: ['That one went past me. Try me again when I have had coffee.'],
    },
  },
  flirt: {
    success: {
      default: [
        'Oh, so we are being like that now. Good.',
        'You are going to make this very hard to be casual about.',
        'I reread that twice. Do with that what you will.',
      ],
      bold: ['Finally. I was starting to think you would never say it.', 'Say the next one out loud, to my face. Sooner rather than later.'],
      playful: ['Bold. I am into it. Your move again, by the way.', 'Careful, I flirt back and I do not stop.'],
      poetic: ['You have a way of putting things that stays with me longer than it should.', 'That was the good kind of dangerous.'],
      refined: ['Smoothly done. I am not easily impressed and I am a little impressed.'],
      warm: ['That made my whole chest warm. I am not used to that.'],
    },
    miss: {
      default: [
        'That is a bit fast for me, sorry.',
        'Ooh. Bold. Slightly too bold.',
        'Let us get to know each other a little more first, yeah?',
      ],
      calm: ['I move slower than that. Not a no, just a not yet.', 'There is no rush. Please do not rush.'],
      cerebral: ['We have exchanged maybe six messages. Statistically that is optimistic.'],
      grounded: ['I would rather build to that than jump to it.'],
      warm: ['That is sweet but it is a lot at once. Be patient with me.'],
    },
  },
  ask_date: {
    success: {
      default: [
        'Yes. Obviously yes. I was starting to think you would never ask.',
        '{venue} it is. I am already deciding what to wear.',
        'Say a day and I will move things around. That is not something I do.',
      ],
      bold: ['Yes, and I am going to make you regret suggesting something tame.', 'Finally, a plan. Pick me up, do not text me from outside.'],
      social: ['Yes. And if it goes badly I have four friends on standby for the debrief.', 'Yes, obviously. I have already told two people.'],
      refined: ['{venue}. Yes. I will hold you to a decent choice of place.', 'How lovely. Yes, I would like that very much.'],
      calm: ['Yes. Let us keep it unhurried, though. I like unhurried.'],
      warm: ['Yes. I have been hoping you would ask for about a week.'],
      driven: ['Yes. Send me a time and I will put it in the calendar, in ink.'],
    },
    miss: {
      default: [
        'Ah, I have got a thing that day. Rain check?',
        'That is sweet, but I am not quite there yet.',
        '{venue} is a bit much for where we are, I think.',
      ],
      calm: ['Not this week. I am not saying never, I am saying not yet.'],
      cerebral: ['I need a bit more evidence before I commit an evening, sorry.'],
      refined: ['I am flattered, but I am rather particular about first dates.'],
      grounded: ['I am wiped this week. Ask me again when I am human.'],
    },
  },
  go_steady: {
    success: {
      default: [
        'Yes. Yes, obviously. I have been waiting for you to catch up.',
        'Official. I like the sound of that far more than I expected to.',
        'Then that is settled. You are mine and I am telling people.',
      ],
      warm: ['Yes. I want the whole ordinary version of this with you.', 'You have no idea how safe that question made me feel. Yes.'],
      calm: ['Yes. Quietly, properly, no fuss. Just us.'],
      poetic: ['You asked it plainly and it undid me a bit. Yes.'],
      social: ['Yes, and I am changing my status before you can take it back.'],
      driven: ['Yes. I do not do things halfway and neither should we.'],
    },
    miss: {
      default: [
        'I like you a lot. I am just not ready to call it that.',
        'Can we stay in this bit a little longer? It is nice here.',
        'Not yet. Ask me again when we have more behind us.',
      ],
      calm: ['Slower. Please. I get there, I just do not sprint.'],
      cerebral: ['That is a big label for how much we actually know each other.'],
      bold: ['I want to want that. I am not there today.'],
    },
  },
};

/**
 * Resolve one line pool. Falls back tone -> default -> a hard-coded safety line
 * so no caller can ever receive an empty string.
 */
export function resolveNpcPool(
  optionId: string,
  outcome: 'success' | 'miss',
  tone: SparkTone,
): string[] {
  const byOutcome = NPC_LINES[optionId]?.[outcome];
  if (!byOutcome) return outcome === 'success' ? ['Yes, definitely.'] : ['Hm, maybe another time.'];
  const pool = byOutcome[tone];
  if (Array.isArray(pool) && pool.length > 0) return pool;
  const fallback = byOutcome.default;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return outcome === 'success' ? ['Yes, definitely.'] : ['Hm, maybe another time.'];
}

/** Resolve the player-line pool for an option (venue-aware for `ask_date`). */
export function resolvePlayerPool(optionId: string, venueId?: string): string[] {
  if (optionId === 'ask_date') {
    const pool = venueId ? VENUE_PLAYER_LINES[venueId] : undefined;
    if (Array.isArray(pool) && pool.length > 0) return pool;
    return VENUE_PLAYER_LINES.coffee;
  }
  const pool = PLAYER_LINES[optionId];
  return Array.isArray(pool) && pool.length > 0 ? pool : ['So, tell me about you.'];
}

/** Index into a pool with a 0..1 roll. Shared so tests can predict the pick. */
export function pickFrom(pool: string[], roll: number): string {
  const list = pool.length > 0 ? pool : [''];
  const r = typeof roll === 'number' && isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
  return list[Math.floor(r * list.length)] ?? list[0];
}
