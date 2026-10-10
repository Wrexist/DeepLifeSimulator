import bpy,bmesh,math,ast,json,csv,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1];ROOT=R
for name in ['build-gate1.py','build-gate2.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
protected=[p for f in ['icons','tiers','badges','blend'] for p in (R/f).glob('*') if p.suffix in ['.png','.glb','.blend'] and p.name!='group-d.blend']
before={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-a.blend'));scene=bpy.context.scene;cam=scene.camera
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.cycles.samples=128
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
gold=bpy.data.materials['Polished toy gold F5B731'];brown=mat('Hero warm leather A86B3C','A86B3C');lining=mat('Empty wallet lining 293D43','293D43');cream=mat('Hero cream platform F2EEE6','F2EEE6');blue=mat('Hero brand blue 168BFF','168BFF');violet=mat('Hero violet wrapping 8B5CF6','8B5CF6')
groups={};colors={};stats={};scene_checks={}
def begin(name,palette):
 global C
 C=bpy.data.collections.new(name);scene.collection.children.link(C);groups[name]=C;colors[name]=palette
 return C
def duplicate_prop(source,label,target_width,base_location,exclude=()):
 objects=[]
 for old in bpy.data.collections[source].objects:
  if any(word.lower() in old.name.lower() for word in exclude):continue
  o=old.copy();o.data=old.data.copy();o.name=label+' / '+old.name;C.objects.link(o);objects.append(o)
 points=[o.matrix_world@v.co for o in objects for v in o.data.vertices];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));factor=target_width/(hi.x-lo.x);origin=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));anchor=Vector(base_location)
 for o in objects:o.location=anchor+(o.location-origin)*factor;o.scale*=factor
 bpy.context.view_layer.update()
 return objects

def ribbon_gift(name,center,size,material):
 x,y,z=center;box(name+' wrapped box',center,(size,size*.85,size),material,size*.10)
 box(name+' lid',(x,y,z+size*.46),(size*1.045,size*.90,size*.15),material,size*.06)
 box(name+' front gold ribbon',(x,y-size*.434,z),(.075,.025,size),gold,.012)
 box(name+' top ribbon across',(x,y,z+size*.55),(size,.075,.026),gold,.012)
 box(name+' top ribbon depth',(x,y,z+size*.55),(.075,size*.85,.026),gold,.012)
 for side in [-1,1]:
  o=torus(name+' bow loop',(x+side*.09,y,z+size*.63),.095,.025,gold,(0,math.radians(side*22),0));o.scale.y=.55

begin('hero-start','#A86B3C #293D43 #F5B731')
# Empty open wallet: separated front/back leather panels enclose a dark cavity.
box('Wallet rear leather panel',(0,.24,.1),(2.15,.15,1.36),brown,.14)
box('Empty rear pocket lining',(0,.145,.14),(1.86,.05,1.07),lining,.10)
box('Wallet lower folded edge',(0,-.03,-.53),(2.10,.73,.15),brown,.075)
box('Wallet front leather panel',(0,-.43,-.15),(2.15,.17,.90),brown,.14)
box('Wallet front empty inner lining',(0,-.325,-.13),(1.86,.025,.61),lining,.07)
for x in [-.98,.98]:box('Wallet side gusset',(x,-.035,-.15),(.14,.65,.82),brown,.065)
# Empty slot mouths are relief strips, with no cards/cash inside.
for z in [.15,.40]:box('Empty card slot leather edge',(0,.103,z),(1.60,.035,.045),brown,.020)
box('Leather snap tab',(.66,-.548,.02),(.36,.065,.25),brown,.06)
ball('Small gold snap',(.66,-.595,.02),(.045,.020,.045),gold)
# Exactly one coin, suspended over the empty opening.
coin('Single first coin',(0,-.015,1.30),.34)

