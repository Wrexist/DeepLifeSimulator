/**
 * Random Profile Generator
 * 
 * Generates random profiles that aren't in relationships with the player
 * for social media posts to populate the "For You" feed
 */

import { SocialPost } from '@/contexts/game/types';
import { MS_PER_WEEK } from '@/lib/config/gameConstants';

// ─────────────────────────────────────────────────────────────────────
// Pulse scandal pile-on comments (v13+)
// ─────────────────────────────────────────────────────────────────────

import type { PulseComment, PulseActiveScandal } from '@/contexts/game/types';

// Random profile names for posts
const RANDOM_PROFILE_NAMES = [
 'Alex Morgan', 'Jordan Taylor', 'Casey Smith', 'Riley Johnson', 'Morgan Davis',
 'Taylor Brown', 'Avery Wilson', 'Quinn Martinez', 'Sage Anderson', 'River Thompson',
 'Phoenix Lee', 'Blake Garcia', 'Cameron White', 'Dakota Harris', 'Emery Clark',
 'Finley Lewis', 'Harper Walker', 'Indigo Hall', 'Jules Young', 'Kai King',
 'Lane Wright', 'Marlowe Lopez', 'Noah Hill', 'Ocean Green', 'Parker Adams',
 'Reese Nelson', 'Skylar Baker', 'Tatum Perez', 'Valor Roberts', 'Wren Turner',
];

// Random profile handles
const RANDOM_HANDLES = [
 'alexmorgan', 'jordant', 'caseysmith', 'rileyj', 'morgand',
 'taylorb', 'averyw', 'quinnm', 'sagea', 'rivert',
 'phoenixl', 'blakeg', 'cameronw', 'dakotah', 'emeryc',
 'finleyl', 'harperw', 'indigoh', 'julesy', 'kaik',
 'lanew', 'marlowel', 'noahh', 'oceang', 'parkera',
 'reesen', 'skylarb', 'tatumpe', 'valorr', 'wrent',
];

// Random post templates for unknown profiles
const RANDOM_POST_TEMPLATES = [
  "The self-checkout and I have agreed to disagree about the bagging area.",
  "Library books are the only subscription I have never regretted.",
  "My budget has a category called unexpected. It is suspiciously consistent.",
  "Bought the ingredients for a complicated dinner. Having toast while I think about it.",
  "Trying the one-song cleaning method. The song may need to be an album.",
  "Public benches with a good view deserve reviews.",
  "The little repair shop on the corner fixed it in ten minutes. I had been putting it off for months.",
  "Would like a weekend that arrives with no suggested activities.",
  "Someone let me merge without a battle today. Restored a small amount of faith.",
  "Saved the last episode for the weekend. Now avoiding everybody who has seen it.",
  "There is a particular kind of peace in an empty laundry basket.",
  "The best recipe is the one with notes written in the margin.",
  "I want fewer apps asking how I feel and more buses arriving when they say they will.",
  "Trying to learn one useful thing instead of reading about twelve.",
  "A meal made from what was already in the fridge. Unexpectedly proud of this.",
  "Found an old shopping list in a coat pocket. Apparently past me also needed onions.",
  "If we make plans, please include whether there will be food.",
  "The plant has a new leaf. Taking a completely unreasonable amount of credit.",
  "Putting the phone in another room works annoyingly well.",
  "The cheapest seat at the local show is still a night out.",
  "Walking home without headphones. Had forgotten the city has its own soundtrack.",
  "Anyone else keep a box because it is a really good box?",
  "Finally asked how to pronounce a name I have been avoiding saying for months.",
  "A calendar with an empty square in it. Beautiful.",
  "Trying not to turn every hobby into homework.",
  "A useful purchase: socks that all match each other.",
  "The shortcut takes longer if you stop to look at every dog.",
  "My most ambitious plan for tonight involves clean sheets.",
  "I trust restaurant recommendations that mention one specific dish.",
  "Packed lunch is a gift from yesterday me. Occasionally yesterday me is thoughtful."
];

// Counter to ensure unique IDs
let randomPostCounter = 0;

