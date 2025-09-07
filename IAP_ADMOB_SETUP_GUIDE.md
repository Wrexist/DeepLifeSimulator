# IAP & AdMob Setup Guide for DeepLife Simulator

## Overview

This guide will help you set up In-App Purchases (IAP) and Google AdMob for your DeepLife Simulator app. The implementation includes a complete IAP system with product management, purchase handling, and AdMob integration with banner, interstitial, and rewarded ads.

## 🚀 **What's Implemented**

### IAP Features
- ✅ Complete IAP service with product management
- ✅ Purchase handling and receipt validation
- ✅ Product restoration functionality
- ✅ Beautiful premium store UI
- ✅ Multiple product types (gems, premium features, starter packs)
- ✅ Purchase state management and persistence

### AdMob Features
- ✅ Banner ads with automatic loading
- ✅ Interstitial ads with frequency control
- ✅ Rewarded ads with game rewards
- ✅ Ad removal IAP integration
- ✅ Test and production ad unit management

## 📱 **Setup Instructions**

### 1. **App Store Connect Setup (iOS)**

#### Create In-App Purchases
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → Features → In-App Purchases
3. Create the following products with exact IDs:

```
deeplife_gems_small
deeplife_gems_medium
deeplife_gems_large
deeplife_gems_xlarge
deeplife_premium_pass
deeplife_starter_pack
deeplife_remove_ads
deeplife_double_money
deeplife_unlimited_energy
```

#### Product Configuration
- **Type**: Consumable for gems, Non-Consumable for remove ads
- **Reference Name**: Same as Product ID
- **Product ID**: Use the exact IDs above
- **Price**: Set appropriate prices for your region
- **Review Information**: Add screenshots and descriptions

### 2. **Google Play Console Setup (Android)**

#### Create In-App Products
1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app → Monetize → Products → In-app products
3. Create the same products as iOS with identical IDs

#### Product Configuration
- **Product ID**: Use the exact same IDs as iOS
- **Name**: Product display name
- **Description**: Product description
- **Price**: Set appropriate prices
- **Status**: Active

### 3. **AdMob Setup**

#### Create AdMob Account
1. Go to [AdMob](https://admob.google.com)
2. Create a new account or use existing one
3. Add your app (both iOS and Android versions)

#### Create Ad Units
Create the following ad units:

**Banner Ads:**
- iOS: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`
- Android: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`

**Interstitial Ads:**
- iOS: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`
- Android: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`

**Rewarded Ads:**
- iOS: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`
- Android: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`

#### Update AdMob IDs
Replace the placeholder IDs in `services/AdMobService.ts`:

```typescript
PRODUCTION_IDS: {
  BANNER: Platform.select({
    ios: 'ca-app-pub-YOUR_IOS_BANNER_ID',
    android: 'ca-app-pub-YOUR_ANDROID_BANNER_ID',
  }),
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-YOUR_IOS_INTERSTITIAL_ID',
    android: 'ca-app-pub-YOUR_ANDROID_INTERSTITIAL_ID',
  }),
  REWARDED: Platform.select({
    ios: 'ca-app-pub-YOUR_IOS_REWARDED_ID',
    android: 'ca-app-pub-YOUR_ANDROID_REWARDED_ID',
  }),
}
```

### 4. **App Configuration**

#### iOS Configuration (app.json)
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.deeplifesimulator",
      "buildNumber": "1.0.0",
      "infoPlist": {
        "SKAdNetworkItems": [
          {
            "SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork"
          }
        ]
      }
    }
  }
}
```

#### Android Configuration (app.json)
```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.deeplifesimulator",
      "versionCode": 1,
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    }
  }
}
```

### 5. **Testing Setup**

#### Test Accounts
- **iOS**: Create sandbox test accounts in App Store Connect
- **Android**: Add test accounts in Google Play Console

#### Test Devices
- Add your test device IDs to AdMob for test ads
- Use test product IDs during development

## 🎮 **Integration Guide**

### 1. **Add Premium Store Button**

Add this to your main game screen:

```typescript
import PremiumStore from '@/components/PremiumStore';

// In your component
const [showPremiumStore, setShowPremiumStore] = useState(false);

// Add button
<TouchableOpacity onPress={() => setShowPremiumStore(true)}>
  <Text>Premium Store</Text>
</TouchableOpacity>

// Add modal
<PremiumStore 
  visible={showPremiumStore} 
  onClose={() => setShowPremiumStore(false)} 
