# Deep Life Simulator — Beta Hub

Published at **https://wrexist.github.io/DeepLifeSimulator/android/** by
`.github/workflows/deploy-support-site.yml`, which deploys all of
`support-site/` on push to `main`.

Hand-written HTML/CSS/JS with no build step and no third-party scripts, matching
the rest of the support site. It layers on `../styles.css` and reuses the real
screenshots in `../assets/` rather than duplicating them.

| File | |
|---|---|
| `index.html` + `landing.js` | Landing page |
| `join.html` + `join.js` | Onboarding: form → five steps |
| `dashboard.html` + `dashboard.js` | Tester dashboard |
| `feedback.html` + `feedback.js` | Feedback form |
| `bug.html` + `bug.js` | Bug report |
| `ideas.html` + `ideas.js` | Feature requests + voting |
| `community.html` + `community.js` | Announcements, devlog, roadmap |
| `admin.html` + `admin.js` | Admin dashboard |
| `beta-config.js` | Public config — **no secrets** |
| `beta-content.js` | All copy and game-grounded content |
| `beta-api.js` | API client, tester session, offline queue |
| `beta-ui.js` | Shared UI helpers |
| `qr.js` | Self-contained QR encoder (byte mode, EC-L, v1–10) |
| `beta.css` | Hub design layer |

**Scripts must load in order:** `beta-config.js` → `beta-content.js` →
`beta-api.js` → `beta-ui.js` → the page script. A test enforces this.

Operator guide: `docs/BETA-HUB.md`. Backend: `server/beta-hub/README.md`.
Tests: `npx jest __tests__/betahub/`.