/**
 * Generate a random profile post with realistic engagement
 */
export function generateRandomProfilePost(week: number, _index?: number): SocialPost {
 const nameIndex = Math.floor(Math.random() * RANDOM_PROFILE_NAMES.length);
 const name = RANDOM_PROFILE_NAMES[nameIndex];
 const handle = RANDOM_HANDLES[nameIndex] || name.toLowerCase().replace(/\s+/g, '');
 const content = RANDOM_POST_TEMPLATES[Math.floor(Math.random() * RANDOM_POST_TEMPLATES.length)];
 
 // Realistic engagement tiers based on profile "popularity"
 // Most profiles have low-medium engagement, some have high engagement
 const popularityRoll = Math.random();
 let baseLikes: number;
 let baseReposts: number;
 let baseReplies: number;
 let baseViews: number;
 let isVerified: boolean;
 
 if (popularityRoll < 0.6) {
 // 60% - Regular users: 5-50 likes, 0-5 reposts, 0-3 replies
 baseLikes = Math.floor(Math.random() * 45) + 5;
 baseReposts = Math.floor(Math.random() * 5);
 baseReplies = Math.floor(Math.random() * 3);
 baseViews = Math.floor(Math.random() * 200) + 50;
 isVerified = false;
 } else if (popularityRoll < 0.85) {
 // 25% - Popular users: 50-200 likes, 5-20 reposts, 3-15 replies
 baseLikes = Math.floor(Math.random() * 150) + 50;
 baseReposts = Math.floor(Math.random() * 15) + 5;
 baseReplies = Math.floor(Math.random() * 12) + 3;
 baseViews = Math.floor(Math.random() * 1000) + 200;
 isVerified = Math.random() > 0.7; // 30% chance
 } else if (popularityRoll < 0.95) {
 // 10% - Influencers: 200-1000 likes, 20-100 reposts, 15-50 replies
 baseLikes = Math.floor(Math.random() * 800) + 200;
 baseReposts = Math.floor(Math.random() * 80) + 20;
 baseReplies = Math.floor(Math.random() * 35) + 15;
 baseViews = Math.floor(Math.random() * 5000) + 1000;
 isVerified = Math.random() > 0.3; // 70% chance
 } else {
 // 5% - Celebrities: 1000-5000 likes, 100-500 reposts, 50-200 replies
 baseLikes = Math.floor(Math.random() * 4000) + 1000;
 baseReposts = Math.floor(Math.random() * 400) + 100;
 baseReplies = Math.floor(Math.random() * 150) + 50;
 baseViews = Math.floor(Math.random() * 20000) + 5000;
 isVerified = true; // Always verified
 }
 
 // Ensure unique ID by using counter and random component
 randomPostCounter++;
 const uniqueId = `random-post-${handle}-${week}-${Date.now()}-${randomPostCounter}-${Math.random().toString(36).substr(2, 9)}`;
 
 return {
 id: uniqueId,
 authorId: `random-${handle}-${randomPostCounter}`,
 authorName: name,
 authorHandle: `@${handle}`,
 authorPhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`,
 authorVerified: isVerified,
 content,
 timestamp: Date.now() - (Math.random() * MS_PER_WEEK), // Random time in last week
 gameWeek: week,
 likes: baseLikes,
 reposts: baseReposts,
 replies: baseReplies,
 bookmarks: Math.floor(Math.random() * Math.min(50, baseLikes * 0.1)) + 1,
 views: baseViews,
 isLiked: false,
 isReposted: false,
 isBookmarked: false,
 isPlayerPost: false,
 contentType: Math.random() > 0.7 ? 'photo' : 'text',
 // likedBy and repostedBy removed - use likes/reposts counts instead
 };
}

/**
 * Generate random profile posts for the "For You" feed
 * These are from profiles that have no relationship with the player
 * Generates 3-7 posts per week with varied engagement levels
 */
export function generateRandomProfilePosts(week: number, count?: number): SocialPost[] {
 // Default to 3-7 posts per week if count not specified
 const postCount = count || Math.floor(Math.random() * 5) + 3; // 3-7 posts
 const posts: SocialPost[] = [];
 // Draw copy without replacement. Distinct IDs alone do not prevent repeated text.
 const availableCopy = [...RANDOM_POST_TEMPLATES];
 for (let i = 0; i < postCount && availableCopy.length > 0; i++) {
   const post = generateRandomProfilePost(week, i);
   const index = (Math.abs(Math.floor(week)) + i * 7) % availableCopy.length;
   post.content = availableCopy.splice(index, 1)[0];
   posts.push(post);
 }

 return posts;
}

// Hostile comment templates by scandal type. Keep these PG — the game's
// audience skews mainstream and we want the *consequence* of a scandal to
// feel weighty, not the language.
const HATER_TEMPLATES_BY_TYPE: Record<string, string[]> = {
  leaked_dm: [
    'sooo we just gonna ignore those DMs?',
    'screenshots are forever, friend.',
    'this is why I never trusted you.',
  ],
  bad_take: [
    'absolutely tone-deaf.',
    'log off, please.',
    'embarrassing on main.',
  ],
  cancel: [
    'cancelled. fully cancelled.',
    'goodbye to the brand deals lol',
    'finally someone said it.',
  ],
  deepfake: [
    'real or fake doesn\'t matter when this many people saw it',
    'PR firms can\'t scrub the internet anymore',
    'the silence is deafening',
  ],
  public_meltdown: [
    'touch some grass',
    'this is performance art at this point',
    'praying for a 28-day break for you',
  ],
  brand_betrayal: [
    'guess loyalty is for sale',
    'thought you stood for more than this',
    'sponsored content has eaten you alive',
  ],
};

const GENERIC_HATER_TEMPLATES = [
  'unfollowed.',
  'this you?',
  'reading the room would be cool sometime',
  'L take. enormous L.',
  'careful, the masks are slipping',
];

/**
 * Generate hostile pile-on comments during an active scandal.
 *
 * Used by the Pulse tick to seed `commentThreads[postId]` with hater comments
 * on the player's most-recent posts, scaled by scandal severity. Comments are
 * tagged `sentiment: 'hostile'` and `isFromHater: true` so the UI can style
 * them distinctly and the player can see the cascade in real time.
 */
export function generateScandalPileOnComments(
  scandal: PulseActiveScandal,
  postId: string,
  weeksLived: number,
  count: number = 3,
): PulseComment[] {
  const templates =
    HATER_TEMPLATES_BY_TYPE[scandal.type] ?? GENERIC_HATER_TEMPLATES;
  const out: PulseComment[] = [];

  for (let i = 0; i < count; i++) {
    // Deterministic per-scandal pick so re-renders / reloads produce the same
    // comments. IDs are derived from (scandal, post, week, index) rather than a
    // mutable module counter, and the timestamp is the game week rather than
    // wall-clock Date.now(), so the seeded pulse tick stays byte-identical.
    const seed = `${scandal.id}|${postId}|${i}|${weeksLived}`;
    let h = 0;
    for (let j = 0; j < seed.length; j++) {
      h = ((h << 5) - h + seed.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(h) % templates.length;
    const nameIdx = Math.abs(h >> 8) % RANDOM_PROFILE_NAMES.length;
    const handleIdx = Math.abs(h >> 16) % RANDOM_HANDLES.length;

    out.push({
      id: `pulse-hater-${scandal.id}-${postId}-${weeksLived}-${i}`,
      postId,
      authorId: `hater-${RANDOM_HANDLES[handleIdx]}-${weeksLived}-${i}`,
      authorHandle: `@${RANDOM_HANDLES[handleIdx]}`,
      content: templates[idx],
      likes: Math.max(0, Math.floor(scandal.severity / 10) + (Math.abs(h >> 24) % 20)),
      timestamp: weeksLived,
      gameWeek: weeksLived,
      isPlayerComment: false,
      sentiment: 'hostile',
      isFromHater: true,
    });
    // authorName is on SocialPost but not on PulseComment - handle/initials suffice for the UI.
    void RANDOM_PROFILE_NAMES[nameIdx];
  }

  return out;
}
