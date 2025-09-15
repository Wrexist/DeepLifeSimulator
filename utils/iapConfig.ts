import { Platform } from 'react-native';

// IAP Product IDs - These must match exactly with your App Store/Google Play Console
export const IAP_PRODUCTS = {
  // Gem Shop Store Items (from GemShopModal)
  GEMS_STARTER: Platform.select({
    ios: 'deeplife_gems_starter',
    android: 'deeplife_gems_starter',
  }) || 'deeplife_gems_starter',
  
  GEMS_PREMIUM: Platform.select({
    ios: 'deeplife_gems_premium',
    android: 'deeplife_gems_premium',
  }) || 'deeplife_gems_premium',
  
  GEMS_ULTIMATE: Platform.select({
    ios: 'deeplife_gems_ultimate',
    android: 'deeplife_gems_ultimate',
  }) || 'deeplife_gems_ultimate',
  
  GEMS_MEGA: Platform.select({
    ios: 'deeplife_gems_mega',
    android: 'deeplife_gems_mega',
  }) || 'deeplife_gems_mega',
  
  // Individual Items
  YOUTH_PILL_SINGLE: Platform.select({
    ios: 'deeplife_youth_pill_single',
    android: 'deeplife_youth_pill_single',
  }) || 'deeplife_youth_pill_single',
  
  YOUTH_PILL_PACK: Platform.select({
    ios: 'deeplife_youth_pill_pack',
    android: 'deeplife_youth_pill_pack',
  }) || 'deeplife_youth_pill_pack',
  
  MONEY_BOOST: Platform.select({
    ios: 'deeplife_money_boost',
    android: 'deeplife_money_boost',
  }) || 'deeplife_money_boost',
  
  SKILL_BOOST: Platform.select({
    ios: 'deeplife_skill_boost',
    android: 'deeplife_skill_boost',
  }) || 'deeplife_skill_boost',
  
  LIFETIME_PREMIUM: Platform.select({
    ios: 'deeplife_lifetime_premium',
    android: 'deeplife_lifetime_premium',
  }) || 'deeplife_lifetime_premium',
  
  // Perks IAP (from ShopModal)
  WORK_BOOST: Platform.select({
    ios: 'deeplife_work_boost',
    android: 'deeplife_work_boost',
  }) || 'deeplife_work_boost',
  
  MINDSET: Platform.select({
    ios: 'deeplife_mindset',
    android: 'deeplife_mindset',
  }) || 'deeplife_mindset',
  
  FAST_LEARNER: Platform.select({
    ios: 'deeplife_fast_learner',
    android: 'deeplife_fast_learner',
  }) || 'deeplife_fast_learner',
  
  GOOD_CREDIT: Platform.select({
    ios: 'deeplife_good_credit',
    android: 'deeplife_good_credit',
  }) || 'deeplife_good_credit',
  
  UNLOCK_ALL_PERKS: Platform.select({
    ios: 'deeplife_unlock_all_perks',
    android: 'deeplife_unlock_all_perks',
  }) || 'deeplife_unlock_all_perks',
  
  // Remove ads
  REMOVE_ADS: Platform.select({
    ios: 'deeplife_remove_ads',
    android: 'deeplife_remove_ads',
  }) || 'deeplife_remove_ads',
};

