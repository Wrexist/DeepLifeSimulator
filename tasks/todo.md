# Plan — Discord community funnel (follow-up to PR #175)

PR #175 fixed the LINKS. This is the FUNNEL: the places that decide whether a
player ever sees an invite, and where the store sends someone looking for help.

## 1. The in-game invite may be asked more than once  ← main item

`app/(tabs)/home.tsx` offers the community popup once, at `weeksThisLife >= 4`,
and a dismissal writes `discord_popup_seen = 'true'` which suppresses it
**forever**. One tap on "Maybe later" - at the single coldest moment of a run,
where `discordJoinRewardMoney` is pinned to its $5k floor - permanently closes
the largest funnel the game has.

- [x] `utils/communityInvitePrompt.ts` — pure decision + durable offer record
      (`{ count, lastWeek }` on `discord_invite_offers`), cap and cooldown as
      named constants, legacy `discord_popup_seen` read as one spent offer.
- [x] `app/(tabs)/home.tsx` — gate on the pure predicate; dismissal records an
      offer instead of a tombstone.
- [x] Tests: cap, cooldown, legacy migration, claimed-always-wins.

## 2. App Store Support URL points at a Discord invite

`marketing/app_store_listing.md` lists the invite as **Support URL** (iOS) and
**Support Email/Website** (Android). Guideline 1.5 wants a support page with
real contact info, and an invite requiring a Discord account is a rejection
risk. `support-site/support.html` is already deployed and has the email.

- [x] Point both at the deployed support page.
- [x] Add the Discord link ON that page, so the funnel is kept, not lost.

## 3. Obituary share — NOT DOING, see reasoning

Rejected after reading the code. `lib/legacy/obituaryGenerator.ts` and
`__tests__/social/shareLinks.test.ts` both pin that `APP_STORE_URL` is the LAST
link, because clients build the preview from the final one. A Discord URL after
it hijacks the preview away from the store; before it, it competes with the one
CTA that installs the game. The share is the install channel; the invite already
has two in-app surfaces. Left alone deliberately.

## Blocked on the owner

Per-surface invite codes for attribution. Needs ~6 never-expiring invites
created in Discord; nothing in the repo can produce them.
