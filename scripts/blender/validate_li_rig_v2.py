"""Check the shipped GLBs, including material/morph preservation and seam weights."""
from pathlib import Path
import json, struct, hashlib, tarfile
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/li-gallery-rigging'
DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
SZ={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(raw):
    assert raw[:4]==b'glTF'
    size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);binary=raw[28+size:]
    for node in g.get('nodes',[]):
        if 'mesh' in node and node.get('extras',{}).get('li_part'):g['meshes'][node['mesh']]['name']=node['extras']['li_part']
    def acc(i):
        a=g['accessors'][i];dt=np.dtype(DT[a['componentType']]);n=SZ[a['type']]
        if 'bufferView' in a:
            v=g['bufferViews'][a['bufferView']]
            arr=np.ndarray((a['count'],n),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*dt.itemsize),dt.itemsize)).copy()
        else:arr=np.zeros((a['count'],n),dtype=dt)
        if 'sparse' in a:
            sparse=a['sparse'];indices=sparse['indices'];values=sparse['values']
            iv=g['bufferViews'][indices['bufferView']];vv=g['bufferViews'][values['bufferView']]
            ix=np.frombuffer(binary,dtype=DT[indices['componentType']],count=sparse['count'],offset=iv.get('byteOffset',0)+indices.get('byteOffset',0))
            arr[ix]=np.frombuffer(binary,dtype=dt,count=sparse['count']*n,offset=vv.get('byteOffset',0)+values.get('byteOffset',0)).reshape(-1,n)
        if a.get('normalized'):arr=arr.astype(float)/np.iinfo(dt).max
        return arr
    return g,acc

