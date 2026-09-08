import {chromium} from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serve,packRoot} from './server.mjs';
const server=await serve();let browser;
try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.on('pageerror',e=>console.error(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.assetReady,{timeout:30000});
 const ids=await page.evaluate(()=>window.assetIds),assets=[];
 await fs.mkdir(path.join(packRoot,'models'),{recursive:true});await fs.mkdir(path.join(packRoot,'renders'),{recursive:true});
 for(const id of ids){
  const result=await page.evaluate(id=>window.captureAsset(id),id);
  const glb=Buffer.from(result.glb,'base64'),png=Buffer.from(result.png,'base64');
  const budget=['city','room','home'].includes(id)||id.startsWith('business-')?20000:3000;
  if(result.triangles>budget)throw Error('Triangle budget exceeded: '+id);
  if(glb.readUInt32LE(0)!==0x46546c67||glb.readUInt32LE(4)!==2||glb.readUInt32LE(8)!==glb.length)throw Error('Invalid GLB '+id);
  const rgba=await sharp(png).ensureAlpha().raw().toBuffer();let clear=0,solid=0;for(let i=3;i<rgba.length;i+=4){if(rgba[i]===0)clear++;if(rgba[i]>240)solid++;}
  const pixels=rgba.length/4;if(clear/pixels<.15||solid/pixels<.03)throw Error('Transparent render policy failed: '+id);
  await fs.writeFile(path.join(packRoot,'models',id+'.glb'),glb);
  await sharp(png).png({compressionLevel:9}).toFile(path.join(packRoot,'renders',id+'.png'));
  if(['city','room','home'].includes(id)){const target=path.resolve(packRoot,'../../assets/images/home');await fs.mkdir(target,{recursive:true});await sharp(png).trim().extend({top:24,bottom:24,left:24,right:24,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88,alphaQuality:100}).toFile(path.join(target,id+'.webp'));}
  assets.push({id,model:`models/${id}.glb`,render:`renders/${id}.png`,modelBytes:glb.length,renderBytes:(await fs.stat(path.join(packRoot,'renders',id+'.png'))).size,renderSha256:createHash('sha256').update(await fs.readFile(path.join(packRoot,'renders',id+'.png'))).digest('hex'),sha256:createHash('sha256').update(glb).digest('hex'),triangles:result.triangles,meshes:result.meshes,boundsMetres:result.bounds,transparentFraction:+(clear/pixels).toFixed(3),width:1200,height:900});console.log(id,result.triangles+' triangles',glb.length+' bytes');
 }
 await page.goto(`http://127.0.0.1:${server.address().port}/?asset=room`);await page.waitForFunction(()=>window.assetReady);await page.screenshot({path:path.join(packRoot,'studio-preview.png')});
 await fs.writeFile(path.join(packRoot,'manifest.json'),JSON.stringify({version:1,generator:'Three.js 0.185.1, authored geometry in source/models.mjs',license:'Project-owned original geometry. Three.js MIT license applies to the tooling dependency, not a stock asset pack.',coordinates:'metres, Y-up, front +Z',textures:0,validation:'GLB v2 header and length; round-trip GLTFLoader import; software WebGL render; transparent alpha and non-empty pixel coverage. Not a native device performance measurement.',assets},null,2)+'\n');
}finally{if(browser)await browser.close();server.close();}
