from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,struct
R=Path(__file__).resolve().parents[1];P=R/'proposals/grounded-entry';names=['hero-start','hero-grow','hero-legacy'];checks={}
font=lambda s,b=False:ImageFont.truetype('C:/Windows/Fonts/'+('seguisb.ttf' if b else 'segoeui.ttf'),s)
def sourcepath(name):return (R/'proposals/grounded-work' if name=='hero-grow' else P)/(name+'.png')
for name in names:
 im=Image.open(sourcepath(name));assert im.mode=='RGBA' and im.size==(1600,1200)
 bb=im.getchannel('A').getbbox();assert bb[1]>=180 and bb[3]<=840
 checks[name]={'bbox':bb,'empty_top':bb[1],'empty_bottom':1200-bb[3]}
 raw=sourcepath(name).with_suffix('.glb').read_bytes();magic,version,total=struct.unpack_from('<III',raw);length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);assert magic==0x46546c67 and version==2 and total==len(raw);assert not any('uri' in x for k in ['images','buffers'] for x in g.get(k,[]))
headlines=[['Your life.','Your beginning.'],['Work, earn,','level up'],['Leave it all','to your heir']]
subtitles=[['Build your story,','one week at a time.'],['Find your first job.','Make your next move.'],['Build a life worth','passing on.']]
phones=[]
for i,name in enumerate(names):
 phone=Image.new('RGBA',(390,844),'#071321');d=ImageDraw.Draw(phone)
 d.text((26,26),'9:41',font=font(14,True),fill='#F2EEE6');d.rounded_rectangle((154,15,236,37),radius=11,fill='#020810')
 d.text((195,103),'DEEP LIFE',font=font(13,True),fill='#8FA9C5',anchor='mm')
 for j,line in enumerate(headlines[i]):d.text((195,151+j*36),line,font=font(29,True),fill='#F2EEE6',anchor='mm')
 # Full source canvas is aspect-correct; only transparent side margins extend
 # beyond the screen. Subject bounds are checked separately below.
 source=Image.open(sourcepath(name));art=source.resize((480,360),Image.Resampling.LANCZOS);phone.alpha_composite(art,(-45,245))
 bb=source.getchannel('A').getbbox();screen_bb=[bb[0]*.3-45,bb[1]*.3+245,bb[2]*.3-45,bb[3]*.3+245];assert screen_bb[0]>=16 and screen_bb[2]<=374,(name,screen_bb);assert screen_bb[1]>215 and screen_bb[3]<570
 checks[name]['phone_art_bbox']=screen_bb
 for j,line in enumerate(subtitles[i]):d.text((195,592+j*24),line,font=font(17),fill='#AFC1D3',anchor='mm')
 for j in range(3):d.ellipse((178+j*14,673,184+j*14,679),fill='#168BFF' if j==i else '#293D43')
 d.rounded_rectangle((24,722,366,780),radius=29,fill='#F2EEE6');d.text((195,750),'Keep going',font=font(18,True),fill='#071321',anchor='mm')
 d.rounded_rectangle((128,825,262,830),radius=3,fill='#F2EEE6')
 phone.convert('RGB').save(P/f'{name}-phone.png');phones.append(phone)
strip=Image.new('RGB',(1218,868),'#102235')
for i,phone in enumerate(phones):strip.paste(phone.convert('RGB'),(12+i*402,12))
strip.save(P/'phone-review.png')

sheet=Image.new('RGB',(1200,640),'#102235')
for i,name in enumerate(names):
 for j,bg in enumerate(['#071321','#F8FAFC']):
  panel=Image.new('RGBA',(390,292),bg);panel.alpha_composite(Image.open(sourcepath(name)).resize((390,292),Image.Resampling.LANCZOS));sheet.paste(panel,(i*400+5,j*320+10))
sheet.save(P/'navy-light-review.png');(P/'checks.json').write_text(json.dumps(checks,indent=2));print(checks);print('ENTRY_HERO_CHECKS_PASS')
