from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
with bpy.data.libraries.load(str(ROOT/'assets/mascots/blender/li-mascots-phase1.blend'),link=False) as (a,b):b.objects=['Fruit core · sealed cheeks']
face=scene.objects['Fruit core · sealed cheeks'];face.data=b.objects[0].data.copy();face.data.materials.clear();face.data.materials.append(bpy.data.materials['Face · flesh and blush'])
face.hide_viewport=False;face.hide_set(False);bpy.context.view_layer.objects.active=face
sub=face.modifiers.new('Continuous fruit surface','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
bm=bmesh.new();bm.from_mesh(face.data)
edges=[e for e in bm.edges if all(abs(v.co.x)<.155 and -.51<v.co.z<-.385 and v.co.y<-.84 for v in e.verts)]
bmesh.ops.subdivide_edges(bm,edges=edges,cuts=3,use_grid_fill=True)
bm.to_mesh(face.data);bm.free()
cream=rgb('FFF0DF');pink=rgb('EE607F');coral=rgb('CA5F6F');col=face.data.color_attributes.get('Col')
for v,c in zip(face.data.vertices,col.data):
    x,y,z=v.co;w=min(.9,sum(math.exp(-((x-s*.49)/.165)**2-((z+.455)/.105)**2) for s in [-1,1])*.90)
    base=tuple(cream[j]*(1-w)+pink[j]*w for j in range(3));t=min(.105,max(-.105,x));line=-.465+.033*(t/.105)**2
    distance=math.sqrt((x-t)**2+(z-line)**2);groove=math.exp(-(distance/.0055)**2) if y<-.85 else 0
    v.co.y+=.0075*groove
    c.color=tuple(base[j]*(1-groove*.92)+coral[j]*groove*.92 for j in range(3))+(1,)
for p in face.data.polygons:p.use_smooth=True
bm=bmesh.new();bm.from_mesh(face.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
check={'boundary_edges':sum(e.is_boundary for e in bm.edges),'non_manifold_edges':sum(not e.is_manifold for e in bm.edges),'vertices':len(bm.verts),'groove_depth':.0075};bm.to_mesh(face.data);bm.free()
assert check['non_manifold_edges']==0,check
mouth=scene.objects['Mouth']
for child in list(mouth.children):
    if not child.get('li_skip_export'):retire(child)
bpy.context.view_layer.update();pts=[]
for i in range(81):
    x=-.105+.21*i/80;z=-.465+.033*(x/.105)**2;hit,p,n,j=face.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    pts.append(tuple(mouth.matrix_local.inverted()@Vector((x,p.y-.0007,z))))
ink=curve('Incised coral smile · pigment',pts,.0016,bpy.data.materials['Tongue · coral'],mouth);ink['recessed']=True
face['sealed_core']=True;face['smile_process']='continuous sculpt displacement with coral pigment, no boolean holes'
# Thin pith is warm ivory, with matte inner fabric rather than a polished golden edge.
p=PITH.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*rgb('FFF3E6'),1);p.inputs['Roughness'].default_value=.43;p.inputs['Coat Weight'].default_value=.10
(ROOT/'output/blender-mcp/smile-topology-check.json').write_text(json.dumps(check,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase3.blend'))
print('SEALED_SCULPTED_SMILE',check)
