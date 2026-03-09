# Lessons Learned

<!-- Updated after every correction. Reviewed at the start of each session. -->

## Patterns to Watch For

### 2026-03-09 - Device Classifier Drift (iPhone Pro Max vs iPad)

- What went wrong: `isIPad()` used a height-only threshold (`height > 926`), so newer/taller Pro Max iPhones were treated as iPads.
- Pattern: height-only platform classification breaks as new phone form factors exceed older limits.
- Rule: use shortest-side tablet detection (`Math.min(width, height) >= 768`) for iPad checks, and derive iPhone checks from `!isIPad()` instead of hardcoded height caps.
