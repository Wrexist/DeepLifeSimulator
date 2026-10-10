import bpy,bmesh,math,ast,json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1];ROOT=R
for name in ['build-gate1.py','build-gate2.py','build-grounded-pilot.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
P=R/'context-modern';P.mkdir(exist_ok=True);stats={}
for name in ['contacts-modern','health-modern']:
 bpy.ops.wm.open_mainfile(filepath=str(R/'proposals/grounded-work/grounded-work.blend'));scene=bpy.context.scene;cam=scene.camera
 C=next(c for c in scene.collection.children if not c.library)
 for o in list(C.objects):
  if name!='work-office-modern' or any(k in o.name for k in ['bag','pocket','Pocket','binding','zipper','handle','Handle','envelope','Envelope']):bpy.data.objects.remove(o,do_unlink=True)
 teal=satin('Modern teal textile','293D43',.62);cream=satin('Modern warm paper','F2EEE6',.75);metal=satin('Modern satin steel','ADB8BE',.3,.8);dark=satin('Modern charcoal','17272F',.5);tan=satin('Modern kraft paper','BA9367',.8)
 ceramic=satin('Warm ceramic glaze','E6DECE',.32);coffee=satin('Coffee surface','493529',.5)
 if name=='contacts-modern':
  for x,y,m in [(-.60,-.14,cream),(.64,.20,teal)]:
   cyl('Ceramic mug base',(x,y,.14),.32,.06,m)
   # Lathed open vessel: exterior, rolled lip and visible inside wall.
   verts=[];profile=[(.30,.14),(.34,.20),(.36,.84),(.35,.89),(.31,.89),(.30,.83),(.28,.22)]
   for radius,z in profile:
    verts.extend([(x+radius*math.cos(i*math.tau/64),y+radius*math.sin(i*math.tau/64),z) for i in range(64)])
   faces=[]
   for j in range(len(profile)-1):
    for i in range(64):faces.append((j*64+i,j*64+(i+1)%64,(j+1)*64+(i+1)%64,(j+1)*64+i))
   mesh('Open ceramic mug',verts,faces,m,C)
   cyl('Coffee inside mug',(x,y,.80),.303,.008,coffee)
   side=-1 if x<0 else 1
   tube('Ceramic mug handle',[(x+side*.31,y,.71),(x+side*.56,y,.72),(x+side*.61,y,.49),(x+side*.50,y,.31),(x+side*.33,y,.32)],.049,m)
   cyl('Cork coaster',(x,y,.075),.44,.045,tan)
 if name=='health-modern':
  cyl('Brushed steel water bottle',(-.57,.28,.77),.26,1.35,metal)
  cyl('Bottle shoulder',(-.57,.28,1.43),.23,.12,metal)
  cyl('Bottle screw cap',(-.57,.28,1.56),.19,.15,teal)
  box('Folded gym towel',(.54,.24,.15),(.80,.83,.20),cream,.045)
  box('Towel folded seam',(.54,-.17,.19),(.72,.018,.05),cream,.007)
  cyl('Dumbbell steel grip',(.15,-.58,.26),.065,.82,metal,(0,math.pi/2,0))
  for x in [-.32,.62]:
   cyl('Rubber dumbbell end',(x,-.58,.26),.24,.23,dark,(0,math.pi/2,0))
   cyl('Dumbbell inset hub',(x+(-.12 if x<0 else .12),-.58,.26),.10,.018,metal,(0,math.pi/2,0))
 bpy.ops.object.select_all(action='DESELECT')
 for o in list(C.objects):
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
 objects=list(C.objects);scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.cycles.samples=96
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='OPTIX'
 scene.cycles.device='GPU';bpy.context.view_layer.update()
 points=[o.matrix_world@v.co for o in objects for v in o.data.vertices];center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
 for o in objects:o.location-=center
 bpy.context.view_layer.update()
 for _ in range(5):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices];factor=min(.84/(max(p.x for p in pts)-min(p.x for p in pts)),.84/(max(p.y for p in pts)-min(p.y for p in pts)))
  for o in objects:o.location*=factor;o.scale*=factor
  bpy.context.view_layer.update()
 for _ in range(5):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices];cx=(min(p.x for p in pts)+max(p.x for p in pts))/2;cy=(min(p.y for p in pts)+max(p.y for p in pts))/2;w=2*cam.location.length*math.tan(cam.data.angle_x/2);delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*w,(.5-cy)*w*.75,0))
  for o in objects:o.location+=delta
  bpy.context.view_layer.update()
 counts={}
 for o in objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.calc_loop_triangles();counts[o.name]=len(o.data.loop_triangles)
 assert max(counts.values())<40000
 bpy.ops.export_scene.gltf(filepath=str(P/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
 scene.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(P/(name+'.blend')));bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(P/(name+'.blend')))
 stats[name]={'triangles':sum(counts.values()),'max_mesh':max(counts.values())}
(P/'geometry.json').write_text(json.dumps(stats,indent=2));print('CONTEXT_MODERN_COMPLETE')
