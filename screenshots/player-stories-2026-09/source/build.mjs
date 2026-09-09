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
async function render(f, s) {
  const W=s.pad?2064:1320, H=s.pad?2752:s.h*1320/s.w;
  const artFile=f.art==='new' ? join(root,'source/art/01-new-beginnings.png') : join(previous,'source/art',f.art+'.png');
  const art = await source(artFile);
  const panels = await Promise.all((s.pad && f.ipadPanels ? f.ipadPanels : f.panels).map(p=>getPanel(p,s.pad)));
  const margin=s.pad?110:90, titleSize=s.pad?174:146;
  for(const line of f.title) if(measure(line,titleSize)>W-2*margin) throw Error(`Headline overflow: ${f.id}`);
  for(const line of f.sub) if(measure(line,s.pad?48:46,500)>W-2*margin) throw Error(`Subtitle overflow: ${f.id}`);
  const a=[];
  a.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${W} ${H}"><defs><filter id="shadow" x="-25%" y="-25%" width="150%" height="160%"><feGaussianBlur stdDeviation="20"/></filter><linearGradient id="fade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#101827" stop-opacity="0"/><stop offset="1" stop-color="#101827"/></linearGradient><clipPath id="art"><rect x="${s.pad?80:50}" y="650" width="${s.pad?1904:1220}" height="${s.pad?1900:1990}" rx="52"/></clipPath></defs><rect width="${W}" height="${H}" fill="#F4F1E9"/><rect y="1230" width="${W}" height="${H-1230}" fill="#101827"/>`);
  a.push(text('DEEP LIFE',margin,100,36,'#162135',800,3),text('SIMULATOR',margin+260,100,25,'#536071',500,3));
  a.push(text(f.id.slice(0,2)+' / 10',W-margin-125,100,27,'#536071',500,2));
  a.push(`<path d="M${margin} 141H${W-margin}" stroke="#CFCBC2" stroke-width="2"/>`);
  f.title.forEach((line,i)=>a.push(text(line,margin,306+i*titleSize*1.04,titleSize,i?f.ink:'#162135')));
  f.sub.forEach((line,i)=>a.push(text(line,margin,s.pad?554+i*61:533+i*60,s.pad?48:46,'#4D5868',500)));
  a.push(`<g clip-path="url(#art)"><image href="${art.uri}" x="${s.pad?80:50}" y="650" width="${s.pad?1904:1220}" height="${s.pad?1900:1750}" preserveAspectRatio="xMidYMid slice"/><rect x="50" y="${s.pad?1850:1350}" width="${W-100}" height="${s.pad?700:1080}" fill="url(#fade)"/></g>`);
  if(s.pad) {
    // Purpose-built tablet composition: art and aspirations left, tablet UI right.
    a.push(`<rect x="968" y="1010" width="${W-1050}" height="1560" rx="48" fill="#101827" fill-opacity=".95"/>`);
    const totalRatio=panels.reduce((n,p)=>n+p.crop[3]/p.crop[2],0);
    const width=Math.min(900,(1120-(panels.length-1)*46)/totalRatio);
    let y=1115;
    for(const p of panels){a.push(panel(p,1008+(900-width)/2,y,width));y+=width*p.crop[3]/p.crop[2]+46;}
    const stepsY=Math.max(2040,y+74);
    a.push(text('MAKE IT YOUR STORY',1048,stepsY,30,f.accent,800,2));
    f.steps.forEach((step,i)=>{
      a.push(`<circle cx="1067" cy="${stepsY+73+i*99}" r="19" fill="${f.accent}"/>`);
      a.push(text(String(i+1),1059,stepsY+82+i*99,24,'#101827'));
      a.push(text(step,1118,stepsY+85+i*99,43,'#F4F1E9',500));
    });
    if(stepsY+283>H-165) throw Error(`Tablet steps overflow: ${f.id}`);
  } else {
    const gap=42, maxHeight=1125;
    const totalRatio=panels.reduce((n,p)=>n+p.crop[3]/p.crop[2],0);
    const width=Math.min(1100,(maxHeight-(panels.length-1)*gap)/totalRatio);
    const yStart=1495;
    const proofSize=Math.min(36,1080/measure(f.proof,1));
    a.push(`<rect x="78" y="1370" width="${measure(f.proof,proofSize)+48}" height="76" rx="22" fill="#101827" fill-opacity=".93"/>`);
    a.push(text(f.proof,102,1420,proofSize,f.accent,800));
    let y=yStart;
    panels.forEach((p,i)=>{
      const x=(W-width)/2+(panels.length>1 ? (i===0?-18:18) : 0);
      a.push(panel(p,x,y,width));
      y+=width*p.crop[3]/p.crop[2]+gap;
    });
    if(y-gap>H-185) throw Error(`Gameplay panel overflow: ${f.id}`);
  }
  a.push(`<path d="M${margin} ${H-138}H${W-margin}" stroke="#415067" stroke-width="2"/>`);
  a.push(text(f.theme,margin,H-80,s.pad?34:30,f.accent,800,1.7));
  a.push(text('LIFE SIMULATION',W-margin-(s.pad?345:288),H-80,s.pad?28:23,'#AAB5C6',500,1.5));
  a.push('</svg>');
  const out=join(root,s.id,f.id+'.png');mkdirSync(dirname(out),{recursive:true});
  const png=await sharp(Buffer.from(a.join(''))).flatten({background:'#101827'}).removeAlpha().png({compressionLevel:9}).toBuffer();
  // Decode the entire output before publishing it. Reading its header alone
  // misses truncated IDAT data. Atomic writes preserve the last good export.
  await sharp(png,{failOn:'warning'}).raw().toBuffer();
  writeFileSync(out+'.tmp',png);
  renameSync(out+'.tmp',out);
  const metadata=await sharp(out).metadata();
  if(metadata.width!==s.w||metadata.height!==s.h||metadata.hasAlpha) throw Error(`Invalid export: ${out}`);
  return {file:out.slice(root.length+1),width:s.w,height:s.h,pngSha256:createHash('sha256').update(png).digest('hex'),frameSha256:createHash('sha256').update(JSON.stringify(f)).digest('hex'),headline:f.title.join(' '),art:artFile.slice(repo.length+1),artSha256:art.sha256,captures:panels.map(p=>({file:p.file.slice(repo.length+1),sha256:p.s.sha256,crop:p.crop}))};
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
