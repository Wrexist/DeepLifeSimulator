# App Store Screenshot Guide - DeepLife Simulator

## Overview

This guide will help you capture and upload compliant screenshots for Apple's App Store review, specifically addressing the **Guideline 2.3.3** requirement that screenshots must accurately reflect the current version of the app.

## ⚠️ Apple's Requirements

Apple requires that screenshots:
- Show the **current version** of your app in use
- Highlight the app's **core concept and functionality**
- Be **identical** to the actual app UI (no marketing overlays that obscure the app)
- Be captured on the **correct device** for each size class
- NOT primarily show splash screens or login screens
- Accurately represent the app on **all supported devices**

## 📱 Required Screenshot Sizes

For iPhone, you need screenshots in the following sizes:

### 6.5-inch Display (Required - Apple's Issue)
- **Resolution**: 1284 x 2778 pixels (or 1242 x 2688 pixels)
- **Devices**: iPhone 14 Plus, iPhone 13 Pro Max, iPhone 12 Pro Max, iPhone 11 Pro Max, iPhone XS Max
- **Number Required**: 5-10 screenshots
- **Status**: ❌ Current screenshots are outdated (Apple's feedback)

### 5.5-inch Display
- **Resolution**: 1242 x 2208 pixels
- **Devices**: iPhone 8 Plus, iPhone 7 Plus, iPhone 6s Plus
- **Number Required**: 5-10 screenshots

### iPad Pro (12.9-inch) 3rd Generation
- **Resolution**: 2048 x 2732 pixels
- **Number Required**: 5-10 screenshots (if supporting iPad)

## 🎯 Recommended Screenshots to Capture

Capture these screens in the following order to showcase your app's core features:

### 1. **Home Screen / Character Overview** ⭐
- Show the main `IdentityCard` component
- Display character stats (age, money, happiness, health, energy)
- Ensure stats are visible and realistic (not all zeros)
- **Why**: Shows the core life simulation mechanic

### 2. **Career/Jobs Screen** ⭐
- Navigate to the Jobs tab
- Show available jobs with salaries
- Display current employment status
- **Why**: Demonstrates earning money and career progression

### 3. **Activities Screen** ⭐
- Show the Activities tab with various life actions
- Display options like:
  - Work (if employed)
  - Education
  - Gym
  - Social activities
  - Shopping
- **Why**: Shows core gameplay loop

### 4. **Market/Shop Screen**
- Navigate to the Market tab
- Show purchasable items (cars, houses, luxury items)
- Display player's current balance
- **Why**: Demonstrates economy system

### 5. **Social/Relationships Tab**
- Show the Social tab
- Display relationships, family, or social connections
- **Why**: Shows social simulation aspect

### 6. **Skills or Character Progression**
- Display skill trees or character stats
- Show level progression or achievements
- **Why**: Demonstrates progression mechanics

### 7. **Premium Features (Optional)**
- Show the Gem Shop or premium store
- Display IAP offerings tastefully
- **Why**: Required if highlighting IAP features

### 8. **Achievements or Goals**
- Show achievements screen
- Display completed and upcoming goals
- **Why**: Demonstrates long-term engagement

## 🛠️ How to Capture Screenshots

### Method 1: Using iOS Simulator (Recommended)

1. **Open Xcode and launch iOS Simulator**:
   ```bash
   # In your project directory
   npx expo run:ios
   ```

2. **Select the correct device**:
   - Go to Simulator menu → Device → iOS 17.0 or later
   - Choose: **iPhone 14 Plus** or **iPhone 13 Pro Max**

3. **Play through your app**:
   - Create a new character or load an existing save
   - Navigate to each screen you want to capture
   - Ensure data looks realistic (not all zeros)

4. **Capture screenshots**:
   - Press `Cmd + S` in the Simulator
   - OR: Go to File → Save Screen
   - Screenshots save to your Desktop by default

5. **Verify resolution**:
   - Right-click screenshot → Get Info
   - Confirm it's **1284 x 2778 pixels** or **2778 x 1284 pixels**

### Method 2: Using a Physical Device

1. **Install your app** on an iPhone 13 Pro Max, 14 Plus, or similar 6.5" device

2. **Capture screenshots**:
   - Press **Volume Up + Side Button** simultaneously
   - Screenshots save to Photos app

3. **Transfer to computer**:
   - Use AirDrop, iCloud Photos, or cable transfer
   - Verify resolution is correct

### Method 3: Using TestFlight

1. **Upload your build to TestFlight**:
   ```bash
   eas build --platform ios --profile production
   ```

2. **Install on a 6.5" iPhone** via TestFlight

3. **Capture and transfer** as in Method 2

## 📐 Screenshot Quality Checklist

Before uploading, verify each screenshot:

- [ ] **Correct resolution**: 1284 x 2778 pixels (portrait) for 6.5" devices
- [ ] **No personal info**: Remove any test data with real names/emails
- [ ] **Realistic data**: Stats and values look like actual gameplay
- [ ] **Clear and focused**: UI is sharp, not blurry
- [ ] **No debug info**: Remove any developer overlays or logs
- [ ] **Consistent theme**: All screenshots use same theme (light/dark mode)
- [ ] **No status bar issues**: Time shows realistic time (10:00 or 2:30)
- [ ] **Portrait orientation**: Unless your app supports landscape
- [ ] **App in use**: Showing actual functionality, not splash screens

## 📤 Uploading to App Store Connect

### Step 1: Access App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Sign in with your Apple Developer account
3. Navigate to **My Apps** → Select **DeepLife Simulator**

### Step 2: Navigate to Screenshots Section

1. Click on your app version (e.g., "1.9.0 Prepare for Submission")
2. Scroll to **App Previews and Screenshots**
3. You'll see device size options:
   - 6.5" Display
   - 5.5" Display  
   - iPad Pro (12.9-inch)

### Step 3: Upload 6.5" Screenshots

1. Click on **6.5" Display** section
2. Click **"Media Manager"** if you need to manage multiple device sizes
3. Or drag and drop screenshots directly

4. **Upload your 5-10 screenshots**:
   - Drag and drop PNG files
   - Order matters: First screenshot is primary
   - You can reorder by dragging

5. **Add captions (optional but recommended)**:
   - Screenshot 1: "Create your character and live your dream life"
   - Screenshot 2: "Choose from dozens of careers and jobs"
   - Screenshot 3: "Make life decisions that matter"
   - Screenshot 4: "Build wealth and buy luxury items"
   - Screenshot 5: "Track your achievements and progress"

### Step 4: Verify Other Device Sizes

1. Click **"View All Sizes in Media Manager"** (important!)
2. This shows you all device size requirements
3. Upload screenshots for each size class:
   - 6.5" Display (PRIMARY - what Apple flagged)
   - 5.5" Display
   - iPad sizes (if applicable)

### Step 5: Localization (if applicable)

If your app supports multiple languages:
1. Click the language dropdown (top right)
2. Select each language
3. Upload localized screenshots for each
4. **Important**: Screenshots must be identical to the app in that language

### Step 6: Save and Submit

1. Click **Save** in the top-right corner
2. Scroll to the bottom of the page
3. Review all information
4. Click **"Add for Review"** if all IAP products are ready
5. Click **"Submit for Review"**

## 🎨 Pro Tips for Great Screenshots

### Make Your App Look Good

1. **Use realistic data**:
   ```javascript
   // In development, create a "demo" account with:
   - Character name: "Alex Johnson"
   - Age: 25
   - Money: $45,000
   - Job: "Software Developer"
   - Some owned items
   ```

2. **Fill the screen**:
   - Don't show mostly empty lists
   - Show actual content, not placeholder text
   - Display progress bars partially filled

3. **Show success states**:
   - Character has made progress
   - Some achievements unlocked
   - Positive stats (not all red/warning states)

4. **Consistent aesthetic**:
   - All screenshots in same theme
   - Same time of day (if app has day/night)
   - Similar UI state (same gems count, etc.)

### Common Mistakes to Avoid

❌ **Don't**:
- Use marketing graphics that cover the app UI
- Show only splash screens or login screens
- Include debug information or "Lorem ipsum" text
- Use screenshots from an older version
- Show test data like "Test User" or "000-000-0000"
- Include copyrighted content (unless licensed)

✅ **Do**:
- Show actual app functionality
- Use realistic, engaging content
- Highlight unique features
- Keep UI clean and professional
- Match the exact current app build

## 🔍 Verifying Your Screenshots

Before submitting, check:

1. **Open each screenshot** and compare with your live app
2. **Verify versions match**: 
   - Check version number if visible in UI
   - Ensure features shown are in current build
3. **Test on device**: Run your app on a 6.5" device and compare
4. **Get a second opinion**: Have someone else review screenshots

## 📱 Device Specific Notes

### iPhone 14 Plus / 13 Pro Max (6.5" Display)
- **Why this matters**: Apple specifically flagged this size
- **Safe Area**: Account for notch/Dynamic Island
- **Aspect Ratio**: 19.5:9
- **Best practice**: Capture on these exact devices if possible

### If You Don't Have the Device

Don't worry! The iOS Simulator is perfectly acceptable:
1. Simulator screenshots are pixel-perfect
2. Apple accepts simulator screenshots
3. Make sure to select the right device model in Xcode
4. Screenshots will have correct resolution automatically

## 🆘 Troubleshooting

### "Screenshot is wrong size"
- **Solution**: Verify you're using iPhone 14 Plus or 13 Pro Max simulator
- Check image info (right-click → Get Info) shows 1284 x 2778

### "Screenshots don't match the app"
- **Solution**: Capture new screenshots from your latest build
- Verify app version in app.json matches submitted build

### "Can't find Media Manager"
- **Solution**: In App Store Connect, look for "View All Sizes in Media Manager" link
- It's near the screenshot upload section

### "Screenshot upload fails"
- **Solution**: 
  - Ensure file is PNG format
  - Check file size < 30MB
  - Verify correct dimensions
  - Try different browser (Safari recommended)

## 📋 Pre-Submission Checklist

Before clicking "Submit for Review":

- [ ] Uploaded 5-10 screenshots for 6.5" Display
- [ ] Uploaded screenshots for 5.5" Display  
- [ ] Uploaded iPad screenshots (if supporting iPad)
- [ ] All screenshots show current app version
- [ ] No marketing graphics obscuring app UI
- [ ] Screenshots show core gameplay/functionality
- [ ] All device sizes have appropriate screenshots
- [ ] Localized screenshots match app in each language
- [ ] App description mentions key features shown in screenshots
- [ ] Review notes mention screenshot update

## 📝 Review Notes Template

When submitting, add this to your "App Review Information" → "Notes":

```
Thank you for your previous feedback. We have updated all screenshots to reflect 
the current version of the app (v1.9.0).

Changes in this version:
- Updated 6.5" iPhone screenshots with current app UI
- Fixed IAP receipt validation for sandbox testing
- Added Restore Purchases buttons to all shop screens per Guideline 3.1.1

All screenshots now accurately show the app's core features:
- Life simulation gameplay
- Career and financial management
- Character customization and progression
- In-app purchase offerings

Please let us know if you need any additional information.
```

## 🎉 Success Criteria

You'll know your screenshots are ready when:

✅ Each screenshot clearly shows a different app feature
✅ UI matches your current app build exactly
✅ No placeholder or test data visible
✅ All required device sizes uploaded
✅ Screenshots show engaging, realistic gameplay
✅ No Apple review feedback about screenshots

## 📚 Additional Resources

- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Screenshot Specifications](https://help.apple.com/app-store-connect/#/devd274dd925)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

## 🔄 After Approval

Once approved:
1. Monitor user reviews for screenshot accuracy feedback
2. Update screenshots with each major version
3. Consider adding app previews (videos) in future updates
4. Keep screenshots current with new features

---

**Need Help?** If you encounter issues during screenshot capture or upload, refer to Apple's [Screenshot Specifications](https://help.apple.com/app-store-connect/#/devd274dd925) or contact Apple Developer Support.

**Version**: 1.0  
**Last Updated**: November 6, 2025  
**App Version**: 1.9.0

