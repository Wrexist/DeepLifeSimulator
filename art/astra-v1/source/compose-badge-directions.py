from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1]
font=lambda s,w='regular':ImageFont.truetype('C:/Windows/Fonts/'+('seguisb.ttf' if w=='semibold' else 'segoeui.ttf'),s)
canvas=Image.new('RGB',(1240,740),'#071321');d=ImageDraw.Draw(canvas)
for x in [20,640]:d.rounded_rectangle((x,20,x+580,720),radius=28,fill='#0D1D2D',outline='#24374A',width=1)
d.text((310,55),'A · Front-facing',font=font(22),fill='#B5C7D9',anchor='mm');d.text((930,55),'B · Number below',font=font(22),fill='#B5C7D9',anchor='mm')
front=Image.open(R/'previews/gate3-concept-front-blank.png').resize((560,560),Image.Resampling.LANCZOS);canvas.paste(front,(30,95),front)
d.text((310,315),'LEVEL',font=font(17,'semibold'),fill='#8FA9C5',anchor='mm')
d.text((310,381),'100',font=font(100,'semibold'),fill='#F2EEE6',anchor='mm')
original=Image.alpha_composite(Image.open(R/'badges/laurel.png'),Image.open(R/'badges/badge-platinum.png')).resize((350,350),Image.Resampling.LANCZOS);canvas.paste(original,(755,110),original)
d.text((930,471),'LEVEL',font=font(17,'semibold'),fill='#8FA9C5',anchor='mm')
d.text((930,545),'100',font=font(112,'semibold'),fill='#F2EEE6',anchor='mm')
canvas.save(R/'previews/gate3-two-directions.png')
canvas.crop((20,20,600,720)).save(R/'previews/gate3-direction-a.png');canvas.crop((640,20,1220,720)).save(R/'previews/gate3-direction-b.png')
print('TWO_DIRECTIONS_PREVIEW_PASS')
