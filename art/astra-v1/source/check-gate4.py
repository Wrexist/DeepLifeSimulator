from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from scipy.ndimage import label
import numpy as np,json,struct,hashlib
R=Path(__file__).resolve().parents[1];names=['hero-start','hero-grow','hero-legacy'];geo=json.loads((R/'source/gate4-geometry-checks.json').read_text());checks={}
font=lambda s,b=False:ImageFont.truetype('C:/Windows/Fonts/'+('seguisb.ttf' if b else 'segoeui.ttf'),s)
for name in names:
 im=Image.open(R/'heroes'/f'{name}.png');assert im.mode=='RGBA' and im.size==(1600,1200)
 a=np.array(im.getchannel('A'));bb=im.getchannel('A').getbbox();assert not np.any(a[:180,:]);assert not np.any(a[840:,:]);assert not np.any(a[:,0]) and not np.any(a[:,-1])
 components,num=label(a>0);counts=sorted(np.bincount(components.ravel())[1:].tolist(),reverse=True)
 assert len(counts)==(2 if name=='hero-start' else 1),(name,counts)
 raw=(R/'heroes'/f'{name}.glb').read_bytes();magic,version,total=struct.unpack_from('<III',raw);size,kind=struct.unpack_from('<II',raw,12);g=json.loads(raw[20:20+size]);assert magic==0x46546c67 and version==2 and total==len(raw)
 assert not [v['uri'] for k in ['images','buffers'] for v in g.get(k,[]) if 'uri' in v]
 triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']);assert triangles==geo[name]['triangles'];assert max(geo[name]['objects'].values())<40000
 checks[name]={'size':list(im.size),'alpha_bbox':bb,'empty_top_rows':bb[1],'empty_bottom_rows':1200-bb[3],'required_top_rows':180,'required_bottom_rows':360,'alpha_component_sizes':counts,'triangles':triangles,'max_object_triangles':max(geo[name]['objects'].values()),'embedded_glb':True}
# Navy/light review of the original full canvas, with reserved bands indicated.
sheet=Image.new('RGB',(1500,910),'#102235');draw=ImageDraw.Draw(sheet);draw.text((24,14),'DEEPLIFE / ONBOARDING HEROES / GATE 4',font=font(23,True),fill='white')
for row,bg in enumerate(['#071321','#F8FAFC']):
 for col,name in enumerate(names):
  x=col*500+10;y=row*430+55;panel=Image.new('RGBA',(480,360),bg);thumb=Image.open(R/'heroes'/f'{name}.png').resize((480,360),Image.Resampling.LANCZOS);panel.alpha_composite(thumb)
  d=ImageDraw.Draw(panel);ink='#8FA9C5' if row==0 else '#607184';d.line((0,54,480,54),fill=ink,width=1);d.line((0,252,480,252),fill=ink,width=1)
  d.text((10,10),'15% empty',font=font(13),fill=ink);d.text((10,333),'30% empty',font=font(13),fill=ink)
  sheet.paste(panel.convert('RGB'),(x,y));draw.text((x+240,y+375),name,font=font(18),fill='white',anchor='mm')
sheet.save(R/'previews/gate4-hero-contact-sheet.png')
headlines=[['Every life','starts at $0'],['Work, earn,','level up'],['Leave it all','to your heir']]
subtitles=[['Build your story,','one week at a time.'],['Find your first job.','Make your next move.'],['Build a life worth','passing on.']]
phones=[]
for i,name in enumerate(names):
 phone=Image.new('RGBA',(390,844),'#071321');d=ImageDraw.Draw(phone)
 d.text((26,26),'9:41',font=font(14,True),fill='#F2EEE6');d.rounded_rectangle((154,15,236,37),radius=11,fill='#020810')
 d.text((195,103),'DEEP LIFE',font=font(13,True),fill='#8FA9C5',anchor='mm')
 for j,line in enumerate(headlines[i]):d.text((195,151+j*36),line,font=font(29,True),fill='#F2EEE6',anchor='mm')
 # Full source canvas is aspect-correct; only transparent side margins extend
 # beyond the screen. Subject bounds are checked separately below.
 source=Image.open(R/'heroes'/f'{name}.png');art=source.resize((480,360),Image.Resampling.LANCZOS);phone.alpha_composite(art,(-45,245))
 bb=source.getchannel('A').getbbox();screen_bb=[bb[0]*.3-45,bb[1]*.3+245,bb[2]*.3-45,bb[3]*.3+245];assert screen_bb[0]>=16 and screen_bb[2]<=374,(name,screen_bb);assert screen_bb[1]>215 and screen_bb[3]<570
 checks[name]['phone_art_bbox']=screen_bb
 for j,line in enumerate(subtitles[i]):d.text((195,592+j*24),line,font=font(17),fill='#AFC1D3',anchor='mm')
 for j in range(3):d.ellipse((178+j*14,673,184+j*14,679),fill='#168BFF' if j==i else '#293D43')
 d.rounded_rectangle((24,722,366,780),radius=29,fill='#F2EEE6');d.text((195,750),'Keep going',font=font(18,True),fill='#071321',anchor='mm')
 d.rounded_rectangle((128,825,262,830),radius=3,fill='#F2EEE6')
 phone.convert('RGB').save(R/'previews'/f'gate4-{name}-phone.png');phones.append(phone)
strip=Image.new('RGB',(1218,868),'#102235')
for i,phone in enumerate(phones):strip.paste(phone.convert('RGB'),(12+i*402,12))
strip.save(R/'previews/gate4-phone-previews.png')
(R/'source/gate4-file-checks.json').write_text(json.dumps(checks,indent=2))
files={str(p.relative_to(R)).replace('\\','/'):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in R.rglob('*') if p.is_file() and p.suffix in ['.png','.glb','.blend']}
(R/'manifest.json').write_text(json.dumps({'status':'review-gate-4-unapproved','gate1':'approved','gate2':'approved','gate3':'approved including matching skinny metal numeral previews','generator':'Local Blender 5.2.1 Cycles; Codex-authored original geometry','date':'2026-10-05','files':files},indent=2))
print(json.dumps(checks,indent=2));print('GATE4_FILE_CHECKS_PASS')

