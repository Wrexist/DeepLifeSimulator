from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from scipy.ndimage import label
import numpy as np,json,struct,hashlib,csv
R=Path(__file__).resolve().parents[1]
tiers=['flame-1','flame-2','flame-3','trophy-bronze','trophy-silver','trophy-gold']
badges=['badge-bronze','badge-silver','badge-gold','badge-platinum','laurel']
geo=json.loads((R/'source/gate3-geometry-checks.json').read_text()); checks={}
for folder,names in [('tiers',tiers),('badges',badges)]:
 for name in names:
  im=Image.open(R/folder/f'{name}.png');assert im.mode=='RGBA' and im.size==(1024,1024)
  a=np.array(im.getchannel('A'));bb=im.getchannel('A').getbbox();coverage=max(bb[2]-bb[0],bb[3]-bb[1])/1024
  low,high=(.42,.48) if name=='flame-1' else (.72,.79)
  assert low<=coverage<=high,(name,coverage)
  center_error=max(abs((bb[0]+bb[2])/2-512),abs((bb[1]+bb[3])/2-512));assert center_error<4,(name,center_error)
  components,n=label(a>0);counts=sorted(np.bincount(components.ravel())[1:].tolist(),reverse=True)
  expected=4 if name=='flame-3' else 2 if name=='laurel' else 1
  assert len(counts)==expected,(name,counts)
  assert not np.any(a[0,:]) and not np.any(a[-1,:]) and not np.any(a[:,0]) and not np.any(a[:,-1])
  raw=(R/folder/f'{name}.glb').read_bytes();magic,version,total=struct.unpack_from('<III',raw);size,kind=struct.unpack_from('<II',raw,12);g=json.loads(raw[20:20+size])
  assert magic==0x46546c67 and version==2 and total==len(raw)
  assert not [v['uri'] for k in ['images','buffers'] for v in g.get(k,[]) if 'uri' in v]
  triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']);assert triangles==geo[name]['triangles']
  assert max(geo[name]['objects'].values())<40000
  checks[name]={'coverage':coverage,'center_error_px':center_error,'alpha_bbox':bb,'alpha_component_sizes':counts,'triangles':triangles,'embedded_glb':True}
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20);small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
for folder,names in [('tiers',tiers),('badges',badges)]:
 for bg,theme in [('#071321','navy'),('#F8FAFC','light')]:
  canvas=Image.new('RGB',(960,760),bg);d=ImageDraw.Draw(canvas);ink='#F2EEE6' if theme=='navy' else '#293D43'
  d.text((24,18),'DEEPLIFE GLOSSY / '+folder.upper()+' / GATE 3',font=font,fill=ink)
  d.text((24,50),'160px + 48px / '+bg,font=small,fill=ink)
  for idx,name in enumerate(names):
   x=idx%3*320;y=90+idx//3*330
   im=Image.open(R/folder/f'{name}.png')
   for size,yy in [(160,y),(48,y+185)]:
    thumb=im.resize((size,size),Image.Resampling.LANCZOS);canvas.paste(thumb,(x+(320-size)//2,yy),thumb)
   d.text((x+160,y+250),name,font=small,fill=ink,anchor='mt')
  canvas.save(R/'previews'/f'gate3-{folder}-{theme}.png')
# Selected front-facing geometry with UI text drawn only into review images.
layout=json.loads((R/'source/front-badge-layout.json').read_text())
def badge_preview(name,size,with_laurel=False):
 im=Image.open(R/'badges'/f'{name}.png').convert('RGBA')
 if with_laurel:im=Image.alpha_composite(Image.open(R/'badges/laurel.png'),im)
 im=im.resize((size,size),Image.Resampling.LANCZOS);draw=ImageDraw.Draw(im)
 tokens=layout[name]
 if size>=96:
  draw.text((tokens['label_anchor'][0]*size,tokens['label_anchor'][1]*size),'LEVEL',font=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',round(size*.0304)),fill='#8FA9C5',anchor='mm')
 draw.text((tokens['number_anchor'][0]*size,tokens['number_anchor'][1]*size),'100',font=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',round(size*.1786)),fill='#F2EEE6',anchor='mm')
 return im
preview=Image.new('RGB',(1100,650),'#102235');d=ImageDraw.Draw(preview)
d.text((30,20),'FRONT-FACING / CLEAN CENTERED TYPE',font=font,fill='white')
for i,bg in enumerate(['#071321','#F8FAFC']):
 panel=Image.new('RGBA',(520,550),bg);panel.alpha_composite(badge_preview('badge-platinum',500,True),(10,10));preview.paste(panel.convert('RGB'),(20+i*540,70))
preview.save(R/'previews/gate3-platinum-laurel-100.png')
single=Image.new('RGBA',(768,768),'#071321');single.alpha_composite(badge_preview('badge-platinum',768,True));single.convert('RGB').save(R/'previews/gate3-front-facing-level-100.png')
for theme,bg,ink in [('navy','#071321','#F2EEE6'),('light','#F8FAFC','#293D43')]:
 gallery=Image.new('RGBA',(840,960),bg);d=ImageDraw.Draw(gallery);d.text((28,20),'FRONT-FACING BADGE FAMILY',font=font,fill=ink)
 for i,name in enumerate(badges[:4]):
  x=30+(i%2)*420;y=65+(i//2)*435
  gallery.alpha_composite(badge_preview(name,360),(x,y));d.text((x+180,y+370),name.removeprefix('badge-').capitalize(),font=small,fill=ink,anchor='mm')
 gallery.convert('RGB').save(R/'previews'/f'gate3-front-facing-badges-{theme}.png')
for new,old in [('flame-2','flame'),('trophy-gold','trophy')]:
 for ext in ['png','glb']:assert (R/'tiers'/f'{new}.{ext}').read_bytes()==(R/'icons'/f'{old}.{ext}').read_bytes()
(R/'source/gate3-file-checks.json').write_text(json.dumps(checks,indent=2))
files={str(p.relative_to(R)).replace('\\','/'):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in R.rglob('*') if p.is_file() and p.suffix in ['.png','.glb','.blend']}
(R/'manifest.json').write_text(json.dumps({'status':'review-gate-3-unapproved','gate1':'approved','gate2':'approved','generator':'Local Blender 5.2.1 Cycles; Codex-authored original geometry','date':'2026-10-05','files':files},indent=2))
print(json.dumps(checks,indent=2));print('GATE3_FILE_CHECKS_PASS')




