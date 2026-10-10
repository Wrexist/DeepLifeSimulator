from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
R=Path(__file__).resolve().parents[1]
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
for theme,bg,ink in [('navy','#071321','#F2EEE6'),('light','#F8FAFC','#293D43')]:
 canvas=Image.new('RGBA',(920,1060),bg);draw=ImageDraw.Draw(canvas);draw.text((32,20),'MATCHING METAL / SLIM NUMERALS',font=font,fill=ink)
 for i,tier in enumerate(['bronze','silver','gold','platinum']):
  im=Image.open(R/'previews'/f'gate3-metal-number-{tier}.png').convert('RGBA');assert im.size==(1024,1024)
  x=25+i%2*460;y=60+i//2*490;canvas.alpha_composite(im.resize((410,410),Image.Resampling.LANCZOS),(x,y))
  draw.text((x+205,y+430),tier.capitalize(),font=font,fill=ink,anchor='mm')
 canvas.convert('RGB').save(R/'previews'/f'gate3-matching-metal-{theme}.png')
for tier in ['gold','platinum']:
 badge=Image.open(R/'previews'/f'gate3-metal-number-{tier}.png');laurel=Image.open(R/'badges/laurel.png');combo=Image.alpha_composite(laurel,badge)
 single=Image.new('RGBA',(900,900),'#071321');single.alpha_composite(combo.resize((900,900),Image.Resampling.LANCZOS));single.convert('RGB').save(R/'previews'/f'gate3-matching-metal-{tier}-large.png')
p=R/'manifest.json';d=json.loads(p.read_text());d['status']='gate3-matching-metal-number-review';d['files'].update({str(f.relative_to(R)).replace('\\','/'):{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in (R/'previews').glob('*.png')});p.write_text(json.dumps(d,indent=2))
print('MATCHING_METAL_COMPOSITES_PASS')
