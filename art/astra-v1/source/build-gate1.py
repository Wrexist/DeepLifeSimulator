import bpy, bmesh, math, json, csv
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
 if c.name != 'Collection': bpy.data.collections.remove(c)
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=96
scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX'; prefs.get_devices()
for d in prefs.devices: d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
scene.render.resolution_x=scene.render.resolution_y=1024; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
scene.render.threads_mode='FIXED'; scene.render.threads=8
rig=bpy.data.collections.new('DeepLife shared studio'); scene.collection.children.link(rig)
def move_to(o,c):
 for old in list(o.users_collection): old.objects.unlink(o)
 c.objects.link(o)
def aim(o): o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.75,-7.55,2.15))
cam=bpy.context.object; cam.name='Shared 50mm camera'; cam.data.lens=50; aim(cam); move_to(cam,rig); scene.camera=cam
for name,loc,power,size,color in [('Warm key',(-3,-4,5),650,4,(1,.91,.80)),('Blue rim',(3,2,3),300,3,(.32,.58,1)),('Neutral fill',(4,-3,1),100,3,(1,1,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color; aim(o); move_to(o,rig)
# Original float studio environment, packed into the shared file (no outside license).
w=bpy.data.worlds.new('Low-strength neutral studio HDRI'); w.use_nodes=True; scene.world=w
im=bpy.data.images.new('Original neutral studio HDRI',width=256,height=128,float_buffer=True)
pixels=[]
for y in range(128):
 for x in range(256):
  v=.14+1.5*math.exp(-((x-70)/26)**6-((y-45)/20)**6)+.5*math.exp(-((x-190)/35)**6-((y-55)/22)**6)
  pixels.extend([v,v,v,1])
im.pixels.foreach_set(pixels); im.pack()
env=w.node_tree.nodes.new('ShaderNodeTexEnvironment'); env.image=im
w.node_tree.links.new(env.outputs['Color'],w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blend/shared-scene.blend'))
# Group file uses a linked collection and linked world.
bpy.data.collections.remove(rig)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blend/group-a.blend'))
with bpy.data.libraries.load(str(ROOT/'blend/shared-scene.blend'),link=True) as (src,dst):
 dst.collections=['DeepLife shared studio']; dst.worlds=['Low-strength neutral studio HDRI']
scene.collection.children.link(dst.collections[0]); scene.world=dst.worlds[0]
scene.camera=next(o for o in dst.collections[0].objects if o.type=='CAMERA')
cam=scene.camera

def mat(name,h,metal=False):
 rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 rgb=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
 p.inputs['Metallic'].default_value=1 if metal else 0; p.inputs['Roughness'].default_value=.22 if metal else .30
 p.inputs['Coat Weight'].default_value=1; p.inputs['Coat Roughness'].default_value=.08
 if not metal: p.inputs['Subsurface Weight'].default_value=.035
 return m
red=mat('Flame coral F0442E','F0442E'); orange=mat('Flame orange FF8A1F','FF8A1F'); yellow=mat('Flame core FFD45C','FFD45C')
gold=mat('Polished toy gold F5B731','F5B731',True)
indigo=mat('Gem indigo 6366F1','6366F1'); violet=mat('Gem violet 8B5CF6','8B5CF6'); blue=mat('Gem highlight 62B4FF','62B4FF')
groups={}
def mesh(name,verts,faces,material,col,smooth=True):
 me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
 bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
 o=bpy.data.objects.new(name,me); col.objects.link(o); o.data.materials.append(material)
 for p in me.polygons: p.use_smooth=smooth
 return o
def bevel(o,width=.06,segments=3):
 mod=o.modifiers.new('Generous polished bevel','BEVEL'); mod.width=width; mod.segments=segments
 mod=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
def flame_layer(name,outline,depth,y,material,col):
 # Inflated closed outline, subdivision gives a smooth toy-like front and back.
 n=len(outline); verts=[]
 for scale,dy in [(0.08,-depth),(0.65,-depth*.88),(1,0),(.65,depth*.88),(.08,depth)]:
  for x,z in outline: verts.append((x*scale,y+dy,z*scale))
 faces=[]
 for r in range(4):
  for i in range(n): faces.append((r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i))
 faces.extend([tuple(range(n-1,-1,-1)),tuple(4*n+i for i in range(n))])
 o=mesh(name,verts,faces,material,col)
 sub=o.modifiers.new('Soft inflated surface','SUBSURF'); sub.levels=2
 return o
c=bpy.data.collections.new('flame'); scene.collection.children.link(c); groups['flame']=c
outline=[(0,-1.35),(-.65,-1.25),(-1,-.8),(-1.03,-.2),(-.82,.45),(-.66,.12),(-.42,.5),(-.25,1.05),(-.43,1.6),(.1,1.3),(.44,.8),(.4,.45),(.72,.75),(.92,.22),(1,-.4),(.8,-1),(.4,-1.3)]
flame_layer('Coral outer flame',outline,.48,0,red,c)
flame_layer('Orange middle flame',[(x*.72,z*.72-.22) for x,z in outline],.28,-.43,orange,c)
core=[(0,-1.04),(-.36,-.92),(-.47,-.56),(-.34,-.2),(-.04,.43),(.13,.16),(.14,-.1),(.38,-.42),(.4,-.72),(.22,-.97)]
flame_layer('Warm yellow core',core,.18,-.69,yellow,c)
c=bpy.data.collections.new('gem-stack'); scene.collection.children.link(c); groups['gem-stack']=c
for name,loc,s,material in [('Left violet gem',(-.68,.24,.08),.77,violet),('Right blue violet gem',(.73,.32,.24),.7,indigo),('Front indigo gem',(0,-.4,-.28),1,indigo)]:
 verts=[]; N=8
 for radius,z in [(.43,.67),(.86,.27),(.81,.15),(.08,-.77)]:
  for i in range(N):
   a=2*math.pi*i/N+math.pi/8; verts.append((s*radius*math.cos(a)+loc[0],s*radius*math.sin(a)+loc[1],s*z+loc[2]))
 faces=[tuple(range(N))]
 for j in range(3):
  for i in range(N): faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 faces.append(tuple(range(4*N-1,3*N-1,-1)))
 o=mesh(name,verts,faces,material,c,False); bevel(o,.045,3)
c=bpy.data.collections.new('trophy'); scene.collection.children.link(c); groups['trophy']=c
# Lathed hollow cup including substantial rounded lip.
profile=[(.02,-.28),(.28,-.24),(.53,-.1),(.73,.18),(.86,.60),(.87,.82),(.84,.88),(.75,.88),(.73,.81),(.72,.61),(.61,.25),(.40,.03),(.02,-.02)]
verts=[]; N=64
for radius,z in profile:
 for i in range(N):
  a=2*math.pi*i/N; verts.append((radius*math.cos(a),radius*math.sin(a),z+.35))
faces=[]
for j in range(len(profile)-1):
 for i in range(N): faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
o=mesh('Hollow rounded trophy cup',verts,faces,gold,c); sub=o.modifiers.new('Rounded cup','SUBSURF'); sub.levels=2
for side in (-1,1):
 curve=bpy.data.curves.new('Rounded handle','CURVE'); curve.dimensions='3D'; curve.bevel_depth=.115; curve.bevel_resolution=4; curve.resolution_u=24
 sp=curve.splines.new('BEZIER'); sp.bezier_points.add(4)
 for b,(x,z) in zip(sp.bezier_points,[(.77,1.04),(1.22,1.05),(1.27,.63),(1.03,.32),(.64,.35)]):
  b.co=(side*x,0,z); b.handle_left_type=b.handle_right_type='AUTO'
 o=bpy.data.objects.new(('Left' if side<0 else 'Right')+' rounded handle',curve); c.objects.link(o); curve.materials.append(gold)
for name,radius,depth,z in [('Stem',.2,.67,-.19),('Upper round plinth',.53,.17,-.56),('Lower round plinth',.69,.22,-.76)]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=(0,0,z)); o=bpy.context.object; o.name=name; move_to(o,c); o.data.materials.append(gold); bevel(o,.075,4)
 for p in o.data.polygons: p.use_smooth=True
rows=[]; stats={}
for name,c in groups.items():
 for other in groups.values(): other.hide_render=other!=c
 # Apply modifiers; center and scale geometry while retaining identical camera.
 bpy.ops.object.select_all(action='DESELECT')
 for o in list(c.objects):
  o.select_set(True); bpy.context.view_layer.objects.active=o
  bpy.ops.object.convert(target='MESH'); o.select_set(False)
 objects=list(c.objects)
 for repeat in range(3):
  pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
  lo=Vector(tuple(min(p[i] for p in pts) for i in range(3))); hi=Vector(tuple(max(p[i] for p in pts) for i in range(3))); center=(lo+hi)/2
  for o in objects: o.location-=center
  bpy.context.view_layer.update()
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  span=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts)); factor=.75/span
  for o in objects: o.location*=factor; o.scale*=factor
  bpy.context.view_layer.update()
 for repeat in range(3):
  pts=[world_to_camera_view(scene,cam,o.matrix_world@v.co) for o in objects for v in o.data.vertices]
  cx=(min(p.x for p in pts)+max(p.x for p in pts))/2; cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
  width=2*cam.location.length*math.tan(cam.data.angle_x/2)
  delta=cam.matrix_world.to_quaternion()@Vector(((.5-cx)*width,(.5-cy)*width,0))
  for o in objects: o.location+=delta
  bpy.context.view_layer.update()
 for o in objects:
  o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS'); o.select_set(False)
 tris=0
 for o in objects: o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
 stats[name]={'triangles':tris,'objects':{o.name:len(o.data.loop_triangles) for o in objects}}
 for o in objects: o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'icons'/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
 bpy.ops.object.select_all(action='DESELECT')
 scene.render.filepath=str(ROOT/'icons'/f'{name}.png'); bpy.ops.render.render(write_still=True)
 rows.append(['A',f'icons/{name}.png',1024,1024,tris,{'flame':'#F0442E #FF8A1F #FFD45C','gem-stack':'#6366F1 #8B5CF6','trophy':'#F5B731'}[name],'Review Gate 1; original local Blender/Cycles geometry'])
for c in groups.values(): c.hide_render=c.name!='flame'
bpy.ops.file.make_paths_relative()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blend/group-a.blend'),relative_remap=True)
with open(ROOT/'manifest.csv','w',newline='') as f:
 writer=csv.writer(f); writer.writerow(['group','file','width','height','triangles','main_hex_colors','notes']); writer.writerows(rows)
(ROOT/'source/geometry-checks.json').write_text(json.dumps(stats,indent=2))
print('GATE1_RENDER_COMPLETE')



