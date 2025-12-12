import type { GameState } from '@/contexts/GameContext';

export type InfluenceLevel = 'novice' | 'rising' | 'popular' | 'influencer' | 'celebrity';
export type ContentType = 'text' | 'photo' | 'video' | 'story' | 'live';

export interface SocialMediaData {
  followers: number;
  influenceLevel: InfluenceLevel;
  totalPosts: number;
  viralPosts: number;
  brandPartnerships: number;
  engagementRate: number; // Percentage (0-100)
  lastPostWeek?: number;
}

/**
 * Calculate influence level based on follower count
 */
export function getInfluenceLevel(followers: number): InfluenceLevel {
  if (followers >= 1_000_000) return 'celebrity';
  if (followers >= 100_000) return 'influencer';
  if (followers >= 10_000) return 'popular';
  if (followers >= 1_000) return 'rising';
  return 'novice';
}

/**
 * Calculate engagement rate based on recent activity
 * Higher rate = more active posting
 */
export function calculateEngagementRate(
  totalPosts: number,
  weeksSinceLastPost: number
): number {
  if (totalPosts === 0) return 0;
  
  // Base engagement: 10% for active posting
  let rate = 10;
  
  // Bonus for frequent posting (posts per week)
  const postsPerWeek = totalPosts / Math.max(1, weeksSinceLastPost || 1);
  if (postsPerWeek >= 1) rate += 5; // Active poster
  if (postsPerWeek >= 2) rate += 5; // Very active
  
  // Penalty for inactivity
  if (weeksSinceLastPost > 4) rate -= 5;
  if (weeksSinceLastPost > 8) rate -= 5;
  
  return Math.max(0, Math.min(100, rate));
}

/**
 * Generate realistic post engagement based on follower count
 * Uses real-world engagement rate patterns:
 * - Small accounts (< 1K): 8-12% engagement rate
 * - Rising (1K-10K): 4-8% engagement rate  
 * - Popular (10K-100K): 2-4% engagement rate
 * - Influencer (100K-1M): 1-2% engagement rate
 * - Celebrity (1M+): 0.5-1.5% engagement rate
 */
export interface PostEngagement {
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  bookmarks: number;
}

export function calculatePostEngagement(
  followers: number,
  contentType: ContentType,
  isViral: boolean = false
): PostEngagement {
  // Base engagement rate decreases as followers increase (realistic pattern)
  let baseEngagementRate: number;
  if (followers < 100) {
    baseEngagementRate = 0.15 + Math.random() * 0.10; // 15-25% for tiny accounts
  } else if (followers < 1_000) {
    baseEngagementRate = 0.08 + Math.random() * 0.07; // 8-15% for small accounts
  } else if (followers < 10_000) {
    baseEngagementRate = 0.04 + Math.random() * 0.04; // 4-8% for rising
  } else if (followers < 100_000) {
    baseEngagementRate = 0.02 + Math.random() * 0.02; // 2-4% for popular
  } else if (followers < 1_000_000) {
    baseEngagementRate = 0.01 + Math.random() * 0.01; // 1-2% for influencer
  } else {
    baseEngagementRate = 0.005 + Math.random() * 0.01; // 0.5-1.5% for celebrity
  }
  
  // Content type multipliers (photos/videos get more engagement)
  const contentMultipliers: Record<ContentType, number> = {
    text: 0.7,
    photo: 1.3,
    video: 1.8,
    story: 1.0,
    live: 1.6,
  };
  
  const contentMultiplier = contentMultipliers[contentType];
  
  // Add randomness for natural variation (+/- 30%)
  const randomVariation = 0.7 + Math.random() * 0.6;
  
  // Calculate base likes
  let baseLikes = Math.floor(followers * baseEngagementRate * contentMultiplier * randomVariation);
  
  // Minimum likes (even with 0 followers, friends/family might like)
  baseLikes = Math.max(baseLikes, Math.floor(Math.random() * 5) + 1);
  
  // Viral boost (5-10x normal engagement)
  if (isViral) {
    const viralMultiplier = 5 + Math.random() * 5;
    baseLikes = Math.floor(baseLikes * viralMultiplier);
  }
  
  // Calculate other metrics based on likes (realistic ratios)
  // Comments are typically 1-5% of likes
  const commentRate = 0.01 + Math.random() * 0.04;
  const comments = Math.max(0, Math.floor(baseLikes * commentRate));
  
  // Reposts/shares are typically 5-15% of likes
  const repostRate = 0.05 + Math.random() * 0.10;
  const reposts = Math.max(0, Math.floor(baseLikes * repostRate));
  
  // Views are typically 10-30x likes (most people view but don't engage)
  const viewMultiplier = 10 + Math.random() * 20;
  const views = Math.floor(baseLikes * viewMultiplier);
  
  // Bookmarks are rare, about 1-3% of likes
  const bookmarkRate = 0.01 + Math.random() * 0.02;
  const bookmarks = Math.max(0, Math.floor(baseLikes * bookmarkRate));
  
  return {
    likes: baseLikes,
    comments,
    reposts,
    views,
    bookmarks,
  };
}

