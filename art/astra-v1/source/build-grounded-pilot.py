import bpy,bmesh,math,ast,json,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1];ROOT=R
for name in ['build-gate1.py','build-gate2.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
protected=[p for f in ['icons','tiers','badges','blend','heroes'] for p in (R/f).glob('*') if p.suffix in ['.png','.glb','.blend']]
before={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-a.blend'));scene=bpy.context.scene;cam=scene.camera
for c in list(scene.collection.children):
 if not c.library:
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
C=bpy.data.collections.new('Grounded work pilot');scene.collection.children.link(C)
def satin(name,color,rough=.5,metal=0):
 m=mat(name,color);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Coat Weight'].default_value=.08;p.inputs['Subsurface Weight'].default_value=0
 return m
fabric=satin('Structured dark teal canvas','293D43',.65)
seam=satin('Teal binding','41575A',.58)
leather=satin('Dark leather handles','17292D',.47)
alloy=satin('MacBook silver aluminium','CED3D7',.29,.8)
edge=satin('Graphite keyboard','17272F',.5)
glass=satin('Powered display with original blue wallpaper','FFFFFF',.4,0)
# Embedded original wallpaper, used by both Cycles and the GLB emission channel.
wall=bpy.data.images.new('Original blue desktop wallpaper',width=512,height=320)
pixels=[]
for iy in range(320):
 for ix in range(512):
  u=ix/511;v=iy/319
  wave=math.exp(-((v-(.25+.33*math.sin(u*3.4))) / .17)**2)
  light=math.exp(-((v-(.58+.25*math.sin(u*3.1+1))) / .12)**2)
  pixels.extend((.015+.04*wave+.08*light,.05+.24*wave+.19*light,.16+.42*wave+.26*light,1))
wall.pixels=pixels;wall.pack()
p=glass.node_tree.nodes.get('Principled BSDF');tex=glass.node_tree.nodes.new('ShaderNodeTexImage');tex.image=wall
glass.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);glass.node_tree.links.new(tex.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.7
paper=satin('Warm unprinted envelope','E1D5BB',.8)
fold=satin('Envelope folded edge','B9AC93',.85)
# A modest structured bag, with small construction details and restrained rounding.
box('Canvas work bag',(-1.02,.39,.69),(1.27,.43,1.25),fabric,.07)
box('Front stitched pocket',(-1.02,.157,.49),(1.03,.045,.64),fabric,.025)
for x in [-1.53,-.51]:tube('Pocket side binding',[(x,.125,.22),(x,.125,.76)],.008,seam)
tube('Pocket lower binding',[(-1.53,.125,.20),(-1.02,.122,.19),(-.51,.125,.20)],.008,seam)
box('Top zipper tape',(-1.02,.39,1.319),(1.05,.065,.012),leather,.004)
box('Small zipper pull',(-.64,.35,1.334),(.10,.025,.012),alloy,.004)
for y in [.24,.52]:
 tube('Leather handle',[(-1.36,y,1.22),(-1.34,y,1.68),(-1.02,y,1.80),(-.70,y,1.68),(-.68,y,1.22)],.026,leather)
 for x in [-1.36,-.68]:box('Handle sewn tab',(x,y-.01,1.17),(.08,.026,.20),leather,.014)
# Move the whole bag clear of the computer, preserving its construction.
bag_objects=list(C.objects)
for o in bag_objects:o.location.x-=1.20
bag_names={o.name for o in bag_objects}
# Silver MacBook silhouette: thin chassis, large trackpad, black keys and notch.
bx=.43;by=-.39;bz=.16
box('Laptop lower chassis',(bx,by,bz),(1.95,1.26,.065),alloy,.025)
box('Laptop keyboard well',(bx,by+.18,bz+.039),(1.70,.53,.012),edge,.014)
for row in range(4):
 for col in range(13):
  box('Unlabelled key %d %d'%(row,col),(bx-.76+col*.127,by+.39-row*.12,bz+.051),(.105,.09,.012),edge,.008)
box('Space bar',(bx,by-.085,bz+.051),(.70,.078,.012),edge,.008)
track=satin('Trackpad satin silver','B8C1C7',.4,.65)
box('Large inset trackpad',(bx,by-.37,bz+.034),(.83,.34,.006),track,.016)
tilt=math.radians(-13);hinge=Vector((bx,by+.60,bz+.048))
def screenpart(name,offset,size,material,r):
 q=Vector(offset);q.rotate(__import__('mathutils').Euler((tilt,0,0)));o=box(name,hinge+q,size,material,r);o.rotation_euler.x=tilt;return o
screenpart('Slim display housing',(0,0,.64),(1.95,.048,1.28),alloy,.025)
screenpart('Dark display bezel',(0,-.028,.64),(1.87,.014,1.20),edge,.015)
display=screenpart('Powered glass display',(0,-.037,.65),(1.79,.006,1.10),glass,.009)
# Face-aligned UVs keep the wallpaper continuous rather than cube-unwrapped.
for poly in display.data.polygons:
 for li in poly.loop_indices:
  co=display.data.vertices[display.data.loops[li].vertex_index].co
  display.data.uv_layers.active.data[li].uv=(co.x/1.79+.5,co.z/1.10+.5)
screenpart('MacBook camera notch',(0,-.044,1.185),(.21,.009,.067),edge,.012)
dock=satin('Translucent style desktop dock','9BB9D4',.5)
screenpart('Desktop dock',(0,-.044,.155),(.77,.008,.078),dock,.025)
for i,color in enumerate(['168BFF','10B981','F2EEE6','8B5CF6','E63B5A','62B4FF','F5B731']):
 icon=satin('Desktop icon '+str(i),color,.5)
 screenpart('Unlabelled dock icon '+str(i),(-.30+i*.10,-.051,.156),(.058,.008,.050),icon,.008)
laptop_names={o.name for o in C.objects if o.name not in bag_names}
# A paper pay envelope lying beside the laptop, no printed labels or currency.
envelope=[]
envelope.append(box('Plain pay envelope',(-.92,-.61,.076),(.93,.48,.012),paper,.006))
envelope.append(tube('Envelope triangular fold',[(-1.37,-.385,.085),(-.92,-.72,.085),(-.47,-.385,.085)],.003,fold))
for o in envelope:o.location.x-=1.0
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.cycles.samples=128
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
bpy.ops.object.select_all(action='DESELECT')
for o in list(C.objects):
 o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
objects=list(C.objects);bpy.context.view_layer.update()
points=[o.matrix_world@v.co for o in objects for v in o.data.vertices];center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
for o in objects:o.location-=center
bpy.context.view_layer.update()
for _ in range(4):
 pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices];sx=max(p.x for p in pts)-min(p.x for p in pts);sy=max(p.y for p in pts)-min(p.y for p in pts);factor=min(.72/sx,.49/sy)
 for o in objects:o.location*=factor;o.scale*=factor
 bpy.context.view_layer.update()
for _ in range(4):
 pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices];cx=(min(p.x for p in pts)+max(p.x for p in pts))/2;cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
 width=2*cam.location.length*math.tan(cam.data.angle_x/2);height=width*1200/1600;delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*width,(.575-cy)*height,0))
 for o in objects:o.location+=delta
 bpy.context.view_layer.update()
