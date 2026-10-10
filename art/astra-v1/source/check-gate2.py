from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np
from scipy.ndimage import label
import json,struct,hashlib
R=Path(__file__).resolve().parents[1]
names=['flame','gem-stack','trophy','briefcase-up','money-bag','house-key','rings','rattle','crown','heart','grad-cap','storefront']
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',19)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
checks={};geo=json.loads((R/'source/geometry-checks.json').read_text())
for name in names:
 p=R/'icons'/f'{name}.png'; im=Image.open(p);assert im.mode=='RGBA' and im.size==(1024,1024)
 a=np.array(im.getchannel('A'));bbox=im.getchannel('A').getbbox(); components,num=label(a>0); counts=sorted(np.bincount(components.ravel())[1:].tolist(),reverse=True)
 coverage=max(bbox[2]-bbox[0],bbox[3]-bbox[1])/1024
 center_error=max(abs((bbox[0]+bbox[2])/2-512),abs((bbox[1]+bbox[3])/2-512))
 assert .72<=coverage<=.78,(name,coverage)
 assert center_error<=3,(name,center_error)
 assert not np.any(a[0,:]) and not np.any(a[-1,:]) and not np.any(a[:,0]) and not np.any(a[:,-1])
 raw=(R/'icons'/f'{name}.glb').read_bytes();magic,version,total=struct.unpack_from('<III',raw);size,kind=struct.unpack_from('<II',raw,12)
 assert magic==0x46546c67 and version==2 and total==len(raw) and kind==0x4e4f534a
 gltf=json.loads(raw[20:20+size]);uris=[v['uri'] for k in ('buffers','images') for v in gltf.get(k,[]) if 'uri' in v]; assert not uris
 triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']);assert triangles==geo[name]['triangles'],(name,triangles,geo[name])
 assert max(geo[name]['objects'].values())<40000
 checks[name]={'size':list(im.size),'mode':im.mode,'alpha_bbox':bbox,'coverage':coverage,'center_error_px':center_error,'alpha_component_sizes':counts,'triangles':triangles,'max_object_triangles':max(geo[name]['objects'].values()),'external_uris':uris,'glb_version':version}
canvases=[]
for bg,labelname in [('#071321','navy'),('#F8FAFC','light')]:
 canvas=Image.new('RGB',(1120,1050),bg);d=ImageDraw.Draw(canvas);ink='#F2EEE6' if labelname=='navy' else '#293D43'
 d.text((28,18),'DEEPLIFE GLOSSY / GROUP A / REVIEW GATE 2',font=font,fill=ink)
 d.text((28,48),'1024px masters shown at 160px + 48px • '+bg,font=small,fill=ink)
 for idx,name in enumerate(names):
  x=idx%4*280;y=90+idx//4*316
  im=Image.open(R/'icons'/f'{name}.png')
  for size,yy in [(160,y),(48,y+183)]:
   thumb=im.resize((size,size),Image.Resampling.LANCZOS);canvas.paste(thumb,(x+(280-size)//2,yy),thumb)
  d.text((x+140,y+250),name,font=small,fill=ink,anchor='mt')
 canvas.save(R/'previews'/f'group-a-{labelname}.png');canvases.append(canvas)
combined=Image.new('RGB',(2240,1050));combined.paste(canvases[0],(0,0));combined.paste(canvases[1],(1120,0));combined.save(R/'previews/group-a-contact-sheet.png')
(R/'source/gate2-file-checks.json').write_text(json.dumps(checks,indent=2))
files={str(p.relative_to(R)).replace('\\','/'):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in R.rglob('*') if p.is_file() and p.suffix in ('.png','.glb','.blend')}
(R/'manifest.json').write_text(json.dumps({'status':'review-gate-2-unapproved','gate1':'approved by owner 2026-10-05','generator':'Local Blender 5.2.1 Cycles; Codex-authored original geometry','date':'2026-10-05','files':files},indent=2))
print(json.dumps(checks,indent=2));print('GATE2_FILE_CHECKS_PASS')