// Product configurations with descriptions and rewards
export const PRODUCT_CONFIGS = {
  // Gem Shop Store Items
  [IAP_PRODUCTS.GEMS_STARTER]: {
    name: 'Starter Pack',
    description: '1,000 Gems + 1 Youth Pill',
    gems: 1000,
    youthPills: 1,
    price: '$9.99',
    popular: false,
    bestValue: false,
    originalPrice: '$14.98',
    savings: '33%',
  },
  
  [IAP_PRODUCTS.GEMS_PREMIUM]: {
    name: 'Premium Pack',
    description: '3,500 Gems + 3 Youth Pills + Money Multiplier',
    gems: 3500,
    youthPills: 3,
    moneyMultiplier: true,
    price: '$24.99',
    popular: true,
    bestValue: false,
    originalPrice: '$44.97',
    savings: '44%',
  },
  
  [IAP_PRODUCTS.GEMS_ULTIMATE]: {
    name: 'Ultimate Pack',
    description: '12,000 Gems + 10 Youth Pills + All Permanent Upgrades',
    gems: 12000,
    youthPills: 10,
    allUpgrades: true,
    price: '$49.99',
    popular: false,
    bestValue: true,
    originalPrice: '$199.90',
    savings: '75%',
  },
  
  [IAP_PRODUCTS.GEMS_MEGA]: {
    name: 'Mega Pack',
    description: '40,000 Gems + Unlimited Youth Pills + Everything Unlocked',
    gems: 40000,
    unlimitedYouthPills: true,
    everythingUnlocked: true,
    price: '$99.99',
    popular: false,
    bestValue: false,
    originalPrice: '$499.85',
    savings: '80%',
  },
  
  // Individual Items
  [IAP_PRODUCTS.YOUTH_PILL_SINGLE]: {
    name: 'Youth Pill (Single)',
    description: 'Reset age to 18 - One time use',
    youthPills: 1,
    price: '$4.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.YOUTH_PILL_PACK]: {
    name: 'Youth Pill Pack',
    description: '5 Youth Pills - Great value',
    youthPills: 5,
    price: '$19.99',
    popular: false,
    bestValue: false,
    originalPrice: '$24.95',
    savings: '20%',
  },
  
  [IAP_PRODUCTS.MONEY_BOOST]: {
    name: 'Money Boost',
    description: 'Instant $1,000,000 cash injection',
    money: 1000000,
    price: '$7.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.SKILL_BOOST]: {
    name: 'Skill Boost',
    description: 'All skills +50 levels instantly',
    skillBoost: 50,
    price: '$12.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.LIFETIME_PREMIUM]: {
    name: 'Lifetime Premium',
    description: 'All future updates + exclusive content + no ads',
    lifetimePremium: true,
    price: '$79.99',
    popular: false,
    bestValue: false,
    features: [
      'All future updates',
      'Exclusive content',
      'No advertisements',
      'Premium support',
      'Early access to features',
    ],
  },
  
  // Perks IAP
  [IAP_PRODUCTS.WORK_BOOST]: {
    name: 'Work Pay Boost',
    description: '+50% earnings on all jobs',
    workBoost: true,
    price: '$1.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.MINDSET]: {
    name: 'Mindset',
    description: '50% faster promotions',
    mindset: true,
    price: '$1.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.FAST_LEARNER]: {
    name: 'Fast Learner',
    description: '50% faster education',
    fastLearner: true,
    price: '$1.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.GOOD_CREDIT]: {
    name: 'Good Credit Score',
    description: 'Higher bank interest rates',
    goodCredit: true,
    price: '$1.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.UNLOCK_ALL_PERKS]: {
    name: 'Unlock All Perks',
    description: 'Includes all perks above',
    allPerks: true,
    price: '$6.99',
    popular: true,
    bestValue: true,
    originalPrice: '$7.96',
    savings: '12%',
  },
  
  [IAP_PRODUCTS.REMOVE_ADS]: {
    name: 'Remove Ads',
    description: 'Enjoy ad-free gaming experience',
    removeAds: true,
    price: '$2.99',
    popular: false,
    bestValue: false,
    features: [
      'No more banner ads',
      'No more interstitial ads',
      'Faster game loading',
      'Better performance',
    ],
  },
};

// Subscription products (if you want to add subscriptions later)
export const SUBSCRIPTION_PRODUCTS = {
  PREMIUM_MONTHLY: Platform.select({
    ios: 'deeplife_premium_monthly',
    android: 'deeplife_premium_monthly',
  }) || 'deeplife_premium_monthly',
  
  PREMIUM_YEARLY: Platform.select({
    ios: 'deeplife_premium_yearly',
    android: 'deeplife_premium_yearly',
  }) || 'deeplife_premium_yearly',
};

// Get all product IDs as an array
export const getAllProductIds = () => Object.values(IAP_PRODUCTS);

// Get all subscription IDs as an array
export const getAllSubscriptionIds = () => Object.values(SUBSCRIPTION_PRODUCTS);

// Helper function to get product config
export const getProductConfig = (productId: string) => {
  return PRODUCT_CONFIGS[productId as keyof typeof PRODUCT_CONFIGS];
};

// Helper function to check if product is popular
export const isPopularProduct = (productId: string) => {
  const config = getProductConfig(productId);
  return config?.popular || false;
};

// Helper function to check if product is best value
export const isBestValueProduct = (productId: string) => {
  const config = getProductConfig(productId);
  return config?.bestValue || false;
};
