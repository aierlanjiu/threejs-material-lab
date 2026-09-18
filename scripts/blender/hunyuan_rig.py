"""Partition and skin the approved Hunyuan sculpture without rebuilding its silhouette."""
import bpy, math, json, numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');OUT=ROOT/'output/hunyuan-rig'
scene=bpy.context.scene

def smooth(a,b,v):
    t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)

def material(source,name,rough=.45,metal=0,sss=0,coat=0):
    m=source.copy();m.name=name;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Specular IOR Level'].default_value=.35;p.inputs['Coat Weight'].default_value=coat
    p.inputs['Coat Roughness'].default_value=.12;p.inputs['Subsurface Weight'].default_value=sss
    p.inputs['Subsurface Radius'].default_value=(1,.42,.23);p.inputs['Subsurface Scale'].default_value=.09
    return m

def make_part(name,source,ids,mat,parent):
    sm=source.data;raw=np.load(OUT/(source['li_role']+'-source.npz'));tri=raw['tri'][ids]
    orig,inv=np.unique(tri,return_inverse=True);me=bpy.data.meshes.new(name)
    me.from_pydata(raw['coords'][orig].tolist(),[],inv.reshape(-1,3).tolist());me.update()
    uv=me.uv_layers.new(name='UVMap');uv.data.foreach_set('uv',raw['uv'][ids].flatten())
    me.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    me.normals_split_custom_set_from_vertices([sm.vertices[int(i)].normal[:] for i in orig])
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=parent
    ob['li_part']=name;ob['li_role']=source['li_role'];ob['li_source']='Tencent Hunyuan 3D Pro · Blender rig'
    ob['source_vertex_count']=len(orig);ob['rest_surface_max_error']=0.0
    return ob

def armature(role,parent):
    a=bpy.data.armatures.new(role+' · companion skeleton');ob=bpy.data.objects.new(role+' · Rig',a);scene.collection.objects.link(ob);ob.parent=parent
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    bodytop=1.4 if role=='hoodie' else 1.7;headbase=1.48 if role=='hoodie' else 1.78
    specs=[('Root',(0,0,0),(0,0,.22),None),('Spine',(0,0,.55),(0,0,bodytop),'Root'),('Body',(0,0,.75),(0,0,bodytop),'Spine'),('Head',(0,0,headbase),(0,0,headbase+1.0),'Spine')]
    for s,k in [(1,'L'),(-1,'R')]:
        sh=(s*.65,-.12,1.25) if role=='hoodie' else (s*.67,-.03,1.56)
        el=(s*.69,-.50,1.02) if role=='hoodie' else (s*.89,-.12,1.24)
        wr=(s*.41,-.86,1.18) if role=='hoodie' else (s*1.01,-.19,.97)
        ha=(s*.29,-.98,1.29) if role=='hoodie' else (s*1.02,-.21,.79)
        specs.extend([(f'Clavicle.{k}',(s*.18,0,bodytop-.12),sh,'Body'),(f'Arm.{k}',sh,el,f'Clavicle.{k}'),(f'UpperArm.{k}',sh,el,f'Arm.{k}'),(f'LowerArm.{k}',el,wr,f'UpperArm.{k}'),(f'Hand.{k}',wr,ha,f'LowerArm.{k}'),(f'Thigh.{k}',(s*.34,0,.78),(s*.36,0,.48),'Body'),(f'Calf.{k}',(s*.36,0,.48),(s*.37,-.03,.22),f'Thigh.{k}'),(f'Foot.{k}',(s*.37,-.03,.22),(s*.37,-.42,.15),f'Calf.{k}')])
    leafz=3.08 if role=='hoodie' else 3.69
    specs.append(('Leaf_Antenna',(0,0,leafz),(.15,0,leafz+.3),'Head'))
    for name,h,t,par in specs:
        b=a.edit_bones.new(name);b.head=h;b.tail=t
        if par:b.parent=a.edit_bones[par]
        b.use_deform=not name.startswith('Arm.')
    bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False);ob.show_in_front=True
    ob['li_source']='Tencent Hunyuan 3D Pro · Blender rig';ob['li_role']=role
    return ob

