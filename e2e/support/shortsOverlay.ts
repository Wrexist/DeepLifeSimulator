import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { SCENE_SOURCE } from './shortsScene';

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
export async function installHiDpi(page: Page, zoom = 2): Promise<void> {
  await page.addInitScript((z: number) => {
    Object.defineProperty(window, 'innerWidth', { get: () => 540, configurable: true });
    Object.defineProperty(window, 'innerHeight', { get: () => 960, configurable: true });
    const apply = () => document.documentElement.style.setProperty('zoom', String(z));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
    // The app can replace the root element during boot; keep re-asserting.
    setInterval(apply, 400);
  }, zoom);
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
  // The 3D scene has to mount underneath `#root`, so it goes in first.
  await page.addInitScript({ content: SCENE_SOURCE });

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
/* The end card is TRANSPARENT: the app fades out beneath it and the live 3D
   scene (shortsScene.ts) becomes the backdrop. Painting a flat gradient here
   would just hide the thing that makes the ending feel like a place. */
.sx-end{position:absolute;inset:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .5s ease;padding-bottom:${p.safe.bottom - 40}px}
.sx-end.on{opacity:1}
/* Real 3D: the icon sits on its own perspective plane and rocks slowly, with a
   cast shadow and a specular sweep, so it reads as an object in the scene
   rather than a PNG pasted on top. */
.sx-end-stage{perspective:900px;perspective-origin:50% 42%;margin-bottom:26px}
.sx-end-obj{position:relative;width:112px;height:112px;transform-style:preserve-3d;animation:sxfloat 7s ease-in-out infinite alternate}
@keyframes sxfloat{
  0%{transform:rotateY(-13deg) rotateX(7deg) translateY(4px)}
  100%{transform:rotateY(13deg) rotateX(-3deg) translateY(-6px)}
}
.sx-end-obj img{width:112px;height:112px;border-radius:25px;display:block;
  box-shadow:0 26px 60px rgba(0,0,0,.72),0 6px 18px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.09) inset}
.sx-end-gloss{position:absolute;inset:0;border-radius:25px;pointer-events:none;
  background:linear-gradient(128deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.06) 32%,rgba(255,255,255,0) 55%)}
.sx-end-halo{position:absolute;left:50%;top:56%;width:230px;height:230px;transform:translate(-50%,-50%) translateZ(-60px);
  background:radial-gradient(circle,rgba(79,142,247,.30) 0%,rgba(79,142,247,0) 68%);filter:blur(2px)}
