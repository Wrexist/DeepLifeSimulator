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
let seq=0;
function panel(file,x,y,w,crop,angle=0){
 const id='c'+(++seq),h=w*crop[3]/crop[2],pad=file.includes('/rich-captures-ipad/');
 return `<g transform="rotate(${angle} ${x+w/2} ${y+h/2})"><rect x="${x-18}" y="${y-16}" width="${w+36}" height="${h+32}" rx="58" fill="#080D17" filter="url(#shadow)"/><rect x="${x-7}" y="${y-7}" width="${w+14}" height="${h+14}" rx="46" fill="#141B27" stroke="url(#metal)" stroke-width="3"/><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="39"/></clipPath></defs><g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop.join(' ')}" overflow="hidden"><image href="${uri(file)}" width="${pad?2048:1290}" height="${pad?2732:2796}"/></svg></g></g>`;
}
const configs={
 '01':{crop:[0,0,1290,2796],y:1220,w:706,x:125,angle:-2,proof:'YOUR FIRST CHAPTER',accent:'#ECD2A1'},
 '02':{crop:[0,0,1290,1775],y:1390,w:990,x:230,angle:2,proof:'BUILD SOMETHING OF YOUR OWN',accent:'#ECD2A1'},
 '03':{crop:[0,60,1290,2440],y:1380,w:744,x:288,angle:-2,proof:'MAKE A CONNECTION',accent:'#FFD4C2'},
 '04':{crop:[45,475,1200,1840],y:1305,w:932,x:194,angle:2,proof:'CHOOSE WHAT HAPPENS NEXT',accent:'#ECD2A1'},
 '05':{y:1370,proof:'FROM QUALIFIED TO PROMOTED',accent:'#BBDFD5'},
 '06':{crop:[0,0,1290,1910],y:1310,w:982,x:120,angle:-2,proof:'FOLLOW THE MARKET',accent:'#BBDFD5'},
 '07':{crop:[0,420,1290,2210],y:1320,w:840,x:332,angle:2,proof:'WATCH YOUR HEAT',accent:'#B8E5CE'},
 '08':{crop:[0,715,1290,2020],y:1330,w:916,x:160,angle:-2,proof:'BUILD YOUR PROPERTY PORTFOLIO',accent:'#D9D0F3'},
 '09':{crop:[0,0,1290,1820],y:1460,w:903,x:276,angle:2,proof:'YOUR NEXT MILESTONE',accent:'#FFE0A0'},
 '10':{crop:[0,0,1290,2060],y:1310,w:907,x:170,angle:-2,proof:'KEEP YOUR PEOPLE CLOSE',accent:'#FFD4C2'},
 '11':{crop:[0,640,1290,1925],y:1320,w:970,x:180,angle:2,proof:'HEALTH · HAPPINESS · ENERGY',accent:'#BEDCCD'},
 '12':{crop:[0,1250,1290,1540],y:1400,w:1120,x:100,angle:-2,proof:'PLAN YOUR NEXT ESCAPE',accent:'#BDE3E4'},
 '13':{crop:[0,0,1290,1480],y:1480,w:1060,x:145,angle:2,proof:'BUILD YOUR AUDIENCE',accent:'#D7CEF4'},
 '14':{crop:[0,0,1290,1890],y:1330,w:970,x:145,angle:-2,proof:'EXPLORE THE CRYPTO MARKET',accent:'#ECD2A1'},
 '15':{crop:[0,0,1290,1890],y:1330,w:970,x:230,angle:2,proof:'TURN SUCCESS INTO SOMETHING RARE',accent:'#ECD2A1'},
 '16':{y:1350,proof:'A NEW LIFE. A NEW ADVANTAGE.',accent:'#ECD2A1'}
};
function render(f,size){
 const id=f.id.slice(0,2),c=configs[id],pad=size.pad,W=pad?2064:1320,H=pad?2752:size.h*1320/size.w;
 const art=join(root,'source/art',id+'.png');
 const source=join(root,pad?'rich-captures-ipad':'rich-captures'),file=join(source,f.shot+'.png');
 const p=[`<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#020610" stop-opacity=".38"/><stop offset=".22" stop-color="#020610" stop-opacity="0"/><stop offset=".60" stop-color="#020610" stop-opacity="0"/><stop offset="1" stop-color="#020610" stop-opacity=".4"/></linearGradient><linearGradient id="metal" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${c.accent}" stop-opacity=".9"/><stop offset=".35" stop-color="#323B49"/><stop offset=".65" stop-color="#64707E"/><stop offset="1" stop-color="#111724"/></linearGradient><filter id="shadow" x="-40%" y="-30%" width="180%" height="170%"><feGaussianBlur stdDeviation="25"/></filter><linearGradient id="side"><stop stop-color="#080D17" stop-opacity="0"/><stop offset=".95" stop-color="#080D17" stop-opacity=".85"/></linearGradient></defs><rect width="100%" height="100%" fill="#080D17"/>`];
 if(pad){
  p.push(`<image href="${uri(art)}" x="0" y="0" width="1268" height="2752" preserveAspectRatio="xMidYMid slice"/><rect width="2064" height="2752" fill="url(#side)"/>`);
 }else p.push(`<image href="${uri(art)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
 p.push(`<rect width="${W}" height="${H}" fill="url(#shade)"/>`);
 const margin=pad?112:90;
 p.push(txt('DEEP LIFE',margin,108,pad?42:37,'#FAF5EA',800,4),txt('SIMULATOR',pad?406:351,108,pad?30:27,'#E0D6C5',500,4));
 const fs=fit(f.title,pad?1800:1140,pad?173:163);
 f.title.forEach((s,i)=>p.push(txt(s,margin,284+i*fs*1.03,fs,i?c.accent:'#FAF5EA')));
 p.push(txt(f.sub,margin,554,fit([f.sub],pad?1780:1140,pad?48:44,500),'#F5EDE1',500));
 if(pad){
  const x=906,w=1032,y=1020;
  p.push(txt(c.proof,x,953,fit([c.proof],w,31),c.accent,800,1));
  if(f.mode==='career'){
   p.push(panel(file,x,y,w,[40,675,1968,560],0));
   p.push(panel(join(source,f.secondary+'.png'),x,y+380,w,[0,1070,2048,1580],0));
  }else if(f.mode==='business')p.push(panel(file,x,y,w,[0,0,2048,1790],0));
  else p.push(panel(file,x,y,w,[0,0,2048,2732],0));
  p.push(txt(f.category,112,2520,fit([f.category],680,38),c.accent,800,2));
 }else{
  p.push(txt(c.proof,94,c.y-65,fit([c.proof],1128,29),c.accent,800,1.6));
  if(f.mode==='career'){
   p.push(panel(file,105,1370,1110,[42,672,1206,455],-1));
   p.push(panel(join(source,f.secondary+'.png'),180,1860,1010,[0,1040,1290,965],2));
  }else if(id==='06'){
   p.push(panel(file,105,1370,1110,[40,740,1210,380],-1));
   p.push(panel(file,145,1810,1070,[40,1735,1210,960],2));
  }else if(id==='10'){
   p.push(panel(file,105,1370,1110,[40,350,1210,670],-1));
   p.push(panel(file,160,2050,1050,[40,1800,1210,745],2));
  }else if(id==='14'){
   p.push(panel(file,105,1370,1110,[40,440,1210,245],-1));
   p.push(panel(file,145,1660,1030,[40,1360,1210,1280],2));
  }else if(f.mode==='prestige'){
   p.push(panel(file,96,1350,1128,[60,1772,1170,800],-1.5));
   p.push(panel(join(source,'30-early-home.png'),210,2240,995,[0,680,1290,670],2));
  }else p.push(panel(file,c.x,c.y,c.w,c.crop,c.angle));
  p.push(txt(f.category,90,H-37,25,c.accent,800,2.5),txt(id,1173,H-37,25,'#DFD8CD',500,2));
 }
 p.push('</svg>');return p.join('');
}
const sizes=[{id:'iphone-6.9',w:1320,h:2868},{id:'iphone-6.5',w:1284,h:2778},{id:'ipad-13',w:2064,h:2752,pad:true}];
const draft=process.argv.includes('--draft');
const devices=process.argv.find(a=>a.startsWith('--devices='))?.slice(10).split(',');
const ids=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');
const manifestPath=join(root,'source/manifest.json');
const manifest=(ids||devices||draft)&&existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath)).filter(x=>{
 const selectedFrame=draft?['01','02','03'].includes(x.art.slice(0,2)):!ids||ids.includes(x.art.slice(0,2));
 const selectedDevice=draft?x.file.startsWith('iphone-6.9/'):!devices||devices.some(d=>x.file.split('/').includes(d));
 return !(selectedFrame&&selectedDevice);
}):[];
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
