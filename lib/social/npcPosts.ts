/**
 * NPC Post Generator
 * 
 * Generates social media posts from relationships and dating profiles
 * to create a dynamic, living social media feed
 */

import { Relationship } from '@/contexts/game/types';
import { SocialPost } from '@/contexts/game/types';

// Post templates by personality type
const POST_TEMPLATES: Record<string, string[]> = {
  friendly: [
    "Had such a great time today! 😊",
    "Life is beautiful when you're surrounded by good people 💕",
    "Coffee and good vibes ☕✨",
    "Grateful for another amazing day! 🙏",
    "Spreading positivity wherever I go! ✨",
    "Good vibes only! 🌟",
  ],
  ambitious: [
    "Working hard towards my goals! 💪",
    "Success doesn't come to you, you go to it! 🚀",
    "Another productive day in the books 📚",
    "Dreams don't work unless you do! ⚡",
    "Grinding every single day! 💼",
    "Building my empire, one step at a time 🏗️",
  ],
  creative: [
    "Just finished a new project! So excited to share it 🎨",
    "Inspiration struck today ✨",
    "Art is everywhere if you look for it 🖼️",
    "Creating something new always brings joy 🎭",
    "New idea brewing! Can't wait to bring it to life 💡",
    "Artistic flow is everything 🎨",
  ],
  adventurous: [
    "New adventure awaits! 🌍",
    "Life's too short to stay in one place ✈️",
    "Just discovered an amazing new spot! 📍",
    "The best stories come from adventures 🗺️",
    "Wanderlust is real! 🌎",
    "Exploring new horizons! 🏔️",
  ],
  romantic: [
    "Love is in the air 💕",
    "Spending time with someone special today ❤️",
    "Life is better when shared with the right person 💑",
    "Grateful for love in my life 💖",
    "Heart is full today 💗",
    "Love makes everything better 💝",
  ],
  professional: [
    "Big announcement coming soon! 👔",
    "Networking event was a success! 🤝",
    "Excited about new opportunities ahead 📈",
    "Building something meaningful 🏢",
    "Career milestones achieved! 🎯",
    "Professional growth never stops! 📊",
  ],
  introverted: [
    "Quiet day, perfect for reflection 📖",
    "Sometimes the best company is yourself 🧘",
    "Cozy vibes at home 🏠",
    "Peace and quiet is underrated ✨",
    "Reading and relaxing today 📚",
  ],
  extroverted: [
    "Party was amazing! 🎉",
    "Love meeting new people! 👥",
    "Social energy is through the roof! 🔥",
    "Best night out in a while! 🌃",
    "Surrounded by amazing friends! 👯",
  ],
};

// Dating profile post templates
const DATING_POST_TEMPLATES = [
  "Looking forward to the weekend! 🎉",
  "New restaurant opened nearby, can't wait to try it! 🍽️",
  "Weekend vibes are hitting different ✨",
  "Life update: Things are looking up! 📈",
  "Coffee shop vibes ☕📖",
  "Just finished a great book! Any recommendations? 📚",
  "Nature walk was exactly what I needed 🌳",
  "Working on some personal projects 🎯",
  "Friday mood! 🎊",
  "Trying something new today! 🌟",
  "Beautiful weather calls for outdoor activities! ☀️",
  "Weekend plans? Let me know! 💬",
];

// Generic fallback templates
const GENERIC_TEMPLATES = [
  "Another day, another opportunity! 🌅",
  "Life's good! 😊",
  "Making the most of today! ✨",
  "Grateful for everything! 🙏",
  "Living my best life! 💫",
];

/**
 * Generate a post from a relationship
 */
// Counter to ensure unique IDs for NPC posts
let npcPostCounter = 0;

