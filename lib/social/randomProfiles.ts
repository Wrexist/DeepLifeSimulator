/**
 * Random Profile Generator
 * 
 * Generates random profiles that aren't in relationships with the player
 * for social media posts to populate the "For You" feed
 */

import { SocialPost } from '@/contexts/game/types';

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
  "Just discovered this amazing new coffee shop! ☕",
  "Weekend vibes are hitting different ✨",
  "Working on something exciting, stay tuned! 👀",
  "Life update: Things are looking up! 📈",
  "Can't believe it's already Friday! 🎉",
  "New favorite song on repeat 🎵",
  "Beautiful weather today! ☀️",
  "Just finished a great book! Any recommendations? 📚",
  "Coffee and productivity ☕💻",
  "Weekend plans? Let me know! 💬",
  "Trying something new today! 🌟",
  "Grateful for the little things 🙏",
  "Morning workout done! 💪",
  "New restaurant opened nearby, can't wait to try it! 🍽️",
  "Life's good! 😊",
  "Making the most of today! ✨",
  "Another day, another opportunity! 🌅",
  "Living my best life! 💫",
  "Good vibes only! 🌟",
  "Friday mood! 🎊",
  "Weekend adventures await! 🗺️",
  "Coffee shop vibes ☕📖",
  "Nature walk was exactly what I needed 🌳",
  "Working on some personal projects 🎯",
  "Beautiful sunset today 🌅",
  "New hobby discovered! 🎨",
  "Weekend plans sorted! 🎉",
  "Life update: All good! ✨",
  "Morning motivation! 💪",
  "Evening relaxation 🧘",
];

// Counter to ensure unique IDs
let randomPostCounter = 0;

/**
 * Generate a random profile post with realistic engagement
 */
export function generateRandomProfilePost(week: number, index?: number): SocialPost {
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
    timestamp: Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
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
    likedBy: [],
    repostedBy: [],
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
  const usedIds = new Set<string>();
  const usedNames = new Set<string>(); // Ensure variety in profile names
  
  for (let i = 0; i < postCount; i++) {
    let attempts = 0;
    let post: SocialPost;
    
    // Try to get a unique post (different name and ID)
    do {
      post = generateRandomProfilePost(week, i + attempts * 1000);
      attempts++;
      
      // Allow same name but different post content
      if (attempts > 10) break; // Safety break
    } while (usedIds.has(post.id));
    
    // Ensure no duplicate IDs
    if (!usedIds.has(post.id)) {
      usedIds.add(post.id);
      usedNames.add(post.authorName);
      posts.push(post);
    }
  }
  
  return posts;
}

