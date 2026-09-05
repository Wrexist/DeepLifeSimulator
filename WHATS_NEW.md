# What's New - DeepLife Simulator

## v2.13.0 - The same life every time, and the fixes you photographed

**Covers:** everything since **v2.12.0** (cut 2026-08-30), up to 2026-09-04.
**Compatibility:** every existing save loads. The save format moves from
**v48 to v51** (v49 live-events bookkeeping, v50 the record of milestone
toasts already shown, v51 where you met each person) - all three are
carve-outs, so no existing save is rewritten and nothing is invented.
**Draft:** assembled from the merged pull requests by the 2026-09-04 release
audit; owner to trim before it goes to the store.

---

### Store "What's New" (copy-paste ready)

```text
The same life every time, and the fixes you photographed.

- A calendar that agrees with itself. February is winter again, every
  holiday lands in its real month, and the season card is readable in dark
  mode.
- Bank Pro no longer opens on an empty box, the Apps grid lost its dead
  space, and a meal advertises exactly what it restores.
- One toast per message. Tapping Buy three times no longer stacks three
  identical banners over your stats.
- Meet people without a dating app. The Contacts app introduces someone
  new, and every relationship remembers where it began.
- A partner is a household, not a fortune: their income is shared the way a
  real one is, per week, not per year.
- Happier lives feel different from lonelier ones: happiness gains taper as
  you approach the top, so a full social life and an empty one no longer
  read the same.
- The milestone pop-ups that replayed on every launch are gone for good.
- Live events: a fresh calendar, with rewards that cannot be claimed twice.
```

---

### The detail

**Fixed (from your TestFlight screenshots):** the season label sat one
quarter ahead of the month; Easter, Independence Day and Halloween fired in
the wrong month and Halloween had a one-week window; the holiday card was
white-on-white in dark mode and four holidays had no card at all; Bank Pro's
tab bar inflated to half the screen; the market's food chips advertised the
un-satiated restore; identical toasts stacked; the Apps grid anchored short
labels to tall tiles; DeepMail rendered as a missing icon.

**Fixed (release audit, 2026-09-04):** the death screen counted "years lived"
from the absolute week counter, so a character who died in week one had
"lived 2 years"; the Spark Premium and Verified Pro sheets raised their
"cancel subscription?" confirm from a place iOS cannot present it, so the tap
looked dead; every life of the same starting age drew the same festival
schedule.

**Fixed (bug triage):** mining that paid zero, dead confirm buttons, a
commitment level that could only fall, a marriage that hid the spouse, and the
launch crash the recording named.

**Simulation:** the same life replayed now produces the same life, week for
week, and a life continued from a save matches one played straight through.

**Social:** a tier-1 way to meet people, partner income counted per week,
one person is one record, relationships support happiness as well as drain
it, and a free catch-up is worth less to somebody you already see weekly.

**Economy:** stock drift states the expectation it compounds at, inheritances
arrive once, and Chapter 2 asks for a home.

**Analytics and live ops:** the event taxonomy, funnels and experiment system
are documented in `docs/ANALYTICS.md`; live events run from a published
calendar with per-event caps, an idempotent claim ledger and a weekly budget.


## v2.11.0 - A fairer store, and a clearer deal

**Covers:** everything since **v2.10.0**, up to 2026-08-26.
**Compatibility:** every existing save loads. The save format does **not** move
- it stays at v48. No money, job or progress changes.

---

### Store "What's New" (copy-paste ready)

```text
A fairer store, and a clearer deal.

- Banking upgrades you can finally buy. Premium Credit Card, Financial
  Planning, Business Banking and Private Banking are in the shop, each one
  spelling out exactly what it does to your money.
- Honest prices everywhere. Every price now shows in your own currency,
  including on the death screen, and a free trial is only advertised when you
  can actually claim one.
- Redeem codes go through the App Store. Settings then Redeem Code now opens
  Apple's own redemption sheet.
- Your purchases stay yours. Membership no longer switches off when you open
  the game offline, and rewinding time can no longer wipe something you just
  bought.
- A clearer daily gem screen, and gem info that tells the truth about where
  gems come from and where they carry over.
```

---

### The detail

**Removed:** the in-app promo-code redemption flow. Codes are now issued as App
Store offer codes and validated by Apple, so redeeming one delivers the product
through the normal purchase path.

**Fixed (money-affecting):**
- Restoring purchases could re-bank a spent Revival Pack charge, and on the
  native path could consume an unfulfilled purchase so the store stopped
  redelivering it.