.sx-end-t{font-weight:800;font-size:34px;letter-spacing:-.022em;color:#fff;text-align:center;line-height:1.1;text-shadow:0 4px 26px rgba(0,0,0,.7)}
.sx-end-r{width:46px;height:3px;border-radius:2px;background:${p.accent};margin:16px 0;box-shadow:0 0 18px ${p.accent}}
.sx-end-s{font-weight:600;font-size:17px;color:#C2CCDC;text-align:center;text-shadow:0 2px 16px rgba(0,0,0,.7)}
.sx-flash{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .09s linear}
/* Pure black, not near-black: the encoder finds the head and tail of the clip
   with ffmpeg blackdetect, and the app's very dark navy has to stay above the
   detection threshold. */
.sx-cover{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .12s linear}
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
<div class="sx-end">
  <div class="sx-end-stage"><div class="sx-end-obj"><div class="sx-end-halo"></div><img alt=""/><div class="sx-end-gloss"></div></div></div>
  <div class="sx-end-t"></div><div class="sx-end-r"></div><div class="sx-end-s"></div>
</div>
<div class="sx-flash"></div>
<div class="sx-cover on"></div>`;
      (document.body || document.documentElement).appendChild(layer);

      // A React Native Modal portals to the end of <body>, so a sheet opened
      // mid-capture lands after the overlay and covers the captions. Keep the
      // overlay pinned last.
      setInterval(() => {
        const b = document.body;
        if (b && b.lastElementChild !== layer) b.appendChild(layer);
      }, 250);

      const q = <T extends Element>(s: string) => layer.querySelector(s) as T;
      const cap = q<HTMLElement>('.sx-cap');
      const count = q<HTMLElement>('.sx-count');
      const end = q<HTMLElement>('.sx-end');
      (q<HTMLImageElement>('.sx-end img')).src = `data:image/png;base64,${p.icon}`;

      let countTimer: number | undefined;

      /**
       * Find a text element that is genuinely ON SCREEN.
       *
       * `offsetParent !== null` is not enough and neither is Playwright's
       * visibility check: React Navigation keeps inactive screens mounted, so
       * several copies of a label can pass both while sitting behind the screen
       * the viewer is looking at. Tapping one of those is how Short 03 kept
       * filming the Health tab while the script talked about the family tree.
       *
       * elementFromPoint at the label's own centre is the honest test: it
       * answers "is this the thing a finger would actually hit".
       */
      const findOnScreen = (label: string, exact = true): HTMLElement | null => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('div,span,a,button'));
        for (const el of nodes) {
          if (el.children.length !== 0) continue;
          const text = (el.textContent ?? '').trim();
          // Taps match exactly (clicking the wrong control is expensive);
          // assertions match on substring, because on-screen copy is usually a
          // fragment of a longer line.
          if (exact ? text !== label : !text.includes(label)) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // NOT window.innerWidth: installHiDpi fakes that to 540x960 to keep the
          // app on its phone layout. Measured under `zoom: 4`,
          // documentElement.clientWidth is the FULL 2160 and
          // getBoundingClientRect/elementFromPoint both report in that same
          // 2160-wide space, so they agree with each other and with this bound.
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;
          if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
          const top = document.elementFromPoint(cx, cy);
          if (!top) continue;
          // Not a strict identity test: React Native Web's pressables render an
          // absolutely-positioned press-state overlay as a SIBLING of the
          // label, so the topmost node at the label's centre is often neither
          // the label nor one of its ancestors. Accept anything sharing a close
          // ancestor — still proves the label is the thing on top here, without
          // rejecting every tile in the app launcher.
          let anc: HTMLElement | null = el;
          for (let up = 0; up < 4 && anc; up++, anc = anc.parentElement) {
            if (anc === top || anc.contains(top) || top.contains(anc)) return el;
          }
        }
        return null;
      };

      /**
       * The tappable rows of a Life Moment.
       *
       * The options are not exposed as role=button, so they cannot be found by
       * role. React Native Web does put `cursor: pointer` on every pressable,
       * which is a reliable structural signal — take the modal card (the
       * nearest ancestor of the title that holds the whole dialog) and collect
       * its pointer-cursor descendants, outermost first.
       */
      const momentChoices = (): HTMLElement[] => {
        const title = Array.from(document.querySelectorAll<HTMLElement>('div,span')).find(
          (e) => e.children.length === 0 && (e.textContent ?? '').trim() === 'Life Moment'
        );
        if (!title) return [];
        let card: HTMLElement | null = title;
        for (let i = 0; i < 6 && card; i++, card = card.parentElement) {
          if (card.querySelectorAll('*').length > 8) break;
        }
        if (!card) return [];
        const rows = Array.from(card.querySelectorAll<HTMLElement>('*')).filter((e) => {
          if (getComputedStyle(e).cursor !== 'pointer') return false;
          const r = e.getBoundingClientRect();
          return r.width > 40 && r.height > 20;
        });
        // Drop rows nested inside an already-collected row, so each option counts once.
        return rows.filter((e) => !rows.some((o) => o !== e && o.contains(e)));
      };

      /** Every top-level element the app owns — `#root` plus any portalled modal. */
      const appLayers = (): HTMLElement[] =>
        Array.from(document.body.children).filter(
          (el): el is HTMLElement =>
            el instanceof HTMLElement && el.id !== '__shorts_bg' && el.id !== '__shorts_layer'
        );

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
        /**
         * Camera move on the app itself.
         *
         * Transforms `#root`, so the running app becomes an object inside the
         * 3D scene rather than the whole frame. Pulling back reveals the scene
         * behind it and rounds/shadows the edge so it reads as a device.
         */
        camera(o: { scale?: number; rotY?: number; rotX?: number; y?: number; ms?: number }) {
          const scale = o.scale ?? 1;
          const pulled = scale < 0.995;
          const transform =
            `perspective(1500px) translateY(${o.y ?? 0}px) rotateY(${o.rotY ?? 0}deg) rotateX(${o.rotX ?? 0}deg) scale(${scale})`;
          // Every app-owned top-level layer, not just #root: React Native
          // Modals (the Family sheet, for one) portal to <body> as siblings, so
          // transforming #root alone left them full-bleed and unmoved while the
          // rest of the app receded.
          appLayers().forEach((el) => {
            el.style.transformOrigin = '50% 46%';
            el.style.willChange = 'transform, opacity';
            el.style.transition = `transform ${o.ms ?? 1200}ms cubic-bezier(.22,.7,.2,1), opacity 420ms ease, border-radius 600ms ease, box-shadow 600ms ease`;
            el.style.transform = transform;
            el.style.borderRadius = pulled ? '30px' : '0px';
            el.style.boxShadow = pulled
              ? '0 70px 130px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.07)'
              : 'none';
            el.style.overflow = pulled ? 'hidden' : '';
          });
        },
        /**
         * End card: dissolve the app away so the 3D scene is the backdrop, then
         * bring the card up over it.
         */
        endCard(title: string, sub: string) {
          q<HTMLElement>('.sx-end-t').textContent = title;
          q<HTMLElement>('.sx-end-s').textContent = sub;
          appLayers().forEach((el) => {
            el.style.transition = 'transform 900ms cubic-bezier(.22,.7,.2,1), opacity 620ms ease';
            el.style.transform = 'perspective(1500px) scale(0.86) translateY(-12px)';
            el.style.opacity = '0';
          });
          end.classList.add('on');
        },
        flash() {
          const f = q<HTMLElement>('.sx-flash');
          f.style.opacity = '0.85';
          setTimeout(() => (f.style.opacity = '0'), 90);
        },
        /**
         * Click by label from inside the page.
         *
         * Playwright clicks by viewport coordinate, and with `zoom: 4` on the
         * document those coordinates and the element's real position diverge.
         * Full-width targets like the tab bar survive the error; a 64x22 CSS
         * sub-tab does not — which is how Short 03 spent a take filming the
         * Health tab. Dispatching the pointer sequence directly at the node
         * removes coordinates from the problem entirely.
         */
        tapText(label: string, mode: 'pointer' | 'native' = 'pointer') {
          const hit = findOnScreen(label);
          if (!hit) throw new Error(`[shorts] no on-screen element with text "${label}"`);

          const rect = hit.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          // React Native Web's responder system ignores a pointer event that is
          // not primary, so pointerId/isPrimary/buttons are required — a bare
          // `new PointerEvent('pointerdown')` defaults to isPrimary:false and
          // gets dropped on the floor.
          const base = {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: cx,
            clientY: cy,
            button: 0,
            view: window,
          };
          const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };

          // Dispatch on the text node's clickable ancestors too: the pressable
          // is usually a wrapper, and some handlers are attached there rather
          // than relying on the event bubbling.
          const targets: HTMLElement[] = [hit];
          let cur: HTMLElement | null = hit.parentElement;
          for (let i = 0; i < 3 && cur; i++, cur = cur.parentElement) targets.push(cur);

          const el = targets[0];
          // Exactly ONE activation path per call. Firing both a synthetic
          // pointer sequence and a native click counts as two presses: it
          // opened the Family sheet and toggled it straight back shut. But the
          // two paths are not interchangeable either — the in-app launcher
          // icons only respond to the native click. So the caller picks, and
          // `tap()` in the spec falls back from one to the other.
          if (mode === 'native') {
            el.click();
            return;
          }
          el.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
          el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
          el.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('click', { ...base, detail: 1 }));
        },
        /**
         * Is a Life Moment decision on screen?
         *
         * These fire from the weekly tick and block everything until answered,
         * so the capture has to know about them — and they are also the single
         * best thing to film, being the game's "every choice costs something"
         * pitch rendered as an actual modal with prices on it.
         */
        hasMoment() {
          const t = Array.from(document.querySelectorAll<HTMLElement>('div,span')).find(
            (e) => e.children.length === 0 && (e.textContent ?? '').trim() === 'Life Moment'
          );
          return !!(t && t.offsetParent !== null);
        },
        /** Text of the Life Moment's options, in order. */
        momentOptions() {
          return momentChoices().map((e) => (e.textContent ?? '').trim().slice(0, 60));
        },
        /** Answer the Life Moment by choosing option `index`. */
        pickMoment(index: number) {
          const choices = momentChoices();
          const el = choices[index];
          if (!el) throw new Error(`[shorts] Life Moment has no option ${index} (found ${choices.length})`);
          const r = el.getBoundingClientRect();
          const base = {
            bubbles: true, cancelable: true, composed: true,
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
            button: 0, view: window,
          };
          const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
          el.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
          el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
          el.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('click', { ...base, detail: 1 }));
        },
        /** Is a label actually the topmost thing at its own centre? */
        onScreen(label: string) {
          return findOnScreen(label, false) !== null;
        },
        /**
         * Scroll inside the page rather than from the test.
         *
         * `page.mouse.wheel` is one round-trip per step, and at a 2160x3840
         * viewport twenty of them cost several seconds of wall clock — which
         * lands in the recording as an unplanned pause. This dispatches the
         * same wheel events from a rAF loop, so it costs one round-trip and
         * runs at the page's own frame rate.
         */
        scroll(dy: number, ms: number) {
          const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.6);
          if (!target) return;
          const t0 = performance.now();
          let sent = 0;
          const step = (now: number) => {
            const t = Math.min(1, (now - t0) / ms);
            // ease-in-out, so the scroll starts and stops softly
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const want = dy * eased;
            const delta = want - sent;
            if (Math.abs(delta) >= 0.5) {
              target.dispatchEvent(
                new WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true })
              );
              sent = want;
            }
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
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
  camera(o: { scale?: number; rotY?: number; rotX?: number; y?: number; ms?: number }): void;
  scroll(dy: number, ms: number): void;
  tapText(label: string, mode?: 'pointer' | 'native'): void;
  onScreen(label: string): boolean;
  hasMoment(): boolean;
  momentOptions(): string[];
  pickMoment(index: number): void;
}

