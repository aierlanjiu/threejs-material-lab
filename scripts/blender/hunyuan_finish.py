import bpy, math, json, ast, numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path('/Users/papazed/dev/threejs-material-lab');OUT=ROOT/'output/hunyuan-rig';scene=bpy.context.scene
# Reuse only the utility definitions, never rerun the source partition.
tree=ast.parse((ROOT/'scripts/blender/hunyuan_rig.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'<rig utilities>','exec'))

def plain(name,color,rough=.4,metal=0,emit=0,transmission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Transmission Weight'].default_value=transmission
    p.inputs['IOR'].default_value=1.08 if transmission else 1.45;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    return m

def mesh_object(name,verts,faces,mat,role,uvs=None,bone=None):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();me.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    if uvs:
        uv=me.uv_layers.new(name='UVMap')
        for p in me.polygons:
            for li in p.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
    o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.parent=parents[role];o['li_part']=name;o['li_role']=role;o['li_source']='Hunyuan surface refinement';o['li_accessory']=True
    if bone:
        o.vertex_groups.new(name=bone).add(list(range(len(verts))),1,'REPLACE');m=o.modifiers.new('Bound to companion','ARMATURE');m.object=rigs[role]
    else:weights(o,rigs[role],role)
    return o

parents={role:next(o for o in scene.objects if o.type=='EMPTY' and o.get('source_sha256') and o.get('li_role')==role) for role in ['hoodie','astro']}
rigs={role:next(o for o in scene.objects if o.type=='ARMATURE' and o.get('li_role')==role) for role in parents}
trees={}
for role in parents:
    raw=np.load(OUT/(role+'-source.npz'));c=raw['coords'];tri=raw['tri'];trees[role]=BVHTree.FromPolygons([Vector(v) for v in c],tri.tolist(),all_triangles=True)
    # Smooth across UV seams using the original complete surface before partitioning.
    uq,iv=np.unique(np.round(c,6),axis=0,return_inverse=True);normal=np.zeros_like(uq)
    fn=np.cross(c[tri[:,1]]-c[tri[:,0]],c[tri[:,2]]-c[tri[:,0]])
    for k in range(3):np.add.at(normal,iv[tri[:,k]],fn)
    normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-10)
    lookup={tuple(p):tuple(n) for p,n in zip(uq,normal)}
    for o in scene.objects:
        if o.type!='MESH' or o.get('li_role')!=role or o.name.startswith('HY_Source'):continue
        n=[lookup.get(tuple(np.round(v.co[:],6)),tuple(v.normal)) for v in o.data.vertices];o.data.normals_split_custom_set_from_vertices(n)
        if o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks:k.value=0
    for mat in bpy.data.materials:
        if mat.name.startswith(('Rind','Leaf')) and mat.use_nodes:
            p=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if p:p.inputs['Roughness'].default_value=.65;p.inputs['Coat Weight'].default_value=0;p.inputs['Specular IOR Level'].default_value=.16

def project(role,x,z):
    p,n,idx,d=trees[role].ray_cast(Vector((x,-5,z)),Vector((0,1,0)))
    return p,n

def decal(name,role,center,size,normal,tex):
    mat=plain('Decal · '+name,(1,1,1),.62);nodes=mat.node_tree.nodes;p=nodes.get('Principled BSDF');t=nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/'assets/mascots/blender/textures'/tex),check_existing=True)
    mat.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);mat.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha']);mat.surface_render_method='DITHERED'
    normal=Vector(normal).normalized();right=Vector((0,0,1)).cross(normal).normalized();up=normal.cross(right).normalized();center=Vector(center)
    verts=[];uv=[];faces=[];nx,ny=48,24
    for j in range(ny+1):
        for i in range(nx+1):
            q=center+right*((i/nx-.5)*size[0])+up*((j/ny-.5)*size[1]);hit,no,idx,d=trees[role].ray_cast(q+normal*3,-normal)
            if hit is None:raise RuntimeError(f'Decal projection missed {name}')
            verts.append(tuple(hit+no*.0035));uv.append((i/nx,j/ny))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    return mesh_object(name,verts,faces,mat,role,uv)

decal('Pocket_LI_Stitch','hoodie',(0,-1,.78),(1.25,.32),(0,-1,0),'hoodie-pocket.png')
decal('Saturn_Insignia','astro',(0,-1,1.445),(.28,.28),(0,-1,0),'saturn.png')
decal('Patch.L · 荔','astro',(.76,-.19,1.56),(.37,.17),(.72,-.68,.13),'badge-lychee.png')
decal('Patch.R · LI','astro',(-.76,-.19,1.56),(.37,.17),(-.72,-.68,.13),'badge-li.png')

# Fit a single optical surface to the source seal, keeping the sculpted face beneath it.
N=160;R=36;rx=.902;rz=.782;cz=2.662;exp=2/2.35
boundary=[]
for k in range(N):
    a=math.tau*k/N;x=rx*math.copysign(abs(math.cos(a))**exp,math.cos(a));z=cz+rz*math.copysign(abs(math.sin(a))**exp,math.sin(a));p,n=project('astro',x,z);boundary.append((x,p.y-.004,z))
