/**
 * Pulse DM / messages screen — before/after the slate-glass rebuild.
 * BEFORE = near-black #0B0C10 base, Twitter-blue #1D9BF0, gray-800 #1F2937
 * bubbles, invisible dividers, flat. AFTER = slate #0F172A, app-blue #3B82F6,
 * distinct slate incoming bubbles, visible dividers, elevated bubbles+composer.
 *   node scripts/generate-dm-rebuild.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { phone, pageShell, legendItem, renderToPng, ROOT } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 18, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
};

function thread(t) {
  // t: { bg, incoming, outgoing, divider, muted, inputBg, name, sub, bubbleShadow, composerShadow, accent }
  const inMsg = (txt) => `<div style="align-self:flex-start;max-width:78%;background:${t.incoming};color:#F8FAFC;font-size:13px;line-height:1.4;padding:10px 13px;border-radius:16px;border-bottom-left-radius:5px;margin-bottom:10px;${t.bubbleShadow}">${txt}</div>`;
  const outMsg = (txt) => `<div style="align-self:flex-end;max-width:78%;background:${t.outgoing};color:#fff;font-size:13px;line-height:1.4;padding:10px 13px;border-radius:16px;border-bottom-right-radius:5px;margin-bottom:10px;${t.outShadow}">${txt}</div>`;
  return `<div style="flex:1;background:${t.bg};display:flex;flex-direction:column;overflow:hidden;">
    <div style="display:flex;align-items:center;gap:11px;padding:14px 15px;border-bottom:1px solid ${t.divider};">
      ${svg(I.back, '#F8FAFC', 18)}
      <div style="width:40px;height:40px;border-radius:20px;background:linear-gradient(135deg,#F43F5E,#FB923C);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;position:relative;">J<div style="position:absolute;bottom:0;right:0;width:11px;height:11px;border-radius:6px;background:#34D399;border:2px solid ${t.bg};"></div></div>
      <div style="flex:1;"><div style="color:#F8FAFC;font-size:15px;font-weight:800;">${t.name}</div><div style="color:${t.muted};font-size:11px;">${t.sub}</div></div>
    </div>
    <div style="flex:1;padding:15px 14px;display:flex;flex-direction:column;overflow:hidden;">
      ${inMsg('Hey! You still up for the meeting tomorrow?')}
      ${outMsg('Yeah, 10am works. Sending the deck tonight.')}
      ${inMsg('Perfect. Also — congrats on the promotion 🎉')}
      ${outMsg('Thanks! Big week.')}
      ${inMsg('Drinks to celebrate Friday?')}
    </div>
    <div style="display:flex;align-items:center;gap:9px;padding:11px 12px;border-top:1px solid ${t.divider};background:${t.bg};${t.composerShadow}">
      ${svg(I.plus, t.muted, 20)}
      <div style="flex:1;background:${t.inputBg};border-radius:20px;padding:10px 15px;color:${t.muted};font-size:13px;">Message…</div>
      <div style="width:38px;height:38px;border-radius:19px;background:${t.accent};display:flex;align-items:center;justify-content:center;">${svg(I.send, '#fff', 17, 2, '#fff')}</div>
    </div>
  </div>`;
}

const BEFORE = {
  bg: '#0B0C10', incoming: '#1F2937', outgoing: '#1D9BF0', divider: '#1F2937', muted: '#9CA3AF',
  inputBg: '#1F2937', name: 'Jordan Blake', sub: 'Active now', accent: '#1D9BF0',
  bubbleShadow: '', outShadow: '', composerShadow: '',
};
const AFTER = {
  bg: '#0F172A', incoming: '#334155', outgoing: '#3B82F6', divider: '#334155', muted: '#94A3B8',
  inputBg: '#1E293B', name: 'Jordan Blake', sub: 'Active now', accent: '#3B82F6',
  bubbleShadow: 'box-shadow:0 3px 6px -2px rgba(0,0,0,0.35);', outShadow: 'box-shadow:0 3px 8px -2px rgba(59,130,246,0.45);',
  composerShadow: 'box-shadow:0 -6px 16px rgba(0,0,0,0.4);',
};

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Pulse Messages — flat clone → slate-glass',
  subtitle: 'The DM screen was a fully un-themed Twitter/X clone (near-black base, Twitter-blue, gray-800 bubbles that blended into the background, no depth). Rebuilt on the app\'s slate + blue with distinct incoming bubbles, visible dividers, and elevation.',
  body: `<div style="display:flex;justify-content:center;gap:44px;margin-top:30px;flex-wrap:wrap;">
      ${phone(thread(BEFORE), { caption: 'Before · flat Twitter clone', captionColor: '#F87171', w: 310, h: 620 })}
      ${phone(thread(AFTER), { caption: 'After · slate-glass', captionColor: '#34D399', w: 310, h: 620 })}
    </div>
    <div style="display:flex;justify-content:center;gap:36px;margin-top:40px;flex-wrap:wrap;max-width:1000px;margin-left:auto;margin-right:auto;">
      ${legendItem('#3B82F6', 'On-brand & readable', 'Near-black → slate #0F172A, Twitter-blue → app-blue #3B82F6, and incoming bubbles get their own #334155 surface (were the same gray as the background, so they vanished). Dividers become visible slate hairlines.')}
      ${legendItem('#94A3B8', 'Actual depth', 'Bubbles lift off the thread and the composer bar casts an upward shadow, so it floats over the conversation instead of sitting dead-flat. Muted text moves to slate.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'dm-rebuild.png'), 1040);
console.log('wrote dm-rebuild.png');
