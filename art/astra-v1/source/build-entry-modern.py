import bpy,bmesh,math,ast,json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1];ROOT=R
for name in ['build-gate1.py','build-gate2.py','build-grounded-pilot.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
P=R/'entry-modern';P.mkdir(exist_ok=True);stats={}
for name in ['entry-wallet', 'entry-travel', 'entry-medical', 'entry-keys', 'entry-camera', 'entry-planner', 'entry-plant', 'entry-safe', 'entry-dice', 'entry-collection', 'entry-headphones']:
 bpy.ops.wm.open_mainfile(filepath=str(R/'proposals/grounded-work/grounded-work.blend'));scene=bpy.context.scene;cam=scene.camera
 C=next(c for c in scene.collection.children if not c.library)
 for o in list(C.objects):
  if name!='work-office-modern' or any(k in o.name for k in ['bag','pocket','Pocket','binding','zipper','handle','Handle','envelope','Envelope']):bpy.data.objects.remove(o,do_unlink=True)
 teal=satin('Modern teal textile','293D43',.62);cream=satin('Modern warm paper','F2EEE6',.75);metal=satin('Modern satin steel','ADB8BE',.3,.8);dark=satin('Modern charcoal','17272F',.5);tan=satin('Modern kraft paper','BA9367',.8)
 ceramic=satin('Warm ceramic glaze','E6DECE',.32);coffee=satin('Coffee surface','493529',.5)

 if name=='entry-wallet':
  box('Folded leather wallet',(0,0,.48),(1.65,.36,.95),tan,.07)
  box('Wallet seam',(0,-.19,.48),(1.50,.025,.80),dark,.04)
  box('Leather front panel',(0,-.21,.48),(1.44,.025,.74),tan,.04)
  for i,m in enumerate([teal,metal,cream]):
   box('Blank payment card',(-.12+i*.08,.04+i*.035,1.00+i*.08),(1.18,.045,.48),m,.03)
 if name=='entry-travel':
  box('Structured travel case',(0,0,.85),(1.18,.55,1.50),teal,.09)
  for x in [-.38,0,.38]:box('Case stitched rib',(x,-.29,.88),(.03,.018,1.18),dark,.009)
  tube('Luggage carry handle',[(-.25,0,1.6),(-.25,0,1.81),(.25,0,1.81),(.25,0,1.6)],.048,dark)
  for x in [-.4,.4]:cyl('Case wheel',(x,0,.09),.10,.15,dark,(math.pi/2,0,0))
  box('Blank travel document',(.61,-.42,.25),(.48,.08,.67),tan,.025)
 if name=='entry-medical':
  box('Clinical notebook',(-.2,.08,.18),(1.38,1.1,.24),cream,.04)
  box('Teal notebook cover',(-.2,.08,.32),(1.45,1.15,.055),teal,.025)
  tube('Stethoscope tube',[(-.6,-.25,.42),(-.8,.3,.44),(-.4,.7,.45),(.22,.6,.43),(.42,.1,.42),(.77,-.28,.4)],.042,dark)
  cyl('Stethoscope chest piece',(.77,-.28,.40),.23,.09,metal)
  tube('Ear tube left',[(-.60,-.25,.42),(-.53,-.55,.55),(-.35,-.65,.63)],.025,metal)
  tube('Ear tube right',[(-.60,-.25,.42),(-.85,-.42,.56),(-.92,-.60,.63)],.025,metal)
 if name=='entry-keys':
  tube('Key ring',[(.2*math.cos(i*math.tau/40),.2*math.sin(i*math.tau/40),.3) for i in range(41)],.027,metal)
  for x,y,a in [(-.10,-.48,0),(.29,-.34,-.5)]:
   cyl('Key bow',(x,y,.28),.18,.065,metal)
   box('Key shaft',(x,y-.43,.28),(.09,.63,.055),metal,.012)
   for j in range(3):box('Key tooth',(x+.06,y-.48-j*.09,.28),(.16,.05,.055),metal,.01)
  box('Leather key fob',(-.42,.27,.28),(.48,.7,.08),tan,.08)
 if name=='entry-camera':
  box('Camera body',(0,.1,.62),(1.48,.52,.87),dark,.07)
  box('Camera grip',(.60,-.16,.59),(.30,.30,.75),teal,.06)
  cyl('Lens barrel',(-.18,-.40,.61),.34,.52,metal,(math.pi/2,0,0))
  cyl('Lens rubber focus ring',(-.18,-.50,.61),.355,.12,dark,(math.pi/2,0,0))
  cyl('Optical glass',(-.18,-.67,.61),.285,.025,teal,(math.pi/2,0,0))
  box('Viewfinder',(-.2,.1,1.11),(.48,.34,.18),dark,.04)
  cyl('Shutter',(.49,-.02,1.07),.085,.05,metal)
 if name=='entry-planner':
  box('Planner pages',(-.15,0,.16),(1.35,1.6,.20),cream,.025)
  box('Planner cover',(-.15,0,.28),(1.42,1.68,.055),teal,.035)
  box('Elastic closure',(.35,0,.32),(.075,1.68,.025),dark,.012)
  cyl('Metal pen',(.79,-.02,.19),.045,1.40,metal,(math.pi/2,0,0))
  box('Pen clip',(.79,.47,.25),(.035,.28,.025),dark,.008)
 if name=='entry-plant':
  cyl('Ceramic planter',(0,0,.28),.43,.53,cream)
  cyl('Soil',(0,0,.56),.39,.02,dark)
  tube('Plant stem',[(0,0,.54),(.05,0,1.04),(-.04,0,1.63)],.024,teal)
  for x,z,a in [(-.25,.84,-.65),(.28,1.03,.65),(-.25,1.28,-.65),(.18,1.51,.65)]:
   bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(x,0,z));o=bpy.context.object;o.name='Satin leaf';o.scale=(.33,.055,.14);o.rotation_euler[1]=a;o.data.materials.append(teal)
   for col in list(o.users_collection):col.objects.unlink(o)
   C.objects.link(o)
 if name=='entry-safe':
  box('Steel document safe',(0,0,.63),(1.25,.76,1.20),teal,.08)
  box('Inset safe door',(0,-.40,.63),(1.06,.055,1.01),metal,.04)
  cyl('Safe dial',(-.23,-.45,.71),.16,.09,dark,(math.pi/2,0,0))
  box('Safe handle',(.27,-.49,.66),(.06,.10,.40),dark,.025)
 if name=='entry-dice':
  # Blank faces elsewhere; pips are physical recessed-color inserts, never type.
  for x,y,z in [(-.37,.18,.38),(.43,-.20,.38)]:
   box('Ivory dice',(x,y,z),(.65,.65,.65),cream,.07)
   for dx,dz in [(-.14,-.14),(0,0),(.14,.14)]:cyl('Front pip',(x+dx,y-.331,z+dz),.045,.008,dark,(math.pi/2,0,0))
   for dx,dy in [(-.13,-.13),(.13,.13)]:cyl('Top pip',(x+dx,y+dy,z+.331),.045,.008,dark)
 if name=='entry-collection':
  box('Display case base',(0,0,.12),(1.50,1.1,.18),tan,.05)
  box('Velvet display lining',(0,0,.23),(1.35,.95,.045),teal,.025)
  for x,y in [(-.36,-.2),(.34,-.2),(-.36,.23),(.34,.23)]:
   cyl('Collectible metal token',(x,y,.28),.19,.035,metal)
   cyl('Token inset',(x,y,.301),.145,.008,tan)
 if name=='entry-headphones':
  tube('Headphone headband',[(-.65,0,.42),(-.67,0,1.14),(-.42,0,1.52),(0,0,1.63),(.42,0,1.52),(.67,0,1.14),(.65,0,.42)],.075,metal)
  for x in [-.64,.64]:
   box('Headphone ear cup',(x,-.04,.49),(.26,.48,.67),teal,.11)
   box('Ear cushion',(x+(.14 if x<0 else -.14),-.04,.49),(.10,.43,.58),dark,.08)
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
(P/'geometry.json').write_text(json.dumps(stats,indent=2));print('ENTRY_MODERN_COMPLETE')