/**
 * Calculate how many new followers a post generates
 * Based on engagement and viral status
 */
export function calculateNewFollowersFromPost(
  currentFollowers: number,
  engagement: PostEngagement,
  isViral: boolean = false
): number {
  // Base: 1 new follower per 50-100 likes
  const likesPerFollower = 50 + Math.random() * 50;
  let newFollowers = Math.floor(engagement.likes / likesPerFollower);
  
  // Bonus from views (people discover you)
  const viewsPerFollower = 500 + Math.random() * 500;
  newFollowers += Math.floor(engagement.views / viewsPerFollower);
  
  // Viral posts attract many more followers
  if (isViral) {
    const viralBonus = 100 + Math.floor(Math.random() * 400);
    newFollowers += viralBonus;
  }
  
  // Growth rate slows as you get bigger (logarithmic)
  const growthModifier = 1 / (1 + Math.log10(Math.max(1, currentFollowers / 500)));
  newFollowers = Math.floor(newFollowers * growthModifier);
  
  // Minimum 1 follower if they got any engagement
  return Math.max(engagement.likes > 0 ? 1 : 0, newFollowers);
}

/**
 * Calculate follower growth for a new post (simplified version)
 */
export function calculateFollowerGrowth(
  currentFollowers: number,
  influenceLevel: InfluenceLevel,
  contentType: ContentType
): number {
  // Base growth based on influence level
  const levelGrowth: Record<InfluenceLevel, number> = {
    novice: 5,
    rising: 15,
    popular: 40,
    influencer: 100,
    celebrity: 250,
  };
  
  let baseGrowth = levelGrowth[influenceLevel] + Math.floor(Math.random() * 20);
  
  // Content type multiplier
  const typeMultipliers: Record<ContentType, number> = {
    text: 0.7,
    photo: 1.0,
    video: 1.5,
    story: 1.2,
    live: 2.0,
  };
  baseGrowth = Math.floor(baseGrowth * typeMultipliers[contentType]);
  
  // Logarithmic growth: growth slows as followers increase
  const growthModifier = 1 / (1 + Math.log10(Math.max(1, currentFollowers / 1000)));
  baseGrowth = Math.floor(baseGrowth * growthModifier);
  
  return Math.max(1, baseGrowth); // At least 1 follower
}

/**
 * Calculate follower growth for a new post (full version with all params)
 */
export function calculateFollowerGrowthFull(
  currentFollowers: number,
  likes: number,
  isViral: boolean,
  contentType: ContentType,
  careerBonus: boolean
): number {
  // Base growth: 5-15 followers per post
  let baseGrowth = 5 + Math.floor(Math.random() * 11);
  
  // Content type multiplier
  const typeMultipliers: Record<ContentType, number> = {
    text: 0.7,
    photo: 1.0,
    video: 1.5,
    story: 1.2,
    live: 2.0,
  };
  baseGrowth = Math.floor(baseGrowth * typeMultipliers[contentType]);
  
  // Engagement bonus (more likes = more followers)
  const engagementBonus = Math.floor(likes / 10); // 1 follower per 10 likes
  baseGrowth += engagementBonus;
  
  // Viral post bonus
  if (isViral) {
    const viralBonus = 100 + Math.floor(Math.random() * 401); // 100-500 followers
    baseGrowth += viralBonus;
  }
  
  // Career bonus (Celebrity/Athlete careers boost growth)
  if (careerBonus) {
    baseGrowth = Math.floor(baseGrowth * 1.5);
  }
  
  // Logarithmic growth: growth slows as followers increase
  const growthModifier = 1 / (1 + Math.log10(Math.max(1, currentFollowers / 1000)));
  baseGrowth = Math.floor(baseGrowth * growthModifier);
  
  return Math.max(1, baseGrowth); // At least 1 follower
}

