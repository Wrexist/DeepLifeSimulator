import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'blend/group-d.blend'));s=bpy.context.scene
result={'cycles':s.render.engine=='CYCLES','camera_lens':s.camera.data.lens,'camera_linked':bool(s.camera.library),'world_linked':bool(s.world.library),'relative_library_paths':[l.filepath for l in bpy.data.libraries],'unit_scales':all(all(abs(v-1)<1e-6 for v in o.scale) for o in s.objects if o.type=='MESH'),'no_text_objects':not any(o.type=='FONT' for o in s.objects),'render_size':[s.render.resolution_x,s.render.resolution_y],'transparent':s.render.film_transparent,'collections':[c.name for c in s.collection.children if not c.library]}
assert result['cycles'] and result['camera_linked'] and result['world_linked'] and result['unit_scales'] and result['no_text_objects']
assert result['render_size']==[1600,1200] and result['transparent'] and len(result['collections'])==3
(R/'source/gate4-scene-checks.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));print('GATE4_SCENE_CHECKS_PASS')
