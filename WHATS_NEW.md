# What's New — DeepLife Simulator

## v2.6.0 — The Economy Update

**Covers:** everything since **v2.5.13**.
**Compatibility:** all existing saves load. Save format moves to v31; the
migration runs automatically on first load and is one-way, so take a backup
before installing if you want to be able to roll back.

> Minor bump rather than a patch: this changes numbers players will feel.

---

## 📱 Store "What's New" (copy-paste ready)

```
The economy update.

• The stock market works. It had a maths bug that pushed every share price
  toward zero over a long life — no matter how well you played. Prices now
  grow over time, riskier stocks pay more on average, and existing portfolios
  that the bug wiped out are restored on first load.
• Wages make sense. Entry-level jobs paid as little as $40/week next to a
  $95,000 apartment. Every career ladder now starts at a livable wage, and no
  job's pay was reduced.
• Bills you cannot afford are no longer forgiven. They become an overdue
  balance that comes out of next week's income and drags your credit score —
  so money finally has stakes.
• Economic policy has teeth. Inflation runs for the first time instead of being
  a number that never moved, so policies you enact now push the cost of starting
  and upgrading a business.
• Rent a place to live. A rental ladder from a shared room up to a penthouse
  lease, and your home now gives you weekly health, happiness and energy.
  Sleeping rough wears you down, so a roof is worth working for — and buying
  still beats renting, because it stops the rent and keeps the benefits.
• Fall behind and you lose the place. Four straight weeks behind on rent and
  your landlord evicts you — with warnings from the second week and a countdown.
  Clearing what you owe resets the clock completely, and eviction stops the rent
  but not the debt.
• Your home finally does what it says. Owned homes listed an energy bonus that
  was never actually paid. It is paid now, and owning helps your health too.
• Work beats hustling. Street jobs paid more per week than a real career, so
  the sensible play was to ignore the job board. Both were rescaled, and your
  first property is a long-term goal again rather than an early purchase.
• Property is an investment, not a printer. Rent used to repay a property in
  under four years; yields are now realistic. Renting a home costs less too.
• The app is 200MB smaller.
• Fixes: the calendar no longer drifts out of step with the month, getting
  arrested can't shorten a sentence, police fines scale with your wealth, and
  a failure in any weekly system can no longer silently eat your whole week.

Also since the last public release:

• DeepLife+ membership, with everything included laid out before you subscribe.
• Purchases now survive prestige — Remove Ads, lifetime premium, gold upgrades
  and unspent youth pills all carry across lives.
• Closed several ways to mint unlimited money and gems, and fixed rewards that
  promised a bonus but delivered nothing.
• The daily gem claim can no longer be farmed by changing your device clock.
• Purchases and restores work correctly on Android.
• Fixed a save-recovery path that could lose the save it was meant to rescue.
• Event chains can no longer get stuck part-way and block later stories.
```

---

## Everything since the last public release

This build covers **v2.5.8 → v2.6.0**. The headline is the economy; the rest is
the fair-play and reliability work that landed alongside it.

| Version | Theme |
|---|---|
| **2.6.0** | The Economy Update — investing, wages, and consequences for money |
| **2.5.13** | Fair play and save safety — purchases survive prestige, exploits closed |
| **2.5.10** | DeepLife+, a fairer daily claim, and a store that behaves |
| **2.5.8** | New main menu and the in-app What's New feed |

### 2.5.13 — Fair play, and saves you can trust

- **Purchases survive prestige.** Remove Ads, lifetime premium, gold upgrades and
  unspent youth pills now carry across lives. Starting a new generation no longer
  resets anything that was paid for.
- **A straight economy.** Several ways to mint unlimited money and gems are
  closed. Luxury items, hobby tournaments and staking now charge what they show,
  and rewards that advertised a bonus but delivered nothing are wired up.
- **Safer saves.** Fixed a recovery path that could lose the save it was meant to
  rescue. Older saves keep loading cleanly, and automatic backups are more
  reliable.
- **Honest numbers.** Family income, property returns and business figures now
  match what actually arrives. Prestige bonuses that were listed but inactive now
  do what the card says.
- **Events that finish.** Event chains can no longer stall part-way and block
  later stories, and anniversaries fire for couples who married as the week
  advanced.

### 2.5.10 — DeepLife+, daily rewards and a cleaner store

- **DeepLife+ membership.** A redesigned in-app membership screen that lays out
  everything included, reachable from the player card, the gem shop and the
  reward sheet, with terms and privacy linked before you subscribe.
- **A fair daily claim.** Changing the device clock can no longer farm the daily
  gem reward, and the claim card fits every screen size.
- **The store, tidied up.** The shop loads reliably instead of hanging on an
  empty screen, and purchases and restores work correctly on Android.
- **Layout polish.** Player card, upsell seals and call-to-action buttons scale
  correctly on small phones, and the What's New feed scrolls to the end.

---

## Coming next

Not in this build — in progress now.

- **Character customization, rebuilt.** Face, hair and style choices that carry
  into the game, a redesigned look-builder with a proper preview, and an
  appearance that stays consistent as your character ages.

---

## The long version

### The stock market was broken, and it was not your fault

Share prices stepped by a random amount each week with no upward pull, which is
mathematically guaranteed to drift toward zero given enough time. Because the
market is seeded from your week count, **every player on every device was on the
same path down**: after ten in-game years the typical share was worth a third of
what you paid, and after forty, several traded at one cent.

Prices now follow a proper growth model with a long-run return in the region of a
real index, and volatile stocks carry a higher expected return than blue chips —
so taking risk is a trade rather than a punishment. If your saved market was
flattened by the old behaviour, loading v2.6.0 reopens it at normal prices. Your
shares and your purchase prices are untouched, so a position the bug destroyed
comes back to roughly where you bought it.

### Careers pay what they should

The senior career ladders were written as real annual salaries divided by 52. The
entry-level ones were not, and had ended up roughly ten times too low — a line
cook earned $2,080 a year while a medical intern earned $88,400. Every
under-scaled ladder was lifted so it starts at a livable wage, keeping its own
shape and its top end. **No job pays less than it did before.**

### Money has stakes now

Rent, tax, tuition and upkeep you could not cover used to quietly vanish. They
now become an **overdue balance**: it is paid off the top of next week's income
before anything else, it costs a one-off late fee on what you missed, and it
drags your credit score while it stands. It never compounds on a week where you
paid what you could, and it can always be cleared by earning — falling behind is
pressure, not a dead save.

### Smaller download

The artwork is re-encoded, taking about 200MB off the install with no visible
change.

---

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