- A DeepLife+ member launching offline could have benefits revoked.
- A lapsed subscription record could be deactivated on a cold start before the
  purchase ledger had loaded.
- Rewinding time charged gems from a stale snapshot and could erase a purchase
  made while the rewind dialog was open.
- A renewal in billing retry is no longer hard-revoked on the exact term day.

**Honesty:** removed a hardcoded "save 17%" claim, made the trial badge
eligibility-aware, localized the Revival Pack price, and corrected the gem
info copy.


## v2.10.0 - Your life tells you what to do next, and the numbers tell you the truth

**Covers:** everything since **v2.9.0** (cut 2026-08-17) up to 2026-08-22.
**Compatibility:** every existing save loads, and the save format does **not**
move - it stays at v46. Nothing about your money, your job or your progress
changes; a lot about what the game *shows* you does.

---

### Store "What's New" (copy-paste ready)

```text
Your life tells you what to do next - and every number finally agrees.

• A card that reads your actual life. It suggests one thing to do now, one
  soon, and one big dream - based on your situation, not a generic list. No
  job, low health, a bill piling up: it notices. Reach one and it says so,
  instead of quietly moving the goalposts.
• See it coming. Graduation, a loan clearing, a baby due, a wedding booked -
  the weeks ahead are visible before they land. A disease that could turn
  fatal is flagged early enough to do something about it.
• Every screen shows the same income. The promotion popup, the job card, the
  career ladder and Cash Flow each did their own maths, so one job could read
  $26K on one screen and $13,000 on another. They all show what you're
  actually paid now - raise, boosts, perks and all.
• Cash Flow shows your whole weekly bill. Luxury upkeep, pet food and app
  subscriptions were always being charged; they just weren't listed. Luxury
  income wasn't either. If you own a collection, expect the number to look
  very different - nothing changed about your money, only about how honestly
  it's reported.
• Political office pay was wrong by 52x. The Politics screen showed the yearly
  salary with "/wk" beside it - President read $100K a week against the $1,923
  it really pays, while the campaign cost next to it was real. Fixed.
• A popup could lock you out of your own save. The wedding celebration could
  run off the bottom of the screen, taking the only button that closes it -
  and the whole game sits behind that button. Four popups had the shape; all
  four scroll now.
• Your save, on your terms. Back it up to the cloud, move it to a new phone
  with a code, or delete it outright - the delete really deletes, leaderboard
  entries included.
• Politician, Celebrity and Athlete are back on the Work tab. A filter bug had
  hidden all three from the only screen that can apply for them.
• Leaving office actually ends. Scandals resolve, lobbyists go home, and a
  failed run at a higher office no longer wrecks the seat you already hold.
• Your contacts are yours. Strengthen a friendship, or remove someone you'd
  rather not see again.
• A weekly deal that actually rotates, with last week and next week shown so
  nothing feels random - and prices that only appear once.
```

---

### What changed, and why

**Direction, not a to-do list.** The new home-screen card reads your real
state - unemployed, sick, in arrears, close to a milestone - and names one
thing for now, one for soon, and one long-range ambition. Reaching a goal is
acknowledged where you are, rather than the target silently sliding up. The
weeks ahead are surfaced the same way: graduation, a loan clearing, a due date,
a wedding, and a disease heading somewhere bad while there is still time to act.

**One salary, computed once.** `Career.levels[].salary` is a *base* rate, and
the weekly tick multiplies it by the raise premium, Work Pay Boost, the
Negotiation/Executive life skills and the DeepLife+ boost. Six screens each
applied a different subset. The arithmetic now lives in one function - and the
tick calls the same one, so a screen that disagrees with the paycheck is no
longer possible.

**The political ladder is stored annual.** Every other career stores weekly pay;
`POLITICAL_CAREER` stores yearly. Three separate screens have now read that
field raw and labelled it "/wk". The conversion has one owner.

**Cash Flow was a subset of the bill.** Three costs the tick charges every week
had no line at all - luxury upkeep (up to $556,820/wk for a full collection),
pet food, and subscription renewals - and luxury yield was missing from the
income side. Student loans and income tax were inside the total with no row, so
the itemisation didn't add up to the figure above it. Every line is now computed
by calling the function belonging to the subsystem that does the charging.

**Expect the collection to look expensive.** For a player with luxury items this
is the most visible change in the release, and it will read as a nerf. It isn't:
that upkeep has always been leaving your account every week. The panel just
stopped omitting it.

