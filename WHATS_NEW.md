# What's New — DeepLife Simulator

## v2.5.0 — Stability, Speed & Fair-Play Update

**Covers:** everything new since **v2.3.1 (build 93)** — the last public release.
**Compatibility:** all existing saves load with no breaking changes.

> Versioning note: this is labeled **v2.5.0** to match the current app version in
> `package.json`/`app.config.js`. If the store build should carry a different number, change
> only the heading above.

---

## 📱 Store "What's New" (copy-paste ready)

```
v2.5.0 — Smoother, Faster, Fairer

We kept going after the big stability update. This release is all about polish, speed, and
making sure every purchase and every choice works exactly the way it should.

⚡ Faster Than Ever
• Tapping "Next Week" is now instant — the screen responds immediately
• Money and stats update the moment you act (no more waiting modal)
• The new-life / perk / scenario menus open instantly

🛒 Purchases That Just Work
• Fixed the Premium Pack money boost that wasn't applying — paid perks now work
• Every perk reliably applies and sticks after reinstalls
• "Remove Ads" is respected instantly — no more ad flash for supporters

🛡️ Rock-Solid Stability
• Fixed rare duplicate deaths, duplicate notifications, and hidden errors in the weekly update
• Fixed "NaN" stats that could appear with lots of vehicles or diseases
• Fixed a jail freeze and cleaned up the jail screen
• Smoother, friendlier loading screen and better bug reporting

⚖️ Fair Play
• Crime XP is now counted correctly — getting caught no longer rewards you
• Closed money exploits and added a live "money can't appear from nowhere" safety net
• Weekly bonuses respect the money cap and count toward your real lifetime total

♿ Polish
• More readable text in light mode (WCAG-AA contrast)
• Reduced-motion support for a calmer experience

Plus everything from the big v2.3.x stability update: 70+ fixes, the fairness system
(guaranteed kids/marriage/jobs), real relationship consequences, and major performance gains.

Thank you for playing and sharing feedback.
Join the community: https://discord.gg/rzktazdX8v
```

---

## 📋 Full Release Notes

Everything below is **new since v2.3.1 (build 93)**.

### ⚡ Performance — the game feels instant now

- **Instant week-advance** — tapping *Next Week* now updates the UI immediately and defers the
  heavy weekly calculation, so there's no perceptible lag.
- **Instant money & stat display** — your balance and stats change the moment you take an action,
  and the intrusive blue action modal that interrupted play has been removed.
- **Instant pre-game menus** — the life-path, perk, and scenario selection screens open and toggle
  instantly (deferred loading, memoized cards, press feedback, narrowed theme subscriptions).
- Memoized the heavy filters on the Work screen to cut re-render churn.

### 🛒 In-App Purchases & Perks

- **Premium Pack money multiplier now works** — it was writing to the wrong field, so the paid
  income boost did nothing in-game. It now correctly applies your multiplier.
- **One unified purchase-apply path** — three separate code paths used to apply entitlements, which
  is how perks drifted out of sync. They're now consolidated into a single helper, so every perk
  applies and persists consistently (and survives reinstalls).
- **No more ad flash for supporters** — if you've purchased *Remove Ads*, the banner now honors that
  entitlement immediately on launch instead of briefly flashing an ad.

### 🛡️ Stability & Crash Fixes

- **Fixed duplicate weekly outcomes** — a deep fix to the weekly update means events, deaths,
  notifications, and errors are computed once and atomically. This resolves rare **double deaths,
  duplicate toast notifications, and silently swallowed errors**.
- **Fixed "NaN" stats** — owning many vehicles or catching multiple diseases in a week could index
  out of bounds and permanently poison your health/stats with `NaN`. Indexing is now bounds-safe.
- **Null-relationship guard** — a missing or malformed relationship can no longer crash the weekly
  update.
- **Purchase init no longer hangs** — the in-app-purchase service used to spin forever if it failed
  to initialize; it now times out gracefully (15s) and continues.
- **Jail fixes** — resolved a jail soft-lock freeze, fixed the jail screen layout/safe-area/labels,
  and improved its performance.
- **Friendlier loading screen** — revamped visuals, removed the alarming warning-triangle banners,
  and improved the in-app bug-report flow.

### ⚖️ Economy & Fair Play (anti-exploit)

- **Crime XP counted correctly** — criminal and crime-skill XP is now granted atomically and only
  when you succeed. Getting **caught no longer rewards you**, and rapid double-taps can't double-grant.
- **Energy re-checked on action** — a fast double-tap can no longer run two jobs on a single point of
  energy; the second tap correctly no-ops.
- **Money ceiling enforced everywhere** — weekly lucky/streak bonuses now respect the money cap and
  count properly toward your lifetime earnings (previously they could bypass both).
- **Honest earnings tracking** — batch transactions are now classified per-item, so only genuine
  income counts toward "earn $X" goals.
- **Death guards on finances** — a deceased player can no longer trade stocks/crypto or move money
  through banking and the dark web.
- **Credit-score integrity** — tampered/out-of-range credit scores are clamped back to the real
  FICO range (300–850) when a save is repaired.
- **Money-conservation safety net** — added a live invariant test that fails the build if money can
  appear from or vanish into nowhere, catching economy bugs before they ship.
- Additional balance fixes: perk income cap, dark-web jail guard, and corrected terminal-disease text.

### ♿ Polish & Accessibility

- **Light-mode contrast** now meets **WCAG-AA**, making text far more readable in light theme.
- **Reduced-motion support** — a shared hook honors the system "reduce motion" setting across
  animated components for a calmer experience.
- Removed dead/unused components for a leaner app.

### 🔧 Under the Hood (quality & safety)

- **Crash-on-launch safety net** — a new automated UI test suite mounts all **7 in-game tabs** plus
  the onboarding flow and key components, catching the class of startup crashes that used to only
  appear in TestFlight.
- **Save-durability stress tests** for very long lifetimes.
- **Type-safety hardening** — eliminated all unsafe `as any` casts in gameplay/state code, closing a
  class of silent bugs.
- **Production ad-config hardened** — the app will never fall back to placeholder/test ad IDs in a
  production build.
- Centralized time constants and extracted large stylesheets for maintainability.

---

## 🧱 Also includes — the v2.3.x Stability Update (cumulative recap)

For players coming from an older version, this build also contains the major stability update:

**Major Fixes**
- 70+ bug fixes across the game
- Save system improved to prevent data corruption
- Purchase system fixed so all perks apply correctly
- Startup crashes and rare edge cases resolved

**Fairness Improvements**
- Children guaranteed after 15 attempts
- Marriage proposals succeed at 95%+ relationship
- Job applications succeed with perfect qualifications
- Weekly events guaranteed after 6 weeks without events
- Disease frequency reduced (max 1 every 4 weeks)

**Relationships Matter**
- Partners may leave after long neglect
- Divorce can happen after extended neglect
- Financial outcomes are now more realistic

**Performance Boost**
- Income calculations up to 90% faster
- Family expenses 50% faster
- Save files reduced by up to 80%
- Much smoother gameplay in very long lifetimes

---

Thank you for playing and sharing feedback.

**Join the community:** https://discord.gg/rzktazdX8v
