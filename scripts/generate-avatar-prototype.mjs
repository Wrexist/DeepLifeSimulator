/**
 * Avatar system PROTOTYPE — real DiceBear (avataaars) output, composed into the
 * proposed Customize builder + Spark + Pulse + Family screens. Every face here
 * is generated from a seed/options; nothing is hand-drawn. Demonstrates:
 *  - character customization via live option pickers,
 *  - infinite seeded NPC crowds (Spark, Pulse),
 *  - hero characters + a genetics-inherited kid (Mom's skin + Dad's hair).
 *   node scripts/generate-avatar-prototype.mjs   (requires @dicebear/core@9 + collection@9)
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { ROOT, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const BG = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf', 'ffd5dc', 'c1f4d5', 'a0e7e5', 'fbc4ab'];
function av(opts, px) {
  const svg = createAvatar(avataaars, {
    size: px, radius: 50, backgroundColor: BG,
    ...opts,
    ...(opts.skinColor ? { skinColor: [opts.skinColor] } : {}),
    ...(opts.top ? { top: [opts.top] } : {}),
    ...(opts.hairColor ? { hairColor: [opts.hairColor] } : {}),
    ...(opts.eyes ? { eyes: [opts.eyes] } : {}),
    ...(opts.facialHair ? { facialHair: [opts.facialHair], facialHairProbability: 100 } : {}),
    ...(opts.accessories ? { accessories: [opts.accessories], accessoriesProbability: 100 } : {}),
    ...(opts.bg ? { backgroundColor: [opts.bg] } : {}),
  }).toString();
  return `<div style="width:${px}px;height:${px}px;border-radius:50%;overflow:hidden;flex:0 0 auto;box-shadow:0 4px 10px -3px rgba(0,0,0,0.5);">${svg}</div>`;
}
const svgIcon = (p, c, s = 16, sw = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = { back: '<path d="M15 18l-6-6 6-6"/>', dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/>', heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>', dna: '<path d="M4 3c0 6 16 6 16 12M20 3c0 6-16 6-16 12M5 8h14M5 16h14"/>' };

const bg = () => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#0F172A,#111c30);"></div>`;
function head(title) { return `<div style="display:flex;align-items:center;gap:11px;padding:14px 15px 8px;position:relative;">${svgIcon(IC.back, '#F1F5F9', 18)}<div style="flex:1;color:#F8FAFC;font-size:18px;font-weight:800;">${title}</div></div>`; }
function frame(inner) { return `<div style="flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;">${bg()}<div style="position:relative;flex:1;display:flex;flex-direction:column;">${inner}</div></div>`; }
function card(inner, m = '0 15px 12px', p = 14) { return `<div style="border-radius:16px;background:#1E293B;border:1px solid rgba(255,255,255,0.06);box-shadow:0 12px 26px -14px rgba(0,0,0,0.7);padding:${p}px;margin:${m};">${inner}</div>`; }

// ── 1. Customize builder ──
const YOU = { seed: 'you', skinColor: 'edb98a', top: 'shortFlat', hairColor: '4a312c', eyes: 'default', accessories: 'prescription02', bg: 'c0aede' };
function pickerRow(label, items) {
  return `<div style="margin-top:13px;"><div style="color:#94A3B8;font-size:10.5px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;">${label}</div><div style="display:flex;gap:10px;align-items:center;">${items}</div></div>`;
}
function swatch(hex, sel) { return `<div style="width:30px;height:30px;border-radius:15px;background:#${hex};border:2px solid ${sel ? '#60A5FA' : 'rgba(255,255,255,0.15)'};${sel ? 'box-shadow:0 0 0 2px rgba(96,165,250,0.3);' : ''}"></div>`; }
function miniPick(opts, sel) { return `<div style="border-radius:50%;padding:2px;border:2px solid ${sel ? '#60A5FA' : 'transparent'};">${av(opts, 44)}</div>`; }
function customize() {
  const skins = ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29', '614335'];
  const hairColors = ['2c1b18', '4a312c', 'a55728', 'b58143', 'ecdcbf'];
  const hairStyles = ['shortFlat', 'bigHair', 'bob', 'dreads01'];
  const eyeStyles = ['default', 'happy', 'wink', 'squint'];
  const preview = `<div style="display:flex;flex-direction:column;align-items:center;">${av(YOU, 132)}<div style="color:#F8FAFC;font-size:15px;font-weight:800;margin-top:10px;">Your Character</div><div style="color:#94A3B8;font-size:11px;">Looks good — save when ready</div></div>`;
  const body = card(`
    ${pickerRow('SKIN', skins.map((h, i) => swatch(h, h === YOU.skinColor)).join(''))}
    ${pickerRow('HAIR', hairStyles.map((s) => miniPick({ ...YOU, top: s }, s === YOU.top)).join(''))}
    ${pickerRow('HAIR COLOR', hairColors.map((h) => swatch(h, h === YOU.hairColor)).join(''))}
    ${pickerRow('EYES', eyeStyles.map((e) => miniPick({ ...YOU, eyes: e }, e === YOU.eyes)).join(''))}
  `, '0 15px 12px', 15);
  const actions = `<div style="display:flex;gap:10px;margin:0 15px;">
    <div style="flex:1;border-radius:14px;background:#334155;border:1px solid rgba(255,255,255,0.08);padding:13px;display:flex;align-items:center;justify-content:center;gap:7px;color:#CBD5E1;font-size:14px;font-weight:700;">${svgIcon(IC.dice, '#CBD5E1', 17)}Randomize</div>
    <div style="flex:1;border-radius:14px;background:linear-gradient(135deg,#60A5FA,#3B82F6);box-shadow:0 8px 18px rgba(59,130,246,0.4);padding:13px;display:flex;align-items:center;justify-content:center;gap:7px;color:#fff;font-size:14px;font-weight:800;">${svgIcon(IC.check, '#fff', 17)}Save</div></div>`;
  return frame(`${head('Create Your Look')}<div style="margin:6px 0 14px;">${preview}</div>${body}${actions}`);
}

// ── 2. Spark grid (seeded crowd) ──
function spark() {
  const people = [
    ['Ava', 26, 'Coffee & climbing'], ['Liam', 29, 'Chef, dog dad'], ['Noah', 31, 'Startup founder'],
    ['Mia', 24, 'Artist ✨'], ['Zoe', 27, 'Traveler'], ['Kai', 30, 'Musician'],
  ];
  const cards = people.map(([n, a, bio], i) => `<div style="border-radius:16px;overflow:hidden;background:#1E293B;border:1px solid rgba(255,255,255,0.06);box-shadow:0 10px 22px -14px rgba(0,0,0,0.65);">
    <div style="height:118px;">${av({ seed: `spark-${n}${i}` }, 200).replace('border-radius:50%', 'border-radius:0').replace(/width:200px;height:200px/, 'width:100%;height:118px')}</div>
    <div style="padding:9px 11px;"><div style="color:#F8FAFC;font-size:13px;font-weight:800;">${n}, ${a}</div><div style="color:#94A3B8;font-size:10px;margin-top:1px;">${bio}</div></div></div>`).join('');
  return frame(`${head('Spark')}<div style="padding:0 15px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">${cards}</div>`);
}

// ── 3. Pulse feed (seeded crowd) ──
function pulse() {
  const posts = [
    ['Priya Shah', '@priya', 'Just closed on my first apartment 🔑 Adulthood unlocked.', '128', '24'],
    ['Marcus Lee', '@mlee', 'Hot take: pineapple belongs on pizza. Fight me.', '412', '203'],
    ['Elena Cruz', '@elena', 'Ran my first marathon this morning. Legs = jelly. Worth it.', '967', '58'],
    ['Tom Becker', '@tombeck', 'Anyone else’s cat judging their life choices at 3am?', '2.1k', '340'],
  ];
  const feed = posts.map(([name, handle, text, likes, comments], i) => card(`<div style="display:flex;gap:11px;">${av({ seed: `pulse-${handle}` }, 46)}
    <div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;"><span style="color:#F8FAFC;font-size:13.5px;font-weight:800;">${name}</span><span style="color:#94A3B8;font-size:11px;">${handle}</span></div>
    <div style="color:#E2E8F0;font-size:12.5px;line-height:1.4;margin-top:4px;">${text}</div>
    <div style="display:flex;gap:16px;margin-top:9px;"><span style="color:#F472B6;font-size:11px;font-weight:600;">♥ ${likes}</span><span style="color:#94A3B8;font-size:11px;font-weight:600;">💬 ${comments}</span></div></div></div>`, '0 15px 11px', 13)).join('');
  return frame(`${head('Pulse')}${feed}`);
}

// ── 4. Family (heroes + genetics) ──
const MOM = { seed: 'mom', skinColor: 'edb98a', top: 'longButNotTooLong', hairColor: 'a55728', eyes: 'happy', bg: 'ffd5dc' };
const DAD = { seed: 'dad', skinColor: 'ae5d29', top: 'shortFlat', hairColor: '2c1b18', facialHair: 'beardMedium', eyes: 'default', bg: 'a0e7e5' };
const KID = { seed: 'maya', skinColor: MOM.skinColor, top: 'bob', hairColor: DAD.hairColor, eyes: 'happy', bg: 'ffdfbf' }; // Mom's skin + Dad's hair
function member(opts, name, rel, note) {
  return card(`<div style="display:flex;align-items:center;gap:13px;">${av(opts, 58)}<div style="flex:1;"><div style="color:#F8FAFC;font-size:15px;font-weight:800;">${name}</div><div style="color:#94A3B8;font-size:11px;margin-top:1px;">${rel}</div>${note ? `<div style="display:flex;align-items:center;gap:5px;margin-top:6px;color:#34D399;font-size:10px;font-weight:700;">${svgIcon(IC.dna, '#34D399', 13)}${note}</div>` : ''}</div>${svgIcon(IC.heart, '#F472B6', 18, 2)}</div>`, '0 15px 11px', 13);
}
function family() {
  return frame(`${head('Family')}
    ${member(MOM, 'Sofia (Mom)', 'Mother · Age 58', '')}
    ${member(DAD, 'Diego (Dad)', 'Father · Age 61', '')}
    ${member(YOU, 'You', 'Age 32', '')}
    ${member(KID, 'Maya', 'Daughter · Age 4', 'Inherits Mom’s skin + Dad’s hair')}`);
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Avatar system — working prototype',
  subtitle: 'Every face below is generated from a seed/options (DiceBear · avataaars) — nothing hand-drawn, nothing stored per person, works offline. The same generator powers the player\'s customization AND every NPC, so the whole game is one consistent, infinite cast.',
  body: `<div style="display:flex;justify-content:center;gap:26px;margin-top:26px;flex-wrap:wrap;max-width:1420px;margin-left:auto;margin-right:auto;">
      ${phone(customize(), { caption: 'Customize · live builder', captionColor: '#34D399', w: 300, h: 640 })}
      ${phone(spark(), { caption: 'Spark · seeded crowd', captionColor: '#60A5FA', w: 300, h: 640 })}
      ${phone(pulse(), { caption: 'Pulse · seeded crowd', captionColor: '#60A5FA', w: 300, h: 640 })}
      ${phone(family(), { caption: 'Family · heroes + genetics', captionColor: '#34D399', w: 300, h: 640 })}
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:38px;flex-wrap:wrap;max-width:1080px;margin-left:auto;margin-right:auto;">
      ${legendItem('#34D399', 'Zero authored assets', 'A Spark match or Pulse commenter is just a seed — infinite unique, consistent faces, generated offline. Replaces the 5 shared PNGs and the remote ui-avatars call.')}
      ${legendItem('#60A5FA', 'Real customization + genetics', 'The builder’s pickers ARE the avatar options (skin / hair / hair color / eyes / glasses), live. Heroes get intentional looks, and kids inherit a blend — Maya has Mom’s skin and Dad’s hair.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'avatar-prototype.png'), 1400);
console.log('wrote avatar-prototype.png');