def weights(ob,rig,role):
    c=np.array([v.co[:] for v in ob.data.vertices]);x,y,z=c.T;n=len(c)
    w={b.name:np.zeros(n) for b in rig.data.bones if b.use_deform}
    head=smooth(1.38,1.59,z) if role=='hoodie' else smooth(1.67,1.86,z)
    leaf=smooth(3.03,3.16,z) if role=='hoodie' else smooth(3.61,3.76,z)
    w['Head']=head*(1-leaf);w['Leaf_Antenna']=head*leaf
    low=1-head;leg=1-smooth(.47,.72,z)
    w['Body']=low*(1-leg)
    for s,k in [(1,'L'),(-1,'R')]:
        side=smooth(-.04,.04,s*x)
        foot=1-smooth(.17,.35,z);calf=(1-foot)*(1-smooth(.38,.56,z));thigh=1-foot-calf
        for b,v in [('Foot',foot),('Calf',calf),('Thigh',thigh)]:w[f'{b}.{k}']+=low*leg*side*v
        if role=='hoodie':
            outer=smooth(.40,.64,np.abs(x))
            mitten=(1-smooth(.52,.63,np.abs(x)))*smooth(.16,.24,np.abs(x))*smooth(.79,.98,-y)*smooth(.94,1.13,z)*(1-smooth(1.37,1.49,z))
            af=np.maximum(outer,mitten)*smooth(.62,.9,z)*(1-smooth(1.31,1.44,z))*low*(1-leg)*side
        else:af=smooth(.48,.69,np.abs(x))*smooth(.64,.83,z)*(1-smooth(1.58,1.75,z))*low*(1-leg)*side
        bones=[f'UpperArm.{k}',f'LowerArm.{k}',f'Hand.{k}'];ds=[]
        for bn in bones:
            b=rig.data.bones[bn];a=np.array(b.head_local);d=np.array(b.tail_local)-a;t=np.clip((c-a)@d/(d@d),0,1);ds.append(np.linalg.norm(c-(a+t[:,None]*d),axis=1))
        d=np.array(ds);p=np.exp(-(d-d.min(axis=0))/.085);p/=p.sum(axis=0)
        for i,bn in enumerate(bones):w[bn]+=af*p[i]
        w['Body']-=af
    total=sum(w.values());assert np.min(total)>.99 and np.max(total)<1.01,(ob.name,np.min(total),np.max(total))
    # Quantization shares identical weights at duplicated UV/part-boundary vertices.
    for bn,values in w.items():
        vals=np.round(np.clip(values,0,1),3);groups={}
        for i in np.flatnonzero(vals):groups.setdefault(float(vals[i]),[]).append(int(i))
        if groups:
            vg=ob.vertex_groups.new(name=bn)
            for value,ids in groups.items():vg.add(ids,value,'REPLACE')
    mod=ob.modifiers.new('Smooth companion skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
    ob['li_skinned']=True

def face_keys(ob,role):
    ob.shape_key_add(name='Basis').value=0;c=np.array([v.co[:] for v in ob.data.vertices]);x,y,z=c.T
    ex,ez=(.389,1.915) if role=='hoodie' else (.363,2.514)
    ewx,ewz=(.187,.186) if role=='hoodie' else (.143,.176)
    eye=[]
    for s in [-1,1]:eye.append(np.exp(-(((x-s*ex)/ewx)**2+((z-ez)/ewz)**2)**2*.75))
    eye=np.array(eye);front=smooth(.66,.88,-y) if role=='hoodie' else smooth(.61,.82,-y)
    mz=1.758 if role=='hoodie' else 2.30;mw=.18 if role=='hoodie' else .155
    mouth=np.exp(-((x/mw)**2+((z-mz)/.12)**2)**2)*front
    # Astro's generated open smile becomes the mouth_open=1 endpoint; the neutral
    # surface is closed smoothly, leaving the original UVs and mouth sculpt intact.
    if role=='astro':
        neutral=c.copy();neutral[:,2]-=(z-mz)*.84*mouth
        for v,p in zip(ob.data.vertices,neutral):v.co=p
        ob.data.shape_keys.key_blocks['Basis'].data.foreach_set('co',neutral.flatten())
        c=neutral
    deltas={name:np.zeros_like(c) for name in ['blink','smile','curious','shy','mouth_open']}
    combined=np.maximum(eye[0],eye[1])*front
    deltas['blink'][:,2]=-(z-ez)*.96*combined
    deltas['smile'][:,0]=x*.12*mouth
    deltas['smile'][:,2]=(.025+np.minimum(abs(x)/mw,1)*.025)*mouth
    deltas['curious'][:,2]=(z-ez)*.14*eye[0]*front+.035*eye[1]*front
    deltas['shy'][:,2]=deltas['blink'][:,2]*.35-.016*combined
    deltas['shy'][:,1]=-.012*np.exp(-((abs(x)-.42)/.20)**2-((z-(ez-.2))/.15)**2)*front
    if role=='astro':deltas['mouth_open'][:,2]=(z-mz)*.84*mouth
    else:deltas['mouth_open'][:,2]=-smooth(mz+.02,mz-.065,z)*.065*mouth
    for name,delta in deltas.items():
        key=ob.shape_key_add(name=name);key.data.foreach_set('co',(c+delta).flatten());key.slider_min=0;key.slider_max=1;key.value=0
    ob['li_morphs']=['blink','smile','curious','shy','mouth_open']

report={}
for role in ['hoodie','astro']:
    source=bpy.data.objects['HY_Source_'+role];source.hide_viewport=False
    raw=np.load(OUT/(role+'-source.npz'));c=raw['coords'][raw['tri']].mean(axis=1);x,y,z=c.T;r,g,b=raw['col'].T
    labels=np.full(len(z),'Hood_Shell' if role=='hoodie' else 'Helmet_Shell',dtype=object)
    if role=='hoodie':
        labels[z<1.45]='Hoodie_Body';labels[z<.53]='Boots'
        face=(y<-.69)&(z>1.44)&(z<2.46)&(abs(x)<.75)&((g>r*.47)|( (x/.58)**2+((z-1.92)/.30)**2<1))
        labels[face]='Face'
        hand=(z>1.00)&(z<1.47)&(y<-.86)&(abs(x)<.6)&(abs(x)>.17)&(g>r*.67)&(b>r*.6)
        labels[hand&(x>0)]='Hand_Surface.L';labels[hand&(x<0)]='Hand_Surface.R'
        cord=(z>.62)&(z<1.48)&(y<-.77)&(abs(x)<.47)&(g>r*.61)&(b<g*.58)
        labels[cord&(x>0)]='Drawcord.L';labels[cord&(x<0)]='Drawcord.R'
    else:
        labels[z<1.82]='Suit';labels[z<.60]='Boots'
        radial=(abs(x/.88)**2.35+abs((z-2.65)/.76)**2.35)**(1/2.35)
        labels[(radial<.94)&(y<-.51)&(z>1.88)]='Face'
        labels[(radial>=.94)&(radial<1.07)&(y<-.56)&(z>1.86)&(g>r*.40)]='Seal_Ring'
        labels[(z<1.71)&(z>.71)&(y>.22)&(abs(x)<.65)]='Life_Support_Pack'
        labels[(z>.72)&(z<1.20)&(y>.42)&(abs(x)>.18)&(abs(x)<.57)&(r>g*1.25)&(g>b*1.4)&(x>0)]='Thruster.L'
        labels[(z>.72)&(z<1.20)&(y>.42)&(abs(x)>.18)&(abs(x)<.57)&(r>g*1.25)&(g>b*1.4)&(x<0)]='Thruster.R'
    labels[z>(3.12 if role=='hoodie' else 3.72)]='Leaf_Antenna_Surface'
    parent=bpy.data.objects.new(role+' · Hunyuan companion',None);scene.collection.objects.link(parent);parent['li_role']=role;parent['li_source']='Tencent Hunyuan 3D Pro · Blender rig';parent['source_sha256']='9e53213a2ba3f1ec4c8b5e252a26530ca7ac5ab00afa5cedab8646e4b0322448' if role=='hoodie' else '3631bdee7b5391e6292d44ecbadf3a2763f9f696a52b29110b18ffc47b76b721'
    rig=armature(role,parent);parts=[];base=source.data.materials[0]
    mats={
        'face':material(base,'Face · '+role+' · warm jade',.30,0,.12,.16),
        'rind':material(base,'Rind · '+role+' · preserved Hunyuan albedo',.48,0,.025,.13),
        'suit':material(base,'Suit · pearl technical weave',.55,0,0,.09),
        'boots':material(base,'Boots · '+role,.39,0,0,.14),
        'cord':material(base,'Drawcord · living green',.63),
        'seal':material(base,'Seal · vermilion silicone',.35),
        'leaf':material(base,'Leaf · fresh lychee',.43),
    }
    p=next(n for n in mats['seal'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for link in list(p.inputs['Base Color'].links):mats['seal'].node_tree.links.remove(link)
    p.inputs['Base Color'].default_value=(1,.147,.002,1)
    for name in sorted(set(labels)):
        ids=np.flatnonzero(labels==name)
        key='face' if name=='Face' or name.startswith('Hand_Surface') else 'boots' if name=='Boots' else 'cord' if name.startswith('Drawcord') else 'seal' if name=='Seal_Ring' else 'leaf' if name=='Leaf_Antenna_Surface' else 'suit' if role=='astro' and name not in ['Helmet_Shell'] else 'rind'
        ob=make_part(name,source,ids,mats[key],parent)
        if name=='Face':
            eyeMat=material(base,'Eyes · '+role+' · textured obsidian',.06,0,0,1);ob.data.materials.append(eyeMat)
            for poly,idx in zip(ob.data.polygons,ids):
                xx,yy,zz=c[idx];ec=(.389,1.915,.19,.18) if role=='hoodie' else (.363,2.514,.14,.175)
                if ((abs(xx)-ec[0])/ec[2])**2+((zz-ec[1])/ec[3])**2<1 and max(raw['col'][idx])<.6:poly.material_index=1
            face_keys(ob,role)
        weights(ob,rig,role);parts.append(ob)
    source.hide_render=True;source.hide_viewport=True
    report[role]={'source_triangles':len(labels),'derived_triangles':sum(len(p.data.polygons) for p in parts),'parts':{p['li_part']:len(p.data.polygons) for p in parts},'bones':[b.name for b in rig.data.bones], 'source_rest_positions_preserved_except_neutral_astro_mouth':True}
    print('RIGGED',role,report[role])
(OUT/'rig-inventory.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-hunyuan-rig-work.blend'))
print('RIG_STAGE_COMPLETE')
