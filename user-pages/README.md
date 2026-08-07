# `wrexist.github.io` root site — fixes AdMob `app-ads.txt` 404

**Status (2026-08-07): still unresolved.** AdMob's app-ads.txt panel reports
_"Det gick inte att hitta filen app-ads.txt"_ for Deep Life Simulator
(app id `6749675615`, crawl domain `wrexist.github.io`, ~1.62k ad requests in
the last seven days going out unverified).

## Why it 404s

AdMob crawls `app-ads.txt` at the **root of the developer domain** taken from
the store listing — here `https://wrexist.github.io/app-ads.txt`. Subdirectories
are not supported by the spec, so none of the paths that already exist help:

| URL | Serves | Fixes AdMob? |
|---|---|---|
| `wrexist.github.io/DeepLifeSimulator/app-ads.txt` | `support-site/` via `deploy-support-site.yml` | ❌ subdirectory |
| `wrexist.github.io/deeplife-sim-support/app-ads.txt` | the `deeplife-sim-support` repo | ❌ subdirectory |
| `wrexist.github.io/app-ads.txt` | **nothing — no repo serves this** | ✅ this is the one |

On github.io that root is served **only** by a repo named exactly
`wrexist.github.io`. Confirmed today: no such repo exists on the account.

## Why this step is manual

The Claude GitHub integration is scoped to `DeepLifeSimulator` and its token
cannot create repositories — `POST /user/repos` returns
`403 Resource not accessible by integration`. Everything else is prepared here:

- `app-ads.txt` — the authorized-sellers line. Publisher id `pub-2286247955186424`
  matches `admobIosAppId` / `admobAndroidAppId` in `app.config.js`.
- `index.html` — redirects the bare root to the support site, so it isn't blank.
- `publish.sh` — creates the repo and pushes both files in one command.

`__tests__/monetization/appAdsTxt.test.ts` keeps the three copies of
`app-ads.txt` in this repo byte-identical and pinned to the publisher id in
`app.config.js`, so the file can't quietly drift into authorizing the wrong
seller once it is live.

It takes ~1 minute.

## Publish — one command (needs the `gh` CLI logged in as Wrexist)

```bash
# from a clone of DeepLifeSimulator:
./user-pages/publish.sh
```

It derives the repo name from your `gh` login (the name must be exactly
`<login>.github.io` or the root still 404s), creates the repo if it is missing,
pushes `app-ads.txt` + `index.html`, then polls the live URL until it serves.
Safe to re-run — an existing repo is updated, not replaced.

GitHub auto-publishes `<user>.github.io` repos from `main`, so there are no Pages
settings to flip. If you'd rather do it by hand:

```bash
cd user-pages
gh repo create wrexist.github.io --public --disable-issues --disable-wiki
git init -b main
git add app-ads.txt index.html
git commit -m "User Pages site: app-ads.txt for AdMob"
git remote add origin https://github.com/Wrexist/wrexist.github.io.git
git push -u origin main

curl -sS https://wrexist.github.io/app-ads.txt
# → google.com, pub-2286247955186424, DIRECT, f08c47fec0942fa0
```

## No `gh` CLI? Do it in the browser

1. github.com → **New repository** → name it exactly `wrexist.github.io`, **Public**, Create.
2. **Add file → Upload files** → drag in `app-ads.txt` and `index.html` from this folder → Commit.
3. Wait ~1 min, then open `https://wrexist.github.io/app-ads.txt` — you should see the line.

## Then in AdMob

AdMob re-crawls periodically, or click **"Sök efter uppdateringar"** (Check for
updates) on the app-ads.txt panel. Verification usually clears within 24h.

---

### Alternative (no new repo): a custom domain

Set a **custom domain** on either Pages repo (e.g. `deeplifesim.com` on
`DeepLifeSimulator`). A custom domain serves `support-site/` at ITS root, and
`support-site/app-ads.txt` is now committed, so `https://<domain>/app-ads.txt`
resolves the moment the domain is pointed. Then set that domain as the app's
Marketing/Support URL in App Store Connect and AdMob will crawl it there.

That copy of the file does **not** fix the current failure on its own — on
`wrexist.github.io` it still lands in a subdirectory. It exists so the custom-domain
route is a DNS change with no code change behind it.
