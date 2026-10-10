import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];checks={}
for group in ['b','c']:
 bpy.ops.wm.open_mainfile(filepath=str(R/f'blend/group-{group}.blend'))
 s=bpy.context.scene
 result={'cycles':s.render.engine=='CYCLES','camera_lens':s.camera.data.lens,'camera_linked':bool(s.camera.library),'world_linked':bool(s.world.library),'relative_library_paths':[l.filepath for l in bpy.data.libraries],'unit_scales':all(all(abs(v-1)<1e-6 for v in o.scale) for o in s.objects if o.type=='MESH'),'no_text_objects':not any(o.type=='FONT' for o in s.objects),'render_size':[s.render.resolution_x,s.render.resolution_y],'transparent':s.render.film_transparent,'collections':[c.name for c in s.collection.children if not c.library]}
 assert result['cycles'] and result['camera_linked'] and result['world_linked'] and result['unit_scales'] and result['no_text_objects']
 if group=='c':
  result['face_width_ratios']={}
  for name in ['badge-bronze','badge-silver','badge-gold','badge-platinum']:
   c=bpy.data.collections[name];face=next(o for o in c.objects if o.name.startswith('Empty smooth face'));back=next(o for o in c.objects if o.name.startswith('Rounded pentagon backing'))
   result['face_width_ratios'][name]=face.dimensions.x/back.dimensions.x
  assert all(.77<r<.84 for r in result['face_width_ratios'].values())
 checks[group]=result
(R/'source/gate3-scene-checks.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks));print('GATE3_SCENE_CHECKS_PASS')

