# DeepLife Simulator — What's Next (Roadmap & Audit Plan) — 2026-06-09

> Forward-looking plan written after 10 rounds of crash/economy/store audits.
> Grounded in **today's** verified state, not stale doc claims.

## Verified current health (run 2026-06-09 on `claude/app-audit-roadmap-f5ukvy`)

| Signal | Result | Notes |
|---|---|---|
| `npx jest --ci` | **2344 passed / 145 suites / 308 snapshots — all green** | Zero failures. |
| `npm run type-check` | **0 errors** | Fully clean — big jump from the 254–328 "cosmetic" baseline the older docs cite. |
| Real-provider 500-week stress | passes, but **~84ms mean / 101ms p95 per weekly tick** and **+318 MB heap over 500 ticks (~0.6 MB/week)** | The launch path is solid; the *long-session* cost is the next frontier. |

**Bottom line:** stability and correctness are no longer the bottleneck. The launch
path is structurally sound (route guards, atomic money paths, signed saves, fail-closed
IAP). The next chapter is **monetization activation, type-safety/architecture debt,
long-session performance, and a real design-system rollout.**

---

## TIER 1 — Release blockers (mostly owner/ops, small code surface)

These gate a *revenue-generating* public release. Code is ready; infrastructure isn't.

1. **IAP is effectively OFF in production until a verify backend exists.** `verifyReceiptWithServer`
   now correctly **fails closed** (`IAPService.ts:278-286`): with no `EXPO_PUBLIC_IAP_VERIFY_URL`,
   *every real purchase is refused*. This is the right security posture, but it means **no one
   can buy anything** until a verification endpoint is deployed.
   - Fastest path: **RevenueCat** (~half a day). Cheapest self-hosted: a Supabase Edge Function /
     Vercel function wrapping Apple `verifyReceipt` + Google `purchases.products.get`.
2. **AdMob still falls back to Google test ad unit IDs** (`AdMobService.ts`) — real app IDs, test
   unit IDs. Set the six `EXPO_PUBLIC_ADMOB_*` env vars or ship zero ad revenue.
3. **`EXPO_PUBLIC_SAVE_HMAC_KEY`** must exist as an EAS secret (only preflight blocker) — and must
   never change post-launch or every existing save invalidates.
4. **Rotate + purge the leaked Google Play service-account key** (history rewrite on `main`, owner-only).
5. **iOS splash screen** not configured in `app.config.js` (Android has it) → blank white launch.

---

## TIER 2 — Architecture & type-safety debt (the "remake/fix" work)

Now that the type baseline is clean, this is the highest-leverage engineering investment.

1. **337 `as any` casts across 139 files** — directly violates Hard Rule #2 ("No `as any`").
   These are where the next class of silent bugs hides (the karma `.totalKarma` typo in Round 10
   was masked by exactly this). Burn them down per-directory with type-check after each batch.
2. **Decompose the mega-files** (maintainability + the re-render story):
   - `app/(tabs)/work.tsx` **4,577 lines** · `contexts/game/GameActionsContext.tsx` **3,182**
     · `contexts/game/types.ts` **2,709** · `SettingsModal.tsx` **1,902** · `DeathPopup.tsx`
     **1,901** · `IdentityCard.tsx` **1,783** · `app/_layout.tsx` **1,413**.
3. **Single `gameState` atom → whole-app re-renders.** The ~84ms mean / 101ms p95 weekly tick is
   partly this. Split context by concern or introduce selector subscriptions so a stat change
   doesn't re-render every tab. This is the root cause behind the perf numbers, not a band-aid.
4. **Make `preflight` blocking in CI** — finally feasible now that type-check is 0 errors. Wire it
   ahead of `eas build --profile production` so a missing secret / test-ad-ID / type regression
   can't silently ship.

---

## TIER 3 — Structural safety nets (force-multipliers, from Round 9 §"highest-value")

Each permanently kills a *class* of the bugs we keep fixing one-by-one:

