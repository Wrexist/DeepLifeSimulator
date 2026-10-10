import bpy,bmesh,math,json,csv,ast,hashlib,shutil,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1]
ROOT=R
ONLY=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
for script in ['build-gate1.py','build-gate2.py']:
 tree=ast.parse((R/'source'/script).read_text(encoding='utf-8-sig'))
 exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-a.blend'))
scene=bpy.context.scene;cam=scene.camera
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
approved={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (R/'icons').glob('*')}
groups={};colors={'flame-1':'#F0442E #FF8A1F #FFD45C','flame-2':'#F0442E #FF8A1F #FFD45C','flame-3':'#F0442E #FF8A1F #9BD7FF #FFD45C','trophy-bronze':'#C07A45','trophy-silver':'#C9D2DC','trophy-gold':'#F5B731','badge-bronze':'#C07A45','badge-silver':'#C9D2DC','badge-gold':'#F5B731','badge-platinum':'#D5DFEB #62B4FF #FFD45C','laurel':'#F5B731'};report={};rows=[]
gold=bpy.data.materials['Polished toy gold F5B731'];bronze=mat('Tier bronze C07A45','C07A45',True);silver=mat('Tier silver C9D2DC','C9D2DC',True)
hot=mat('Blue white hot core 9BD7FF','9BD7FF');p=hot.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=p.inputs['Base Color'].default_value;p.inputs['Emission Strength'].default_value=.20
ember=mat('Warm ember FFD45C','FFD45C')

def clone(source,name):
 c=bpy.data.collections.new(name);scene.collection.children.link(c);groups[name]=c
 for old in bpy.data.collections[source].objects:
  o=old.copy();o.data=old.data.copy();c.objects.link(o)
 return c
def bounds(c):
 pts=[o.matrix_world@v.co for o in c.objects for v in o.data.vertices]
 lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
 return lo,hi
def center_fit(c,target=.75,rescale=True):
 objects=list(c.objects)
 for o in objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
 if rescale:
  for _ in range(3):
   lo,hi=bounds(c);center=(lo+hi)/2
   for o in objects:o.location-=center
   bpy.context.view_layer.update()
   pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
   span=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts));factor=target/span
   for o in objects:o.location*=factor;o.scale*=factor
   bpy.context.view_layer.update()
 for _ in range(3):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  cx=(min(p.x for p in pts)+max(p.x for p in pts))/2;cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
  width=2*cam.location.length*math.tan(cam.data.angle_x/2);delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*width,(.5-cy)*width,0))
  for o in objects:o.location+=delta
  bpy.context.view_layer.update()

def deliver(name,c,folder,identical=None):
 for other in groups.values():other.hide_render=other!=c
 bpy.ops.object.select_all(action='DESELECT')
 for o in c.objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');o.data.calc_loop_triangles();o.select_set(False)
 triangles={o.name:len(o.data.loop_triangles) for o in c.objects};assert max(triangles.values())<40000
 report[name]={'triangles':sum(triangles.values()),'objects':triangles}
 if ONLY and ONLY!=name:
  rows.append(['B' if folder=='tiers' else 'C',f'{folder}/{name}.png',1024,1024,sum(triangles.values()),colors.get(name,''),'Review Gate 3'])
  return
 if identical:
  for ext in ['png','glb']:shutil.copyfile(R/'icons'/f'{identical}.{ext}',R/folder/f'{name}.{ext}')
 else:
  for o in c.objects:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(R/folder/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
  bpy.ops.object.select_all(action='DESELECT');scene.render.filepath=str(R/folder/f'{name}.png');bpy.ops.render.render(write_still=True)
 rows.append(['B' if folder=='tiers' else 'C',f'{folder}/{name}.png',1024,1024,sum(triangles.values()),colors.get(name,''),'Review Gate 3'])
 print('ASSET_COMPLETE',name,flush=True)

C=clone('flame','flame-1');lo,hi=bounds(C);center=(lo+hi)/2
# Exactly 60% world-space size; retain baseline depth to avoid camera changes.
for o in C.objects:o.location=center+(o.location-center)*.60;o.scale*=.60
bpy.context.view_layer.update();center_fit(C,rescale=False)
clone('flame','flame-2')
C=clone('flame','flame-3');lo,hi=bounds(C);center=(lo+hi)/2;width=hi.x-lo.x;height=hi.z-lo.z
for o in C.objects:
 for v in o.data.vertices:v.co.z*=1.15
 if 'yellow' in o.name.lower():o.data.materials.clear();o.data.materials.append(hot)
# One additional broad flick, behind the orange center and extending left.
red=bpy.data.materials['Flame coral F0442E']
outline=[(-.75,-.4),(-.99,.15),(-.89,.65),(-.58,1.08),(-.58,.59),(-.35,.28),(-.38,-.20)]
o=flame_layer('Extra blazing flick',[(center.x+x*width*.50,center.z+z*height*.46) for x,z in outline],width*.11,center.y,red,C)
for i,(x,z,size) in enumerate([(-.78,.40,.028),(.78,.35,.025),(.65,.68,.028)]):
 ball('Floating ember '+str(i+1),(center.x+x*width*.68,center.y-.05,center.z+z*height*.63),(width*size,width*size*.7,width*size*1.65),ember)
center_fit(C,.775)
for name,material in [('trophy-bronze',bronze),('trophy-silver',silver),('trophy-gold',gold)]:
 c=clone('trophy',name)
 for o in c.objects:o.data.materials.clear();o.data.materials.append(material)
# Remove original asset collections from this new group file only.
for c in list(scene.collection.children):
 if not c.library and c not in groups.values():
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
for name,c in groups.items():deliver(name,c,'tiers',{'flame-2':'flame','trophy-gold':'trophy'}.get(name))
for c in groups.values():c.hide_render=c.name!='flame-2'
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(R/'blend/group-b.blend'))
# Keep the same rig and render settings, replacing only geometry collections.
for c in list(groups.values()):
 for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.collections.remove(c)
