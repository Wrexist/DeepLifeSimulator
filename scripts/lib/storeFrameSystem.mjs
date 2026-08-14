/**
 * The store-screenshot design system.
 *
 * ONE module, imported by both the iPhone and the iPad generator, so the two
 * sets cannot drift — the pair it replaces had diverged to the point of using
 * different decoration positions for the same frame.
 *
 * The rule behind every value below: **the screenshot is the subject.**
 * Everything else exists to frame it. `docs/store-screenshot-design.md` records
 * what the previous version did instead and why it read as machine-made.
 */

/** One palette for the whole set. Taken from the app's own theme. */
export const PALETTE = {
  // Deliberately DEEPER than the app's own `#0B1220` chrome, so the device
  // reads as lighter than the ground it sits on. The first pass used a ground
  // almost identical to the UI and the phone dissolved into it.
  ground: '#04070E',
  groundHigh: '#0A1020',
  bloom: '96,146,255',
  headline: '#F3F6FF',
  accent: '#6BA5FF',
  sub: 'rgba(211,222,250,0.56)',
  pillText: '#A8C6FF',
  pillBorder: 'rgba(150,180,240,0.22)',
  pillFill: 'rgba(120,160,240,0.07)',
};

/**
 * The ten frames, in upload order. `|word|` marks the accent word.
 *
 * `stat` is a proof point, not a sticker: one short line, same pill, same
 * place, every frame.
 */
export const FRAMES = [
  { id: '01-live-any-life', head: 'Live any |life.|', sub: 'Hustle, love, get rich, leave a legacy.', stat: '$11M net worth · Generation 1', pick: 'home' },
  { id: '02-find-your-person', head: 'Find your |person.|', sub: 'Swipe, match, fall in love — or don’t.', stat: '9 likes waiting', pick: 'spark' },
  { id: '03-build-your-companies', head: 'Build an |empire.|', sub: 'Found companies. Hire. Scale.', stat: '$8,000 a week in revenue', pick: 'company' },
  { id: '04-ride-the-bull-run', head: 'Ride the |bull run.|', sub: 'Trade crypto, mine it, time the market.', stat: '2.0 BTC held', pick: 'crypto' },
  { id: '05-go-viral', head: 'Go |viral.|', sub: 'Post, trend, grow a following.', stat: 'Trending now', pick: 'pulse' },
  { id: '06-enter-the-dark-web', head: 'Enter the |dark web.|', sub: 'High risk. Higher reward. Watch your heat.', stat: 'Opsec level 4', pick: 'darkweb' },
  { id: '07-phone-full-of-lives', head: 'A phone full of |lives.|', sub: 'Dating, trading, banking, fame — all in game.', stat: 'Every app unlocked', pick: 'apps' },
  { id: '08-train-your-mind', head: 'Train your |mind.|', sub: 'Degrees, skills and smarter choices.', stat: 'PhD unlocked', pick: 'education' },
  { id: '09-live-the-luxury', head: 'Live the |luxury.|', sub: 'Watches, supercars and museum-grade pieces.', stat: 'Rare collection', pick: 'luxury' },
  // Was the Family tab under "Your story, your rules". Shown large and alone,
  // that capture is an EMPTY STATE — a pink "Open the dating app" call to
  // action under the words "No partner yet", which is a dev-tools artifact and
  // the wrong thing to put on a store page. Contacts carries the same idea and
  // is full: parents, a spouse and both children, all with inherited faces.
  { id: '10-raise-a-family', head: 'Raise a |family.|', sub: 'Marry, have kids, pass it all on.', stat: 'Generation 1 · 2 children', pick: 'contacts' },
];

/**
 * Builds one frame's HTML.
 *
 * `L` carries the per-device-size layout numbers; everything else is shared, so
 * the iPad set differs from the iPhone set only in proportion, never in style.
 */
