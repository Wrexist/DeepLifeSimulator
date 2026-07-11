/**
 * Avatar look options — flat (today) vs a 2.5D lit treatment, plus the honest
 * road to a true-3D look. Every face is REAL DiceBear output; the "2.5D"
 * versions add a depth frame (contact shadow, radial light, gloss, rim) on top.
 * Shows how alive a FREE / infinite / offline generator can get — and where the
 * ceiling is (true 3D needs rendered art).
 *   node scripts/generate-avatar-styles.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { createAvatar } from '@dicebear/core';
import * as C from '@dicebear/collection';
import { ROOT, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

// Real generator output. avataaars is constrained to friendly expressions so we
// never ship a dizzy / crying / vomit face; other styles render as-is.
function raw(style, seed, px) {
  const friendly = style === 'avataaars'
    ? {
        mouth: ['smile', 'default', 'twinkle', 'serious'],
        eyes: ['default', 'happy', 'wink', 'squint'],
        eyebrows: ['default', 'defaultNatural', 'raisedExcited', 'flatNatural'],
        facialHairProbability: 20,
      }
    : {};
  return createAvatar(C[style], { seed, size: px, backgroundColor: ['transparent'], ...friendly }).toString();
}

// Flat chip — how the generator ships it (single tint bg, tiny drop shadow).
function flat(style, seed, px, bg = '#334155') {
  return `<div style="width:${px}px;height:${px}px;border-radius:50%;overflow:hidden;background:${bg};box-shadow:0 4px 10px -4px rgba(0,0,0,0.5);flex:0 0 auto;">${raw(style, seed, px)}</div>`;
}

// 2.5D lit treatment: contact shadow + radial light bg + face + gloss + rim.
function lit(style, seed, px, light = '#bfdbfe', deep = '#2563EB') {
  const glow = Math.round(px * 0.13);
  return `<div style="position:relative;width:${px}px;height:${px}px;flex:0 0 auto;">
    <div style="position:absolute;left:9%;right:9%;bottom:-4%;height:15%;border-radius:50%;background:rgba(0,0,0,0.5);filter:blur(${Math.max(5, glow)}px);"></div>
    <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 33% 25%, ${light}, ${deep});box-shadow:0 14px 26px -10px rgba(0,0,0,0.62), inset 0 -${glow}px ${glow * 2}px -${glow}px rgba(0,0,0,0.55), inset 0 ${glow}px ${Math.round(glow * 1.4)}px -${glow}px rgba(255,255,255,0.7);">
      ${raw(style, seed, px)}
      <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(148deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 44%);pointer-events:none;"></div>
      <div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.2);pointer-events:none;"></div>
    </div>
  </div>`;
}

function labeled(inner, name, sub) {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:9px;">${inner}<span style="color:#CBD5E1;font-size:12px;font-weight:600;">${name}</span>${sub ? `<span style="color:#64748B;font-size:10px;font-weight:500;margin-top:-4px;">${sub}</span>` : ''}</div>`;
}
function row(label, cells) {
  return `<div style="margin-bottom:26px;"><div style="color:#94A3B8;font-size:13px;font-weight:700;letter-spacing:0.4px;margin-bottom:16px;">${label}</div><div style="display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap;">${cells}</div></div>`;
}

const SEEDS = ['Ava', 'Marcus', 'Priya', 'Kai'];
// Mood-ring gradient pairs (light → deep). In production these could be
// state-driven: calm-blue when stable, green when thriving, amber when stressed.
const GRAD = [['#bfdbfe', '#2563EB'], ['#a7f3d0', '#047857'], ['#fbcfe8', '#be185d'], ['#fde68a', '#b45309']];
// Warm illustrated styles that render as a filled face on a colored fill
// (verified — line-art styles like lorelei/notionists/openPeeps go blank here).
const SOFT = ['micah', 'personas', 'miniavs', 'croodles'];

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Avatars — flat vs 2.5D, and the road to 3D',
  subtitle: 'Every face is real generated output. The hero shows the SAME face flat (as the generator ships it) vs a 2.5D lit treatment — a contact shadow, radial light, gloss and rim that make it read rounded and alive. Below: the treatment across seeds, and warmer illustrated styles.',
  body: `<div style="max-width:1140px;margin:30px auto 0;padding:36px 40px 24px;background:#0F172A;border-radius:24px;box-shadow:0 16px 40px rgba(0,0,0,0.55);">
      <div style="display:flex;gap:56px;align-items:flex-end;padding-bottom:30px;margin-bottom:30px;border-bottom:1px solid #1E293B;flex-wrap:wrap;">
        ${labeled(flat('avataaars', 'Ava', 150), 'Flat', 'how it ships today')}
        <div style="align-self:center;color:#475569;font-size:34px;font-weight:300;margin-bottom:26px;">&rarr;</div>
        ${labeled(lit('avataaars', 'Ava', 150, GRAD[0][0], GRAD[0][1]), '2.5D lit', 'depth + light + gloss + rim')}
        <div style="flex:1;min-width:220px;color:#94A3B8;font-size:14px;line-height:1.6;align-self:center;">Same seeded face — no new art. The frame adds a soft contact shadow so it sits <em>on</em> the surface, a radial light so it looks lit from the top-left, a gloss sweep, and a hairline rim. Flat sticker &rarr; a face with weight.</div>
      </div>
      ${row('2.5D LIT · same treatment across seeds (friendly-expression constrained)', SEEDS.map((s, i) => labeled(lit('avataaars', s, 100, GRAD[i][0], GRAD[i][1]), s)).join(''))}
      ${row('WARMER ILLUSTRATED STYLES · same 2.5D treatment (micah · personas · miniavs · croodles)', SOFT.map((st, i) => labeled(lit(st, SEEDS[i], 100, GRAD[i][0], GRAD[i][1]), st)).join(''))}
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:36px;flex-wrap:wrap;max-width:1080px;margin-left:auto;margin-right:auto;">
      ${legendItem('#60A5FA', 'Ship-now, free & infinite', 'A lit 2.5D treatment on a seed generator (micah / personas read warmest) is a legit premium mobile-game look — rounded, alive, and still infinite, offline, zero authored art. In-app add state-driven expression + a gentle idle breathe/blink.')}
      ${legendItem('#34D399', 'For a TRUE 3D / Pixar look', 'Seed art is fundamentally flat 2D — real depth needs rendered art. Best fit for you: an AI-generated 3D-style portrait library, exactly like your app-icon workflow. Prompt sheet is in docs/avatar-portraits-prompts.md.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'avatar-styles.png'), 1240);
console.log('wrote avatar-styles.png');
