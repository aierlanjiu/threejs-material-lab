import bpy,numpy as np
from pathlib import Path
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene
def smooth(a,b,v):
    t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)
for role in ['hoodie','astro']:
    rig=next(o for o in scene.objects if o.type=='ARMATURE' and o.get('li_role')==role)
    for ob in [o for o in scene.objects if o.type=='MESH' and o.get('li_role')==role and not o.name.startswith('HY_Source') and not o.get('li_accessory')]:
        c=np.array([v.co[:] for v in ob.data.vertices]);x,y,z=c.T;n=len(c);w={b.name:np.zeros(n) for b in rig.data.bones if b.use_deform}
        head=smooth(1.38,1.59,z) if role=='hoodie' else smooth(1.67,1.86,z);leaf=smooth(3.03,3.16,z) if role=='hoodie' else smooth(3.61,3.76,z)
        w['Head']=head*(1-leaf);w['Leaf_Antenna']=head*leaf
        am={};ap={}
        for s,k in [(1,'L'),(-1,'R')]:
            d=[]
            # Use capsule distances with the suit's depth, not a vertical x/z box.
            stretch=np.array((1,.65,1))
            for bn in [f'UpperArm.{k}',f'LowerArm.{k}',f'Hand.{k}']:
                b=rig.data.bones[bn];a=np.array(b.head_local)*stretch;v=(np.array(b.tail_local)-np.array(b.head_local))*stretch;q=c*stretch;t=np.clip((q-a)@v/(v@v),0,1);d.append(np.linalg.norm(q-(a+t[:,None]*v),axis=1))
            d=np.array(d);dmin=d.min(axis=0);p=np.exp(-(d-dmin)/.047);p/=p.sum(axis=0);ap[k]=p
            am[k]=(1-smooth(.185,.31,dmin))*smooth(.43,.67,s*x)*(1-head)
            if role=='hoodie':
                hand=smooth(.86,1.04,-y)*smooth(.16,.27,s*x)*(1-smooth(.52,.62,s*x))*smooth(.98,1.12,z)*(1-smooth(1.37,1.46,z))
                am[k]=np.maximum(am[k],hand*(1-head))
        arms=np.minimum(1,am['L']+am['R']);remain=np.maximum(0,1-head-arms)
        leg=(1-smooth(.45,.74,z))*(1-smooth(.64,.76,abs(x)))
        w['Body']=remain*(1-leg)
        for s,k in [(1,'L'),(-1,'R')]:
            side=smooth(-.04,.04,s*x);foot=1-smooth(.17,.35,z);calf=(1-foot)*(1-smooth(.38,.56,z));thigh=1-foot-calf
            for bn,v in [('Foot',foot),('Calf',calf),('Thigh',thigh)]:w[f'{bn}.{k}']+=remain*leg*side*v
            for i,bn in enumerate(['UpperArm','LowerArm','Hand']):w[f'{bn}.{k}']+=am[k]*ap[k][i]
        totals=sum(w.values());assert np.min(totals)>.995 and np.max(totals)<1.005
        ob.vertex_groups.clear()
        for bn,vals in w.items():
            vals=np.round(np.maximum(0,vals),3);groups={}
            for i in np.flatnonzero(vals):groups.setdefault(float(vals[i]),[]).append(int(i))
            if groups:
                vg=ob.vertex_groups.new(name=bn)
                for value,ids in groups.items():vg.add(ids,value,'REPLACE')
    # Decals share the closest underlying surface's skin, avoiding floating cloth patches.
    from mathutils.kdtree import KDTree
    from mathutils import Vector
    base=[o for o in scene.objects if o.type=='MESH' and o.get('li_role')==role and not o.name.startswith('HY_Source') and not o.get('li_accessory')]
    kd=KDTree(sum(len(o.data.vertices) for o in base));refs=[]
    for o in base:
        for v in o.data.vertices:kd.insert(v.co,len(refs));refs.append((o,v.index))
    kd.balance()
    for o in scene.objects:
        if o.get('li_role')!=role or not o.get('li_part','').startswith(('Patch','Pocket','Saturn')):continue
        o.vertex_groups.clear();groups={}
        for v in o.data.vertices:
            _,idx,_=kd.find(v.co);source,vi=refs[idx]
            for g in source.data.vertices[vi].groups:groups.setdefault((source.vertex_groups[g.group].name,round(g.weight,3)),[]).append(v.index)
        for (name,value),ids in groups.items():
            vg=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);vg.add(ids,value,'REPLACE')
print('ANATOMICAL_SKIN_CORRECTION_COMPLETE')