1. **`applyGemDelta(prev, amount, reason)`** beside `applyMoneyDelta`, with idempotency keys —
   route every gem grant (achievements, prestige, scenario, IAP, rewards) through it. Ends the
   "guard read outside the updater → double-claim" class for good.
2. **Single income ledger** (`incomeThisWeek` fed only by genuine income) — daily challenges,
   achievements, and "earn $X" goals read it. Ends transfer/loan/sale farming permanently.
3. **Money-conservation invariant test** in the stress suite (Σ deltas == end−start) — auto-catches
   future money-printer/sink regressions.
4. **Lint rules**: ban `require()` of internal modules (recurring `any`/`never` degradation source),
   ban new raw hex literals outside theme files, ban new `as any`.

---

## TIER 4 — Long-session performance & memory

The 500-week stress test is the new canary.

1. **Heap grows ~0.6 MB/week** → audit history-array pruning end-to-end. Round 9 P1-8 flagged that
   `pruneSaveData` capped only 5 arrays while `netWorthHistory`, crypto `priceHistory`/`orderHistory`,
   `scandalHistory`, `recentPosts`, `streamHistory`, etc. grow unbounded toward the 4 MB save ceiling.
   Verify every history array now has a cap and the 2nd-pass prune actually lowers them.
2. **Weekly tick latency budget** — set an explicit p95 budget (e.g. <50ms) and profile the tick;
   the context-split in Tier 2.3 is the main lever.

---

## TIER 5 — UX & design system (the "best possible experience" ask)

This is the largest *visible* gap and the most deferred (Phases 4–9 of the onboarding plan).

1. **Liquid Glass design system is an onboarding-only pilot.** `GlassPanel`/`GlassActionButton`/
   `OnboardingGlassHeader` exist *only* under `components/onboarding/`. Meanwhile there are
   **~4,807 raw hex color literals** across `app/` + `components/`.
   - Promote glass primitives (`GlassSurface`, `GlassButton`, `GlassCard`, `GlassSegmentedControl`)
     to a shared `components/ui/glass/` layer backed by `lib/config/theme.ts` semantic tokens
     (`surface/subtle/strong/selected/disabled`), then migrate tab-by-tab with `expo-blur` materials
     + safe fallbacks. Add light/dark + small/large device visual-regression snapshots.
2. **Accessibility pass** — labels/roles on tappable rows (IdentityCard, stat rows); `BaseModal`
   close button was fixed in Round 10, extend that discipline app-wide.
3. **Motion & haptics polish** — staggered entrances, spring CTA feedback, reduced-motion support.

---

## TIER 6 — Product depth & live-ops (months, parallel track)

From the AAA+ roadmap, once Tiers 1–3 land:
- Vertical-slice quality bar: one full life arc with premium UX + narrative + balanced economy.
- Live-ops layer: seasonal content pipeline, narrative event packs, economy telemetry.
- Systemic depth: richer career/relationship/health systems with cross-system consequences.
- Deterministic simulation tests + per-release quality scorecard (retention, stability, economy
  fairness, content freshness, sentiment).

---

## Recommended sequencing

```
Now      → Tier 1.1 (RevenueCat or verify endpoint)  ← unlocks all revenue
Now      → Tier 2.4 (preflight blocking in CI)        ← cheap, prevents regressions
Sprint 1 → Tier 3.1–3.4 (atomic gem helper, income ledger, invariant test, lint rules)
Sprint 1 → Tier 2.1 (as-any burndown, per-directory)
Sprint 2 → Tier 2.2–2.3 (decompose work.tsx + context split) + Tier 4 (memory/perf)
Sprint 3+→ Tier 5 (Liquid Glass rollout) — the big visible UX upgrade
Parallel → Tier 6 (content/live-ops)
```

### Suggested deeper audits to commission next
- **Performance/render audit** focused on the `gameState` atom and the weekly tick hot path.
- **Monetization integration audit** end-to-end once the verify backend is chosen (entitlement
  application, restore, consumable dedup, the still-fragile Time Machine effect).
- **Design-system readiness audit** cataloguing the 4,807 hex literals into a token migration map.
</content>
</invoke>
