import bpy,bmesh,ast,math,json,csv,hashlib
from pathlib import Path
from mathutils import Vector,Quaternion
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1]
for name in ['build-gate1.py','build-gate2.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
preserved={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['icons','tiers'] for p in (R/folder).glob('*')}
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-c.blend'));scene=bpy.context.scene;cam=scene.camera
# Laurel geometry is regenerated below, so this script is repeatable.
for c in list(scene.collection.children):
 if not c.library:
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU';scene.cycles.samples=96
groups={};stats={};layout={}
materials={n:mat('Front badge '+n,h,True) for n,h in [('bronze','C07A45'),('silver','C9D2DC'),('gold','F5B731'),('platinum','D5DFEB')]}
for m in materials.values():m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.32
navy=mat('Front badge clean navy face','102235');p=navy.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.48;p.inputs['Coat Weight'].default_value=.15
outer=[(0,-1.5),(-1.43,-.46),(-.88,1.21),(.88,1.21),(1.43,-.46)]
q=cam.matrix_world.to_quaternion()@Quaternion((1,0,0),-math.pi/2)
for tier,material in materials.items():
 name='badge-'+tier;C=bpy.data.collections.new(name);scene.collection.children.link(C);groups[name]=C
 silhouette('Rounded pentagon backing '+name,outer,.10,.27,material,.16)
 silhouette('Empty smooth face '+name,[(x*.81,z*.81) for x,z in outer],-.095,.16,navy,.12)
C=bpy.data.collections.new('laurel');scene.collection.children.link(C);groups['laurel']=C
gold=bpy.data.materials['Polished toy gold F5B731']
for side in [-1,1]:
 pts=[]
 for k in range(7):
  a=math.radians(-85+k*26);pts.append((side*(.22+1.22*math.cos(a)),.10,1.39*math.sin(a)))
 tube(('Left' if side<0 else 'Right')+' laurel branch',pts,.045,gold)
 for k in range(7):
  a=math.radians(-70+k*23);x=side*(.22+1.22*math.cos(a));z=1.39*math.sin(a)
  for leafside in [-1,1]:
   o=ball(('Left' if side<0 else 'Right')+f' leaf {k}-{leafside}',(x+side*leafside*.11,.08,z+.08),(.14,.055,.31),gold);o.rotation_euler.y=side*leafside*math.radians(42)
for name,c in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in list(c.objects):
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.select_set(False)
  o.location=q@o.location;o.rotation_mode='QUATERNION';o.rotation_quaternion=q
 bpy.context.view_layer.update()
 target=.775 if name=='laurel' else .74
 for _ in range(3):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in c.objects for v in o.data.vertices];span=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts));factor=target/span
  for o in c.objects:o.scale*=factor;o.location*=factor
  bpy.context.view_layer.update()
 for _ in range(3):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in c.objects for v in o.data.vertices];cx=(min(p.x for p in pts)+max(p.x for p in pts))/2;cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
  width=2*cam.location.length*math.tan(cam.data.angle_x/2);delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*width,(.5-cy)*width,0))
  for o in c.objects:o.location+=delta
  bpy.context.view_layer.update()
 for o in c.objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');o.select_set(False);o.data.calc_loop_triangles()
 stats[name]={'triangles':sum(len(o.data.loop_triangles) for o in c.objects),'objects':{o.name:len(o.data.loop_triangles) for o in c.objects}}
 assert max(stats[name]['objects'].values())<40000
 if name!='laurel':
  face=next(o for o in c.objects if o.name.startswith('Empty smooth face'));back=next(o for o in c.objects if o.name.startswith('Rounded pentagon backing'))
  pts=[world_to_camera_view(scene,cam,face.matrix_world@v.co) for v in face.data.vertices]
  layout[name]={'face_bounds_normalized':[min(p.x for p in pts),1-max(p.y for p in pts),max(p.x for p in pts),1-min(p.y for p in pts)],'face_backing_width_ratio':face.dimensions.x/back.dimensions.x,'label_anchor':[.5,.407],'number_anchor':[.5,.525],'text_is_preview_only':True}
 for other in groups.values():other.hide_render=other!=c
 for o in c.objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(R/'badges'/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
 bpy.ops.object.select_all(action='DESELECT');scene.render.filepath=str(R/'badges'/f'{name}.png');bpy.ops.render.render(write_still=True)
 print('FRONT_BADGE_COMPLETE',name,flush=True)
for c in groups.values():c.hide_render=c.name!='badge-platinum'
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(R/'blend/group-c.blend'))
geo=json.loads((R/'source/gate3-geometry-checks.json').read_text());geo.update(stats);(R/'source/gate3-geometry-checks.json').write_text(json.dumps(geo,indent=2))
(R/'source/front-badge-layout.json').write_text(json.dumps(layout,indent=2))
rows=list(csv.reader((R/'manifest.csv').open()));rows=[r for r in rows if r[0]!='C']
for name in groups:rows.append(['C',f'badges/{name}.png',1024,1024,stats[name]['triangles'],'#102235 '+{'badge-bronze':'#C07A45','badge-silver':'#C9D2DC','badge-gold':'#F5B731','badge-platinum':'#D5DFEB','laurel':'#F5B731'}[name],'Owner-selected front-facing revision; masters text-free'])
with (R/'manifest.csv').open('w',newline='') as f:csv.writer(f).writerows(rows)
assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==h for n,h in preserved.items())
(R/'source/front-badge-preservation.json').write_text(json.dumps({'groups_a_b_unchanged':True,'sha256':preserved},indent=2))
print('FRONT_BADGE_SET_COMPLETE',flush=True)
