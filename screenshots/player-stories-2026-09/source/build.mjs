import {Buffer} from 'node:buffer';
/** Outcome-led store compositions. Existing captures remain unretouched. */
import {readFileSync, writeFileSync, mkdirSync, existsSync, renameSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const previous = join(repo, 'screenshots/appstore-2026');
const assets = join(previous, 'source/assets');
const fontConfig = join(tmpdir(), 'dls-player-stories-fonts.conf');
writeFileSync(fontConfig, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${assets}</dir><cachedir>${tmpdir()}/dls-player-stories-font-cache</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = fontConfig;
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'anchor.js')
  : join(previous, 'source/build.mjs'));
const sharp = require('sharp');
const metrics = JSON.parse(readFileSync(join(assets, 'font-metrics.json')));
const frames = JSON.parse(readFileSync(join(root, 'source/storyboard.json')));
const sizes = [
  {id:'iphone-6.9', w:1320, h:2868},
  {id:'iphone-6.5', w:1284, h:2778},
  {id:'ipad-13', w:2064, h:2752, pad:true},
];
const selectedIds = process.argv.find(a => a.startsWith('--ids='))?.slice(6).split(',');
const selectedDevices = process.argv.find(a => a.startsWith('--devices='))?.slice(10).split(',');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const measure = (s, size, weight=800) => [...s].reduce((v,c) => v+(metrics[weight][c]||0.5), 0)*size;
const text = (s,x,y,size,color,weight=800,spacing=0) => `<text x="${x}" y="${y}" font-family="DLS${weight}" font-size="${size}" fill="${color}" letter-spacing="${spacing}">${esc(s)}</text>`;
const cache = new Map();
async function source(file) {
  if (!cache.has(file)) {
    const bytes = readFileSync(file);
    cache.set(file, {uri:'data:image/png;base64,'+bytes.toString('base64'), ...await sharp(bytes).metadata(), sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return cache.get(file);
}
const normalize = s => s.toLowerCase().replace(/\s+/g,'');
function capturePath(p, pad) {
  return p.shot === 'current-home'
    ? join(repo, 'docs/reviews/compact-hud', pad ? 'home-768.png' : 'home-390.png')
    : join(previous, pad ? 'rich-captures-ipad' : 'rich-captures', p.shot+'.png');
}
async function getPanel(p, pad) {
  const file = capturePath(p,pad), s = await source(file);
  const rect = pad ? p.ipadCrop : p.crop;
  const crop = rect.map((n,i) => Math.round(n*(i%2 ? s.height : s.width)));
  if(crop[0]<0 || crop[1]<0 || crop[2]<=0 || crop[3]<=0 || crop[0]+crop[2]>s.width || crop[1]+crop[3]>s.height) throw Error(`Invalid crop: ${file}`);
  // Text evidence is evaluated separately for each form factor, before export.
  if (p.shot !== 'current-home') {
    const evidence = normalize(readFileSync(file.replace(/\.png$/,'.txt'),'utf8'));
    for(const claim of p.checks) if(!evidence.includes(normalize(claim))) throw Error(`Unsupported claim ${claim} in ${file}`);
  }
  return {file, s, crop};
}
let serial = 0;
function panel(p,x,y,w) {
  const h=w*p.crop[3]/p.crop[2], id='clip'+(++serial);
  return `<g><rect x="${x-12}" y="${y-12}" width="${w+24}" height="${h+24}" rx="44" fill="#050B15" filter="url(#shadow)"/><rect x="${x-3}" y="${y-3}" width="${w+6}" height="${h+6}" rx="34" fill="#172132" stroke="#758092" stroke-opacity=".65" stroke-width="2"/><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="32"/></clipPath><g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${p.crop.join(' ')}"><image href="${p.s.uri}" width="${p.s.width}" height="${p.s.height}"/></svg></g></g>`;
}
// Lucide-style line symbols follow the icon treatment used throughout the game.
const symbols={
life:'<path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2l2.8 2.8M5.6 18.4l2.8-2.8m7.2-7.2l2.8-2.8"/><circle cx="12" cy="12" r="4"/>',
business:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 11v3h4v-3"/>',
heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
career:'<path d="m2 8 10-5 10 5-10 5-10-5m4 2v7c4 3 8 3 12 0v-7m4-2v9"/>',
wealth:'<path d="M3 20h18M5 16v-4m7 4V8m7 8V4M3 7l5-4 5 2 7-3"/>',
car:'<path d="m5 7 2-4h10l2 4 2 3v8H3v-8l2-3Zm0 0h14M3 12h18M6 18v3m12-3v3M6 15h2m8 0h2"/>',
choice:'<path d="M12 21v-9M12 12 5 5m7 7 7-7M3 9V3h6m6 0h6v6"/>',
stream:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="m10 7 5 3-5 3V7Zm2 10v4m-5 0h10"/>',
travel:'<path d="m22 2-7 20-4-9L2 9 22 2ZM11 13 22 2"/>',
family:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-18a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v2"/>'};
function symbol(name,x,y,size,color){return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[name]}</svg>`;}
async function render(f, s) {
  const W=s.pad?2064:1320, H=s.pad?2752:s.h*1320/s.w;
  const panels=await Promise.all((s.pad&&f.ipadPanels?f.ipadPanels:f.panels).map(p=>getPanel(p,s.pad)));
  const iconFile=join(repo,'assets/images/icon.png'), logo=await source(iconFile);
  const a=[];
  a.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="glow"><stop stop-color="${f.accent}" stop-opacity=".24"/><stop offset="1" stop-color="${f.accent}" stop-opacity="0"/></radialGradient><filter id="shadow" x="-25%" y="-25%" width="150%" height="160%"><feGaussianBlur stdDeviation="22"/></filter><clipPath id="logo"><rect x="76" y="64" width="70" height="70" rx="18"/></clipPath></defs><rect width="${W}" height="${H}" fill="#0F172A"/><ellipse cx="${W*.75}" cy="${H*.55}" rx="${W*.85}" ry="${H*.53}" fill="url(#glow)"/>`);
  a.push(`<image href="${logo.uri}" x="76" y="64" width="70" height="70" clip-path="url(#logo)"/>`,text('Deep Life Simulator',166,113,35,'#FFFFFF'));
  a.push(text(f.id.slice(0,2)+' / 10',W-210,111,29,'#94A3B8',500));
  const left=s.pad?120:80, titleWidth=s.pad?1824:1160;
  const titleSize=Math.min(s.pad?190:148,...f.title.map(l=>titleWidth/measure(l,1)));
  f.title.forEach((line,i)=>a.push(text(line,left,(s.pad?330:300)+i*(titleSize+12),titleSize,i?f.accent:'#FFFFFF')));
  const subSize=s.pad?51:43;
  f.sub.forEach((line,i)=>{if(measure(line,subSize,500)>titleWidth)throw Error('Subtitle overflow '+f.id);a.push(text(line,left,(s.pad?650:570)+i*(s.pad?70:58),subSize,'#CBD5E1',500));});
  let areaX=s.pad?160:90, areaW=s.pad?1744:1140, areaY=s.pad?900:810, areaH=s.pad?1530:H-1110;
  const labelHeight=65,gap=95;
  const ratio=panels.reduce((n,p)=>n+p.crop[3]/p.crop[2],0);
  const width=Math.min(areaW,(areaH-panels.length*labelHeight-(panels.length-1)*gap)/ratio);
  const total=width*ratio+panels.length*labelHeight+(panels.length-1)*gap;
  let y=areaY+(areaH-total)/2;
  if(total<(s.pad?1120:1350)){
    const cy=s.pad?820:800;
    a.push(`<circle cx="${W/2}" cy="${cy+85}" r="116" fill="${f.accent}" fill-opacity=".12" stroke="${f.accent}" stroke-opacity=".3" stroke-width="2"/>`,symbol(f.icon,W/2-63,cy+22,126,f.accent));
    y=Math.max(y,s.pad?1120:1080);
  }
  for(let i=0;i<panels.length;i++){
    const x=areaX+(areaW-width)/2;
    const label=f.labels[Math.min(i,f.labels.length-1)];
    const labelSize=Math.min(29,width/measure(label,1));
    a.push(`<rect x="${x}" y="${y-5}" width="8" height="30" rx="4" fill="${f.accent}"/>`,text(label,x+24,y+20,labelSize,f.accent,800,1));
    y+=labelHeight;
    a.push(panel(panels[i],x,y,width));
    y+=width*panels[i].crop[3]/panels[i].crop[2]+gap;
  }
  if(y-gap>H-230)throw Error('Panel overflow '+f.id);
  const yy=H-177, stepWidth=(W-160)/3;
  a.push(`<path d="M80 ${yy-67}h${W-160}" stroke="#334155" stroke-width="2"/>`);
  f.steps.forEach((step,i)=>{const x=82+i*stepWidth;const size=Math.min(s.pad?40:30,(stepWidth-70)/measure(step,1,500));a.push(`<circle cx="${x+16}" cy="${yy+2}" r="16" fill="${f.accent}"/>`,text(i+1,x+10,yy+9,19,'#0F172A'),text(step,x+47,yy+12,size,'#E2E8F0',500));});
  a.push(text(f.theme,80,H-55,s.pad?28:23,'#94A3B8',800,2));
  a.push('</svg>');
  const out=join(root,s.id,f.id+'.png');mkdirSync(dirname(out),{recursive:true});
  const png=await sharp(Buffer.from(a.join(''))).flatten({background:'#0F172A'}).removeAlpha().png({compressionLevel:9}).toBuffer();
  await sharp(png,{failOn:'warning'}).raw().toBuffer();
  writeFileSync(out+'.tmp',png);renameSync(out+'.tmp',out);
  return {file:out.slice(root.length+1),width:s.w,height:s.h,pngSha256:createHash('sha256').update(png).digest('hex'),frameSha256:createHash('sha256').update(JSON.stringify(f)).digest('hex'),headline:f.title.join(' '),art:iconFile.slice(repo.length+1),artSha256:logo.sha256,captures:panels.map(p=>({file:p.file.slice(repo.length+1),sha256:p.s.sha256,crop:p.crop}))};
}
const manifestFile=join(root,'source/manifest.json');
let manifest=existsSync(manifestFile)?JSON.parse(readFileSync(manifestFile)):[];
for(const f of frames.filter(f=>!selectedIds||selectedIds.includes(f.id.slice(0,2)))) {
  for(const s of sizes.filter(s=>!selectedDevices||selectedDevices.includes(s.id))) {
    const item=await render(f,s);
    manifest=manifest.filter(m=>m.file!==item.file);manifest.push(item);
    console.log('Rendered',item.file);
  }
}
manifest.sort((a,b)=>a.file.localeCompare(b.file));
writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
