# DeepLife release test checklist

Prepared 10 September 2026 from R04, R06, R09 and the R11 privacy rehearsal.
Mark each item PASS, FAIL or NOT TESTED. An unreached feature is not a pass.
Record device model, iOS version, TestFlight version/build and test date.
Record source SHA and OTA update ID with release support if not visible to you.

Use the agreed fresh installation with no real purchases. Purchase testing is
only on the designated TestFlight/sandbox build. Keep an existing installation
and its saves intact for the separate upgrade test. Reinstall testing uses only
disposable test data. A JavaScript update alone cannot verify new native defaults.

## 1. Installation and first life

- [ ] Install the exact designated candidate; open it online and in airplane mode.
- [ ] Close completely and reopen: no crash, permanent loading screen or missing images.
- [ ] Try Play and Custom Life as separate new-life paths.
- [ ] Choose a scenario; verify starting age, education, cash and stats agree with its description.
- [ ] Change name and appearance; verify the result survives save/relaunch.
- [ ] Inspect perks: free, locked and paid choices are clearly distinguished.
- [ ] Enter Home: understand the first objective and next action without explanation.
- [ ] Check every visible button/tab/app, including Back, Close and return Home.

## 2. Ordinary gameplay and money

- [ ] Apply for a first job: pending/rejected/hired states are distinct and requirements make sense.
- [ ] Work and advance a week; compare starting cash, income, bills and ending cash with the recap.
- [ ] Change jobs, pursue a promotion and leave work; pay/status/guidance update correctly.
- [ ] Compare education paid in cash versus financed: tuition, weekly payment and remaining cash are clear before confirming.
- [ ] Enroll once, then advance weeks: tuition/payment/progress match the quote; rapid taps do not enroll or charge twice.
- [ ] Start with low cash: find an affordable work/care/recovery action; blocked actions explain why.
- [ ] Try food, rest, exercise and medical care: price and stat effects agree; unaffordable actions do not charge.
- [ ] Rent/move/buy housing when unlocked; costs, ownership and recurring payments agree.
- [ ] Buy/sell items, vehicles and investments when unlocked; cash, quantity, debt and asset value stay distinct.
- [ ] Start/run a business; compare wages, costs and cash receipts with the recap.
- [ ] Fund and finish research: only played weeks count and the bonus is granted once.
- [ ] Switch away from that slot and return: another character's weeks do not advance its research.
- [ ] Try every unlocked career, crime, social, market, computer and phone activity; check requirements, outcome and exit navigation.
- [ ] Complete goals, achievements and claims; each reward arrives once, including after reopening/relaunch.
- [ ] Advance several weeks: age/week counters, events, bills and goals remain coherent.

## 3. Relationships, family and life end

- [ ] Meet, date and develop relationships; costs and requirements are visible.
- [ ] Try marriage, separation and family/child actions when reached; status updates correctly.
- [ ] Check family/pet lists, portraits and details after saving and relaunching.
- [ ] Check child, adult and older avatars; no missing or mismatched artwork.
- [ ] Reach death naturally for progression acceptance; inspect causes and available options.
- [ ] Open and cancel revival/shop options from death; return safely to the death screen.
- [ ] Decline revival/end the life; no trapped or overlapping modal.
- [ ] Continue as an heir where available; verify the intended character and inheritance.
- [ ] Relaunch after death, revival and heir continuation; no duplicate rewards or wrong life.

## 4. Saves, interruptions and upgrades

- [ ] Create separate lives in the available save slots; verify name, money, week and inventory stay separate.
- [ ] Manual-save and autosave after meaningful actions; relaunch and compare state.
- [ ] Background and return during play, a weekly transition and an open modal.
- [ ] Force-close and reopen after a completed purchase/action/week; state is coherent and rewards are not duplicated.
- [ ] Repeat with poor/no network; local gameplay and saving remain usable.
- [ ] Upgrade a separate existing installation without deleting it; an older save loads with money, inventory, family and entitlements intact.
- [ ] Delete only a disposable test slot; other slots remain unchanged.
- [ ] If save/recovery errors occur, the message explains what happened and what to do; never claim successful saving when it failed.

## 5. Purchases and subscriptions — designated sandbox only

