"""Correct projection occluders and expression endpoints found in actual renders."""
import bpy,numpy as np,ast,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path('/Users/papazed/dev/threejs-material-lab');OUT=ROOT/'output/hunyuan-rig';scene=bpy.context.scene
tree=ast.parse((ROOT/'scripts/blender/hunyuan_rig.py').read_text());exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'<rig utilities>','exec'))
def source_tree(role,part=None):
    ob=next(o for o in scene.objects if o.type=='MESH' and o.get('li_role')==role and (o.get('li_part')==part if part else o.name.startswith('HY_Source')))
    return BVHTree.FromPolygons([v.co.copy() for v in ob.data.vertices],[list(p.vertices) for p in ob.data.polygons])
for role in ['hoodie','astro']:
    face=next(o for o in scene.objects if o.get('li_part')=='Face' and o.get('li_role')==role)
    keys=face.data.shape_keys.key_blocks;basis='Basis' if role=='hoodie' else 'mouth_open';c=np.array([v.co[:] for v in keys[basis].data]);x,y,z=c.T
    ex,ez,ewx,ewz=(.389,1.915,.197,.191) if role=='hoodie' else (.363,2.514,.145,.178)
    front=smooth(.61,.86,-y);ew=[]
    for s in [-1,1]:
        rad=np.sqrt(((x-s*ex)/ewx)**2+((z-ez)/ewz)**2);ew.append((1-smooth(.96,1.55,rad))*front)
    ew=np.array(ew);e=ew.max(axis=0);mz=1.758 if role=='hoodie' else 2.304;mw=.18 if role=='hoodie' else .152
    rad=np.sqrt((x/mw)**2+((z-mz)/.127)**2);mouth=(1-smooth(.94,1.53,rad))*front
    neutral=c.copy()
    if role=='astro':neutral[:,2]-=(z-mz)*.94*mouth
    keys['Basis'].data.foreach_set('co',neutral.flatten())
    for v,p in zip(face.data.vertices,neutral):v.co=p
    ds={n:np.zeros_like(c) for n in ['blink','smile','curious','shy','mouth_open']}
    ds['blink'][:,2]=-(z-ez)*.988*e;ds['blink'][:,1]=.012*e
    ds['smile'][:,0]=x*.09*mouth;ds['smile'][:,2]=(.014+np.minimum(abs(x)/mw,1)*.028)*mouth
    ds['curious'][:,2]=(z-ez)*.12*ew[0]+.023*ew[1]
    ds['shy'][:,2]=ds['blink'][:,2]*.30-.01*e
    ds['mouth_open'][:,2]=(z-mz)*.94*mouth if role=='astro' else -smooth(mz+.02,mz-.065,z)*.065*mouth
    for n,d in ds.items():keys[n].data.foreach_set('co',(neutral+d).flatten());keys[n].value=0
    face['expression_endpoints_reviewed']=True

# Project pocket markings onto the jacket itself, so the cords occlude the print.
tree=source_tree('hoodie','Hoodie_Body');o=bpy.data.objects['Pocket_LI_Stitch']
for v in o.data.vertices:
    p,n,idx,d=tree.ray_cast(Vector((v.co.x,-4,v.co.z)),Vector((0,1,0)))
    if p:v.co=p+n*.004
o.vertex_groups.clear();o.modifiers.clear();weights(o,bpy.data.objects['hoodie · Rig'],'hoodie')
tree=source_tree('astro')
for sign,name in [(1,'Patch.L · 荔'),(-1,'Patch.R · LI')]:
    o=bpy.data.objects[name];nx,ny=48,24
    for j in range(ny+1):
        for i in range(nx+1):
            y=-.235+sign*(i/nx-.5)*.37;z=1.542+(j/ny-.5)*.17
            p,n,idx,d=tree.ray_cast(Vector((sign*4,y,z)),Vector((-sign,0,0)))
            if not p:raise RuntimeError('Shoulder projection missed')
            o.data.vertices[j*(nx+1)+i].co=p+n*.005
    o.vertex_groups.clear();o.modifiers.clear();weights(o,bpy.data.objects['astro · Rig'],'astro')
for m in bpy.data.materials:
    if m.name.startswith('Eyes ·') and 'textured obsidian' in m.name:
        p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Coat Weight'].default_value=.24;p.inputs['Roughness'].default_value=.14;p.inputs['Specular IOR Level'].default_value=.17
print('PROJECTION_AND_MORPH_REFINEMENTS_COMPLETE')