**A blocking popup with no way out is a lost save.** The wedding card is bounded
and clips, and its contents measure taller than the bound on an ordinary phone -
so "Continue Your Love Story" rendered off the bottom, and the HUD sits behind
that button. Reported as "won't let me scroll or do anything". Three more popups
had the identical shape (welcome-back, life moments, the tutorial) and are fixed
with it.

**Cloud saves you can actually control.** The erase and transfer endpoints
existed with no way for a player to reach them, which for erasure is the
difference between having a data-deletion path and only claiming one. Settings
now offers backup deletion (leaderboard entries included), and a code to move a
save to a new phone. The transfer sheet says the two things you would otherwise
learn the hard way: the code is a bearer credential, and claiming *copies*
rather than moves, so both phones keep playing and diverge.

**Loose ends from the last release.** Leaving political office now resolves
active scandals and stands the lobbyists down, and losing a bid for a higher
office no longer costs you the seat you hold. Company income is capped per
company rather than by one global pool. The First Week Guide shows on your first
life instead of waiting for a prestige. Prestige no longer carries over dark-web
vendor reviews or lets a claimed achievement pay out twice, and mining rigs can
be sold. The obituary counts the property you owned.

---

## v2.9.0 - New faces, real conversations, nothing left locked

**Covers:** everything since **v2.8.0** (cut 2026-08-11) up to 2026-08-17.
**Compatibility:** every existing save loads. The save format moves **v38 → v45**
in seven steps, all of which run automatically on first load. Nothing needs a
backfill, so no existing value is overwritten - your face, your matches and your
claims are read as they already are.

---

### Store "What's New" (copy-paste ready)

```text
New faces, real conversations, and nothing left locked.

• Character creation, rebuilt. Your face is now built from features you choose
  rather than picked from a gallery of portraits, and it ages with you instead
  of being swapped for a stranger's at each age band. Children look like
  children, and they inherit their parents' features.
• Spark chats are a real conversation. Break the ice, compliment, joke, flirt,
  ask them out for coffee, dinner or something reckless, or ask them to go
  steady. Every match keeps its own rapport, so a relationship is built rather
  than announced - and any match you'd rather not date can become a friend.
• Fixed a trap that could lock you out of the game. Buying a house or a company
  could take away the very app that manages it, and two life chapters asked for
  apps those same chapters were the only way to unlock. Progress only ever goes
  up now.
• Your starting age no longer breaks the early game. Beginner luck, the early
  grace period, the first-month events and the week-count goals were all
  measured against your age instead of your life, so anyone who didn't start at
  18 lost them - and Chapter 1 opened two-thirds done.
• The dark web sells gear. The tool shop had no way in, which left 18 of the 19
  street jobs locked behind tools nobody could buy. Deliveries now hand over the
  item you paid for, and listings rotate instead of freezing for weeks.
• The money you're shown is the money you're charged. Weekly Expenses and the
  Budget tab left out rent, income tax and student loan payments; the Net Worth
  breakdown didn't add up to the Net Worth above it. Both add up now.
• Friends are real. Only your first Spark match could ever become a contact,
  network contacts had no action at all, and neglecting people cost nothing.
  All three are fixed - and a neglected friend can now drift out of your life.
• Six more money fixes: a false "Need $10,000" on family business actions, a
  double-tap that could buy a vehicle twice or duplicate coins in a swap,
  savings with no way to pay into it, buy-outs that added no revenue, ad rewards
  that offered a property millionaire $50, and a poverty scholarship that
  promised free education and delivered respect.
• Faster and clearer. About six seconds off a cold start, a death screen that
  scrolls, food/gym/housing cards that show what they do to each stat, a Life
  Goals list that fits on a page, and a Contacts app that stays smooth in a long
  life.
```

---

### What changed, and why

**Character creation was a gallery, not a creator.** You tapped one of ~12
pre-baked portraits in a 60px strip, and crossing an age band swapped your
character for a different rendered person at the same index - the "my character
turned into someone else" report. Faces are now assembled from illustrator-drawn
modular parts under a fixed key light, so appearance is a set of choices that
ages with the character. The appearance editor was a list of *words* - 28 hair
options each reading "Fro" or "Long Bob"; every shape option now renders your own
face with that one field swapped, so the thumbnail is the answer to "what does
this look like on me".

**Spark's chat was a free-text box wired to a fixed reply pool.** Whatever you
typed, the match answered from a list, nothing about them changed, and there was
no reason to send a second message. It is a short game now: rapport moves on
every move and gates flirting (25), dates (45) and going steady (75), with
per-move cooldowns so the cheapest option can't be tapped ten times. The keyboard
bug went with the text box - there is nothing focusable left on the screen.