for o in objects:
 o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');o.select_set(False);o.data.calc_loop_triangles()
counts={o.name:len(o.data.loop_triangles) for o in objects};assert max(counts.values())<40000
bag_points=[o.matrix_world@v.co for o in objects if o.name in bag_names for v in o.data.vertices]
laptop_points=[o.matrix_world@v.co for o in objects if o.name in laptop_names for v in o.data.vertices]
world_gap=min(p.x for p in laptop_points)-max(p.x for p in bag_points)
screen_gap=(min(world_to_camera_view(scene,cam,p).x for p in laptop_points)-max(world_to_camera_view(scene,cam,p).x for p in bag_points))*1600
assert world_gap>0 and screen_gap>12,(world_gap,screen_gap)
P=R/'proposals/grounded-work';P.mkdir(parents=True,exist_ok=True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(P/'hero-grow.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
bpy.ops.object.select_all(action='DESELECT');scene.render.filepath=str(P/'hero-grow.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(P/'grounded-work.blend'));bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(P/'grounded-work.blend'))
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==h for n,h in before.items())
(P/'checks.json').write_text(json.dumps({'prior_masters_unchanged':True,'protected_hashes':before,'triangles':sum(counts.values()),'objects':counts,'shared_camera':str(cam.library.filepath),'bag_laptop_world_gap':world_gap,'bag_laptop_screen_gap_pixels':screen_gap,'status':'grounded direction approved; MacBook and clearance revision'},indent=2))
print('GROUNDED_PILOT_COMPLETE',flush=True)

