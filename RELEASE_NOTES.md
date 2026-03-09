# Deep Life Simulator - Update Release Notes

## Version 2.3.0 - Stability, Purchase Fixes & Major Bug Sweep

**Release Date**: March 2026
**Build**: 94
**Compatibility**: All existing saves compatible - no breaking changes

---

## 🛒 In-App Purchase Overhaul

We've done a comprehensive audit and fix of the entire purchase system to make sure every dollar you spend is properly applied:

- **Purchase Safety**: Purchases are now fully applied to your account before being marked as consumed with Apple — no more risk of losing a purchase if the app closes at the wrong moment
- **Perk Effects Fixed**: IAP perks (Work Boost, Fast Learner, Mindset, Good Credit) now properly apply their bonuses in-game. A naming mismatch was preventing purchased perks from having any effect — this is now fixed
- **Restore Purchases Improved**: You'll now get clear feedback if a restore fails, instead of silent failure
- **Ad Removal Reliable**: The "Remove Ads" purchase now consistently hides all ads across the entire app
- **Work Boost Preserved**: Work Boost is now correctly saved as a permanent purchase — it won't disappear after reinstalling
- **All Perks Bundle**: The unlock-all-perks bundle now properly persists all individual perk flags

---

## 🔧 Massive Bug Sweep (70+ Fixes)

### Save System Hardening
- Fixed 4 missing default values that could cause save corruption on older saves
- Cloud sync now validates data integrity on download — corrupted cloud saves won't overwrite your good local save
- Fixed stale closure bugs in cloud sync that could cause sync to silently fail
- Save migration properly backfills new fields for older save files

### Economy & Finance Fixes
- Stock purchases now correctly apply transaction fees
- Vehicle selling has a proper minimum price floor
- Dividend fees are now consistent across all code paths
- Rent income rate unified across the entire codebase (was using 3 different rates!)
- Stock symbols now handle case correctly — no more "phantom stocks" from mixed capitalization
- Company upgrade calculations fixed for stale state issues
- Loan system guards against edge cases

### Stability Improvements
- Fixed AdMob crash on startup (missing native configuration)
- Fixed ErrorBoundary null access crash
- Fixed crash recovery validation
- Removed duplicate exception handler that could mask real errors
- 20+ TypeScript type safety improvements across the codebase

---

## 🎲 Fairness Improvements

### Guaranteed Success Systems
- **Having Children**: After 15 attempts, success is guaranteed
- **Marriage Proposals**: At 95%+ relationship, proposals always succeed
- **Job Applications**: Perfect qualifications guarantee acceptance after 3 attempts
- **Weekly Events**: Guaranteed event after 6 weeks without any events
- **Disease Cooldown**: Maximum 1 disease per 4 weeks

---

## 💔 Relationship Consequences

Relationships now have real consequences for neglect:
- **Partners**: Will break up after 8 weeks at relationship score ≤ 10
- **Spouses**: Will file for divorce after 12 weeks at score ≤ 15
  - Includes financial settlement (20-30% of your money)
  - Lawyer fees and reputation/happiness penalties

---

## ⚡ Performance

- 90% faster video/stream income calculations
- 50% faster family expense calculations
- 80% smaller save files for long playthroughs
- Smoother weekly progression even after 1000+ weeks

---

## 💰 Economy Balance

- Multiple companies now have diminishing returns (4+ companies)
- Gaming/streaming content decays over time (more realistic)
- Reputation decays slowly, requiring active maintenance
- Company upgrade efficiency scales with level

---

## 🐛 Other Fixes

- Updated Discord community link
- Removed dead code and unused signals in purchase system
- Cleaned up banking service unnecessary expiry dates on permanent purchases
- Improved error messages throughout the app

---

## 📊 Summary

This is our biggest stability update yet:

✅ **70+ bugs fixed** across saves, economy, purchases, and state management
✅ **Purchase system overhauled** — every IAP now works correctly
✅ **Crash fixes** — resolved startup crashes and edge case crashes
✅ **Fairness** — pity systems prevent infinite failures
✅ **Consequences** — relationships feel meaningful
✅ **Performance** — faster gameplay, smaller saves

All changes are **backward compatible** — your existing saves will work perfectly!

---

Thank you for playing Deep Life Simulator! Join our Discord community to share feedback and suggestions.