export function frameHtml(frame, shot, L) {
  const head = frame.head.replace('|', '<span class="acc">').replace('|', '</span>');
  const P = PALETTE;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${L.W}px; height:${L.H}px; overflow:hidden; }
  body {
    font-family:-apple-system,'SF Pro Display','Segoe UI',Roboto,'Helvetica Neue',sans-serif;
    background:${P.ground};
    -webkit-font-smoothing:antialiased;
  }
  .canvas { position:relative; width:${L.W}px; height:${L.H}px; overflow:hidden; }

  /* Ground: one vertical wash plus a single soft bloom, in a FIXED position on
     every frame. The old set moved three coloured glows around per frame. */
  .bg {
    position:absolute; inset:0;
    background:
      radial-gradient(${L.bloomW}px ${L.bloomH}px at 50% ${L.bloomY}%, rgba(${P.bloom},0.20), transparent 70%),
      radial-gradient(${Math.round(L.bloomW * 1.5)}px ${Math.round(L.bloomH * 0.55)}px at 50% 8%, rgba(${P.bloom},0.10), transparent 72%),
      linear-gradient(180deg, ${P.groundHigh} 0%, ${P.ground} 58%, #02040A 100%);
  }
  /* A restrained vignette so the corners settle. */
  .vig {
    position:absolute; inset:0;
    background:radial-gradient(120% 78% at 50% 42%, transparent 52%, rgba(0,0,0,0.42) 100%);
  }

  /* Anchored by its BOTTOM edge, not its top.
     A headline that wraps to two lines then grows UPWARD into the top margin
     instead of pushing the device down — so the device sits at exactly the
     same height in all ten frames. Anchoring from the top makes the phone jump
     between frames, which is the sort of thing that reads as "generated" even
     when no single frame looks wrong. */
  .head {
    position:absolute; bottom:${L.H - L.headBaseline}px; left:0; right:0;
    text-align:center; padding:0 ${L.headPad}px; z-index:4;
  }
  h1 {
    font-size:${L.h1}px; line-height:1.06; font-weight:700;
    letter-spacing:${L.h1Track}px; color:${P.headline};
  }
  /* ONE accent colour. The previous version ran a three-stop rainbow here. */
  h1 .acc { color:${P.accent}; }
  .sub {
    margin-top:${L.subGap}px; font-size:${L.sub}px; font-weight:500;
    line-height:1.32; color:${P.sub}; letter-spacing:${L.subTrack}px;
  }
  .stat {
    display:inline-block; margin-top:${L.pillGap}px;
    padding:${L.pillPadY}px ${L.pillPadX}px; border-radius:999px;
    font-size:${L.pill}px; font-weight:600; letter-spacing:${L.pillTrack}px;
    color:${P.pillText}; background:${P.pillFill};
    border:1px solid ${P.pillBorder};
  }

  /* One device, straight on, centred, fully contained. */
  .device {
    position:absolute; left:50%; top:${L.devTop}px;
    width:${L.devW}px; transform:translateX(-50%); z-index:3;
    padding:${L.bezel}px; border-radius:${L.devR}px;
    background:linear-gradient(155deg, #5A6274 0%, #2E3440 36%, #23272F 66%, #4A5265 100%);
    box-shadow:
      0 ${Math.round(L.devW * 0.10)}px ${Math.round(L.devW * 0.20)}px rgba(0,0,0,0.60),
      0 ${Math.round(L.devW * 0.03)}px ${Math.round(L.devW * 0.07)}px rgba(0,0,0,0.45);
  }
  /* A hairline inner edge — the only "shine" on the device, and it sits on the
     BEZEL, never across the screen. A gloss sweep over the UI hides the product. */
  .device::after {
    content:''; position:absolute; inset:${Math.round(L.bezel * 0.35)}px;
    border-radius:${L.devR - Math.round(L.bezel * 0.35)}px;
    border:1px solid rgba(255,255,255,0.10); pointer-events:none;
  }
  .screen { position:relative; border-radius:${L.scrR}px; overflow:hidden; background:#0B1220; }
  .screen img { display:block; width:100%; }

  /* The shadow that sits the device on the ground. */
  .contact {
    position:absolute; left:50%; transform:translateX(-50%);
    top:${L.shadowTop}px; width:${Math.round(L.devW * 0.94)}px; height:${L.shadowH}px;
    background:radial-gradient(closest-side, rgba(0,0,0,0.62), transparent 78%);
    filter:blur(${Math.round(L.shadowH * 0.22)}px); z-index:2;
  }
  </style></head><body><div class="canvas">
    <div class="bg"></div>
    <div class="vig"></div>
    <div class="head">
      <h1>${head}</h1>
      <div class="sub">${frame.sub}</div>
      <div><span class="stat">${frame.stat}</span></div>
    </div>
    <div class="contact"></div>
    <div class="device"><div class="screen"><img src="${shot}"></div></div>
  </div></body></html>`;
}
