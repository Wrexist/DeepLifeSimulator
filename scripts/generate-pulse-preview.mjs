/**
 * generate-pulse-preview.mjs
 *
 * Renders a faithful BEFORE/AFTER of the Pulse home feed to a PNG, using the
 * app's real design tokens (dark900 bg, dark800 cards, magenta→indigo brand
 * gradient, danger/success engagement colors). Not a screenshot of the running
 * app — a high-fidelity mock built from the same components/tokens so the diff
 * is legible.
 *
 *   node scripts/generate-pulse-preview.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Real tokens ──────────────────────────────────────────────────────────────
const BG = '#0F172A';        // dark900 background
const SURFACE = '#1E293B';   // dark800 card / surface
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT = '#FFFFFF';
const TEXT2 = '#CBD5E1';     // light300 secondary
const MUTED = '#64748B';     // dark500
const G0 = '#EC4899';        // brand magenta / reputation / like accent
const G1 = '#6366F1';        // brand indigo / verified
const LIKE = '#EF4444';
const REPOST = '#10B981';
const GRAD = `linear-gradient(120deg, ${G0}, ${G1})`;

function faceURI(name) {
  const b64 = readFileSync(resolve(ROOT, 'assets/images/Face', name)).toString('base64');
  return `data:image/png;base64,${b64}`;
}
const FACE = {
  you: faceURI('Female.png'),
  maria: faceURI('Old_Female.png'),
  jordan: faceURI('Male.png'),
};

// ── Small view helpers ───────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function avatarFace(uri, size) {
  return `<img src="${uri}" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;object-fit:cover;object-position:center top;"/>`;
}
function avatarInitial(letter, size, bg) {
  return `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${size * 0.42}px;">${letter}</div>`;
}
function verifiedTick() {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:7px;background:${GRAD};margin-left:4px;vertical-align:middle;">
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
}

// engagement icons (lucide-ish)
const heart = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${c === LIKE ? LIKE : 'none'}" stroke="${c}" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;
const comment = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.9A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`;
const repost = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
const zap = () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${G0}" stroke="${G0}" stroke-width="1.5"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>`;

function engRow({ likes, comments, reposts, liked = false, boost = false }) {
  const item = (icon, count, color) =>
    `<div style="display:flex;align-items:center;gap:6px;padding:0 8px;">${icon}<span style="font-size:12px;font-weight:600;color:${color};">${count}</span></div>`;
  return `<div style="display:flex;align-items:center;justify-content:space-around;margin-top:12px;">
    ${item(heart(liked ? LIKE : TEXT2), likes, liked ? LIKE : TEXT2)}
    ${item(comment(TEXT2), comments, TEXT2)}
    ${item(repost(TEXT2), reposts, TEXT2)}
    ${boost ? `<div style="display:flex;align-items:center;gap:6px;padding:0 8px;">${zap()}<span style="font-size:12px;font-weight:600;color:${G0};">Boost</span></div>` : ''}
  </div>`;
}

function postCard({ avatar, handle, time, verified = false, viral = false, content, likes, comments, reposts, liked = false, boost = false, badge = '' }) {
  const frame = viral
    ? `border-radius:14px;padding:1.5px;background:${GRAD};margin:5px 12px;`
    : `margin:5px 12px;`;
  const inner = `background:${SURFACE};border:1px solid ${BORDER};border-radius:13px;padding:12px;`;
  return `<div style="${frame}"><div style="${inner}">
    <div style="display:flex;align-items:center;gap:10px;">
      ${avatar}
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:${TEXT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${esc(handle)}${verified ? verifiedTick() : ''}</div>
        <div style="font-size:11px;color:${TEXT2};margin-top:1px;">${time}</div>
      </div>
      ${viral ? `<div style="background:${G0};padding:2px 6px;border-radius:4px;"><span style="color:#fff;font-size:9px;font-weight:800;letter-spacing:0.6px;">VIRAL</span></div>` : ''}
      ${badge}
    </div>
    <div style="font-size:14px;line-height:20px;color:${TEXT};margin-top:8px;">${esc(content)}</div>
    ${engRow({ likes, comments, reposts, liked, boost })}
  </div></div>`;
}

function storyBubble(inner, label, ring) {
  return `<div style="display:flex;flex-direction:column;align-items:center;width:72px;gap:4px;flex:0 0 auto;">
    <div style="width:60px;height:60px;border-radius:30px;${ring};display:flex;align-items:center;justify-content:center;box-sizing:border-box;">${inner}</div>
    <div style="font-size:10px;font-weight:500;color:${TEXT};white-space:nowrap;">${label}</div>
  </div>`;
}

function storiesRail() {
  const you = `<div style="position:relative;width:56px;height:56px;">${avatarFace(FACE.you, 56)}
    <div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-radius:10px;background:${G0};border:2px solid ${BG};display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;line-height:1;">+</div></div>`;
  return `<div style="border-bottom:1px solid ${BORDER};"><div style="display:flex;gap:12px;padding:8px 16px;overflow:hidden;">
    ${storyBubble(you, 'You', `border:2px solid ${BORDER}`)}
    ${storyBubble(avatarFace(FACE.maria, 54), 'Maria', `border:2px solid ${G0}`)}
    ${storyBubble(avatarFace(FACE.jordan, 54), 'Jordan', `border:2px solid ${G0}`)}
    ${storyBubble(avatarInitial('H', 54, GRAD), 'Harper', `border:2px solid ${G0}`)}
  </div></div>`;
}

function header() {
  return `<div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid ${BORDER};">
    <div style="width:40px;color:${TEXT};font-size:22px;">‹</div>
    <div style="flex:1;display:flex;justify-content:center;">
      <div style="background:${GRAD};padding:4px 12px;border-radius:8px;"><span style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.4px;">pulse</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">${avatarFace(FACE.you, 28)}<span style="color:${TEXT};font-size:13px;font-weight:700;">1.2K</span></div>
  </div>`;
}

function composer() {
  return `<div style="display:flex;align-items:flex-start;gap:8px;margin:8px 16px 4px;padding:8px 16px;border-radius:13px;background:${SURFACE};border:1px solid ${BORDER};">
    ${avatarFace(FACE.you, 32)}
    <div style="flex:1;font-size:14px;color:${TEXT2};padding-top:6px;">What's on your mind?</div>
    <div style="color:${TEXT2};font-size:18px;padding-top:2px;">›</div>
  </div>`;
}

function tabBar({ flush }) {
  const tab = (icon, label, active) =>
    `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="color:${active ? TEXT : MUTED};">${icon}</div>
      <div style="font-size:10px;color:${active ? TEXT : MUTED};font-weight:${active ? 600 : 400};">${label}</div>
    </div>`;
  const home = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>`;
  const flame = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S6 10 6 14a6 6 0 0 0 12 0c0-6-6-12-6-12z"/></svg>`;
  const bell = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;
  const mail = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`;
  // flush=true → bar owns the safe-area inset (padding inside, reaches screen edge)
  // flush=false → bar has only its own padding; a dead strip of BG shows below it
  const pad = flush ? 'padding:6px 16px 30px;' : 'padding:6px 16px 10px;';
  return `<div style="display:flex;align-items:center;justify-content:space-between;background:${SURFACE};border-top:1px solid ${BORDER};${pad}">
    ${tab(home, 'Home', true)}
    ${tab(flame, 'Trending', false)}
    <div style="width:56px;"></div>
    ${tab(bell, 'Alerts', false)}
    ${tab(mail, 'DMs', false)}
  </div>`;
}

function fab(bottom) {
  return `<div style="position:absolute;right:20px;bottom:${bottom}px;width:56px;height:56px;border-radius:28px;background:${GRAD};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(236,72,153,0.45);z-index:5;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"><path d="M12 5v14M5 12h14"/></svg></div>`;
}

const PLAYER_POST = postCard({
  avatar: avatarFace(FACE.you, 36), handle: 'you', time: 'now',
  content: 'Just closed my first big deal at work 🎉 grinding finally paying off',
  likes: 12, comments: 3, reposts: 1, liked: true, boost: true,
});

// AFTER feed: player post + interleaved NPC (relationship) + trending (unknown)
const AFTER_FEED = [
  PLAYER_POST,
  postCard({ avatar: avatarFace(FACE.maria, 36), handle: 'maria', time: 'now',
    content: 'Coffee and good vibes ☕ grateful for another beautiful day', likes: 18, comments: 2, reposts: 3 }),
  postCard({ avatar: avatarInitial('H', 36, 'linear-gradient(135deg,#6366F1,#22D3EE)'), handle: 'harperw', time: '1w', verified: true,
    content: 'New restaurant opened nearby, can\'t wait to try it!', likes: 214, comments: 15, reposts: 22 }),
  postCard({ avatar: avatarInitial('P', 36, 'linear-gradient(135deg,#EC4899,#F59E0B)'), handle: 'phoenixl', time: '1w', verified: true, viral: true,
    content: 'Working on something exciting, stay tuned! Big announcement soon 👀', likes: '3.2K', comments: 128, reposts: 402 }),
  postCard({ avatar: avatarFace(FACE.jordan, 36), handle: 'jordant', time: '2w',
    content: 'Grinding every single day! Dreams don\'t work unless you do 💪', likes: 9, comments: 1, reposts: 0 }),
];

function phone({ caption, tone, feed, flush, fabBottom, deadStrip }) {
  const captionColor = tone === 'after' ? REPOST : MUTED;
  const feedHtml = feed.join('');
  const filler = deadStrip
    ? `<div style="flex:1;"></div>` // empty dead space in BEFORE
    : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
    <div style="font-size:15px;font-weight:800;letter-spacing:1px;color:${captionColor};text-transform:uppercase;">${caption}</div>
    <div style="position:relative;width:320px;height:660px;border-radius:44px;background:#000;padding:11px;box-shadow:0 30px 70px rgba(0,0,0,0.55);">
      <div style="position:relative;width:100%;height:100%;border-radius:34px;overflow:hidden;background:${BG};display:flex;flex-direction:column;">
        <!-- status bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 22px 2px;color:${TEXT};font-size:12px;font-weight:600;">
          <span>9:41</span>
          <span style="display:flex;gap:5px;align-items:center;">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4" y="5" width="3" height="6" rx="1"/><rect x="8" y="3" width="3" height="8" rx="1"/><rect x="12" y="1" width="3" height="10" rx="1"/></svg>
            <svg width="22" height="11" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="20" height="10" rx="3" stroke="#fff" opacity="0.6"/><rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="#fff"/><rect x="22" y="4" width="1.5" height="4" rx="0.75" fill="#fff"/></svg>
          </span>
        </div>
        ${header()}
        <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;">
          ${storiesRail()}
          ${composer()}
          ${feedHtml}
          ${filler}
        </div>
        ${fab(fabBottom)}
        ${tabBar({ flush })}
      </div>
    </div>
  </div>`;
}

function page() {
  const before = phone({
    caption: 'Before', tone: 'before',
    feed: [PLAYER_POST],
    flush: false, fabBottom: 74, deadStrip: true,
  });
  const after = phone({
    caption: 'After', tone: 'after',
    feed: AFTER_FEED,
    flush: true, fabBottom: 96, deadStrip: false,
  });
  const dot = (c) => `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${c};margin-right:8px;flex:0 0 auto;margin-top:5px;"></span>`;
  const legendItem = (c, title, body) =>
    `<div style="display:flex;align-items:flex-start;max-width:330px;">${dot(c)}<div><div style="color:${TEXT};font-weight:700;font-size:15px;">${title}</div><div style="color:${TEXT2};font-size:13px;line-height:19px;margin-top:2px;">${body}</div></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,'SF Pro Display','Segoe UI',Inter,system-ui,sans-serif;background:radial-gradient(1200px 700px at 50% 0%, #16233b 0%, #0a1120 60%, #070c17 100%);padding:56px 48px 48px;}
    </style></head><body>
    <div style="text-align:center;margin-bottom:8px;">
      <div style="color:${TEXT};font-size:30px;font-weight:800;letter-spacing:-0.5px;">Pulse feed — full-screen &amp; alive</div>
      <div style="color:${TEXT2};font-size:15px;margin-top:8px;">The home feed now interleaves your posts with people you know and what's trending.</div>
    </div>
    <div style="display:flex;justify-content:center;gap:64px;margin-top:36px;">
      ${before}
      ${after}
    </div>
    <div style="display:flex;justify-content:center;gap:46px;margin-top:52px;flex-wrap:wrap;">
      ${legendItem(G0, 'Feed filled with life', 'Was one lonely post. Now your posts interleave with NPC friends (Maria, Jordan) and trending/verified profiles — newest week first.')}
      ${legendItem(REPOST, 'Real, responsive taps', 'Likes &amp; reposts on ambient posts toggle instantly — their hearts fill and counts move, no dead buttons.')}
      ${legendItem(G1, 'Tab bar sits flush', 'The bar now owns the safe-area inset and reaches the screen edge — no empty strip floating beneath it.')}
    </div>
  </body></html>`;
}

const OUT = resolve(ROOT, 'screenshots/pulse-feed-before-after.png');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1160, height: 1180 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.setContent(page(), { waitUntil: 'networkidle' });
const el = await p.$('body');
const box = await el.boundingBox();
await p.setViewportSize({ width: 1160, height: Math.ceil(box.height) });
writeFileSync(OUT, await p.screenshot({ clip: { x: 0, y: 0, width: 1160, height: Math.ceil(box.height) } }));
await browser.close();
console.log('wrote', OUT);
