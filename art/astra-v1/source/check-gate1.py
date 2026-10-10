from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, struct, hashlib, numpy as np
from scipy.ndimage import label
root=Path(__file__).resolve().parents[1]
names=['flame','gem-stack','trophy']
canvas=Image.new('RGB',(1080,800),'#102235'); d=ImageDraw.Draw(canvas)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
d.text((32,20),'DEEPLIFE GLOSSY / STYLE FRAME / REVIEW GATE 1',font=font,fill='white')
checks={}
for row,bg in enumerate(['#071321','#F8FAFC']):
 y=68+row*358; d.rectangle((16,y,1064,y+342),fill=bg)
 ink='white' if row==0 else '#293D43'
 d.text((32,y+12),bg+'  /  160 px + 48 px',font=small,fill=ink)
 for i,name in enumerate(names):
  im=Image.open(root/'icons'/f'{name}.png').convert('RGBA')
  x=80+i*340
  canvas.paste(im.resize((160,160),Image.Resampling.LANCZOS),(x,y+53),im.resize((160,160),Image.Resampling.LANCZOS))
  mini=im.resize((48,48),Image.Resampling.LANCZOS); canvas.paste(mini,(x+56,y+236),mini)
  d.text((x+20,y+302),name,font=small,fill=ink)
  alpha=im.getchannel('A'); bbox=alpha.getbbox()
  labels,count=label(np.asarray(alpha)>0); components=sorted(np.bincount(labels.ravel())[1:].tolist(),reverse=True)
  data=(root/'icons'/f'{name}.glb').read_bytes(); magic,version,length=struct.unpack_from('<III',data)
  size,kind=struct.unpack_from('<II',data,12); gltf=json.loads(data[20:20+size])
  checks[name]={'alpha_component_sizes':components,'rgba':im.mode,'size':list(im.size),'alpha_bbox':bbox,'frame_coverage':max(bbox[2]-bbox[0],bbox[3]-bbox[1])/1024,'corner_alpha':alpha.getpixel((0,0)),'glb_version':version,'glb_length_valid':length==len(data),'external_uris':[v['uri'] for k in ('buffers','images') for v in gltf.get(k,[]) if 'uri' in v]}
canvas.save(root/'previews/gate1-contact-sheet.png')
(root/'source/file-checks.json').write_text(json.dumps(checks,indent=2))
hashes={str(p.relative_to(root)).replace('\\','/'):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in root.rglob('*') if p.is_file() and p.suffix in ('.png','.glb','.blend')}
(root/'manifest.json').write_text(json.dumps({'status':'review-gate-1-unapproved','generator':'Local Blender 5.2.1 Cycles; Codex-authored original geometry','date':'2026-10-05','files':hashes},indent=2))
print(json.dumps(checks,indent=2))

