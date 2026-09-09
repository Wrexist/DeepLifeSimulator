import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'anchor.js') : join(root,'../appstore-2026/source/build.mjs'));
const sharp=require('sharp');
const frames=JSON.parse(readFileSync(join(root,'source/storyboard.json')));
async function sheet(device, selected, cols, name, width) {
  const cellWidth=width, cellHeight=Math.round(width*(device==='ipad-13'?2752/2064:2868/1320));
  const gap=24, rows=Math.ceil(selected.length/cols);
  const input=await Promise.all(selected.map(async(f,i)=>({input:await sharp(join(root,device,f.id+'.png')).resize(cellWidth,cellHeight).toBuffer(),left:gap+(i%cols)*(cellWidth+gap),top:gap+Math.floor(i/cols)*(cellHeight+gap)})));
  await sharp({create:{width:cols*cellWidth+(cols+1)*gap,height:rows*cellHeight+(rows+1)*gap,channels:3,background:'#080E1A'}}).composite(input).png().toFile(join(root,name));
  console.log(name);
}
await sheet('iphone-6.9',frames.slice(0,3),3,'first-three.png',396);
await sheet('iphone-6.9',frames,5,'overview-iphone.png',300);
await sheet('ipad-13',frames,5,'overview-ipad.png',360);
