# Active plan — Android Beta Hub (player acquisition engine)

Branch: `claude/deep-life-beta-recruitment-f2ygv8` · **complete**

## Goal
`https://wrexist.github.io/DeepLifeSimulator/android/` runs the whole funnel:
RECRUIT → ONBOARD → INSTALL → PLAY → FEEDBACK → IMPROVE → RETAIN → LAUNCH.

## Architecture (decided after auditing the repo)
- **Host:** the existing GitHub Pages site (`support-site/`, deployed by
  `.github/workflows/deploy-support-site.yml`). The hub is `support-site/android/`.
  No build step — the site is hand-written HTML/CSS/JS and the hub keeps that.
- **Design:** layered on `support-site/styles.css`, reusing the real screenshots
  in `support-site/assets/`. No fabricated gameplay art.
- **Backend:** the project's existing Supabase project `deeplife-backend`
  (`gyxmoqanjdvvllwjfsst`) — 10 additive `beta_*` tables + one edge function
  `betahub`, following the `save`/`leaderboard`/`analytics` conventions
  (service-role writes, RLS on with no policies, bearer auth).
- **Degradation:** every page renders with no backend; writes queue locally and
  flush on the next visit.

## Done
- [x] 1. Repo audit — site, assets, backend, Play plan, game content
- [x] 2. Schema + edge function (`server/beta-hub/`), applied and deployed
- [x] 3. Shared runtime: `beta-config` / `beta-content` / `beta-api` / `beta-ui` / `qr`
- [x] 4. Landing page — hero, pillars, life paths, shots, the ask, steps, FAQ, First-20 counter
- [x] 5. Onboarding — under-a-minute form → five steps with a progress rail
- [x] 6. Tester dashboard — progress, missions, XP, badges, referral, delete-my-data
- [x] 7. Feedback + bug report (device details pre-filled)
- [x] 8. Ideas board with one-vote-per-tester, Trending / Top / New / Roadmap
- [x] 9. Community — announcements, devlog, roadmap board
- [x] 10. Admin — Today, Testers, Funnel & sources, Feedback, Bugs, Ideas,
      Links & QR, Marketing, Messages, Community, Settings; CSV export
- [x] 11. Launch-mode switch (beta → launch, no deploy)
- [x] 12. Tests — `__tests__/betahub/`, 140 passing; lint ratchet 0; type-check clean
- [x] 13. Docs — `docs/BETA-HUB.md`, `server/beta-hub/README.md`, hub README

## The one thing only the owner can do
Paste the **Google Play closed-test opt-in URL** into Admin → Settings. Until
then onboarding shows a "not published yet" notice rather than a dead button.
Get it from Play Console → Testing → Closed testing → Testers → Copy link.
