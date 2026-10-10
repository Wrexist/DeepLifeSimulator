import bpy,bmesh,ast,math,json
from pathlib import Path
from mathutils import Vector,Quaternion
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1]
for name in ['build-gate1.py','build-gate2.py']:
 tree=ast.parse((R/'source'/name).read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'))
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-c.blend'));scene=bpy.context.scene;cam=scene.camera
for c in list(scene.collection.children):
 if not c.library:
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
C=bpy.data.collections.new('Unapproved front-facing concept');scene.collection.children.link(C)
silver=mat('Concept satin silver','C9D2DC',True);p=silver.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.32
navy=mat('Concept navy face','102235');p=navy.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.48;p.inputs['Coat Weight'].default_value=.15
outer=[(0,-1.5),(-1.43,-.46),(-.88,1.21),(.88,1.21),(1.43,-.46)]
silhouette('Slim rounded platinum border',outer,.10,.27,silver,.16)
silhouette('Large clean navy face',[(x*.81,z*.81) for x,z in outer],-.095,.16,navy,.12)
q=cam.matrix_world.to_quaternion()@Quaternion((1,0,0),-math.pi/2)
for o in C.objects:
 o.location=q@o.location;o.rotation_mode='QUATERNION';o.rotation_quaternion=q
bpy.context.view_layer.update()
for _ in range(3):
 pts=[world_to_camera_view(scene,cam,o.matrix_world@Vector(v)) for o in C.objects for v in o.bound_box];span=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts));factor=.74/span
 for o in C.objects:o.scale*=factor;o.location*=factor
 bpy.context.view_layer.update()
scene.render.filepath=str(R/'previews/gate3-concept-front-blank.png');scene.cycles.samples=64
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU';bpy.ops.render.render(write_still=True)
print('FRONT_CONCEPT_RENDER_PASS')
