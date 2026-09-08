import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.env.FONTCONFIG_FILE=join(root,'source/fonts.conf');
const req=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/anchor.js' : import.meta.url);
const sharp=req('sharp');
async function sheet(paths,cols,out,title,caption){
 const cell=cols===3?396:cols===5?288:310,gap=20,margin=28,ratio=paths[0].includes('ipad-13')?2752/2064:2868/1320,ih=cell*ratio,rows=Math.ceil(paths.length/cols);
 const w=2*margin+cols*cell+(cols-1)*gap,h=140+rows*(ih+45)+25;
 const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}"><rect width="100%" height="100%" fill="#101827"/><text x="28" y="53" font-family="DLS800" font-size="31" fill="#F5F8FE">${title}</text><text x="28" y="88" font-family="DLS500" font-size="21" fill="#AABBD0">${caption}</text>`];
 paths.forEach((p,i)=>{
  const x=margin+(i%cols)*(cell+gap),y=126+Math.floor(i/cols)*(ih+45);
  pieces.push(`<image x="${x}" y="${y}" width="${cell}" height="${ih}" href="data:image/png;base64,${readFileSync(p).toString('base64')}"/><text x="${x}" y="${y+ih+26}" font-family="DLS500" font-size="17" fill="#C4D2E5">${p.split('/').pop().split('-').slice(0,1).join('')}</text>`);
 });
 pieces.push('</svg>');const b=await sharp(Buffer.from(pieces.join(''))).flatten({background:'#101827'}).removeAlpha().png().toBuffer();writeFileSync(out,b);console.log(out);
}
const files=(group,size)=>readdirSync(join(root,group==='main'?'':group,size)).filter(f=>f.endsWith('.png')).sort().map(f=>join(root,group==='main'?'':group,size,f));
await sheet(files('main','iphone-6.9').slice(0,3),3,join(root,'DeepLife-Immersive-First-Three.png'),'DEEP LIFE SIMULATOR','Immersive edition · The first three screenshots');
if(!process.argv.includes('--draft'))await sheet(files('main','iphone-6.9'),5,join(root,'DeepLife-Immersive-Overview.png'),'DEEP LIFE SIMULATOR','Immersive edition · Main sequence 01–10');
if(!process.argv.includes('--draft'))await sheet(files('alternatives','iphone-6.9'),3,join(root,'DeepLife-Immersive-Alternatives.png'),'DEEP LIFE SIMULATOR','Alternative themes · Swap into the main sequence');
if(!process.argv.includes('--draft'))await sheet(files('main','ipad-13'),5,join(root,'DeepLife-Immersive-iPad.png'),'DEEP LIFE SIMULATOR','iPad · Tablet captures and a dedicated layout');
