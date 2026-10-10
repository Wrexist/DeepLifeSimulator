import bpy,bmesh,math,json,csv,ast,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[1]
# Reuse only authored helper definitions, never rerun the approved first stage.
tree=ast.parse((ROOT/'source/build-gate1.py').read_text(encoding='utf-8-sig'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'gate1_helpers','exec'))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blend/group-a.blend'))
scene=bpy.context.scene; cam=scene.camera
prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='OPTIX'; prefs.get_devices()
for d in prefs.devices: d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
NAMES=['briefcase-up','money-bag','house-key','rings','rattle','crown','heart','grad-cap','storefront']
for name in NAMES:
 old=bpy.data.collections.get(name)
 if old:
  for o in list(old.objects): bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(old)
for name in ['flame','gem-stack','trophy']: bpy.data.collections[name].hide_render=True
approved={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for n in ['flame','gem-stack','trophy'] for p in [ROOT/'icons'/f'{n}.png',ROOT/'icons'/f'{n}.glb']}
gold=bpy.data.materials['Polished toy gold F5B731']
cream=mat('Warm cream FAF3DF','FAF3DF'); white=mat('Warm white F2EEE6','F2EEE6'); teal=mat('Dark teal 293D43','293D43')
green=mat('Success green 10B981','10B981'); brown=mat('Briefcase brown A86B3C','A86B3C'); terra=mat('Terracotta B97455','B97455')
blue=mat('Brand blue 168BFF','168BFF'); pink=mat('Heart pink red E63B5A','E63B5A'); mint=mat('Pastel mint 9AE3CE','9AE3CE'); lilac=mat('Pastel lilac B9A4ED','B9A4ED')
glow=mat('Warm window FFD45C','FFD45C'); p=glow.node_tree.nodes.get('Principled BSDF'); p.inputs['Emission Color'].default_value=p.inputs['Base Color'].default_value; p.inputs['Emission Strength'].default_value=.18
crystal=mat('Diamond light blue 62B4FF','62B4FF')
groups={}; colors={}
def group(name,palette):
 global C
 C=bpy.data.collections.new(name); scene.collection.children.link(C); groups[name]=C; colors[name]=palette
 return C
def finish(o,name,material):
 o.name=name; move_to(o,C); o.data.materials.append(material)
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,size,material,r=.1):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,name,material); bevel(o,r,4); return o
def ball(name,loc,size,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc); o=bpy.context.object; o.scale=size; return finish(o,name,material)
def torus(name,loc,major,minor,material,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=12,location=loc,major_radius=major,minor_radius=minor,rotation=rot); return finish(bpy.context.object,name,material)
def cyl(name,loc,radius,depth,material,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc,rotation=rot); o=finish(bpy.context.object,name,material); bevel(o,min(.06,depth*.2),3); return o
def tube(name,pts,r,material):
 cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=16; cu.bevel_depth=r; cu.bevel_resolution=3
 sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
 for b,co in zip(sp.bezier_points,pts): b.co=co; b.handle_left_type=b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,cu); C.objects.link(o); cu.materials.append(material); return o
def silhouette(name,outline,y,depth,material,rounding=.06):
 n=len(outline); vs=[(x,y+side*depth/2,z) for side in [-1,1] for x,z in outline]
 fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 o=mesh(name,vs,fs,material,C,False); bevel(o,rounding,4); return o
def coin(name,loc,r=.35):
 cyl(name,loc,r,.13,gold,(math.pi/2,0,0)); torus(name+' rim',(loc[0],loc[1]-.075,loc[2]),r*.8,.025,gold,(math.pi/2,0,0))
def house():
 box('Cream house',(0,0,-.15),(1.55,1.1,1.4),cream,.12)
 silhouette('Terracotta pitched roof',[(-1,.43),(0,1.25),(1,.43)],0,1.4,terra,.10)
 box('Front door',(-.4,-.58,-.4),(.42,.10,.78),teal,.07)
 cyl('Round window gold surround',(.35,-.60,.02),.28,.08,gold,(math.pi/2,0,0))
 cyl('Round warm window',(.35,-.66,.02),.215,.06,glow,(math.pi/2,0,0))
 box('Round window cross vertical',(.35,-.71,.02),(.035,.04,.41),cream,.015)
 box('Round window cross horizontal',(.35,-.71,.02),(.41,.04,.035),cream,.015)
 ball('Door knob',(-.28,-.66,-.42),(.045,.045,.045),gold)

group('briefcase-up','#A86B3C #10B981 #F5B731')
box('Rounded leather briefcase',(0,0,-.13),(2.2,.68,1.5),brown,.20)
box('Briefcase front flap',(0,-.36,.25),(2.04,.11,.60),brown,.12)
tube('Leather carry handle',[(-.43,0,.57),(-.4,0,1),(.4,0,1),(.43,0,.57)],.105,brown)
box('Gold clasp',(0,-.455,.06),(.26,.10,.34),gold,.06)
for x in [-.76,.76]:box('Leather reinforced strap',(x,-.36,-.18),(.16,.10,1.24),brown,.06)
cyl('Promotion green badge',(.8,-.54,-.40),.43,.13,green,(math.pi/2,0,0))
silhouette('Up arrow shape',[(.73,-.65),(.87,-.65),(.87,-.38),(1.04,-.38),(.8,-.15),(.56,-.38),(.73,-.38)],-.64,.045,cream,.025)

