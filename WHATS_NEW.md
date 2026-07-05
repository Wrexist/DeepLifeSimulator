# What's New — DeepLife Simulator

## v2.6.0 — Kids, Weddings & Banking, Fixed

**Covers:** everything new since **v2.5.2** — the last public release.
**Compatibility:** all existing saves load with no breaking changes (a couple of fixes include
one-time save repairs for players affected by the bugs below).

> Versioning note: this is labeled **v2.6.0** given the size of the batch (family, banking, and
> economy all changed). If the store build should carry a different number, change only the
> heading above.

---

## 📱 Store "What's New" (copy-paste ready)

```
v2.6.0 — Kids, Weddings & Banking, Fixed

A big batch of fixes for the issues you reported most — thank you for flagging these.

👶 Family
• "Try for Baby" works again — you can finally have children with your spouse or partner
• Marriage is fixed end-to-end: pick a ring when you propose, plan the wedding, and it now
  actually completes
• Relationships are exclusive again — no more accidentally juggling multiple partners at once,
  and relationship titles now reflect your real stage (Partner → Fiancé(e) → Spouse)

🎲 Life Events & Health
• Weekly life events fire reliably again instead of going quiet for stretches
• Fixed random terminal diagnoses striking too early and stacking unfairly — and critical
  illnesses can now be cured with experimental treatment
• No more blank, empty notification banners

🏦 Banking
• Savings and CDs now actually pay the interest rate they advertise
• Withdraw and close-account buttons work — no more money stuck in an account
• Auto-pay can be paused, duplicate accounts are blocked, and the Budget tab now shows your
  real spending by category

🏢 Careers & Companies
• Company income no longer stuck at a flat $2K — starting income now reflects your industry,
  and hiring staff, upgrades, brand, and market share all actually grow your business

📱 Everywhere Else
• Fixed the floating tab bar covering buttons on 24+ screens — including the dark web "Run
  Stage" button that felt stuck
• Starting degrees from scenarios now show the right GPA and name instead of "Failing"
• Closed a couple of under-the-hood exploits so rewards can't be duplicated by rapid tapping

Keep the reports coming — Discord: https://discord.gg/rzktazdX8v
```

---

## 📋 Full Release Notes

Everything below is **new since v2.5.2**.

### 👶 Family & Relationships

- **Kids are back** — "Try for Baby" had been silently wired to a "Coming Soon" placeholder; it
  now calls the real family action and works for spouses as well as engaged/cohabiting partners.
- **Marriage completes** — proposals now go through ring selection into the real wedding-planning
  flow (the planning screen existed but was unreachable, so weddings never finished). Your spouse
  is now correctly recorded once a planned wedding happens.
- **No more accidental bigamy** — exclusivity is enforced at every step (promoting, proposing,
  moving in, marrying), including a recheck for fast double-taps. Existing saves that already had
  more than one committed partner aren't broken up automatically, but can only formalize one going
  forward.
- **Stage-aware titles** — relationship labels now correctly track Partner → Fiancé(e) → Spouse
  (and In Relationship → Engaged → Married) instead of getting stuck on one label.

### 🎲 Life Events & Health

- **Events fire again** — the weekly event check now reliably delivers one event once it passes,
  instead of frequently rolling nothing even on a "successful" week. Late-game event frequency and
  the guaranteed-event backstop were also tuned to feel less quiet.
- **Diseases rebalanced** — added age gates and an overall occurrence check so serious/terminal
  diagnoses can't land on very young characters or stack multiple severe conditions at once.
  Critical/terminal illnesses can now be cured via experimental treatment, and existing saves with
  an old-style incurable diagnosis are automatically updated to reflect this.
- **No more empty banners** — blank notification pills no longer render; they're dropped before
  they'd ever reach your screen.

### 🏦 Banking

- Opened accounts now accrue their advertised interest rate every week (previously balances just
  sat there).
- **Withdraw and Close Account are reachable** — the modals existed but nothing opened them, so
  money in CDs/high-yield accounts looked permanently stuck. Both now work.
- Duplicate account types are blocked, and auto-pay can be toggled off/paused.
- The **Budget tab** now shows your real, categorized spending instead of a placeholder.

### 🏢 Careers & Companies

- Starting company income now scales with your industry ($1.5K–$4K) instead of a flat $2K.
- New hires now actually count toward your headcount, and the staff-hiring and upgrade catalog
  are back and working.
- Brand reputation and market share now genuinely multiply your revenue (roughly 0.75×–1.6×)
  instead of doing nothing.

### 📱 UI & Everywhere Else

- **Tab bar no longer blocks buttons** — 24 sub-app screens (banking, company, dark web, and
  more) now reserve space for the floating tab bar, including the home-indicator area on iPhones
  with no physical home button. This was also the real cause of the dark web feeling "stuck" —
  the Run Stage button was there, just untappable — and that action now clearly shows energy
  blocks, failures, and completions instead of silently doing nothing.
- Scenario-granted starting degrees now show a passing GPA and proper name instead of rendering
  "business_degree — Failing".

### ⚖️ Fair Play

- Closed a couple of rapid-double-tap exploits (R&D competition entries, hobby tournaments) that
  could duplicate a payout; fixed a purchase edge case where a paid in-app item could fail to
  apply after a successful purchase.

---

## 🧱 Also includes — prior cumulative updates

For players coming from further back, this build also contains everything from the **v2.5.0
Stability, Speed & Fair-Play Update** (instant week-advance, purchase-apply overhaul, duplicate
weekly-outcome fixes, WCAG-AA contrast, reduced-motion support) and the **v2.3.x Stability
Update** (70+ fixes, guaranteed kids/marriage/jobs, real relationship consequences, major
performance gains). See git history for the full detail on those releases.

---

Thank you for playing and reporting bugs — keep them coming.

**Join the community:** https://discord.gg/rzktazdX8v