**Two ways the game could park you.** A player 52 weeks in reported being unable
to use most phone and PC apps with a save that validated clean. The chapter spine
was circular - chapter 3 wanted a stock or a property while the Stocks and Real
Estate apps unlocked at chapter 3 - and the fallback route read your *current
balance*, so buying a $200k property padlocked the app that manages it. Both now
read a figure that can only go up.

**The starting-age class, found by playing rather than reading.** `weeksLived` is
seeded from the starting age, so an age-25 character begins at 364 and every
"have you played N weeks" check was already true on frame one. That silently
covered the first-month events (unreachable for 7 of 8 scenario ages), beginner
luck, the 8-week decay grace (an age-25 passive life died in week 13 instead of
16), the four week-count achievements, the average-happiness achievement, and
Chapter 1 - which opened at 2/3 complete and paid its per-goal reward for two
things nobody did. All of them now measure weeks into *this life*.

**Dead features hide their own bugs.** The dark web's 20-item tool store had no
call site anywhere in the app, so 18 of 19 street jobs were locked behind tools
nobody could buy. The savings account had three writers and none of them a
deposit, so the piggy bank earned interest on zero for a whole life. The poverty
scholarship's condition read a field nothing ever wrote, and once it could fire,
its "Free education!" choice turned out to grant reputation. Network contacts had
no action, and the favour system they were declared for produced nothing.

**Displays that disagreed with the game.** Weekly Expenses omitted income tax and
student loans and - since the tenancy moved out of the property list - rent, the
largest recurring bill a renting player has. The Net Worth breakdown ran on a
second engine that shaved a 1% fee off every asset and dropped savings goals and
card debt. Ribbon tiers demanded a bigger number than the HUD showed. Each now
reads through the same function the game itself uses.

---

### If v2.8.0 never reached the App Store

2.8.0 was cut on 2026-08-11 and its notes are below. If it was never submitted,
players go straight from 2.7.0 to this build, and the store text should open with
2.8.0's two headline items before the list above:

```text
• Tap Play and you're in a life - no setup screens first, and a guide walks you
  to your first paycheck. Your first year has no banner ads at all.
```

---

## v2.8.0 - A faster start, and a fairer economy

**Covers:** everything since **v2.7.0**.
**Compatibility:** every existing save loads unchanged. The save format stays
at v38 - the version 2.7.0 shipped - so a save made in the pace-picker build
loads here and simply runs at the normal pace.

---

### Store "What's New" (copy-paste ready)

```text
A much faster start, and a fairer economy.

• Tap Play and you're in a life - no setup screens first. Prefer to pick your
  own scenario, name and perks? Custom life is still one tap away.
• A new first-session guide walks you to your first paycheck, one step at a
  time, following what you actually did.
• Your first year now has no banner ads at all.
• Fixed four ways money misbehaved - dark web jobs paying out for free, gym
  sessions and warehouse upgrades that could be taken without paying, and
  vehicle insurance that never ran out.
• Removed the pace picker: choosing how fast to live before you'd played asked
  too much, too early. Every life runs at the original pace again.
```

---

### What changed, and why

**The first session was the problem.** Driven end to end against a real build, a
new player's first three taps produced falling health and happiness, unchanged
money, and nothing else - the core loop, as first presented, was "tap to watch
numbers fall". "New Game" then led to four consecutive screens asking for
decisions about systems the player had not seen. Two taps now reach a life, and
a guide walks them to their first wage.

**Four economy bugs, three of which moved money.** A dark web job paid its full
reward again on a repeat tap without costing energy; a gym session and a
warehouse upgrade could each be taken without paying; a warehouse could pass its
own maximum level or leave a balance below zero; and vehicle insurance, sold as
a six-month policy, never expired - one premium bought permanent cover.

**The pace picker is gone.** It shipped in 2.7.0 and asked players to choose how
fast to live before they had any basis to choose. A save from that build loads
here untouched and runs at the normal pace.

## v2.7.0 - Polish & fixes

**Covers:** everything since **v2.6.0**.
**Compatibility:** every existing save loads unchanged.

---

### Store "What's New" (copy-paste ready)

```
Sharper stories and a lot of small repairs.

• Two storylines that promised drama now follow through instead of quietly
  resolving themselves.
• Sharing a life now actually links to the game, so the friend you send it to
  can install it instead of going looking.
• A pile of fixes under the hood: a cleaner onboarding scroll, steadier
  week-to-week saves, and better reporting so problems get found faster.
```

