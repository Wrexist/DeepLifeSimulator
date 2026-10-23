# Your checklist

Everything below needs your accounts, so it is yours to do. It is ordered by
impact for the time it takes. Tick as you go.

## Today (about 1 hour)

- [ ] **Merge the pull request.** The support site redeploys by itself and
      pings Bing through IndexNow. (The image life card needs a new app build
      before players see it; see "Next build" below.)
- [ ] **Bing Webmaster Tools** (10 min). https://www.bing.com/webmasters ›
      Add site `https://wrexist.github.io/DeepLifeSimulator/` › verify with
      "Import from Google Search Console" or the HTML file method (add the file
      to `support-site/` and ask me to commit it) › Sitemaps › submit
      `https://wrexist.github.io/DeepLifeSimulator/sitemap.xml`. ChatGPT search
      finds pages through Bing.
- [ ] **Google Search Console** (10 min). https://search.google.com/search-console
      › Add property › **URL prefix** `https://wrexist.github.io/DeepLifeSimulator/`
      › verify (HTML tag or file; I can add either) › Sitemaps › submit the same
      sitemap. Then URL Inspection › Request indexing for `/` and `/guide.html`.
- [ ] **Apple featuring nomination** (15 min) for the next update. Paste from
      `featuring-nomination.md`, at least 2 weeks before release.
- [ ] **In-app event: "Nothing to Fear"** (15 min), live until 6 November.
      Copy in `in-app-events.md`. Then queue "First Steps" (starts 2 Nov).
- [ ] **AlternativeTo listing** (15 min). Steps in `wiki-and-listings.md`.
- [ ] **Submit to lifesim.io** (5 min), the best-fit list found:
      https://www.lifesimulator.io/submit. Opening line is in
      `list-and-press-outreach.md`.
- [ ] **Promotional text** (2 min, no review needed). Paste the Halloween line
      from `promotional-text.md`.

## This week (about 4 hours)

- [ ] **App Store keywords.** The pull request fills the 16 unused characters
      of the keyword field (`rich`, `choice`, `rpg`). Run
      `node scripts/check-aso.mjs --emit` and paste the keyword field into App
      Store Connect with the next version.
- [ ] **One name.** The App Store says "Deep Life Simulator: Tycoon", while
      the site, emails and socials have said "DeepLife Simulator". The site now
      leads with **Deep Life Simulator** and lists the other spellings as
      alternate names in its structured data. Use "Deep Life Simulator" in
      every new profile, bio, email and post.
- [ ] **Pitch 5 list authors** from `list-and-press-outreach.md` (pages 1–5).
      Record a 30-second clip first; every pitch uses it.
- [ ] **Message 10 creators** using `creator-outreach.md`. Create promo codes
      and one campaign link each.
- [ ] **Create r/DeepLifeSimulator** and post the first patch notes.
- [ ] **Post the two ready slideshows** from
      `/mnt/project-files/reach-2026-10-21/slideshows/` (6 images each, made
      from real screenshots) as TikTok photo posts, one a day. Captions are in
      `short-video-and-slideshows.md`.
- [ ] **Record one batch** of 10 lives and cut the first 3 videos from
      `short-video-and-slideshows.md`. Post them to TikTok, Reels and Shorts.
- [ ] **Free store A/B tests.** App Store Connect › Product Page Optimization:
      test a new first screenshot against the current one (up to 3
      treatments, 90 days). Play Console › Store listing experiments: test the
      short description. Keep the winner; it lifts every other channel.
- [ ] **First AI check.** Ask the 10 questions in `ai-answer-tracker.md` and
      fill in October's row. This is the baseline.

## This month

- [ ] **Fandom wiki** with the first 15 pages (`wiki-and-listings.md`). Ask
      Discord for 2–3 editors.
- [ ] **Pitch the remaining list authors** (6–10) and follow up once on 1–5.
- [ ] **20 more creators.**
- [ ] **One Reddit gameplay post** where rules allow (`reddit-playbook.md`),
      and 20 minutes a week answering "games like BitLife" threads.
- [ ] **Press:** pitch TouchArcade, Pocket Gamer and Droid Gamers once the
      image card ships, with the update hook.
- [ ] **Awards:** check the next Pocket Gamer Mobile Games Awards, Big Indie
      Pitch and Google Play Indie Games Festival dates and put them in your
      calendar.
- [ ] **Holiday events:** submit "Home for the Holidays" and the second
      featuring nomination by 4 December.

## Next build

- [ ] The image life card adds two native modules (`react-native-view-shot`,
      `expo-sharing`). They only work in a **new binary**. An over-the-air
      update to an older build falls back to the text share, so nothing breaks.
      Before submitting: on a real iPhone and Android phone, die, tap Share,
      and check the image appears and the link text comes along on iPhone.
- [ ] Bump `package.json` version as usual (CLAUDE.md §9).

## Every month

- [ ] Re-run the AI questions and log them.
- [ ] Search the list keywords again and add new pages to the outreach table.
- [ ] One featuring nomination per update, one in-app event per Live Ops event.
- [ ] Check App Store Connect › Sources and Play Console › Acquisition per
      campaign link, and drop the channels that bring nobody.

## Do not do

- Buying upvotes, reviews, followers or aged accounts.
- Asking only happy players for ratings, or rewarding reviews.
- Posting as the developer in r/iOSGaming while dev self-promo is suspended.
- Naming BitLife in App Store metadata (Apple rejects competitor names).
