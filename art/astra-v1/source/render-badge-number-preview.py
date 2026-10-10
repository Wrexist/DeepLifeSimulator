import bpy,json,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-c.blend'));s=bpy.context.scene
c=bpy.data.collections['badge-platinum']
for col in s.collection.children:
 if not col.library:col.hide_render=col!=c
face=next(o for o in c.objects if o.name.startswith('Empty smooth face'))
pts=[face.matrix_world@v.co for v in face.data.vertices]
lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));center=(lo+hi)/2;center.z+=(hi.z-lo.z)*.055
cu=bpy.data.curves.new('Temporary recessed number cutter','FONT');cu.body='100';cu.font=bpy.data.fonts.load('C:/Windows/Fonts/segoeui.ttf');cu.align_x='CENTER';cu.align_y='CENTER';cu.size=1;cu.space_character=1.06;cu.extrude=.03;cu.bevel_depth=.002;cu.bevel_resolution=2
ob=bpy.data.objects.new('Preview-only number cutter',cu);c.objects.link(ob);ob.rotation_euler=(math.pi/2,0,0)
bpy.context.view_layer.update();factor=(hi.x-lo.x)*.50/ob.dimensions.x;ob.scale=(factor,factor,factor)
bpy.context.view_layer.update();pts=[ob.matrix_world@Vector(v) for v in ob.bound_box];mid=Vector(tuple((min(v[i] for v in pts)+max(v[i] for v in pts))/2 for i in range(3)));ob.location=Vector((center.x,lo.y,center.z))-mid
bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# Cutter crosses the face by a shallow amount. The visible letters are light
# metallic inlays sitting behind the original face plane, with real edge shading.
mod=face.modifiers.new('Preview-only recessed number','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=ob
bpy.ops.object.select_all(action='DESELECT');face.select_set(True);bpy.context.view_layer.objects.active=face;bpy.ops.object.modifier_apply(modifier=mod.name)
oldmesh=face.data;clean=bpy.data.meshes.new('Clean planar inlay face');clean.from_pydata([tuple(v.co) for v in oldmesh.vertices],[],[tuple(p.vertices) for p in oldmesh.polygons]);clean.update()
for material in oldmesh.materials:clean.materials.append(material)
for attr in oldmesh.color_attributes:
 if attr.domain=='POINT':
  newattr=clean.color_attributes.new(name=attr.name,type='FLOAT_COLOR',domain='POINT')
  for i,v in enumerate(clean.vertices):
   t=max(0,min(1,((face.matrix_world@v.co).x-center.x)/(hi.x-lo.x)+.5))
   a=(.34,.60,.90);b=(.95,.65,.35);newattr.data[i].color=tuple(a[j]*(1-t)+b[j]*t for j in range(3))+(1,)
face.data=clean
for polygon in face.data.polygons: polygon.use_smooth=True
normal=face.modifiers.new('Repaired face normals','WEIGHTED_NORMAL');normal.keep_sharp=True
ob.hide_render=True
cu=bpy.data.curves.new('Temporary silver number inlay','FONT');cu.body='100';cu.font=bpy.data.fonts.load('C:/Windows/Fonts/segoeui.ttf');cu.align_x='CENTER';cu.align_y='CENTER';cu.size=1;cu.space_character=1.06
fill=bpy.data.objects.new('Preview-only silver inlay',cu);c.objects.link(fill);fill.rotation_euler=(math.pi/2,0,0);fill.scale=(factor,factor,factor)
bpy.context.view_layer.update();pts=[fill.matrix_world@Vector(v) for v in fill.bound_box];mid=Vector(tuple((min(v[i] for v in pts)+max(v[i] for v in pts))/2 for i in range(3)));fill.location=Vector((center.x,lo.y+.008,center.z))-mid
m=bpy.data.materials.new('Brushed pale silver inlay');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.80,.84,.90,1);p.inputs['Metallic'].default_value=.45;p.inputs['Roughness'].default_value=.38;cu.materials.append(m)
s.render.filepath=str(R/'previews/gate3-platinum-inlay-preview.png');s.render.film_transparent=True;s.cycles.samples=96
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';bpy.ops.render.render(write_still=True)
(R/'source/badge-number-placement.json').write_text(json.dumps({'font':'Segoe UI Regular','face_width_fraction':.50,'tracking':1.06,'treatment':'shallow recessed pale-silver inlay with real scene lighting','preview_only':True,'masters_saved':False},indent=2))
print('PREVIEW_INLAY_RENDER_PASS')



