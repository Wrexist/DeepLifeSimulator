import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Metres, Y-up, front = +Z. Materials and geometry are shared for compact GLBs.
export const palette = { chalk: '#E8E0D0', cream: '#FAF3DF', teal: '#346862', sage: '#93AA8C', clay: '#B97455', oak: '#AD8052', dark: '#293D43', gold: '#C5A363', glass: '#B4D5D1', leaf: '#597454', paper: '#E8D0A5' };
const materials = new Map(), geometries = new Map();
function material(color, metalness = 0) {
  const key = color + metalness;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color: palette[color] || color, roughness: metalness ? 0.32 : 0.72, metalness }));
  return materials.get(key);
}
function geometry(key, create) { if (!geometries.has(key)) geometries.set(key, create()); return geometries.get(key); }
function part(parent, geo, color, pos, name, metalness = 0) {
  const mesh = new T.Mesh(geo, material(color, metalness));
  mesh.position.set(...pos); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function box(p, size, pos, color, name, radius = 0.045) {
  const r = Math.min(radius, ...size.map(n => n / 3));
  return part(p, geometry('box' + size + r, () => new RoundedBoxGeometry(...size, 2, r)), color, pos, name);
}
function cyl(p, top, bottom, height, pos, color, name, metalness = 0) {
  return part(p, geometry(`cyl${top},${bottom},${height}`, () => new T.CylinderGeometry(top, bottom, height, 16)), color, pos, name, metalness);
}
function ball(p, size, pos, color, name) {
  const b = part(p, geometry('sphere', () => new T.SphereGeometry(1, 16, 10)), color, pos, name); b.scale.set(...size); return b;
}
function torus(p, radius, tube, pos, color, name) {
  return part(p, geometry(`torus${radius},${tube}`, () => new T.TorusGeometry(radius, tube, 8, 24)), color, pos, name, 0.55);
}
function group(name) { const g = new T.Group(); g.name = name; return g; }
function put(p, obj, x, z, angle = 0, s = 1, y = 0) { obj.position.set(x, y, z); obj.rotation.y = angle; obj.scale.setScalar(s); p.add(obj); return obj; }
function legs(p, width, depth, height, color = 'oak') {
  for (const x of [-1, 1]) for (const z of [-1, 1]) cyl(p, .035, .045, height, [x * width / 2, height / 2, z * depth / 2], color, 'leg');
}
export function plant() {
  const g = group('potted-plant'); cyl(g, .23, .16, .35, [0,.175,0], 'clay', 'ceramic-pot');
  cyl(g, .204, .204, .015, [0,.35,0], 'dark', 'soil');
  cyl(g, .025, .03, .68, [0,.65,0], 'oak', 'stem');
  for (let i=0;i<7;i++) { const a=i*2.4, h=.56+i*.075; const b=ball(g,[.21,.09,.12],[Math.cos(a)*.14,h,Math.sin(a)*.14],i%2?'sage':'leaf','leaf'); b.rotation.set(.15,a,.25); }
  return g;
}
export function sofa() {
  const g=group('sofa'); legs(g,1.85,.62,.19,'dark');
  box(g,[2.12,.24,.84],[0,.3,0],'teal','frame');
  box(g,[2.12,.7,.21],[0,.68,-.34],'teal','back');
  for(const x of [-.98,.98]) box(g,[.2,.48,.87],[x,.55,0],'teal','arm');
  for(const x of [-.46,.46]) { box(g,[.87,.15,.61],[x,.48,.055],'sage','seat-cushion'); box(g,[.83,.4,.15],[x,.76,-.18],'sage','back-cushion'); }
  box(g,[.3,.28,.12],[-.66,.7,.02],'cream','throw-pillow').rotation.z=.18;
  return g;
}
export function bed() {
  const g=group('single-bed'); legs(g,1.02,1.9,.22);
  box(g,[1.2,.22,2.1],[0,.3,0],'oak','bed-frame'); box(g,[1.15,.2,2.02],[0,.51,0],'cream','mattress');
  box(g,[1.24,.93,.14],[0,.62,-1.02],'oak','headboard');
  box(g,[1.17,.09,1.42],[0,.66,.28],'sage','duvet');
  box(g,[.8,.13,.4],[0,.68,-.67],'cream','pillow');
  box(g,[1.18,.055,.35],[0,.725,.62],'teal','folded-blanket'); return g;
}
export function laptop() {
  const g=group('laptop'); box(g,[.52,.035,.34],[0,.025,0],'dark','keyboard-base',.012);
  for(let row=0;row<3;row++) box(g,[.4,.007,.025],[0,.047,-.07+row*.045],'sage','key-row',.003);
  box(g,[.51,.33,.028],[0,.2,-.145],'dark','display-shell',.015).rotation.x=-.13;
  box(g,[.45,.265,.008],[0,.205,-.122],'glass','screen',.005).rotation.x=-.13; return g;
}
export function lamp() {
  const g=group('desk-lamp'); cyl(g,.13,.15,.04,[0,.02,0],'teal','base');
  cyl(g,.018,.018,.43,[0,.25,0],'gold','stem',.35);
  cyl(g,.08,.18,.18,[0,.48,0],'teal','shade'); cyl(g,.15,.15,.015,[0,.395,0],'cream','diffuser'); return g;
}
export function desk() {
  const g=group('work-desk'); legs(g,1.32,.6,.7,'dark'); box(g,[1.5,.09,.8],[0,.745,0],'oak','desktop');
  put(g,laptop(),.12,0,0,1,.79); put(g,lamp(),-.53,-.16,0,.75,.79);
  box(g,[.28,.035,.23],[.52,.81,.2],'cream','notebook',.012); return g;
}
export function chair() {
  const g=group('chair'); legs(g,.37,.4,.43,'oak'); box(g,[.5,.09,.5],[0,.47,0],'teal','seat');
  box(g,[.5,.47,.085],[0,.69,-.22],'teal','back'); return g;
}
export function coffeeTable() {
  const g=group('coffee-table'); legs(g,.9,.52,.36); box(g,[1.1,.08,.72],[0,.4,0],'oak','top');
  box(g,[.27,.045,.32],[-.2,.465,.03],'clay','book',.01); box(g,[.27,.035,.32],[-.17,.505,.025],'cream','book',.01);
  cyl(g,.065,.05,.11,[.25,.495,.08],'cream','cup');torus(g,.034,.012,[.318,.505,.08],'cream','handle'); return g;
}
export function keyring() {
  const g=group('house-keys');torus(g,.2,.026,[0,.3,0],'gold','keyring');
  for(const x of [-.1,.1]) {torus(g,.065,.025,[x,.15,.035],'gold','key-bow');box(g,[.055,.3,.04],[x,-.06,.035],'gold','key-shaft',.008);box(g,[.13,.045,.04],[x+.035,-.17,.035],'gold','key-tooth',.008);}
  g.rotation.z=-.3;return g;
}
export function briefcase() {
  const g=group('work-bag');box(g,[.82,.56,.22],[0,.32,0],'clay','leather-case',.08);
  const handle=torus(g,.13,.03,[0,.67,0],'dark','handle');handle.scale.y=.7;
  box(g,[.84,.15,.23],[0,.49,0],'oak','flap');box(g,[.08,.095,.025],[0,.45,.13],'gold','clasp',.012); return g;
}
function shell(name, wallColor='chalk') {
  const g=group(name); box(g,[4.1,.18,3.65],[0,-.09,0],'cream','foundation',.14);
  box(g,[4,.09,3.55],[0,.045,0],'oak','floor',.05);
  box(g,[4,.0+1.8,.1],[0,.98,-1.75],wallColor,'back-wall',.025);
  box(g,[.1,1.8,3.55],[-1.95,.98,0],wallColor,'side-wall',.025);
  // Window is a deliberately graphic material, not a texture of a fake view.
  box(g,[1.35,1.05,.065],[.55,1.19,-1.67],'cream','window-frame',.02);
  box(g,[1.21,.91,.025],[.55,1.19,-1.625],'glass','window-glass',.008);
  box(g,[.045,.94,.03],[.55,1.19,-1.6],'cream','window-mullion',.005);
  box(g,[1.38,.06,.19],[.55,.66,-1.58],'cream','window-sill',.015);
  return g;
}
export function room() {
  const g=shell('starter-room');put(g,bed(),-1.05,-.12,0,.91,.1);put(g,desk(),.92,-1.12,0,.9,.1);
  put(g,chair(),.88,-.32,Math.PI, .84,.1);put(g,plant(),1.62,.98,0,.82,.1);
  box(g,[1.4,.018,1.6],[.65,.102,.38],'clay','woven-rug',.18);
  box(g,[.56,.07,.32],[-1.57,1.31,-1.43],'oak','wall-shelf');
  for(let i=0;i<4;i++)box(g,[.055,.24+i*.012,.14],[-1.76+i*.075,1.45,-1.43],['sage','clay','cream','teal'][i],'shelf-book',.006);
  return g;
}
export function home() {
  const g=shell('settled-home');put(g,sofa(),-.4,-1,0,1,.1);
  box(g,[2.5,.022,1.65],[.05,.11,.4],'sage','rug',.23);put(g,coffeeTable(),-.15,.38,0,1,.13);
  put(g,plant(),1.45,-1.13,0,1.15,.1);put(g,chair(),1.28,.65,-.45,1,.1);
  box(g,[.5,.57,.05],[-1.35,1.33,-1.67],'oak','picture-frame');box(g,[.41,.48,.012],[-1.35,1.33,-1.637],'clay','art-print');
  ball(g,[.13,.13,.008],[-1.35,1.38,-1.623],'cream','art-circle');return g;
}
function building(g,x,z,w,h,color) {
  box(g,[w,h,1.12],[x,h/2+.15,z],color,'building',.055);box(g,[w+.1,.12,1.23],[x,h+.17,z],'cream','roof-cap',.025);
  for(let row=0;row<2;row++)for(const dx of [-.27,.27])box(g,[.3,.38,.04],[x+dx,1.2+row*.62,z+.584],'glass','window',.025);
  box(g,[.42,.7,.045],[x,.51,z+.585],'teal','door',.018);
}
export function city() {
  const g=group('neighborhood');box(g,[4.2,.22,3.2],[0,-.02,0],'chalk','street-base',.16);
  box(g,[4,.09,1.2],[0,.135,1],'sage','pavement',.06);
  building(g,-1,-.65,1.55,2.32,'clay');building(g,.7,-.65,1.5,2.72,'cream');
  const awning=box(g,[1.35,.14,.55],[-1,.96,.16],'teal','shop-awning');awning.rotation.x=.13;
  const bench=group('bench');for(const x of [-.4,.4])box(bench,[.07,.42,.4],[x,.21,0],'dark','bench-leg');
  for(let i=0;i<3;i++)box(bench,[1.1,.055,.1],[0,.47,-.13+i*.12],'oak','seat-slat',.014);
  for(let i=0;i<2;i++)box(bench,[1.1,.11,.05],[0,.7+i*.13,-.19],'oak','back-slat',.014);
  put(g,bench,.85,1.03,0,1,.2);put(g,plant(),-1.55,1.08,0,.82,.2);return g;
}
function serverRack() {
  const g=group('server-rack');box(g,[.52,1.3,.48],[0,.65,0],'dark','cabinet');
  for(let i=0;i<6;i++){box(g,[.43,.14,.02],[0,.18+i*.18,.253],'teal','server');ball(g,[.015,.015,.01],[.16,.18+i*.18,.269],'gold','status-light');}return g;
}
function counter(g,x,z) {box(g,[1.65,.9,.62],[x,.55,z],'teal','counter');box(g,[1.78,.08,.72],[x,1.04,z],'cream','countertop');}
export function business(type) {
  const g=shell('business-'+type);g.children.find(c=>c.name==='back-wall').material=material(type==='factory'?'sage':'chalk');
  if(type==='ai'){put(g,desk(),-.95,-.8,0,.85,.1);put(g,desk(),.7,.3,Math.PI,.85,.1);put(g,serverRack(),1.45,-1.3,0,1,.1);}
  if(type==='restaurant'){counter(g,-.8,-.9);box(g,[.6,.38,.35],[-.8,1.26,-.9],'dark','espresso-machine');box(g,[.54,.07,.25],[-.8,1.13,-.64],'gold','drip-tray');for(const x of [-.8,.8]){cyl(g,.38,.38,.07,[x,.65,.7],'oak','tabletop');cyl(g,.055,.08,.5,[x,.35,.7],'dark','table-stem');put(g,chair(),x,1.25,0,.75,.1);}}
  if(type==='realestate'){put(g,desk(),-.45,-.6,0,1,.1);put(g,chair(),-.45,.12,Math.PI,.9,.1);put(g,city(),.25,-.57,0,.15,.91);box(g,[1.2,.75,.04],[-1.15,1.24,-1.65],'teal','listing-board');for(let i=0;i<3;i++)box(g,[.29,.46,.015],[-1.5+i*.36,1.25,-1.616],'cream','listing-card');}
  if(type==='bank'){counter(g,-.75,.05);put(g,laptop(),-.75,.05,0,1,1.085);cyl(g,.57,.57,.16,[.9,1.03,-1.59],'dark','vault-door').rotation.x=Math.PI/2;const wheel=torus(g,.2,.026,[.9,1.03,-1.475],'gold','vault-wheel');for(const a of [0,Math.PI/2])box(g,[.4,.035,.035],[.9,1.03,-1.45],'gold','vault-spoke').rotation.z=a;}
  if(type==='factory'){box(g,[2.7,.17,.74],[0,.74,.2],'dark','conveyor-frame');legs(g,2.4,.6,.6,'dark');for(let i=0;i<12;i++)cyl(g,.075,.075,.7,[-1.2+i*.215,.85,.2],'sage','roller').rotation.x=Math.PI/2;for(const x of [-.8,.1,.8])box(g,[.3,.3,.3],[x,1.08,.2],'paper','carton');box(g,[.65,1.1,.7],[-1.32,.65,-1],'teal','machine');box(g,[.38,.27,.03],[-1.32,.98,-.63],'glass','control-panel');}
  put(g,plant(),1.55,1.15,0,.7,.1);return g;
}
export const catalog = {
  'city': { title:'Neighborhood', build:city, category:'Home' },
  'room': { title:'Starter room', build:room, category:'Home' },
  'home': { title:'Settled home', build:home, category:'Home' },
  'sofa': {title:'Sofa',build:sofa,category:'Furniture'},
  'bed': {title:'Single bed',build:bed,category:'Furniture'},
  'desk': {title:'Work desk',build:desk,category:'Furniture'},
  'chair': {title:'Chair',build:chair,category:'Furniture'},
  'plant': {title:'Plant',build:plant,category:'Props'},
  'laptop': {title:'Laptop',build:laptop,category:'Props'},
  'lamp': {title:'Desk lamp',build:lamp,category:'Props'},
  'coffee-table': {title:'Coffee table',build:coffeeTable,category:'Furniture'},
  'keys': {title:'House keys',build:keyring,category:'Props'},
  'briefcase': {title:'Work bag',build:briefcase,category:'Props'},
  ...Object.fromEntries(['factory','ai','restaurant','realestate','bank'].map(type=>['business-'+type,{title:type==='ai'?'AI studio':type==='realestate'?'Property agency':type[0].toUpperCase()+type.slice(1),build:()=>business(type),category:'Business'}])),
};