/**
 * Check if a post goes viral (simplified version)
 */
export function checkViralChance(
  influenceLevel: InfluenceLevel,
  contentType: ContentType
): boolean {
  // Base viral chance by influence level
  const levelChances: Record<InfluenceLevel, number> = {
    novice: 0.02,
    rising: 0.05,
    popular: 0.08,
    influencer: 0.12,
    celebrity: 0.18,
  };
  
  let viralChance = levelChances[influenceLevel];
  
  // Content type affects viral chance
  const typeMultipliers: Record<ContentType, number> = {
    text: 0.5,
    photo: 1.0,
    video: 1.5,
    story: 1.2,
    live: 2.0,
  };
  viralChance *= typeMultipliers[contentType];
  
  return Math.random() < viralChance;
}

/**
 * Check if a post goes viral (full version with all params)
 */
export function checkViralChanceFull(
  likes: number,
  contentType: 'photo' | 'video' | 'story' | 'live',
  isSeasonal: boolean = false
): boolean {
  let viralChance = 0.05; // 5% base chance
  
  // Content type affects viral chance
  const typeChances: Record<string, number> = {
    photo: 0.05,
    video: 0.08,
    story: 0.06,
    live: 0.10,
  };
  viralChance = typeChances[contentType] || 0.05;
  
  // High engagement increases viral chance
  if (likes > 100) viralChance += 0.02;
  if (likes > 500) viralChance += 0.03;
  
  // Seasonal posts have higher viral potential
  if (isSeasonal) viralChance += 0.05;
  
  return Math.random() < viralChance;
}

/**
 * Calculate follower decay if inactive
 * -1% per week if no posts for 2+ weeks
 */
export function calculateFollowerDecay(
  currentFollowers: number,
  weeksSinceLastPost: number
): number {
  if (weeksSinceLastPost < 2) return 0;
  
  const decayPercent = 0.01; // 1% per week
  const weeksToDecay = weeksSinceLastPost - 1; // Start decaying after 1 week
  const decay = Math.floor(currentFollowers * decayPercent * weeksToDecay);
  
  return Math.min(decay, Math.floor(currentFollowers * 0.1)); // Max 10% decay
}

/**
 * Get social media data from game state
 */
export function getSocialMediaData(state: GameState): SocialMediaData & {
  totalLiveStreams?: number;
  totalLiveViewers?: number;
  totalLiveDuration?: number;
  peakLiveViewers?: number;
} {
  const socialMedia = state.socialMedia || {
    followers: 0,
    influenceLevel: 'novice' as InfluenceLevel,
    totalPosts: 0,
    viralPosts: 0,
    brandPartnerships: 0,
    engagementRate: 0,
    totalLiveStreams: 0,
    totalLiveViewers: 0,
    totalLiveDuration: 0,
    peakLiveViewers: 0,
  };
  
  // Apply political perk bonus to followers
  let followers = socialMedia.followers;
  if (state.politics && state.politics.careerLevel > 0) {
    const { getCombinedPerkEffects } = require('@/lib/politics/perks');
    const perkEffects = getCombinedPerkEffects(state.politics.careerLevel);
    if (perkEffects.socialMediaFollowerBonus > 0) {
      const bonus = Math.round(followers * (perkEffects.socialMediaFollowerBonus / 100));
      followers += bonus;
    }
  }
  
  const currentWeek = state.week;
  const lastPostWeek = socialMedia.lastPostWeek || 0;
  const weeksSinceLastPost = currentWeek - lastPostWeek;
  
  // Calculate current influence level (using adjusted follower count)
  const influenceLevel = getInfluenceLevel(followers);
  
  // Calculate engagement rate
  const engagementRate = calculateEngagementRate(
    socialMedia.totalPosts,
    weeksSinceLastPost
  );
  
  return {
    ...socialMedia,
    followers, // Return adjusted follower count
    influenceLevel,
    engagementRate,
    totalLiveStreams: socialMedia.totalLiveStreams || 0,
    totalLiveViewers: socialMedia.totalLiveViewers || 0,
    totalLiveDuration: socialMedia.totalLiveDuration || 0,
    peakLiveViewers: socialMedia.peakLiveViewers || 0,
  };
}

