import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=Path('/Users/papazed/dev/threejs-material-lab/output/hunyuan-rig')
report={}
for role in ['hoodie','astro']:
    ob=bpy.data.objects['HY_Source_'+role];mesh=ob.data
    coords=np.array([v.co[:] for v in mesh.vertices]);tri=np.array([p.vertices[:] for p in mesh.polygons]);uv=np.array([l.uv[:] for l in mesh.uv_layers.active.data]).reshape(-1,3,2)
    im=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
    w,h=im.size;pix=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4);texuv=uv.mean(axis=1)%1
    col=pix[(texuv[:,1]*(h-1)).astype(int),(texuv[:,0]*(w-1)).astype(int),:3]
    np.savez_compressed(out/(role+'-source.npz'),coords=coords,tri=tri,uv=uv,col=col)
    tree=BVHTree.FromPolygons([Vector(v) for v in coords],tri.tolist(),all_triangles=True)
    pts={}
    zvals=[.35,.65,.85,1.05,1.25,1.45,1.65,1.9,2.1,2.3,2.5] if role=='hoodie' else [.3,.7,1.1,1.4,1.6,1.9,2.1,2.3,2.5,2.7,2.9,3.1,3.3,3.45]
    for z in zvals:
        for x in [0,.2,.4,.6,.8,.95]:
            hit,n,i,d=tree.ray_cast(Vector((x,-5,z)),Vector((0,1,0)))
            if hit:pts[f'{x},{z}']={'p':list(hit),'c':list(map(float,col[i])),'n':list(n)}
    report[role]=pts
(out/'surface-probes.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
