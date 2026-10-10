import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
# Render genuine metallic lettering only in review images; preserve deliverables.
protected=[p for folder in ['icons','tiers','badges','blend'] for p in (R/folder).glob('*') if p.suffix in ['.png','.glb','.blend']]
before={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-c.blend'));s=bpy.context.scene;cam=s.camera
q=cam.matrix_world.to_quaternion();inverse=q.inverted()
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.cycles.samples=128
reports={}
for tier in ['bronze','silver','gold','platinum']:
 c=bpy.data.collections['badge-'+tier]
 for col in s.collection.children:
  if not col.library:col.hide_render=col!=c
 face=next(o for o in c.objects if o.name.startswith('Empty smooth face'))
 rim=next(o for o in c.objects if o.name.startswith('Rounded pentagon backing'))
 points=[inverse@(face.matrix_world@v.co) for v in face.data.vertices]
 lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
 center=(lo+hi)/2;center.y+=(hi.y-lo.y)*.055
 cu=bpy.data.curves.new('Preview slim metallic numerals '+tier,'FONT');cu.body='100';cu.font=bpy.data.fonts.load('C:/Windows/Fonts/segoeuil.ttf');cu.align_x='CENTER';cu.align_y='CENTER';cu.space_character=1.08;cu.size=1
 cu.extrude=.018;cu.bevel_depth=.006;cu.bevel_resolution=4;cu.resolution_u=24
 ob=bpy.data.objects.new('Preview 100 '+tier,cu);c.objects.link(ob);ob.rotation_mode='QUATERNION';ob.rotation_quaternion=q
 bpy.context.view_layer.update()
 bounds=[Vector(v) for v in ob.bound_box];localwidth=max(v.x for v in bounds)-min(v.x for v in bounds)
 factor=(hi.x-lo.x)*.55/localwidth;ob.scale=(factor,factor,factor)
 mid=Vector(tuple((min(v[i] for v in bounds)+max(v[i] for v in bounds))/2 for i in range(3)))
 # Front of badge faces the camera along its positive local Z.
 ob.location=q@(Vector((center.x,center.y,hi.z+.012))-Vector((mid.x*factor,mid.y*factor,0)))
 cu.materials.append(rim.data.materials[0])
 assert cu.materials[0]==rim.data.materials[0]
 s.render.filepath=str(R/'previews'/f'gate3-metal-number-{tier}.png');bpy.ops.render.render(write_still=True)
 reports[tier]={'same_material_as_rim':True,'material':cu.materials[0].name,'font':'Segoe UI Light','width_fraction_of_face':.55,'extrusion':.018,'bevel':.006,'preview_only':True}
 bpy.data.objects.remove(ob,do_unlink=True)
 print('METAL_NUMBER_COMPLETE',tier,flush=True)
assert all(hashlib.sha256((R/p).read_bytes()).hexdigest()==h for p,h in before.items())
(R/'source/metal-number-checks.json').write_text(json.dumps({'masters_unchanged':True,'materials':reports,'sha256':before},indent=2))
print('METAL_NUMBER_PREVIEWS_PASS',flush=True)