/**
 * Get influence level display info
 */
export function getInfluenceLevelInfo(level: InfluenceLevel): {
  name: string;
  description: string;
  color: string;
  gradient: [string, string];
  minFollowers: number;
  weeklyEarnings: string;
} {
  switch (level) {
    case 'novice':
      return {
        name: 'Novice',
        description: 'Just getting started. Keep posting to grow your audience!',
        color: '#6B7280',
        gradient: ['#6B7280', '#9CA3AF'],
        minFollowers: 0,
        weeklyEarnings: '$0',
      };
    case 'rising':
      return {
        name: 'Rising Star',
        description: 'Your content is gaining traction. Monetization unlocked!',
        color: '#3B82F6',
        gradient: ['#3B82F6', '#60A5FA'],
        minFollowers: 1_000,
        weeklyEarnings: '$5-25',
      };
    case 'popular':
      return {
        name: 'Popular Creator',
        description: 'You have a loyal following. Brands are noticing you!',
        color: '#8B5CF6',
        gradient: ['#8B5CF6', '#A78BFA'],
        minFollowers: 10_000,
        weeklyEarnings: '$25-100',
      };
    case 'influencer':
      return {
        name: 'Influencer',
        description: 'Major influence! Brand deals and partnerships available.',
        color: '#EC4899',
        gradient: ['#EC4899', '#F472B6'],
        minFollowers: 100_000,
        weeklyEarnings: '$100-500',
      };
    case 'celebrity':
      return {
        name: 'Celebrity',
        description: 'You are famous! Maximum earnings and exclusive perks.',
        color: '#F59E0B',
        gradient: ['#F59E0B', '#FBBF24'],
        minFollowers: 1_000_000,
        weeklyEarnings: '$500+',
      };
  }
}

/**
 * Get energy cost for creating different content types
 * Social media posting is draining - costs significant energy
 */
export function getEnergyCost(contentType: ContentType): number {
  switch (contentType) {
    case 'text':
      return 15; // Writing takes mental energy
    case 'photo':
      return 20; // Taking/editing photos takes more effort
    case 'video':
      return 40; // Video production is exhausting
    case 'story':
      return 12; // Quick but still takes effort
    case 'live':
      return 70; // Live streaming is very demanding
    default:
      return 15;
  }
}

/**
 * Get health cost for creating different content types
 * Screen time and social media use impacts health
 */
export function getHealthCost(contentType: ContentType): number {
  switch (contentType) {
    case 'text':
      return 3; // Minor screen strain
    case 'photo':
      return 5; // More screen time editing
    case 'video':
      return 12; // Extended editing sessions
    case 'story':
      return 4; // Quick but still screen time
    case 'live':
      return 15; // Long sessions, stressful
    default:
      return 5;
  }
}

/**
 * Get happiness gain for creating different content types
 * Sharing content and getting engagement feels good!
 */
export function getHappinessGain(contentType: ContentType, isViral: boolean = false): number {
  const baseGain: Record<ContentType, number> = {
    text: 5,
    photo: 8,   // Photos are more fun to share
    video: 12,  // Videos are very rewarding
    story: 6,
    live: 15,   // Live interaction is exciting
  };
  
  let gain = baseGain[contentType] || 5;
  
  // Viral posts give extra happiness boost!
  if (isViral) {
    gain += 20;
  }
  
  return gain;
}

