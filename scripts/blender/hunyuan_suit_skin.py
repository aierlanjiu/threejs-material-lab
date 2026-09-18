"""Use the suit's sleeve/cuff bands as skin regions, with a rigid glove core."""
import bpy,numpy as np
scene=bpy.context.scene
def smooth(a,b,v):
    t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)
rig=next(o for o in scene.objects if o.type=='ARMATURE' and o.get('li_role')=='astro')
for o in [o for o in scene.objects if o.type=='MESH' and o.get('li_role')=='astro' and not o.name.startswith('HY_Source') and not o.get('li_accessory')]:
    c=np.array([v.co[:] for v in o.data.vertices]);x,y,z=c.T;n=len(c);w={b.name:np.zeros(n) for b in rig.data.bones if b.use_deform}
    head=smooth(1.67,1.86,z);leaf=smooth(3.61,3.76,z);w['Head']=head*(1-leaf);w['Leaf_Antenna']=head*leaf
    threshold=np.interp(z,[.65,1.05,1.38,1.70],[.715,.68,.43,.50])
    arm=smooth(threshold,threshold+.055,abs(x))*(1-smooth(.10,.32,y))*smooth(.61,.68,z)*(1-smooth(1.61,1.76,z))*(1-head)
    rest=1-head-arm;leg=1-smooth(.46,.74,z);w['Body']=rest*(1-leg)
    for s,k in [(1,'L'),(-1,'R')]:
        side=smooth(-.04,.04,s*x);hand=1-smooth(.97,1.125,z);upper=smooth(1.24,1.48,z);lower=1-hand-upper
        for bn,weight in [('Hand',hand),('LowerArm',lower),('UpperArm',upper)]:w[f'{bn}.{k}']=arm*side*weight
        foot=1-smooth(.17,.35,z);calf=(1-foot)*(1-smooth(.38,.56,z));thigh=1-foot-calf
        for bn,weight in [('Foot',foot),('Calf',calf),('Thigh',thigh)]:w[f'{bn}.{k}']=rest*leg*side*weight
    o.vertex_groups.clear()
    for bn,vals in w.items():
        vals=np.round(np.maximum(0,vals),3);group={}
        for i in np.flatnonzero(vals):group.setdefault(float(vals[i]),[]).append(int(i))
        if group:
            vg=o.vertex_groups.new(name=bn)
            for value,ids in group.items():vg.add(ids,value,'REPLACE')
# Shoulder prints inherit the sleeve bones explicitly; all their points lie above the cuff.
for o in scene.objects:
    if o.get('li_role')=='astro' and o.get('li_part','').startswith('Patch.'):
        side='L' if 'Patch.L' in o['li_part'] else 'R';o.vertex_groups.clear();o.vertex_groups.new(name='UpperArm.'+side).add(list(range(len(o.data.vertices))),1,'REPLACE')
print('SUIT_CUFF_WEIGHT_REGIONS_COMPLETE')
