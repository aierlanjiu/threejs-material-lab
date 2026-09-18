import bpy,bmesh,json
from pathlib import Path
from mathutils import Vector
root=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene;face=scene.objects['Astronaut fruit face']
assert not face.get('sealed_core'), 'Core already closed'
verts=[v.co.copy() for v in face.data.vertices];faces=[tuple(p.vertices) for p in face.data.polygons];colors=[tuple(c.color) for c in face.data.color_attributes['Col'].data]
edges={}
for p in face.data.polygons:
    for edge in p.edge_keys:edges[edge]=edges.get(edge,0)+1
boundary=[e for e,count in edges.items() if count==1];ids=set(i for e in boundary for i in e);mapping={}
for v in verts:v.z*=1.115
for i in ids:mapping[i]=len(verts);p=verts[i];verts.append(Vector((p.x*.96,p.y+.24,p.z*.96)));colors.append(colors[i])
center=len(verts);verts.append(Vector((0,-.30,0)));colors.append((1,.87,.75,1))
for a,b in boundary:faces.append((a,b,mapping[b],mapping[a]));faces.append((mapping[a],mapping[b],center))
me=bpy.data.meshes.new('Astronaut · closed fruit core');me.from_pydata(verts,[],faces);me.materials.append(face.data.materials[0]);layer=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
for c,value in zip(layer.data,colors):c.color=value
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);check={'boundary_edges':sum(e.is_boundary for e in bm.edges),'non_manifold_edges':sum(not e.is_manifold for e in bm.edges)};assert check['non_manifold_edges']==0,check;bm.to_mesh(me);bm.free()
face.data=me
for p in me.polygons:p.use_smooth=True
face['sealed_core']=True;face['circular_seat_fill']=True
path=root/'output/blender-mcp/phase-review-checks.json';checks=json.loads(path.read_text());checks['Astronaut fruit face']=check;path.write_text(json.dumps(checks,indent=2))
scene.objects['Bounce · face card'].visible_transmission=False
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/mascots/blender/li-mascots-phase3.blend'))
print('ASTRONAUT_CLOSED_CORE',check)
