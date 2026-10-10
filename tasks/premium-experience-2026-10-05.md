# Premium experience: what to borrow from two references - 2026-10-05

Target release: **2.16.0** (the next one). The 2.15.1 (190) candidate is frozen for R06/R09, so none of this goes into it.

## The references, broken down

**A. Habit XP onboarding** ([@Designer_Elo](https://x.com/Designer_Elo/status/2105962245075370025), 19 s video, 4 screens)
1. Dark navy backdrop with one soft radial glow behind the hero. Nothing else on the screen competes.
2. The hero object **animates its own value**: a level ring sweeps and counts `LVL 0 → 24`; a pentagon badge counts `67 → 100`, then a laurel and a "100 day streak" chip land.
3. A task card slides up and **checks itself off** (`Morning Workout +180 XP ✓`). This is the core loop shown, not described.
4. A podium where three avatars rise on columns 2 / 1 / 3, with "You" on top.
5. Every screen is the same frame: hero, a thin divider tick, a two-line bold headline, one grey subline, one white pill CTA. Big type, minimal copy.
6. Back-navigation reverses the motion, so the hero slides out sideways. It feels like one continuous object.

**B. Milestone sheet** ([@samuel_yostt](https://x.com/samuel_yostt/status/2104275038757368203), made with the [`/3dicon`](https://github.com/samyost1/3dicon) skill)
1. One **glossy, looping, transparent 3D icon** (fire) is the emotional anchor.
2. A **huge ordinal number** with a coloured superscript ("30th").
3. A plain noun line ("fast finished"), then a playful accent line in the brand colour ("You cooked 🔥").
4. **Three stats in one strip**: this time / all time / count.
5. One dark pill CTA that keeps you in the loop ("Keep going"), not "Close".

The shared lesson: **one moment = one object + one number + one sentence + one button**, and the object moves.

## Where the game is today (scan, 2026-10-05)

- Motion: React Native `Animated` + `react-native-svg` + gradients + `expo-blur` + `utils/haptics.ts`. No Reanimated/Lottie/Skia/expo-image.
- Shared parts already there: `components/ui/ProgressRing.tsx` (animated SVG ring), `components/ui/ConfettiBurst.tsx`, `hooks/useReducedMotion.ts`, `hooks/useOnboardingScreenAnimation.ts` (built, **used by no screen**), `components/anim/*`.
- **No count-up component.** `AnimatedMoney` deliberately removed its count-up (it pops instead).
- Celebrations are uneven. `PromotionCelebrationModal` and `PrestigeModal` are rich. `DailyRewardPopup`, `CommunityRewardPopup`, `AchievementToast`, `WeddingPopup`, `AdRewardOrb` and `CureSuccessModal` don't check reduced motion, and **purchase success is a plain `gameAlert`**.
- No chapter-complete moment (`LifeChapterCard` is static). The play streak is a text line inside `WelcomeBackPopup`/`LastWeekRecap`.
- Streak/level/gem icons are lucide line icons. There is no 3D art for them, though there is a working Three.js render pipeline in `art/game-assets-v1/` and a WebP pipeline.
- Leaderboard exists only on the backend (`lib/progress/cloud.ts`). No UI.
- Onboarding is 5 screens (MainMenu, SaveSlots, Scenarios, Customize, Perks), all forms/pickers. Nothing **shows** the game before you play it.

## Opportunities, ranked by impact ÷ effort

| # | Idea | Reference | Where in the game | Effort |
|---|---|---|---|---|
| 1 | **One `MilestoneSheet` component**: 3D icon + huge ordinal + noun line + accent line + 3-stat strip + "Keep going" pill. Then route existing moments through it | B | Promotion, chapter complete (new), streak days, Nth week survived, first $1k/$100k/$1M, wedding, child born, purchase success | M |
| 2 | **Purchase success becomes a moment**, not an alert: gem icon + "+500 gems" + balance strip | B | `GemShopModal.tsx:374-448` | S (after #1) |
| 3 | **`CountUp` primitive** for celebrations only (not the HUD, where the pop is deliberate) | A | Milestone numbers, level/rank, prestige points, net-worth milestones | S |
| 4 | **Streak gets an identity**: 3D fire icon + "Nth day" sheet when the daily play streak ticks | B | `WelcomeBackPopup`, `LastWeekRecap` | S (after #1) |
| 5 | **Chapter complete** gets a real moment (badge counting up, laurel lands) | A | `LifeChapterCard` / `lib/progress/lifeChapters.ts` | M |
| 6 | **"Show, don't tell" intro**: 3 screens before Scenarios that play the loop (money ring fills, a job card checks off "+$420", an heir inherits) with one headline + one CTA each | A | New, between MainMenu → Scenarios, built on the unused `useOnboardingScreenAnimation` | M |
| 7 | **Consistent celebration frame**: same glow backdrop, type scale, pill CTA and reduced-motion handling across all popups | A+B | The 6 popups listed above | M |
| 8 | **Family / dynasty podium** (not a global leaderboard): your generations on columns, rising by net worth | A | Prestige / Dynasty screen | M–L |

Not recommended now: a global leaderboard UI (backend exists, but forgery is open: server-side save signature is unbuilt, see `OPEN-WORK-2026-10-05.md` §3.6), and Reanimated/Skia/Lottie (native deps, new build, and `Animated` already does everything above).

## Technical approach

- **Icons:** static 3D WebP stills animated in code (gentle bob + glow pulse + scale-in) via `Animated`, native driver. Zero new native dependencies, works on both platforms, honours reduced motion (static still).
  - Truly looping animated WebP (the `/3dicon` look) needs `expo-image` or Fresco animated-WebP on Android, i.e. a native dependency and a new binary. Make that a separate decision after #1 ships.
- **Size budget:** shipped images are 17.9 MB against a 45 MB ratchet. Each icon at 512×512 WebP is ~30–60 KB.
- **Reduced motion:** every new piece reads `useReducedMotion`. Count-ups jump to the final value; icons stay still.
- **Haptics:** one success haptic when the number lands, through `utils/haptics.ts`.
- **Type:** the huge number uses the existing typography scale, no raw `fontSize` (UI ratchet: raw fontSize 94 → 0, heavy weights 645 → 540, so don't add new ones).
- Hard Rule #7: no side accent bars. Full borders or tinted backgrounds only.

## Asset list (3D icons)

Style lock for every icon, matching reference B: *glossy soft-plastic 3D, rounded chunky forms, warm studio light from top-left, soft inner glow, no outline, centered, 3/4 front view, transparent background, 1024×1024, no text*.

| Icon | Used by | Prompt core (prepend the style lock) |
|---|---|---|
| Flame | Play streak | a cartoon flame, red outer, orange-yellow core |
| Gem stack | Purchase success, gem wallet | three faceted blue-violet gems, one large in front |
| Trophy | Chapter complete, achievements | a short gold trophy cup with two handles |
| Briefcase + up-arrow | Promotion | a brown leather briefcase with a small green up-arrow badge |
| Money bag | Net-worth milestones | a green money sack tied with gold rope, a "$" embossed (no text glyphs elsewhere) |
| House + key | First home | a small cozy house with a gold key leaning against it |
| Rings | Wedding | two interlocked gold rings with a small diamond |
| Baby rattle | Child born | a pastel baby rattle |
| Crown | Prestige / heir | a gold crown with three rounded points and red gems |
| Heart | Relationships | a glossy red heart, slightly tilted |

**Pipeline:** generate in GPT-6 Astra (owner-run; nothing in this session can call it), or with the existing `art/game-assets-v1` Three.js pipeline as a fallback. Then put masters in `art/game-assets-v1/`, convert with `scripts/convert-assets-to-webp.js` to 512 px WebP in `assets/images/milestones/`, and record hashes in the manifest like the work art.

## Plan

- [ ] 1. Owner: generate the 10 icons (Astra or fallback) and drop PNG masters into `art/game-assets-v1/milestones/` (~30-60 min)
- [ ] 2. `components/ui/CountUp.tsx` + tests (reduced motion = final value, no count-up in HUD)
- [ ] 3. `components/celebration/MilestoneSheet.tsx` + `MilestoneIcon` (bob/glow/scale-in, reduced-motion still) + render tests
- [ ] 4. Route purchase success (#2) and play streak (#4) through it
- [ ] 5. Chapter-complete moment (#5)
- [ ] 6. Bring the 6 un-themed popups onto the shared frame + reduced motion (#7)
- [ ] 7. Intro "show, don't tell" screens (#6): needs owner sign-off on copy
- [ ] 8. Before/after captures at 375 / 768, then device check on the 2.16.0 build

Sources: [Habit XP onboarding](https://x.com/Designer_Elo/status/2105962245075370025) · [fire milestone sheet](https://x.com/samuel_yostt/status/2104275038757368203) · [/3dicon skill](https://github.com/samyost1/3dicon) · [GPT-6 Astra overview](https://www.mindstudio.ai/blog/gpt6-astra-release-overview) · [Astra image-to-3d](https://wavespeed.ai/models/openai/gpt-6-astra/image-to-3d)
