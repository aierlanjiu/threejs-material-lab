"""Validate delivered skin/morph contracts and unchanged Hunyuan source hashes."""
import json,struct,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
SZ={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(path):
    raw=path.read_bytes();assert raw[:4]==b'glTF';size=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+size]);bin=raw[28+size:]
    def acc(i):
        a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);n=SZ[a['type']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        return np.ndarray((a['count'],n),dtype=dt,buffer=bin,offset=offset,strides=(v.get('byteStride',n*dt.itemsize),dt.itemsize))
    return j,acc
report={};manifest={'source':'Tencent Hunyuan 3D Pro + Blender MCP 1.9.1','blender':'5.1.2','reference':'HANDOFF-2026-09-16-hunyuan-to-codex.md','animation_mode':'runtime bones and glTF morph targets','models':{}}
for role,folder,expected in [('hoodie','scheme_a_hoodie','9e53213a2ba3f1ec4c8b5e252a26530ca7ac5ab00afa5cedab8646e4b0322448'),('astro','scheme_d_astro','3631bdee7b5391e6292d44ecbadf3a2763f9f696a52b29110b18ffc47b76b721')]:
    source=ROOT/'assets/mascots/hunyuan3d'/folder/'model_glb.glb';assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
    path=ROOT/'assets/mascots/blender'/f'{role}-lychee.glb';j,acc=read(path);assert len(j['skins'])==1
    bones=[j['nodes'][i]['name'] for i in j['skins'][0]['joints']]
    assert set(['Root','Spine','Head','Arm.L','Arm.R','Hand.L','Hand.R']).issubset(bones)
    triangles=0;primitives=0;morphs={};max_error=0;weighted=0;visor=None
    for m in j['meshes']:
        for p in m['primitives']:
            primitives+=1;attrs=p['attributes'];pos=acc(attrs['POSITION']);assert np.isfinite(pos).all()
            triangles+=len(acc(p['indices']))//3
            assert 'JOINTS_0' in attrs and 'WEIGHTS_0' in attrs,m['name']
            w=acc(attrs['WEIGHTS_0']);assert np.isfinite(w).all() and (w>=0).all();error=float(abs(w.sum(axis=1)-1).max());assert error<1e-4
            assert acc(attrs['JOINTS_0']).max()<len(bones);max_error=max(max_error,error);weighted+=len(w)
            for name,t in zip(m.get('extras',{}).get('targetNames',[]),p.get('targets',[])):
                delta=acc(t['POSITION']);assert delta.shape==pos.shape and np.isfinite(delta).all();mag=np.linalg.norm(delta,axis=1);morphs[name]=max(morphs.get(name,0),float(mag.max()))
            if m['name']=='Visor':
                faces=acc(p['indices']).flatten().reshape(-1,3);edges=np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1);_,count=np.unique(edges,axis=0,return_counts=True);visor={'vertices':len(pos),'boundary_edges':int((count==1).sum()),'nonmanifold_edges':int((count>2).sum())};assert visor['boundary_edges']==160 and not visor['nonmanifold_edges']
    assert all(morphs.get(k,0)>.005 for k in ['blink','smile','curious','shy','mouth_open'])
    if role=='astro':assert visor is not None
    report[role]={'source_hash_preserved':True,'triangles':triangles,'primitives':primitives,'bones':bones,'morph_max_displacement':morphs,'skinned_vertices':weighted,'weight_normalization_max_error':max_error,'visor':visor,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    manifest['models'][role]={'file':str(path.relative_to(ROOT)),'triangles':triangles,'meshes':primitives,'bytes':path.stat().st_size,'sha256':report[role]['sha256'],'source_sha256':expected,'bones':len(bones),'morphs':list(morphs)}
(ROOT/'output/hunyuan-rig/glb-validation.json').write_text(json.dumps(report,indent=2));(ROOT/'assets/mascots/blender/manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(report,indent=2))
