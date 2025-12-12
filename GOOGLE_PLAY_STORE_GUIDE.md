# Complete Guide: Uploading DeepLife Simulator to Google Play Store

This guide covers every step needed to publish your Expo app to the Google Play Store, from initial setup to final publication.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Google Play Console Setup](#step-1-google-play-console-setup)
3. [Step 2: Prepare Your App Configuration](#step-2-prepare-your-app-configuration)
4. [Step 3: Create Required Assets](#step-3-create-required-assets)
5. [Step 4: Set Up Google Play Service Account](#step-4-set-up-google-play-service-account)
6. [Step 5: Build Your App Bundle (AAB)](#step-5-build-your-app-bundle-aab)
7. [Step 6: Complete App Information in Play Console](#step-6-complete-app-information-in-play-console)
8. [Step 7: Upload Your App Bundle](#step-7-upload-your-app-bundle)
9. [Step 8: Complete Store Listing](#step-8-complete-store-listing)
10. [Step 9: Content Rating](#step-9-content-rating)
11. [Step 10: Pricing and Distribution](#step-10-pricing-and-distribution)
12. [Step 11: App Access](#step-11-app-access)
13. [Step 12: Data Safety](#step-12-data-safety)
14. [Step 13: Target Audience and Content](#step-13-target-audience-and-content)
15. [Step 14: Review and Publish](#step-14-review-and-publish)
16. [Step 15: Post-Publication](#step-15-post-publication)
17. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Google Play Developer Account ($25 one-time fee, already paid)
- ✅ App created in Google Play Console (you mentioned you've done this)
- ✅ Expo account (you have one: `isacm`)
- ✅ EAS CLI installed globally
- ✅ Node.js and npm installed
- ✅ Git repository (for version control)

### Install EAS CLI (if not already installed)

```bash
npm install -g eas-cli
```

### Login to EAS

```bash
eas login
```

Enter your Expo credentials when prompted.

---

## Step 1: Google Play Console Setup

### 1.1 Access Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Sign in with your Google account
3. You should see your app "DeepLife Simulator" (or whatever name you created)

### 1.2 Complete Account Setup (if not done)

If you haven't completed your developer account setup:

1. Go to **Settings** → **Account details**
2. Complete all required information:
   - Developer name
   - Email address
   - Phone number
   - Address
3. Accept the Developer Distribution Agreement

### 1.3 Verify App Package Name

1. In Play Console, go to your app
2. Navigate to **Setup** → **App integrity**
3. Verify the package name matches: `com.deeplife.simulator`
4. If it doesn't match, you'll need to either:
   - Update your `app.config.js` to match the Play Console package name, OR
   - Create a new app in Play Console with the correct package name

**⚠️ IMPORTANT**: The package name in `app.config.js` must exactly match the package name in Google Play Console. Once published, you cannot change it.

---

## Step 2: Prepare Your App Configuration

### 2.1 Update Version Numbers

Before building, update your version numbers in `app.config.js`:

**Current values:**
- `version: "2.2.4"` (user-facing version)
- `versionCode: 2` (internal version code for Play Store)

**For your first release:**
- Keep `version: "2.2.4"` or set to `"1.0.0"` if this is your first public release
- Increment `versionCode` to `3` (or higher if you've already uploaded builds)

**Important Rules:**
- `versionCode` must be a positive integer
- Each new upload must have a higher `versionCode` than the previous one
- `version` is what users see (can be any string like "1.0.0", "2.2.4", etc.)

### 2.2 Verify App Configuration

Open `app.config.js` and verify:

```javascript
android: {
  package: "com.deeplife.simulator",  // Must match Play Console
  versionCode: 3,  // Increment this for each upload
  adaptiveIcon: {
    foregroundImage: "./assets/images/icon.png",
    backgroundColor: "#FFFFFF"
  },
  // ... rest of config
}
```

### 2.3 Check Required Assets Exist

Verify these files exist:
- ✅ `./assets/images/icon.png` (app icon, 1024x1024px recommended)
- ✅ App icon should be square with no transparency for Android

---

## Step 3: Create Required Assets

You'll need these assets for the Play Store listing:

### 3.1 App Icon
- **Size**: 512x512px (minimum), 1024x1024px (recommended)
- **Format**: PNG (no transparency for Android)
- **Location**: `./assets/images/icon.png`
- **Requirements**: 
  - Square image
  - No rounded corners (Play Store will add them)
  - High quality, clear at small sizes

### 3.2 Feature Graphic (Banner)
- **Size**: 1024x500px
- **Format**: PNG or JPG
- **Requirements**: 
  - Represents your app
  - No text (or minimal text)
  - High quality

### 3.3 Screenshots

You need screenshots for at least one device category:

**Phone Screenshots:**
- **Minimum**: 2 screenshots
- **Maximum**: 8 screenshots
- **Size**: 16:9 or 9:16 aspect ratio
- **Recommended**: 1080x1920px (portrait) or 1920x1080px (landscape)
- **Format**: PNG or JPG

**Tablet Screenshots (Optional but Recommended):**
- Same requirements as phone screenshots
- 7" or 10" tablet sizes

**How to Create Screenshots:**
1. Run your app in development: `npm start`
2. Use an Android emulator or physical device
3. Take screenshots of key features:
   - Main game screen
   - Career/character progression
   - Settings/features
   - Any unique gameplay elements
4. Save them in a folder like `./assets/play-store-screenshots/`

### 3.4 Promotional Video (Optional but Recommended)
- **Format**: YouTube link
- **Length**: 30 seconds to 2 minutes
- **Content**: Showcase your app's features

---

## Step 4: Set Up Google Play Service Account

This allows EAS to automatically upload your app to Play Store.

### 4.1 Create Service Account in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Fill in:
   - **Name**: `play-store-uploader` (or any name)
   - **Description**: `Service account for uploading to Google Play Store`
6. Click **Create and Continue**
7. Skip role assignment (click **Continue**)
8. Click **Done**

### 4.2 Create and Download Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create**
6. The JSON file will download automatically
7. **Save this file securely** - you'll need it

### 4.3 Link Service Account to Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Setup** → **API access**
4. Under **Service accounts**, click **Link service account**
5. Enter the email address of your service account (found in the JSON file, looks like `xxxxx@xxxxx.iam.gserviceaccount.com`)
6. Click **Grant access**
7. Select permissions:
   - ✅ **View app information and download bulk reports**
   - ✅ **Manage production releases**
   - ✅ **Manage testing track releases**
   - ✅ **Manage store listing**
8. Click **Invite user**

### 4.4 Add Service Account Key to Your Project

1. Rename the downloaded JSON file to: `google-play-service-account.json`
2. Place it in your project root directory (same level as `package.json`)
3. **⚠️ IMPORTANT**: Add this file to `.gitignore` to keep it secure:

```bash
# Add to .gitignore
echo "google-play-service-account.json" >> .gitignore
```

4. Verify `eas.json` has the correct path:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"  // or "production" for production releases
      }
    }
  }
}
```

---

## Step 5: Build Your App Bundle (AAB)

Google Play requires an Android App Bundle (AAB), not an APK.

### 5.1 Configure EAS Build

Your `eas.json` is already configured correctly:

```json
{
  "build": {
    "production": {
      "android": {
        "resourceClass": "medium",
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

### 5.2 Build for Production

Run the build command:

```bash
eas build --platform android --profile production
```

**What happens:**
1. EAS will ask you to confirm the build
2. The build will run on Expo's servers (takes 10-20 minutes)
3. You'll get a download link when complete

### 5.3 Download and Verify Build

1. Once build completes, you'll see a URL
2. Download the `.aab` file
3. Verify the file size (should be reasonable, not 0 bytes)
4. Keep this file - you'll upload it to Play Console

**Alternative: Automatic Upload**

If your service account is set up correctly, you can use:

```bash
eas build --platform android --profile production --auto-submit
```

This will build and automatically upload to Play Console (skips manual upload step).

---

## Step 6: Complete App Information in Play Console

Before uploading, complete basic app information:

### 6.1 App Access

1. Go to **Policy** → **App access**
2. Select:
   - **Free access** (if your app is free)
   - **Restricted access** (if you have login requirements)
3. Complete any required declarations

### 6.2 Ads Declaration

Since you're using Google Mobile Ads:

1. Go to **Policy** → **Ads**
2. Select **Yes, my app contains ads**
3. Complete the ads declaration form

### 6.3 Content Rating

1. Go to **Policy** → **Content rating**
2. Click **Start questionnaire**
3. Answer questions about your app's content
4. Submit for rating (takes a few hours to days)

---

## Step 7: Upload Your App Bundle

### Option A: Manual Upload

1. Go to **Production** (or **Internal testing** / **Closed testing** / **Open testing**)
2. Click **Create new release**
3. Under **App bundles**, click **Upload**
4. Select your `.aab` file
5. Wait for upload to complete
6. Fill in **Release name** (e.g., "Version 2.2.4")
7. Fill in **Release notes** (what's new in this version)
8. Click **Save**

### Option B: Automatic Upload (EAS Submit)

If you didn't use `--auto-submit` during build:

```bash
eas submit --platform android --profile production
```

This will:
1. Use your service account key
2. Upload the latest build to Play Console
3. Place it in the track specified in `eas.json` (currently "internal")

**To change the track**, update `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "production"  // Change from "internal" to "production"
      }
    }
  }
}
```

---

## Step 8: Complete Store Listing

Go to **Store presence** → **Main store listing**

### 8.1 App Name
- **Current**: "DeepLife Simulator"
- **Max**: 50 characters
- **Required**: Yes

### 8.2 Short Description
- **Max**: 80 characters
- **Required**: Yes
- **Example**: "The ultimate life simulation game where every choice matters"

### 8.3 Full Description
- **Max**: 4000 characters
- **Required**: Yes
- **Include**:
  - What your app does
  - Key features
  - What makes it unique
  - How to play/get started

**Example Template:**

```
DeepLife Simulator is the ultimate life simulation game where every choice matters. Experience a complete virtual life with realistic career progression, relationships, finances, and more.

KEY FEATURES:
• Build your career from entry-level to CEO
• Manage your finances with stocks, real estate, and investments
• Develop relationships with friends and romantic partners
• Explore skill trees and unlock talents
• Make life-changing decisions that affect your future
• Experience random events and weekly challenges
• Track your progress with detailed statistics

Start your journey today and see where your choices take you!
```

### 8.4 Graphics

Upload your assets:

1. **App Icon**: Upload 512x512px icon
2. **Feature Graphic**: Upload 1024x500px banner
3. **Phone Screenshots**: Upload 2-8 screenshots (16:9 or 9:16)
4. **Tablet Screenshots** (Optional): Upload tablet screenshots
5. **Promotional Video** (Optional): Add YouTube link

### 8.5 Categorization

1. **App category**: Select **Games** → **Simulation**
2. **Tags** (Optional): Add relevant tags like "life simulator", "strategy", "simulation"

### 8.6 Contact Details

1. **Email**: Your developer email
2. **Phone** (Optional): Your phone number
3. **Website** (Optional): Your website URL

Click **Save** when done.

---

## Step 9: Content Rating

### 9.1 Complete Questionnaire

1. Go to **Policy** → **Content rating**
2. Click **Start questionnaire** or **Edit questionnaire**
3. Answer all questions honestly about your app's content:
   - Violence
   - Sexual content
   - Profanity
   - Gambling
   - Drugs/alcohol
   - etc.
4. Submit questionnaire

### 9.2 Wait for Rating

- Rating is usually completed within a few hours
- You'll receive an email when complete
- Rating must be complete before you can publish

---

## Step 10: Pricing and Distribution

### 10.1 Set Price

1. Go to **Monetization setup** → **Products** → **Apps and in-app products**
2. Select **Free** or **Paid**
3. If paid, set your price
4. Click **Save**

### 10.2 Countries/Regions

1. Go to **Pricing and distribution**
2. Under **Countries/regions**, select:
   - **All countries** (recommended), OR
   - **Selected countries** (choose specific countries)
3. Click **Save**

### 10.3 Device Categories

1. Under **Device categories**, select:
   - ✅ **Phones**
   - ✅ **Tablets** (if your app supports tablets)
2. Click **Save**

---

## Step 11: App Access

### 11.1 Declare App Access

1. Go to **Policy** → **App access**
2. Answer: **Does your app need access to restricted APIs or sensitive permissions?**
   - Your app uses: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, VIBRATE
   - These are standard permissions, so answer accordingly
3. Complete any required declarations

---

## Step 12: Data Safety

### 12.1 Complete Data Safety Form

1. Go to **Policy** → **Data safety**
2. Click **Start** or **Edit**
3. Answer questions about:
   - **Data collection**: Does your app collect user data?
   - **Data sharing**: Do you share data with third parties?
   - **Security practices**: How do you protect user data?
   - **Data deletion**: Can users request data deletion?

**For DeepLife Simulator:**
- If you use Google Mobile Ads, you collect some data
- If you have cloud save, you collect game data
- Be honest about what data you collect

4. Complete all sections
5. Click **Save**

---

## Step 13: Target Audience and Content

### 13.1 Target Audience

1. Go to **Policy** → **Target audience and content**
2. Select target age group
3. Answer questions about content suitability
4. Complete declarations

---

## Step 14: Review and Publish

### 14.1 Pre-Launch Checklist

Before publishing, verify:

- ✅ App bundle uploaded
- ✅ Store listing complete (name, description, screenshots)
- ✅ Content rating complete
- ✅ Data safety form complete
- ✅ Pricing set
- ✅ Countries selected
- ✅ All required policies completed
- ✅ App access declared
- ✅ Ads declared (if applicable)

### 14.2 Review Your Release

1. Go to **Production** (or your chosen track)
2. Review your release:
   - Version number
   - Release notes
   - App bundle version
3. Check for any warnings or errors

### 14.3 Start Rollout to Production

1. In your release, click **Review release**
2. Review all information
3. If everything looks good, click **Start rollout to Production**
4. Confirm the rollout

**⚠️ IMPORTANT**: 
- First-time publication can take 1-7 days for review
- Subsequent updates usually take 1-3 days
- You'll receive email notifications about review status

### 14.4 Monitor Review Status

1. Go to **Dashboard**
2. Check **Review status** section
3. You'll see status like:
   - **Under review**
   - **Changes requested** (if issues found)
   - **Published** (when live)

---

## Step 15: Post-Publication

### 15.1 App Goes Live

Once approved:
- Your app will be available on Google Play Store
- Users can search and download it
- You'll receive an email confirmation

### 15.2 Monitor Your App

1. **Dashboard**: Check downloads, ratings, reviews
2. **Statistics**: View user analytics
3. **Reviews**: Respond to user reviews
4. **Crashes**: Monitor crash reports

### 15.3 Update Your App

For future updates:

1. **Increment version numbers** in `app.config.js`:
   ```javascript
   version: "2.2.5",  // Update user-facing version
   versionCode: 4,     // Increment by 1
   ```

2. **Build new version**:
   ```bash
   eas build --platform android --profile production
   ```

3. **Submit update**:
   ```bash
   eas submit --platform android --profile production
   ```

4. **Or use auto-submit**:
   ```bash
   eas build --platform android --profile production --auto-submit
   ```

---

## Troubleshooting

### Build Fails

**Issue**: EAS build fails
**Solutions**:
- Check build logs for specific errors
- Verify `app.config.js` is valid
- Ensure all dependencies are in `package.json`
- Check EAS status page for service issues

### Upload Fails

**Issue**: Can't upload to Play Console
**Solutions**:
- Verify service account key is correct
- Check service account has proper permissions
- Ensure package name matches Play Console
- Try manual upload instead of automatic

### Review Rejected

**Issue**: App rejected during review
**Solutions**:
- Read rejection email carefully
- Address all issues mentioned
- Update app and resubmit
- Contact Play Console support if needed

### Version Code Error

**Issue**: "Version code already used"
**Solutions**:
- Increment `versionCode` in `app.config.js`
- Each upload must have a unique, higher version code

### Package Name Mismatch

**Issue**: Package name doesn't match
**Solutions**:
- Update `app.config.js` to match Play Console, OR
- Create new app in Play Console with correct package name
- **Note**: You cannot change package name after first publication

### Missing Assets

**Issue**: Store listing incomplete
**Solutions**:
- Ensure all required screenshots are uploaded
- Verify app icon meets size requirements
- Complete all required fields in store listing

---

## Quick Reference Commands

```bash
# Login to EAS
eas login

# Build for Android production
eas build --platform android --profile production

# Build and auto-submit
eas build --platform android --profile production --auto-submit

# Submit existing build
eas submit --platform android --profile production

# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]
```

---

## Important Notes

1. **Package Name**: Cannot be changed after first publication
2. **Version Code**: Must always increase with each upload
3. **Review Time**: First publication takes 1-7 days
4. **Service Account Key**: Keep it secure, never commit to Git
5. **Testing**: Consider using Internal Testing track first before Production
6. **Updates**: Always test updates thoroughly before submitting

---

## Next Steps After Publication

1. **Monitor Reviews**: Respond to user feedback
2. **Track Analytics**: Use Play Console analytics
3. **Fix Bugs**: Address issues quickly
4. **Plan Updates**: Regular updates keep users engaged
5. **Marketing**: Promote your app on social media, websites, etc.

---

## Support Resources

- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Guide](https://developer.android.com/guide/app-bundle)
- [Play Console Policies](https://play.google.com/about/developer-content-policy/)

---

**Good luck with your publication! 🚀**

If you encounter any issues, refer to the troubleshooting section or check the official documentation.

