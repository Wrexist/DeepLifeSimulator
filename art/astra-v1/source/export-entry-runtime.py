"""Package original studio renders as runtime WebP and a navy/light review."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, struct
root=Path(__file__).resolve().parents[3]
source=root/'art/astra-v1/entry-modern'
target=root/'assets/images/scenes'
files=sorted(source.glob('*.png'))
sheet=Image.new('RGB',(1200,((len(files)+2)//3)*340),'#102235')
draw=ImageDraw.Draw(sheet)
manifest={'generator':'Blender 5.2 Cycles; original geometry; shared grounded-work studio','license':'Original project artwork, no third-party assets','assets':{}}
for index,path in enumerate(files):
    im=Image.open(path).convert('RGBA'); assert im.size==(1024,768)
    box=im.getchannel('A').getbbox(); assert box and box[0]>0 and box[1]>0 and box[2]<1024 and box[3]<768
    raw=(source/(path.stem+'.glb')).read_bytes(); magic,version,length=struct.unpack_from('<III',raw);assert magic==0x46546c67 and version==2 and length==len(raw)
    size,kind=struct.unpack_from('<II',raw,12);gltf=json.loads(raw[20:20+size]);assert all('uri' not in b for b in gltf['buffers'])
    im.resize((640,480),Image.Resampling.LANCZOS).save(target/(path.stem+'.webp'),quality=88,method=6)
    x=(index%3)*400;y=(index//3)*340
    for j,bg in enumerate(['#071321','#F8FAFC']):
        tile=Image.new('RGBA',(192,280),bg);thumb=im.copy();thumb.thumbnail((190,245));tile.alpha_composite(thumb,((192-thumb.width)//2,(280-thumb.height)//2));sheet.paste(tile.convert('RGB'),(x+j*200,y))
    draw.text((x+12,y+290),path.stem,fill='#FAF3DF')
    out=target/(path.stem+'.webp')
    manifest['assets'][path.stem]={'pngSize':list(im.size),'alphaBounds':box,'embeddedGlb':True,'runtimeBytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
sheet.save(source/'review.png')
(source/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('Validated and exported',len(files),'props;',sum(a['runtimeBytes'] for a in manifest['assets'].values()),'runtime bytes')
