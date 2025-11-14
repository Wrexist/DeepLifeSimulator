# DeeplifeSim

A comprehensive life simulation game with career progression, underground economy, skill trees, and social interactions.

## Recent Updates (Latest)

### Underground Economy & Skill Trees
- **Complete Street Jobs System**: Added 9 underground jobs with progression from beginner to expert level
- **Talent Trees**: Implemented skill trees for Stealth, Technology, and Lockpicking with unlockable talents
- **Talent Bonuses**: Each talent provides +5% success rate and +10% payment bonus for related jobs
- **Underground Skills**: Stealth, Technology, and Lockpicking skills that level up through activities
- **Special Items**: Added items purchasable with BTC that unlock higher-tier jobs

### Underground Jobs Progression
1. **Beginner (Level 1)**: Find Lost Items - $35, no requirements
2. **Basic (Level 1)**: Street Hustle, Network Testing, Street Vending - requires special items
3. **Intermediate (Level 2)**: Property Acquisition, Security Testing, Vehicle Relocation - requires items + level
4. **Expert (Level 3)**: High-Stakes Scheme - $5000, requires advanced tools + level 3

### UI/UX Improvements
- **Compact Skills Display**: Reduced skills section height by 50% for better navigation
- **Street Jobs Visibility**: Fixed street jobs not showing in new games
- **Save Slot Management**: Fixed save slot deletion and navigation issues
- **Talent Tree UI**: Interactive talent trees with visual connections and unlock requirements

### Game State Management
- **New Game Creation**: Fixed street jobs not appearing in new games via onboarding
- **Save Migration**: Added automatic migration for missing street jobs, skills, and special items
- **State Validation**: Enhanced game state validation and error handling

### Bug Fixes
- **Computer Data Persistence**: Fixed computer data loss when selling/buying computer
- **Weekly Summary**: Fixed unexpected weekly summary modal appearing during item transactions
- **Street Jobs Loading**: Fixed street jobs not loading in existing save files
- **Save Slot Navigation**: Fixed save slots not updating after deletion or new game creation

## Web Preview

For development and testing, you can preview the app on different device viewports:

```bash
npm run web
```

Then navigate to `http://localhost:19006/preview` (or the port shown by Expo).

### Device Presets
- **iPhone SE (375×667)**: Small iPhone viewport
- **iPhone 15 Pro (393×852)**: Standard iPhone viewport  
- **iPhone 15 Pro Max (430×932)**: Large iPhone viewport
- **iPad 9/10 (768×1024)**: Standard iPad viewport
- **iPad Pro 12.9 (1024×1366)**: Large iPad viewport
- **Desktop 1280**: Standard desktop viewport
- **Desktop 1440**: Large desktop viewport

### URL Parameters
You can also set custom viewport dimensions via URL parameters:
- `?w=393&h=852` - Set custom width and height
- Presets are automatically saved to localStorage and persist across page reloads
- Use the "Reset" button to clear viewport overrides

## Previous Features

- Added passive income utilities for stocks and real estate.
- Introduced inflation system with weekly price index.
- Added social relations with friends and romance influencing happiness.
- Implemented weekly event system with modal choices and logging.
- Introduced animated net worth display, smooth stat bars, and a finance overview.
- Added achievement progress tracking and journal logging.
- Introduced dynamic stock market with weekly simulations and economic events.
- Expanded careers with politician, celebrity, and athlete paths plus new achievements.
- Added cloud-backed leaderboard accessible from Settings.
- Added hobby minigames to train skills via a progression tab.
- Deferred travel system for a future update.

## Cloud Save

Set `EXPO_PUBLIC_CLOUD_SAVE_URL` to point to a backend service. The game will POST to `/save` with the serialized game state and fetch it via GET `/save` to synchronize progress across devices. Leaderboard scores are uploaded via POST `/leaderboard` and can be retrieved with GET `/leaderboard`.