def visor_point(k,r):
    bx,by,bz=boundary[k%N];x=bx*r;z=cz+(bz-cz)*r;y=by*r*r-1.24*(1-r*r)
    surface,n=project('astro',x,z)
    if surface:y=min(y,surface.y-.005-.058*(1-r**4))
    return (x,y,z)
verts=[(0,-1.24,cz)];faces=[]
for j in range(1,R+1):
    for k in range(N):verts.append(visor_point(k,j/R))
for k in range(N):faces.append((0,1+k,1+(k+1)%N))
for j in range(R-1):
    for k in range(N):
        a=1+j*N+k;b=1+j*N+(k+1)%N;faces.append((a,1+(j+1)*N+k,1+(j+1)*N+(k+1)%N,b))
glass=plain('Visor · single optical shell',(1,1,1),.012,0,0,1)
visor=mesh_object('Visor',verts,faces,glass,'astro',bone='Head');visor['single_layer']=True;visor['optical_ior']=1.08
visor['seal_boundary_max_gap']=.004

metal=plain('Hardware · titanium',( .29,.33,.36),.27,.82)
for k in range(8):
    idx=int((k+.5)*N/8);bx,by,bz=boundary[idx];p=Vector((bx,by-.013,bz))
    vv=[]
    for depth in [0,.016]:
        for j in range(6):
            a=math.tau*j/6;vv.append((p.x+.024*math.cos(a),p.y-depth,p.z+.024*math.sin(a)))
    ff=[tuple(range(6,12)),tuple(reversed(range(6)))]+[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)]
    mesh_object(f'Seal_Bolt.{k+1:02}',vv,ff,metal,'astro',bone='Head')
hud=plain('HUD · cyan scales',(0,.70,.82),.3,0,2.5);hp=hud.node_tree.nodes.get('Principled BSDF');hp.inputs['Alpha'].default_value=.65;hud.surface_render_method='DITHERED'
vv=[];ff=[]
for k in range(N):
    if k%5 not in [0,1] or 28<k<52 or 108<k<132:continue
    start=len(vv)
    for kk,r in [(k,.887),(k+1,.887),(k+1,.903),(k,.903)]:
        x,y,z=visor_point(kk,r);vv.append((x,y-.05,z))
    ff.append(tuple(range(start,start+4)))
ho=mesh_object('HUD_Ring',vv,ff,hud,'astro',bone='Head');ho['visor_offset']=.05

# The generated backpack has no independent nozzle bores. Add open, recessed
# engineering inserts on its lower rear surface, leaving the base backpack intact.
inner=plain('Beacon · thruster warm core',(1,.20,.009),.32,0,3)
dark=plain('Thruster · inner ceramic',(.023,.026,.03),.55,.3)
for sign,side in [(1,'L'),(-1,'R')]:
    x=sign*.32;z=.88;p,n,idx,d=trees['astro'].ray_cast(Vector((x,4,z)),Vector((0,-1,0)))
    if p is None:raise RuntimeError('Backpack ray missed')
    # Recess is behind a hollow lip, rather than a bright disc on a solid cap.
    vv=[];ff=[];M=64
    for rr,dep in [(.124,0),(.124,.085),(.084,.088),(.078,.012)]:
        for k in range(M):
            a=math.tau*k/M;vv.append((x+rr*math.cos(a),p.y+dep,z+rr*math.sin(a)))
    for j in range(3):
        for k in range(M):a=j*M+k;b=j*M+(k+1)%M;ff.append((a,b,b+M,a+M))
    mesh_object(f'Thruster.{side}',vv,ff,metal,'astro',bone='Body')
    vv=[(x,p.y+.014,z)]+[(x+.072*math.cos(math.tau*k/M),p.y+.014,z+.072*math.sin(math.tau*k/M)) for k in range(M)]
    mesh_object(f'Thruster_Core.{side}',vv,[(0,1+(k+1)%M,1+k) for k in range(M)],inner,'astro',bone='Body')

# A tiny inner-mouth surface opens with a real morph; the source smile is retained.
mat=plain('Mouth · soft inner cavity',(.105,.016,.018),.47)
M=64;verts=[];opened=[]
for j in range(9):
    rr=j/8
    for k in range(M):
        a=math.tau*k/M;x=.111*rr*math.cos(a);z=1.745+.0001*rr*math.sin(a);p,n=project('hoodie',x,z);verts.append((x,p.y-.002,z))
        oz=1.722+.045*rr*math.sin(a);op,n=project('hoodie',x,oz);opened.append((x,op.y-.004,oz))
ff=[]
for j in range(8):
    for k in range(M):a=j*M+k;b=j*M+(k+1)%M;ff.append((a,a+M,b+M,b))
mouth=mesh_object('Mouth_Interior',verts,ff,mat,'hoodie',bone='Head');mouth.shape_key_add(name='Basis').value=0
key=mouth.shape_key_add(name='mouth_open');key.data.foreach_set('co',np.array(opened).flatten());key.value=0

for role in parents:
    for ob in parents[role].children:
        if ob.type=='MESH' and ob.data.shape_keys:
            for k in ob.data.shape_keys.key_blocks:k.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-hunyuan-finish-work.blend'))
print('HUNYUAN_ACCESSORIES_COMPLETE')
