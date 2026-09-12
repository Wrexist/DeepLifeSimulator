# Summary

<!-- 1-3 sentences. What changed and why. -->

## Player update notes

<!-- Optional: bullet points here are published to Discord after merge.
Write short, playful, factual notes about what players can do or experience.
No PR titles, GitHub links, test counts or implementation details. Leave empty
for tooling-only work. Describe upcoming changes, never imply a merge is live.
Example: - Your next chapter has a direction: jump straight to your next goal when you return.
-->

## Risk

<!-- Mark all that apply. Anything checked here needs extra verification. -->

- [ ] Touches `app/` (router-loaded screens) — **MUST** run `npm test -- __tests__/startup`
- [ ] Touches `app/_layout.tsx` or `app/entry.ts` — verify with a TestFlight build before merging
- [ ] Touches `contexts/game/` (state/provider/actions) — run full stress test suite (`npm test -- __tests__/stress`)
- [ ] Touches `utils/saveValidation.ts`, `utils/saveQueue.ts`, `utils/saveBackup.ts`, or `contexts/game/initialState.ts` — run save-system tests
- [ ] Touches `services/IAPService.ts` or `services/AdMobService.ts` — verify with the relevant SDK in a TestFlight build
- [ ] Adds or modifies a native module dependency — verify `app.config.js` plugin entry matches `package.json`
- [ ] Touches `.github/workflows/*.yml` — parse locally and confirm in GitHub's Actions tab
- [ ] Touches `.env`, `eas.json`, or any secret-bearing config — confirm no secret values committed
- [ ] Uses `React.lazy()` or `import()` inside a screen file — high risk of Hermes minification crash (see R6 lesson)

## Verification done locally

<!-- Tick all that pass. Anything red here blocks the PR. -->

- [ ] `npm run type-check` — 0 errors
- [ ] `npm test -- __tests__/startup` — all green
- [ ] `npm run lint` — no new warnings
- [ ] `npm run preflight` (if shipping to TestFlight) — all sections green
- [ ] Manual smoke test on at least one device/sim if UI changed

## Notes for reviewer

<!-- Things to look at carefully. Trade-offs. Follow-ups not in this PR. -->
