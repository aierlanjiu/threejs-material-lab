"""Describe native PNG components for runtime rigging; never rewrite PNG pixels."""
from pathlib import Path
import copy
import hashlib
import json
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, binary_dilation, binary_closing, binary_fill_holes

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/band-cast-v3/one-piece'
NAMES=['leftUpper','leftFore','leftHand','rightUpper','rightFore','rightHand']
HANDS={
 'zoro': [([.50,.48],[.72,.78]),([.45,.46],[.58,.85])],
 'nami': [([.34,.25],[.52,.75]),([.42,.24],[.50,.85])],
 'sanji': [([.40,.08],[.95,.94]),([.60,.06],[.05,.95])],
 'luffy': [([.50,.26],[.50,.70]),([.51,.25],[.50,.65])],
 'robin': [([.08,.88],[.72,.38]),([.93,.85],[.22,.35])],
 'usopp': [([.29,.18],[.67,.72]),([.35,.12],[.55,.73])],
 'ace': [([.40,.10],[.60,.80]),([.48,.16],[.50,.83])],
 'law': [([.38,.15],[.46,.86]),([.55,.15],[.50,.85])],
 'shanks': [([.33,.18],[.65,.67]),([.17,.09],[.62,.72])]
}
MATERIALS={
 'luffy':([.28,.36,.44,.38],[.28,.36,.44,.38],16,14),
 'zoro':([.24,.58,.48,.22],[.28,.38,.44,.30],22,18),
 'nami':([.16,.13,.68,.70],[.27,.38,.50,.43],18,13),
 'sanji':([.27,.40,.46,.36],[.23,.28,.54,.46],21,18),
 'robin':([.23,.29,.54,.49],[.27,.22,.46,.55],17,13),
 'usopp':([.28,.37,.44,.35],[.27,.24,.46,.34],17,14),
 'ace':([.28,.36,.44,.38],[.27,.25,.46,.42],18,15),
 'law':([.27,.46,.46,.30],[.27,.30,.46,.40],21,18),
 'shanks':([.23,.26,.54,.48],[.24,.24,.52,.49],23,19)
}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def runs(mask):
 result=[]
 for y,row in enumerate(mask):
  edges=np.flatnonzero(np.diff(np.r_[False,row,False].astype(int)))
  result.extend([[int(y),int(a),int(b-a)] for a,b in zip(edges[::2],edges[1::2])])
 return result
def measure(path,count):
 alpha=np.asarray(Image.open(path).convert('RGBA'))[:,:,3]
 assert alpha.min()==0 and alpha.max()>200,path
 labs,_=label(alpha>100);sizes=np.bincount(labs.ravel());boxes=find_objects(labs)
 items=[]
 for k in np.argsort(sizes[1:])[-count:]+1:
  assert sizes[k]>1000,(path,sizes[k]);ys,xs=boxes[k-1]
  x=max(0,xs.start-4);y=max(0,ys.start-4);r=min(alpha.shape[1],xs.stop+4);b=min(alpha.shape[0],ys.stop+4)
  owned=binary_dilation(labs==k,iterations=3)&(alpha>0)
  mask=owned[y:b,x:r];solid=labs[y:b,x:r]==k
  def end(f):
   sy=round((b-y-1)*f);lo=max(0,sy-5);hi=min(b-y,sy+6)
   yy,xx=np.where(solid[lo:hi]);return [float(xx.mean()/(r-x)) if len(xx) else .5,f]
  items.append({'rect':[x,y,r-x,b-y],'maskRuns':runs(mask),'a':end(.12),'b':end(.88),'image':str(path.relative_to(ROOT)),'sha256':sha(path),'center':[(xs.start+xs.stop)/2,(ys.start+ys.stop)/2]})
 if count==6:
  items.sort(key=lambda a:a['center'][1]);items=sorted(items[:3],key=lambda a:a['center'][0])+sorted(items[3:],key=lambda a:a['center'][0])
 return items
def face_depth_layer(head):
 x,y,w,h=head['rect'];pixels=np.asarray(Image.open(ROOT/head['image']))[y:y+h,x:x+w];r,g,b=[pixels[:,:,i].astype(float) for i in range(3)]
 skin=(r>140)&(g>80)&(b>50)&(r>g*1.08)&(g>b*1.08)&((r-g)<110)&(pixels[:,:,3]>100)
 roi=np.zeros_like(skin);roi[int(h*.20):int(h*.71),int(w*.27):int(w*.85)]=True;skin &=roi
 labs,_=label(skin);sizes=np.bincount(labs.ravel());sizes[0]=0;mask=labs==int(np.argmax(sizes));mask=binary_fill_holes(binary_closing(mask,iterations=3));mask=binary_dilation(mask,iterations=2)&(pixels[:,:,3]>0)
 assert mask.sum()>10000
 return {'image':head['image'],'rect':head['rect'],'maskRuns':runs(mask),'purpose':'original face in front of harp; hair remains behind'}
