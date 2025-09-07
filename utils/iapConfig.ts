import { Platform } from 'react-native';

// IAP Product IDs - These must match exactly with your App Store/Google Play Console
export const IAP_PRODUCTS = {
  // Gems packages
  GEMS_SMALL: Platform.select({
    ios: 'deeplife_gems_small',
    android: 'deeplife_gems_small',
  }) || 'deeplife_gems_small',
  
  GEMS_MEDIUM: Platform.select({
    ios: 'deeplife_gems_medium',
    android: 'deeplife_gems_medium',
  }) || 'deeplife_gems_medium',
  
  GEMS_LARGE: Platform.select({
    ios: 'deeplife_gems_large',
    android: 'deeplife_gems_large',
  }) || 'deeplife_gems_large',
  
  GEMS_XLARGE: Platform.select({
    ios: 'deeplife_gems_xlarge',
    android: 'deeplife_gems_xlarge',
  }) || 'deeplife_gems_xlarge',
  
  // Premium features
  PREMIUM_PASS: Platform.select({
    ios: 'deeplife_premium_pass',
    android: 'deeplife_premium_pass',
  }) || 'deeplife_premium_pass',
  
  // Starter packs
  STARTER_PACK: Platform.select({
    ios: 'deeplife_starter_pack',
    android: 'deeplife_starter_pack',
  }) || 'deeplife_starter_pack',
  
  // Remove ads
  REMOVE_ADS: Platform.select({
    ios: 'deeplife_remove_ads',
    android: 'deeplife_remove_ads',
  }) || 'deeplife_remove_ads',
  
  // Special offers
  DOUBLE_MONEY: Platform.select({
    ios: 'deeplife_double_money',
    android: 'deeplife_double_money',
  }) || 'deeplife_double_money',
  
  UNLIMITED_ENERGY: Platform.select({
    ios: 'deeplife_unlimited_energy',
    android: 'deeplife_unlimited_energy',
  }) || 'deeplife_unlimited_energy',

  // Gem Shop Upgrades
  MONEY_MULTIPLIER: 'multiplier',

  SKIP_WEEK: 'skip_week',

  YOUTH_PILL: 'youth_pill',
};

// Product configurations with descriptions and rewards
export const PRODUCT_CONFIGS = {
  [IAP_PRODUCTS.GEMS_SMALL]: {
    name: 'Small Gem Pack',
    description: 'Get 50 Gems to boost your progress',
    gems: 50,
    price: '$0.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.GEMS_MEDIUM]: {
    name: 'Medium Gem Pack',
    description: 'Get 150 Gems for better value',
    gems: 150,
    price: '$2.99',
    popular: true,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.GEMS_LARGE]: {
    name: 'Large Gem Pack',
    description: 'Get 500 Gems for serious progress',
    gems: 500,
    price: '$7.99',
    popular: false,
    bestValue: true,
  },
  
  [IAP_PRODUCTS.GEMS_XLARGE]: {
    name: 'Mega Gem Pack',
    description: 'Get 1500 Gems for ultimate power',
    gems: 1500,
    price: '$19.99',
    popular: false,
    bestValue: false,
  },
  
  [IAP_PRODUCTS.PREMIUM_PASS]: {
    name: 'Premium Pass',
    description: 'Unlock all premium features for 30 days',
    gems: 0,
    price: '$4.99',
    popular: true,
    bestValue: false,
    features: [
      'Double money earnings',
      'Unlimited energy',
      'Premium UI themes',
      'Exclusive achievements',
      'Priority support',
    ],
  },
  
  [IAP_PRODUCTS.STARTER_PACK]: {
    name: 'Starter Pack',
    description: 'Perfect for new players',
    gems: 100,
    money: 10000,
    price: '$1.99',
    popular: false,
    bestValue: false,
    features: [
      '100 Gems',
      '$10,000 starting money',
      'Premium starter items',
    ],
  },
  
  [IAP_PRODUCTS.REMOVE_ADS]: {
    name: 'Remove Ads',
    description: 'Enjoy ad-free gaming experience',
    gems: 0,
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
  
  [IAP_PRODUCTS.DOUBLE_MONEY]: {
    name: 'Double Money Boost',
    description: 'Double all money earnings for 7 days',
    gems: 0,
    price: '$0.99',
    popular: false,
    bestValue: false,
    duration: '7 days',
  },
  
  [IAP_PRODUCTS.UNLIMITED_ENERGY]: {
    name: 'Unlimited Energy',
    description: 'Unlimited energy for 24 hours',
    gems: 0,
    price: '$0.99',
    popular: false,
    bestValue: false,
    duration: '24 hours',
  },

  // Gem Shop Upgrades
  [IAP_PRODUCTS.MONEY_MULTIPLIER]: {
    name: 'Money Multiplier',
    description: 'Increase cash by 50%',
    gems: 10000,
    price: '10,000 Gems',
    popular: false,
    bestValue: false,
    type: 'gem_upgrade',
  },

  [IAP_PRODUCTS.SKIP_WEEK]: {
    name: 'Skip Week',
    description: 'Jump ahead one week',
    gems: 5000,
    price: '5,000 Gems',
    popular: false,
    bestValue: false,
    type: 'gem_upgrade',
  },

  [IAP_PRODUCTS.YOUTH_PILL]: {
    name: 'Youth Pill',
    description: 'Reset age to 18',
    gems: 20000,
    price: '20,000 Gems',
    popular: true,
    bestValue: false,
    type: 'gem_upgrade',
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