## v2.6.0 - The Economy Update

**Covers:** everything since **v2.5.13**.
**Compatibility:** all existing saves load. Save format moves to v32; the
migration runs automatically on first load and is one-way, so take a backup
before installing if you want to be able to roll back.

> Minor bump rather than a patch: this changes numbers players will feel.

---

## 📱 Store "What's New" (copy-paste ready)

```
The economy update.

• The stock market works. It had a maths bug that pushed every share price
  toward zero over a long life - no matter how well you played. Prices now
  grow over time, riskier stocks pay more on average, and existing portfolios
  that the bug wiped out are restored on first load.
• Wages make sense. Entry-level jobs paid as little as $40/week next to a
  $95,000 apartment. Every career ladder now starts at a livable wage, and no
  job's pay was reduced.
• Bills you cannot afford are no longer forgiven. They become an overdue
  balance that comes out of next week's income and drags your credit score -
  so money finally has stakes.
• Economic policy has teeth. Inflation runs for the first time instead of being
  a number that never moved, so policies you enact now push the cost of starting
  and upgrading a business.
• Rent a place to live. A rental ladder from a shared room up to a penthouse
  lease, and your home now gives you weekly health, happiness and energy.
  Sleeping rough wears you down, so a roof is worth working for - and buying
  still beats renting, because it stops the rent and keeps the benefits.
• Fall behind and you lose the place. Four straight weeks behind on rent and
  your landlord evicts you - with warnings from the second week and a countdown.
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
• Purchases now survive prestige - Remove Ads, lifetime premium, gold upgrades
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
| **2.6.0** | The Economy Update - investing, wages, and consequences for money |
| **2.5.13** | Fair play and save safety - purchases survive prestige, exploits closed |
| **2.5.10** | DeepLife+, a fairer daily claim, and a store that behaves |
| **2.5.8** | New main menu and the in-app What's New feed |

### 2.5.13 - Fair play, and saves you can trust

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

### 2.5.10 - DeepLife+, daily rewards and a cleaner store

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

Not in this build - in progress now.

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
real index, and volatile stocks carry a higher expected return than blue chips -
so taking risk is a trade rather than a punishment. If your saved market was
flattened by the old behaviour, loading v2.6.0 reopens it at normal prices. Your
shares and your purchase prices are untouched, so a position the bug destroyed
comes back to roughly where you bought it.

### Careers pay what they should

The senior career ladders were written as real annual salaries divided by 52. The
entry-level ones were not, and had ended up roughly ten times too low - a line
cook earned $2,080 a year while a medical intern earned $88,400. Every
under-scaled ladder was lifted so it starts at a livable wage, keeping its own
shape and its top end. **No job pays less than it did before.**

### Money has stakes now

Rent, tax, tuition and upkeep you could not cover used to quietly vanish. They
now become an **overdue balance**: it is paid off the top of next week's income
before anything else, it costs a one-off late fee on what you missed, and it
drags your credit score while it stands. It never compounds on a week where you
paid what you could, and it can always be cleared by earning - falling behind is
pressure, not a dead save.

### Smaller download

The artwork is re-encoded, taking about 200MB off the install with no visible
change.

---

## v2.5.0 - Stability, Speed & Fair-Play Update

**Covers:** everything new since **v2.3.1 (build 93)** - the last public release.
**Compatibility:** all existing saves load with no breaking changes.

> Versioning note: this is labeled **v2.5.0** to match the current app version in
> `package.json`/`app.config.js`. If the store build should carry a different number, change
> only the heading above.

---

## 📱 Store "What's New" (copy-paste ready)

```
v2.5.0 - Smoother, Faster, Fairer

We kept going after the big stability update. This release is all about polish, speed, and
making sure every purchase and every choice works exactly the way it should.

⚡ Faster Than Ever
• Tapping "Next Week" is now instant - the screen responds immediately
• Money and stats update the moment you act (no more waiting modal)
• The new-life / perk / scenario menus open instantly

🛒 Purchases That Just Work
• Fixed the Premium Pack money boost that wasn't applying - paid perks now work
• Every perk reliably applies and sticks after reinstalls
• "Remove Ads" is respected instantly - no more ad flash for supporters