export function generateNPCPost(
  relationship: Relationship,
  week: number
): SocialPost {
  const personality = relationship.personality?.toLowerCase() || 'friendly';
  const templates = POST_TEMPLATES[personality] || 
                   POST_TEMPLATES.friendly || 
                   GENERIC_TEMPLATES;
  const content = templates[Math.floor(Math.random() * templates.length)];
  
  // Calculate engagement based on relationship score and type
  const baseEngagement = relationship.relationshipScore > 50 ? 20 : 10;
  const engagementMultiplier = relationship.type === 'partner' || relationship.type === 'spouse' ? 1.5 : 1;
  
  // Ensure unique ID
  npcPostCounter++;
  const uniqueId = `npc-post-${relationship.id}-${week}-${Date.now()}-${npcPostCounter}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: uniqueId,
    authorId: relationship.id,
    authorName: relationship.name,
    authorHandle: `@${relationship.name.toLowerCase().replace(/\s+/g, '')}`,
    authorPhoto: relationship.profilePicture,
    authorVerified: relationship.type === 'spouse' || relationship.relationshipScore > 80,
    content,
    timestamp: Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
    gameWeek: week,
    likes: Math.floor(Math.random() * baseEngagement * engagementMultiplier) + 1,
    reposts: Math.floor(Math.random() * (baseEngagement * 0.2)) + 1,
    replies: Math.floor(Math.random() * (baseEngagement * 0.1)),
    bookmarks: Math.floor(Math.random() * 3),
    views: Math.floor(Math.random() * (baseEngagement * 10)) + 50,
    isLiked: false,
    isReposted: false,
    isBookmarked: false,
    isPlayerPost: false,
    contentType: Math.random() > 0.7 ? 'photo' : 'text',
    // likedBy and repostedBy removed - use likes/reposts counts instead
  };
}

/**
 * Generate a post from a dating profile
 */
// Counter for dating profile posts
let datingPostCounter = 0;

export function generateDatingProfilePost(
  profile: { name: string; id: string; bio?: string; interests?: string[] },
  week: number
): SocialPost {
  const content = DATING_POST_TEMPLATES[Math.floor(Math.random() * DATING_POST_TEMPLATES.length)];
  
  // Dating profiles get slightly higher engagement
  const baseEngagement = 30;
  
  // Ensure unique ID
  datingPostCounter++;
  const uniqueId = `dating-post-${profile.id}-${week}-${Date.now()}-${datingPostCounter}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: uniqueId,
    authorId: profile.id,
    authorName: profile.name,
    authorHandle: `@${profile.name.toLowerCase().replace(/\s+/g, '')}`,
    authorVerified: false,
    content,
    timestamp: Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000),
    gameWeek: week,
    likes: Math.floor(Math.random() * baseEngagement) + 10,
    reposts: Math.floor(Math.random() * (baseEngagement * 0.3)) + 1,
    replies: Math.floor(Math.random() * (baseEngagement * 0.2)) + 1,
    bookmarks: Math.floor(Math.random() * 5),
    views: Math.floor(Math.random() * (baseEngagement * 15)) + 100,
    isLiked: false,
    isReposted: false,
    isBookmarked: false,
    isPlayerPost: false,
    contentType: Math.random() > 0.6 ? 'photo' : 'text',
    // likedBy and repostedBy removed - use likes/reposts counts instead
  };
}

/**
 * Generate weekly posts from all NPCs
 */
export function generateWeeklyNPCPosts(
  relationships: Relationship[],
  datingProfiles: Array<{ name: string; id: string; bio?: string; interests?: string[] }>,
  week: number,
  includeRandom: boolean = true
): SocialPost[] {
  const posts: SocialPost[] = [];
  
  // Generate posts from relationships (80% chance per person to ensure more posts)
  relationships.forEach(rel => {
    if (Math.random() > 0.2) { // 80% chance
      posts.push(generateNPCPost(rel, week));
    }
  });
  
  // Generate posts from dating profiles (50% chance per profile to ensure more posts)
  datingProfiles.forEach(profile => {
    if (Math.random() > 0.5) { // 50% chance
      posts.push(generateDatingProfilePost(profile, week));
    }
  });
  
  // Ensure at least some posts are generated if we have profiles
  // If no posts were generated but we have profiles, force generate at least 2-4 posts
  if (posts.length === 0 && (relationships.length > 0 || datingProfiles.length > 0)) {
    const allSources: Array<{ type: 'relationship' | 'dating'; data: any }> = [
      ...relationships.map(r => ({ type: 'relationship' as const, data: r })),
      ...datingProfiles.map(p => ({ type: 'dating' as const, data: p })),
    ];
    
    // Generate 2-4 random posts
    const numPosts = Math.min(4, Math.max(2, Math.floor(allSources.length * 0.3)));
    for (let i = 0; i < numPosts && allSources.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * allSources.length);
      const source = allSources[randomIndex];
      
      if (source.type === 'relationship') {
        posts.push(generateNPCPost(source.data, week));
      } else {
        posts.push(generateDatingProfilePost(source.data, week));
      }
    }
  }
  
  // Add random profile posts (from profiles with no relationship to player)
  if (includeRandom) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { generateRandomProfilePosts } = require('@/lib/social/randomProfiles');
      // Generate 3-7 random posts from unknown profiles (default behavior)
      const randomPosts = generateRandomProfilePosts(week);
      if (randomPosts && randomPosts.length > 0) {
        posts.push(...randomPosts);
        if (__DEV__) {
          console.log(`[NPC Posts] Generated ${randomPosts.length} random profile posts for week ${week}`);
        }
      } else {
        if (__DEV__) {
          console.warn(`[NPC Posts] No random posts generated for week ${week}`);
        }
      }
    } catch (error) {
      // Log error but don't fail completely
      if (__DEV__) {
        console.warn('Error generating random profile posts:', error);
      }
    }
  }
  
  return posts;
}

/**
 * Get all available dating profiles for social media posts
 * This includes profiles from the dating app that match the player's preferences
 */
export function getAvailableDatingProfiles(
  playerGender?: 'male' | 'female',
  playerSeekingGender?: 'male' | 'female'
): Array<{ name: string; id: string; bio?: string; interests?: string[] }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DATING_PROFILES } = require('@/lib/dating/datingProfiles');
    
    if (!playerGender || !playerSeekingGender) {
      return DATING_PROFILES.map((p: any) => ({
        name: p.name,
        id: p.id,
        bio: p.bio,
        interests: p.interests,
      }));
    }
    
    // Filter profiles that match player's preferences
    return DATING_PROFILES
      .filter((profile: any) => 
        profile.gender === playerSeekingGender && 
        profile.seekingGender === playerGender
      )
      .map((p: any) => ({
        name: p.name,
        id: p.id,
        bio: p.bio,
        interests: p.interests,
      }));
  } catch (error) {
    // Fallback if dating profiles file doesn't exist
    return [];
  }
}

