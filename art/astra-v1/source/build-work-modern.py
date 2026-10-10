import bpy,bmesh,math,ast,json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1];ROOT=R
for name in ['build-gate1.py','build-gate2.py','build-grounded-pilot.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
P=R/'work-modern';P.mkdir(exist_ok=True);stats={}
for name in ['work-office-modern','work-food-modern','work-study-modern']:
 bpy.ops.wm.open_mainfile(filepath=str(R/'proposals/grounded-work/grounded-work.blend'));scene=bpy.context.scene;cam=scene.camera
 C=next(c for c in scene.collection.children if not c.library)
 for o in list(C.objects):
  if name!='work-office-modern' or any(k in o.name for k in ['bag','pocket','Pocket','binding','zipper','handle','Handle','envelope','Envelope']):bpy.data.objects.remove(o,do_unlink=True)
 teal=satin('Modern teal textile','293D43',.62);cream=satin('Modern warm paper','F2EEE6',.75);metal=satin('Modern satin steel','ADB8BE',.3,.8);dark=satin('Modern charcoal','17272F',.5);tan=satin('Modern kraft paper','BA9367',.8)
 if name=='work-food-modern':
  box('Satin service tray',(0,0,.10),(2.2,1.3,.07),metal,.07)
  for x in [-1.06,1.06]:box('Tray rolled side',(x,0,.16),(.05,1.25,.10),metal,.025)
  for y in [-.61,.61]:box('Tray rolled end',(0,y,.16),(2.12,.05,.10),metal,.025)
  box('Folded teal service cloth',(.48,.04,.20),(.82,.89,.09),teal,.025)
  box('Cloth folded seam',(.48,-.36,.25),(.77,.028,.013),teal,.005)
  cyl('Cream takeaway cup',(-.48,.13,.68),.30,1.03,cream)
  cyl('Cup kraft sleeve',(-.48,.13,.66),.307,.38,tan)
  cyl('Charcoal cup lid',(-.48,.13,1.22),.325,.07,dark)
  cyl('Raised lid lip',(-.48,.13,1.267),.28,.035,dark)
  box('Lid sipping slot',(-.48,-.08,1.288),(.12,.035,.008),dark,.012)
 if name=='work-study-modern':
  box('Closed teal notebook',(-.28,.12,.75),(1.15,.18,1.45),teal,.025)
  box('Notebook cream pages',(-.27,.005,.75),(1.05,.045,1.35),cream,.009)
  box('Notebook front cover',(-.28,-.03,.75),(1.15,.025,1.45),teal,.014)
  box('Notebook spine',(-.84,.06,.75),(.08,.22,1.45),teal,.022)
  box('Notebook elastic band',(.13,-.05,.75),(.04,.015,1.42),dark,.004)
  box('Loose study paper',(.49,-.31,.05),(1.04,.78,.018),cream,.007)
  pen=cyl('Satin pen barrel',(.85,.05,.69),.043,1.17,metal);pen.rotation_euler.y=math.radians(-12)
  tip=cyl('Pen dark grip',(.96,.05,.16),.047,.22,dark);tip.rotation_euler.y=math.radians(-12)
  box('Pen pocket clip',(.71,-.005,1.12),(.019,.019,.26),metal,.006)
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
(P/'geometry.json').write_text(json.dumps(stats,indent=2));print('WORK_MODERN_COMPLETE')