🛡️ Rock-Solid Stability
• Fixed rare duplicate deaths, duplicate notifications, and hidden errors in the weekly update
• Fixed "NaN" stats that could appear with lots of vehicles or diseases
• Fixed a jail freeze and cleaned up the jail screen
• Smoother, friendlier loading screen and better bug reporting

⚖️ Fair Play
• Crime XP is now counted correctly - getting caught no longer rewards you
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

### ⚡ Performance - the game feels instant now

- **Instant week-advance** - tapping *Next Week* now updates the UI immediately and defers the
  heavy weekly calculation, so there's no perceptible lag.
- **Instant money & stat display** - your balance and stats change the moment you take an action,
  and the intrusive blue action modal that interrupted play has been removed.
- **Instant pre-game menus** - the life-path, perk, and scenario selection screens open and toggle
  instantly (deferred loading, memoized cards, press feedback, narrowed theme subscriptions).
- Memoized the heavy filters on the Work screen to cut re-render churn.

### 🛒 In-App Purchases & Perks

- **Premium Pack money multiplier now works** - it was writing to the wrong field, so the paid
  income boost did nothing in-game. It now correctly applies your multiplier.
- **One unified purchase-apply path** - three separate code paths used to apply entitlements, which
  is how perks drifted out of sync. They're now consolidated into a single helper, so every perk
  applies and persists consistently (and survives reinstalls).
- **No more ad flash for supporters** - if you've purchased *Remove Ads*, the banner now honors that
  entitlement immediately on launch instead of briefly flashing an ad.

### 🛡️ Stability & Crash Fixes

- **Fixed duplicate weekly outcomes** - a deep fix to the weekly update means events, deaths,
  notifications, and errors are computed once and atomically. This resolves rare **double deaths,
  duplicate toast notifications, and silently swallowed errors**.
- **Fixed "NaN" stats** - owning many vehicles or catching multiple diseases in a week could index
  out of bounds and permanently poison your health/stats with `NaN`. Indexing is now bounds-safe.
- **Null-relationship guard** - a missing or malformed relationship can no longer crash the weekly
  update.
- **Purchase init no longer hangs** - the in-app-purchase service used to spin forever if it failed
  to initialize; it now times out gracefully (15s) and continues.
- **Jail fixes** - resolved a jail soft-lock freeze, fixed the jail screen layout/safe-area/labels,
  and improved its performance.
- **Friendlier loading screen** - revamped visuals, removed the alarming warning-triangle banners,
  and improved the in-app bug-report flow.

### ⚖️ Economy & Fair Play (anti-exploit)

- **Crime XP counted correctly** - criminal and crime-skill XP is now granted atomically and only
  when you succeed. Getting **caught no longer rewards you**, and rapid double-taps can't double-grant.
- **Energy re-checked on action** - a fast double-tap can no longer run two jobs on a single point of
  energy; the second tap correctly no-ops.
- **Money ceiling enforced everywhere** - weekly lucky/streak bonuses now respect the money cap and
  count properly toward your lifetime earnings (previously they could bypass both).
- **Honest earnings tracking** - batch transactions are now classified per-item, so only genuine
  income counts toward "earn $X" goals.
- **Death guards on finances** - a deceased player can no longer trade stocks/crypto or move money
  through banking and the dark web.
- **Credit-score integrity** - tampered/out-of-range credit scores are clamped back to the real
  FICO range (300–850) when a save is repaired.
- **Money-conservation safety net** - added a live invariant test that fails the build if money can
  appear from or vanish into nowhere, catching economy bugs before they ship.
- Additional balance fixes: perk income cap, dark-web jail guard, and corrected terminal-disease text.

### ♿ Polish & Accessibility

- **Light-mode contrast** now meets **WCAG-AA**, making text far more readable in light theme.
- **Reduced-motion support** - a shared hook honors the system "reduce motion" setting across
  animated components for a calmer experience.
- Removed dead/unused components for a leaner app.

### 🔧 Under the Hood (quality & safety)

- **Crash-on-launch safety net** - a new automated UI test suite mounts all **7 in-game tabs** plus
  the onboarding flow and key components, catching the class of startup crashes that used to only
  appear in TestFlight.
- **Save-durability stress tests** for very long lifetimes.
- **Type-safety hardening** - eliminated all unsafe `as any` casts in gameplay/state code, closing a
  class of silent bugs.
- **Production ad-config hardened** - the app will never fall back to placeholder/test ad IDs in a
  production build.
- Centralized time constants and extracted large stylesheets for maintainability.

---

## 🧱 Also includes - the v2.3.x Stability Update (cumulative recap)

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