def main():
 original=json.loads((ROOT/'assets/band-cast-v2/one-piece/manifest.json').read_text());actors=[]
 for old in original['actors']:
  actor=copy.deepcopy(old);ident=actor['id']
  for layer in actor['layers'].values():layer['image']=f'assets/band-cast-v2/one-piece/{ident}.png'
  actor['rigParts']={};actor['anatomy']='character-left-is-viewer-right; fixed ownership, no mirroring';actor['bones']={'upper':66,'fore':64}
  if ident=='chopper':
   actor['bones']={'upper':55,'fore':55};actor['furSkin']=True
   for i,side in enumerate(['left','right']):
    piece=copy.deepcopy(actor['layers'][side+'Arm']);piece.update(a=[.20,.80] if i==0 else [.10,.88],contact=[.18,.12] if i==0 else [.60,.13],scale=.34)
    actor['rigParts'][side+'Hand']=piece
   actor['assetNote']='Retains original hoof/mallet art; textured fur bones. Two native-generation attempts were rejected; no new Chopper art claimed.'
  else:
   measured=measure(OUT/f'{ident}-arms.png',6);actor['rigParts']=dict(zip(NAMES,measured))
   uv_upper,uv_fore,r_upper,r_fore=MATERIALS[ident]
   for side in ['left','right']:
    actor['rigParts'][side+'Upper'].update(skinRect=uv_upper,radius=r_upper,taper=.84)
    actor['rigParts'][side+'Fore'].update(skinRect=uv_fore,radius=r_fore,taper=.72)
   pixels=np.asarray(Image.open(OUT/f'{ident}-arms.png'))
   for name in ['leftUpper','leftFore','rightUpper','rightFore']:
    part=actor['rigParts'][name];x,y,w,h=part['rect'];u,v,uw,uh=part['skinRect'];patch=pixels[y+int(v*h):y+int((v+uh)*h),x+int(u*w):x+int((u+uw)*w)]
    colors=patch[:,:,:3][patch[:,:,3]>200];assert len(colors)>20
    color=np.median(colors,axis=0).astype(int);part['baseColor']='#'+''.join(f'{c:02x}' for c in color)
   if ident=='nami':
    for name in ['leftFore','rightFore']:
     part=actor['rigParts'][name];part['a'],part['b']=part['b'],part['a']
   for i,side in enumerate(['left','right']):
    hand=actor['rigParts'][side+'Hand'];hand['a'],hand['contact']=HANDS[ident][i]
    dx=(hand['contact'][0]-hand['a'][0])*hand['rect'][2];dy=(hand['contact'][1]-hand['a'][1])*hand['rect'][3]
    hand['scale']=(.25 if ident=='sanji' else .24 if ident=='shanks' and i==1 else 29/max(1,float(np.hypot(dx,dy))))
   if ident=='shanks':actor['rigParts']['rightHand']['toolAxis']=[[.20,.47],[.98,.96]]
   if ident=='sanji':
    actor['rigParts']['leftHand'].update(toolGeometry='drumstick',grip=[.44,.27],palmLimit=160)
    actor['rigParts']['rightHand'].update(toolGeometry='drumstick',grip=[.53,.28],palmLimit=160)
    for side in ['left','right']:
     hand=actor['rigParts'][side+'Hand'];g=hand['grip'];c=hand['contact'];hand['contact']=[g[0]+.62*(c[0]-g[0]),g[1]+.62*(c[1]-g[1])]
  if ident=='robin':
   actor['layers']['body']=measure(OUT/'robin-body.png',1)[0]
   actor['layers']['faceFront']=face_depth_layer(actor['layers']['head'])
   actor['rig']['bodyNeck']=[.39,.02]
   actor['rig']['center']=.42
   actor['rig']['prop']=[.54,.62,None,.60]
   actor['bones']={'upper':70,'fore':68}
  if ident=='luffy':
   for name in ['leftHand','rightHand']:actor['rigParts'][name]['clipProximal']=True
  if ident=='nami':actor['rig']['prop']=[.50,.68,.58,None]
  if ident=='sanji':actor['rig']['prop']=[.50,.72,.84,None]
  if ident=='ace':
   actor['bones']={'upper':68,'fore':66}
   actor['rig']['prop'][3]=.43
  if ident=='shanks':
   actor['bones']={'upper':74,'fore':72}
   actor['rig']['center']=.46
   actor['rig']['prop']=[.62,.641,None,.60]
  actor['status']='rig-v3-under-visual-validation';actor['rigVersion']=3
  actors.append(actor)
 manifest={'version':3,'title':'珍珠贝壳角色骨骼修正','actors':actors,'anatomyConvention':'All left/right labels refer to character anatomy, not the viewer.','notice':'Rehearsal is an action fixture, not a claim of source-song transcription or phoneme alignment.'}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
 print('PACKAGED',len(actors),'characters',sum(len(a['rigParts']) for a in actors),'rig parts')
if __name__=='__main__':main()
