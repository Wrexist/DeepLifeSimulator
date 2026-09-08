import {Buffer} from 'node:buffer';
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=join(root,'source/assets');
writeFileSync(join(root,'source/fonts.conf'),`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${assets}</dir><cachedir>/tmp/dls-v2-font-cache</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE=join(root,'source/fonts.conf');
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/anchor.js' : import.meta.url);
const sharp=require('sharp');
const frames=JSON.parse(readFileSync(join(root,'source/storyboard.json')));
const metrics=JSON.parse(readFileSync(join(assets,'font-metrics.json')));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cache=new Map();
const uri=p=>{if(!cache.has(p))cache.set(p,'data:image/png;base64,'+readFileSync(p).toString('base64'));return cache.get(p)};
const measure=(s,size,weight=800)=>[...s].reduce((v,c)=>v+(metrics[weight][c]||.5),0)*size;
const fit=(lines,max,size,weight=800)=>Math.min(size,...lines.map(s=>max/measure(s,1,weight)));
const txt=(s,x,y,size,color='#FAF5EA',weight=800,spacing=0)=>`<text x="${x}" y="${y}" font-family="DLS${weight}" font-size="${size}" fill="${color}" letter-spacing="${spacing}">${esc(s)}</text>`;
const pill=(s,x,y,size,color)=>{const w=measure(s,size*.58,800)+54;return `<g><rect x="${x}" y="${y-size-17}" width="${w}" height="${size+34}" rx="${(size+34)/2}" fill="#07101C" fill-opacity=".72" stroke="${color}" stroke-opacity=".55"/><text x="${x+27}" y="${y+2}" font-family="DLS800" font-size="${size}" fill="${color}" letter-spacing="2">${esc(s)}</text></g>`};
let seq=0;
function panel(file,x,y,w,crop,angle=0){
 const id='c'+(++seq),h=w*crop[3]/crop[2],pad=file.includes('/rich-captures-ipad/');
 return `<g transform="rotate(${angle} ${x+w/2} ${y+h/2})"><rect x="${x-24}" y="${y-22}" width="${w+48}" height="${h+44}" rx="64" fill="#02050A" fill-opacity=".75" filter="url(#shadow)"/><rect x="${x-8}" y="${y-8}" width="${w+16}" height="${h+16}" rx="48" fill="#111925" stroke="url(#metal)" stroke-width="4"/><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="40"/></clipPath></defs><g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop.join(' ')}" overflow="hidden"><image href="${uri(file)}" width="${pad?2048:1290}" height="${pad?2732:2796}"/></svg></g></g>`;
}
const configs={
 '01':{crop:[0,0,1290,2796],y:1210,w:720,x:116,angle:-2,proof:'START YOUR STORY',accent:'#ECD2A1'},
 '02':{crop:[0,0,1290,1775],y:1380,w:1000,x:220,angle:2,proof:'FROM FIRST COMPANY TO EMPIRE',accent:'#ECD2A1'},
 '03':{crop:[0,60,1290,2440],y:1370,w:760,x:280,angle:-2,proof:'MEET · DATE · BUILD A LIFE',accent:'#FFD4C2'},
 '04':{crop:[45,475,1200,1840],y:1295,w:945,x:188,angle:2,proof:'YOUR DECISIONS HAVE CONSEQUENCES',accent:'#ECD2A1'},
 '05':{y:1360,proof:'STUDY · QUALIFY · GET PROMOTED',accent:'#BBDFD5'},
 '06':{crop:[0,0,1290,1910],y:1300,w:995,x:112,angle:-2,proof:'TURN INCOME INTO WEALTH',accent:'#BBDFD5'},
 '07':{crop:[0,420,1290,2210],y:1310,w:855,x:324,angle:2,proof:'BIGGER REWARDS · BIGGER CONSEQUENCES',accent:'#B8E5CE'},
 '08':{crop:[0,715,1290,2020],y:1320,w:930,x:152,angle:-2,proof:'FROM FIRST HOME TO PORTFOLIO',accent:'#D9D0F3'},
 '09':{crop:[0,0,1290,1820],y:1450,w:920,x:266,angle:2,proof:'MAKE SUCCESS VISIBLE',accent:'#FFE0A0'},
 '10':{crop:[0,0,1290,2060],y:1300,w:920,x:162,angle:-2,proof:'LOVE · FAMILY · LEGACY',accent:'#FFD4C2'},
 '11':{crop:[0,640,1290,1925],y:1310,w:980,x:172,angle:2,proof:'HEALTH · HAPPINESS · ENERGY',accent:'#BEDCCD'},
 '12':{crop:[0,1250,1290,1540],y:1390,w:1120,x:100,angle:-2,proof:'TURN SUCCESS INTO EXPERIENCES',accent:'#BDE3E4'},
 '13':{crop:[0,0,1290,1480],y:1470,w:1060,x:145,angle:2,proof:'CREATE · STREAM · GROW',accent:'#D7CEF4'},
 '14':{crop:[0,0,1290,1890],y:1320,w:980,x:137,angle:-2,proof:'OPPORTUNITY MEETS RISK',accent:'#ECD2A1'},
 '15':{crop:[0,0,1290,1890],y:1320,w:980,x:222,angle:2,proof:'COLLECT WHAT SUCCESS UNLOCKS',accent:'#ECD2A1'},
 '16':{y:1340,proof:'EVERY LIFE CAN TAKE YOU FURTHER',accent:'#ECD2A1'}
};
function render(f,size){
 const id=f.id.slice(0,2),c=configs[id],pad=size.pad,W=pad?2064:1320,H=pad?2752:size.h*1320/size.w;
 const art=join(root,'source/art',id+'.png');
 const source=join(root,pad?'rich-captures-ipad':'rich-captures'),file=join(source,f.shot+'.png');
 const p=[`<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#020610" stop-opacity=".58"/><stop offset=".18" stop-color="#020610" stop-opacity=".10"/><stop offset=".55" stop-color="#020610" stop-opacity="0"/><stop offset="1" stop-color="#020610" stop-opacity=".48"/></linearGradient><linearGradient id="headlineGlow" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#020610" stop-opacity=".70"/><stop offset="1" stop-color="#020610" stop-opacity="0"/></linearGradient><linearGradient id="metal" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${c.accent}" stop-opacity=".95"/><stop offset=".34" stop-color="#394454"/><stop offset=".68" stop-color="#7C8794"/><stop offset="1" stop-color="#111724"/></linearGradient><filter id="shadow" x="-40%" y="-30%" width="180%" height="170%"><feGaussianBlur stdDeviation="28"/></filter><linearGradient id="side"><stop stop-color="#080D17" stop-opacity="0"/><stop offset=".95" stop-color="#080D17" stop-opacity=".88"/></linearGradient></defs><rect width="100%" height="100%" fill="#080D17"/>`];
 if(pad){p.push(`<image href="${uri(art)}" x="0" y="0" width="1268" height="2752" preserveAspectRatio="xMidYMid slice"/><rect width="2064" height="2752" fill="url(#side)"/>`)}else p.push(`<image href="${uri(art)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
 p.push(`<rect width="${W}" height="${H}" fill="url(#shade)"/><rect width="${W}" height="760" fill="url(#headlineGlow)"/>`);
 const margin=pad?112:90;
 p.push(txt('DEEP LIFE',margin,102,pad?39:35,'#FAF5EA',800,4),txt('SIMULATOR',pad?388:334,102,pad?28:25,'#E0D6C5',500,4));
 const fs=fit(f.title,pad?1800:1140,pad?178:168);
 f.title.forEach((s,i)=>p.push(txt(s,margin,292+i*fs*.98,fs,i?c.accent:'#FAF5EA')));
 const subY=292+f.title.length*fs*.98+42;
 p.push(txt(f.sub,margin,subY,fit([f.sub],pad?1780:1140,pad?45:41,500),'#F5EDE1',500));
 if(pad){
  const x=906,w=1032,y=1020;
  p.push(pill(c.proof,x,950,29,c.accent));
  if(f.mode==='career'){p.push(panel(file,x,y,w,[40,675,1968,560],0));p.push(panel(join(source,f.secondary+'.png'),x,y+380,w,[0,1070,2048,1580],0));}
  else if(f.mode==='business')p.push(panel(file,x,y,w,[0,0,2048,1790],0));
  else p.push(panel(file,x,y,w,[0,0,2048,2732],0));
  p.push(pill(f.category,112,2520,31,c.accent));
 }else{
  p.push(pill(c.proof,94,c.y-58,27,c.accent));
  if(f.mode==='career'){p.push(panel(file,105,1360,1110,[42,672,1206,455],-1));p.push(panel(join(source,f.secondary+'.png'),180,1850,1010,[0,1040,1290,965],2));}
  else if(id==='06'){p.push(panel(file,105,1360,1110,[40,740,1210,380],-1));p.push(panel(file,145,1800,1070,[40,1735,1210,960],2));}
  else if(id==='10'){p.push(panel(file,105,1360,1110,[40,350,1210,670],-1));p.push(panel(file,160,2040,1050,[40,1800,1210,745],2));}
  else if(id==='14'){p.push(panel(file,105,1360,1110,[40,440,1210,245],-1));p.push(panel(file,145,1650,1030,[40,1360,1210,1280],2));}
  else if(f.mode==='prestige'){p.push(panel(file,96,1340,1128,[60,1772,1170,800],-1.5));p.push(panel(join(source,'30-early-home.png'),210,2230,995,[0,680,1290,670],2));}
  else p.push(panel(file,c.x,c.y,c.w,c.crop,c.angle));
  p.push(pill(f.category,90,H-42,22,c.accent),txt(id,1173,H-37,25,'#DFD8CD',500,2));
 }
 p.push('</svg>');return p.join('');
}
const sizes=[{id:'iphone-6.9',w:1320,h:2868},{id:'iphone-6.5',w:1284,h:2778},{id:'ipad-13',w:2064,h:2752,pad:true}];
const draft=process.argv.includes('--draft');
const devices=process.argv.find(a=>a.startsWith('--devices='))?.slice(10).split(',');
const ids=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');
const manifestPath=join(root,'source/manifest.json');
const manifest=(ids||devices||draft)&&existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath)).filter(x=>{const selectedFrame=draft?['01','02','03'].includes(x.art.slice(0,2)):!ids||ids.includes(x.art.slice(0,2));const selectedDevice=draft?x.file.startsWith('iphone-6.9/'):!devices||devices.some(d=>x.file.split('/').includes(d));return !(selectedFrame&&selectedDevice);}):[];
for(const f of (draft?frames.slice(0,3):ids?frames.filter(f=>ids.includes(f.id.slice(0,2))):frames)){
 const normalize=s=>s.toLowerCase().replace(/\s+/g,'');
 const evidence=normalize(readFileSync(join(root,'rich-captures',f.shot+'.txt'),'utf8'));
 for(const claim of f.checks)if(!evidence.includes(normalize(claim)))throw new Error('Unsupported capture claim: '+f.id+' '+claim);
 if(!existsSync(join(root,'source/art',f.id.slice(0,2)+'.png')))throw new Error('Missing artwork: '+f.id);
 for(const s of (draft?sizes.slice(0,1):sizes).filter(s=>!devices||devices.includes(s.id))){
  if(s.pad&&f.mode==='prestige')continue;
  const dir=join(root,f.group==='main'?'':f.group,s.id);mkdirSync(dir,{recursive:true});
  const svg=render(f,s),file=join(dir,f.id+'.png');
  const png=await sharp(Buffer.from(svg)).flatten({background:'#080D17'}).removeAlpha().png({compressionLevel:9}).toBuffer();
  writeFileSync(file+'.tmp',png);renameSync(file+'.tmp',file);
  manifest.push({file:file.slice(root.length+1),width:s.w,height:s.h,art:f.id.slice(0,2)+'.png',capture:f.shot+'.png',headline:f.title.join(' ')});
  console.log('Rendered',f.id,s.id);
 }
}
writeFileSync(join(root,'source/manifest.json'),JSON.stringify(manifest,null,2));