group('money-bag','#10B981 #F5B731')
ball('Plump green sack',(0,0,-.24),(.83,.57,.96),green)
ball('Gathered sack neck',(0,0,.60),(.35,.34,.36),green)
for i in range(5):
 a=2*math.pi*i/5; ball('Gathered cloth lobe '+str(i),(.24*math.cos(a),.17*math.sin(a),.87),(.18,.17,.31),green)
for z in [.60,.68]:torus('Gold neck rope',(0,0,z),.32,.055,gold)
tube('Gold rope loose end',[(.28,-.18,.65),(.47,-.33,.43),(.40,-.48,.20)],.045,gold)
cu=bpy.data.curves.new('Embossed dollar only permitted glyph','FONT'); cu.body='$'; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=.95; cu.extrude=.025; cu.bevel_depth=.012
ob=bpy.data.objects.new('Embossed dollar',cu); C.objects.link(ob); ob.location=(0,-.564,-.20); ob.rotation_euler=(math.pi/2,0,0); cu.materials.append(gold)
coin('Left coin',(-.72,-.51,-.94),.34); coin('Right coin',(.61,-.61,-.91),.40)

group('house-key','#FAF3DF #B97455 #F5B731'); house()
# A single leaning key made in a parent coordinate frame.
start=set(C.objects)
torus('Key bow',(0,-.9,.12),.26,.09,gold,(math.pi/2,0,0))
box('Key shaft',(0,-.9,-.42),(.13,.15,.73),gold,.05)
for z in [-.59,-.77]:box('Key tooth',(.13,-.9,z),(.26,.15,.13),gold,.04)
for o in set(C.objects)-start:
 q=Vector(o.location); angle=-.35; o.location=(math.cos(angle)*q.x+math.sin(angle)*q.z+.89,q.y,-math.sin(angle)*q.x+math.cos(angle)*q.z-.02); o.rotation_euler.rotate_axis('Y',angle)

group('rings','#F5B731 #62B4FF')
torus('Left wedding band',(-.43,0,0),.69,.115,gold,(math.radians(72),math.radians(-20),math.radians(-12)))
torus('Diamond wedding band',(.43,-.03,.03),.69,.12,gold,(math.radians(100),math.radians(25),math.radians(10)))
# Round brilliant simplified into two bevelled conical tiers.
for name,r1,r2,depth,z in [('Diamond pavilion',.02,.24,.23,.78),('Diamond crown',.24,.14,.13,.96)]:
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r1,radius2=r2,depth=depth,location=(.43,-.19,z)); o=finish(bpy.context.object,name,crystal); bevel(o,.025,3)
for x in [.25,.61]:ball('Soft gold diamond prong',(x,-.18,.83),(.05,.08,.12),gold)

group('rattle','#9AE3CE #B9A4ED #FAF3DF')
torus('Mint grip ring',(0,0,-.83),.32,.12,mint,(math.pi/2,0,0))
box('Mint rattle handle',(0,0,-.22),(.26,.28,.8),mint,.12)
ball('Lilac rattle head',(0,0,.57),(.64,.53,.64),lilac)
torus('Cream head equator',(0,0,.57),.55,.075,cream,(math.pi/2,0,0))
ball('Cream head front',(0,-.42,.57),(.43,.16,.43),cream)
star=[]
for i in range(10):
 a=math.pi/2+i*math.pi/5;r=.24 if i%2==0 else .115;star.append((r*math.cos(a),.57+r*math.sin(a)))
silhouette('Soft lilac star',star,-.587,.05,lilac,.025)

group('crown','#F5B731 #E63B5A #168BFF')
cyl('Gold crown band',(0,0,-.38),.83,.35,gold)
# Three broad rounded points across the visible crown front; back band stays low.
silhouette('Three rounded crown points',[(-.8,-.32),(-.91,.66),(-.40,.22),(0,.94),(.40,.22),(.91,.66),(.8,-.32)],0,.69,gold,.11)
for x,z in [(-.87,.64),(0,.92),(.87,.64)]:ball('Red crown tip gem',(x,-.035,z),(.145,.15,.145),pink)
for x in [-.57,0,.57]:ball('Blue band jewel',(x,-math.sqrt(.83**2-x*x)-.045,-.35),(.115,.10,.115),blue)
torus('Rounded crown lower rim',(0,0,-.52),.79,.065,gold)