/** Call an overlay method inside the page. */
export async function sx<K extends keyof ShortsApi>(
  page: Page,
  method: K,
  ...args: Parameters<ShortsApi[K]>
): Promise<void> {
  // Throws rather than no-ops. A silently dropped overlay call is invisible
  // until you are staring at a finished clip wondering where the end card went.
  await page.evaluate(
    ({ m, a }) => {
      const api = (window as unknown as { __shorts?: Record<string, (...x: unknown[]) => void> }).__shorts;
      if (!api) throw new Error(`[shorts] overlay not installed when calling ${m}`);
      if (typeof api[m] !== 'function') throw new Error(`[shorts] no overlay method ${m}`);
      api[m](...a);
    },
    { m: method as string, a: args as unknown[] }
  );
}

/** Like `sx`, but returns the overlay method's result. */
export async function sxQuery<T>(page: Page, method: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ({ m, a }) => {
      const api = (window as unknown as { __shorts?: Record<string, (...x: unknown[]) => unknown> }).__shorts;
      if (!api) throw new Error(`[shorts] overlay not installed when calling ${m}`);
      if (typeof api[m] !== 'function') throw new Error(`[shorts] no overlay method ${m}`);
      return api[m](...a);
    },
    { m: method, a: args }
  ) as Promise<T>;
}
