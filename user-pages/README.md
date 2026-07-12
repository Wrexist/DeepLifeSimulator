# `wrexist.github.io` root site — fixes AdMob `app-ads.txt` 404

AdMob verifies `app-ads.txt` at the **root** of your developer domain:
`https://wrexist.github.io/app-ads.txt`. That root is served only by a repo
named exactly **`wrexist.github.io`** — which doesn't exist yet, so the URL
404s and AdMob can't verify the app.

This folder is the ready-to-publish content for that repo:

- `app-ads.txt` — your authorized-sellers line (`pub-2286247955186424`, matches `app.config.js`).
- `index.html` — redirects the bare root to the DeepLife support site (so it isn't blank).

> The Claude GitHub integration is scoped to `DeepLifeSimulator` and can't
> create new repos, so this one step is manual. It takes ~1 minute.

## Publish (copy-paste, needs the `gh` CLI logged in as Wrexist)

```bash
# from a clone of DeepLifeSimulator, in this folder:
cd user-pages
gh repo create wrexist.github.io --public --disable-issues --disable-wiki
git init -b main
git add app-ads.txt index.html
git commit -m "User Pages site: app-ads.txt for AdMob"
git remote add origin https://github.com/Wrexist/wrexist.github.io.git
git push -u origin main
```

GitHub auto-publishes `<user>.github.io` repos from `main` — no Pages settings
needed. Within a minute:

```bash
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

### Alternative (no new repo): point the developer URL at a domain you already control

If you'd rather not create the user site, set a **custom domain** on an existing
Pages repo (e.g. `deeplifesim.com`), host `app-ads.txt` at that domain's root,
and set that domain as the app's **Marketing/Support URL** in App Store Connect.
AdMob will then crawl `https://<your-domain>/app-ads.txt`.