group('heart','#E63B5A #EC4899')
outline=[(0,-1),(-.28,-.78),(-.64,-.46),(-.94,-.08),(-1.01,.36),(-.91,.70),(-.62,.91),(-.29,.88),(0,.58),(.29,.88),(.62,.91),(.91,.70),(1.01,.36),(.94,-.08),(.64,-.46),(.28,-.78)]
o=flame_layer('Inflated pink red heart',outline,.43,0,pink,C); o.rotation_euler.y=math.radians(-10)
p=pink.node_tree.nodes.get('Principled BSDF'); p.inputs['Subsurface Weight'].default_value=.07

group('grad-cap','#293D43 #F5B731')
cyl('Rounded cap skull',(0,0,-.2),.62,.58,teal)
o=box('Square mortarboard',(0,0,.18),(1.8,1.8,.15),teal,.12); o.rotation_euler.z=math.radians(12)
ball('Gold tassel button',(0,0,.29),(.105,.105,.06),gold)
tube('Gold tassel cord',[(0,0,.3),(.55,-.25,.30),(.94,-.45,.23),(1,-.48,-.17)],.035,gold)
ball('Tassel knot',(1,-.48,-.20),(.08,.075,.10),gold)
for i in range(6):
 a=2*math.pi*i/6; tube('Tassel strand '+str(i),[(1+.04*math.cos(a),-.48+.04*math.sin(a),-.22),(1+.07*math.cos(a),-.48+.07*math.sin(a),-.55)],.022,gold)

group('storefront','#168BFF #FAF3DF #FFD45C')
box('Cream shop building',(0,0,0),(2,1,1.75),cream,.14)
box('Blue shop cornice',(0,0,.89),(2.13,1.10,.22),blue,.07)
box('Blue door surround',(-.56,-.53,-.18),(.57,.10,1.22),blue,.06)
box('Door glass',(-.56,-.60,-.08),(.38,.05,.77),teal,.04)
ball('Gold shop door knob',(-.40,-.66,-.31),(.045,.04,.045),gold)
box('Blue window surround',(.43,-.54,-.03),(.93,.10,.91),blue,.08)
box('Glowing shop window',(.43,-.61,-.03),(.75,.06,.73),glow,.06)
box('Window center mullion',(.43,-.66,-.03),(.045,.04,.75),cream,.015)
for i in range(8):
 x=-.9625+i*.275; material=blue if i%2==0 else cream
 o=box('Awning stripe '+str(i),(x,-.69,.55),(.28,.85,.13),material,.04);o.rotation_euler.x=math.radians(18)
 ball('Scalloped awning edge '+str(i),(x,-1.09,.39),(.14,.07,.14),material)
box('Cream shop doorstep',(0,-.18,-.93),(2.13,1.45,.16),cream,.065)

stats=json.loads((ROOT/'source/geometry-checks.json').read_text())
rows=list(csv.reader((ROOT/'manifest.csv').open()))
rows=[r for r in rows if not any('/'+n+'.' in r[1] for n in NAMES)]
for name,c in groups.items():
 for other in groups.values():other.hide_render=other!=c
 bpy.ops.object.select_all(action='DESELECT')
 for o in list(c.objects):
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
 objects=list(c.objects)
 for repeat in range(3):
  pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
  center=Vector(tuple((min(p[i] for p in pts)+max(p[i] for p in pts))/2 for i in range(3)))
  for o in objects:o.location-=center
  bpy.context.view_layer.update()
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  span=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts)); factor=.75/span
  for o in objects:o.location*=factor;o.scale*=factor
  bpy.context.view_layer.update()
 for repeat in range(3):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  cx=(min(p.x for p in pts)+max(p.x for p in pts))/2;cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
  width=2*cam.location.length*math.tan(cam.data.angle_x/2);delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*width,(.5-cy)*width,0))
  for o in objects:o.location+=delta
  bpy.context.view_layer.update()
 for o in objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');o.select_set(False);o.data.calc_loop_triangles()
 stats[name]={'triangles':sum(len(o.data.loop_triangles) for o in objects),'objects':{o.name:len(o.data.loop_triangles) for o in objects}}
 assert all(len(o.data.loop_triangles)<40000 for o in objects)
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'icons'/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
 bpy.ops.object.select_all(action='DESELECT');scene.render.filepath=str(ROOT/'icons'/f'{name}.png');bpy.ops.render.render(write_still=True)
 rows.append(['A',f'icons/{name}.png',1024,1024,stats[name]['triangles'],colors[name],'Review Gate 2; original local Blender/Cycles geometry'])
 print('ASSET_COMPLETE',name,flush=True)
for name in NAMES:groups[name].hide_render=True
bpy.data.collections['flame'].hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blend/group-a.blend'))
with (ROOT/'manifest.csv').open('w',newline='') as f:csv.writer(f).writerows(rows)
(ROOT/'source/geometry-checks.json').write_text(json.dumps(stats,indent=2))
assert all(hashlib.sha256((ROOT/'icons'/n).read_bytes()).hexdigest()==h for n,h in approved.items())
(ROOT/'source/gate1-preservation.json').write_text(json.dumps({'unchanged':True,'sha256':approved},indent=2))
print('GATE2_RENDER_COMPLETE',flush=True)