def mesh_info(g,acc):
    out={}
    for m in g['meshes']:
        if m['name']=='Cube':continue # Blender's unused exporter default scene, not in the active model.
        out[m['name']]={'vertices':sum(g['accessors'][p['attributes']['POSITION']]['count'] for p in m['primitives']),
            'triangles':sum(g['accessors'][p['indices']]['count']//3 for p in m['primitives']),
            'materials':[g['materials'][p['material']]['name'] for p in m['primitives']],
            'morphs':m.get('extras',{}).get('targetNames',[])}
    return out

report={}
for role in ['hoodie','astro']:
    path=ROOT/'assets/mascots/blender'/f'{role}-lychee.glb';raw=path.read_bytes();g,acc=read(raw)
    skin=g['skins'][0];bones=[g['nodes'][i]['name'] for i in skin['joints']]
    required=['Root','Hips','Spine','Chest','Neck','Head','Leaf_Antenna_01','Leaf_Antenna_02']
    required += [f'{n}.{s}' for s in ['L','R'] for n in ['Clavicle','UpperArm','LowerArm','Hand','ForearmTwist','Thigh','Calf','Foot','Toe']]
    if role=='hoodie':required += [f'Drawcord_{i:02}.{s}' for s in ['L','R'] for i in range(1,4)]
    else:required += ['Visor_Root']
    assert set(required)==set(bones),(role,set(required)-set(bones),set(bones)-set(required))
    assert all(not b.startswith(('Arm.','ElbowPole.')) for b in bones)
    parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])}
    by_name={n['name']:i for i,n in enumerate(g['nodes']) if 'name' in n}
    for side in ['L','R']:
        for child,parent in [('UpperArm','Clavicle'),('LowerArm','UpperArm'),('Hand','LowerArm'),('Calf','Thigh'),('Foot','Calf'),('Toe','Foot')]:
            assert parents[by_name[f'{child}.{side}']]==by_name[f'{parent}.{side}']
    max_error=0;vertices=0;mesh_data={};morphs={}
    for mesh in g['meshes']:
        if mesh['name']=='Cube':continue
        positions=[];weights=[]
        for p in mesh['primitives']:
            attrs=p['attributes'];pos=acc(attrs['POSITION']);w=acc(attrs['WEIGHTS_0']);j=acc(attrs['JOINTS_0']).astype(int)
            assert 'WEIGHTS_1' not in attrs and 'JOINTS_1' not in attrs
            assert np.isfinite(pos).all() and np.isfinite(w).all() and np.min(w)>=0
            assert j.min()>=0 and j.max()<len(bones)
            error=float(abs(w.sum(axis=1)-1).max());max_error=max(max_error,error);assert error<2e-5
            assert 'NORMAL' in attrs
            if 'TEXCOORD_0' in attrs:assert 'TANGENT' in attrs
            dense=np.zeros((len(pos),len(bones)))
            for k in range(4):np.add.at(dense,(np.arange(len(pos)),j[:,k]),w[:,k])
            if mesh['name'].startswith('Drawcord'):
                side=mesh['name'][-1];allowed={f'Drawcord_{i:02}.{side}' for i in range(1,4)}
                assert not any(dense[:,i].max()>0 for i,b in enumerate(bones) if b not in allowed)
            if mesh['name'].startswith(('Face','Mouth_Interior')):
                assert np.allclose(dense[:,bones.index('Head')],1,atol=2e-5)
            for name,target in zip(mesh.get('extras',{}).get('targetNames',[]),p.get('targets',[])):
                delta=acc(target['POSITION']);assert delta.shape==pos.shape and np.isfinite(delta).all()
                morphs[name]=max(morphs.get(name,0),float(np.linalg.norm(delta,axis=1).max()))
            vertices+=len(pos);positions.append(pos);weights.append(dense)
        mesh_data[mesh['name']]=(np.concatenate(positions),np.concatenate(weights))
    for k in ['blink','smile','curious','shy','mouth_open','ElbowFix_L','ElbowFix_R']:assert morphs.get(k,0)>.001,k
    seams={};cloth=mesh_data['Hoodie_Body' if role=='hoodie' else 'Suit']
    for name,(pos,w) in mesh_data.items():
        if not name.startswith(('Hand_Surface','Boots','Hood_Shell','Helmet_Shell')):continue
        seam_cloth=mesh_data.get('Sleeve.'+name[-1],cloth) if name.startswith('Hand_Surface') else cloth
        lookup={tuple(p):i for i,p in enumerate(np.round(seam_cloth[0],5))}
        errors=[]
        for i,p in enumerate(np.round(pos,5)):
            j=lookup.get(tuple(p))
            if j is not None:errors.append(float(np.max(abs(w[i]-seam_cloth[1][j]))))
        if errors:
            seams[name]={'vertices':len(errors),'max_weight_difference':max(errors)}
            assert max(errors)<2e-4,(role,name,max(errors))
    # Compare primitive topology and appearance contracts against the physical backup.
    with tarfile.open(ROOT/'output/backups/li-gallery-rig-20260916-160256/before.tar') as backup:
        old_raw=backup.extractfile(f'assets/mascots/blender/{role}-lychee.glb').read()
    old_g,old_acc=read(old_raw);old_info=mesh_info(old_g,old_acc);new_info=mesh_info(g,acc)
    # Blender may suffix datablock names, but li_part and per-part topology are stable.
    def canonical(name):return name.split('.')[0] if name.startswith(('Boots.','Face.','Visor.')) else name
    old_info={canonical(k):v for k,v in old_info.items()};new_info={canonical(k):v for k,v in new_info.items()}
    assert old_info.keys()==new_info.keys(),(old_info.keys(),new_info.keys())
    for name,old in old_info.items():
        new=new_info[name]
        assert old['triangles']==new['triangles'],(name,'topology')
        assert old['materials']==new['materials'],(name,'materials')
        assert set(old['morphs']).issubset(set(new['morphs'])),(name,'morphs')
    report[role]={'passed':True,'bones':len(bones),'vertices':vertices,'weight_sum_max_error':max_error,'seams':seams,'morph_max_delta':morphs,'all_original_topology_materials_and_facial_morphs_retained':True,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}

(OUT/'glb-validation.json').write_text(json.dumps(report,indent=2))
manifest={'version':2,'source':'Tencent Hunyuan 3D Pro + Blender','rig_script':'scripts/blender/repair_li_rig.py','models':report}
(ROOT/'assets/mascots/blender/manifest.json').write_text(json.dumps(manifest,indent=2))
print('LI_GLB_VALIDATED',json.dumps(report),flush=True)
