"""Rebind the approved sculpture in place; run on a copy of li-mascots.blend.

No mesh joins, remeshing, material replacement, or source Hunyuan edits.
Joint coordinates are in the source sculpture's Blender Z-up frame.
"""
from pathlib import Path
import json, math, hashlib
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/li-gallery-rigging'
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
report = {}

def smooth(a, b, v):
    t = np.clip((v-a)/(b-a), 0, 1)
    return t*t*(3-2*t)

def coordinates(ob):
    c = np.empty(len(ob.data.vertices)*3, dtype=np.float64)
    ob.data.vertices.foreach_get('co', c)
    return c.reshape(-1, 3)

def put_coords(ob, c):
    old = coordinates(ob)
    if ob.data.shape_keys:
        for key in ob.data.shape_keys.key_blocks:
            k = np.empty(c.size)
            key.data.foreach_get('co', k)
            key.data.foreach_set('co', (k.reshape(-1,3)+c-old).ravel())
    ob.data.vertices.foreach_set('co', c.ravel())
    ob.data.update()

def uv_hash(ob):
    values=np.empty(len(ob.data.loops)*2,dtype=np.float32)
    if not ob.data.uv_layers:return None
    ob.data.uv_layers.active.data.foreach_get('uv',values)
    return hashlib.sha256(values.tobytes()).hexdigest()

def bind_axes(bone, x):
    y = (bone.tail-bone.head).normalized()
    x = Vector(x)
    x = (x-y*x.dot(y)).normalized()
    bone.align_roll(x.cross(y))

