# Beta Hub — the operator's guide

**Live at:** `https://wrexist.github.io/DeepLifeSimulator/android/`
**Admin at:** `https://wrexist.github.io/DeepLifeSimulator/android/admin.html`

The Beta Hub runs the whole funnel:

```
RECRUIT → ONBOARD → INSTALL → PLAY → FEEDBACK → IMPROVE → RETAIN → LAUNCH
```

It is not "a website for getting testers". It is the player-acquisition engine,
and the closed beta is just its first campaign — the same pages, tracking and
community carry through to public launch with one setting change (§7).

---

## 1. The 60-second version

1. Open **admin.html**, paste your admin token.
2. **Settings** → paste the Google Play opt-in URL. *(Until you do, onboarding
   shows a "not published yet" notice instead of a dead button.)*
3. **Links & QR** → pick a source → copy the link.
4. Post it. **Marketing** has the copy already written for every platform.
5. Watch **Today**. It tells you what needs you and nothing else.

---

## 2. What is where

| Page | Who it's for | What it does |
|---|---|---|
| `index.html` | cold traffic | Landing page: hero, the game, pillars, life paths, screenshots, the ask, how it works, FAQ, live "first 20" counter |
| `join.html` | new testers | Six-field form (two required) then the five steps, with a progress rail |
| `dashboard.html` | testers | Progress, today's mission, XP and level, badges, referral link, delete-my-data |
| `feedback.html` | testers | Stars, mood, categories, five short questions |
| `bug.html` | testers | Full bug form with device, Android version and app version pre-filled |
| `ideas.html` | everyone | Feature requests with one-vote-per-tester, Trending / Most requested / New / On the roadmap |
| `community.html` | everyone | Announcements, devlog, roadmap board, top ideas, where to talk |
| `admin.html` | you | Everything below |

Shared: `beta.css` (layered on the existing `support-site/styles.css`),
`beta-config.js`, `beta-content.js`, `beta-api.js`, `beta-ui.js`, `qr.js`.
No build step, no dependencies, no third-party scripts.

---

## 3. The admin dashboard

**Today** — the ten-second view. New testers, feedback and bugs since midnight;
a "needs your attention" list that names the number and links to the fix; the
full funnel; and eight quick actions.

**Testers** — searchable, sortable, filterable table. Statuses are derived
server-side (one implementation, so the CSV and the table can never disagree):

`LEAD` (waitlisted) → `INVITED` → `JOINED` (opted in) → `INSTALLED` → `ACTIVE`
(played) → `FEEDBACK` → `INACTIVE` (5+ days quiet) → `COMPLETED`

Add a tester by hand for anyone who DM'd you. Edit contact, notes and funnel
flags. Delete removes them and everything they sent.

**Funnel & sources** — Visitors → Signups → Opted in → Installed → Active →
Feedback, with conversion between each, and the same broken down per
recruitment source. **Rank channels by *active*, not signups**: 30 people who
never open the app are worth less than 5 who play.

**Feedback / Bugs / Ideas** — everything testers sent, with status pickers.

**Links & QR** — a link generator (source, campaign, landing page), one
ready-made link per channel, and a downloadable SVG QR code for posters,
streams and slides. The QR encoder is built into the page — no CDN, no tracking.

**Marketing** — per-platform post templates with the tracked link already
substituted, a social-post generator (platform × goal × topic × tone), and
shareable card designs. Every line is built from a system that exists in the
build; the generator composes copy, it cannot invent a feature.

**Messages** — the day-0 → day-14 sequence plus as-needed nudges, and a list of
exactly who needs which one today. You send them; the hub never does (§6).

**Community** — publish an announcement or devlog, add roadmap items.

**Settings** — Play Store URLs, Discord, privacy, support email, app version,
target tester count, beta status, and the beta/launch mode switch.

---

## 4. Recruitment source tracking

Any hub URL takes `?source=` and `?campaign=`:

```
…/android/?source=reddit
…/android/?source=discord&campaign=wave-1
…/android/join.html?source=tiktok
```