begin('hero-grow','#A86B3C #F5B731 #168BFF #F2EEE6')
box('Small cream growth platform',(0,0,-.14),(4.30,1.65,.24),cream,.18)
duplicate_prop('briefcase-up','Career briefcase',1.30,(-1.34,0,0),exclude=('badge','arrow'))
for step,(x,count) in enumerate([(-.17,3),(.83,7),(1.80,12)]):
 for i in range(count):cyl(f'Coin stack {step+1} / coin {i+1}',(x,0,.065+i*.104),.40,.12,gold)
 torus(f'Coin stack {step+1} / top rim',(x,0,.132+(count-1)*.104),.32,.016,gold)
# The tiny flag belongs to the top stack, so the story remains four clusters.
cyl('Top stack flag pole',(1.80,0,1.57),.023,.62,gold)
flag=mesh('Small blue achievement flag',[(1.80,-.025,1.87),(2.18,-.025,1.77),(1.80,-.025,1.64),(1.80,.025,1.87),(2.18,.025,1.77),(1.80,.025,1.64)],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],blue,C,False);bevel(flag,.035,3)

begin('hero-legacy','#FAF3DF #B97455 #F5B731 #168BFF #8B5CF6 #F2EEE6')
box('Small cream legacy platform',(0,0,-.14),(3.50,1.90,.24),cream,.18)
objects=duplicate_prop('house-key','Legacy cozy house',1.90,(0,.10,0),exclude=('key',))
roofheight=max((o.matrix_world@v.co).z for o in objects for v in o.data.vertices)
duplicate_prop('crown','Heir crown',1.05,(0,.12,roofheight-.045))
ribbon_gift('Blue heir gift',(-1.12,-.48,.30),.55,blue)
ribbon_gift('Violet heir gift',(1.09,-.47,.245),.44,violet)
# Strip unrelated original assets from this newly saved group file only.
for c in list(scene.collection.children):
 if not c.library and c not in groups.values():
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
for name,c in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in list(c.objects):
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
 objects=list(c.objects)
 points=[o.matrix_world@v.co for o in objects for v in o.data.vertices];center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
 for o in objects:o.location-=center
 bpy.context.view_layer.update()
 # Art stays within 17%-68% vertically, leaving the required blank bands.
 for _ in range(4):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  sx=max(p.x for p in pts)-min(p.x for p in pts);sy=max(p.y for p in pts)-min(p.y for p in pts);factor=min(.77/sx,.49/sy)
  for o in objects:o.location*=factor;o.scale*=factor
  bpy.context.view_layer.update()
 for _ in range(4):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  cx=(min(p.x for p in pts)+max(p.x for p in pts))/2;cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
  width=2*cam.location.length*math.tan(cam.data.angle_x/2);height=width*1200/1600;delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*width,(.575-cy)*height,0))
  for o in objects:o.location+=delta
  bpy.context.view_layer.update()
 for o in objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');o.select_set(False);o.data.calc_loop_triangles()
 counts={o.name:len(o.data.loop_triangles) for o in objects};assert max(counts.values())<40000;stats[name]={'triangles':sum(counts.values()),'objects':counts}
 for other in groups.values():other.hide_render=other!=c
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(R/'heroes'/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
 bpy.ops.object.select_all(action='DESELECT');scene.render.filepath=str(R/'heroes'/f'{name}.png');bpy.ops.render.render(write_still=True)
 print('HERO_COMPLETE',name,flush=True)
for c in groups.values():c.hide_render=c.name!='hero-start'
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(R/'blend/group-d.blend'))
(R/'source/gate4-geometry-checks.json').write_text(json.dumps(stats,indent=2))
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==h for n,h in before.items())
(R/'source/gate4-preservation.json').write_text(json.dumps({'prior_masters_unchanged':True,'sha256':before},indent=2))
rows=list(csv.reader((R/'manifest.csv').open()));rows=[r for r in rows if r[0]!='D']
for name in groups:rows.append(['D',f'heroes/{name}.png',1600,1200,stats[name]['triangles'],colors[name],'Review Gate 4; empty top 15% / bottom 30%'])
with (R/'manifest.csv').open('w',newline='') as f:csv.writer(f).writerows(rows)
print('GATE4_PRODUCTION_COMPLETE',flush=True)
