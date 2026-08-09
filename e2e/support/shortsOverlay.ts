import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * The caption / motion layer that turns raw gameplay into a finished Short.
 *
 * Everything is composited live in the page and captured by Playwright's
 * recorder, so the recording IS the finished video — no separate edit pass, and
 * no compositing tool needed in the container. The gameplay underneath stays
 * real captured footage, which is what both Apple's 2.3.3 and YouTube's
 * inauthentic-content policy care about.
 *
 * Layout is built around the Shorts safe zone. At the 540x960 CSS viewport
 * (1080x1920 at dpr 2) that means 90px clear at the top and 195px clear at the
 * bottom — the bottom being where the title, channel name and action buttons
 * sit. Captions live in the upper-middle band, never the bottom, which is the
 * mistake most mobile-game Shorts make.
 */

const ASSETS = resolve(__dirname, 'assets');

function b64(file: string): string {
  return readFileSync(resolve(ASSETS, file)).toString('base64');
}

/**
 * Render the app at true 1080x1920 while keeping its phone layout.
 *
 * Playwright's recorder captures at the page's CSS-pixel size — `deviceScaleFactor`
 * does not raise it — so a 540x960 viewport yields a 540x960 image dropped into
 * the top-left of the recording canvas. Simply using a 1080x1920 viewport does
 * not work either: `utils/scaling.ts` treats `min(w,h) >= 768` as a tablet and
 * switches clamp from 1.3x to 1.8x, so the app would lay out as a tablet.
 *
 * So: run a real 1080x1920 viewport, tell the app the window is 540x960 (which
 * keeps it under the tablet breakpoint and on the phone clamp), and `zoom: 2`
 * the document so those 540 CSS px of layout paint into 1080 device px.
 * Everything downstream — including this overlay's own geometry — is authored
 * in 540-space and doubled by the zoom.
 *
 * Must be installed before app code runs.
 */
export async function installHiDpi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'innerWidth', { get: () => 540, configurable: true });
    Object.defineProperty(window, 'innerHeight', { get: () => 960, configurable: true });
    const apply = () => document.documentElement.style.setProperty('zoom', '2');
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
    // The app can replace the root element during boot; keep re-asserting.
    setInterval(apply, 400);
  });
}

/** Safe-zone geometry in CSS px, in the 540x960 layout space (see installHiDpi). */
export const SAFE = {
  top: 90,
  bottom: 195,
  side: 30,
} as const;

export interface OverlayTheme {
  /** Accent used for the eyebrow and the end-card rule. */
  accent: string;
}

const DEFAULT_THEME: OverlayTheme = { accent: '#4F8EF7' };

/**
 * Inject the overlay before any app code runs.
 *
 * Fonts and the app icon are inlined as data URIs: the page has no outbound
 * network in this container, and a webfont that fails to load would silently
 * fall back to Arial metrics halfway through a capture.
 */