- [ ] Every enabled product shows correct localized price, quantity, duration and benefit before purchase.
- [ ] Test each consumable pack: exact benefit once; repeated taps/relaunch do not duplicate it.
- [ ] Test permanent and mixed packs: advertised initial benefits, correct permanent benefits after restore.
- [ ] Cancel the Apple purchase sheet: no charge/grant and no stuck loading state.
- [ ] Test unavailable/offline purchase responses: truthful status and recovery instructions.
- [ ] Interrupt before/after store completion; reopen the original life and recover exactly one grant.
- [ ] Try Restore Purchases repeatedly: permanent access/subscription returns without replaying spent consumables.
- [ ] Check recovery after switching slots/ending a life: no reward goes to an unrelated character.
- [ ] Test paid revival from the death screen: native sheet opens and revival occurs once.
- [ ] DeepLife+: clear renewal/trial terms, active benefits, sandbox expiry and working subscription-management link.
- [ ] Remove Ads: intended ads disappear after purchase, restart and restore.
- [ ] On disposable data, reinstall and restore: eligible permanent access returns; old saves and consumables are not falsely promised.

## 6. Ads and privacy controls

- [ ] Deny tracking: core gameplay works; no repeated/trapped permission prompt.
- [ ] Test the allow path separately, where iOS permits it; core gameplay remains usable.
- [ ] Open Ad Privacy Choices where applicable: readable choices, usable dismissal and retry after failure.
- [ ] Rewarded ad completes: grant exactly the advertised reward once.
- [ ] Cancel/close early: no unearned reward; return to usable gameplay.
- [ ] Offline/no ad available: clear fallback, no lost currency and no permanent spinner.
- [ ] Background/return during an ad: no trapped screen or duplicate/lost completed reward.
- [ ] Interstitials, where present: usable close control, no overlapping purchase/death sheets.
- [ ] Usage analytics starts OFF; opting in and withdrawing each survive relaunch.
- [ ] Opt in, leave the app, revoke ATT in iOS Settings, return: gameplay works and Settings remains usable.
- [ ] Turn usage OFF, background/relaunch: it stays OFF. Merely allowing ATT must not turn usage opt-in ON.
- [ ] Privacy Policy opens and identifies Isac Molin with the correct support contact.
- [ ] Request Personal Data Deletion prepares readable/selectable details; unavailable IDs are explained.
- [ ] Hide request details and close/reopen Settings: private draft details disappear.
- [ ] Open Email Draft: intended recipient, subject and body; nothing sends automatically. No-email fallback remains usable.
- [ ] Keep provider identifiers/private request details out of public screenshots and bug reports.

## 7. Display, accessibility and performance

- [ ] Repeat core flows on a compact iPhone and an iPad; mark an unavailable device NOT TESTED.
- [ ] No clipped text/buttons, unintended sideways scrolling or content hidden by notch/home indicator.
- [ ] Keyboard never hides the active field, confirmation or Close action; dismissal works.
- [ ] Open/close Settings, shop, help and confirmations rapidly: only intended modals remain.
- [ ] Larger Text: important labels, prices, amounts and actions remain readable and reachable.
- [ ] VoiceOver: meaningful names, sensible focus order, announced switch state and reachable modal dismissal.
- [ ] Reduced Motion: effects respect the setting and do not block controls.
- [ ] Status is understandable without color alone; small text and dim controls are readable.
- [ ] Long lists scroll smoothly; week advance and modal opening stay responsive on early and large late-life saves.
- [ ] Record several cold-start/week/modal timings on the same device; compare with the previous build where available.
- [ ] Play an ordinary extended session: note crashes, freezes, excessive heat, repeated slowdowns or unexpected restarts.

## 8. Checks we must complete together

These cannot be passed just by looking at the game:

- [ ] Verify native build/source/OTA identity and that Firebase denied native defaults are in that binary.
- [ ] Inspect actual analytics collection for OFF, ON, withdrawal, ATT revocation and rapid background/return; no stale queued upload after withdrawal.
- [ ] Verify native advertising consent and cached-ad behavior after permission changes for applicable regions.
- [ ] Exercise deferred store callbacks, controlled save-write failure and duplicate store delivery with test tooling.
- [ ] Check device crash/memory evidence rather than treating dashboard dashes as zero crashes.
- [ ] Match the designated test installation's provider IDs privately, execute the reviewed deletion procedure, verify completion and prepare the confirmation response.
- [ ] Reconcile App Store privacy answers, published policy, screenshots and product descriptions with observed behavior.

## Reporting a failure

Test/item:
Device + iOS:
App version/build:
Starting scenario/slot/week (no private IDs):
Steps:
Expected:
Actually happened:
Reproduces every time / sometimes / once:
Screenshot or short recording, with private details removed:

Prioritize lost saves, wrong charges/grants, broken restore, crashes, privacy
failures and trapped screens before visual polish. Do not delete the affected
installation or repurchase to troubleshoot an unresolved pending purchase.