/**
 * Get cooldown time in seconds for different content types
 */
export function getCooldownTime(contentType: ContentType): number {
  switch (contentType) {
    case 'text':
      return 300; // 5 minutes (300 seconds)
    case 'photo':
      return 600; // 10 minutes (600 seconds)
    case 'live':
      return 1800; // 30 minutes (1800 seconds)
    default:
      return 600; // Default 10 minutes
  }
}

/**
 * Check if player can create content (simplified version)
 */
export function canCreateContent(
  energy: number,
  contentType: ContentType,
  lastPostWeek?: number,
  currentWeek?: number
): { canCreate: boolean; reason?: string } {
  const energyCost = getEnergyCost(contentType);
  
  // Check energy
  if (energy < energyCost) {
    return { 
      canCreate: false, 
      reason: `Not enough energy! Need ${energyCost} energy.` 
    };
  }
  
  // Check weekly limit
  if (lastPostWeek !== undefined && currentWeek !== undefined && lastPostWeek === currentWeek) {
    return {
      canCreate: false,
      reason: 'You already posted this week. Wait until next week!',
    };
  }
  
  return { canCreate: true };
}

/**
 * Check if player can create content (full version with all validations)
 */
export function canCreateContentFull(
  state: GameState,
  contentType: ContentType,
  lastPostTimes?: Record<ContentType, number>,
  lastPostWeeks?: Record<ContentType, number>,
  currentWeek?: number
): { canPost: boolean; reason?: string } {
  const energyCost = getEnergyCost(contentType);
  const healthCost = getHealthCost(contentType);
  
  // Check energy
  if (state.stats.energy < energyCost) {
    return { 
      canPost: false, 
      reason: `Not enough energy! Need ${energyCost} energy.` 
    };
  }
  
  // Check health
  if (state.stats.health < healthCost) {
    return { 
      canPost: false, 
      reason: `Not enough health! Need ${healthCost} health.` 
    };
  }
  
  // Check weekly limit for this specific content type
  const activeWeek = typeof currentWeek === 'number' ? currentWeek : state.week;
  if (lastPostWeeks && lastPostWeeks[contentType] === activeWeek) {
    return {
      canPost: false,
      reason: 'You already created this content type this week. Wait until next week.',
    };
  }
  
  return { canPost: true };
}

/**
 * Calculate ad revenue from a post based on followers and influence (simplified)
 * X.com style monetization - earnings based on impressions
 */
export function calculatePostAdRevenue(
  followers: number,
  influenceLevel: InfluenceLevel,
  contentType: ContentType
): number {
  // Minimum followers for monetization (like X.com requires 500+ followers)
  if (followers < 500) return 0;
  
  // Base CPM (Cost Per Mille) based on influence level
  // Mirrors X.com's tiered monetization
  const levelCPM: Record<InfluenceLevel, number> = {
    novice: 0.10,     // $0.10 per 1000 impressions
    rising: 0.50,     // $0.50 per 1000 impressions
    popular: 1.50,    // $1.50 per 1000 impressions
    influencer: 3.00, // $3.00 per 1000 impressions
    celebrity: 5.00,  // $5.00 per 1000 impressions
  };
  
  // Content type multipliers
  const typeMultipliers: Record<ContentType, number> = {
    text: 1.0,  // Text posts can monetize on X
    photo: 1.2,
    video: 2.0, // Videos earn more
    story: 0.5, // Stories earn less (temporary)
    live: 0,    // Live streams don't earn ad revenue
  };
  
  // Estimated impressions based on followers (2-10% engagement rate)
  const engagementRate = 0.02 + (Math.random() * 0.08);
  const estimatedImpressions = Math.floor(followers * engagementRate * 10);
  
  // Calculate revenue
  let revenue = (estimatedImpressions / 1000) * levelCPM[influenceLevel] * typeMultipliers[contentType];
  
  // Random bonus (sometimes posts perform better)
  if (Math.random() > 0.8) {
    revenue *= 1.5;
  }
  
  return Math.max(0, Math.floor(revenue * 100) / 100);
}