groups={}
platinum=mat('Platinum rim D5DFEB','D5DFEB',True)
outer=[(0,-1.5),(-1.43,-.46),(-.88,1.21),(.88,1.21),(1.43,-.46)]
face_outline=[(x*.56,z*.56) for x,z in outer]
for name,material in [('badge-bronze',bronze),('badge-silver',silver),('badge-gold',gold),('badge-platinum',platinum)]:
 C=bpy.data.collections.new(name);scene.collection.children.link(C);groups[name]=C
 silhouette('Rounded pentagon backing '+name,outer,.12,.28,material,.13)
 # Continuous raised pentagon rim surrounding an explicitly empty face.
 verts=[]
 for factor,y in [(1,-.04),(1,-.24),(.58,-.24),(.58,-.04)]:
  verts.extend([(x*factor,y,z*factor) for x,z in outer])
 faces=[]
 for k in range(4):
  for i in range(5):faces.append((k*5+i,k*5+(i+1)%5,((k+1)%4)*5+(i+1)%5,((k+1)%4)*5+i))
 o=mesh('Raised pentagon rim '+name,verts,faces,material,C,False);bevel(o,.065,4)
 o=silhouette('Empty smooth face '+name,face_outline,-.145,.18,material,.11)
 if name=='badge-platinum':
  # Real vertex colors survive in GLB; a subtle cool-to-warm sheen without text.
  m=mat('Platinum blue orange face','FFFFFF',True);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.30
  o.data.materials.clear();o.data.materials.append(m)
  attr=o.data.color_attributes.new(name='PlatinumSheen',type='FLOAT_COLOR',domain='POINT')
  for i,v in enumerate(o.data.vertices):
   t=max(0,min(1,(v.co.x+v.co.z*.4+1.2)/2.4))
   a=(.34,.60,.90);b=(.95,.65,.35);attr.data[i].color=tuple(a[j]*(1-t)+b[j]*t for j in range(3))+(1,)
  node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='PlatinumSheen';m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
 center_fit(C,.735)
# Laurel curves and leaves occupy a slightly wider frame than badges, aligned
# at the same projected center. No recomposition offset is needed in the app.
C=bpy.data.collections.new('laurel');scene.collection.children.link(C);groups['laurel']=C
for side in [-1,1]:
 pts=[]
 for k in range(7):
  a=math.radians(-85+k*26);pts.append((side*(.22+1.22*math.cos(a)),.10,1.39*math.sin(a)))
 tube(('Left' if side<0 else 'Right')+' laurel branch',pts,.045,gold)
 for k in range(7):
  a=math.radians(-70+k*23);x=side*(.22+1.22*math.cos(a));z=1.39*math.sin(a)
  for leafside in [-1,1]:
   o=ball(('Left' if side<0 else 'Right')+f' leaf {k}-{leafside}',(x+side*leafside*.11,.08,z+.08),(.14,.055,.31),gold)
   o.rotation_euler.y=side*leafside*math.radians(42)
center_fit(C,.775)
for name,c in groups.items():deliver(name,c,'badges')
for c in groups.values():c.hide_render=c.name!='badge-platinum'
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(R/'blend/group-c.blend'))
existing=list(csv.reader((R/'manifest.csv').open()));existing=[r for r in existing if r[0] not in ['B','C']]
with (R/'manifest.csv').open('w',newline='') as f:csv.writer(f).writerows(existing+rows)
(R/'source/gate3-geometry-checks.json').write_text(json.dumps(report,indent=2))
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==h for n,h in approved.items())
(R/'source/group-a-preservation.json').write_text(json.dumps({'unchanged':True,'sha256':approved},indent=2))
print('GATE3_RENDER_COMPLETE',flush=True)

