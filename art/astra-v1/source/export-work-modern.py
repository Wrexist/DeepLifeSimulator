from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
root=Path(__file__).resolve().parents[3]
p=root/'art/astra-v1/work-modern';out=root/'assets/images/scenes'
sheet=Image.new('RGB',(900,430),'#102235');d=ImageDraw.Draw(sheet);records={}
for i,name in enumerate(['work-food-modern','work-office-modern','work-study-modern']):
 im=Image.open(p/(name+'.png'));assert im.mode=='RGBA' and im.size==(1024,768)
 bb=im.getchannel('A').getbbox();assert bb[0]>0 and bb[1]>0 and bb[2]<1024 and bb[3]<768
 dst=out/(name+'.webp');im.resize((512,384),Image.Resampling.LANCZOS).save(dst,'WEBP',quality=90,method=6)
 for y,size,bg in [(30,(280,210),'#071321'),(265,(72,54),'#102235'),(335,(72,54),'#F8FAFC')]:
  panel=Image.new('RGBA',size,bg);panel.alpha_composite(im.resize(size,Image.Resampling.LANCZOS));sheet.paste(panel,(i*300+(300-size[0])//2,y))
 d.text((i*300+35,8),name,fill='white')
 records[name]={'runtime_bytes':dst.stat().st_size,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'bbox':bb}
sheet.save(p/'review.png');(p/'runtime-manifest.json').write_text(json.dumps(records,indent=2));print('WORK_EXPORT_PASS',sum(v['runtime_bytes'] for v in records.values()))