/**
 * Calculate ad revenue from a post (full version)
 */
export function calculatePostAdRevenueFull(
  likes: number,
  contentType: ContentType,
  isViral: boolean,
  followers: number
): number {
  // Base CPM (Cost Per Mille) - $1 per 1000 likes/views
  const baseCPM = 1.0;
  
  // Content type multipliers
  const typeMultipliers: Record<ContentType, number> = {
    text: 0.5,
    photo: 1.0,
    video: 2.5,
    story: 0.8,
    live: 0,
  };
  
  // Views estimate (likes * 10-20 for engagement rate)
  const estimatedViews = likes * (10 + Math.random() * 10);
  
  // Calculate revenue
  let revenue = (estimatedViews / 1000) * baseCPM * typeMultipliers[contentType];
  
  // Viral bonus (2x revenue)
  if (isViral) {
    revenue *= 2;
  }
  
  // Follower bonus (more followers = better ad rates)
  const followerBonus = Math.min(1.5, 1 + (followers / 100_000));
  revenue *= followerBonus;
  
  return Math.floor(revenue);
}

/**
 * Calculate weekly passive earnings from impressions (X.com Creator Program style)
 * This runs every week to give players earnings based on their content performance
 */
export function calculateWeeklyImpressionEarnings(
  followers: number,
  influenceLevel: InfluenceLevel,
  totalPosts: number,
  recentViralPosts: number
): number {
  // Minimum requirements for monetization
  if (followers < 500 || totalPosts < 5) return 0;
  
  // Base weekly revenue from impressions
  const baseWeeklyRevenue: Record<InfluenceLevel, number> = {
    novice: 0,
    rising: 5,      // $5/week
    popular: 25,    // $25/week
    influencer: 100, // $100/week
    celebrity: 500,  // $500/week
  };
  
  let revenue = baseWeeklyRevenue[influenceLevel];
  
  // Bonus for viral posts this week
  revenue += recentViralPosts * 50;
  
  // Random variation (±20%)
  const variation = 0.8 + (Math.random() * 0.4);
  revenue *= variation;
  
  return Math.max(0, Math.floor(revenue));
}

/**
 * Calculate subscription revenue (X.com Premium/Subscriptions)
 */
export function calculateSubscriptionRevenue(
  subscribers: number,
  subscriptionPrice: number = 4.99
): number {
  // Platform takes 15% cut (like X.com)
  const platformCut = 0.15;
  return Math.floor(subscribers * subscriptionPrice * (1 - platformCut) * 100) / 100;
}

/**
 * Calculate tips/Super Follows revenue
 */
export function calculateTipsRevenue(
  followers: number,
  influenceLevel: InfluenceLevel
): number {
  if (followers < 1000) return 0;
  
  // Chance of receiving tips based on influence
  const tipChance: Record<InfluenceLevel, number> = {
    novice: 0,
    rising: 0.1,
    popular: 0.2,
    influencer: 0.35,
    celebrity: 0.5,
  };
  
  if (Math.random() > tipChance[influenceLevel]) return 0;
  
  // Random tip amount $1-$50
  const tipAmount = 1 + Math.random() * 49;
  
  // Platform takes 5% of tips
  return Math.floor(tipAmount * 0.95 * 100) / 100;
}

/**
 * Calculate live stream donations/superchats
 */
export function calculateLiveStreamDonations(
  viewers: number,
  duration: number,
  followers: number
): number {
  // Base donation rate: $0.10 per viewer per minute
  let baseDonations = (viewers * duration / 60) * 0.10;
  
  // Random superchats (big donations)
  const superchatChance = Math.min(0.3, viewers / 100); // Up to 30% chance with 100+ viewers
  if (Math.random() < superchatChance) {
    const superchatAmount = 10 + Math.random() * 90; // $10-$100 superchats
    baseDonations += superchatAmount;
  }
  
  // Follower bonus (more followers = more generous viewers)
  const followerBonus = Math.min(2.0, 1 + (followers / 50_000));
  baseDonations *= followerBonus;
  
  return Math.floor(baseDonations);
}

