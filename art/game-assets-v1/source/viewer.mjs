import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { catalog } from './models.mjs';

const scene=new T.Scene();
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setClearColor(0x000000,0);renderer.setPixelRatio(1);renderer.setSize(1200,900);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
document.querySelector('#stage').appendChild(renderer.domElement);
const camera=new T.OrthographicCamera(-4,4,3,-3,.01,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=false;
scene.add(new T.HemisphereLight('#fff7e5','#7b8f8d',2.6));
const key=new T.DirectionalLight('#fff0d2',4.2);key.position.set(-3,7,5);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:30});key.shadow.normalBias=.018;scene.add(key);
const fill=new T.DirectionalLight('#d5e9ed',1.4);fill.position.set(5,3,-3);scene.add(fill);
let current;
function frame(model) {
  if(current)scene.remove(current);current=model;scene.add(model);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const radius=Math.max(size.x,size.y,size.z)*.75;
  camera.left=-radius*4/3;camera.right=radius*4/3;camera.top=radius;camera.bottom=-radius;
  camera.position.copy(center).add(new T.Vector3(6,4.8,7).normalize().multiplyScalar(12));camera.lookAt(center);camera.updateProjectionMatrix();
  controls.target.copy(center);controls.update();renderer.render(scene,camera);
}
function metrics(model) {
  let meshes=0,triangles=0;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  return {meshes,triangles,bounds:new T.Box3().setFromObject(model).getSize(new T.Vector3()).toArray()};
}
function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
window.captureAsset=async id=>{
  const model=catalog[id].build();model.updateMatrixWorld(true);
  const binary=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  // Round-trip the delivered GLB, then render that imported object, not the
  // source tree. This catches serialization/material loss before delivery.
  const imported=await new GLTFLoader().parseAsync(binary,'');
  frame(imported.scene);const info=metrics(imported.scene);
  if(!info.meshes||!Number.isFinite(info.triangles)||info.triangles>100000)throw new Error('Model policy failed: '+id);
  return {glb:bytesToBase64(new Uint8Array(binary)),png:renderer.domElement.toDataURL('image/png').split(',')[1],...info};
};
function select(id){frame(catalog[id].build());document.querySelector('#title').textContent=catalog[id].title;document.querySelector('#meta').textContent=`${catalog[id].category} · ${metrics(current).triangles.toLocaleString()} triangles · Drag to rotate`;
  document.querySelector('#download').href=`/models/${id}.glb`;document.querySelector('#download').download=id+'.glb';
  for(const b of document.querySelectorAll('[data-asset]'))b.setAttribute('aria-pressed',String(b.dataset.asset===id));
}
const nav=document.querySelector('#assets');for(const [id,asset]of Object.entries(catalog)){const b=document.createElement('button');b.textContent=asset.title;b.dataset.asset=id;b.onclick=()=>select(id);nav.append(b);}
controls.addEventListener('change',()=>renderer.render(scene,camera));
document.querySelector('#background').onclick=()=>document.body.classList.toggle('dark');
select(new URLSearchParams(location.search).get('asset') in catalog?new URLSearchParams(location.search).get('asset'):'room');
window.assetIds=Object.keys(catalog);window.assetReady=true;