`utm_source` / `utm_campaign` work too. **Attribution is first-touch and
sticky**: someone who arrives from Reddit, reads the FAQ and signs up two days
later is still credited to Reddit, not to "direct".

Referral links carry `&ref=CODE`; every tester gets a code on their dashboard.

---

## 5. Getting the first 20 testers

Google's closed-test rule: **12 testers minimum, opted in continuously for 14
days**, on a *closed* track (internal testing does not count). The hub targets
**20** so a dropout never puts you under. Full detail lives in
`docs/GOOGLE_PLAY_RELEASE_PLAN.md` §10.

Ranked by what actually works for this game:

| Channel | Realistic yield | Why |
|---|---|---|
| **Your Discord** (`discord.gg/rzktazdX8v`) | 3–8 | Already-engaged players. Best feedback of any source. |
| **iOS TestFlight testers with an Android phone** | 3–6 | They already play the game. `docs/testflight_feedback/` is the contact trail. |
| **Friends, family, coworkers** | 4–8 | Each needs their own Google account on a real device. |
| **Reddit** — r/AlphaandBetaUsers, r/playtesters, r/androidapps, r/lifesimulators | 2–6 | Post genuinely, offer to test theirs back. |
| **Mutual-testing groups** | 8–12 | Reliable for numbers, weak for feedback. **Top-up only** — Google has denied production access when testing looks purchased and unengaged. |

---

## 6. What this system will not do

These are design decisions, not gaps:

- **No fake testers, no automated installs, no simulated activity.** Every
  tester is a real person with a real Google account on a real device.
- **No inferred Play Store state.** The hub cannot see Google Play and never
  pretends to — opted-in / installed / played are the tester's own
  confirmations. A dashboard that guessed would be worse than one that asks.
- **No automated sending.** The Messages tab hands you copy. A tester gave a
  contact method for beta instructions, not for a mail sequence, and a message
  from a person gets replies a broadcast does not.
- **No Google credentials, ever.** Nothing in the hub asks for a password, and
  the sign-up form says so out loud — that sentence is what makes a stranger's
  recruitment link safe to act on.
- **No invented rewards.** Badges and XP are community recognition. Nothing
  claims money unless you configure it and say so.

---

## 7. Launch mode

**Settings → Mode → Switch to launch.** Takes effect immediately, no deploy:

- Every CTA becomes "Get it on Google Play" and points at the production URL.
- The Android-beta badge becomes "Now on Google Play".
- The "first 20" counter disappears.
- Community, ideas, feedback, bug reporting and source tracking all continue
  unchanged — which is the point. The recruitment site becomes the marketing
  site without losing the community that was built inside it.

---

## 8. Privacy

Stored: nickname, the contact method the tester chose to give, and optionally
country, device and age range. Plus what they wrote, and a random visitor id
for funnel counting.

Never stored: passwords, Google credentials, IP addresses (the rate limiter
keys on a salted hash), or anything from other sites.

Every tester can erase everything about themselves from their dashboard in one
tap. Their feedback goes with them; their bug reports survive detached from the
person, so a fix does not get lost.

---

## 9. Technical

| | |
|---|---|
| Hosting | GitHub Pages, via `.github/workflows/deploy-support-site.yml` (deploys `support-site/**` on push to `main`) |
| Build step | none — hand-written HTML/CSS/JS, same as the rest of `support-site/` |
| Backend | Supabase edge function `betahub` in the existing `deeplife-backend` project — see `server/beta-hub/README.md` |
| Env vars | **none in the repo.** Operational settings live in the database and are edited from the admin page; the admin token is typed in and never persisted to disk |
| Tests | `__tests__/betahub/` — 140 tests: page/link integrity, no leaked secrets, SEO, accessibility, copy checked against `lib/` source numbers, client/server route contract, QR round-trip decode, and a load-smoke run of every page script against a DOM stub with the API both up and down |

### Deploying a change

Push to `main`. The Pages workflow does the rest. To change the API, edit
`server/beta-hub/index.ts` and redeploy per that folder's README.

### If the backend is unreachable

Every page still renders. Submissions queue in the browser and send themselves
on the next visit, and the tester is told so rather than seeing a silent
failure. The landing page simply hides the live counter.
