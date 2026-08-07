# DeepLife Simulator — Support Site

Immersive multi-page GitHub Pages site for DeepLife Simulator.

## Pages
- `index.html` — animated hero, features, screenshot showcase, What's New, support & FAQ
- `features.html` — deep-dive on every game system (alternating hero shots)
- `gallery.html` — full screenshot gallery (real captures) with lightbox
- `whats-new.html` — release notes / changelog (v2.5.8 + history)
- `support.html` — contact + full FAQ / troubleshooting
- `privacy.html` — full privacy policy (mirrors the canonical policy)

Shared: `styles.css`, `app.js`, `assets/` (real in-app screenshots + app icon).

`app-ads.txt` ships here too, but read `user-pages/README.md` before assuming it
does anything: AdMob only crawls the **root** of the developer domain, and this
folder publishes to a subdirectory (`wrexist.github.io/DeepLifeSimulator/`). The
copy here only becomes the live one if a custom domain is pointed at this site,
which serves this folder at that domain's root.

## Deploy to the support repo (wrexist/deeplife-sim-support)
Copy the contents of this folder to the root of that repo's published branch:

```bash
# from a clone of wrexist/deeplife-sim-support
cp -R /path/to/DeepLifeSimulator/support-site/. .
git add -A && git commit -m "New immersive support site" && git push
```

Then in that repo: Settings → Pages → deploy from the branch root.
Site lives at https://wrexist.github.io/deeplife-sim-support/

No build step, no dependencies — pure HTML/CSS/JS.