def rebuild(rig, role, parts):
    bpy.ops.object.select_all(action='DESELECT')
    rig.hide_set(False);rig.hide_viewport=False;rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    # Capture original anatomical joint positions before changing hierarchy.
    assert rig.get('li_rig_version',0) < 2, 'Run from the backed-up baseline, not the repaired file'
    old = {b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
    bpy.ops.object.mode_set(mode='EDIT')
    for b in list(rig.data.edit_bones): rig.data.edit_bones.remove(b)
    specs=[]
    def add(n,h,t,parent=None,x=(1,0,0),deform=True): specs.append((n,Vector(h),Vector(t),parent,x,deform))
    top=1.40 if role=='hoodie' else 1.70
    head=1.48 if role=='hoodie' else 1.78
    add('Root',(0,0,0),(0,0,.22))
    add('Hips',(0,0,.65),(0,0,.85),'Root')
    add('Spine',(0,0,.85),(0,0,top-.23),'Hips')
    add('Chest',(0,0,top-.23),(0,0,top),'Spine')
    add('Neck',(0,0,top),(0,0,head),'Chest')
    add('Head',(0,0,head),(0,0,head+1),'Neck')
    leaf=old['Leaf_Antenna'];mid=leaf[0].lerp(leaf[1],.5)
    add('Leaf_Antenna_01',leaf[0],mid,'Head')
    add('Leaf_Antenna_02',mid,leaf[1],'Leaf_Antenna_01')
    if role=='astro':add('Visor_Root',(0,-.5,2.4),(0,-.5,2.65),'Head')
    for side in ['L','R']:
        sh,el=old[f'UpperArm.{side}'];_,wr=old[f'LowerArm.{side}'];_,ha=old[f'Hand.{side}']
        # Both elbow chains have the same negative-X flexion convention.
        hinge = -(el-sh).cross(wr-el).normalized()
        add(f'Clavicle.{side}',old[f'Clavicle.{side}'][0],sh,'Chest')
        add(f'UpperArm.{side}',sh,el,f'Clavicle.{side}',hinge)
        add(f'LowerArm.{side}',el,wr,f'UpperArm.{side}',hinge)
        add(f'Hand.{side}',wr,ha,f'LowerArm.{side}',hinge)
        add(f'ForearmTwist.{side}',el.lerp(wr,.4),wr,f'LowerArm.{side}',hinge)
        pole=el+(el-(sh+wr)*.5).normalized()*.55
        add(f'ElbowPole.{side}',pole,pole+Vector((0,0,.12)),'Root',deform=False)
        for bone,parent in [('Thigh','Hips'),('Calf',f'Thigh.{side}'),('Foot',f'Calf.{side}')]:
            h,t=[v.copy() for v in old[f'{bone}.{side}']]
            knee=.68 if role=='hoodie' else .76
            if bone=='Thigh': h.z=.86 if role=='hoodie' else .94;t.z=knee
            if bone=='Calf': h.z=knee
            add(f'{bone}.{side}',h,t,parent)
        h=old[f'Foot.{side}'][1]
        add(f'Toe.{side}',h,h+Vector((0,-.22,0)),f'Foot.{side}')
        if role=='hoodie':
            c=coordinates(next(o for o in parts if o.get('li_part')==f'Drawcord.{side}'))
            zs=np.linspace(c[:,2].max(),c[:,2].min(),4)
            points=[]
            for z in zs:
                band=c[abs(c[:,2]-z)<.07]
                p=np.median(band,axis=0);p[2]=z;points.append(p)
            for i in range(3):add(f'Drawcord_{i+1:02}.{side}',points[i],points[i+1], 'Chest' if i==0 else f'Drawcord_{i:02}.{side}')
    for name,h,t,parent,x,deform in specs:
        b=rig.data.edit_bones.new(name);b.head=h;b.tail=t;b.use_deform=deform
        if parent:b.parent=rig.data.edit_bones[parent]
        bind_axes(b,x)
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in rig.data.bones:b['li_name']=b.name
    for side in ['L','R']:
        upper=rig.data.bones[f'UpperArm.{side}'];lower=rig.data.bones[f'LowerArm.{side}']
        angle=(upper.tail_local-upper.head_local).angle(lower.tail_local-lower.head_local)
        lower['li_rest_bend']=angle
        lower['li_max_flex']=max(.05,math.pi/2-angle)
        lower['li_max_extension']=angle
    for b in rig.pose.bones:
        b.rotation_mode='QUATERNION';b.rotation_quaternion.identity();b.location=(0,0,0);b.scale=(1,1,1)
    rig['li_rig_version']=2
    rig['li_hinge_axis']='local X; negative elbow flexion'
    return old

def arm_weights(c,rig,side):
    sh=np.array(rig.data.bones[f'UpperArm.{side}'].head_local)
    el=np.array(rig.data.bones[f'LowerArm.{side}'].head_local)
    wr=np.array(rig.data.bones[f'Hand.{side}'].head_local)
    ha=np.array(rig.data.bones[f'Hand.{side}'].tail_local)
    u=(el-sh)/np.linalg.norm(el-sh);f=(wr-el)/np.linalg.norm(wr-el)
    tangent=(u+f)/np.linalg.norm(u+f)
    lower=smooth(-.16,.16,(c-el)@tangent)
    hand=smooth(-.10,.15,(c-wr)@((ha-wr)/np.linalg.norm(ha-wr)))
    # Cuff and hand use exactly the same coordinate-based transition field.
    hand*=lower
    progress=np.clip((c-el)@f/np.linalg.norm(wr-el),0,1)
    twist=(lower-hand)*.25*np.sin(progress*np.pi)**2
    return {f'UpperArm.{side}':1-lower,f'LowerArm.{side}':lower-hand-twist,
            f'ForearmTwist.{side}':twist,f'Hand.{side}':hand}

def body_weights(c, rig, role):
    x,y,z=c.T;n=len(c);w={}
    neck=smooth(1.29 if role=='hoodie' else 1.68,1.435 if role=='hoodie' else 1.83,z)
    leg=1-smooth(.53 if role=='hoodie' else .58,.75,z)
    pelvis=1-smooth(.73,1.00,z)
    chest=smooth(.96,1.25 if role=='hoodie' else 1.5,z)
    w['Head']=neck;w['Hips']=(1-neck)*(1-leg)*pelvis
    w['Spine']=(1-neck)*(1-leg)*(1-pelvis)*(1-chest)
    w['Chest']=(1-neck)*(1-leg)*(1-pelvis)*chest
    for sign,side in [(1,'L'),(-1,'R')]:
        sided=smooth(-.03,.03,x*sign)
        knee=smooth(.55 if role=='hoodie' else .62,.77 if role=='hoodie' else .85,z)
        w[f'Thigh.{side}']=leg*sided*knee
        w[f'Calf.{side}']=leg*sided*(1-knee)
        if role=='hoodie':
            outer=smooth(.49,.67,np.abs(x))
            front=smooth(.76,.90,-y)*smooth(.27,.42,np.abs(x))*smooth(.94,1.08,z)
            mask=np.maximum(outer,front)*smooth(.71,.91,z)*(1-smooth(1.30,1.455,z))*sided
            # The front cuffs belong to the arm even where the head's height overlaps.
            cuff=front*smooth(.94,1.06,z)*(1-smooth(1.40,1.47,z))*sided
            mask=np.maximum(mask,cuff)
        else:mask=smooth(.49,.70,np.abs(x))*smooth(.63,.83,z)*(1-smooth(1.55,1.79,z))*sided
        for key in list(w):w[key]*=(1-mask)
        for name,value in arm_weights(c,rig,side).items():w[name]=value*mask
    return w

def weights(ob,rig,role):
    c=coordinates(ob);n=len(c);name=ob.get('li_part','');x,y,z=c.T
    if name.startswith('Drawcord.'):
        side=name[-1];bones=[rig.data.bones[f'Drawcord_{i:02}.{side}'] for i in range(1,4)]
        centers=np.array([(b.head_local.z+b.tail_local.z)*.5 for b in bones])
        t=np.interp(z,centers[::-1],[2,1,0]);w={}
        for i in range(3):w[f'Drawcord_{i+1:02}.{side}']=np.maximum(0,1-abs(t-i))
    elif name.startswith('Leaf_Antenna'):
        t=smooth(rig.data.bones['Leaf_Antenna_01'].head_local.z,rig.data.bones['Leaf_Antenna_02'].tail_local.z,z)
        w={'Leaf_Antenna_01':1-t,'Leaf_Antenna_02':t}
    elif name in ['Face','Mouth_Interior','Hood_Shell','Helmet_Shell','Seal_Ring','HUD_Ring'] or name.startswith('Seal_Bolt'):
        w={'Head':np.ones(n)}
    elif name=='Visor':w={'Visor_Root':np.ones(n)}
    elif name.startswith('Hand_Surface.'):
        # Jade is a rigid insert; distributing a single palm over the elbow chain
        # turns it into a rubber sheet when the folded arm unfolds.
        w={f'Hand.{name[-1]}':np.ones(n)}
    elif name.startswith('Sleeve.'):
        w=arm_weights(c,rig,name[-1])
    elif name=='Boots':
        w={}
        for sign,side in [(1,'L'),(-1,'R')]:
            sided=smooth(-.02,.02,sign*x)
            calf=smooth(.22,.43,z)
            toe=(1-calf)*(1-smooth(-.64,-.43,y))*.65
            w[f'Calf.{side}']=sided*calf
            w[f'Foot.{side}']=sided*(1-calf-toe)
            w[f'Toe.{side}']=sided*toe
    elif name in ['Life_Support_Pack','Saturn_Insignia'] or name.startswith('Thruster'):
        w={'Chest':np.ones(n)}
    else:w=body_weights(c,rig,role)
    names=list(w);a=np.stack([w[k] for k in names],axis=1)
    a=np.maximum(a,0);order=np.argsort(a,axis=1)[:,:-4] if len(names)>4 else None
    if order is not None:np.put_along_axis(a,order,0,axis=1)
    a/=np.maximum(a.sum(axis=1,keepdims=True),1e-12)
    assert np.max(abs(a.sum(axis=1)-1))<1e-8
    # Quantize once, then re-normalize before populating Blender vertex groups.
    a=np.round(a,4);a/=a.sum(axis=1,keepdims=True)
    assign_weights(ob,names,a)
    for mod in list(ob.modifiers):
        if mod.type=='ARMATURE':ob.modifiers.remove(mod)
    mod=ob.modifiers.new('LI continuous joint skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
    ob['li_rig_version']=2
    return names,a

def assign_weights(ob,names,a):
    ob.vertex_groups.clear()
    for j,name in enumerate(names):
        if not np.any(a[:,j]>0):continue
        vg=ob.vertex_groups.new(name=name)
        values=np.round(a[:,j],6)
        for value in np.unique(values[values>0]):vg.add(np.flatnonzero(values==value).tolist(),float(value),'REPLACE')

def repair_clearances(parts,rig,role):
    """Sculpt small physical clearances, with identical fields on shared seams."""
    changes={}
    for ob in parts:
        part=ob.get('li_part','')
        if part not in ['Hoodie_Body','Suit','Boots','Hand_Surface.L','Hand_Surface.R','Sleeve.L','Sleeve.R']:continue
        c=coordinates(ob);base=c.copy();x,y,z=base.T
        if part in ['Hoodie_Body','Suit','Sleeve.L','Sleeve.R']:
            # Pinch the inward sleeve/axilla band away from the chest, 8 mm max.
            z0=.82 if role=='hoodie' else .94;z1=1.31 if role=='hoodie' else 1.61
            band=smooth(.48,.57,abs(x))*(1-smooth(.72,.90,abs(x)))
            band*=smooth(z0,z0+.10,z)*(1-smooth(z1-.10,z1,z))
            band*=smooth(-.80,-.58,y)*(1-smooth(.12,.32,y))
            c[:,0]+=np.sign(x)*.008*band
        if part in ['Hoodie_Body','Suit','Hand_Surface.L','Hand_Surface.R','Sleeve.L','Sleeve.R']:
            for sign,side in [(1,'L'),(-1,'R')]:
                wrist=np.array(rig.data.bones[f'Hand.{side}'].head_local)
                axis=np.array(rig.data.bones[f'Hand.{side}'].tail_local)-wrist;axis/=np.linalg.norm(axis)
                v=base-wrist;along=v@axis;radial=v-along[:,None]*axis
                radius=np.linalg.norm(radial,axis=1)
                taper=(1-smooth(.07,.19,abs(along)))*(1-smooth(.15,.26,radius))*smooth(.10,.20,x*sign)
                if role=='hoodie':taper*=1-smooth(1.34,1.425,z)
                # A 5 mm recess around the wrist keeps the rigid jade inside the cuff opening.
                c-=radial/np.maximum(radius[:,None],1e-8)*(.005*taper)[:,None]
        if part in ['Hoodie_Body','Suit','Boots']:
            edge=.54 if role=='hoodie' else .605
            for sign,side in [(1,'L'),(-1,'R')]:
                ankle=np.array(rig.data.bones[f'Calf.{side}'].tail_local)
                radial=base[:,:2]-ankle[:2];radius=np.linalg.norm(radial,axis=1)
                taper=(1-smooth(.02,.10,abs(z-edge)))*smooth(.08,.20,x*sign)
                c[:,:2]-=radial/np.maximum(radius[:,None],1e-8)*(.006*taper)[:,None]
        delta=np.linalg.norm(c-base,axis=1)
        if delta.max()>0:
            put_coords(ob,c);changes[part]={'vertices':int((delta>1e-6).sum()),'max_offset':float(delta.max())}
    return changes

def match_seams(cloth, parts, skins, rig, wanted=None):
    """Use shared source vertices as exact cuff, boot and neckline anchors."""
    c=coordinates(cloth);names=[b.name for b in rig.data.bones if b.use_deform];lookup={n:i for i,n in enumerate(names)}
    a=np.zeros((len(c),len(names)))
    old_names,old=skins[cloth.name]
    for i,n in enumerate(old_names):a[:,lookup[n]]=old[:,i]
    keys={tuple(v):i for i,v in enumerate(np.round(c,5))};counts={};exact={}
    wanted=wanted or ['Hand_Surface.L','Hand_Surface.R','Boots','Hood_Shell','Helmet_Shell']
    for ob in parts:
        if ob.get('li_part') not in wanted:continue
        source=coordinates(ob);src_names,src_w=skins[ob.name]
        common=[i for i,v in enumerate(np.round(source,5)) if tuple(v) in keys]
        counts[ob.get('li_part')]=len(common)
        if not common:continue
        kd=KDTree(len(common))
        for j,i in enumerate(common):kd.insert(Vector(source[i]),j)
        kd.balance();lo=source[common].min(axis=0)-.06;hi=source[common].max(axis=0)+.06
        targets=np.flatnonzero(np.all((c>=lo)&(c<=hi),axis=1))
        for i in targets:
            _,j,d=kd.find(Vector(c[i]))
            if d>.06:continue
            f=float(1-smooth(.00002,.06,d));w=np.zeros(len(names))
            for k,n in enumerate(src_names):w[lookup[n]]=src_w[common[j],k]
            a[i]=a[i]*(1-f)+w*f
        for i in common:
            w=np.zeros(len(names))
            for k,n in enumerate(src_names):w[lookup[n]]=src_w[i,k]
            # Exact cuff anchors take precedence over a nearby collar falloff.
            key=tuple(np.round(source[i],5))
            priority=2 if ob.get('li_part','').startswith('Hand_Surface') else 1
            if key not in exact or priority>exact[key][0]:exact[key]=(priority,w)
    for i,v in enumerate(np.round(c,5)):
        if tuple(v) in exact:a[i]=exact[tuple(v)][1]
    order=np.argsort(a,axis=1)[:,:-4];np.put_along_axis(a,order,0,axis=1)
    a/=a.sum(axis=1,keepdims=True)
    assign_weights(cloth,names,a);skins[cloth.name]=(names,a)
    return counts

def corrective(ob,rig,skin,bone,keyname,angle):
    """Bake the DQ-vs-LBS difference back into rest space for glTF morphs."""
    names,w=skin;base=coordinates(ob);mod=next(m for m in ob.modifiers if m.type=='ARMATURE')
    pb=rig.pose.bones[bone];pb.rotation_mode='XYZ';pb.rotation_euler=(angle,0,0)
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
    def posed(volume):
        mod.use_deform_preserve_volume=volume;bpy.context.view_layer.update();dg.update()
        e=ob.evaluated_get(dg);return coordinates(e)
    dq=posed(True);lbs=posed(False);diff=dq-lbs
    matrices=np.array([np.array(rig.pose.bones[n].matrix @ rig.data.bones[n].matrix_local.inverted())[:3,:3] for n in names])
    linear=np.einsum('vb,bij->vij',w,matrices)
    delta=np.linalg.solve(linear,diff[...,None])[...,0]
    # Sparse support keeps the corrective strictly at its own bending joint.
    delta[np.linalg.norm(diff,axis=1)<1e-5]=0
    if not ob.data.shape_keys:ob.shape_key_add(name='Basis')
    k=ob.shape_key_add(name=keyname);k.data.foreach_set('co',(base+delta).ravel());k.value=0
    pb.rotation_euler=(0,0,0);pb.rotation_mode='QUATERNION';pb.rotation_quaternion.identity()
    mod.use_deform_preserve_volume=False;bpy.context.view_layer.update()
    return float(np.linalg.norm(delta,axis=1).max())

for role in ['hoodie','astro']:
    parent=next(o for o in scene.objects if o.type=='EMPTY' and o.get('source_sha256') and o.get('li_role')==role)
    rig=next(o for o in parent.children_recursive if o.type=='ARMATURE')
    parts=[o for o in parent.children_recursive if o.type=='MESH' and o.get('li_part')]
    before={o.name:{'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'materials':[m.name for m in o.data.materials],'uv_sha256':uv_hash(o),
                   'morphs':[k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else []} for o in parts}
    for o in parts:
        o.hide_viewport=False;o.hide_set(False)
        if o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks:k.value=0
        # Restore all poses before rebinding; no geometry is baked from an action.
    for b in rig.pose.bones:b.rotation_quaternion.identity();b.location=(0,0,0);b.scale=(1,1,1)
    bpy.context.view_layer.update()
    # 12 mm stand-off for the cord skin, preserving its longitudinal contour.
    for ob in parts:
        if ob.get('li_part','').startswith('Drawcord.'):
            c=coordinates(ob);c[:,1]-=.012*(1-smooth(1.34,1.48,c[:,2]));put_coords(ob,c)
    topology={} # Preserve the approved visible sculpture and every original UV loop.
    old=rebuild(rig,role,parts)
    geometry=repair_clearances(parts,rig,role)
    skins={o.name:weights(o,rig,role) for o in parts}
    fixes={}
    cloth=next(o for o in parts if o.get('li_part')==('Hoodie_Body' if role=='hoodie' else 'Suit'))
    seams=match_seams(cloth,parts,skins,rig)
    for side in ['L','R']:
        elbow_parts=[cloth]+[o for o in parts if o.get('li_part')==f'Hand_Surface.{side}']
        for ob in elbow_parts:
            flex=rig.data.bones[f'LowerArm.{side}']['li_max_flex']
            fixes[f'{ob.name}/ElbowFix_{side}']=corrective(ob,rig,skins[ob.name],f'LowerArm.{side}',f'ElbowFix_{side}',-flex)
        for ob in [cloth,next(o for o in parts if o.get('li_part')=='Boots')]:
            fixes[f'{ob.name}/KneeFix_{side}']=corrective(ob,rig,skins[ob.name],f'Calf.{side}',f'KneeFix_{side}',-1.25)
    bpy.context.view_layer.update()
    for o in parts:
        if o.name not in before:continue
        a=before[o.name]
        assert uv_hash(o)==a['uv_sha256'],(o.name,'UV changed')
        if o.get('li_part') not in topology:assert len(o.data.vertices)==a['vertices'] and len(o.data.polygons)==a['polygons']
        if not o.get('li_part','').startswith('Hand_Surface'):assert [m.name for m in o.data.materials]==a['materials']
        assert set(a['morphs']).issubset({k.name for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else set())
    # Source meshes and review props are intentionally outside the export allowlist.
    bpy.ops.object.select_all(action='DESELECT')
    for o in [parent,rig]+parts:o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    path=ROOT/'assets/mascots/blender'/f'{role}-lychee.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
        export_apply=False,export_animations=False,export_skins=True,export_morph=True,export_morph_normal=True,
        export_extras=True,export_texcoords=True,export_normals=True,export_tangents=True,
        export_materials='EXPORT',export_def_bones=True)
    report[role]={'bones':[b.name for b in rig.data.bones if b.use_deform],'controls':[b.name for b in rig.data.bones if not b.use_deform],
                  'preserved':before,'surface_topology_repairs':topology,'geometry_repairs':geometry,'seam_anchors':seams,'corrective_max_delta':fixes,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    print('LI_RIG_EXPORTED',role,len(report[role]['bones']),path.stat().st_size,flush=True)

bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots.blend'),compress=True)
(OUT/'rig-build.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('LI_RIG_REPAIR_COMPLETE',flush=True)