export async function installShortsOverlay(page: Page, theme: OverlayTheme = DEFAULT_THEME): Promise<void> {
  const payload = {
    font800: b64('inter-latin-800-normal.woff2'),
    font600: b64('inter-latin-600-normal.woff2'),
    icon: readFileSync(resolve(__dirname, '../../assets/icon.png')).toString('base64'),
    accent: theme.accent,
    safe: SAFE,
  };

  await page.addInitScript((p: typeof payload) => {
    const boot = () => {
      if (document.getElementById('__shorts_layer')) return;

      const style = document.createElement('style');
      style.textContent = `
@font-face{font-family:'ShortsSans';src:url(data:font/woff2;base64,${p.font800}) format('woff2');font-weight:800;font-style:normal;font-display:block}
@font-face{font-family:'ShortsSans';src:url(data:font/woff2;base64,${p.font600}) format('woff2');font-weight:600;font-style:normal;font-display:block}
#__shorts_layer{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:'ShortsSans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
#__shorts_layer *{box-sizing:border-box}
.sx-scrim-top{position:absolute;top:0;left:0;right:0;height:${p.safe.top + 150}px;background:linear-gradient(180deg,rgba(5,8,14,.92) 0%,rgba(5,8,14,.72) 45%,rgba(5,8,14,0) 100%);opacity:0;transition:opacity .35s ease}
.sx-scrim-bot{position:absolute;bottom:0;left:0;right:0;height:${p.safe.bottom}px;background:linear-gradient(0deg,rgba(5,8,14,.88) 0%,rgba(5,8,14,0) 100%);opacity:0;transition:opacity .35s ease}
.sx-scrim-top.on,.sx-scrim-bot.on{opacity:1}
.sx-cap{position:absolute;left:${p.safe.side}px;right:${p.safe.side}px;top:${p.safe.top + 18}px;text-align:center;opacity:0;transform:translateY(14px);transition:opacity .34s cubic-bezier(.2,.7,.2,1),transform .34s cubic-bezier(.2,.7,.2,1)}
.sx-cap.on{opacity:1;transform:translateY(0)}
.sx-eyebrow{font-weight:600;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:${p.accent};margin-bottom:8px;text-shadow:0 2px 12px rgba(0,0,0,.8)}
/* pre-line so a caption can force its own line break — automatic wrapping puts
   the break wherever it lands, which at this size looks like a mistake. */
.sx-line{font-weight:800;font-size:40px;line-height:1.06;letter-spacing:-.022em;color:#fff;text-shadow:0 3px 20px rgba(0,0,0,.85),0 1px 3px rgba(0,0,0,.9);white-space:pre-line}
.sx-sub{margin-top:10px;font-weight:600;font-size:19px;line-height:1.25;color:#D7DEEA;text-shadow:0 2px 14px rgba(0,0,0,.85)}
.sx-count{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%) scale(.94);text-align:center;opacity:0;transition:opacity .3s ease,transform .3s cubic-bezier(.2,.7,.2,1)}
.sx-count.on{opacity:1;transform:translateY(-50%) scale(1)}
.sx-count-v{font-weight:800;font-size:86px;letter-spacing:-.035em;color:#fff;text-shadow:0 6px 40px rgba(0,0,0,.9)}
.sx-count-l{margin-top:2px;font-weight:600;font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:${p.accent}}
.sx-end{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%,#16233b 0%,#080c14 62%,#05070c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .42s ease;padding-bottom:${p.safe.bottom - 40}px}
.sx-end.on{opacity:1}
.sx-end img{width:104px;height:104px;border-radius:23px;box-shadow:0 18px 50px rgba(0,0,0,.65);margin-bottom:22px}
.sx-end-t{font-weight:800;font-size:33px;letter-spacing:-.02em;color:#fff;text-align:center;line-height:1.1}
.sx-end-r{width:44px;height:3px;border-radius:2px;background:${p.accent};margin:16px 0}
.sx-end-s{font-weight:600;font-size:17px;color:#AFBBCE;text-align:center}
.sx-flash{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .09s linear}
/* Pure black, not near-black: the encoder finds the head and tail of the clip
   with ffmpeg blackdetect, and the app's very dark navy has to stay above the
   detection threshold. */
.sx-cover{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .18s linear}
.sx-cover.on{opacity:1}
`;
      document.head.appendChild(style);

      const layer = document.createElement('div');
      layer.id = '__shorts_layer';
      layer.innerHTML = `
<div class="sx-scrim-top"></div>
<div class="sx-scrim-bot"></div>
<div class="sx-cap"><div class="sx-eyebrow"></div><div class="sx-line"></div><div class="sx-sub"></div></div>
<div class="sx-count"><div class="sx-count-v"></div><div class="sx-count-l"></div></div>
<div class="sx-end"><img alt=""/><div class="sx-end-t"></div><div class="sx-end-r"></div><div class="sx-end-s"></div></div>
<div class="sx-flash"></div>
<div class="sx-cover on"></div>`;
      (document.body || document.documentElement).appendChild(layer);

      const q = <T extends Element>(s: string) => layer.querySelector(s) as T;
      const cap = q<HTMLElement>('.sx-cap');
      const count = q<HTMLElement>('.sx-count');
      const end = q<HTMLElement>('.sx-end');
      (q<HTMLImageElement>('.sx-end img')).src = `data:image/png;base64,${p.icon}`;

      let countTimer: number | undefined;

      const api = {
        /** Show a caption. `eyebrow` and `sub` are optional. */
        caption(line: string, opts?: { eyebrow?: string; sub?: string; scrim?: boolean }) {
          q<HTMLElement>('.sx-eyebrow').textContent = opts?.eyebrow ?? '';
          q<HTMLElement>('.sx-eyebrow').style.display = opts?.eyebrow ? 'block' : 'none';
          q<HTMLElement>('.sx-line').textContent = line;
          q<HTMLElement>('.sx-sub').textContent = opts?.sub ?? '';
          q<HTMLElement>('.sx-sub').style.display = opts?.sub ? 'block' : 'none';
          cap.classList.add('on');
          if (opts?.scrim !== false) q<HTMLElement>('.sx-scrim-top').classList.add('on');
        },
        clearCaption() {
          cap.classList.remove('on');
          q<HTMLElement>('.sx-scrim-top').classList.remove('on');
        },
        bottomScrim(on: boolean) {
          q<HTMLElement>('.sx-scrim-bot').classList.toggle('on', on);
        },
        /**
         * Animated money counter. Eases out so the last digits settle rather
         * than stopping dead — a linear count reads as a spreadsheet.
         */
        counter(from: number, to: number, ms: number, label: string) {
          const v = q<HTMLElement>('.sx-count-v');
          q<HTMLElement>('.sx-count-l').textContent = label;
          count.classList.add('on');
          const fmt = (n: number) =>
            n >= 1_000_000
              ? `$${(n / 1_000_000).toFixed(2)}M`
              : `$${Math.round(n).toLocaleString('en-US')}`;
          const t0 = performance.now();
          if (countTimer) cancelAnimationFrame(countTimer);
          const step = (now: number) => {
            const t = Math.min(1, (now - t0) / ms);
            const eased = 1 - Math.pow(1 - t, 3);
            v.textContent = fmt(from + (to - from) * eased);
            if (t < 1) countTimer = requestAnimationFrame(step);
          };
          countTimer = requestAnimationFrame(step);
        },
        hideCounter() {
          count.classList.remove('on');
        },
        endCard(title: string, sub: string) {
          q<HTMLElement>('.sx-end-t').textContent = title;
          q<HTMLElement>('.sx-end-s').textContent = sub;
          end.classList.add('on');
        },
        flash() {
          const f = q<HTMLElement>('.sx-flash');
          f.style.opacity = '0.85';
          setTimeout(() => (f.style.opacity = '0'), 90);
        },
        /**
         * Opaque cover, on by default.
         *
         * Playwright starts recording when the page is created, so the boot
         * sequence and all the setup navigation land in the file. Holding a
         * cover over them means the only thing before the first real frame is
         * flat black, which trims away cleanly and — if the trim lands a frame
         * early — reads as a fade rather than a glimpse of the loading screen.
         */
        cover(on: boolean) {
          q<HTMLElement>('.sx-cover').classList.toggle('on', on);
        },
      };

      (window as unknown as { __shorts: typeof api }).__shorts = api;
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
    // The app mounts asynchronously and can replace body children; re-assert.
    setInterval(boot, 500);
  }, payload);
}

/** Typed handle for driving the overlay from a spec. */
export interface ShortsApi {
  caption(line: string, opts?: { eyebrow?: string; sub?: string; scrim?: boolean }): void;
  clearCaption(): void;
  bottomScrim(on: boolean): void;
  counter(from: number, to: number, ms: number, label: string): void;
  hideCounter(): void;
  endCard(title: string, sub: string): void;
  flash(): void;
  cover(on: boolean): void;
}

/** Call an overlay method inside the page. */
export async function sx<K extends keyof ShortsApi>(
  page: Page,
  method: K,
  ...args: Parameters<ShortsApi[K]>
): Promise<void> {
  await page.evaluate(
    ({ m, a }) => {
      const api = (window as unknown as { __shorts?: Record<string, (...x: unknown[]) => void> }).__shorts;
      if (api && typeof api[m] === 'function') api[m](...a);
    },
    { m: method as string, a: args as unknown[] }
  );
}
