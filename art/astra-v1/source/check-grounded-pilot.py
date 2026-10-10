from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,struct
R=Path(__file__).resolve().parents[1];P=R/'proposals/grounded-work'
im=Image.open(P/'hero-grow.png');assert im.mode=='RGBA' and im.size==(1600,1200)
a=np.array(im.getchannel('A'));bb=im.getchannel('A').getbbox();assert not a[:180].any() and not a[840:].any()
raw=(P/'hero-grow.glb').read_bytes();magic,version,total=struct.unpack_from('<III',raw);size,kind=struct.unpack_from('<II',raw,12);g=json.loads(raw[20:20+size]);assert magic==0x46546c67 and version==2 and total==len(raw)
assert not [v['uri'] for k in ['images','buffers'] for v in g.get(k,[]) if 'uri' in v]
checks=json.loads((P/'checks.json').read_text());tri=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']);assert tri==checks['triangles']
checks.update({'size':list(im.size),'alpha_bbox':bb,'empty_top_rows':bb[1],'empty_bottom_rows':1200-bb[3],'embedded_glb':True})
font=lambda s,b=False:ImageFont.truetype('C:/Windows/Fonts/'+('seguisb.ttf' if b else 'segoeui.ttf'),s)
sheet=Image.new('RGB',(1200,520),'#102235');d=ImageDraw.Draw(sheet)
d.text((24,16),'GROUNDED WORK / MATERIAL STUDY',font=font(19,True),fill='#F2EEE6')
for i,bg in enumerate(['#071321','#F8FAFC']):
 panel=Image.new('RGBA',(580,435),bg);panel.alpha_composite(im.resize((580,435),Image.Resampling.LANCZOS));sheet.paste(panel.convert('RGB'),(10+i*600,55))
sheet.save(P/'navy-light-review.png')
phone=Image.new('RGBA',(390,844),'#071321');d=ImageDraw.Draw(phone)
d.text((26,26),'9:41',font=font(14,True),fill='#F2EEE6');d.rounded_rectangle((154,15,236,37),radius=11,fill='#020810')
d.text((195,103),'DEEP LIFE',font=font(13,True),fill='#8FA9C5',anchor='mm')
for j,line in enumerate(['Work, earn,','level up']):d.text((195,151+j*36),line,font=font(29,True),fill='#F2EEE6',anchor='mm')
phone.alpha_composite(im.resize((480,360),Image.Resampling.LANCZOS),(-45,245))
screen_bb=[bb[0]*.3-45,bb[1]*.3+245,bb[2]*.3-45,bb[3]*.3+245];assert screen_bb[0]>=16 and screen_bb[2]<=374 and screen_bb[1]>215 and screen_bb[3]<570
for j,line in enumerate(['Find your first job.','Make your next move.']):d.text((195,592+j*24),line,font=font(17),fill='#AFC1D3',anchor='mm')
for j in range(3):d.ellipse((178+j*14,673,184+j*14,679),fill='#168BFF' if j==1 else '#293D43')
d.rounded_rectangle((24,722,366,780),radius=29,fill='#F2EEE6');d.text((195,750),'Keep going',font=font(18,True),fill='#071321',anchor='mm');d.rounded_rectangle((128,825,262,830),radius=3,fill='#F2EEE6')
phone.convert('RGB').save(P/'phone-review.png');checks['phone_art_bbox']=screen_bb
(P/'checks.json').write_text(json.dumps(checks,indent=2))
print(json.dumps({k:v for k,v in checks.items() if k not in ['protected_hashes','objects']},indent=2));print('GROUNDED_PILOT_CHECKS_PASS')
