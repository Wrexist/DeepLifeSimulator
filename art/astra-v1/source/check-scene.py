import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'blend/group-a.blend'))
bpy.ops.file.make_paths_relative()
s=bpy.context.scene
checks={'engine':s.render.engine,'camera_lens':s.camera.data.lens,'transparent':s.render.film_transparent,'libraries':[l.filepath for l in bpy.data.libraries],'unit_scales':all(tuple(o.scale)==(1,1,1) for o in s.objects if o.type=='MESH'),'camera_linked':bool(s.camera.library),'world_linked':bool(s.world.library)}
(root/'source/scene-checks.json').write_text(json.dumps(checks,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(root/'blend/group-a.blend'))
print(json.dumps(checks))