/>
```

### 2. **Add Banner Ads**

Add banner ads to your screens:

```typescript
import BannerAd from '@/components/BannerAd';

// In your component
<BannerAd style={{ position: 'absolute', bottom: 0 }} />
```

### 3. **Show Interstitial Ads**

Show ads at appropriate times:

```typescript
import { adMobService } from '@/services/AdMobService';

// After completing a job, buying items, etc.
await adMobService.showInterstitialAd();
```

### 4. **Show Rewarded Ads**

Offer rewards for watching ads:

```typescript
import { adMobService } from '@/services/AdMobService';

// When user wants to get gems/money for watching ad
const success = await adMobService.showRewardedAd();
if (success) {
  // Reward will be automatically applied
}
```

## 🔧 **Configuration Options**

### IAP Configuration

#### Update Product Prices
Edit `utils/iapConfig.ts` to change prices and descriptions:

```typescript
export const PRODUCT_CONFIGS = {
  [IAP_PRODUCTS.GEMS_SMALL]: {
    name: 'Small Gem Pack',
    description: 'Get 50 Gems to boost your progress',
    gems: 50,
    price: '$0.99', // Update this
    popular: false,
    bestValue: false,
  },
  // ... other products
};
```

#### Add New Products
1. Add product ID to `IAP_PRODUCTS`
2. Add configuration to `PRODUCT_CONFIGS`
3. Create product in App Store Connect/Google Play Console
4. Update the store UI if needed

### AdMob Configuration

#### Change Ad Frequency
Edit `services/AdMobService.ts`:

```typescript
// In showAdAtAppropriateTime method
const shouldShow = Math.random() < 0.3; // 30% chance - adjust this
```

#### Customize Rewards
Edit reward amounts in `services/AdMobService.ts`:

```typescript
// In handleReward method
const reward: AdReward = {
  type: 'gems',
  amount: 10, // Adjust reward amount
};
```

## 🧪 **Testing**

### IAP Testing

#### iOS Testing
1. Use sandbox test accounts
2. Test on physical device (not simulator)
3. Verify purchases in App Store Connect

#### Android Testing
1. Use test accounts in Google Play Console
2. Test on physical device
3. Verify purchases in Google Play Console

### AdMob Testing

#### Test Ads
- Use test ad unit IDs during development
- Test on physical devices
- Verify ad loading and display

#### Production Ads
- Switch to production ad unit IDs
- Test with real ads before release
- Monitor ad performance in AdMob dashboard

## 📊 **Analytics & Monitoring**

### IAP Analytics
- Monitor purchase conversion rates
- Track popular products
- Analyze revenue trends

### AdMob Analytics
- Monitor ad fill rates
- Track eCPM (effective cost per mille)
- Analyze user engagement with ads

## 🚨 **Common Issues & Solutions**

### IAP Issues

#### "Product Not Found" Error
- Verify product IDs match exactly
- Ensure products are approved in stores
- Check app bundle ID/package name

#### Purchase Not Completing
- Verify receipt validation
- Check network connectivity
- Ensure proper error handling

### AdMob Issues

#### Ads Not Loading
- Check ad unit IDs
- Verify network connectivity
- Check AdMob account status

#### Low Fill Rate
- Optimize ad placement
- Improve app content
- Consider ad mediation

## 🔒 **Security Considerations**

### IAP Security
- Implement server-side receipt validation
- Store purchase records securely
- Validate purchases on your server

### AdMob Security
- Use HTTPS for ad requests
- Implement ad fraud prevention
- Monitor for suspicious activity

## 📈 **Monetization Tips**

### IAP Optimization
- Offer value bundles
- Use limited-time offers
- Implement subscription options
- A/B test pricing strategies

### AdMob Optimization
- Optimize ad placement
- Use multiple ad formats
- Implement ad mediation
- Monitor user experience

## 🎯 **Next Steps**

1. **Complete Setup**: Follow all setup instructions above
2. **Test Thoroughly**: Test IAP and ads on both platforms
3. **Submit for Review**: Submit to App Store and Google Play
4. **Monitor Performance**: Track metrics and optimize
5. **Scale**: Add more products and ad formats as needed

## 📞 **Support**

For technical support:
- Check Expo documentation
- Review platform-specific guides
- Contact platform support teams

For implementation questions:
- Review the code comments
- Check the console logs
- Test with debug mode enabled

This implementation provides a complete monetization solution for DeepLife Simulator with professional-grade IAP and AdMob integration! 🎮💰
